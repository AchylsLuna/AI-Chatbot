import 'dotenv/config'
import cors from 'cors'
import crypto from 'node:crypto'
import express from 'express'
import { initStore, getStore } from '../config/store.js'
import { recordAuditEvent } from '../modules/audit/index.js'
import {
  login,
  registerUser,
  requestLoginOtp,
  verifyLoginOtp,
  requireAuth,
  requireRole,
  seedUsers,
  validateAuthConfig,
} from '../modules/auth/index.js'
import { recordAppointmentOnChain } from '../modules/blockchain/index.js'
import { assignRequestId, buildRequestContext, createRateLimiter, securityHeaders } from '../modules/security/index.js'
import {
  generateTriageSummary,
  getFallbackSummary,
  isValidSymptoms,
  normalizeDepartment,
} from '../modules/triage/index.js'

const PORT = process.env.PORT ? Number(process.env.PORT) : 5174
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

const parseCorsOrigins = (value) => {
  if (!value) return []
  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

const corsOrigins = parseCorsOrigins(CORS_ORIGIN)
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (corsOrigins.length === 0 || corsOrigins.includes(origin)) {
      return callback(null, true)
    }
    return callback(new Error('Not allowed by CORS'))
  },
}

const app = express()

app.disable('x-powered-by')
app.set('trust proxy', 1)

app.use(assignRequestId)
app.use(securityHeaders)
app.use(cors(corsOptions))
app.use(express.json({ limit: '1mb' }))
app.use(createRateLimiter({ windowMs: 60 * 1000, max: 300, name: 'global' }))

const generateReservationId = () => {
  if (crypto.randomUUID) {
    return `RES-${crypto.randomUUID().split('-')[0]}`
  }
  return `RES-${crypto.randomBytes(4).toString('hex')}`
}

const buildHash = (payload) => {
  return `0x${crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`
}

const CHAIN_STRICT = String(process.env.CHAIN_STRICT || 'false').toLowerCase() === 'true'
const REQUIRE_AUTH_FOR_BOOKING =
  String(process.env.REQUIRE_AUTH_FOR_BOOKING || 'false').toLowerCase() === 'true'
const MAX_SYMPTOM_LENGTH = Number(process.env.MAX_SYMPTOM_LENGTH) || 2000
const MAX_NAME_LENGTH = 80
const MAX_EMAIL_LENGTH = 120
const MAX_ORG_LENGTH = 120
const MAX_NOTES_LENGTH = 500
const MAX_REQUESTED_TIME_LENGTH = 40
const MAX_SUMMARY_LENGTH = 600
const TRIAGE_PROOF_TTL_MS = Number(process.env.TRIAGE_PROOF_TTL_MS) || 10 * 60 * 1000
const TRIAGE_CACHE_TTL_MS = Number(process.env.TRIAGE_CACHE_TTL_MS) || 5 * 60 * 1000
const TRIAGE_CACHE_MAX_ITEMS = Number(process.env.TRIAGE_CACHE_MAX_ITEMS) || 200
const TRIAGE_SIGNATURE_SECRET =
  process.env.TRIAGE_SIGNATURE_SECRET ||
  process.env.JWT_SECRET ||
  'dev-triage-signature-secret-change-me'

const authLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20, name: 'auth' })
const summaryLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30, name: 'triage' })
const bookingLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 40, name: 'booking' })
const aiAlertActionLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 90,
  name: 'ai-alert-action',
})
const accessRequestLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  name: 'access-request',
})

const triageSummaryCache = new Map()

const trimAndLimit = (value, max) => {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

const isValidEmail = (value) => {
  if (!value) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

const isValidComEmail = (value) => {
  if (!isValidEmail(value)) return false
  return value.toLowerCase().endsWith('.com')
}

const safeAudit = async (event) => {
  try {
    await recordAuditEvent(event)
  } catch (error) {
    console.warn('Audit log failed', error)
  }
}

const normalizeSummaryPayload = ({ symptoms, summary }) => {
  const confidence = typeof summary?.confidence === 'number' ? Number(summary.confidence.toFixed(6)) : null
  return JSON.stringify({
    symptoms: trimAndLimit(symptoms || '', MAX_SYMPTOM_LENGTH),
    department: trimAndLimit(summary?.department || '', MAX_NAME_LENGTH),
    priority: trimAndLimit(summary?.priority || '', 16),
    confidence,
    summary: trimAndLimit(summary?.summary || '', MAX_SUMMARY_LENGTH),
    source: typeof summary?.source === 'string' ? summary.source : 'unknown',
  })
}

const createTriageSummarySignature = ({ symptoms, summary, issuedAt, expiresAt, nonce }) => {
  const payload = normalizeSummaryPayload({ symptoms, summary })
  const toSign = `${payload}|${issuedAt}|${expiresAt}|${nonce}`
  return crypto.createHmac('sha256', TRIAGE_SIGNATURE_SECRET).update(toSign).digest('hex')
}

const signTriageSummary = ({ symptoms, summary }) => {
  const issuedAt = Date.now()
  const expiresAt = issuedAt + TRIAGE_PROOF_TTL_MS
  const nonce = crypto.randomBytes(8).toString('hex')
  const signature = createTriageSummarySignature({
    symptoms,
    summary,
    issuedAt,
    expiresAt,
    nonce,
  })

  return {
    ...summary,
    proof: {
      version: 'v1',
      issuedAt,
      expiresAt,
      nonce,
      signature,
    },
  }
}

const verifyTriageSummaryProof = ({ symptoms, summary }) => {
  const proof = summary?.proof
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) return false

  const issuedAt = Number(proof.issuedAt)
  const expiresAt = Number(proof.expiresAt)
  const nonce = typeof proof.nonce === 'string' ? proof.nonce : ''
  const signature = typeof proof.signature === 'string' ? proof.signature : ''
  const version = typeof proof.version === 'string' ? proof.version : ''

  if (version !== 'v1') return false
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || !nonce || !signature) return false
  const now = Date.now()
  if (expiresAt <= now || issuedAt > now + 30 * 1000) return false

  const expected = createTriageSummarySignature({
    symptoms,
    summary,
    issuedAt,
    expiresAt,
    nonce,
  })
  const expectedBuffer = Buffer.from(expected, 'hex')
  const providedBuffer = Buffer.from(signature, 'hex')
  if (expectedBuffer.length === 0 || providedBuffer.length === 0) return false
  if (expectedBuffer.length !== providedBuffer.length) return false
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer)
}

const triageCacheKey = (symptoms) => trimAndLimit(symptoms.toLowerCase(), MAX_SYMPTOM_LENGTH)

const getCachedSignedSummary = (symptoms) => {
  const key = triageCacheKey(symptoms)
  const cached = triageSummaryCache.get(key)
  if (!cached) return null
  if (cached.expiresAt <= Date.now()) {
    triageSummaryCache.delete(key)
    return null
  }
  return cached.summary
}

const setCachedSignedSummary = (symptoms, summary) => {
  const key = triageCacheKey(symptoms)
  triageSummaryCache.set(key, {
    summary,
    expiresAt: Date.now() + TRIAGE_CACHE_TTL_MS,
  })

  if (triageSummaryCache.size <= TRIAGE_CACHE_MAX_ITEMS) return
  const firstKey = triageSummaryCache.keys().next().value
  if (firstKey) triageSummaryCache.delete(firstKey)
}

const createAccessRequest = async ({ fullName, email, organization, roleRequested, notes }, ctx) => {
  const allowedRoles = ['user', 'nurse', 'admin', 'system_admin']
  const normalizedRole =
    typeof roleRequested === 'string' ? roleRequested.trim().toLowerCase() : ''
  if (!allowedRoles.includes(normalizedRole)) {
    throw new Error('Invalid role requested')
  }

  const cleanedName = trimAndLimit(fullName, MAX_NAME_LENGTH)
  const cleanedEmail = trimAndLimit(email, MAX_EMAIL_LENGTH).toLowerCase()
  const cleanedOrg = trimAndLimit(organization, MAX_ORG_LENGTH)
  const cleanedNotes = trimAndLimit(notes, MAX_NOTES_LENGTH)

  if (!cleanedName || !cleanedEmail || !isValidEmail(cleanedEmail)) {
    throw new Error('Missing required fields')
  }

  const request = {
    id: `REQ-${Date.now()}`,
    fullName: cleanedName,
    email: cleanedEmail,
    organization: cleanedOrg,
    roleRequested: normalizedRole,
    notes: cleanedNotes,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  const store = getStore()
  await store.collection('access_requests').insertOne(request)

  await safeAudit({
    type: 'access_request_created',
    roleRequested: normalizedRole,
    email: cleanedEmail,
    success: true,
    ...ctx,
  })

  return request
}

const buildActor = (req) => {
  if (!req.user) return null
  return { username: req.user.username, role: req.user.role }
}

const buildAuditContext = (req) => ({
  ...buildRequestContext(req),
  actor: buildActor(req),
})

const maybeRequireAuth = (req, res, next) => {
  if (!REQUIRE_AUTH_FOR_BOOKING) {
    const hasAuthHeader = typeof req.headers.authorization === 'string'
    if (!hasAuthHeader) return next()
  }
  return requireAuth(req, res, next)
}

const shouldSeedUsers = () => {
  return String(process.env.SEED_USERS || 'true').toLowerCase() === 'true'
}

const shouldSeedDemo = () => {
  return String(process.env.SEED_DEMO || 'true').toLowerCase() === 'true'
}

const seedDemoData = async () => {
  const store = getStore()
  const reservations = store.collection('reservations')
  const ledger = store.collection('ledger')

  const reservationCount = await reservations.countDocuments()
  if (reservationCount === 0) {
    const sampleReservations = [
      {
        id: 'RES-2041',
        patientName: 'Alex Jordan',
        symptoms: 'Shortness of breath after climbing stairs for two weeks.',
        department: 'Cardiology',
        priority: 'Routine',
        confidence: 0.78,
        requestedTime: '2:30 PM',
        createdAt: new Date().toISOString(),
        status: 'Booked',
        summary: 'Decision Tree summary: Shortness of breath on exertion. Recommend Cardiology.',
      },
      {
        id: 'RES-2038',
        patientName: 'Maya Patel',
        symptoms: 'Recurring rash with mild itching on arms.',
        department: 'Dermatology',
        priority: 'Low',
        confidence: 0.74,
        requestedTime: '4:10 PM',
        createdAt: new Date().toISOString(),
        status: 'Recorded',
        summary: 'Decision Tree summary: Persistent rash with mild itching. Recommend Dermatology.',
      },
    ]
    await reservations.insertMany(sampleReservations)
  }

  const ledgerCount = await ledger.countDocuments()
  if (ledgerCount === 0) {
    const ledgerPayload = {
      reservationId: 'RES-2038',
      patientName: 'Maya Patel',
      department: 'Dermatology',
      summary: 'Decision Tree summary: Persistent rash with mild itching. Recommend Dermatology.',
      priority: 'Low',
      confidence: 0.74,
      requestedTime: '4:10 PM',
      symptoms: 'Recurring rash with mild itching on arms.',
      status: 'Recorded',
      createdAt: new Date().toISOString(),
    }
    await ledger.insertOne({
      id: `LEDGER-${Date.now()}`,
      reservationId: 'RES-2038',
      patientName: 'Maya Patel',
      department: 'Dermatology',
      timestamp: new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      createdAt: new Date().toISOString(),
      hash: buildHash(ledgerPayload),
      txStatus: 'confirmed',
      chainId: '31337',
      txHash: '0xdemo',
    })
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/triage/summary', requireAuth, summaryLimiter, async (req, res) => {
  const { symptoms } = req.body || {}
  if (!symptoms || typeof symptoms !== 'string') {
    return res.status(400).json({ error: 'Please describe your symptoms so we can help.' })
  }
  const cleanedSymptoms = symptoms.trim()
  if (cleanedSymptoms.length > MAX_SYMPTOM_LENGTH) {
    return res.status(400).json({ error: 'Symptoms description is too long.' })
  }
  if (!isValidSymptoms(cleanedSymptoms)) {
    return res.status(400).json({ error: 'Please enter clear symptoms so we can recommend a department.' })
  }

  const start = Date.now()
  const cachedSummary = getCachedSignedSummary(cleanedSymptoms)
  if (cachedSummary) {
    await safeAudit({
      type: 'triage_summary_generated',
      source: cachedSummary.source || 'cache',
      cached: true,
      success: true,
      ...buildAuditContext(req),
    })
    return res.json({ summary: cachedSummary, elapsedMs: Date.now() - start, cached: true })
  }

  try {
    const summary = await generateTriageSummary(cleanedSymptoms)
    const signedSummary = signTriageSummary({ symptoms: cleanedSymptoms, summary })
    setCachedSignedSummary(cleanedSymptoms, signedSummary)
    const elapsedMs = Date.now() - start
    await safeAudit({
      type: 'triage_summary_generated',
      source: signedSummary.source || 'unknown',
      cached: false,
      success: true,
      ...buildAuditContext(req),
    })
    return res.json({ summary: signedSummary, elapsedMs, cached: false })
  } catch (error) {
    console.error('AI summary generation failed, using fallback.', error)
    const summary = getFallbackSummary(cleanedSymptoms)
    const signedSummary = signTriageSummary({ symptoms: cleanedSymptoms, summary })
    setCachedSignedSummary(cleanedSymptoms, signedSummary)
    const elapsedMs = Date.now() - start
    await safeAudit({
      type: 'triage_summary_generated',
      source: 'fallback',
      cached: false,
      success: true,
      ...buildAuditContext(req),
    })
    return res.json({ summary: signedSummary, elapsedMs, cached: false })
  }
})

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' })
  }
  const normalizedUsername = String(username).trim().toLowerCase()
  if (!isValidComEmail(normalizedUsername)) {
    return res.status(400).json({ error: 'Use a valid .com email address to sign in.' })
  }
  try {
    const ctx = buildRequestContext(req)
    const session = await login(normalizedUsername, password, ctx)
    return res.json(session)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid credentials'
    const status = message.toLowerCase().includes('locked') ? 423 : 401
    return res.status(status).json({ error: message })
  }
})

app.post('/api/auth/otp/request', authLimiter, async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' })
  }
  const normalizedUsername = String(username).trim().toLowerCase()
  if (!isValidComEmail(normalizedUsername)) {
    return res.status(400).json({ error: 'Use a valid .com email address to sign in.' })
  }
  try {
    const ctx = buildRequestContext(req)
    const challenge = await requestLoginOtp(normalizedUsername, String(password), ctx)
    return res.status(200).json(challenge)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OTP request failed'
    const status = message.toLowerCase().includes('locked') ? 423 : 401
    return res.status(status).json({ error: message })
  }
})

app.post('/api/auth/otp/verify', authLimiter, async (req, res) => {
  const { challengeId, code } = req.body || {}
  if (!challengeId || !code) {
    return res.status(400).json({ error: 'Missing challengeId or code' })
  }
  try {
    const ctx = buildRequestContext(req)
    const session = await verifyLoginOtp(
      { challengeId: String(challengeId), code: String(code) },
      ctx
    )
    return res.json(session)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OTP verification failed'
    const lower = message.toLowerCase()
    const status = lower.includes('invalid otp') || lower.includes('invalid otp input') ? 401 : 400
    return res.status(status).json({ error: message })
  }
})

app.post('/api/auth/signup', authLimiter, accessRequestLimiter, async (req, res) => {
  const { username, password, role, fullName, email, organization } = req.body || {}
  const roleRequested =
    typeof role === 'string' && role.trim() ? role.trim().toLowerCase() : 'user'
  const ctx = buildAuditContext(req)
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : ''
  const loginEmail = normalizedUsername || normalizedEmail
  try {
    if (!isValidComEmail(loginEmail)) {
      return res.status(400).json({ error: 'Use a valid .com email address to sign up.' })
    }

    if (roleRequested !== 'user') {
      await createAccessRequest(
        {
          fullName,
          email: normalizedEmail || loginEmail,
          organization,
          roleRequested,
          notes: 'Requested via signup.',
        },
        ctx
      )
    }

    const result = await registerUser({
      username: loginEmail,
      password,
      role: 'user',
      fullName,
      email: normalizedEmail || loginEmail,
      organization,
      meta: ctx,
    })

    return res.status(201).json({
      ...result,
      requestedRole: roleRequested !== 'user' ? roleRequested : undefined,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Signup failed'
    const status = message.includes('exists') ? 409 : 400
    await safeAudit({
      type: 'signup_failed',
      reason: message,
      success: false,
      ...ctx,
    })
    return res.status(status).json({ error: message })
  }
})

app.get('/api/auth/session', requireAuth, (req, res) => {
  res.json({ username: req.user.username, role: req.user.role })
})

app.post('/api/access-requests', accessRequestLimiter, async (req, res) => {
  const { fullName, email, organization, roleRequested, notes } = req.body || {}
  const ctx = buildAuditContext(req)
  try {
    const request = await createAccessRequest(
      { fullName, email, organization, roleRequested, notes },
      ctx
    )
    return res.status(201).json({ request })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid access request'
    return res.status(400).json({ error: message })
  }
})

app.get(
  '/api/access-requests',
  requireAuth,
  requireRole(['admin', 'system_admin']),
  async (req, res) => {
    const store = getStore()
    const requests = await store
      .collection('access_requests')
      .find()
      .sort({ createdAt: -1 })
      .toArray()
    await safeAudit({
      type: 'access_requests_viewed',
      count: requests.length,
      success: true,
      ...buildAuditContext(req),
    })
    res.json({ requests })
  }
)

app.post(
  '/api/audit/ai-alert-action',
  requireAuth,
  requireRole(['nurse', 'admin', 'system_admin']),
  aiAlertActionLimiter,
  async (req, res) => {
    const { alertId, action, context } = req.body || {}
    const cleanedAlertId = trimAndLimit(String(alertId || ''), 64)
    const cleanedAction = trimAndLimit(String(action || '').toLowerCase(), 32)
    const cleanedContext = trimAndLimit(String(context || ''), 120)
    const allowedActions = new Set([
      'view',
      'dismiss',
      'approve',
      'open',
      'identity_reveal',
      'identity_hide',
    ])

    if (!cleanedAlertId || !allowedActions.has(cleanedAction)) {
      return res.status(400).json({ error: 'Invalid alert audit payload' })
    }

    await safeAudit({
      type: 'ai_alert_action',
      alertId: cleanedAlertId,
      action: cleanedAction,
      context: cleanedContext || undefined,
      success: true,
      ...buildAuditContext(req),
    })

    return res.status(201).json({ ok: true })
  }
)

app.get(
  '/api/reservations',
  requireAuth,
  requireRole(['nurse', 'admin', 'system_admin']),
  async (req, res) => {
    const store = getStore()
    const reservations = await store
      .collection('reservations')
      .find()
      .sort({ createdAt: -1 })
      .toArray()
    await safeAudit({
      type: 'reservations_viewed',
      count: reservations.length,
      success: true,
      ...buildAuditContext(req),
    })
    res.json({ reservations })
  }
)

app.get('/api/appointments', requireAuth, async (req, res) => {
  const store = getStore()
  const role = req.user?.role
  const username = req.user?.username
  const filter = role === 'user' ? { createdBy: username } : {}
  const appointments = await store
    .collection('reservations')
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray()

  await safeAudit({
    type: 'appointments_viewed',
    count: appointments.length,
    success: true,
    ...buildAuditContext(req),
  })

  return res.json({ appointments })
})

app.patch(
  '/api/appointments/:id',
  requireAuth,
  requireRole(['nurse', 'admin', 'system_admin']),
  async (req, res) => {
    const appointmentId = trimAndLimit(req.params?.id, 32)
    if (!appointmentId) {
      return res.status(400).json({ error: 'Missing appointment id' })
    }

    const updates = {}
    const { status, requestedTime, department, priority, summary } = req.body || {}

    if (typeof status === 'string' && status.trim()) {
      const cleanedStatus = status.trim()
      if (!['Booked', 'Recorded', 'Failed'].includes(cleanedStatus)) {
        return res.status(400).json({ error: 'Invalid appointment status' })
      }
      updates.status = cleanedStatus
    }

    if (typeof requestedTime === 'string' && requestedTime.trim()) {
      updates.requestedTime = trimAndLimit(requestedTime, MAX_REQUESTED_TIME_LENGTH)
    }

    if (typeof department === 'string' && department.trim()) {
      const normalizedDepartment = normalizeDepartment(department, null)
      if (!normalizedDepartment) {
        return res.status(400).json({ error: 'Invalid department' })
      }
      updates.department = normalizedDepartment
    }

    if (typeof priority === 'string' && priority.trim()) {
      const cleanedPriority = priority.trim()
      if (!['Low', 'Routine', 'High'].includes(cleanedPriority)) {
        return res.status(400).json({ error: 'Invalid priority value' })
      }
      updates.priority = cleanedPriority
    }

    if (typeof summary === 'string' && summary.trim()) {
      updates.summary = trimAndLimit(summary, MAX_SUMMARY_LENGTH)
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' })
    }

    updates.updatedAt = new Date().toISOString()

    const store = getStore()
    const collection = store.collection('reservations')
    const existing = await collection.findOne({ id: appointmentId })
    if (!existing) {
      return res.status(404).json({ error: 'Appointment not found' })
    }

    await collection.updateOne({ id: appointmentId }, { $set: updates })
    const appointment = await collection.findOne({ id: appointmentId })

    await safeAudit({
      type: 'appointment_updated',
      appointmentId,
      fields: Object.keys(updates),
      success: true,
      ...buildAuditContext(req),
    })

    return res.json({ appointment })
  }
)

app.post('/api/reservations', maybeRequireAuth, bookingLimiter, async (req, res) => {
  const { patientName, symptoms, requestedTime, summary } = req.body || {}
  if (
    !patientName ||
    !symptoms ||
    !summary ||
    typeof summary !== 'object' ||
    Array.isArray(summary)
  ) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  const cleanedPatientName = trimAndLimit(patientName, MAX_NAME_LENGTH)
  if (!cleanedPatientName) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  const cleanedSymptoms = typeof symptoms === 'string' ? symptoms.trim() : ''
  if (cleanedSymptoms.length > MAX_SYMPTOM_LENGTH) {
    return res.status(400).json({ error: 'Symptoms description is too long.' })
  }
  if (!isValidSymptoms(cleanedSymptoms)) {
    return res.status(400).json({ error: 'Please enter clear symptoms so we can recommend a department.' })
  }

  let summaryText =
    typeof summary.summary === 'string' && summary.summary.trim() ? summary.summary.trim() : null
  if (summaryText && summaryText.length > MAX_SUMMARY_LENGTH) {
    return res.status(400).json({ error: 'Summary is too long.' })
  }
  const summarySymptoms =
    typeof summary.symptoms === 'string' && summary.symptoms.trim()
      ? summary.symptoms.trim()
      : cleanedSymptoms
  let normalizedSummarySymptoms = trimAndLimit(summarySymptoms, MAX_SYMPTOM_LENGTH)
  let summaryPriority =
    typeof summary.priority === 'string' && summary.priority.trim() ? summary.priority.trim() : null
  let summaryConfidence = typeof summary.confidence === 'number' ? summary.confidence : null
  let normalizedDepartment = normalizeDepartment(summary.department, null)
  const summaryProof =
    summary?.proof && typeof summary.proof === 'object' && !Array.isArray(summary.proof)
      ? summary.proof
      : null

  if (!['Low', 'Routine', 'High'].includes(summaryPriority || '')) {
    return res.status(400).json({ error: 'Missing or invalid triage summary' })
  }
  if (
    summaryConfidence === null ||
    !Number.isFinite(summaryConfidence) ||
    summaryConfidence < 0 ||
    summaryConfidence > 1
  ) {
    return res.status(400).json({ error: 'Missing or invalid triage summary' })
  }
  if (!summaryText || normalizedDepartment === null) {
    return res.status(400).json({ error: 'Missing or invalid triage summary' })
  }

  const signatureVerified = verifyTriageSummaryProof({
    symptoms: cleanedSymptoms,
    summary: {
      department: normalizedDepartment,
      priority: summaryPriority,
      confidence: summaryConfidence,
      summary: summaryText,
      symptoms: normalizedSummarySymptoms,
      source: summary.source,
      proof: summaryProof,
    },
  })

  if (!signatureVerified) {
    const recomputed = getFallbackSummary(cleanedSymptoms)
    summaryText = trimAndLimit(recomputed.summary, MAX_SUMMARY_LENGTH)
    normalizedSummarySymptoms = trimAndLimit(recomputed.symptoms || cleanedSymptoms, MAX_SYMPTOM_LENGTH)
    summaryPriority = recomputed.priority
    summaryConfidence = recomputed.confidence
    normalizedDepartment = normalizeDepartment(recomputed.department, 'General Medicine')

    await safeAudit({
      type: 'triage_summary_recomputed',
      reason: summaryProof ? 'invalid_signature' : 'missing_signature',
      success: true,
      ...buildAuditContext(req),
    })
  } else {
    await safeAudit({
      type: 'triage_summary_verified',
      success: true,
      ...buildAuditContext(req),
    })
  }

  const store = getStore()
  const reservationId = generateReservationId()
  const createdAt = new Date().toISOString()
  const cleanedRequestedTime = trimAndLimit(requestedTime, MAX_REQUESTED_TIME_LENGTH)

  const payload = {
    reservationId,
    patientName: cleanedPatientName,
    department: normalizedDepartment,
    priority: summaryPriority,
    confidence: summaryConfidence,
    requestedTime: cleanedRequestedTime || 'TBD',
    summary: summaryText,
    symptoms: normalizedSummarySymptoms,
    createdAt,
  }

  const payloadHash = buildHash(payload)
  let chainMeta = { txHash: null, txStatus: 'skipped', chainId: null }
  try {
    chainMeta = await recordAppointmentOnChain({
      reservationId,
      payloadHash,
    })
  } catch (error) {
    console.error('Blockchain write failed', error)
    chainMeta = { txHash: null, txStatus: 'failed', chainId: null }
  }

  if (CHAIN_STRICT && chainMeta.txStatus !== 'confirmed') {
    return res
      .status(502)
      .json({ error: 'Blockchain write required but failed. Please try again later.' })
  }

  const status =
    chainMeta.txStatus === 'confirmed'
      ? 'Recorded'
      : chainMeta.txStatus === 'failed'
        ? 'Failed'
        : 'Booked'

  const reservation = {
    id: reservationId,
    patientName: cleanedPatientName,
    createdBy: req.user?.username || 'guest',
    symptoms: normalizedSummarySymptoms,
    department: normalizedDepartment,
    priority: summaryPriority,
    confidence: summaryConfidence,
    requestedTime: cleanedRequestedTime || 'TBD',
    createdAt,
    status,
    summary: summaryText,
  }

  await store.collection('reservations').insertOne(reservation)

  const ledgerEntry = {
    id: `LEDGER-${Date.now()}`,
    reservationId,
    patientName: cleanedPatientName,
    department: normalizedDepartment,
    timestamp: new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    createdAt,
    hash: payloadHash,
    txHash: chainMeta.txHash,
    txStatus: chainMeta.txStatus,
    chainId: chainMeta.chainId,
  }

  await store.collection('ledger').insertOne(ledgerEntry)
  await safeAudit({
    type: 'reservation_created',
    reservationId,
    status,
    department: normalizedDepartment,
    triageIntegrity: signatureVerified ? 'verified' : 'recomputed',
    success: true,
    ...buildAuditContext(req),
  })
  res.status(201).json({
    reservation,
    ledgerEntry,
    triageIntegrity: signatureVerified ? 'verified' : 'recomputed',
  })
})

app.get(
  '/api/ledger',
  requireAuth,
  requireRole(['admin', 'system_admin']),
  async (req, res) => {
    const store = getStore()
    const ledger = await store.collection('ledger').find().sort({ createdAt: -1 }).toArray()
    await safeAudit({
      type: 'ledger_viewed',
      count: ledger.length,
      success: true,
      ...buildAuditContext(req),
    })
    res.json({ ledger })
  }
)

app.use((err, _req, res, _next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS blocked' })
  }
  console.error('Unhandled error', err)
  return res.status(500).json({ error: 'Internal server error' })
})

const start = async () => {
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.TRIAGE_SIGNATURE_SECRET || process.env.TRIAGE_SIGNATURE_SECRET.length < 32)
  ) {
    throw new Error('TRIAGE_SIGNATURE_SECRET must be at least 32 characters in production.')
  }
  validateAuthConfig()
  await initStore()
  if (shouldSeedUsers()) {
    await seedUsers()
  }
  if (shouldSeedDemo()) {
    await seedDemoData()
  }
  app.listen(PORT, () => {
    console.log(`API server running at http://localhost:${PORT}`)
  })
}

export { app, start }

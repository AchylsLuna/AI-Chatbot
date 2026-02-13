import 'dotenv/config'
import cors from 'cors'
import crypto from 'node:crypto'
import express from 'express'
import { recordAuditEvent } from './audit.js'
import { connectDb, getDb } from './db.js'
import { login, registerUser, requireAuth, requireRole, seedUsers, validateAuthConfig } from './auth.js'
import { recordAppointmentOnChain } from './blockchain.js'
import { assignRequestId, buildRequestContext, createRateLimiter, securityHeaders } from './security.js'
import {
  generateTriageSummary,
  getFallbackSummary,
  isValidSymptoms,
  normalizeDepartment,
} from './triage.js'

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

const authLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20, name: 'auth' })
const summaryLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 30, name: 'triage' })
const bookingLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 40, name: 'booking' })
const accessRequestLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 10,
  name: 'access-request',
})

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

  const db = getDb()
  await db.collection('access_requests').insertOne(request)

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
  if (!REQUIRE_AUTH_FOR_BOOKING) return next()
  return requireAuth(req, res, next)
}

const shouldSeedUsers = () => {
  return String(process.env.SEED_USERS || 'true').toLowerCase() === 'true'
}

const shouldSeedDemo = () => {
  return String(process.env.SEED_DEMO || 'true').toLowerCase() === 'true'
}

const seedDemoData = async () => {
  const db = getDb()
  const reservations = db.collection('reservations')
  const ledger = db.collection('ledger')

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
  try {
    const summary = await generateTriageSummary(cleanedSymptoms)
    const elapsedMs = Date.now() - start
    return res.json({ summary, elapsedMs })
  } catch (error) {
    console.error('AI summary generation failed, using fallback.', error)
    const summary = getFallbackSummary(cleanedSymptoms)
    const elapsedMs = Date.now() - start
    return res.json({ summary, elapsedMs })
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
    const db = getDb()
    const requests = await db
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

app.get(
  '/api/reservations',
  requireAuth,
  requireRole(['nurse', 'admin', 'system_admin']),
  async (req, res) => {
    const db = getDb()
    const reservations = await db
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

  const summaryText =
    typeof summary.summary === 'string' && summary.summary.trim() ? summary.summary.trim() : null
  if (summaryText && summaryText.length > MAX_SUMMARY_LENGTH) {
    return res.status(400).json({ error: 'Summary is too long.' })
  }
  const summarySymptoms =
    typeof summary.symptoms === 'string' && summary.symptoms.trim()
      ? summary.symptoms.trim()
      : cleanedSymptoms
  const normalizedSummarySymptoms = trimAndLimit(summarySymptoms, MAX_SYMPTOM_LENGTH)
  const summaryPriority =
    typeof summary.priority === 'string' && summary.priority.trim() ? summary.priority.trim() : null
  const summaryConfidence = typeof summary.confidence === 'number' ? summary.confidence : null
  const normalizedDepartment = normalizeDepartment(summary.department, null)

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

  const db = getDb()
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
    symptoms: normalizedSummarySymptoms,
    department: normalizedDepartment,
    priority: summaryPriority,
    confidence: summaryConfidence,
    requestedTime: cleanedRequestedTime || 'TBD',
    createdAt,
    status,
    summary: summaryText,
  }

  await db.collection('reservations').insertOne(reservation)

  const ledgerEntry = {
    id: `LEDGER-${Date.now()}`,
    reservationId,
    patientName,
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

  await db.collection('ledger').insertOne(ledgerEntry)
  await safeAudit({
    type: 'reservation_created',
    reservationId,
    status,
    department: normalizedDepartment,
    success: true,
    ...buildAuditContext(req),
  })
  res.status(201).json({ reservation, ledgerEntry })
})

app.get(
  '/api/ledger',
  requireAuth,
  requireRole(['nurse', 'admin', 'system_admin']),
  async (req, res) => {
    const db = getDb()
    const ledger = await db.collection('ledger').find().sort({ createdAt: -1 }).toArray()
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
  validateAuthConfig()
  await connectDb()
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

start().catch((error) => {
  console.error('Failed to start server', error)
  process.exit(1)
})

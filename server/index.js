import 'dotenv/config'
import cors from 'cors'
import crypto from 'node:crypto'
import express from 'express'
import { connectDb, getDb } from './db.js'
import { login, registerUser, requireAuth, requireRole, seedUsers } from './auth.js'
import { recordAppointmentOnChain } from './blockchain.js'
import {
  generateTriageSummary,
  getFallbackSummary,
  isValidSymptoms,
  normalizeDepartment,
} from './triage.js'

const PORT = process.env.PORT ? Number(process.env.PORT) : 5174
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

const app = express()

app.set('trust proxy', 1)

app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json({ limit: '1mb' }))

const generateReservationId = () => `RES-${Math.floor(1000 + Math.random() * 9000)}`

const buildHash = (payload) => {
  return `0x${crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`
}

const CHAIN_STRICT = String(process.env.CHAIN_STRICT || 'false').toLowerCase() === 'true'

const createRateLimiter = ({ windowMs, max }) => {
  const hits = new Map()
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`
    const now = Date.now()
    const record = hits.get(key)
    if (!record || now > record.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }
    if (record.count >= max) {
      return res.status(429).json({ error: 'Too many requests. Try again later.' })
    }
    record.count += 1
    hits.set(key, record)
    return next()
  }
}

const authLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20 })

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

app.post('/api/triage/summary', requireAuth, async (req, res) => {
  const { symptoms } = req.body || {}
  if (!symptoms || typeof symptoms !== 'string') {
    return res.status(400).json({ error: 'Please describe your symptoms so we can help.' })
  }
  const cleanedSymptoms = symptoms.trim()
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
  try {
    const session = await login(username, password, {
      ip: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown',
    })
    return res.json(session)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid credentials'
    const status = message.toLowerCase().includes('locked') ? 423 : 401
    return res.status(status).json({ error: message })
  }
})

app.post('/api/auth/signup', authLimiter, async (req, res) => {
  const { username, password, role, fullName, email, organization } = req.body || {}
  try {
    const result = await registerUser({
      username,
      password,
      role,
      fullName,
      email,
      organization,
    })
    return res.status(201).json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Signup failed'
    const status = message.includes('exists') ? 409 : 400
    return res.status(status).json({ error: message })
  }
})


app.post('/api/auth/signup', async (req, res) => {
  const { username, password, role, fullName, email, organization } = req.body || {}
  try {
    const session = await registerUser({
      username,
      password,
      role,
      fullName,
      email,
      organization,
    })
    return res.status(201).json(session)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Signup failed'
    const status = message.includes('exists') ? 409 : 400
    return res.status(status).json({ error: message })
  }
})

app.get('/api/auth/session', requireAuth, (req, res) => {
  res.json({ username: req.user.username, role: req.user.role })
})

app.post('/api/access-requests', async (req, res) => {
  const { fullName, email, organization, roleRequested, notes } = req.body || {}
  if (!fullName || !email || !roleRequested) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  const allowedRoles = ['user', 'nurse', 'admin', 'system_admin']
  if (!allowedRoles.includes(roleRequested)) {
    return res.status(400).json({ error: 'Invalid role requested' })
  }

  const cleanedName = String(fullName).trim()
  const cleanedEmail = String(email).trim().toLowerCase()
  if (!cleanedName || !cleanedEmail) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const request = {
    id: `REQ-${Date.now()}`,
    fullName: cleanedName,
    email: cleanedEmail,
    organization: typeof organization === 'string' ? organization.trim() : '',
    roleRequested,
    notes: typeof notes === 'string' ? notes.trim() : '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  const db = getDb()
  await db.collection('access_requests').insertOne(request)
  res.status(201).json({ request })
})

app.get(
  '/api/access-requests',
  requireAuth,
  requireRole(['admin', 'system_admin']),
  async (_req, res) => {
    const db = getDb()
    const requests = await db
      .collection('access_requests')
      .find()
      .sort({ createdAt: -1 })
      .toArray()
    res.json({ requests })
  }
)

app.get(
  '/api/reservations',
  requireAuth,
  requireRole(['nurse', 'admin', 'system_admin']),
  async (_req, res) => {
  const db = getDb()
  const reservations = await db.collection('reservations').find().sort({ createdAt: -1 }).toArray()
  res.json({ reservations })
  }
)

app.post('/api/reservations', async (req, res) => {
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
  const cleanedSymptoms = typeof symptoms === 'string' ? symptoms.trim() : ''
  if (!isValidSymptoms(cleanedSymptoms)) {
    return res.status(400).json({ error: 'Please enter clear symptoms so we can recommend a department.' })
  }

  const summaryText =
    typeof summary.summary === 'string' && summary.summary.trim() ? summary.summary.trim() : null
  const summarySymptoms =
    typeof summary.symptoms === 'string' && summary.symptoms.trim()
      ? summary.symptoms.trim()
      : cleanedSymptoms
  const summaryPriority =
    typeof summary.priority === 'string' && summary.priority.trim() ? summary.priority.trim() : null
  const summaryConfidence = typeof summary.confidence === 'number' ? summary.confidence : null
  const normalizedDepartment = normalizeDepartment(summary.department, null)

  if (!['Low', 'Routine', 'High'].includes(summaryPriority || '')) {
    return res.status(400).json({ error: 'Missing or invalid triage summary' })
  }
  if (summaryConfidence === null || summaryConfidence < 0 || summaryConfidence > 1) {
    return res.status(400).json({ error: 'Missing or invalid triage summary' })
  }
  if (!summaryText || normalizedDepartment === null) {
    return res.status(400).json({ error: 'Missing or invalid triage summary' })
  }

  const db = getDb()
  const reservationId = generateReservationId()
  const createdAt = new Date().toISOString()

  const payload = {
    reservationId,
    patientName,
    department: normalizedDepartment,
    priority: summaryPriority,
    confidence: summaryConfidence,
    requestedTime: requestedTime || 'TBD',
    summary: summaryText,
    symptoms: summarySymptoms,
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
    patientName,
    symptoms: summarySymptoms,
    department: normalizedDepartment,
    priority: summaryPriority,
    confidence: summaryConfidence,
    requestedTime: requestedTime || 'TBD',
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
  res.status(201).json({ reservation, ledgerEntry })
})

app.get(
  '/api/ledger',
  requireAuth,
  requireRole(['nurse', 'admin', 'system_admin']),
  async (_req, res) => {
  const db = getDb()
  const ledger = await db.collection('ledger').find().sort({ createdAt: -1 }).toArray()
  res.json({ ledger })
  }
)

const start = async () => {
  await connectDb()
  await seedUsers()
  await seedDemoData()
  app.listen(PORT, () => {
    console.log(`API server running at http://localhost:${PORT}`)
  })
}

start().catch((error) => {
  console.error('Failed to start server', error)
  process.exit(1)
})

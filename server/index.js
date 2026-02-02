import 'dotenv/config'
import cors from 'cors'
import crypto from 'node:crypto'
import express from 'express'
import { connectDb, getDb } from './db.js'
import { login, requireAuth, requireRole, seedUsers } from './auth.js'
import { recordAppointmentOnChain } from './blockchain.js'
import { generateTriageSummary, getFallbackSummary } from './triage.js'

const PORT = process.env.PORT ? Number(process.env.PORT) : 5174
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

const app = express()

app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json({ limit: '1mb' }))

const generateReservationId = () => `RES-${Math.floor(1000 + Math.random() * 9000)}`

const buildHash = (payload) => {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
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
        status: 'Pending',
        summary: 'AI summary: Shortness of breath on exertion. Recommend Cardiology.',
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
        status: 'Approved',
        summary: 'AI summary: Persistent rash with mild itching. Recommend Dermatology.',
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
      summary: 'AI summary: Persistent rash with mild itching. Recommend Dermatology.',
      status: 'Approved',
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
      txStatus: 'skipped',
      chainId: null,
      txHash: null,
    })
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/triage/summary', async (req, res) => {
  const { symptoms } = req.body || {}
  if (!symptoms || typeof symptoms !== 'string') {
    return res.status(400).json({ error: 'Missing symptoms' })
  }
  const cleanedSymptoms = symptoms.trim()
  if (!cleanedSymptoms) {
    return res.status(400).json({ error: 'Missing symptoms' })
  }

  try {
    const summary = await generateTriageSummary(cleanedSymptoms)
    return res.json({ summary })
  } catch (error) {
    console.error('AI summary generation failed, using fallback.', error)
    return res.json({ summary: getFallbackSummary(cleanedSymptoms) })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' })
  }
  const session = await login(username, password)
  if (!session) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  return res.json(session)
})

app.get('/api/auth/session', requireAuth, (req, res) => {
  res.json({ username: req.user.username, role: req.user.role })
})

app.get('/api/reservations', requireAuth, requireRole(['nurse', 'admin']), async (_req, res) => {
  const db = getDb()
  const reservations = await db.collection('reservations').find().sort({ createdAt: -1 }).toArray()
  res.json({ reservations })
})

app.post('/api/reservations', async (req, res) => {
  const { patientName, symptoms, requestedTime, department, priority, confidence, summary } = req.body || {}
  if (!patientName || !symptoms) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const db = getDb()
  const reservation = {
    id: generateReservationId(),
    patientName,
    symptoms,
    department: department || 'General Medicine',
    priority: priority || 'Routine',
    confidence: confidence ?? 0.65,
    requestedTime: requestedTime || 'TBD',
    createdAt: new Date().toISOString(),
    status: 'Pending',
    summary: summary || 'AI summary pending.',
  }

  await db.collection('reservations').insertOne(reservation)
  res.status(201).json({ reservation })
})

app.patch(
  '/api/reservations/:id',
  requireAuth,
  requireRole(['nurse', 'admin']),
  async (req, res) => {
    const { id } = req.params
    const { status } = req.body || {}

    if (!['Approved', 'Declined', 'Pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    const db = getDb()
    const reservations = db.collection('reservations')
    const reservation = await reservations.findOne({ id })

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' })
    }

    await reservations.updateOne({ id }, { $set: { status } })
    const updated = { ...reservation, status }

    let ledgerEntry = null
    if (status === 'Approved') {
      const ledger = db.collection('ledger')
      const exists = await ledger.findOne({ reservationId: id })
      if (!exists) {
        let chainMeta = { txHash: null, txStatus: 'skipped', chainId: null }
        try {
          chainMeta = await recordAppointmentOnChain({
            reservationId: id,
            patientName: reservation.patientName,
            department: reservation.department,
            diagnosisRef: reservation.summary,
          })
        } catch (error) {
          console.error('Blockchain write failed', error)
          chainMeta = { txHash: null, txStatus: 'failed', chainId: null }
        }

        const ledgerPayload = {
          reservationId: id,
          patientName: reservation.patientName,
          department: reservation.department,
          summary: reservation.summary,
          status,
          createdAt: new Date().toISOString(),
        }

        ledgerEntry = {
          id: `LEDGER-${Date.now()}`,
          reservationId: id,
          patientName: reservation.patientName,
          department: reservation.department,
          timestamp: new Date().toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          createdAt: new Date().toISOString(),
          hash: buildHash(ledgerPayload),
          txHash: chainMeta.txHash,
          txStatus: chainMeta.txStatus,
          chainId: chainMeta.chainId,
        }

        await ledger.insertOne(ledgerEntry)
      }
    }

    res.json({ reservation: updated, ledgerEntry })
  }
)

app.get('/api/ledger', requireAuth, requireRole(['nurse', 'admin']), async (_req, res) => {
  const db = getDb()
  const ledger = await db.collection('ledger').find().sort({ createdAt: -1 }).toArray()
  res.json({ ledger })
})

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

import { ReservationModel } from '../models/Reservation.js'
import { LedgerModel } from '../models/Ledger.js'
import crypto from 'node:crypto'
import { recordAppointmentOnChain } from '../utils/blockchain.js' 

const CHAIN_STRICT = String(process.env.CHAIN_STRICT || 'false').toLowerCase() === 'true'

// Helper to generate IDs
const generateReservationId = () => `RES-${Math.floor(1000 + Math.random() * 9000)}`
const buildHash = (payload) => `0x${crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`

// --- THIS WAS MISSING ---
export const seedDemoData = async () => {
  const count = await ReservationModel.findAll()
  if (count.length > 0) return

  console.log('Seeding demo reservations...')
  const demoData = [
    { patientName: 'John Doe', symptoms: 'Severe headache and nausea', department: 'Neurology' },
    { patientName: 'Jane Smith', symptoms: 'Sharp chest pain', department: 'Cardiology' },
    { patientName: 'Bob Brown', symptoms: 'Fractured wrist', department: 'Orthopedics' }
  ]

  for (const data of demoData) {
    await createReservation({
        patientName: data.patientName,
        symptoms: data.symptoms,
        requestedTime: '2026-02-15T10:00:00Z',
        summary: { 
            department: data.department, 
            priority: 'Medium', 
            confidence: 0.9, 
            summary: 'Demo Data', 
            symptoms: data.symptoms 
        },
        normalizedDept: data.department
    })
  }
  console.log('Seeding complete.')
}
// ------------------------

export const createReservation = async ({ patientName, symptoms, requestedTime, summary, normalizedDept }) => {
  const reservationId = generateReservationId()
  const createdAt = new Date().toISOString()
  
  const payload = {
    reservationId,
    patientName,
    department: normalizedDept,
    priority: summary.priority,
    confidence: summary.confidence,
    requestedTime: requestedTime || 'TBD',
    summary: summary.summary,
    symptoms: summary.symptoms || symptoms,
    createdAt,
  }

  const payloadHash = buildHash(payload)
  let chainMeta = { txHash: null, txStatus: 'skipped', chainId: null }
  
  try {
    chainMeta = await recordAppointmentOnChain({ reservationId, payloadHash })
  } catch (error) {
    console.error('Blockchain write failed', error)
    chainMeta = { txHash: null, txStatus: 'failed', chainId: null }
  }

  if (CHAIN_STRICT && chainMeta.txStatus !== 'confirmed') {
    return { blockchainError: true }
  }

  // Save to DB
  const reservation = { ...payload, id: reservationId, status: chainMeta.txStatus === 'confirmed' ? 'Recorded' : 'Booked' }
  await ReservationModel.create(reservation)

  // Ledger Entry
  const ledgerEntry = {
    id: `LEDGER-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    reservationId,
    patientName,
    department: normalizedDept,
    hash: payloadHash,
    txHash: chainMeta.txHash,
    txStatus: chainMeta.txStatus,
    createdAt
  }
  await LedgerModel.create(ledgerEntry)

  return { reservation, ledgerEntry }
}
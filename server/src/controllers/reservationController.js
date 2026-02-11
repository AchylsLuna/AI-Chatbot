import * as reservationService from '../src/services/reservationService.js'
import { normalizeDepartment } from '../src/services/triageService.js'
import { getDb } from '../src/config/db.js'

export const getReservations = async (_req, res) => {
  const db = getDb()
  const reservations = await db.collection('reservations').find().sort({ createdAt: -1 }).toArray()
  res.json({ reservations })
}

export const getLedger = async (_req, res) => {
  const db = getDb()
  const ledger = await db.collection('ledger').find().sort({ createdAt: -1 }).toArray()
  res.json({ ledger })
}

export const createReservation = async (req, res) => {
  const { patientName, symptoms, requestedTime, summary } = req.body || {}

  if (!patientName || !symptoms || !summary) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const normalizedDept = normalizeDepartment(summary.department, null)
  if (!normalizedDept) return res.status(400).json({ error: 'Invalid department' })

  try {
    const result = await reservationService.createReservation({
      patientName,
      symptoms,
      requestedTime,
      summary,
      normalizedDept
    })
    
    // Check for strict blockchain failure
    if (result.blockchainError) {
       return res.status(502).json({ error: 'Blockchain write required but failed.' })
    }

    res.status(201).json(result)
  } catch (error) {
    console.error(error)
    res.status(400).json({ error: error.message })
  }
}
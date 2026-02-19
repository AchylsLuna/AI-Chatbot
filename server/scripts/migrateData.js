import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import User from '../Models/UserModel.js'
import Appointments from '../Models/AppointmentsModel.js'

const envFilePath = fileURLToPath(new URL('../.env', import.meta.url))
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envFilePath)
  } catch {
    // no-op when .env is missing
  }
}

const MONGO = process.env.MONGO_URI || process.env.MONGO || 'mongodb://localhost:27017/ai-chatbot'
const DB_NAME = process.env.DB_NAME || 'hospital_ai_blockchain'

const statusMap = {
  Pending: 'Booked',
  Confirmed: 'Booked',
  Completed: 'Recorded',
  Cancelled: 'Failed',
  Canceled: 'Failed',
}

const normalizeStatus = (status) => {
  if (!status) return 'Booked'
  if (status === 'Booked' || status === 'Recorded' || status === 'Failed') return status
  return statusMap[status] || 'Booked'
}

const normalizePriority = (priority) => {
  if (priority === 'Low' || priority === 'Routine' || priority === 'High') return priority
  if (String(priority || '').toLowerCase() === 'low') return 'Low'
  if (String(priority || '').toLowerCase() === 'high') return 'High'
  return 'Routine'
}

const normalizeConfidence = (confidence) => {
  const parsed = Number(confidence)
  if (!Number.isFinite(parsed)) return 0.75
  if (parsed < 0) return 0
  if (parsed > 1) return 1
  return parsed
}

const buildSummary = (symptoms, department) => {
  const cleanedSymptoms = String(symptoms || '').trim() || 'No symptoms provided'
  const finalSymptoms = cleanedSymptoms.endsWith('.')
    ? cleanedSymptoms.slice(0, -1)
    : cleanedSymptoms
  return `Decision Tree summary: ${finalSymptoms}. Recommend ${department}.`
}

async function run() {
  console.log('Connecting to', MONGO, 'dbName=', DB_NAME)
  await mongoose.connect(MONGO, { dbName: DB_NAME })
  console.log('Connected to mongo db:', mongoose.connection.name)

  let usersMigrated = 0
  let appointmentsMigrated = 0

  try {
    const userResult = await User.updateMany(
      { role: 'doctor' },
      { $set: { role: 'nurse' } }
    )
    usersMigrated = userResult.modifiedCount || 0

    const appointments = await Appointments.find({})
    for (const appointment of appointments) {
      let changed = false

      const nextStatus = normalizeStatus(appointment.status)
      if (appointment.status !== nextStatus) {
        appointment.status = nextStatus
        changed = true
      }

      const nextPriority = normalizePriority(appointment.priority)
      if (appointment.priority !== nextPriority) {
        appointment.priority = nextPriority
        changed = true
      }

      const nextConfidence = normalizeConfidence(appointment.confidence)
      if (appointment.confidence !== nextConfidence) {
        appointment.confidence = nextConfidence
        changed = true
      }

      const nextDepartment = String(appointment.department || '').trim() || 'General Medicine'
      if (appointment.department !== nextDepartment) {
        appointment.department = nextDepartment
        changed = true
      }

      const nextSymptoms = String(appointment.symptoms || '').trim() || String(appointment.reason || '').trim() || 'No symptoms provided'
      if (appointment.symptoms !== nextSymptoms) {
        appointment.symptoms = nextSymptoms
        changed = true
      }

      const nextSummary = String(appointment.summary || '').trim() || buildSummary(nextSymptoms, nextDepartment)
      if (appointment.summary !== nextSummary) {
        appointment.summary = nextSummary
        changed = true
      }

      const nextReason = String(appointment.reason || '').trim() || nextSummary
      if (appointment.reason !== nextReason) {
        appointment.reason = nextReason
        changed = true
      }

      if (!appointment.createdAt) {
        appointment.createdAt = appointment._id.getTimestamp()
        changed = true
      }

      if (changed) {
        await appointment.save()
        appointmentsMigrated += 1
      }
    }

    console.log('Migration complete')
    console.log('Users migrated doctor -> nurse:', usersMigrated)
    console.log('Appointments normalized:', appointmentsMigrated)
    process.exit(0)
  } catch (error) {
    console.error('Migration failed', error)
    process.exit(1)
  }
}

run()

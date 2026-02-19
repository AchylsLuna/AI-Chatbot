import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import User from '../Models/UserModel.js'

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

const DOCTOR_EMAIL = String(process.env.DOCTOR_EMAIL || 'demo.doctor@aihealthcare.com').trim().toLowerCase()
const DOCTOR_PASSWORD = String(process.env.DOCTOR_PASSWORD || 'Doctor123!')
const DOCTOR_FIRST_NAME = String(process.env.DOCTOR_FIRST_NAME || 'Demo').trim()
const DOCTOR_LAST_NAME = String(process.env.DOCTOR_LAST_NAME || 'Doctor').trim()
const DOCTOR_DEPARTMENT = String(process.env.DOCTOR_DEPARTMENT || 'General Medicine').trim()
const DOCTOR_LICENSE_URL = String(
  process.env.DOCTOR_LICENSE_URL || '/uploads/licenses/placeholder-license.pdf'
).trim()

async function run() {
  console.log('Connecting to', MONGO, 'dbName=', DB_NAME)
  await mongoose.connect(MONGO, { dbName: DB_NAME })
  console.log('Connected to mongo db:', mongoose.connection.name)

  try {
    const existing = await User.findOne({ email: DOCTOR_EMAIL })

    if (existing) {
      const needsUpdate =
        existing.role !== 'nurse' ||
        existing.firstName !== DOCTOR_FIRST_NAME ||
        existing.lastName !== DOCTOR_LAST_NAME ||
        existing.department !== DOCTOR_DEPARTMENT ||
        existing.licenseUrl !== DOCTOR_LICENSE_URL ||
        existing.status !== 'active'

      if (needsUpdate) {
        existing.role = 'nurse'
        existing.firstName = DOCTOR_FIRST_NAME
        existing.lastName = DOCTOR_LAST_NAME
        existing.department = DOCTOR_DEPARTMENT
        existing.licenseUrl = DOCTOR_LICENSE_URL
        existing.status = 'active'
        await existing.setPassword(DOCTOR_PASSWORD)
        await existing.save()
        console.log('Updated existing doctor account (nurse role):', DOCTOR_EMAIL)
      } else {
        console.log('User already exists:', DOCTOR_EMAIL)
      }

      process.exit(0)
    }

    const user = new User({
      email: DOCTOR_EMAIL,
      firstName: DOCTOR_FIRST_NAME,
      lastName: DOCTOR_LAST_NAME,
      role: 'nurse',
      department: DOCTOR_DEPARTMENT,
      licenseUrl: DOCTOR_LICENSE_URL,
      status: 'active',
    })

    await user.setPassword(DOCTOR_PASSWORD)
    await user.save()

    console.log('Created doctor account successfully (nurse role):', DOCTOR_EMAIL)
    process.exit(0)
  } catch (error) {
    console.error('Failed to create doctor account:', error)
    process.exit(1)
  }
}

run()

import dotenv from 'dotenv'
import mongoose from 'mongoose'
import User from '../Models/UserModel.js'

dotenv.config()

const MONGO = process.env.MONGO_URI || process.env.MONGO || 'mongodb://localhost:27017/ai-chatbot'

async function run() {
  const DB_NAME = process.env.DB_NAME || 'hospital_ai_blockchain'
  console.log('Connecting to', MONGO, 'dbName=', DB_NAME)
  await mongoose.connect(MONGO, { dbName: DB_NAME })
  console.log('Connected to mongo db:', mongoose.connection.name)
  try {
    const email = String(process.env.DOCTOR_EMAIL || '').trim().toLowerCase()
    const password = String(process.env.DOCTOR_PASSWORD || '')
    const firstName = String(process.env.DOCTOR_FIRST_NAME || '').trim()
    const lastName = String(process.env.DOCTOR_LAST_NAME || '').trim()
    const department = String(process.env.DOCTOR_DEPARTMENT || 'General Medicine').trim()
    const licenseUrl = String(process.env.DOCTOR_LICENSE_URL || '/uploads/licenses/placeholder-license.pdf').trim()

    if (!email || !password || !firstName || !lastName) {
      console.error('Missing required doctor seed vars: DOCTOR_EMAIL, DOCTOR_PASSWORD, DOCTOR_FIRST_NAME, DOCTOR_LAST_NAME.')
      process.exit(1)
    }

    const existing = await User.findOne({ email })
    if (existing) {
      console.log('User already exists:', email)
      console.log('Email:', existing.email)
      console.log('Role:', existing.role)
      process.exit(0)
    }

    const user = new User({
      email,
      firstName,
      lastName,
      role: 'doctor',
      department,
      licenseUrl,
      status: 'active'
    })
    await user.setPassword(password)
    await user.save()
    console.log('✓ Created doctor account successfully!')
    console.log('Email:', email)
    console.log('First Name:', firstName)
    console.log('Last Name:', lastName)
    console.log('Role:', 'doctor')
    console.log('Department:', department)
    process.exit(0)
  } catch (err) {
    console.error('Failed to create doctor account:', err)
    process.exit(1)
  }
}

run()

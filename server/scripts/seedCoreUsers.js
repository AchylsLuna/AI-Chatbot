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

const seeds = [
  {
    key: 'admin',
    email: String(process.env.CORE_ADMIN_EMAIL || 'demo.admin@aihealthcare.com').trim().toLowerCase(),
    password: String(process.env.CORE_ADMIN_PASSWORD || 'Admin123!'),
    firstName: String(process.env.CORE_ADMIN_FIRST_NAME || 'System').trim(),
    lastName: String(process.env.CORE_ADMIN_LAST_NAME || 'Admin').trim(),
    role: process.env.CORE_ADMIN_ROLE === 'system_admin' ? 'system_admin' : 'admin',
    status: 'active',
  },
  {
    key: 'nurse',
    email: String(process.env.CORE_NURSE_EMAIL || 'demo.doctor@aihealthcare.com').trim().toLowerCase(),
    password: String(process.env.CORE_NURSE_PASSWORD || 'Doctor123!'),
    firstName: String(process.env.CORE_NURSE_FIRST_NAME || 'Demo').trim(),
    lastName: String(process.env.CORE_NURSE_LAST_NAME || 'Doctor').trim(),
    role: 'nurse',
    status: 'active',
    department: String(process.env.CORE_NURSE_DEPARTMENT || 'General Medicine').trim(),
    licenseUrl: String(
      process.env.CORE_NURSE_LICENSE_URL || '/uploads/licenses/placeholder-license.pdf'
    ).trim(),
  },
  {
    key: 'user',
    email: String(process.env.CORE_USER_EMAIL || 'demo.user@aihealthcare.com').trim().toLowerCase(),
    password: String(process.env.CORE_USER_PASSWORD || 'User123!'),
    firstName: String(process.env.CORE_USER_FIRST_NAME || 'Demo').trim(),
    lastName: String(process.env.CORE_USER_LAST_NAME || 'User').trim(),
    role: 'user',
    status: 'active',
  },
]

async function upsertUser(seed) {
  const existing = await User.findOne({ email: seed.email })

  if (existing) {
    existing.firstName = seed.firstName
    existing.lastName = seed.lastName
    existing.role = seed.role
    existing.status = seed.status

    if (seed.role === 'nurse') {
      existing.department = seed.department
      existing.licenseUrl = seed.licenseUrl
    }

    await existing.setPassword(seed.password)
    await existing.save()
    return { action: 'updated', email: seed.email, role: seed.role }
  }

  const user = new User({
    email: seed.email,
    firstName: seed.firstName,
    lastName: seed.lastName,
    role: seed.role,
    status: seed.status,
    department: seed.role === 'nurse' ? seed.department : undefined,
    licenseUrl: seed.role === 'nurse' ? seed.licenseUrl : undefined,
  })

  await user.setPassword(seed.password)
  await user.save()

  return { action: 'created', email: seed.email, role: seed.role }
}

async function run() {
  console.log('Connecting to', MONGO, 'dbName=', DB_NAME)
  await mongoose.connect(MONGO, { dbName: DB_NAME })
  console.log('Connected to mongo db:', mongoose.connection.name)

  try {
    for (const seed of seeds) {
      const result = await upsertUser(seed)
      console.log(`[${result.action}] ${result.email} (${result.role})`)
    }

    process.exit(0)
  } catch (error) {
    console.error('Failed to seed core users', error)
    process.exit(1)
  }
}

run()

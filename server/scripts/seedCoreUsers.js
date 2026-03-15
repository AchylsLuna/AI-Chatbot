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

const NODE_ENV = String(process.env.NODE_ENV || 'development').toLowerCase()
const ALLOW_DEMO_CREDENTIALS =
  String(process.env.ALLOW_DEMO_CREDENTIALS || '').toLowerCase() === 'true'
const IS_LOCAL_ENV = ['development', 'dev', 'local', 'test'].includes(NODE_ENV)

const DEFAULT_CORE_ADMIN_PASSWORD = 'Admin123!'
const DEFAULT_CORE_DOCTOR_PASSWORD = 'Doctor123!'
const DEFAULT_CORE_USER_PASSWORD = 'User123!'

const seeds = [
  {
    key: 'admin',
    email: String(process.env.CORE_ADMIN_EMAIL || 'demo.admin@aihealthcare.com').trim().toLowerCase(),
    password: String(process.env.CORE_ADMIN_PASSWORD || DEFAULT_CORE_ADMIN_PASSWORD),
    passwordEnvKey: 'CORE_ADMIN_PASSWORD',
    defaultPassword: DEFAULT_CORE_ADMIN_PASSWORD,
    firstName: String(process.env.CORE_ADMIN_FIRST_NAME || 'System').trim(),
    lastName: String(process.env.CORE_ADMIN_LAST_NAME || 'Admin').trim(),
    role: process.env.CORE_ADMIN_ROLE === 'system_admin' ? 'system_admin' : 'admin',
    status: 'active',
  },
  {
    key: 'doctor',
    email: String(process.env.CORE_DOCTOR_EMAIL || process.env.CORE_NURSE_EMAIL || 'demo.doctor@aihealthcare.com').trim().toLowerCase(),
    password: String(process.env.CORE_DOCTOR_PASSWORD || process.env.CORE_NURSE_PASSWORD || DEFAULT_CORE_DOCTOR_PASSWORD),
    passwordEnvKey: 'CORE_DOCTOR_PASSWORD',
    defaultPassword: DEFAULT_CORE_DOCTOR_PASSWORD,
    firstName: String(process.env.CORE_DOCTOR_FIRST_NAME || process.env.CORE_NURSE_FIRST_NAME || 'Demo').trim(),
    lastName: String(process.env.CORE_DOCTOR_LAST_NAME || process.env.CORE_NURSE_LAST_NAME || 'Doctor').trim(),
    role: 'doctor',
    status: 'active',
    department: String(process.env.CORE_DOCTOR_DEPARTMENT || process.env.CORE_NURSE_DEPARTMENT || 'Internal Medicine').trim(),
    licenseUrl: String(
      process.env.CORE_DOCTOR_LICENSE_URL || process.env.CORE_NURSE_LICENSE_URL || '/uploads/licenses/placeholder-license.pdf'
    ).trim(),
  },
  {
    key: 'user',
    email: String(process.env.CORE_USER_EMAIL || 'demo.user@aihealthcare.com').trim().toLowerCase(),
    password: String(process.env.CORE_USER_PASSWORD || DEFAULT_CORE_USER_PASSWORD),
    passwordEnvKey: 'CORE_USER_PASSWORD',
    defaultPassword: DEFAULT_CORE_USER_PASSWORD,
    firstName: String(process.env.CORE_USER_FIRST_NAME || 'Demo').trim(),
    lastName: String(process.env.CORE_USER_LAST_NAME || 'User').trim(),
    role: 'user',
    status: 'active',
  },
]

if (!IS_LOCAL_ENV && !ALLOW_DEMO_CREDENTIALS) {
  for (const seed of seeds) {
    if (seed.password === seed.defaultPassword) {
      throw new Error(
        `${seed.passwordEnvKey} must be set explicitly outside local environments. ` +
          'Set ALLOW_DEMO_CREDENTIALS=true only for controlled non-production testing.'
      )
    }
  }
}

async function upsertUser(seed) {
  const existing = await User.findOne({ email: seed.email })

  if (existing) {
    existing.firstName = seed.firstName
    existing.lastName = seed.lastName
    existing.role = seed.role
    existing.status = seed.status

    if (seed.role === 'doctor') {
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
    department: seed.role === 'doctor' ? seed.department : undefined,
    licenseUrl: seed.role === 'doctor' ? seed.licenseUrl : undefined,
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

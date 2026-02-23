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

const DEFAULT_ADMIN_PASSWORD = 'Admin123!'
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || 'demo.admin@aihealthcare.com').trim().toLowerCase()
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD)
const ADMIN_FIRST_NAME = String(process.env.ADMIN_FIRST_NAME || 'System').trim()
const ADMIN_LAST_NAME = String(process.env.ADMIN_LAST_NAME || 'Admin').trim()
const ADMIN_ROLE = process.env.ADMIN_ROLE === 'system_admin' ? 'system_admin' : 'admin'

if (!IS_LOCAL_ENV && !ALLOW_DEMO_CREDENTIALS && ADMIN_PASSWORD === DEFAULT_ADMIN_PASSWORD) {
  throw new Error(
    'ADMIN_PASSWORD must be set explicitly outside local environments. ' +
      'Set ALLOW_DEMO_CREDENTIALS=true only for controlled non-production testing.'
  )
}

async function run() {
  console.log('Connecting to', MONGO, 'dbName=', DB_NAME)
  await mongoose.connect(MONGO, { dbName: DB_NAME })
  console.log('Connected to mongo db:', mongoose.connection.name)

  try {
    const existing = await User.findOne({ email: ADMIN_EMAIL })
    if (existing) {
      const nextRole = ADMIN_ROLE
      const needsUpdate =
        existing.role !== nextRole ||
        existing.firstName !== ADMIN_FIRST_NAME ||
        existing.lastName !== ADMIN_LAST_NAME ||
        existing.status !== 'active'

      if (needsUpdate) {
        existing.role = nextRole
        existing.firstName = ADMIN_FIRST_NAME
        existing.lastName = ADMIN_LAST_NAME
        existing.status = 'active'
        await existing.setPassword(ADMIN_PASSWORD)
        await existing.save()
        console.log('Updated existing admin user:', ADMIN_EMAIL)
      } else {
        console.log('User already exists:', ADMIN_EMAIL)
      }

      process.exit(0)
    }

    const user = new User({
      email: ADMIN_EMAIL,
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      role: ADMIN_ROLE,
      status: 'active',
    })

    await user.setPassword(ADMIN_PASSWORD)
    await user.save()

    console.log('Created admin user:', ADMIN_EMAIL)
    console.log('Role:', ADMIN_ROLE)
    process.exit(0)
  } catch (error) {
    console.error('Failed to create admin user', error)
    process.exit(1)
  }
}

run()

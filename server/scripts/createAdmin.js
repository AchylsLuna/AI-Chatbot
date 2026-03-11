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
    const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase()
    const password = String(process.env.ADMIN_PASSWORD || '')
    const firstName = String(process.env.ADMIN_FIRST_NAME || 'System').trim() || 'System'
    const lastName = String(process.env.ADMIN_LAST_NAME || 'Admin').trim() || 'Admin'

    if (!email || !password) {
      console.error('Missing ADMIN_EMAIL or ADMIN_PASSWORD environment variables.')
      process.exit(1)
    }

    const existing = await User.findOne({ email })
    if (existing) {
      console.log('User already exists:', email)
      process.exit(0)
    }

    const user = new User({
      email,
      firstName,
      lastName,
      role: 'admin',
      status: 'active'
    })
    await user.setPassword(password)
    await user.save()
    console.log('Created admin user:', email)
    process.exit(0)
  } catch (err) {
    console.error('Failed to create admin user', err)
    process.exit(1)
  }
}

run()

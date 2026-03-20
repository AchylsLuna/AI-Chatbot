import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { seedCoreUsers } from '../Utils/coreUserSeeding.js'

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

async function run() {
  console.log('Connecting to', MONGO, 'dbName=', DB_NAME)
  await mongoose.connect(MONGO, { dbName: DB_NAME })
  console.log('Connected to mongo db:', mongoose.connection.name)

  try {
    const results = await seedCoreUsers()
    for (const result of results) {
      console.log(`[${result.action}] ${result.email} (${result.role})`)
    }

    process.exit(0)
  } catch (error) {
    console.error('Failed to seed core users', error)
    process.exit(1)
  }
}

run()

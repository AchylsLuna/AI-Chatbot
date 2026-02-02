import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'
const DB_NAME = process.env.MONGODB_DB || 'pulse-ledger'

let client
let database

export const connectDb = async () => {
  if (database) return database
  client = new MongoClient(MONGODB_URI)
  await client.connect()
  database = client.db(DB_NAME)

  await Promise.all([
    database.collection('reservations').createIndex({ id: 1 }, { unique: true }),
    database.collection('ledger').createIndex({ reservationId: 1 }, { unique: true }),
    database.collection('users').createIndex({ username: 1 }, { unique: true }),
  ])

  return database
}

export const getDb = () => {
  if (!database) {
    throw new Error('Database not initialized')
  }
  return database
}

export const closeDb = async () => {
  if (client) {
    await client.close()
  }
  client = null
  database = null
}

import { getDb } from '../config/db.js'

const collection = () => getDb().collection('ledger')

export const LedgerModel = {
  create: async (entry) => {
    return await collection().insertOne(entry)
  },

  findAll: async () => {
    return await collection().find().sort({ createdAt: -1 }).toArray()
  }
}
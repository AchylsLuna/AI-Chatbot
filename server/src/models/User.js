import { getDb } from '../config/db.js'

const collection = () => getDb().collection('users')

export const UserModel = {
  findByUsername: async (username) => {
    return await collection().findOne({ username })
  },

  create: async (userData) => {
    return await collection().insertOne(userData)
  },

  updateLoginStats: async (id, { failedLoginCount, lockUntil }) => {
    return await collection().updateOne(
      { _id: id },
      { $set: { failedLoginCount, lockUntil } }
    )
  },
  
  // Used for admin checks or strict mode
  exists: async (query) => {
    const count = await collection().countDocuments(query, { limit: 1 })
    return count > 0
  }
}
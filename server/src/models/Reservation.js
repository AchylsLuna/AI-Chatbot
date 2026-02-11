import { getDb } from '../config/db.js'

const collection = () => getDb().collection('reservations')

export const ReservationModel = {
  create: async (reservationData) => {
    return await collection().insertOne(reservationData)
  },

  findAll: async () => {
    return await collection().find().sort({ createdAt: -1 }).toArray()
  },

  findById: async (id) => {
    return await collection().findOne({ id })
  }
}
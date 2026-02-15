import crypto from 'node:crypto'
import { getDb } from '../../config/db.js'

const AUDIT_COLLECTION = 'audit_logs'
const AUDIT_HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || ''

const computeHash = (payload) => {
  const serialized = JSON.stringify(payload)
  if (AUDIT_HMAC_SECRET) {
    return crypto.createHmac('sha256', AUDIT_HMAC_SECRET).update(serialized).digest('hex')
  }
  return crypto.createHash('sha256').update(serialized).digest('hex')
}

const generateId = () => {
  return `AUDIT-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
}

export const recordAuditEvent = async (event) => {
  const db = getDb()
  const collection = db.collection(AUDIT_COLLECTION)
  const createdAt = new Date().toISOString()
  const last = await collection.find().sort({ createdAt: -1 }).limit(1).toArray()
  const prevHash = last[0]?.hash || null

  const payload = {
    id: generateId(),
    createdAt,
    prevHash,
    ...event,
  }

  const hash = computeHash(payload)
  await collection.insertOne({ ...payload, hash })
  return { id: payload.id, hash }
}

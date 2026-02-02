import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getDb } from './db.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h'

const ADMIN_USER = process.env.ADMIN_USER || 'admin'
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123'
const NURSE_USER = process.env.NURSE_USER || 'nurse'
const NURSE_PASS = process.env.NURSE_PASS || 'nurse123'

const hashPassword = async (password) => bcrypt.hash(password, 12)

export const seedUsers = async () => {
  const db = getDb()
  const users = db.collection('users')
  const existing = await users.findOne({ username: ADMIN_USER })
  if (!existing) {
    await users.insertOne({
      username: ADMIN_USER,
      role: 'admin',
      passwordHash: await hashPassword(ADMIN_PASS),
      createdAt: new Date().toISOString(),
    })
  }

  const nurseExisting = await users.findOne({ username: NURSE_USER })
  if (!nurseExisting) {
    await users.insertOne({
      username: NURSE_USER,
      role: 'nurse',
      passwordHash: await hashPassword(NURSE_PASS),
      createdAt: new Date().toISOString(),
    })
  }
}

export const login = async (username, password) => {
  const db = getDb()
  const user = await db.collection('users').findOne({ username })
  if (!user) return null
  const isValid = await bcrypt.compare(password, user.passwordHash)
  if (!isValid) return null

  const token = jwt.sign(
    { username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  )

  return { token, user: { username: user.username, role: user.role } }
}

export const requireAuth = (req, res, next) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' })
  }
  const token = header.replace('Bearer ', '')
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = payload
    return next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export const requireRole = (roles) => (req, res, next) => {
  const role = req.user?.role
  if (!role || !roles.includes(role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  return next()
}

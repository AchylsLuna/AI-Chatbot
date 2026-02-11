import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { UserModel } from '../models/User.js' 
import { getDb } from '../config/db.js' // Needed for direct DB access in seedUsers if specific model methods don't exist

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h'

// Default credentials from your original file
const DEFAULT_USERS = [
  { username: process.env.ADMIN_USER || 'admin', password: process.env.ADMIN_PASS || 'admin123', role: 'admin' },
  { username: process.env.NURSE_USER || 'nurse', password: process.env.NURSE_PASS || 'nurse123', role: 'nurse' },
  { username: process.env.SYSADMIN_USER || 'sysadmin', password: process.env.SYSADMIN_PASS || 'sysadmin123', role: 'system_admin' },
  { username: process.env.USER_USER || 'user', password: process.env.USER_PASS || 'user123', role: 'user' }
]

// --- THIS FUNCTION WAS MISSING ---
export const seedUsers = async () => {
  for (const creds of DEFAULT_USERS) {
    const existing = await UserModel.findByUsername(creds.username)
    if (!existing) {
      console.log(`Seeding user: ${creds.username}`)
      const passwordHash = await bcrypt.hash(creds.password, 12)
      await UserModel.create({
        username: creds.username,
        role: creds.role,
        passwordHash,
        fullName: `Default ${creds.role}`,
        email: `${creds.username}@example.com`,
        organization: 'Pulse Ledger',
        verified: true,
        failedLoginCount: 0,
        lockUntil: null,
        createdAt: new Date().toISOString()
      })
    }
  }
}
// ---------------------------------

export const loginUser = async (username, password, meta) => {
  const user = await UserModel.findByUsername(username)
  
  if (!user) throw new Error('Invalid username or password')
  
  if (user.lockUntil && new Date(user.lockUntil).getTime() > Date.now()) {
    throw new Error('Account locked. Try again later.')
  }

  const isValid = await bcrypt.compare(password, user.passwordHash)
  if (!isValid) {
    // Increment failure count
    const failures = (user.failedLoginCount || 0) + 1
    let lockUntil = null
    if (failures >= 5) {
      lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 min lock
    }
    await UserModel.updateLoginStats(user._id, { failedLoginCount: failures, lockUntil })
    throw new Error('Invalid username or password')
  }

  // Reset failures on success
  await UserModel.updateLoginStats(user._id, { failedLoginCount: 0, lockUntil: null })

  const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN })
  return { token, user: { username: user.username, role: user.role } }
}

export const registerUser = async ({ username, password, role, fullName, email, organization }) => {
  const existing = await UserModel.findByUsername(username)
  if (existing) throw new Error('Username already exists')

  const passwordHash = await bcrypt.hash(password, 12)
  
  await UserModel.create({
    username,
    role: role || 'user',
    passwordHash,
    fullName,
    email,
    organization,
    verified: true,
    failedLoginCount: 0,
    lockUntil: null,
    createdAt: new Date().toISOString()
  })

  // Auto-login after signup
  const token = jwt.sign({ username, role: role || 'user' }, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN })
  return { token, user: { username, role: role || 'user' } }
}

export const createAccessRequest = async (data) => {
    const db = getDb()
    const request = {
        id: `REQ-${Date.now()}`,
        ...data,
        status: 'pending',
        createdAt: new Date().toISOString()
    }
    await db.collection('access_requests').insertOne(request)
    return request
}
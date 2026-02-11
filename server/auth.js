import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getDb } from './db.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h'

const ADMIN_USER = process.env.ADMIN_USER || 'admin'
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123'
const NURSE_USER = process.env.NURSE_USER || 'nurse'
const NURSE_PASS = process.env.NURSE_PASS || 'nurse123'
const SYSADMIN_USER = process.env.SYSADMIN_USER || 'sysadmin'
const SYSADMIN_PASS = process.env.SYSADMIN_PASS || 'sysadmin123'
const USER_USER = process.env.USER_USER || 'user'
const USER_PASS = process.env.USER_PASS || 'user123'

const hashPassword = async (password) => bcrypt.hash(password, 12)
const ALLOWED_ROLES = ['user', 'nurse', 'admin', 'system_admin']
const PASSWORD_MIN = 8
const LOCKOUT_ATTEMPTS = Number(process.env.AUTH_LOCKOUT_ATTEMPTS) || 5
const LOCKOUT_MINUTES = Number(process.env.AUTH_LOCKOUT_MINUTES) || 15

const nowIso = () => new Date().toISOString()

const logAuthEvent = async (event) => {
  const db = getDb()
  await db.collection('auth_events').insertOne({
    id: `AUTH-${Date.now()}`,
    createdAt: nowIso(),
    ...event,
  })
}

const passwordMeetsPolicy = (password) => {
  if (typeof password !== 'string') return false
  if (password.length < PASSWORD_MIN) return false
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /\d/.test(password)
  return hasUpper && hasLower && hasNumber
}

export const seedUsers = async () => {
  const db = getDb()
  const users = db.collection('users')
  const seedUser = async (username, role, password) => {
    const existing = await users.findOne({ username })
    if (!existing) {
      await users.insertOne({
        username,
        role,
        passwordHash: await hashPassword(password),
        verified: true,
        failedLoginCount: 0,
        lockUntil: null,
        createdAt: new Date().toISOString(),
      })
    }
  }

  await seedUser(ADMIN_USER, 'admin', ADMIN_PASS)
  await seedUser(NURSE_USER, 'nurse', NURSE_PASS)
  await seedUser(SYSADMIN_USER, 'system_admin', SYSADMIN_PASS)
  await seedUser(USER_USER, 'user', USER_PASS)
}

export const login = async (username, password, meta = {}) => {
  const db = getDb()
  const users = db.collection('users')
  const user = await users.findOne({ username })
  if (!user) {
    await logAuthEvent({
      type: 'login_failed',
      username,
      success: false,
      reason: 'not_found',
      ...meta,
    })
    throw new Error('Invalid username or password')
  }
  if (user.lockUntil && new Date(user.lockUntil).getTime() > Date.now()) {
    await logAuthEvent({
      type: 'login_locked',
      username,
      success: false,
      reason: 'locked',
      ...meta,
    })
    throw new Error('Account locked. Try again later.')
  }

  const isValid = await bcrypt.compare(password, user.passwordHash)
  if (!isValid) {
    const nextCount = (user.failedLoginCount || 0) + 1
    const shouldLock = nextCount >= LOCKOUT_ATTEMPTS
    const lockUntil = shouldLock
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
      : null
    await users.updateOne(
      { _id: user._id },
      {
        $set: {
          failedLoginCount: nextCount,
          lockUntil,
        },
      }
    )
    await logAuthEvent({
      type: 'login_failed',
      username,
      success: false,
      reason: shouldLock ? 'locked' : 'bad_password',
      ...meta,
    })
    throw new Error('Invalid username or password')
  }

  await users.updateOne(
    { _id: user._id },
    { $set: { failedLoginCount: 0, lockUntil: null } }
  )

  const token = jwt.sign(
    { username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  )

  await logAuthEvent({
    type: 'login_success',
    username: user.username,
    role: user.role,
    success: true,
    ...meta,
  })

  return { token, user: { username: user.username, role: user.role } }
}

export const registerUser = async ({
  username,
  password,
  role,
  fullName,
  email,
  organization,
}) => {
  const cleanedUsername = typeof username === 'string' ? username.trim() : ''
  const cleanedPassword = typeof password === 'string' ? password.trim() : ''
  const cleanedRole = typeof role === 'string' ? role.trim() : ''

  if (!cleanedUsername || !cleanedPassword || !cleanedRole) {
    throw new Error('Missing required signup fields')
  }
  if (!ALLOWED_ROLES.includes(cleanedRole)) {
    throw new Error('Invalid role')
  }
  if (!passwordMeetsPolicy(cleanedPassword)) {
    throw new Error('Password must be at least 8 characters with upper, lower, and number')
  }

  const db = getDb()
  const users = db.collection('users')
  const existing = await users.findOne({ username: cleanedUsername })
  if (existing) {
    throw new Error('User already exists')
  }

  await users.insertOne({
    username: cleanedUsername,
    role: cleanedRole,
    passwordHash: await hashPassword(cleanedPassword),
    fullName: typeof fullName === 'string' ? fullName.trim() : '',
    email: typeof email === 'string' ? email.trim().toLowerCase() : '',
    organization: typeof organization === 'string' ? organization.trim() : '',
    verified: true,
    failedLoginCount: 0,
    lockUntil: null,
    createdAt: nowIso(),
  })

  await logAuthEvent({
    type: 'signup_success',
    username: cleanedUsername,
    role: cleanedRole,
    success: true,
  })

  const token = jwt.sign(
    { username: cleanedUsername, role: cleanedRole },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  )

  return { token, user: { username: cleanedUsername, role: cleanedRole } }
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

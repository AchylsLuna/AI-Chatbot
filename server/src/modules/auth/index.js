import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getDb } from '../../config/db.js'
import { recordAuditEvent } from '../audit/index.js'

const DEFAULT_JWT_SECRET = 'dev-secret-change-me'
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h'
const MIN_JWT_SECRET_LENGTH = 32

const ADMIN_USER = process.env.ADMIN_USER || 'admin@aihealthcare.com'
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123'
const NURSE_USER = process.env.NURSE_USER || 'nurse@aihealthcare.com'
const NURSE_PASS = process.env.NURSE_PASS || 'nurse123'
const SYSADMIN_USER = process.env.SYSADMIN_USER || 'sysadmin@aihealthcare.com'
const SYSADMIN_PASS = process.env.SYSADMIN_PASS || 'sysadmin123'
const USER_USER = process.env.USER_USER || 'user@aihealthcare.com'
const USER_PASS = process.env.USER_PASS || 'user123'
const ROLE_DEFAULT_EMAILS = {
  admin: 'admin@aihealthcare.com',
  nurse: 'nurse@aihealthcare.com',
  system_admin: 'sysadmin@aihealthcare.com',
  user: 'user@aihealthcare.com',
}

const hashPassword = async (password) => bcrypt.hash(password, 12)
const ALLOWED_ROLES = ['user', 'nurse', 'admin', 'system_admin']
const USERNAME_MIN = 3
const USERNAME_MAX = 64
const PASSWORD_MIN = 8
const PASSWORD_MAX = 72
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

const safeAudit = async (event) => {
  try {
    await recordAuditEvent(event)
  } catch (error) {
    console.warn('Audit log failed', error)
  }
}

const passwordMeetsPolicy = (password) => {
  if (typeof password !== 'string') return false
  if (password.length < PASSWORD_MIN) return false
  if (password.length > PASSWORD_MAX) return false
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /\d/.test(password)
  return hasUpper && hasLower && hasNumber
}

const usernameMeetsPolicy = (username) => {
  if (typeof username !== 'string') return false
  const cleaned = username.trim()
  if (cleaned.length < USERNAME_MIN || cleaned.length > USERNAME_MAX) return false
  const simpleHandle = /^[a-zA-Z0-9._-]+$/.test(cleaned)
  const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)
  return simpleHandle || emailLike
}

const isComEmail = (value) => {
  if (typeof value !== 'string') return false
  const cleaned = value.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.com$/.test(cleaned)
}

export const validateAuthConfig = () => {
  const isProd = process.env.NODE_ENV === 'production'
  if (!isProd) return
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_JWT_SECRET) {
    throw new Error('JWT_SECRET must be set to a strong value in production.')
  }
  if (process.env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.')
  }

  const seedUsersEnabled = String(process.env.SEED_USERS || 'true').toLowerCase() === 'true'
  if (seedUsersEnabled) {
    const usingDefaultSeedCredentials = [
      ADMIN_USER === ROLE_DEFAULT_EMAILS.admin || ADMIN_PASS === 'admin123',
      NURSE_USER === ROLE_DEFAULT_EMAILS.nurse || NURSE_PASS === 'nurse123',
      SYSADMIN_USER === ROLE_DEFAULT_EMAILS.system_admin || SYSADMIN_PASS === 'sysadmin123',
      USER_USER === ROLE_DEFAULT_EMAILS.user || USER_PASS === 'user123',
    ].some(Boolean)

    if (usingDefaultSeedCredentials) {
      throw new Error('Default seeded usernames/passwords must be overridden in production.')
    }
  }
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

  // Keep .com email logins available even if local env still defines legacy usernames.
  if (!isComEmail(ADMIN_USER)) {
    await seedUser(ROLE_DEFAULT_EMAILS.admin, 'admin', ADMIN_PASS)
  }
  if (!isComEmail(NURSE_USER)) {
    await seedUser(ROLE_DEFAULT_EMAILS.nurse, 'nurse', NURSE_PASS)
  }
  if (!isComEmail(SYSADMIN_USER)) {
    await seedUser(ROLE_DEFAULT_EMAILS.system_admin, 'system_admin', SYSADMIN_PASS)
  }
  if (!isComEmail(USER_USER)) {
    await seedUser(ROLE_DEFAULT_EMAILS.user, 'user', USER_PASS)
  }
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
    await safeAudit({
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
    await safeAudit({
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
    await safeAudit({
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
  await safeAudit({
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
  meta = {},
}) => {
  const cleanedUsername = typeof username === 'string' ? username.trim() : ''
  const cleanedPassword = typeof password === 'string' ? password.trim() : ''
  const cleanedRole = typeof role === 'string' ? role.trim().toLowerCase() : ''

  if (!cleanedUsername || !cleanedPassword || !cleanedRole) {
    throw new Error('Missing required signup fields')
  }
  if (!usernameMeetsPolicy(cleanedUsername)) {
    throw new Error('Username must be 3-32 characters and contain only letters, numbers, dot, dash, or underscore.')
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
    ...meta,
  })
  await safeAudit({
    type: 'signup_success',
    username: cleanedUsername,
    role: cleanedRole,
    success: true,
    ...meta,
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

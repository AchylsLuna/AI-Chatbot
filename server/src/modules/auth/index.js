import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { getStore } from '../../config/store.js'
import { recordAuditEvent } from '../audit/index.js'

const DEFAULT_JWT_SECRET = 'dev-secret-change-me'
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET
const JWT_ISSUER = process.env.JWT_ISSUER || 'ai-healthcare-api'
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'ai-healthcare-client'
const USER_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN_USER || process.env.JWT_EXPIRES_IN || '2h'
const CLINICAL_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN_CLINICAL || '45m'
const ADMIN_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN_ADMIN || '30m'
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
const OTP_COLLECTION = 'otp_challenges'
const OTP_LENGTH = 6
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES) || 5
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS) || 5
const REQUIRE_STAFF_OTP =
  String(process.env.AUTH_REQUIRE_STAFF_OTP || 'false').toLowerCase() === 'true'
const OTP_SECRET = process.env.OTP_SECRET || JWT_SECRET
const AUTH_PROVIDER = String(process.env.AUTH_PROVIDER || 'local').toLowerCase()
const AUTH0_DOMAIN = String(process.env.AUTH0_DOMAIN || '').trim().replace(/^https?:\/\//, '')
const AUTH0_AUDIENCE = String(process.env.AUTH0_AUDIENCE || '').trim()
const AUTH0_ROLE_CLAIM = process.env.AUTH0_ROLE_CLAIM || 'https://healix.app/role'
const AUTH0_ISSUER = AUTH0_DOMAIN ? `https://${AUTH0_DOMAIN.replace(/\/$/, '')}/` : ''
const AUTH0_ENABLED = AUTH_PROVIDER === 'auth0' || AUTH_PROVIDER === 'hybrid'
let auth0Jwks = null

const nowIso = () => new Date().toISOString()

const logAuthEvent = async (event) => {
  const store = getStore()
  await store.collection('auth_events').insertOne({
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

const tokenExpiryForRole = (role) => {
  if (role === 'admin' || role === 'system_admin') return ADMIN_TOKEN_EXPIRES_IN
  if (role === 'nurse') return CLINICAL_TOKEN_EXPIRES_IN
  return USER_TOKEN_EXPIRES_IN
}

const issueSessionForUser = (user, options = {}) => {
  const authMethod = typeof options.authMethod === 'string' ? options.authMethod : 'password'
  const mfa = Boolean(options.mfa)
  const sessionId = `sess-${crypto.randomBytes(10).toString('hex')}`
  const token = jwt.sign(
    {
      username: user.username,
      role: user.role,
      authMethod,
      mfa,
      sessionId,
    },
    JWT_SECRET,
    {
      expiresIn: tokenExpiryForRole(user.role),
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      subject: user.username,
      jwtid: sessionId,
    }
  )
  return {
    token,
    user: {
      username: user.username,
      role: user.role,
      authMethod,
      mfa,
      sessionId,
    },
  }
}

const generateOtpCode = () =>
  String(Math.floor(Math.random() * 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0')

const hashOtpCode = (challengeId, code) =>
  crypto
    .createHash('sha256')
    .update(`${OTP_SECRET}:${challengeId}:${code}`)
    .digest('hex')

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

const getAuth0Jwks = () => {
  if (!AUTH0_ISSUER) return null
  if (!auth0Jwks) {
    auth0Jwks = createRemoteJWKSet(new URL(`${AUTH0_ISSUER}.well-known/jwks.json`))
  }
  return auth0Jwks
}

const resolveRoleClaim = (payload) => {
  const claim = payload?.[AUTH0_ROLE_CLAIM]
  if (typeof claim === 'string' && ALLOWED_ROLES.includes(claim)) return claim
  if (Array.isArray(claim)) {
    const role = claim.find((entry) => typeof entry === 'string' && ALLOWED_ROLES.includes(entry))
    if (role) return role
  }
  return 'user'
}

const resolveAuth0Mfa = (payload) => {
  const amr = Array.isArray(payload?.amr) ? payload.amr : []
  const hasStrongFactor = amr.some((method) =>
    typeof method === 'string' ? ['mfa', 'fpt', 'face', 'otp', 'webauthn'].includes(method) : false
  )
  if (hasStrongFactor) return true
  const acr = typeof payload?.acr === 'string' ? payload.acr.toLowerCase() : ''
  return acr.includes('mfa') || acr.includes('phrh')
}

const verifyAuth0Token = async (token) => {
  if (!AUTH0_ENABLED || !AUTH0_ISSUER || !AUTH0_AUDIENCE) {
    throw new Error('Auth0 verification is not enabled.')
  }
  const jwks = getAuth0Jwks()
  if (!jwks) throw new Error('Auth0 JWKS not configured.')

  const { payload } = await jwtVerify(token, jwks, {
    issuer: AUTH0_ISSUER,
    audience: AUTH0_AUDIENCE,
  })

  const username =
    typeof payload.email === 'string' && payload.email.trim()
      ? payload.email.trim().toLowerCase()
      : typeof payload.preferred_username === 'string' && payload.preferred_username.trim()
        ? payload.preferred_username.trim().toLowerCase()
        : typeof payload.sub === 'string'
          ? payload.sub
          : ''
  const role = resolveRoleClaim(payload)
  const mfa = resolveAuth0Mfa(payload)
  const isClinicalRole = role === 'nurse' || role === 'admin' || role === 'system_admin'

  if (!username || !ALLOWED_ROLES.includes(role)) {
    throw new Error('Invalid Auth0 token claims')
  }
  if (isClinicalRole && !mfa) {
    throw new Error('Clinical Auth0 session must include MFA')
  }

  return {
    username,
    role,
    authMethod: 'auth0',
    mfa,
    sessionId:
      typeof payload.jti === 'string'
        ? payload.jti
        : typeof payload.sub === 'string'
          ? payload.sub
          : null,
  }
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

  if (AUTH0_ENABLED) {
    if (!AUTH0_DOMAIN || !AUTH0_AUDIENCE) {
      throw new Error('AUTH0_DOMAIN and AUTH0_AUDIENCE are required when AUTH_PROVIDER uses Auth0.')
    }
  }
}

export const seedUsers = async () => {
  const store = getStore()
  const users = store.collection('users')
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

const verifyCredentials = async (username, password, meta = {}) => {
  const store = getStore()
  const users = store.collection('users')
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

  return user
}

export const login = async (username, password, meta = {}) => {
  const user = await verifyCredentials(username, password, meta)
  if (REQUIRE_STAFF_OTP && user.role !== 'user') {
    await logAuthEvent({
      type: 'login_mfa_required',
      username: user.username,
      role: user.role,
      success: false,
      authMethod: 'password',
      ...meta,
    })
    await safeAudit({
      type: 'login_mfa_required',
      username: user.username,
      role: user.role,
      success: false,
      authMethod: 'password',
      ...meta,
    })
    throw new Error('MFA required for this role. Use OTP login.')
  }
  const session = issueSessionForUser(user, { authMethod: 'password', mfa: false })

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

  return session
}

export const requestLoginOtp = async (username, password, meta = {}) => {
  const user = await verifyCredentials(username, password, meta)
  const store = getStore()
  const challenges = store.collection(OTP_COLLECTION)

  const challengeId = `OTP-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`
  const code = generateOtpCode()
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)

  await challenges.deleteMany({
    username: user.username,
    consumedAt: null,
  })

  await challenges.insertOne({
    id: challengeId,
    username: user.username,
    role: user.role,
    codeHash: hashOtpCode(challengeId, code),
    attempts: 0,
    createdAt: nowIso(),
    expiresAt,
    consumedAt: null,
  })

  await logAuthEvent({
    type: 'otp_challenge_issued',
    username: user.username,
    role: user.role,
    success: true,
    ...meta,
  })
  await safeAudit({
    type: 'otp_challenge_issued',
    username: user.username,
    role: user.role,
    success: true,
    ...meta,
  })

  const payload = {
    challengeId,
    username: user.username,
    expiresAt: expiresAt.toISOString(),
    expiresInSeconds: OTP_TTL_MINUTES * 60,
  }

  if (process.env.NODE_ENV !== 'production') {
    return { ...payload, otpPreview: code }
  }

  return payload
}

export const verifyLoginOtp = async ({ challengeId, code }, meta = {}) => {
  const cleanedChallengeId = typeof challengeId === 'string' ? challengeId.trim() : ''
  const cleanedCode = typeof code === 'string' ? code.trim() : ''

  if (!cleanedChallengeId || !/^\d{6}$/.test(cleanedCode)) {
    throw new Error('Invalid OTP input')
  }

  const store = getStore()
  const challenges = store.collection(OTP_COLLECTION)
  const users = store.collection('users')
  const challenge = await challenges.findOne({ id: cleanedChallengeId })

  if (!challenge) {
    throw new Error('OTP challenge not found. Please request a new code.')
  }

  if (challenge.consumedAt) {
    throw new Error('OTP code already used. Please request a new code.')
  }

  const expiresAtMs = new Date(challenge.expiresAt).getTime()
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw new Error('OTP code expired. Please request a new code.')
  }

  if ((challenge.attempts || 0) >= OTP_MAX_ATTEMPTS) {
    throw new Error('Too many OTP attempts. Please request a new code.')
  }

  const isCodeValid = hashOtpCode(cleanedChallengeId, cleanedCode) === challenge.codeHash
  if (!isCodeValid) {
    const nextAttempts = (challenge.attempts || 0) + 1
    await challenges.updateOne(
      { id: cleanedChallengeId },
      { $set: { attempts: nextAttempts } }
    )
    await logAuthEvent({
      type: 'otp_verify_failed',
      username: challenge.username,
      success: false,
      reason: 'invalid_code',
      ...meta,
    })
    await safeAudit({
      type: 'otp_verify_failed',
      username: challenge.username,
      success: false,
      reason: 'invalid_code',
      ...meta,
    })
    if (nextAttempts >= OTP_MAX_ATTEMPTS) {
      throw new Error('Too many OTP attempts. Please request a new code.')
    }
    throw new Error('Invalid OTP code')
  }

  await challenges.updateOne(
    { id: cleanedChallengeId },
    { $set: { consumedAt: nowIso(), attempts: (challenge.attempts || 0) + 1 } }
  )

  const user = await users.findOne({ username: challenge.username })
  if (!user) {
    throw new Error('Account not found')
  }

  const session = issueSessionForUser(user, { authMethod: 'otp', mfa: true })

  await logAuthEvent({
    type: 'login_success',
    username: user.username,
    role: user.role,
    success: true,
    authMethod: 'otp',
    ...meta,
  })
  await safeAudit({
    type: 'login_success',
    username: user.username,
    role: user.role,
    success: true,
    authMethod: 'otp',
    ...meta,
  })

  return session
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

  const store = getStore()
  const users = store.collection('users')
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

  return issueSessionForUser(
    { username: cleanedUsername, role: cleanedRole },
    { authMethod: 'signup', mfa: false }
  )
}

export const requireAuth = async (req, res, next) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization token' })
  }
  const token = header.replace('Bearer ', '')
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })
    if (!payload || typeof payload !== 'object') {
      return res.status(401).json({ error: 'Invalid token payload' })
    }

    const username =
      typeof payload.username === 'string' ? payload.username : ''
    const role = typeof payload.role === 'string' ? payload.role : ''
    const authMethod =
      typeof payload.authMethod === 'string' ? payload.authMethod : 'unknown'
    const mfa = Boolean(payload.mfa)
    const isClinicalRole = role === 'nurse' || role === 'admin' || role === 'system_admin'

    if (!username || !ALLOWED_ROLES.includes(role)) {
      return res.status(401).json({ error: 'Invalid token claims' })
    }
    if (isClinicalRole && !mfa) {
      return res.status(401).json({ error: 'MFA token required for this role' })
    }

    req.user = {
      username,
      role,
      authMethod,
      mfa,
      sessionId:
        typeof payload.sessionId === 'string'
          ? payload.sessionId
          : typeof payload.jti === 'string'
            ? payload.jti
            : null,
    }
    return next()
  } catch (error) {
    if (AUTH0_ENABLED) {
      try {
        req.user = await verifyAuth0Token(token)
        return next()
      } catch {
        return res.status(401).json({ error: 'Invalid or expired token' })
      }
    }
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

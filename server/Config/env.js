import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const envFilePath = fileURLToPath(new URL('../.env', import.meta.url))
dotenv.config({ path: envFilePath, quiet: true })

const WEAK_JWT_SECRETS = new Set([
  '',
  'dev-secret',
  'change_this_secret',
  'default_secret_password',
])

const WEAK_BACKUP_PASSWORDS = new Set([
  '',
  'default_secret_password',
  'change_this_backup_password',
  'dev-secret',
])

const isTruthy = (value) => {
  if (typeof value !== 'string') return false
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

const toPort = (value, defaultPort) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultPort
}

const normalizeUrl = (value, fallback) => {
  const normalized = String(value || fallback).trim()
  return normalized || fallback
}

const isProduction = process.env.NODE_ENV === 'production'

const resolveSecret = (envKey, weakValues) => {
  const candidate = typeof process.env[envKey] === 'string' ? process.env[envKey].trim() : ''
  const isWeak = !candidate || weakValues.has(candidate)

  if (isWeak && isProduction) {
    throw new Error(`[env] ${envKey} must be set to a strong non-default value in production.`)
  }

  if (isWeak) {
    const ephemeral = crypto.randomBytes(32).toString('hex')
    console.warn(`[env] ${envKey} is missing or weak. Using an ephemeral development-only value.`)
    return ephemeral
  }

  return candidate
}

const mongoUri = String(process.env.MONGO_URI || process.env.MONGO || 'mongodb://localhost:27017').trim()
if (!mongoUri) {
  throw new Error('[env] MONGO_URI must be set.')
}

const dbName = String(process.env.DB_NAME || 'hospital_ai_blockchain').trim() || 'hospital_ai_blockchain'

export const appConfig = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction,
  port: toPort(process.env.PORT, 5001),
  mongoUri,
  dbName,
  useInMemoryMongo: isTruthy(process.env.USE_IN_MEMORY_MONGO || ''),
  clientOrigin: normalizeUrl(process.env.CLIENT_ORIGIN, 'http://localhost:5173'),
  frontendUrl: normalizeUrl(process.env.FRONTEND_URL || process.env.CLIENT_URL, 'http://localhost:5173'),
  googleClientId: String(process.env.GOOGLE_CLIENT_ID || '').trim(),
  googleClientSecret: String(process.env.GOOGLE_CLIENT_SECRET || '').trim(),
  jwtSecret: resolveSecret('JWT_SECRET', WEAK_JWT_SECRETS),
  backupPassword: resolveSecret('BACKUP_PASSWORD', WEAK_BACKUP_PASSWORDS),
  enableDebugRoutes: isTruthy(process.env.ENABLE_DEBUG_ROUTES || ''),
})

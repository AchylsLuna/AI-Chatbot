import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test, { after, before, beforeEach } from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-super-secret-value-1234567890'
process.env.BACKUP_PASSWORD = 'test-backup-password-1234567890'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.FRONTEND_URL = 'http://localhost:5173'

const uploadDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-chatbot-license-uploads-'))
process.env.LICENSE_UPLOAD_DIR = uploadDir

const { createApp } = await import('../app.js')
const { decryptBackupBuffer, parseEncryptedBackupPayload } = await import('../Utils/backupEncryption.js')
const { default: AuditLog } = await import('../Models/AuditLogModel.js')
const { default: User } = await import('../Models/UserModel.js')

let mongoServer
let server
let baseUrl = ''

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const getCookieHeader = (setCookies) =>
  setCookies.map((entry) => entry.split(';')[0]).join('; ')

const clearUploadDir = async () => {
  await fs.mkdir(uploadDir, { recursive: true })
  const entries = await fs.readdir(uploadDir)
  await Promise.all(
    entries.map((entry) => fs.rm(path.join(uploadDir, entry), { recursive: true, force: true }))
  )
}

const listUploadDir = async () => {
  await fs.mkdir(uploadDir, { recursive: true })
  return fs.readdir(uploadDir)
}

const request = async (route, { method = 'GET', headers = {}, json, body, cookieHeader } = {}) => {
  const nextHeaders = new Headers(headers)
  if (json !== undefined) {
    nextHeaders.set('Content-Type', 'application/json')
  }
  if (cookieHeader) {
    nextHeaders.set('Cookie', cookieHeader)
  }

  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: nextHeaders,
    body: json !== undefined ? JSON.stringify(json) : body,
  })
  const text = await response.text()
  const setCookies =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter(Boolean)

  return {
    status: response.status,
    text,
    json: safeJsonParse(text),
    headers: response.headers,
    setCookies,
    cookieHeader: getCookieHeader(setCookies),
  }
}

const requestBuffer = async (route, { method = 'GET', headers = {}, cookieHeader } = {}) => {
  const nextHeaders = new Headers(headers)
  if (cookieHeader) {
    nextHeaders.set('Cookie', cookieHeader)
  }

  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: nextHeaders,
  })

  return {
    status: response.status,
    headers: response.headers,
    buffer: Buffer.from(await response.arrayBuffer()),
  }
}

const createUser = async ({
  email,
  password = 'User123!',
  role = 'user',
  status = 'active',
}) => {
  const user = new User({
    email,
    firstName: 'Test',
    lastName: 'User',
    role,
    status,
    ...(role === 'doctor'
      ? {
          department: 'Internal Medicine',
          licenseUrl: path.join(uploadDir, 'seed-license.pdf'),
          licenseUrls: [path.join(uploadDir, 'seed-license.pdf')],
          staffApplicationReviewed: true,
        }
      : {}),
  })
  await user.setPassword(password)
  await user.save()
  return user
}

const loginWithOtp = async (email, password) => {
  const loginResponse = await request('/login', {
    method: 'POST',
    json: { email, password },
  })
  assert.equal(loginResponse.status, 200, loginResponse.text)
  assert.ok(loginResponse.json?.challengeId)
  assert.ok(loginResponse.json?.otpPreview)

  const verifyResponse = await request('/verify-otp', {
    method: 'POST',
    json: {
      challengeId: loginResponse.json.challengeId,
      otp: loginResponse.json.otpPreview,
    },
  })
  assert.equal(verifyResponse.status, 200, verifyResponse.text)
  return verifyResponse
}

const buildDoctorRegistrationForm = ({
  email = 'doctor@hospital.example',
  password = 'Doctor123!',
  department = 'Internal Medicine',
} = {}) => {
  const form = new FormData()
  form.set('firstName', 'Doctor')
  form.set('lastName', 'Example')
  form.set('email', email)
  form.set('password', password)
  form.set('department', department)
  form.append('licenses', new Blob(['fake-license-pdf'], { type: 'application/pdf' }), 'license.pdf')
  return form
}

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri(), {
    dbName: 'ai_chatbot_admin_backups_registration_test',
  })

  const app = createApp()
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  baseUrl = `http://127.0.0.1:${address.port}/api`
})

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
  await mongoose.disconnect()
  await mongoServer.stop()
  await fs.rm(uploadDir, { recursive: true, force: true })
})

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({})
    )
  )
  await clearUploadDir()
})

test('audit backup downloads as an authenticated AES-GCM envelope', async () => {
  const admin = await createUser({ email: 'admin.backup@example.com', role: 'admin' })
  await AuditLog.create({
    userId: admin._id,
    action: 'TEST_BACKUP_EVENT',
    details: 'Synthetic backup event',
    ipAddress: '127.0.0.1',
    userAgent: 'node-test',
  })

  const verifyResponse = await loginWithOtp('admin.backup@example.com', 'User123!')
  const response = await requestBuffer('/admin/audit-logs/download', {
    cookieHeader: verifyResponse.cookieHeader,
  })

  assert.equal(response.status, 200)
  assert.match(
    response.headers.get('content-disposition') || '',
    /audit_logs_backup\.zip\.enc/i
  )

  const payload = parseEncryptedBackupPayload(response.buffer)
  assert.equal(payload.version, 1)
  assert.equal(payload.salt.length, 16)
  assert.equal(payload.iv.length, 12)
  assert.equal(payload.authTag.length, 16)

  const decrypted = decryptBackupBuffer(response.buffer, process.env.BACKUP_PASSWORD)
  assert.equal(decrypted.subarray(0, 4).toString('binary'), 'PK\u0003\u0004')
})

test('doctor registration validation failures clean up uploaded license files', async () => {
  const response = await request('/register/doctor', {
    method: 'POST',
    body: buildDoctorRegistrationForm({ department: '' }),
  })

  assert.equal(response.status, 400, response.text)
  assert.deepEqual(await listUploadDir(), [])
})

test('doctor registration duplicate email failures clean up uploaded license files', async () => {
  await createUser({ email: 'existing@hospital.example' })

  const response = await request('/register/doctor', {
    method: 'POST',
    body: buildDoctorRegistrationForm({ email: 'existing@hospital.example' }),
  })

  assert.equal(response.status, 409, response.text)
  assert.equal(response.json?.message, 'Email is already registered.')
  assert.deepEqual(await listUploadDir(), [])
})

test('doctor registration accepts professional email domains', async () => {
  const response = await request('/register/doctor', {
    method: 'POST',
    body: buildDoctorRegistrationForm({ email: 'doctor@hospital.org' }),
  })

  assert.equal(response.status, 201, response.text)

  const doctor = await User.findOne({ email: 'doctor@hospital.org' }).lean()
  assert.ok(doctor)
  assert.equal(doctor?.role, 'doctor')
  assert.equal(doctor?.status, 'disabled')
  assert.ok(Array.isArray(doctor?.licenseUrls))
  assert.equal(doctor?.licenseUrls?.length, 1)
  assert.equal((await listUploadDir()).length, 1)
})

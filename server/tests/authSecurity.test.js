import assert from 'node:assert/strict'
import test, { after, before, beforeEach } from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-super-secret-value-1234567890'
process.env.BACKUP_PASSWORD = 'test-backup-password-1234567890'
process.env.CLIENT_ORIGIN = 'http://localhost:5173'
process.env.FRONTEND_URL = 'http://localhost:5173'
process.env.GOOGLE_CLIENT_ID = 'google-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret'

const { createApp } = await import('../app.js')
const {
  buildCsrfCookieOptions,
  buildSessionCookieOptions,
  createGoogleAuthExchange,
} = await import('../Utils/authSecurity.js')
const { default: User } = await import('../Models/UserModel.js')
const { default: Sessions } = await import('../Models/SessionModel.js')

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

const readCookieValue = (cookieHeader, name) => {
  const part = String(cookieHeader || '')
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`))
  if (!part) return null
  return decodeURIComponent(part.slice(name.length + 1))
}

const request = async (path, { method = 'GET', headers = {}, json, cookieHeader } = {}) => {
  const nextHeaders = new Headers(headers)
  if (json !== undefined) {
    nextHeaders.set('Content-Type', 'application/json')
  }
  if (cookieHeader) {
    nextHeaders.set('Cookie', cookieHeader)
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: nextHeaders,
    body: json !== undefined ? JSON.stringify(json) : undefined,
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
    setCookies,
    cookieHeader: getCookieHeader(setCookies),
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
          licenseUrl: '/tmp/license.pdf',
          licenseUrls: ['/tmp/license.pdf'],
          staffApplicationReviewed: true,
        }
      : {}),
  })
  await user.setPassword(password)
  await user.save()
  return user
}

const getSourcePageForRole = (role = 'user') => {
  if (role === 'doctor') return 'doctor_login'
  if (role === 'admin' || role === 'system_admin') return 'admin_login'
  return 'login'
}

const loginWithOtp = async (email, password, sourcePage = 'login') => {
  const loginResponse = await request('/login', {
    method: 'POST',
    json: { email, password, sourcePage },
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
  assert.ok(verifyResponse.cookieHeader)
  return verifyResponse
}

const loginDirect = async (email, password, sourcePage = 'admin_login') => {
  const loginResponse = await request('/login', {
    method: 'POST',
    json: { email, password, sourcePage },
  })
  assert.equal(loginResponse.status, 200, loginResponse.text)
  assert.equal(loginResponse.json?.requires2FA, undefined)
  assert.equal(loginResponse.json?.challengeId, undefined)
  assert.ok(loginResponse.cookieHeader)
  return loginResponse
}

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri(), {
    dbName: 'ai_chatbot_security_test',
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
})

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({})
    )
  )
})

test('cookie helpers enforce strict production cookie attributes', () => {
  const sessionOptions = buildSessionCookieOptions(1000, { isProduction: true })
  const csrfOptions = buildCsrfCookieOptions(1000, { isProduction: true })

  assert.equal(sessionOptions.httpOnly, true)
  assert.equal(sessionOptions.secure, true)
  assert.equal(sessionOptions.sameSite, 'strict')
  assert.equal(csrfOptions.httpOnly, false)
  assert.equal(csrfOptions.secure, true)
  assert.equal(csrfOptions.sameSite, 'strict')
})

test('OTP login issues strict cookies and returns CSRF token via session lookup', async () => {
  await createUser({ email: 'session.user@example.com' })

  const verifyResponse = await loginWithOtp(
    'session.user@example.com',
    'User123!',
    getSourcePageForRole('user')
  )
  const tokenCookie = verifyResponse.setCookies.find((entry) => entry.startsWith('token='))
  const csrfCookie = verifyResponse.setCookies.find((entry) => entry.startsWith('XSRF-TOKEN='))

  assert.ok(tokenCookie)
  assert.ok(csrfCookie)
  assert.match(tokenCookie, /HttpOnly/i)
  assert.match(tokenCookie, /SameSite=Strict/i)
  assert.match(csrfCookie, /SameSite=Strict/i)

  const sessionResponse = await request('/session', {
    method: 'GET',
    cookieHeader: verifyResponse.cookieHeader,
  })
  assert.equal(sessionResponse.status, 200, sessionResponse.text)
  assert.ok(typeof sessionResponse.json?.csrfToken === 'string')
  assert.equal(
    sessionResponse.json?.csrfToken,
    readCookieValue(verifyResponse.cookieHeader, 'XSRF-TOKEN')
  )
})

test('admin local login skips OTP and issues an authenticated session immediately', async () => {
  await createUser({ email: 'admin.local@example.com', role: 'admin' })

  const loginResponse = await loginDirect(
    'admin.local@example.com',
    'User123!',
    getSourcePageForRole('admin')
  )
  const tokenCookie = loginResponse.setCookies.find((entry) => entry.startsWith('token='))
  const csrfCookie = loginResponse.setCookies.find((entry) => entry.startsWith('XSRF-TOKEN='))

  assert.ok(tokenCookie)
  assert.ok(csrfCookie)
  assert.equal(loginResponse.json?.user?.role, 'admin')
  assert.equal(loginResponse.json?.user?.mfa, false)
  assert.ok(typeof loginResponse.json?.csrfToken === 'string')

  const sessionResponse = await request('/session', {
    method: 'GET',
    cookieHeader: loginResponse.cookieHeader,
  })
  assert.equal(sessionResponse.status, 200, sessionResponse.text)
  assert.equal(sessionResponse.json?.role, 'admin')
  assert.equal(sessionResponse.json?.mfa, false)
  assert.equal(
    sessionResponse.json?.csrfToken,
    readCookieValue(loginResponse.cookieHeader, 'XSRF-TOKEN')
  )
})

test('cookie-authenticated mutating requests reject missing CSRF headers', async () => {
  await createUser({ email: 'csrf.user@example.com' })
  const verifyResponse = await loginWithOtp(
    'csrf.user@example.com',
    'User123!',
    getSourcePageForRole('user')
  )

  const response = await request('/users/me/profile', {
    method: 'PUT',
    cookieHeader: verifyResponse.cookieHeader,
    json: { firstName: 'Updated' },
  })

  assert.equal(response.status, 403, response.text)
  assert.equal(response.json?.message, 'Invalid security token.')
})

test('cookie-authenticated mutating requests accept valid CSRF headers', async () => {
  await createUser({ email: 'csrf.ok@example.com' })
  const verifyResponse = await loginWithOtp(
    'csrf.ok@example.com',
    'User123!',
    getSourcePageForRole('user')
  )
  const csrfValue = readCookieValue(verifyResponse.cookieHeader, 'XSRF-TOKEN')

  const response = await request('/users/me/profile', {
    method: 'PUT',
    cookieHeader: verifyResponse.cookieHeader,
    headers: { 'X-CSRF-Token': csrfValue },
    json: { firstName: 'Updated' },
  })

  assert.equal(response.status, 200, response.text)
  assert.equal(response.json?.profile?.firstName, 'Updated')
})

test('Google exchange is one-time and issues a hardened session', async () => {
  const user = await createUser({ email: 'google.user@example.com' })
  const exchangeCode = await createGoogleAuthExchange(user._id, 'login')

  const response = await request('/auth/google/exchange', {
    method: 'POST',
    json: { exchangeCode },
  })

  assert.equal(response.status, 200, response.text)
  assert.equal(response.json?.user?.authMethod, 'google')
  assert.ok(typeof response.json?.csrfToken === 'string')
  assert.ok(response.setCookies.find((entry) => entry.startsWith('token=')))
  assert.ok(response.setCookies.find((entry) => entry.startsWith('XSRF-TOKEN=')))

  const replay = await request('/auth/google/exchange', {
    method: 'POST',
    json: { exchangeCode },
  })
  assert.equal(replay.status, 400, replay.text)
})

test('doctor accounts are rejected on the patient sign-in page', async () => {
  await createUser({ email: 'doctor.route@example.com', role: 'doctor' })

  const loginResponse = await request('/login', {
    method: 'POST',
    json: {
      email: 'doctor.route@example.com',
      password: 'User123!',
      sourcePage: 'login',
    },
  })

  assert.equal(loginResponse.status, 403, loginResponse.text)
  assert.equal(
    loginResponse.json?.message,
    'This account must sign in from the doctor sign-in page.'
  )
  assert.equal(loginResponse.json?.expectedSourcePage, 'doctor_login')
})

test('patient accounts are rejected on the doctor sign-in page', async () => {
  await createUser({ email: 'patient.route@example.com', role: 'user' })

  const loginResponse = await request('/login', {
    method: 'POST',
    json: {
      email: 'patient.route@example.com',
      password: 'User123!',
      sourcePage: 'doctor_login',
    },
  })

  assert.equal(loginResponse.status, 403, loginResponse.text)
  assert.equal(
    loginResponse.json?.message,
    'This account must sign in from the patient sign-in page.'
  )
  assert.equal(loginResponse.json?.expectedSourcePage, 'login')
})

test('expired sessions are rejected and removed', async () => {
  const user = await createUser({ email: 'expired.user@example.com' })
  const verifyResponse = await loginWithOtp(
    'expired.user@example.com',
    'User123!',
    getSourcePageForRole('user')
  )
  const session = await Sessions.findOne({ userId: user._id })
  assert.ok(session)

  session.lastSeenAt = new Date(Date.now() - 13 * 60 * 60 * 1000)
  await session.save()

  const response = await request('/session', {
    method: 'GET',
    cookieHeader: verifyResponse.cookieHeader,
  })

  assert.equal(response.status, 401, response.text)
  const deletedSession = await Sessions.findById(session._id)
  assert.equal(deletedSession, null)
})

test('password change revokes all sessions and requires reauthentication', async () => {
  const user = await createUser({ email: 'password.user@example.com' })
  const verifyResponse = await loginWithOtp(
    'password.user@example.com',
    'User123!',
    getSourcePageForRole('user')
  )
  const csrfValue = readCookieValue(verifyResponse.cookieHeader, 'XSRF-TOKEN')

  const response = await request('/users/me/password', {
    method: 'PUT',
    cookieHeader: verifyResponse.cookieHeader,
    headers: { 'X-CSRF-Token': csrfValue },
    json: {
      currentPassword: 'User123!',
      newPassword: 'User1234!',
    },
  })

  assert.equal(response.status, 200, response.text)
  assert.equal(response.json?.requiresReauth, true)

  const sessionCount = await Sessions.countDocuments({ userId: user._id })
  assert.equal(sessionCount, 0)

  const sessionResponse = await request('/session', {
    method: 'GET',
    cookieHeader: verifyResponse.cookieHeader,
  })
  assert.equal(sessionResponse.status, 401, sessionResponse.text)
})

test('non-allowlisted origins are rejected', async () => {
  const response = await request('/health', {
    method: 'GET',
    headers: { Origin: 'https://evil.example' },
  })

  assert.equal(response.status, 403, response.text)
})

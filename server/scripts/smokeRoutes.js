const BASE_URL = String(process.env.SMOKE_BASE_URL || 'http://localhost:5001/api').replace(/\/$/, '')

const DEFAULT_ACCOUNTS = {
  admin: {
    email: String(process.env.CORE_ADMIN_EMAIL || 'test.admin@aihealthcare.com').trim().toLowerCase(),
    password: String(process.env.CORE_ADMIN_PASSWORD || 'AdminTest2026'),
  },
  nurse: {
    email: String(process.env.CORE_NURSE_EMAIL || 'test.doctor@aihealthcare.com').trim().toLowerCase(),
    password: String(process.env.CORE_NURSE_PASSWORD || 'DoctorTest2026'),
  },
  user: {
    email: String(process.env.CORE_USER_EMAIL || 'test.patient@aihealthcare.com').trim().toLowerCase(),
    password: String(process.env.CORE_USER_PASSWORD || 'PatientTest2026'),
  },
}

const REQUEST_TIMEOUT_MS = 12000

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const maskToken = (token) => {
  if (!token) return ''
  return `${token.slice(0, 8)}...${token.slice(-8)}`
}

const request = async (path, options = {}) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const url = `${BASE_URL}${path}`

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    const text = await response.text()
    const json = safeJsonParse(text)
    return { status: response.status, text, json }
  } finally {
    clearTimeout(timeout)
  }
}

const expectStatus = ({ actual, expected, label, details = '' }) => {
  if (actual !== expected) {
    const suffix = details ? ` | ${details}` : ''
    throw new Error(`${label}: expected ${expected}, got ${actual}${suffix}`)
  }
  console.log(`[ok] ${label}: ${actual}`)
}

const authHeaders = (token, withJson = false) => {
  const headers = {
    Authorization: `Bearer ${token}`,
  }
  if (withJson) {
    headers['Content-Type'] = 'application/json'
  }
  return headers
}

const loginWithOtp = async (role, { email, password }) => {
  const loginResponse = await request('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  expectStatus({
    actual: loginResponse.status,
    expected: 200,
    label: `POST /login (${role})`,
    details: loginResponse.text,
  })

  const userId = loginResponse.json?.userId
  const otp = loginResponse.json?.otpPreview
  if (!userId || !otp) {
    throw new Error(`POST /login (${role}): missing userId or otpPreview in response`)
  }

  const verifyResponse = await request('/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, otp }),
  })

  expectStatus({
    actual: verifyResponse.status,
    expected: 200,
    label: `POST /verify-otp (${role})`,
    details: verifyResponse.text,
  })

  const token = verifyResponse.json?.token
  if (!token) {
    throw new Error(`POST /verify-otp (${role}): missing token`)
  }
  console.log(`[ok] token issued (${role}): ${maskToken(token)}`)
  return token
}

const clearActiveUserAppointments = async (token) => {
  const listResponse = await request('/appointments', {
    method: 'GET',
    headers: authHeaders(token),
  })
  expectStatus({
    actual: listResponse.status,
    expected: 200,
    label: 'GET /appointments (user pre-check)',
    details: listResponse.text,
  })

  const appointments = Array.isArray(listResponse.json?.appointments) ? listResponse.json.appointments : []
  const booked = appointments.filter((entry) => entry?.status === 'Booked' && entry?.id)

  for (const appointment of booked) {
    const patchResponse = await request(`/appointments/${appointment.id}`, {
      method: 'PATCH',
      headers: authHeaders(token, true),
      body: JSON.stringify({ status: 'Recorded' }),
    })
    expectStatus({
      actual: patchResponse.status,
      expected: 200,
      label: `PATCH /appointments/${appointment.id} (close active booking)`,
      details: patchResponse.text,
    })
  }
}

const run = async () => {
  console.log(`[info] Base URL: ${BASE_URL}`)

  const health = await request('/health')
  expectStatus({
    actual: health.status,
    expected: 200,
    label: 'GET /health',
    details: health.text,
  })

  const adminToken = await loginWithOtp('admin', DEFAULT_ACCOUNTS.admin)
  const nurseToken = await loginWithOtp('nurse', DEFAULT_ACCOUNTS.nurse)
  const userToken = await loginWithOtp('user', DEFAULT_ACCOUNTS.user)

  const roles = [
    { name: 'admin', token: adminToken },
    { name: 'nurse', token: nurseToken },
    { name: 'user', token: userToken },
  ]

  for (const role of roles) {
    const sessionResponse = await request('/session', {
      method: 'GET',
      headers: authHeaders(role.token),
    })
    expectStatus({
      actual: sessionResponse.status,
      expected: 200,
      label: `GET /session (${role.name})`,
      details: sessionResponse.text,
    })
  }

  const usersAdmin = await request('/users', { method: 'GET', headers: authHeaders(adminToken) })
  expectStatus({
    actual: usersAdmin.status,
    expected: 200,
    label: 'GET /users (admin)',
    details: usersAdmin.text,
  })

  const usersNurse = await request('/users', { method: 'GET', headers: authHeaders(nurseToken) })
  expectStatus({
    actual: usersNurse.status,
    expected: 403,
    label: 'GET /users (nurse)',
    details: usersNurse.text,
  })

  const usersUser = await request('/users', { method: 'GET', headers: authHeaders(userToken) })
  expectStatus({
    actual: usersUser.status,
    expected: 403,
    label: 'GET /users (user)',
    details: usersUser.text,
  })

  for (const role of roles) {
    const appointmentsResponse = await request('/appointments', {
      method: 'GET',
      headers: authHeaders(role.token),
    })
    expectStatus({
      actual: appointmentsResponse.status,
      expected: 200,
      label: `GET /appointments (${role.name})`,
      details: appointmentsResponse.text,
    })
  }

  await clearActiveUserAppointments(userToken)

  const scheduledDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const createPayload = {
    department: 'General Medicine',
    scheduledDate,
    reason: 'Route smoke test booking',
  }

  const createUser = await request('/appointments', {
    method: 'POST',
    headers: authHeaders(userToken, true),
    body: JSON.stringify(createPayload),
  })
  expectStatus({
    actual: createUser.status,
    expected: 201,
    label: 'POST /appointments (user)',
    details: createUser.text,
  })

  const createNurse = await request('/appointments', {
    method: 'POST',
    headers: authHeaders(nurseToken, true),
    body: JSON.stringify(createPayload),
  })
  expectStatus({
    actual: createNurse.status,
    expected: 403,
    label: 'POST /appointments (nurse)',
    details: createNurse.text,
  })

  const createAdmin = await request('/appointments', {
    method: 'POST',
    headers: authHeaders(adminToken, true),
    body: JSON.stringify(createPayload),
  })
  expectStatus({
    actual: createAdmin.status,
    expected: 403,
    label: 'POST /appointments (admin)',
    details: createAdmin.text,
  })

  for (const role of roles) {
    const reservationsResponse = await request('/reservations', {
      method: 'GET',
      headers: authHeaders(role.token),
    })
    expectStatus({
      actual: reservationsResponse.status,
      expected: 200,
      label: `GET /reservations (${role.name})`,
      details: reservationsResponse.text,
    })
  }

  for (const role of roles) {
    const logoutResponse = await request('/logout', {
      method: 'POST',
      headers: authHeaders(role.token),
    })
    expectStatus({
      actual: logoutResponse.status,
      expected: 200,
      label: `POST /logout (${role.name})`,
      details: logoutResponse.text,
    })
  }

  console.log('[done] Route smoke checks passed.')
}

run().catch((error) => {
  console.error('[fail] Route smoke check failed:', error.message)
  process.exit(1)
})

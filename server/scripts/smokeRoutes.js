const BASE_URL = String(process.env.SMOKE_BASE_URL || 'http://localhost:5001/api').replace(/\/$/, '')

const DEFAULT_ACCOUNTS = {
  admin: {
    email: String(process.env.CORE_ADMIN_EMAIL || 'demo.admin@aihealthcare.com').trim().toLowerCase(),
    password: String(process.env.CORE_ADMIN_PASSWORD || 'Admin123!'),
  },
  doctor: {
    email: String(process.env.CORE_DOCTOR_EMAIL || process.env.CORE_NURSE_EMAIL || 'demo.doctor@aihealthcare.com').trim().toLowerCase(),
    password: String(process.env.CORE_DOCTOR_PASSWORD || process.env.CORE_NURSE_PASSWORD || 'Doctor123!'),
  },
  user: {
    email: String(process.env.CORE_USER_EMAIL || 'demo.user@aihealthcare.com').trim().toLowerCase(),
    password: String(process.env.CORE_USER_PASSWORD || 'User123!'),
  },
}

const REQUEST_TIMEOUT_MS = 12000
const CLINIC_UTC_OFFSET_MINUTES = 8 * 60

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

const pad2 = (value) => String(value).padStart(2, '0')

const getClinicParts = (dateInput) => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput)
  const shifted = new Date(date.getTime() + CLINIC_UTC_OFFSET_MINUTES * 60 * 1000)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  }
}

const formatDateKey = ({ year, month, day }) => `${year}-${pad2(month)}-${pad2(day)}`

const getWeekStartDateKeyFromDateKey = (dateKey) => {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  const daysSinceMonday = (weekday + 6) % 7
  const monday = new Date(Date.UTC(year, month - 1, day - daysSinceMonday))
  return formatDateKey({
    year: monday.getUTCFullYear(),
    month: monday.getUTCMonth() + 1,
    day: monday.getUTCDate(),
  })
}

const getDayKeyFromDateKey = (dateKey) => {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-')
  const weekday = new Date(Date.UTC(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw))).getUTCDay()
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][weekday]
}

const toUtcIsoFromClinicDateTime = (dateKey, hour, minute) => {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split('-')
  const utcMs =
    Date.UTC(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw), hour, minute, 0, 0) -
    CLINIC_UTC_OFFSET_MINUTES * 60 * 1000
  return new Date(utcMs).toISOString()
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
    const setCookies = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter(Boolean)
    const cookieHeader = setCookies.map((entry) => entry.split(';')[0]).join('; ')
    return { status: response.status, text, json, cookieHeader }
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

const authHeaders = (session, withJson = false) => {
  const headers = {}
  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`
  }
  if (session?.cookieHeader) {
    headers.Cookie = session.cookieHeader
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

  const challengeId = loginResponse.json?.challengeId ?? loginResponse.json?.userId
  const otp = loginResponse.json?.otpPreview
  if (!challengeId || !otp) {
    throw new Error(`POST /login (${role}): missing challengeId or otpPreview in response`)
  }

  const verifyResponse = await request('/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, otp }),
  })

  expectStatus({
    actual: verifyResponse.status,
    expected: 200,
    label: `POST /verify-otp (${role})`,
    details: verifyResponse.text,
  })

  if (!verifyResponse.cookieHeader) {
    throw new Error(`POST /verify-otp (${role}): missing session cookie`)
  }
  const token = verifyResponse.cookieHeader
    .split('; ')
    .find((entry) => entry.startsWith('token='))
    ?.slice('token='.length)
  if (token) {
    console.log(`[ok] token issued (${role}): ${maskToken(token)}`)
  }
  return { cookieHeader: verifyResponse.cookieHeader, token }
}

const prepareBookingPrerequisites = async ({ userSession, doctorSession }) => {
  const profileResponse = await request('/users/me/profile', {
    method: 'PUT',
    headers: authHeaders(userSession, true),
    body: JSON.stringify({
      dateOfBirth: '1995-05-20',
      phoneNumber: '+639171234567',
      address: '123 Test Street, Manila',
      gender: 'Prefer not to say',
    }),
  })
  expectStatus({
    actual: profileResponse.status,
    expected: 200,
    label: 'PUT /users/me/profile (user)',
    details: profileResponse.text,
  })

  const healthInfoResponse = await request('/users/me/personal-health-info', {
    method: 'PUT',
    headers: authHeaders(userSession, true),
    body: JSON.stringify({
      bloodType: 'O+',
      emergencyContact: {
        name: 'Emergency Contact',
        phone: '+639181112222',
        relationship: 'Sibling',
      },
      notes: 'Smoke test profile',
    }),
  })
  expectStatus({
    actual: healthInfoResponse.status,
    expected: 200,
    label: 'PUT /users/me/personal-health-info (user)',
    details: healthInfoResponse.text,
  })

  const doctorsResponse = await request('/appointments/available-doctors?department=Internal%20Medicine', {
    method: 'GET',
    headers: authHeaders(userSession),
  })
  expectStatus({
    actual: doctorsResponse.status,
    expected: 200,
    label: 'GET /appointments/available-doctors (user)',
    details: doctorsResponse.text,
  })

  const doctors = Array.isArray(doctorsResponse.json?.doctors) ? doctorsResponse.json.doctors : []
  const doctor = doctors[0]
  if (!doctor?.id) {
    throw new Error('No available doctor returned for Internal Medicine')
  }

  const targetDate = new Date(Date.now() + 48 * 60 * 60 * 1000)
  const clinicParts = getClinicParts(targetDate)
  const dateKey = formatDateKey(clinicParts)
  const weekStart = getWeekStartDateKeyFromDateKey(dateKey)
  const dayKey = getDayKeyFromDateKey(dateKey)
  const scheduledDate = toUtcIsoFromClinicDateTime(dateKey, 8, 0)

  const scheduleResponse = await request(`/doctor/schedules/${weekStart}`, {
    method: 'PUT',
    headers: authHeaders(doctorSession, true),
    body: JSON.stringify({
      days: {
        [dayKey]: { morning: true, afternoon: false },
      },
    }),
  })
  expectStatus({
    actual: scheduleResponse.status,
    expected: 200,
    label: `PUT /doctor/schedules/${weekStart} (doctor)`,
    details: scheduleResponse.text,
  })

  return {
    doctorId: String(doctor.id),
    department: 'Internal Medicine',
    scheduledDate,
  }
}

const clearActiveUserAppointments = async (session) => {
  const listResponse = await request('/appointments', {
    method: 'GET',
    headers: authHeaders(session),
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
      headers: authHeaders(session, true),
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

  const adminSession = await loginWithOtp('admin', DEFAULT_ACCOUNTS.admin)
  const doctorSession = await loginWithOtp('doctor', DEFAULT_ACCOUNTS.doctor)
  const userSession = await loginWithOtp('user', DEFAULT_ACCOUNTS.user)

  const roles = [
    { name: 'admin', session: adminSession },
    { name: 'doctor', session: doctorSession },
    { name: 'user', session: userSession },
  ]

  for (const role of roles) {
    const sessionResponse = await request('/session', {
      method: 'GET',
      headers: authHeaders(role.session),
    })
    expectStatus({
      actual: sessionResponse.status,
      expected: 200,
      label: `GET /session (${role.name})`,
      details: sessionResponse.text,
    })
  }

  const usersAdmin = await request('/users', { method: 'GET', headers: authHeaders(adminSession) })
  expectStatus({
    actual: usersAdmin.status,
    expected: 200,
    label: 'GET /users (admin)',
    details: usersAdmin.text,
  })

  const usersDoctor = await request('/users', { method: 'GET', headers: authHeaders(doctorSession) })
  expectStatus({
    actual: usersDoctor.status,
    expected: 403,
    label: 'GET /users (doctor)',
    details: usersDoctor.text,
  })

  const usersUser = await request('/users', { method: 'GET', headers: authHeaders(userSession) })
  expectStatus({
    actual: usersUser.status,
    expected: 403,
    label: 'GET /users (user)',
    details: usersUser.text,
  })

  for (const role of roles) {
    const appointmentsResponse = await request('/appointments', {
      method: 'GET',
      headers: authHeaders(role.session),
    })
    expectStatus({
      actual: appointmentsResponse.status,
      expected: 200,
      label: `GET /appointments (${role.name})`,
      details: appointmentsResponse.text,
    })
  }

  await clearActiveUserAppointments(userSession)

  const bookingSetup = await prepareBookingPrerequisites({
    userSession,
    doctorSession,
  })
  const createPayload = {
    doctorId: bookingSetup.doctorId,
    department: bookingSetup.department,
    scheduledDate: bookingSetup.scheduledDate,
    reason: 'Route smoke test booking',
  }

  const createUser = await request('/appointments', {
    method: 'POST',
    headers: authHeaders(userSession, true),
    body: JSON.stringify(createPayload),
  })
  expectStatus({
    actual: createUser.status,
    expected: 201,
    label: 'POST /appointments (user)',
    details: createUser.text,
  })

  const createDoctor = await request('/appointments', {
    method: 'POST',
    headers: authHeaders(doctorSession, true),
    body: JSON.stringify(createPayload),
  })
  expectStatus({
    actual: createDoctor.status,
    expected: 403,
    label: 'POST /appointments (doctor)',
    details: createDoctor.text,
  })

  const createAdmin = await request('/appointments', {
    method: 'POST',
    headers: authHeaders(adminSession, true),
    body: JSON.stringify(createPayload),
  })
  expectStatus({
    actual: createAdmin.status,
    expected: 403,
    label: 'POST /appointments (admin)',
    details: createAdmin.text,
  })

  for (const role of roles) {
    const reservationsResponse = await request('/users/me/appointments/history', {
      method: 'GET',
      headers: authHeaders(role.session),
    })
    expectStatus({
      actual: reservationsResponse.status,
      expected: 200,
      label: `GET /users/me/appointments/history (${role.name})`,
      details: reservationsResponse.text,
    })
  }

  for (const role of roles) {
    const logoutResponse = await request('/logout', {
      method: 'POST',
      headers: authHeaders(role.session),
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

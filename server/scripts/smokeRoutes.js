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
const ACTIVE_APPOINTMENT_STATUSES = new Set(['Pending', 'Confirmed'])
const skippedChecks = []

const safeJsonParse = (value) => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

const readCookieValue = (cookieHeader, name) => {
  if (!cookieHeader) return ''
  return (
    cookieHeader
      .split('; ')
      .find((entry) => entry.startsWith(`${name}=`))
      ?.slice(name.length + 1) || ''
  )
}

const createUniqueEmail = (prefix, domain = 'gmail.com') =>
  `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@${domain}`

const extractResetToken = (previewUrl) => {
  try {
    return new URL(String(previewUrl || '')).searchParams.get('reset') || ''
  } catch {
    return ''
  }
}

const getSourcePageForRole = (role) => {
  if (role === 'doctor') return 'doctor_login'
  if (role === 'admin' || role === 'system_admin') return 'admin_login'
  return 'login'
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
    let response
    try {
      response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
    } catch (error) {
      throw new Error(
        `fetch failed for ${url}. Start the server first or set SMOKE_BASE_URL. ` +
          `Original error: ${error?.message || error}`
      )
    }
    const text = await response.text()
    const json = safeJsonParse(text)
    const setCookies = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter(Boolean)
    const cookieHeader = setCookies.map((entry) => entry.split(';')[0]).join('; ')
    return {
      status: response.status,
      text,
      json,
      cookieHeader,
      contentType: response.headers.get('content-type') || '',
      location: response.headers.get('location') || '',
    }
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

const skipCheck = (label, reason) => {
  skippedChecks.push({ label, reason })
  console.log(`[skip] ${label}: ${reason}`)
}

const authHeaders = (session, withJson = false) => {
  const headers = {}
  if (session?.token && !session?.cookieHeader) {
    headers.Authorization = `Bearer ${session.token}`
  }
  if (session?.cookieHeader) {
    headers.Cookie = session.cookieHeader
    if (session?.csrfToken) {
      headers['X-CSRF-Token'] = session.csrfToken
    }
  } else if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`
  }
  if (withJson) {
    headers['Content-Type'] = 'application/json'
  }
  return headers
}

const startLoginChallenge = async (role, { email, password }) => {
  const loginResponse = await request('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, sourcePage: getSourcePageForRole(role) }),
  })

  expectStatus({
    actual: loginResponse.status,
    expected: 200,
    label: `POST /login (${role})`,
    details: loginResponse.text,
  })

  const challengeId = loginResponse.json?.challengeId ?? loginResponse.json?.userId
  const otpPreview = loginResponse.json?.otpPreview
  if (!challengeId) {
    throw new Error(`POST /login (${role}): missing challengeId in response`)
  }

  if (!otpPreview) {
    throw new Error(`POST /login (${role}): otpPreview unavailable in this environment`)
  }

  return { challengeId, otpPreview }
}

const buildDirectSessionFromLogin = (role, loginResponse) => {
  if (!loginResponse.cookieHeader) {
    throw new Error(`POST /login (${role}): missing session cookie`)
  }

  const token = loginResponse.cookieHeader
    .split('; ')
    .find((entry) => entry.startsWith('token='))
    ?.slice('token='.length)
  const csrfToken = readCookieValue(loginResponse.cookieHeader, 'XSRF-TOKEN')
  if (token) {
    console.log(`[ok] token issued (${role}): ${maskToken(token)}`)
  }

  return {
    cookieHeader: loginResponse.cookieHeader,
    csrfToken,
    token,
    userId: String(loginResponse.json?.user?.id || ''),
    role: loginResponse.json?.user?.role || '',
  }
}

const resendLoginChallenge = async (role, challengeId) => {
  const resendResponse = await request('/resend-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId }),
  })

  expectStatus({
    actual: resendResponse.status,
    expected: 200,
    label: `POST /resend-otp (${role})`,
    details: resendResponse.text,
  })

  const nextChallengeId = resendResponse.json?.challengeId ?? challengeId
  const otpPreview = resendResponse.json?.otpPreview
  if (!otpPreview) {
    throw new Error(`POST /resend-otp (${role}): otpPreview unavailable in this environment`)
  }

  return { challengeId: nextChallengeId, otpPreview }
}

const verifyLoginChallenge = async (role, { challengeId, otp }) => {
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
  const csrfToken = readCookieValue(verifyResponse.cookieHeader, 'XSRF-TOKEN')
  if (token) {
    console.log(`[ok] token issued (${role}): ${maskToken(token)}`)
  }
  return {
    cookieHeader: verifyResponse.cookieHeader,
    csrfToken,
    token,
    userId: String(verifyResponse.json?.user?.id || ''),
    role: verifyResponse.json?.user?.role || '',
  }
}

const loginWithOtp = async (role, credentials) => {
  const challenge = await startLoginChallenge(role, credentials)
  return verifyLoginChallenge(role, {
    challengeId: challenge.challengeId,
    otp: challenge.otpPreview,
  })
}

const loginWithExpectedMode = async (
  role,
  { email, password },
  { mode = 'auto' } = {}
) => {
  const loginResponse = await request('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, sourcePage: getSourcePageForRole(role) }),
  })

  expectStatus({
    actual: loginResponse.status,
    expected: 200,
    label: `POST /login (${role})`,
    details: loginResponse.text,
  })

  const requires2FA = Boolean(loginResponse.json?.requires2FA)
  if (requires2FA) {
    if (mode === 'direct') {
      throw new Error(`POST /login (${role}): expected direct session, received OTP challenge`)
    }

    const challengeId = loginResponse.json?.challengeId ?? loginResponse.json?.userId
    const otpPreview = loginResponse.json?.otpPreview
    if (!challengeId) {
      throw new Error(`POST /login (${role}): missing challengeId in response`)
    }
    if (!otpPreview) {
      throw new Error(`POST /login (${role}): otpPreview unavailable in this environment`)
    }

    return verifyLoginChallenge(role, {
      challengeId,
      otp: otpPreview,
    })
  }

  if (mode === 'otp') {
    throw new Error(`POST /login (${role}): expected OTP challenge, received direct session`)
  }

  return buildDirectSessionFromLogin(role, loginResponse)
}

const registerDoctorApplication = async (label, { email, department = 'Internal Medicine' }) => {
  const form = new FormData()
  form.set('firstName', 'Smoke')
  form.set('lastName', 'Doctor')
  form.set('email', email)
  form.set('password', 'Doctor123!')
  form.set('department', department)
  form.set(
    'license',
    new Blob(['%PDF-1.4 smoke route check license'], { type: 'application/pdf' }),
    'smoke-license.pdf'
  )

  const response = await request('/register/doctor', {
    method: 'POST',
    body: form,
  })

  expectStatus({
    actual: response.status,
    expected: 201,
    label: `POST /register/doctor (${label})`,
    details: response.text,
  })

  return response
}

const prepareBookingPrerequisites = async ({ adminSession, userSession, doctorSession }) => {
  const doctorAvailabilityPaths = [
    '/appointments/doctors/available?department=Internal%20Medicine',
    '/appointments/available-doctors?department=Internal%20Medicine',
    '/doctor/appointments/doctors/available?department=Internal%20Medicine',
  ]
  let doctor = null

  for (const path of doctorAvailabilityPaths) {
    const doctorsResponse = await request(path, {
      method: 'GET',
      headers: authHeaders(userSession),
    })
    expectStatus({
      actual: doctorsResponse.status,
      expected: 200,
      label: `GET ${path} (user)`,
      details: doctorsResponse.text,
    })

    const doctors = Array.isArray(doctorsResponse.json?.doctors) ? doctorsResponse.json.doctors : []
    if (!doctor && doctors[0]?.id) {
      doctor = doctors[0]
    }
  }

  if (!doctor?.id) {
    throw new Error('No available doctor returned for Internal Medicine')
  }

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

  const targetDate = new Date(Date.now() + 48 * 60 * 60 * 1000)
  const clinicParts = getClinicParts(targetDate)
  const dateKey = formatDateKey(clinicParts)
  const weekStart = getWeekStartDateKeyFromDateKey(dateKey)
  const dayKey = getDayKeyFromDateKey(dateKey)
  const scheduledDate = toUtcIsoFromClinicDateTime(dateKey, 8, 0)

  const scheduleBeforeResponse = await request(`/doctor/schedules/${weekStart}`, {
    method: 'GET',
    headers: authHeaders(doctorSession),
  })
  expectStatus({
    actual: scheduleBeforeResponse.status,
    expected: 200,
    label: `GET /doctor/schedules/${weekStart} (doctor before save)`,
    details: scheduleBeforeResponse.text,
  })

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

  const scheduleAfterResponse = await request(`/doctor/schedules/${weekStart}`, {
    method: 'GET',
    headers: authHeaders(doctorSession),
  })
  expectStatus({
    actual: scheduleAfterResponse.status,
    expected: 200,
    label: `GET /doctor/schedules/${weekStart} (doctor after save)`,
    details: scheduleAfterResponse.text,
  })

  const adminScheduleResponse = await request(`/doctor/schedules/${weekStart}?doctorId=${doctor.id}`, {
    method: 'GET',
    headers: authHeaders(adminSession),
  })
  expectStatus({
    actual: adminScheduleResponse.status,
    expected: 200,
    label: `GET /doctor/schedules/${weekStart}?doctorId=${doctor.id} (admin)`,
    details: adminScheduleResponse.text,
  })

  const slotsResponse = await request(`/appointments/doctors/${doctor.id}/slots?date=${dateKey}`, {
    method: 'GET',
    headers: authHeaders(userSession),
  })
  expectStatus({
    actual: slotsResponse.status,
    expected: 200,
    label: `GET /appointments/doctors/${doctor.id}/slots?date=${dateKey} (user)`,
    details: slotsResponse.text,
  })

  return {
    doctorId: String(doctor.id),
    department: 'Internal Medicine',
    scheduledDate,
    weekStart,
    dateKey,
  }
}

const clearActiveUserAppointments = async (adminSession, userSession) => {
  const listResponse = await request('/appointments', {
    method: 'GET',
    headers: authHeaders(userSession),
  })
  expectStatus({
    actual: listResponse.status,
    expected: 200,
    label: 'GET /appointments (user pre-check)',
    details: listResponse.text,
  })

  const appointments = Array.isArray(listResponse.json?.appointments) ? listResponse.json.appointments : []
  const activeAppointments = appointments.filter(
    (entry) => ACTIVE_APPOINTMENT_STATUSES.has(String(entry?.status || '')) && entry?.id
  )

  for (const appointment of activeAppointments) {
    const patchResponse = await request(`/appointments/${appointment.id}/status`, {
      method: 'PATCH',
      headers: authHeaders(adminSession, true),
      body: JSON.stringify({ status: 'Cancelled' }),
    })
    expectStatus({
      actual: patchResponse.status,
      expected: 200,
      label: `PATCH /appointments/${appointment.id}/status (admin cleanup)`,
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

  const googleAuthResponse = await request('/auth/google?sourcePage=login', {
    method: 'GET',
    redirect: 'manual',
  })
  if (googleAuthResponse.status === 302) {
    expectStatus({
      actual: googleAuthResponse.status,
      expected: 302,
      label: 'GET /auth/google',
      details: googleAuthResponse.location,
    })
  } else if (googleAuthResponse.status === 503) {
    skipCheck('GET /auth/google', 'Google sign-in is not configured in this environment')
  } else {
    throw new Error(`GET /auth/google: expected 302 or 503, got ${googleAuthResponse.status}`)
  }
  skipCheck('GET /auth/google/callback', 'requires provider-issued OAuth callback parameters')
  skipCheck('POST /auth/google/exchange', 'requires provider-issued Google exchange code')

  const supportTicketResponse = await request('/support/tickets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Smoke Route Check',
      email: createUniqueEmail('smoke.support'),
      message: 'Smoke route check support ticket for backend route validation.',
    }),
  })
  expectStatus({
    actual: supportTicketResponse.status,
    expected: 201,
    label: 'POST /support/tickets',
    details: supportTicketResponse.text,
  })

  const tempUserEmail = createUniqueEmail('smoke.user')
  const tempUserPassword = 'User123!'
  const tempUserResetPassword = 'User1234!'
  const tempUserFinalPassword = 'User12345!'

  const registerResponse = await request('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Smoke',
      lastName: 'User',
      email: tempUserEmail,
      password: tempUserPassword,
    }),
  })
  expectStatus({
    actual: registerResponse.status,
    expected: 201,
    label: 'POST /register',
    details: registerResponse.text,
  })

  const tempChallenge = await startLoginChallenge('temp-user', {
    email: tempUserEmail,
    password: tempUserPassword,
  })
  const tempResentChallenge = await resendLoginChallenge('temp-user', tempChallenge.challengeId)
  const tempSession = await verifyLoginChallenge('temp-user', {
    challengeId: tempResentChallenge.challengeId,
    otp: tempResentChallenge.otpPreview,
  })

  const tempSessionResponse = await request('/session', {
    method: 'GET',
    headers: authHeaders(tempSession),
  })
  expectStatus({
    actual: tempSessionResponse.status,
    expected: 200,
    label: 'GET /session (temp-user)',
    details: tempSessionResponse.text,
  })

  const tempProfileResponse = await request('/users/me/profile', {
    method: 'GET',
    headers: authHeaders(tempSession),
  })
  expectStatus({
    actual: tempProfileResponse.status,
    expected: 200,
    label: 'GET /users/me/profile (temp-user)',
    details: tempProfileResponse.text,
  })

  const tempSettingsResponse = await request('/users/me/settings', {
    method: 'GET',
    headers: authHeaders(tempSession),
  })
  expectStatus({
    actual: tempSettingsResponse.status,
    expected: 200,
    label: 'GET /users/me/settings (temp-user)',
    details: tempSettingsResponse.text,
  })

  const tempSettingsUpdateResponse = await request('/users/me/settings', {
    method: 'PUT',
    headers: authHeaders(tempSession, true),
    body: JSON.stringify({
      settings: {
        theme: 'light',
        notifications: {
          email: true,
          sms: false,
          push: true,
          appointmentReminders: true,
          securityAlerts: true,
        },
      },
    }),
  })
  expectStatus({
    actual: tempSettingsUpdateResponse.status,
    expected: 200,
    label: 'PUT /users/me/settings (temp-user)',
    details: tempSettingsUpdateResponse.text,
  })

  const tempLogoutResponse = await request('/logout', {
    method: 'POST',
    headers: authHeaders(tempSession),
  })
  expectStatus({
    actual: tempLogoutResponse.status,
    expected: 200,
    label: 'POST /logout (temp-user)',
    details: tempLogoutResponse.text,
  })

  const forgotPasswordResponse = await request('/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: tempUserEmail,
      sourcePage: 'login',
    }),
  })
  expectStatus({
    actual: forgotPasswordResponse.status,
    expected: 200,
    label: 'POST /forgot-password',
    details: forgotPasswordResponse.text,
  })

  const resetToken = extractResetToken(forgotPasswordResponse.json?.previewUrl)
  if (resetToken) {
    const resetPasswordResponse = await request('/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resetToken,
        newPassword: tempUserResetPassword,
      }),
    })
    expectStatus({
      actual: resetPasswordResponse.status,
      expected: 200,
      label: 'POST /reset-password',
      details: resetPasswordResponse.text,
    })

    const tempSessionAfterReset = await loginWithOtp('temp-user-reset', {
      email: tempUserEmail,
      password: tempUserResetPassword,
    })

    const changePasswordResponse = await request('/users/me/password', {
      method: 'PUT',
      headers: authHeaders(tempSessionAfterReset, true),
      body: JSON.stringify({
        currentPassword: tempUserResetPassword,
        newPassword: tempUserFinalPassword,
      }),
    })
    expectStatus({
      actual: changePasswordResponse.status,
      expected: 200,
      label: 'PUT /users/me/password (temp-user)',
      details: changePasswordResponse.text,
    })

    const revokedSessionResponse = await request('/session', {
      method: 'GET',
      headers: authHeaders(tempSessionAfterReset),
    })
    expectStatus({
      actual: revokedSessionResponse.status,
      expected: 401,
      label: 'GET /session after password change (temp-user)',
      details: revokedSessionResponse.text,
    })
  } else {
    skipCheck('POST /reset-password', 'no preview reset URL available in this environment')
    skipCheck('PUT /users/me/password', 'requires a password reset token that is not exposed in this environment')
  }

  const adminSession = await loginWithExpectedMode('admin', DEFAULT_ACCOUNTS.admin, { mode: 'direct' })
  const doctorSession = await loginWithExpectedMode('doctor', DEFAULT_ACCOUNTS.doctor, { mode: 'otp' })
  const userSession = await loginWithExpectedMode('user', DEFAULT_ACCOUNTS.user, { mode: 'otp' })

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

  const userProfileResponse = await request('/users/me/profile', {
    method: 'GET',
    headers: authHeaders(userSession),
  })
  expectStatus({
    actual: userProfileResponse.status,
    expected: 200,
    label: 'GET /users/me/profile (user)',
    details: userProfileResponse.text,
  })
  const patientId = String(userProfileResponse.json?.profile?.id || '')
  if (!patientId) {
    throw new Error('GET /users/me/profile (user): missing profile.id')
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

  await clearActiveUserAppointments(adminSession, userSession)

  const bookingSetup = await prepareBookingPrerequisites({
    adminSession,
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
  const appointmentId = String(createUser.json?.appointment?._id || createUser.json?.appointment?.id || '')
  if (!appointmentId) {
    throw new Error('POST /appointments (user): missing appointment id')
  }

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

  const appointmentStatusResponse = await request(`/appointments/${appointmentId}/status`, {
    method: 'PATCH',
    headers: authHeaders(doctorSession, true),
    body: JSON.stringify({ status: 'Confirmed' }),
  })
  expectStatus({
    actual: appointmentStatusResponse.status,
    expected: 200,
    label: `PATCH /appointments/${appointmentId}/status (doctor)`,
    details: appointmentStatusResponse.text,
  })

  const patientProfileResponse = await request(`/doctor/patients/${patientId}/profile`, {
    method: 'GET',
    headers: authHeaders(doctorSession),
  })
  expectStatus({
    actual: patientProfileResponse.status,
    expected: 200,
    label: `GET /doctor/patients/${patientId}/profile (doctor)`,
    details: patientProfileResponse.text,
  })

  const doctorOverviewResponse = await request('/doctor/dashboard/overview', {
    method: 'GET',
    headers: authHeaders(doctorSession),
  })
  expectStatus({
    actual: doctorOverviewResponse.status,
    expected: 200,
    label: 'GET /doctor/dashboard/overview (doctor)',
    details: doctorOverviewResponse.text,
  })

  const adminOverviewResponse = await request(`/doctor/dashboard/overview?doctorId=${bookingSetup.doctorId}`, {
    method: 'GET',
    headers: authHeaders(adminSession),
  })
  expectStatus({
    actual: adminOverviewResponse.status,
    expected: 200,
    label: `GET /doctor/dashboard/overview?doctorId=${bookingSetup.doctorId} (admin)`,
    details: adminOverviewResponse.text,
  })

  const doctorTimelineResponse = await request('/doctor/queue/timeline', {
    method: 'GET',
    headers: authHeaders(doctorSession),
  })
  expectStatus({
    actual: doctorTimelineResponse.status,
    expected: 200,
    label: 'GET /doctor/queue/timeline (doctor)',
    details: doctorTimelineResponse.text,
  })

  const adminTimelineResponse = await request(`/doctor/queue/timeline?doctorId=${bookingSetup.doctorId}`, {
    method: 'GET',
    headers: authHeaders(adminSession),
  })
  expectStatus({
    actual: adminTimelineResponse.status,
    expected: 200,
    label: `GET /doctor/queue/timeline?doctorId=${bookingSetup.doctorId} (admin)`,
    details: adminTimelineResponse.text,
  })

  const queueStatusResponse = await request(`/doctor/appointments/${appointmentId}/queue-status`, {
    method: 'PATCH',
    headers: authHeaders(doctorSession, true),
    body: JSON.stringify({ queueStatus: 'Arrived' }),
  })
  expectStatus({
    actual: queueStatusResponse.status,
    expected: 200,
    label: `PATCH /doctor/appointments/${appointmentId}/queue-status (doctor)`,
    details: queueStatusResponse.text,
  })

  const soapNoteResponse = await request(`/doctor/appointments/${appointmentId}/soap-note`, {
    method: 'PUT',
    headers: authHeaders(doctorSession, true),
    body: JSON.stringify({
      subjective: 'Patient reports fever and dry cough for two days.',
      objective: 'Alert and oriented. Speaking in full sentences.',
      assessment: 'Likely uncomplicated viral upper respiratory infection.',
      plan: 'Hydration, rest, and return precautions reviewed.',
    }),
  })
  expectStatus({
    actual: soapNoteResponse.status,
    expected: 200,
    label: `PUT /doctor/appointments/${appointmentId}/soap-note (doctor)`,
    details: soapNoteResponse.text,
  })

  const prescriptionsResponse = await request(`/doctor/appointments/${appointmentId}/prescriptions`, {
    method: 'PUT',
    headers: authHeaders(doctorSession, true),
    body: JSON.stringify({
      prescriptions: [
        {
          medication: 'Paracetamol',
          dosage: '500 mg',
          frequency: 'Every 6 hours as needed',
          durationDays: 3,
          instructions: 'Take after meals if needed for fever.',
        },
      ],
    }),
  })
  expectStatus({
    actual: prescriptionsResponse.status,
    expected: 200,
    label: `PUT /doctor/appointments/${appointmentId}/prescriptions (doctor)`,
    details: prescriptionsResponse.text,
  })

  const medicationSearchResponse = await request('/doctor/medications/search?q=para', {
    method: 'GET',
    headers: authHeaders(doctorSession),
  })
  expectStatus({
    actual: medicationSearchResponse.status,
    expected: 200,
    label: 'GET /doctor/medications/search?q=para (doctor)',
    details: medicationSearchResponse.text,
  })

  const frequentPrescriptionsResponse = await request('/doctor/prescriptions/frequent', {
    method: 'GET',
    headers: authHeaders(doctorSession),
  })
  expectStatus({
    actual: frequentPrescriptionsResponse.status,
    expected: 200,
    label: 'GET /doctor/prescriptions/frequent (doctor)',
    details: frequentPrescriptionsResponse.text,
  })

  const adminFrequentPrescriptionsResponse = await request(
    `/doctor/prescriptions/frequent?doctorId=${bookingSetup.doctorId}`,
    {
      method: 'GET',
      headers: authHeaders(adminSession),
    }
  )
  expectStatus({
    actual: adminFrequentPrescriptionsResponse.status,
    expected: 200,
    label: `GET /doctor/prescriptions/frequent?doctorId=${bookingSetup.doctorId} (admin)`,
    details: adminFrequentPrescriptionsResponse.text,
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

  const symptomsResponse = await request('/symptoms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'I have fever and cough for two days.',
      isIdentified: false,
      userRole: 'guest',
    }),
  })
  expectStatus({
    actual: symptomsResponse.status,
    expected: 200,
    label: 'POST /symptoms',
    details: symptomsResponse.text,
  })

  const ledgerResponse = await request('/ledger', {
    method: 'GET',
    headers: authHeaders(adminSession),
  })
  expectStatus({
    actual: ledgerResponse.status,
    expected: 200,
    label: 'GET /ledger (admin)',
    details: ledgerResponse.text,
  })

  const auditLogsResponse = await request('/admin/audit-logs', {
    method: 'GET',
    headers: authHeaders(adminSession),
  })
  expectStatus({
    actual: auditLogsResponse.status,
    expected: 200,
    label: 'GET /admin/audit-logs (admin)',
    details: auditLogsResponse.text,
  })

  const errorLogsResponse = await request('/admin/error-logs', {
    method: 'GET',
    headers: authHeaders(adminSession),
  })
  expectStatus({
    actual: errorLogsResponse.status,
    expected: 200,
    label: 'GET /admin/error-logs (admin)',
    details: errorLogsResponse.text,
  })

  const auditDownloadResponse = await request('/admin/audit-logs/download', {
    method: 'GET',
    headers: authHeaders(adminSession),
  })
  expectStatus({
    actual: auditDownloadResponse.status,
    expected: 200,
    label: 'GET /admin/audit-logs/download (admin)',
    details: auditDownloadResponse.contentType,
  })

  const errorLogCount = Array.isArray(errorLogsResponse.json?.logs) ? errorLogsResponse.json.logs.length : 0
  if (errorLogCount > 0) {
    const errorDownloadResponse = await request('/admin/error-logs/download', {
      method: 'GET',
      headers: authHeaders(adminSession),
    })
    expectStatus({
      actual: errorDownloadResponse.status,
      expected: 200,
      label: 'GET /admin/error-logs/download (admin)',
      details: errorDownloadResponse.contentType,
    })
  } else {
    skipCheck('GET /admin/error-logs/download', 'no error logs exist in this environment yet')
  }

  const systemBackupResponse = await request('/admin/backups/system', {
    method: 'GET',
    headers: authHeaders(adminSession),
  })
  expectStatus({
    actual: systemBackupResponse.status,
    expected: 200,
    label: 'GET /admin/backups/system (admin)',
    details: systemBackupResponse.contentType,
  })

  const archiveAppointmentsResponse = await request('/admin/archive/appointments', {
    method: 'POST',
    headers: authHeaders(adminSession, true),
    body: JSON.stringify({ dry: true, days: 1 }),
  })
  expectStatus({
    actual: archiveAppointmentsResponse.status,
    expected: 200,
    label: 'POST /admin/archive/appointments (admin)',
    details: archiveAppointmentsResponse.text,
  })

  const doctorApplicationApproveEmail = createUniqueEmail('smoke.doctor.approve', 'clinic.test')
  const doctorApplicationRejectEmail = createUniqueEmail('smoke.doctor.reject', 'clinic.test')
  await registerDoctorApplication('approve', { email: doctorApplicationApproveEmail })
  await registerDoctorApplication('reject', { email: doctorApplicationRejectEmail })

  const staffApplicationsResponse = await request('/admin/staff-applications', {
    method: 'GET',
    headers: authHeaders(adminSession),
  })
  expectStatus({
    actual: staffApplicationsResponse.status,
    expected: 200,
    label: 'GET /admin/staff-applications (admin)',
    details: staffApplicationsResponse.text,
  })

  const applications = Array.isArray(staffApplicationsResponse.json?.applications)
    ? staffApplicationsResponse.json.applications
    : []
  const approvableApplication = applications.find((entry) => entry?.email === doctorApplicationApproveEmail)
  const rejectableApplication = applications.find((entry) => entry?.email === doctorApplicationRejectEmail)
  if (!approvableApplication?.id || !rejectableApplication?.id) {
    throw new Error('GET /admin/staff-applications (admin): missing newly registered doctor applications')
  }

  const licenseViewResponse = await request(
    `/admin/staff-applications/${approvableApplication.id}/license`,
    {
      method: 'GET',
      headers: authHeaders(adminSession),
    }
  )
  expectStatus({
    actual: licenseViewResponse.status,
    expected: 200,
    label: `GET /admin/staff-applications/${approvableApplication.id}/license (admin)`,
    details: licenseViewResponse.contentType,
  })

  const approveStaffResponse = await request(
    `/admin/staff-applications/${approvableApplication.id}/approve`,
    {
      method: 'PATCH',
      headers: authHeaders(adminSession, true),
      body: JSON.stringify({}),
    }
  )
  expectStatus({
    actual: approveStaffResponse.status,
    expected: 200,
    label: `PATCH /admin/staff-applications/${approvableApplication.id}/approve (admin)`,
    details: approveStaffResponse.text,
  })

  const rejectStaffResponse = await request(
    `/admin/staff-applications/${rejectableApplication.id}/reject`,
    {
      method: 'DELETE',
      headers: authHeaders(adminSession, true),
    }
  )
  expectStatus({
    actual: rejectStaffResponse.status,
    expected: 200,
    label: `DELETE /admin/staff-applications/${rejectableApplication.id}/reject (admin)`,
    details: rejectStaffResponse.text,
  })

  const updateUserResponse = await request(`/admin/users/${approvableApplication.id}`, {
    method: 'PUT',
    headers: authHeaders(adminSession, true),
    body: JSON.stringify({
      status: 'active',
      department: 'Cardiology',
    }),
  })
  expectStatus({
    actual: updateUserResponse.status,
    expected: 200,
    label: `PUT /admin/users/${approvableApplication.id} (admin)`,
    details: updateUserResponse.text,
  })

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

  if (skippedChecks.length > 0) {
    console.log(`[info] Skipped ${skippedChecks.length} route checks.`)
  }

  console.log('[done] Route smoke checks passed.')
}

run().catch((error) => {
  console.error('[fail] Route smoke check failed:', error.message)
  process.exit(1)
})

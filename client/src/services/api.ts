import type {
  AlertAuditAction,
  AppointmentUpdateDraft,
  AccessRequest,
  AuthSession,
  LedgerEntry,
  LoginOtpChallenge,
  Reservation,
  ReservationDraft,
  SignupDraft,
} from '../types'
import {
  aiAlertAuditResponseSchema,
  accessRequestsResponseSchema,
  authSessionSchema,
  authUserSchema,
  loginOtpChallengeSchema,
  parseApiSchema,
} from '../schemas/apiSchemas'
import { normalizeRoleForSession } from '../utils/dashboardRoutes'

const resolveApiBase = () => {
  const configured = String(import.meta.env.VITE_API_URL ?? '/api').trim()
  if (!configured) return '/api'

  // In dev, if API URL points back to frontend origin (ex: localhost:5173),
  // redirect API calls straight to backend origin.
  if (typeof window !== 'undefined') {
    try {
      const absolute = new URL(configured, window.location.origin)
      if (absolute.origin === window.location.origin) {
        const pathOnly = absolute.pathname.replace(/\/$/, '') || '/api'
        // In local Vite dev, default directly to backend origin to avoid proxy mismatch.
        const isLocalDev = window.location.hostname === 'localhost' && window.location.port === '5173'
        if (isLocalDev) {
          return `http://localhost:5000${pathOnly}`
        }
        return pathOnly
      }
    } catch {
      // keep configured value below
    }
  }

  return configured.replace(/\/$/, '')
}

const API_BASE = resolveApiBase()
let authToken: string | null = null
const NETWORK_ERROR_MESSAGE =
  'Cannot reach API server. Start the backend and verify your API URL.'
const EMPTY_LEDGER: LedgerEntry[] = []

export const setAuthToken = (token: string | null) => {
  authToken = token
}

const handleResponse = async (response: Response): Promise<unknown> => {
  if (!response.ok) {
    // Try JSON first
    const errorJson = await response.json().catch(() => null)
    let message: string | null = null
    if (errorJson) {
      if (typeof errorJson === 'string') message = errorJson
      else message = (errorJson && (errorJson.message || errorJson.error)) || null
      if (!message && Array.isArray((errorJson as any)?.errors)) {
        message = (errorJson as any).errors.map((e: any) => e.msg || e.message).join('; ')
      }
    }

    // fallback to text if JSON didn't provide a message
    if (!message) {
      const text = await response.text().catch(() => '')
      if (text) message = text
    }

    if (!message) message = 'Request failed'
    throw new Error(message)
  }
  return response.json() as Promise<unknown>
}

const emptyDoctorScheduleDays = (): DoctorScheduleDays => ({
  monday: { morning: false, afternoon: false },
  tuesday: { morning: false, afternoon: false },
  wednesday: { morning: false, afternoon: false },
  thursday: { morning: false, afternoon: false },
  friday: { morning: false, afternoon: false },
  saturday: { morning: false, afternoon: false },
  sunday: { morning: false, afternoon: false },
})

const normalizeDoctorScheduleDays = (value: unknown): DoctorScheduleDays => {
  const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const normalized = emptyDoctorScheduleDays()

  for (const dayKey of Object.keys(normalized) as Array<keyof DoctorScheduleDays>) {
    const raw = source[dayKey] && typeof source[dayKey] === 'object'
      ? (source[dayKey] as Record<string, unknown>)
      : {}
    normalized[dayKey] = {
      morning: Boolean(raw.morning),
      afternoon: Boolean(raw.afternoon),
    }
  }

  return normalized
}

const withAuth = (init?: RequestInit): RequestInit => {
  const headers = new Headers(init?.headers)
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }
  return { ...init, headers, credentials: 'include' as RequestCredentials }
}

const request = async (url: string, init?: RequestInit) => {
  try {
    // Ensure cross-origin cookies are included when the API sets auth cookies
    const options: RequestInit = { credentials: 'include' as RequestCredentials, ...init }
    return await fetch(url, options)
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE)
  }
}

const readErrorMessage = async (response: Response) => {
  const errorJson = await response.json().catch(() => null)
  if (errorJson) {
    if (typeof errorJson === 'string') return errorJson
    if (typeof (errorJson as any)?.message === 'string') return (errorJson as any).message
    if (typeof (errorJson as any)?.error === 'string') return (errorJson as any).error
  }
  const text = await response.text().catch(() => '')
  return text || 'Request failed'
}

const downloadEncryptedFile = async (path: string, fallbackFilename: string) => {
  const response = await request(path, withAuth())
  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }

  if (typeof window === 'undefined') return

  const blob = await response.blob()
  const contentDisposition = response.headers.get('content-disposition') || ''
  const filenameMatch = /filename="?([^";]+)"?/i.exec(contentDisposition)
  const filename = filenameMatch?.[1] || fallbackFilename

  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(url)
}

const mapApiStatusToReservationStatus = (
  value: unknown
): Reservation['status'] => {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'completed') return 'Recorded'
  if (normalized === 'cancelled') return 'Failed'
  if (normalized === 'confirmed' || normalized === 'pending') return 'Booked'
  return 'Booked'
}

const mapReservationStatusToApiStatus = (
  value: Reservation['status']
): 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled' => {
  if (value === 'Recorded') return 'Completed'
  if (value === 'Failed') return 'Cancelled'
  return 'Confirmed'
}

const inferPriority = (raw: Record<string, unknown>): Reservation['priority'] => {
  const direct = String(raw.priority || '').trim().toLowerCase()
  if (direct === 'high' || direct === 'routine' || direct === 'low') {
    return (direct.charAt(0).toUpperCase() + direct.slice(1)) as Reservation['priority']
  }

  const text = String(raw.reason || raw.summary || raw.symptoms || '').toLowerCase()
  if (
    text.includes('urgent') ||
    text.includes('severe') ||
    text.includes('chest pain') ||
    text.includes('shortness of breath')
  ) {
    return 'High'
  }
  if (text.includes('follow-up') || text.includes('routine')) {
    return 'Routine'
  }
  return 'Routine'
}

const normalizeAppointmentToReservation = (item: unknown): Reservation => {
  const raw = (item ?? {}) as Record<string, unknown>
  const requestedTime =
    String(raw.requestedTime || raw.scheduledDate || raw.createdAt || new Date().toISOString())
  const createdAt = String(raw.createdAt || requestedTime || new Date().toISOString())
  const summary = String(raw.summary || raw.reason || raw.symptoms || 'General consultation')
  const patientName = String(raw.patientName || '').trim() || 'Patient'
  const soapRaw =
    raw.soapNote && typeof raw.soapNote === 'object'
      ? (raw.soapNote as Record<string, unknown>)
      : null
  const prescriptionsRaw = Array.isArray(raw.prescriptions) ? raw.prescriptions : []

  return {
    id: String(raw.id || raw._id || ''),
    patientId: raw.patientId ? String(raw.patientId) : undefined,
    patientName,
    doctorId: raw.doctorId ? String(raw.doctorId) : undefined,
    doctorName: raw.doctorName ? String(raw.doctorName) : undefined,
    symptoms: String(raw.symptoms || raw.reason || summary),
    department: String(raw.department || 'General Medicine'),
    priority: inferPriority(raw),
    confidence: Number(raw.confidence) > 0 ? Number(raw.confidence) : 0.8,
    requestedTime,
    createdAt,
    status: mapApiStatusToReservationStatus(raw.status),
    summary,
    soapNote: soapRaw
      ? {
          subjective: String(soapRaw.subjective || ''),
          objective: String(soapRaw.objective || ''),
          assessment: String(soapRaw.assessment || ''),
          plan: String(soapRaw.plan || ''),
          updatedAt: soapRaw.updatedAt ? String(soapRaw.updatedAt) : undefined,
        }
      : undefined,
    prescriptions: prescriptionsRaw.map((entry) => {
      const rec = (entry ?? {}) as Record<string, unknown>
      return {
        medication: String(rec.medication || ''),
        dosage: String(rec.dosage || ''),
        frequency: rec.frequency ? String(rec.frequency) : undefined,
        durationDays: typeof rec.durationDays === 'number' ? rec.durationDays : undefined,
        instructions: rec.instructions ? String(rec.instructions) : undefined,
        createdAt: rec.createdAt ? String(rec.createdAt) : undefined,
      }
    }).filter((entry) => entry.medication && entry.dosage),
  }
}

const buildLedgerEntry = (reservation: Reservation): LedgerEntry => {
  const ts = Date.now().toString(16)
  return {
    id: `LEDGER-${reservation.id}-${ts}`,
    reservationId: reservation.id,
    patientName: reservation.patientName,
    department: reservation.department,
    timestamp: new Date().toISOString(),
    hash: `0x${ts.padStart(16, '0')}`,
    txStatus: 'skipped',
  }
}

type UserProfilePayload = {
  firstName?: string
  lastName?: string
  dateOfBirth?: string
  phoneNumber?: string
  address?: string
  gender?: string
}

type PersonalHealthInfoPayload = {
  bloodType?: string
  allergies?: string[]
  medications?: string[]
  chronicConditions?: string[]
  surgeries?: string[]
  notes?: string
  emergencyContact?: {
    name?: string
    phone?: string
    relationship?: string
  }
}

type StaffSignupPayload = {
  email: string
  password: string
  fullName: string
  department: string
  licenseFiles: File[]
}

export type DoctorAvailability = {
  id: string
  firstName: string
  lastName: string
  email: string
  department: string
}

export type DoctorScheduleDay = {
  morning: boolean
  afternoon: boolean
}

export type DoctorScheduleDays = {
  monday: DoctorScheduleDay
  tuesday: DoctorScheduleDay
  wednesday: DoctorScheduleDay
  thursday: DoctorScheduleDay
  friday: DoctorScheduleDay
  saturday: DoctorScheduleDay
  sunday: DoctorScheduleDay
}

export type DoctorWeeklySchedule = {
  id?: string
  doctorId: string
  weekStart: string
  timezone: string
  hasSchedule: boolean
  hasEnabledSession: boolean
  days: DoctorScheduleDays
  weeklySlots: Record<string, Array<{
    startIso: string
    endIso: string
    label: string
    session: 'morning' | 'afternoon'
  }>>
}

export type DoctorAvailableSlot = {
  startIso: string
  endIso: string
  label: string
  session: 'morning' | 'afternoon'
  isBooked: boolean
  isPast: boolean
  isAvailable: boolean
}

export type DoctorDaySlotAvailability = {
  doctorId: string
  date: string
  weekStart: string
  dayKey: keyof DoctorScheduleDays
  timezone: string
  hasWeekSchedule: boolean
  daySessions: DoctorScheduleDay
  slots: DoctorAvailableSlot[]
  availableCount: number
}

export type AdminUserRecord = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'user' | 'doctor' | 'admin' | 'system_admin'
  status: 'active' | 'disabled'
  department?: string
  profile?: {
    dateOfBirth?: string
    phoneNumber?: string
    address?: string
    gender?: string
  }
}

export type AdminStaffApplicationRecord = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'doctor'
  status: 'active' | 'disabled'
  department?: string
  hasLicenseFile: boolean
}

export type AdminAuditLogRecord = {
  id: string
  userId?: string
  action: string
  details?: string
  ipAddress?: string
  userAgent?: string
  timestamp: string
}

export type AdminErrorLogRecord = {
  id: string
  message: string
  stack?: string
  route?: string
  method?: string
  userId?: string
  ipAddress?: string
  userAgent?: string
  timestamp: string
}

export type DoctorQueueStatus = 'Waiting' | 'Arrived' | 'In-Consultation' | 'Checked-Out' | 'No-Show'

export type DoctorDashboardOverview = {
  counter: {
    total: number
    completed: number
    pending: number
    noShows: number
  }
  nextPatient: {
    appointmentId: string
    patientId: string
    patientName: string
    chiefComplaint: string
    scheduledDate: string
    countdownSeconds: number
  } | null
  urgencyFlags: Array<{
    appointmentId: string
    patientId: string
    patientName: string
    triageLevel: 'Low' | 'Routine' | 'High'
    urgentFollowUp: boolean
    queueStatus: DoctorQueueStatus
  }>
}

export type DoctorQueueTimelineItem = {
  appointmentId: string
  patientId: string
  patientName: string
  scheduledDate: string
  department: string
  chiefComplaint: string
  triageLevel: 'Low' | 'Routine' | 'High'
  urgentFollowUp: boolean
  queueStatus: DoctorQueueStatus
  checkupHistory: Array<{
    visitDate: string
    primaryDiagnosis: string
  }>
}

export type SoapNotePayload = {
  subjective: string
  objective: string
  assessment: string
  plan: string
}

export type PrescriptionDraft = {
  medication: string
  dosage: string
  frequency?: string
  durationDays?: number
  instructions?: string
}

export type DoctorPatientProfile = {
  patient: {
    id: string
    firstName: string
    lastName: string
    email: string
    status?: string
    dateOfBirth?: string
    phoneNumber?: string
    address?: string
    gender?: string
  }
  personalHealthInfo: {
    bloodType?: string
    allergies: string[]
    medications: string[]
    chronicConditions: string[]
    surgeries: string[]
    notes?: string
    emergencyContact?: {
      name?: string
      phone?: string
      relationship?: string
    }
  }
}

export type AssistantChatResponse = {
  reply: string
  meta?: {
    model?: string
    usedFallback?: boolean
    fallbackReason?: string
    triage?: {
      code?: string
      outcome?: {
        title?: string
        text?: string
      } | null
    }
    matches?: Array<{
      disease: string
      score: number
      matchedSymptoms: string[]
    }>
  }
}

export const api = {
  login: async (username: string, password: string): Promise<AuthSession | LoginOtpChallenge> => {
    const response = await request(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: username, password }),
    })
    const payload = await handleResponse(response)

    // Server returns an OTP challenge when 2FA is required
    if ((payload as any)?.requires2FA) {
      const challenge: LoginOtpChallenge = {
        challengeId: (payload as any).userId,
        username,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        expiresInSeconds: 10 * 60,
        otpPreview:
          typeof (payload as any).otpPreview === 'string'
            ? (payload as any).otpPreview
            : undefined,
      }
      return parseApiSchema(loginOtpChallengeSchema, challenge, 'OTP challenge')
    }

    // Otherwise expect a full auth session (token + user)
    // Map server user shape to client schema if necessary
    const payloadUser = (payload as Record<string, unknown>)?.user as Record<string, unknown> | undefined
    const mapped = {
      token: (payload as any).token,
      user: {
        username: (payloadUser?.email as string | undefined) ?? username,
        firstName: (payloadUser?.firstName as string | undefined) ?? undefined,
        lastName: (payloadUser?.lastName as string | undefined) ?? undefined,
        role: normalizeRoleForSession(
          payloadUser?.role as string | undefined,
          payloadUser?.accountType as string | undefined
        ),
        accountType: (payloadUser?.accountType as string | undefined) ?? undefined,
        authMethod: (payloadUser?.authMethod as string | undefined) ?? undefined,
        mfa: (payloadUser?.mfa as boolean | undefined) ?? undefined,
        sessionId: (payloadUser?.sessionId as string | undefined) ?? undefined,
      },
    }
    return parseApiSchema(authSessionSchema, mapped, 'login')
  },
  requestOtpChallenge: async (username: string, password: string): Promise<LoginOtpChallenge> => {
    const response = await request(`${API_BASE}/auth/otp/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const payload = await handleResponse(response)
    return parseApiSchema(loginOtpChallengeSchema, payload, 'OTP challenge')
  },
  verifyOtpLogin: async (challengeId: string, code: string): Promise<AuthSession> => {
    // Server expects { userId, otp }
    const response = await request(`${API_BASE}/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: challengeId, otp: code }),
    })
    const payload = await handleResponse(response)

    // Map server response to client authSession shape
    const payloadUser = (payload as Record<string, unknown>)?.user as Record<string, unknown> | undefined
    const mapped = {
      token: (payload as any).token,
      user: {
        username:
          (payloadUser?.email as string | undefined) ??
          (payloadUser?.username as string | undefined) ??
          '',
        firstName: (payloadUser?.firstName as string | undefined) ?? undefined,
        lastName: (payloadUser?.lastName as string | undefined) ?? undefined,
        role: normalizeRoleForSession(
          payloadUser?.role as string | undefined,
          payloadUser?.accountType as string | undefined
        ),
        accountType: (payloadUser?.accountType as string | undefined) ?? undefined,
        authMethod: (payloadUser?.authMethod as string | undefined) ?? undefined,
        mfa: (payloadUser?.mfa as boolean | undefined) ?? undefined,
        sessionId: (payloadUser?.sessionId as string | undefined) ?? undefined,
      },
    }
    return parseApiSchema(authSessionSchema, mapped, 'OTP verification')
  },
  resendOtp: async (userId: string): Promise<void> => {
    const response = await request(`${API_BASE}/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    await handleResponse(response)
  },
  signup: async (draft: SignupDraft): Promise<void> => {
    const safeEmail = draft.email ?? draft.username ?? ''
    const safeFullName = draft.fullName ?? ''
    const firstName = safeFullName.split(' ')[0] || (safeEmail.split('@')[0] || '')
    const lastName = safeFullName.split(' ').slice(1).join(' ') || 'User'

    const response = await request(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: safeEmail,
        password: draft.password,
        firstName,
        lastName,
      }),
    })
    await handleResponse(response)
  },
  signupDoctor: async (payload: StaffSignupPayload): Promise<void> => {
    const [firstNameRaw, ...rest] = payload.fullName.trim().split(' ')
    const firstName = firstNameRaw || payload.email.split('@')[0] || ''
    const lastName = rest.join(' ') || 'User'

    const body = new FormData()
    body.append('email', payload.email)
    body.append('password', payload.password)
    body.append('firstName', firstName)
    body.append('lastName', lastName)
    body.append('department', payload.department)
    for (const file of payload.licenseFiles) {
      body.append('licenses', file)
    }

    const response = await request(`${API_BASE}/register/doctor`, {
      method: 'POST',
      body,
    })
    await handleResponse(response)
  },
  getSession: async (): Promise<AuthSession['user']> => {
    const response = await request(`${API_BASE}/session`, withAuth())
    const payload = await handleResponse(response)
    const payloadRecord = payload as Record<string, unknown>
    const mapped = {
      username:
        (payloadRecord.username as string | undefined) ??
        (payloadRecord.email as string | undefined) ??
        '',
      firstName: (payloadRecord.firstName as string | undefined) ?? undefined,
      lastName: (payloadRecord.lastName as string | undefined) ?? undefined,
      role: normalizeRoleForSession(
        payloadRecord.role as string | undefined,
        payloadRecord.accountType as string | undefined
      ),
      accountType: (payloadRecord.accountType as string | undefined) ?? undefined,
      authMethod: (payloadRecord.authMethod as string | undefined) ?? undefined,
      mfa: (payloadRecord.mfa as boolean | undefined) ?? undefined,
      sessionId:
        (payloadRecord.sessionId as string | null | undefined) ??
        (payloadRecord.sessionID as string | null | undefined) ??
        undefined,
    }
    return parseApiSchema(authUserSchema, mapped, 'session')
  },
  getReservations: async (): Promise<Reservation[]> => {
    return api.getAppointments()
  },
  getUserSettings: async (): Promise<{ notifications: { email: boolean; sms: boolean; push: boolean } }> => {
    const response = await request(`${API_BASE}/users/me/settings`, withAuth())
    const payload = await handleResponse(response as Response)
    return (payload as any).settings ?? { notifications: { email: true, sms: false, push: true } }
  },
  updateUserSettings: async (settings: any) => {
    const response = await request(
      `${API_BASE}/users/me/settings`,
      withAuth({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
    )
    const payload = await handleResponse(response as Response)
    return (payload as any).settings
  },
  updateProfile: async (payload: { name?: string; firstName?: string; lastName?: string }) => {
    const response = await request(
      `${API_BASE}/users/me/profile`,
      withAuth({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    )
    const result = await handleResponse(response as Response)
    const userPayload =
      (result as Record<string, unknown>)?.profile as Record<string, unknown> | undefined
    return {
      username:
        (userPayload?.username as string | undefined) ??
        (userPayload?.email as string | undefined) ??
        '',
      firstName: (userPayload?.firstName as string | undefined) ?? '',
      lastName: (userPayload?.lastName as string | undefined) ?? '',
      role: normalizeRoleForSession(
        userPayload?.role as string | undefined,
        userPayload?.accountType as string | undefined
      ),
      accountType: (userPayload?.accountType as string | undefined) ?? undefined,
    }
  },
  getMyProfile: async (): Promise<{
    profile: UserProfilePayload
    personalHealthInfo: PersonalHealthInfoPayload
  }> => {
    const response = await request(`${API_BASE}/users/me/profile`, withAuth())
    const payload = (await handleResponse(response as Response)) as Record<string, unknown>

    const profile = ((payload.profile as Record<string, unknown> | undefined) ?? {})
    const personalHealthInfo =
      ((payload.personalHealthInfo as Record<string, unknown> | undefined) ?? {})

    return {
      profile: {
        firstName: typeof profile.firstName === 'string' ? profile.firstName : undefined,
        lastName: typeof profile.lastName === 'string' ? profile.lastName : undefined,
        dateOfBirth:
          typeof profile.dateOfBirth === 'string'
            ? profile.dateOfBirth
            : profile.dateOfBirth instanceof Date
              ? profile.dateOfBirth.toISOString()
              : undefined,
        phoneNumber: typeof profile.phoneNumber === 'string' ? profile.phoneNumber : undefined,
        address: typeof profile.address === 'string' ? profile.address : undefined,
        gender: typeof profile.gender === 'string' ? profile.gender : undefined,
      },
      personalHealthInfo: {
        bloodType:
          typeof personalHealthInfo.bloodType === 'string' ? personalHealthInfo.bloodType : undefined,
        allergies: Array.isArray(personalHealthInfo.allergies)
          ? personalHealthInfo.allergies.map((item) => String(item))
          : [],
        medications: Array.isArray(personalHealthInfo.medications)
          ? personalHealthInfo.medications.map((item) => String(item))
          : [],
        chronicConditions: Array.isArray(personalHealthInfo.chronicConditions)
          ? personalHealthInfo.chronicConditions.map((item) => String(item))
          : [],
        surgeries: Array.isArray(personalHealthInfo.surgeries)
          ? personalHealthInfo.surgeries.map((item) => String(item))
          : [],
        notes: typeof personalHealthInfo.notes === 'string' ? personalHealthInfo.notes : undefined,
        emergencyContact:
          personalHealthInfo.emergencyContact &&
          typeof personalHealthInfo.emergencyContact === 'object'
            ? {
                name:
                  typeof (personalHealthInfo.emergencyContact as Record<string, unknown>).name ===
                  'string'
                    ? ((personalHealthInfo.emergencyContact as Record<string, unknown>).name as string)
                    : undefined,
                phone:
                  typeof (personalHealthInfo.emergencyContact as Record<string, unknown>).phone ===
                  'string'
                    ? ((personalHealthInfo.emergencyContact as Record<string, unknown>).phone as string)
                    : undefined,
                relationship:
                  typeof (personalHealthInfo.emergencyContact as Record<string, unknown>).relationship ===
                  'string'
                    ? ((personalHealthInfo.emergencyContact as Record<string, unknown>)
                        .relationship as string)
                    : undefined,
              }
            : undefined,
      },
    }
  },
  saveMyProfile: async (payload: UserProfilePayload) => {
    const response = await request(
      `${API_BASE}/users/me/profile`,
      withAuth({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    )
    await handleResponse(response as Response)
  },
  savePersonalHealthInfo: async (payload: PersonalHealthInfoPayload) => {
    const response = await request(
      `${API_BASE}/users/me/personal-health-info`,
      withAuth({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    )
    await handleResponse(response as Response)
  },
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    try {
      await handleResponse(
        await request(
          `${API_BASE}/users/me/password`,
          withAuth({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword, newPassword }),
          })
        )
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to change password.'
      if (/cannot|not found|failed/i.test(message)) {
        throw new Error('Password change is not available on this server yet.')
      }
      throw error
    }
  },
  getAppointments: async (): Promise<Reservation[]> => {
    const payload = await handleResponse(await request(`${API_BASE}/appointments`, withAuth()))
    const appointments = Array.isArray((payload as any)?.appointments)
      ? (payload as any).appointments
      : []
    return appointments.map((item: unknown) => normalizeAppointmentToReservation(item))
  },
  getAdminUsers: async (): Promise<AdminUserRecord[]> => {
    const payload = await handleResponse(await request(`${API_BASE}/users`, withAuth()))
    const users = Array.isArray(payload) ? payload : []
    return users.map((item) => {
      const raw = (item ?? {}) as Record<string, unknown>
      const profile = ((raw.profile as Record<string, unknown> | undefined) ?? {})
      return {
        id: String(raw._id || raw.id || ''),
        email: String(raw.email || ''),
        firstName: String(raw.firstName || ''),
        lastName: String(raw.lastName || ''),
        role: String(raw.role || 'user') as AdminUserRecord['role'],
        status: raw.status === 'disabled' ? 'disabled' : 'active',
        department: raw.department ? String(raw.department) : undefined,
        profile: {
          dateOfBirth:
            typeof profile.dateOfBirth === 'string'
              ? profile.dateOfBirth
              : profile.dateOfBirth instanceof Date
                ? profile.dateOfBirth.toISOString()
                : undefined,
          phoneNumber: typeof profile.phoneNumber === 'string' ? profile.phoneNumber : undefined,
          address: typeof profile.address === 'string' ? profile.address : undefined,
          gender: typeof profile.gender === 'string' ? profile.gender : undefined,
        },
      }
    })
  },
  getPendingStaffApplications: async (
    role: 'all' | 'doctor' = 'all'
  ): Promise<AdminStaffApplicationRecord[]> => {
    const payload = (await handleResponse(
      await request(
        `${API_BASE}/admin/staff-applications?role=${encodeURIComponent(role)}`,
        withAuth()
      )
    )) as Record<string, unknown>
    const applications = Array.isArray(payload.applications) ? payload.applications : []
    return applications.map((item) => {
      const raw = (item ?? {}) as Record<string, unknown>
      return {
        id: String(raw.id || raw._id || ''),
        email: String(raw.email || ''),
        firstName: String(raw.firstName || ''),
        lastName: String(raw.lastName || ''),
        role: 'doctor',
        status: raw.status === 'active' ? 'active' : 'disabled',
        department: raw.department ? String(raw.department) : undefined,
        hasLicenseFile: Boolean(raw.hasLicenseFile),
      }
    })
  },
  approveStaffApplication: async (userId: string): Promise<AdminUserRecord> => {
    const payload = (await handleResponse(
      await request(
        `${API_BASE}/admin/staff-applications/${encodeURIComponent(userId)}/approve`,
        withAuth({ method: 'PATCH' })
      )
    )) as Record<string, unknown>
    const user = (payload.user as Record<string, unknown> | undefined) ?? {}
    return {
      id: String(user.id || user._id || ''),
      email: String(user.email || ''),
      firstName: String(user.firstName || ''),
      lastName: String(user.lastName || ''),
      role: String(user.role || 'user') as AdminUserRecord['role'],
      status: user.status === 'active' ? 'active' : 'disabled',
      department: user.department ? String(user.department) : undefined,
    }
  },
  rejectStaffApplication: async (userId: string): Promise<void> => {
    await handleResponse(
      await request(
        `${API_BASE}/admin/staff-applications/${encodeURIComponent(userId)}/reject`,
        withAuth({ method: 'DELETE' })
      )
    )
  },
  getStaffApplicationLicenseUrl: (userId: string): string =>
    `${API_BASE}/admin/staff-applications/${encodeURIComponent(userId)}/license`,
  updateAdminUser: async (
    userId: string,
    updates: { role?: AdminUserRecord['role']; status?: AdminUserRecord['status']; department?: string }
  ): Promise<AdminUserRecord> => {
    const response = await request(
      `${API_BASE}/admin/users/${encodeURIComponent(userId)}`,
      withAuth({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
    )
    const payload = (await handleResponse(response as Response)) as Record<string, unknown>
    const user = (payload.user as Record<string, unknown> | undefined) ?? {}
    return {
      id: String(user._id || user.id || ''),
      email: String(user.email || ''),
      firstName: String(user.firstName || ''),
      lastName: String(user.lastName || ''),
      role: String(user.role || 'user') as AdminUserRecord['role'],
      status: user.status === 'disabled' ? 'disabled' : 'active',
      department: user.department ? String(user.department) : undefined,
      profile:
        user.profile && typeof user.profile === 'object'
          ? {
              dateOfBirth:
                typeof (user.profile as Record<string, unknown>).dateOfBirth === 'string'
                  ? ((user.profile as Record<string, unknown>).dateOfBirth as string)
                  : undefined,
              phoneNumber:
                typeof (user.profile as Record<string, unknown>).phoneNumber === 'string'
                  ? ((user.profile as Record<string, unknown>).phoneNumber as string)
                  : undefined,
              address:
                typeof (user.profile as Record<string, unknown>).address === 'string'
                  ? ((user.profile as Record<string, unknown>).address as string)
                  : undefined,
              gender:
                typeof (user.profile as Record<string, unknown>).gender === 'string'
                  ? ((user.profile as Record<string, unknown>).gender as string)
                  : undefined,
            }
          : undefined,
    }
  },
  getAdminAuditLogs: async (limit = 200): Promise<AdminAuditLogRecord[]> => {
    const payload = (await handleResponse(
      await request(`${API_BASE}/admin/audit-logs?limit=${encodeURIComponent(String(limit))}`, withAuth())
    )) as Record<string, unknown>
    const logs = Array.isArray(payload.logs) ? payload.logs : []
    return logs.map((item) => {
      const raw = (item ?? {}) as Record<string, unknown>
      return {
        id: String(raw._id || raw.id || ''),
        userId: raw.userId ? String(raw.userId) : undefined,
        action: String(raw.action || 'UNKNOWN'),
        details: raw.details ? String(raw.details) : undefined,
        ipAddress: raw.ipAddress ? String(raw.ipAddress) : undefined,
        userAgent: raw.userAgent ? String(raw.userAgent) : undefined,
        timestamp: String(raw.timestamp || new Date(0).toISOString()),
      }
    })
  },
  getAdminErrorLogs: async (limit = 200): Promise<AdminErrorLogRecord[]> => {
    const payload = (await handleResponse(
      await request(`${API_BASE}/admin/error-logs?limit=${encodeURIComponent(String(limit))}`, withAuth())
    )) as Record<string, unknown>
    const logs = Array.isArray(payload.logs) ? payload.logs : []
    return logs.map((item) => {
      const raw = (item ?? {}) as Record<string, unknown>
      return {
        id: String(raw._id || raw.id || ''),
        message: String(raw.message || 'Unknown error'),
        stack: raw.stack ? String(raw.stack) : undefined,
        route: raw.route ? String(raw.route) : undefined,
        method: raw.method ? String(raw.method) : undefined,
        userId: raw.userId ? String(raw.userId) : undefined,
        ipAddress: raw.ipAddress ? String(raw.ipAddress) : undefined,
        userAgent: raw.userAgent ? String(raw.userAgent) : undefined,
        timestamp: String(raw.timestamp || new Date(0).toISOString()),
      }
    })
  },
  downloadAdminAuditBackup: async (): Promise<void> => {
    await downloadEncryptedFile(`${API_BASE}/admin/audit-logs/download`, 'audit_logs_backup.zip.enc')
  },
  downloadAdminErrorBackup: async (): Promise<void> => {
    await downloadEncryptedFile(`${API_BASE}/admin/error-logs/download`, 'error_logs_backup.zip.enc')
  },
  getLedger: async (): Promise<LedgerEntry[]> => {
    try {
      const payload = await handleResponse(await request(`${API_BASE}/ledger`, withAuth()))
      return Array.isArray((payload as any)?.ledger) ? (payload as any).ledger : EMPTY_LEDGER
    } catch {
      return EMPTY_LEDGER
    }
  },
  createReservation: async (
    draft: ReservationDraft
  ): Promise<{ reservation: Reservation; ledgerEntry: LedgerEntry }> => {
    const response = await request(`${API_BASE}/appointments`, withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // map client reservation draft to server appointment fields
        doctorId: draft.doctorId,
        scheduledDate: draft.requestedTime,
        department: draft.summary.department,
        reason: draft.summary.summary,
        // include a lightweight clinical note
        note: draft.summary.summary,
      }),
    }))

    const payload = (await handleResponse(response)) as Record<string, unknown>
    const appointmentId = String((payload.appointment as any)?._id || (payload.appointment as any)?.id || '')

    let reservation = normalizeAppointmentToReservation(payload.appointment)
    if (appointmentId) {
      try {
        const latest = await api.getAppointments()
        const match = latest.find((item) => item.id === appointmentId)
        if (match) {
          reservation = match
        }
      } catch {
        // keep normalized reservation if refresh fails
      }
    }

    return {
      reservation,
      ledgerEntry: buildLedgerEntry(reservation),
    }
  },
  updateAppointment: async (
    id: string,
    updates: AppointmentUpdateDraft
  ): Promise<Reservation> => {
    if (updates.status) {
      await handleResponse(
        await request(
          `${API_BASE}/appointments/${encodeURIComponent(id)}/status`,
          withAuth({
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: mapReservationStatusToApiStatus(updates.status) }),
          })
        )
      )
    }

    const latest = await api.getAppointments()
    const updated = latest.find((item) => item.id === id)
    if (updated) return updated

    throw new Error('Updated appointment was not found.')
  },
  getDoctorDashboardOverview: async (): Promise<DoctorDashboardOverview> => {
    const payload = (await handleResponse(
      await request(`${API_BASE}/doctor/dashboard/overview`, withAuth())
    )) as Record<string, unknown>

    const counterRecord = (payload.counter as Record<string, unknown> | undefined) ?? {}
    const nextRecord = (payload.nextPatient as Record<string, unknown> | null | undefined) ?? null
    const flags = Array.isArray(payload.urgencyFlags) ? payload.urgencyFlags : []

    return {
      counter: {
        total: Number(counterRecord.total) || 0,
        completed: Number(counterRecord.completed) || 0,
        pending: Number(counterRecord.pending) || 0,
        noShows: Number(counterRecord.noShows) || 0,
      },
      nextPatient: nextRecord
        ? {
            appointmentId: String(nextRecord.appointmentId || ''),
            patientId: String(nextRecord.patientId || ''),
            patientName: String(nextRecord.patientName || 'Patient'),
            chiefComplaint: String(nextRecord.chiefComplaint || 'General consultation'),
            scheduledDate: String(nextRecord.scheduledDate || new Date().toISOString()),
            countdownSeconds: Number(nextRecord.countdownSeconds) || 0,
          }
        : null,
      urgencyFlags: flags.map((item) => {
        const raw = (item ?? {}) as Record<string, unknown>
        const status = String(raw.queueStatus || 'Waiting') as DoctorQueueStatus
        return {
          appointmentId: String(raw.appointmentId || ''),
          patientId: String(raw.patientId || ''),
          patientName: String(raw.patientName || 'Patient'),
          triageLevel:
            raw.triageLevel === 'High' ? 'High' : raw.triageLevel === 'Low' ? 'Low' : 'Routine',
          urgentFollowUp: Boolean(raw.urgentFollowUp),
          queueStatus: status,
        }
      }),
    }
  },
  getDoctorQueueTimeline: async (): Promise<DoctorQueueTimelineItem[]> => {
    const payload = (await handleResponse(
      await request(`${API_BASE}/doctor/queue/timeline`, withAuth())
    )) as Record<string, unknown>
    const timeline = Array.isArray(payload.timeline) ? payload.timeline : []
    return timeline.map((item) => {
      const raw = (item ?? {}) as Record<string, unknown>
      const history = Array.isArray(raw.checkupHistory) ? raw.checkupHistory : []
      return {
        appointmentId: String(raw.appointmentId || ''),
        patientId: String(raw.patientId || ''),
        patientName: String(raw.patientName || 'Patient'),
        scheduledDate: String(raw.scheduledDate || new Date().toISOString()),
        department: String(raw.department || 'General Medicine'),
        chiefComplaint: String(raw.chiefComplaint || 'General consultation'),
        triageLevel:
          raw.triageLevel === 'High' ? 'High' : raw.triageLevel === 'Low' ? 'Low' : 'Routine',
        urgentFollowUp: Boolean(raw.urgentFollowUp),
        queueStatus: String(raw.queueStatus || 'Waiting') as DoctorQueueStatus,
        checkupHistory: history.map((entry) => {
          const rec = (entry ?? {}) as Record<string, unknown>
          return {
            visitDate: String(rec.visitDate || new Date(0).toISOString()),
            primaryDiagnosis: String(rec.primaryDiagnosis || 'General consultation'),
          }
        }),
      }
    })
  },
  updateDoctorQueueStatus: async (
    appointmentId: string,
    queueStatus: DoctorQueueStatus
  ): Promise<{ id: string; queueStatus: DoctorQueueStatus; status: string }> => {
    const payload = (await handleResponse(
      await request(
        `${API_BASE}/doctor/appointments/${encodeURIComponent(appointmentId)}/queue-status`,
        withAuth({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queueStatus }),
        })
      )
    )) as Record<string, unknown>

    const appointment = (payload.appointment as Record<string, unknown> | undefined) ?? {}
    return {
      id: String(appointment.id || ''),
      queueStatus: String(appointment.queueStatus || 'Waiting') as DoctorQueueStatus,
      status: String(appointment.status || 'Pending'),
    }
  },
  searchMedications: async (query: string): Promise<Array<{ name: string }>> => {
    const payload = (await handleResponse(
      await request(
        `${API_BASE}/doctor/medications/search?q=${encodeURIComponent(query)}`,
        withAuth()
      )
    )) as Record<string, unknown>
    const meds = Array.isArray(payload.medications) ? payload.medications : []
    return meds.map((item) => ({ name: String((item as Record<string, unknown>).name || '') })).filter((m) => m.name)
  },
  getFrequentPrescriptions: async (): Promise<Array<{ medication: string; count: number }>> => {
    const payload = (await handleResponse(
      await request(`${API_BASE}/doctor/prescriptions/frequent`, withAuth())
    )) as Record<string, unknown>
    const items = Array.isArray(payload.frequentPrescriptions) ? payload.frequentPrescriptions : []
    return items.map((item) => {
      const raw = (item ?? {}) as Record<string, unknown>
      return {
        medication: String(raw.medication || ''),
        count: Number(raw.count) || 0,
      }
    }).filter((item) => item.medication)
  },
  saveAppointmentSoapNote: async (appointmentId: string, note: SoapNotePayload): Promise<void> => {
    await handleResponse(
      await request(
        `${API_BASE}/doctor/appointments/${encodeURIComponent(appointmentId)}/soap-note`,
        withAuth({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(note),
        })
      )
    )
  },
  saveAppointmentPrescriptions: async (
    appointmentId: string,
    prescriptions: PrescriptionDraft[]
  ): Promise<void> => {
    await handleResponse(
      await request(
        `${API_BASE}/doctor/appointments/${encodeURIComponent(appointmentId)}/prescriptions`,
        withAuth({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prescriptions }),
        })
      )
    )
  },
  getAvailableDoctorsByDepartment: async (department: string): Promise<DoctorAvailability[]> => {
    const candidates = [
      `${API_BASE}/appointments/doctors/available?department=${encodeURIComponent(department)}`,
      `${API_BASE}/appointments/available-doctors?department=${encodeURIComponent(department)}`,
      `${API_BASE}/doctor/appointments/doctors/available?department=${encodeURIComponent(department)}`,
    ]
    let payload: Record<string, unknown> | null = null
    let lastError: unknown = null
    for (const url of candidates) {
      try {
        payload = (await handleResponse(await request(url, withAuth()))) as Record<string, unknown>
        break
      } catch (error) {
        lastError = error
      }
    }
    if (!payload) {
      throw (lastError instanceof Error ? lastError : new Error('Failed to load available doctors.'))
    }
    const doctors = Array.isArray(payload.doctors) ? payload.doctors : []
    return doctors.map((item) => {
      const raw = (item ?? {}) as Record<string, unknown>
      return {
        id: String(raw.id || raw._id || ''),
        firstName: String(raw.firstName || ''),
        lastName: String(raw.lastName || ''),
        email: String(raw.email || ''),
        department: String(raw.department || ''),
      }
    }).filter((doctor) => doctor.id)
  },
  getDoctorAvailableSlots: async (
    doctorId: string,
    date: string
  ): Promise<DoctorDaySlotAvailability> => {
    const payload = (await handleResponse(
      await request(
        `${API_BASE}/appointments/doctors/${encodeURIComponent(doctorId)}/slots?date=${encodeURIComponent(date)}`,
        withAuth()
      )
    )) as Record<string, unknown>

    const daySessionsRaw =
      payload.daySessions && typeof payload.daySessions === 'object'
        ? (payload.daySessions as Record<string, unknown>)
        : {}
    const dayKeyRaw = String(payload.dayKey || 'monday').toLowerCase()
    const validDayKeys: Array<keyof DoctorScheduleDays> = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ]
    const dayKey: keyof DoctorScheduleDays = validDayKeys.includes(dayKeyRaw as keyof DoctorScheduleDays)
      ? (dayKeyRaw as keyof DoctorScheduleDays)
      : 'monday'

    const slotsRaw = Array.isArray(payload.slots) ? payload.slots : []
    const slots = slotsRaw.map((item) => {
      const raw = (item ?? {}) as Record<string, unknown>
      const sessionRaw = String(raw.session || 'morning').toLowerCase()
      return {
        startIso: String(raw.startIso || ''),
        endIso: String(raw.endIso || ''),
        label: String(raw.label || ''),
        session: sessionRaw === 'afternoon' ? 'afternoon' : 'morning',
        isBooked: Boolean(raw.isBooked),
        isPast: Boolean(raw.isPast),
        isAvailable: Boolean(raw.isAvailable),
      } as DoctorAvailableSlot
    }).filter((slot) => slot.startIso && slot.endIso && slot.label)

    return {
      doctorId: String(payload.doctorId || doctorId),
      date: String(payload.date || date),
      weekStart: String(payload.weekStart || ''),
      dayKey,
      timezone: String(payload.timezone || 'Asia/Manila'),
      hasWeekSchedule: Boolean(payload.hasWeekSchedule),
      daySessions: {
        morning: Boolean(daySessionsRaw.morning),
        afternoon: Boolean(daySessionsRaw.afternoon),
      },
      slots,
      availableCount: Number(payload.availableCount) || 0,
    }
  },
  getDoctorWeeklySchedule: async (
    weekStart: string,
    options?: { doctorId?: string }
  ): Promise<DoctorWeeklySchedule> => {
    const query = options?.doctorId
      ? `?doctorId=${encodeURIComponent(options.doctorId)}`
      : ''
    const payload = (await handleResponse(
      await request(
        `${API_BASE}/doctor/schedules/${encodeURIComponent(weekStart)}${query}`,
        withAuth()
      )
    )) as Record<string, unknown>

    const scheduleRaw =
      payload.schedule && typeof payload.schedule === 'object'
        ? (payload.schedule as Record<string, unknown>)
        : {}
    const weeklySlotsRaw =
      payload.weeklySlots && typeof payload.weeklySlots === 'object'
        ? (payload.weeklySlots as Record<string, unknown>)
        : {}
    const days = normalizeDoctorScheduleDays(scheduleRaw.days)
    const weeklySlots: DoctorWeeklySchedule['weeklySlots'] = {}

    for (const dayKey of Object.keys(days) as Array<keyof DoctorScheduleDays>) {
      const daySlotsRaw = Array.isArray(weeklySlotsRaw[dayKey]) ? weeklySlotsRaw[dayKey] : []
      weeklySlots[dayKey] = daySlotsRaw.map((item) => {
        const raw = (item ?? {}) as Record<string, unknown>
        const sessionRaw = String(raw.session || 'morning').toLowerCase()
        return {
          startIso: String(raw.startIso || ''),
          endIso: String(raw.endIso || ''),
          label: String(raw.label || ''),
          session: sessionRaw === 'afternoon' ? 'afternoon' : 'morning',
        }
      }).filter((slot) => slot.startIso && slot.endIso && slot.label)
    }

    return {
      id: scheduleRaw.id ? String(scheduleRaw.id) : undefined,
      doctorId: String(scheduleRaw.doctorId || options?.doctorId || ''),
      weekStart: String(scheduleRaw.weekStart || weekStart),
      timezone: String(scheduleRaw.timezone || 'Asia/Manila'),
      hasSchedule: Boolean(scheduleRaw.hasSchedule),
      hasEnabledSession: Boolean(scheduleRaw.hasEnabledSession),
      days,
      weeklySlots,
    }
  },
  saveDoctorWeeklySchedule: async (
    weekStart: string,
    days: DoctorScheduleDays,
    options?: { doctorId?: string }
  ): Promise<DoctorWeeklySchedule> => {
    const payload = (await handleResponse(
      await request(
        `${API_BASE}/doctor/schedules/${encodeURIComponent(weekStart)}`,
        withAuth({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            days,
            ...(options?.doctorId ? { doctorId: options.doctorId } : {}),
          }),
        })
      )
    )) as Record<string, unknown>

    const scheduleRaw =
      payload.schedule && typeof payload.schedule === 'object'
        ? (payload.schedule as Record<string, unknown>)
        : {}
    const weeklySlotsRaw =
      payload.weeklySlots && typeof payload.weeklySlots === 'object'
        ? (payload.weeklySlots as Record<string, unknown>)
        : {}
    const normalizedDays = normalizeDoctorScheduleDays(scheduleRaw.days)
    const weeklySlots: DoctorWeeklySchedule['weeklySlots'] = {}

    for (const dayKey of Object.keys(normalizedDays) as Array<keyof DoctorScheduleDays>) {
      const daySlotsRaw = Array.isArray(weeklySlotsRaw[dayKey]) ? weeklySlotsRaw[dayKey] : []
      weeklySlots[dayKey] = daySlotsRaw.map((item) => {
        const raw = (item ?? {}) as Record<string, unknown>
        const sessionRaw = String(raw.session || 'morning').toLowerCase()
        return {
          startIso: String(raw.startIso || ''),
          endIso: String(raw.endIso || ''),
          label: String(raw.label || ''),
          session: sessionRaw === 'afternoon' ? 'afternoon' : 'morning',
        }
      }).filter((slot) => slot.startIso && slot.endIso && slot.label)
    }

    return {
      id: scheduleRaw.id ? String(scheduleRaw.id) : undefined,
      doctorId: String(scheduleRaw.doctorId || options?.doctorId || ''),
      weekStart: String(scheduleRaw.weekStart || weekStart),
      timezone: String(scheduleRaw.timezone || 'Asia/Manila'),
      hasSchedule: Boolean(scheduleRaw.hasSchedule),
      hasEnabledSession: Boolean(scheduleRaw.hasEnabledSession),
      days: normalizedDays,
      weeklySlots,
    }
  },
  getDoctorPatientProfile: async (patientId: string): Promise<DoctorPatientProfile> => {
    const payload = (await handleResponse(
      await request(
        `${API_BASE}/doctor/patients/${encodeURIComponent(patientId)}/profile`,
        withAuth()
      )
    )) as Record<string, unknown>

    const patient = ((payload.patient as Record<string, unknown> | undefined) ?? {})
    const health = ((payload.personalHealthInfo as Record<string, unknown> | undefined) ?? {})
    const emergency =
      health.emergencyContact && typeof health.emergencyContact === 'object'
        ? (health.emergencyContact as Record<string, unknown>)
        : null

    return {
      patient: {
        id: String(patient.id || patient._id || ''),
        firstName: String(patient.firstName || ''),
        lastName: String(patient.lastName || ''),
        email: String(patient.email || ''),
        status: patient.status ? String(patient.status) : undefined,
        dateOfBirth: patient.dateOfBirth ? String(patient.dateOfBirth) : undefined,
        phoneNumber: patient.phoneNumber ? String(patient.phoneNumber) : undefined,
        address: patient.address ? String(patient.address) : undefined,
        gender: patient.gender ? String(patient.gender) : undefined,
      },
      personalHealthInfo: {
        bloodType: health.bloodType ? String(health.bloodType) : undefined,
        allergies: Array.isArray(health.allergies) ? health.allergies.map((item) => String(item)) : [],
        medications: Array.isArray(health.medications) ? health.medications.map((item) => String(item)) : [],
        chronicConditions: Array.isArray(health.chronicConditions) ? health.chronicConditions.map((item) => String(item)) : [],
        surgeries: Array.isArray(health.surgeries) ? health.surgeries.map((item) => String(item)) : [],
        notes: health.notes ? String(health.notes) : undefined,
        emergencyContact: emergency
          ? {
              name: emergency.name ? String(emergency.name) : undefined,
              phone: emergency.phone ? String(emergency.phone) : undefined,
              relationship: emergency.relationship ? String(emergency.relationship) : undefined,
            }
          : undefined,
      },
    }
  },
  getAccessRequests: async (): Promise<AccessRequest[]> => {
    const payload = await handleResponse(await request(`${API_BASE}/access-requests`, withAuth()))
    const data = parseApiSchema(accessRequestsResponseSchema, payload, 'access requests')
    return data.requests
  },
  askAssistant: async (
    message: string,
    options?: { isIdentified?: boolean; userRole?: string | null }
  ): Promise<AssistantChatResponse> => {
    const response = await request(
      `${API_BASE}/symptoms`,
      withAuth({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          isIdentified: Boolean(options?.isIdentified),
          userRole: options?.userRole ?? null,
        }),
      })
    )

    const payload = (await handleResponse(response as Response)) as Record<string, unknown>
    return {
      reply: String(payload.reply || ''),
      meta:
        payload.meta && typeof payload.meta === 'object'
          ? (payload.meta as AssistantChatResponse['meta'])
          : undefined,
    }
  },
  logAiAlertAction: async (
    alertId: string,
    action: AlertAuditAction,
    context?: string
  ): Promise<boolean> => {
    const response = await request(
      `${API_BASE}/audit/ai-alert-action`,
      withAuth({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action, context }),
      })
    )
    const payload = await handleResponse(response)
    const data = parseApiSchema(aiAlertAuditResponseSchema, payload, 'AI alert audit')
    return data.ok
  },
  logout: async (): Promise<boolean> => {
    const response = await request(`${API_BASE}/logout`, withAuth({ method: 'POST' }))
    try {
      await handleResponse(response as Response)
      return true
    } catch (err) {
      return false
    }
  },
}

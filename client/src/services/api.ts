import type {
  AlertAuditAction,
  AppointmentUpdateDraft,
  AuthSession,
  AccessRequest,
  LedgerEntry,
  LoginOtpChallenge,
  Reservation,
  ReservationDraft,
  SignupDraft,
} from '../types'
import {
  aiAlertAuditResponseSchema,
  accessRequestsResponseSchema,
  appointmentResponseSchema,
  appointmentsResponseSchema,
  authSessionSchema,
  authUserSchema,
  createdReservationResponseSchema,
  ledgerResponseSchema,
  loginOtpChallengeSchema,
  parseApiSchema,
  reservationsResponseSchema,
} from '../schemas/apiSchemas'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api'
let authToken: string | null = null
const NETWORK_ERROR_MESSAGE =
  'Cannot reach API server. Start the backend and verify your API URL.'

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
        otpPreview: undefined,
      }
      return parseApiSchema(loginOtpChallengeSchema, challenge, 'OTP challenge')
    }

    // Otherwise expect a full auth session (token + user)
    // Map server user shape to client schema if necessary
    const mapped = {
      token: (payload as any).token,
      user: {
        username: (payload as any).user?.email ?? username,
        role: (payload as any).user?.role ?? 'user',
        authMethod: (payload as any).user?.authMethod ?? undefined,
        mfa: (payload as any).user?.mfa ?? undefined,
        sessionId: (payload as any).user?.sessionId ?? undefined,
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
    const mapped = {
      token: (payload as any).token,
      user: {
        username: (payload as any).user?.email ?? (payload as any).user?.username,
        role: (payload as any).user?.role ?? 'user',
        authMethod: (payload as any).user?.authMethod ?? undefined,
        mfa: (payload as any).user?.mfa ?? undefined,
        sessionId: (payload as any).user?.sessionId ?? undefined,
      },
    }
    return parseApiSchema(authSessionSchema, mapped, 'OTP verification')
  },
  signup: async (draft: SignupDraft): Promise<AuthSession> => {
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
    const payload = await handleResponse(response)
    return payload as unknown as AuthSession
  },
  getSession: async (): Promise<AuthSession['user']> => {
    const response = await request(`${API_BASE}/session`, withAuth())
    const payload = await handleResponse(response)
    return parseApiSchema(authUserSchema, payload, 'session')
  },
  getReservations: async (): Promise<Reservation[]> => {
    const payload = await handleResponse(await request(`${API_BASE}/reservations`, withAuth()))
    const data = parseApiSchema(reservationsResponseSchema, payload, 'reservations')
    return data.reservations
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
  getAppointments: async (): Promise<Reservation[]> => {
    const payload = await handleResponse(await request(`${API_BASE}/appointments`, withAuth()))
    const data = parseApiSchema(appointmentsResponseSchema, payload, 'appointments')
    return data.appointments
  },
  getLedger: async (): Promise<LedgerEntry[]> => {
    const payload = await handleResponse(await request(`${API_BASE}/ledger`, withAuth()))
    const data = parseApiSchema(ledgerResponseSchema, payload, 'ledger')
    return data.ledger
  },
  createReservation: async (
    draft: ReservationDraft
  ): Promise<{ reservation: Reservation; ledgerEntry: LedgerEntry }> => {
    const response = await request(`${API_BASE}/appointments`, withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // map client reservation draft to server appointment fields
        scheduledDate: draft.requestedTime,
        department: draft.summary.department,
        reason: draft.summary.summary,
        // include a lightweight clinical note
        note: draft.summary.summary,
      }),
    }))

    const payload = await handleResponse(response)
    return parseApiSchema(createdReservationResponseSchema, payload, 'create reservation')
  },
  updateAppointment: async (
    id: string,
    updates: AppointmentUpdateDraft
  ): Promise<Reservation> => {
    const response = await request(
      `${API_BASE}/appointments/${encodeURIComponent(id)}`,
      withAuth({
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
    )
    const payload = await handleResponse(response)
    const data = parseApiSchema(appointmentResponseSchema, payload, 'update appointment')
    return data.appointment
  },
  getAccessRequests: async (): Promise<AccessRequest[]> => {
    const payload = await handleResponse(await request(`${API_BASE}/access-requests`, withAuth()))
    const data = parseApiSchema(accessRequestsResponseSchema, payload, 'access requests')
    return data.requests
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

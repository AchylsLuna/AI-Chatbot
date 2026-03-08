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
import { normalizeRoleForSession } from '../utils/dashboardRoutes'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5001/api'
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
    const userPayload = (result as Record<string, unknown>)?.user as Record<string, unknown> | undefined
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
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
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

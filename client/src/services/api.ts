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

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5174/api'
let authToken: string | null = null
const NETWORK_ERROR_MESSAGE =
  'Cannot reach API server. Start the backend and verify your API URL.'

export const setAuthToken = (token: string | null) => {
  authToken = token
}

const handleResponse = async (response: Response): Promise<unknown> => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error?.error || 'Request failed')
  }
  return response.json() as Promise<unknown>
}

const withAuth = (init?: RequestInit): RequestInit => {
  const headers = new Headers(init?.headers)
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }
  return { ...init, headers }
}

const request = async (url: string, init?: RequestInit) => {
  try {
    return await fetch(url, init)
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE)
  }
}

export const api = {
  login: async (username: string, password: string): Promise<AuthSession> => {
    const response = await request(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const payload = await handleResponse(response)
    return parseApiSchema(authSessionSchema, payload, 'login')
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
    const response = await request(`${API_BASE}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, code }),
    })
    const payload = await handleResponse(response)
    return parseApiSchema(authSessionSchema, payload, 'OTP verification')
  },
  signup: async (draft: SignupDraft): Promise<AuthSession> => {
    const response = await request(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    const payload = await handleResponse(response)
    return parseApiSchema(authSessionSchema, payload, 'signup')
  },
  getSession: async (): Promise<AuthSession['user']> => {
    const response = await request(`${API_BASE}/auth/session`, withAuth())
    const payload = await handleResponse(response)
    return parseApiSchema(authUserSchema, payload, 'session')
  },
  getReservations: async (): Promise<Reservation[]> => {
    const payload = await handleResponse(await request(`${API_BASE}/reservations`, withAuth()))
    const data = parseApiSchema(reservationsResponseSchema, payload, 'reservations')
    return data.reservations
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
    const response = await request(`${API_BASE}/reservations`, withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientName: draft.patientName,
        symptoms: draft.symptoms,
        requestedTime: draft.requestedTime,
        summary: draft.summary,
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
}

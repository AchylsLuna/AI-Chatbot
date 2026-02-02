import type {
  AuthSession,
  LedgerEntry,
  Reservation,
  ReservationDraft,
  ReservationStatus,
  TriageSummary,
} from '../types/triage'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:5174/api'
let authToken: string | null = null

export const setAuthToken = (token: string | null) => {
  authToken = token
}

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error?.error || 'Request failed')
  }
  return response.json() as Promise<T>
}

const withAuth = (init?: RequestInit): RequestInit => {
  const headers = new Headers(init?.headers)
  if (authToken) {
    headers.set('Authorization', `Bearer ${authToken}`)
  }
  return { ...init, headers }
}

export const api = {
  login: async (username: string, password: string): Promise<AuthSession> => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    return handleResponse<AuthSession>(response)
  },
  getSession: async (): Promise<AuthSession['user']> => {
    const response = await fetch(`${API_BASE}/auth/session`, withAuth())
    return handleResponse<AuthSession['user']>(response)
  },
  getReservations: async (): Promise<Reservation[]> => {
    const data = await handleResponse<{ reservations: Reservation[] }>(
      await fetch(`${API_BASE}/reservations`, withAuth())
    )
    return data.reservations
  },
  getLedger: async (): Promise<LedgerEntry[]> => {
    const data = await handleResponse<{ ledger: LedgerEntry[] }>(
      await fetch(`${API_BASE}/ledger`, withAuth())
    )
    return data.ledger
  },
  createReservation: async (draft: ReservationDraft): Promise<Reservation> => {
    const response = await fetch(`${API_BASE}/reservations`, withAuth({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientName: draft.patientName,
        symptoms: draft.symptoms,
        requestedTime: draft.requestedTime,
        summary: draft.summary.summary,
        department: draft.summary.department,
        priority: draft.summary.priority,
        confidence: draft.summary.confidence,
      }),
    }))

    const data = await handleResponse<{ reservation: Reservation }>(response)
    return data.reservation
  },
  updateReservationStatus: async (
    reservationId: string,
    status: ReservationStatus
  ): Promise<{ reservation: Reservation; ledgerEntry: LedgerEntry | null }> => {
    const response = await fetch(`${API_BASE}/reservations/${reservationId}`, withAuth({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }))

    return handleResponse<{ reservation: Reservation; ledgerEntry: LedgerEntry | null }>(response)
  },
  generateTriageSummary: async (
    symptoms: string,
    signal?: AbortSignal
  ): Promise<TriageSummary> => {
    const response = await fetch(`${API_BASE}/triage/summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symptoms }),
      signal,
    })
    const data = await handleResponse<{ summary: TriageSummary }>(response)
    return data.summary
  },
}

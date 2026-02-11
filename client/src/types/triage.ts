export type ReservationStatus = 'Booked' | 'Recorded' | 'Failed'

export type TriageSummary = {
  department: string
  priority: 'Low' | 'Routine' | 'High'
  confidence: number
  summary: string
  symptoms: string
  disclaimer: string
  source?: 'ai' | 'rules' | 'decision_tree'
}

export type Reservation = {
  id: string
  patientName: string
  symptoms: string
  department: string
  priority: 'Low' | 'Routine' | 'High'
  confidence: number
  requestedTime: string
  createdAt: string
  status: ReservationStatus
  summary: string
}

export type ReservationDraft = {
  patientName: string
  symptoms: string
  requestedTime: string
  summary: TriageSummary
}

export type LedgerEntry = {
  id: string
  reservationId: string
  patientName: string
  department: string
  timestamp: string
  hash: string
  txHash?: string
  txStatus?: 'confirmed' | 'failed' | 'skipped'
  chainId?: string
}

export type UserRole = 'user' | 'nurse' | 'admin' | 'system_admin'

export type AuthSession = {
  token: string
  user: {
    username: string
    role: UserRole
  }
}

export type SignupDraft = {
  username: string
  password: string
  role: UserRole
  fullName?: string
  email?: string
  organization?: string
}

export type AccessRequestDraft = {
  fullName: string
  email: string
  organization: string
  roleRequested: UserRole
  notes?: string
}

export type AccessRequest = AccessRequestDraft & {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  reviewedAt?: string
}

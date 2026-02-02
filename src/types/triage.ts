export type ReservationStatus = 'Pending' | 'Approved' | 'Declined'

export type TriageSummary = {
  department: string
  priority: 'Low' | 'Routine' | 'High'
  confidence: number
  summary: string
  symptoms: string
  source?: 'ai' | 'rules'
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

export type AuthSession = {
  token: string
  user: {
    username: string
    role: 'admin' | 'nurse'
  }
}

import type { TriageSummary } from './triageSummary'

export type ReservationStatus = 'Booked' | 'Recorded' | 'Failed'

export type Reservation = {
  id: string
  patientId?: string
  patientName: string
  doctorId?: string
  doctorName?: string
  symptoms: string
  department: string
  priority: 'Low' | 'Routine' | 'High'
  confidence: number
  requestedTime: string
  createdAt: string
  status: ReservationStatus
  summary: string
  soapNote?: {
    subjective: string
    objective: string
    assessment: string
    plan: string
    updatedAt?: string | null
  }
  prescriptions?: Array<{
    medication: string
    dosage: string
    frequency?: string
    durationDays?: number | null
    instructions?: string
    createdAt?: string | null
  }>
}

export type ReservationDraft = {
  patientName: string
  symptoms: string
  requestedTime: string
  doctorId?: string
  summary: TriageSummary
}

export type ReservationCreateDraft = {
  patientName: string
  symptoms: string
  requestedTime: string
  major?: string
  doctorName?: string
  summary?: TriageSummary
}

export type AppointmentUpdateDraft = {
  requestedTime?: string
  status?: ReservationStatus
  department?: string
  priority?: 'Low' | 'Routine' | 'High'
  summary?: string
}

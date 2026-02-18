import type { TriageSummary } from './triageSummary'

export type ReservationStatus = 'Booked' | 'Recorded' | 'Failed'

export type Reservation = {
  id: string
  patientName: string
  symptoms: string
  department: string
  doctorName?: string
  nurseName?: string
  priority: 'Low' | 'Routine' | 'High'
  confidence: number
  requestedTime: string
  createdAt: string
  status: ReservationStatus
  summary: string
}

export type ReservationCreateDraft = {
  patientName: string
  symptoms: string
  requestedTime: string
  major: string
  doctorName: string
}

export type ReservationDraft = {
  patientName: string
  symptoms: string
  requestedTime: string
  summary: TriageSummary
}

export type AppointmentUpdateDraft = {
  requestedTime?: string
  status?: ReservationStatus
  department?: string
  priority?: 'Low' | 'Routine' | 'High'
  summary?: string
}

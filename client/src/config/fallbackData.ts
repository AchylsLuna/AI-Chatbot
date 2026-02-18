import type { LedgerEntry, Reservation } from '../types'

export type CareTeamRatingCategoryScores = {
  communication: number
  clinicalQuality: number
  timeliness: number
  followUp: number
}

export type CareTeamRating = {
  id: string
  doctorName: string
  nurseName: string
  department: string
  doctorRating: number
  nurseRating: number
  responses: number
  responseRate: number
  categoryScores: CareTeamRatingCategoryScores
}

export const doctorNurseAssignments: Record<string, string> = {
  'Dr. Mara Santos': 'Nurse Kim Perez',
  'Dr. Liza Moreno': 'Nurse Anna Reyes',
  'Dr. Ian Clarke': 'Nurse Paolo Dizon',
  'Dr. Rafiq Noor': 'Nurse Mae Ortega',
  'Dr. Mei Tan': 'Nurse Ella Cruz',
}

export const fallbackReservations: Reservation[] = [
  {
    id: 'RES-2041',
    patientName: 'Alex Jordan',
    symptoms: 'Shortness of breath after climbing stairs for two weeks.',
    department: 'Cardiology',
    doctorName: 'Dr. Mara Santos',
    nurseName: doctorNurseAssignments['Dr. Mara Santos'],
    priority: 'Routine',
    confidence: 0.78,
    requestedTime: '2:30 PM',
    createdAt: new Date().toISOString(),
    status: 'Booked',
    summary: 'Decision Tree summary: Shortness of breath on exertion. Recommend Cardiology.',
  },
  {
    id: 'RES-2038',
    patientName: 'Maya Patel',
    symptoms: 'Recurring rash with mild itching on arms.',
    department: 'Dermatology',
    doctorName: 'Dr. Liza Moreno',
    nurseName: doctorNurseAssignments['Dr. Liza Moreno'],
    priority: 'Low',
    confidence: 0.74,
    requestedTime: '4:10 PM',
    createdAt: new Date().toISOString(),
    status: 'Recorded',
    summary: 'Decision Tree summary: Persistent rash with mild itching. Recommend Dermatology.',
  },
]

export const fallbackCareTeamRatings: CareTeamRating[] = [
  {
    id: 'CARE-001',
    doctorName: 'Dr. Mara Santos',
    nurseName: 'Nurse Kim Perez',
    department: 'Cardiology',
    doctorRating: 4.9,
    nurseRating: 4.8,
    responses: 58,
    responseRate: 94,
    categoryScores: {
      communication: 4.8,
      clinicalQuality: 4.9,
      timeliness: 4.7,
      followUp: 4.8,
    },
  },
  {
    id: 'CARE-002',
    doctorName: 'Dr. Liza Moreno',
    nurseName: 'Nurse Anna Reyes',
    department: 'Dermatology',
    doctorRating: 4.7,
    nurseRating: 4.6,
    responses: 44,
    responseRate: 91,
    categoryScores: {
      communication: 4.6,
      clinicalQuality: 4.7,
      timeliness: 4.5,
      followUp: 4.6,
    },
  },
  {
    id: 'CARE-003',
    doctorName: 'Dr. Ian Clarke',
    nurseName: 'Nurse Paolo Dizon',
    department: 'Neurology',
    doctorRating: 4.6,
    nurseRating: 4.5,
    responses: 36,
    responseRate: 89,
    categoryScores: {
      communication: 4.5,
      clinicalQuality: 4.7,
      timeliness: 4.4,
      followUp: 4.5,
    },
  },
  {
    id: 'CARE-004',
    doctorName: 'Dr. Rafiq Noor',
    nurseName: 'Nurse Mae Ortega',
    department: 'Orthopedics',
    doctorRating: 4.8,
    nurseRating: 4.7,
    responses: 41,
    responseRate: 92,
    categoryScores: {
      communication: 4.7,
      clinicalQuality: 4.8,
      timeliness: 4.6,
      followUp: 4.7,
    },
  },
  {
    id: 'CARE-005',
    doctorName: 'Dr. Mei Tan',
    nurseName: 'Nurse Ella Cruz',
    department: 'General Medicine',
    doctorRating: 4.7,
    nurseRating: 4.6,
    responses: 49,
    responseRate: 93,
    categoryScores: {
      communication: 4.7,
      clinicalQuality: 4.8,
      timeliness: 4.6,
      followUp: 4.7,
    },
  },
]

export const fallbackLedger: LedgerEntry[] = [
  {
    id: 'LEDGER-1',
    reservationId: 'RES-2038',
    patientName: 'Maya Patel',
    department: 'Dermatology',
    timestamp: 'Today - 09:12 AM',
    hash: '0x8fa4d21c9b7e4c3a',
    txStatus: 'confirmed',
    chainId: '31337',
  },
]

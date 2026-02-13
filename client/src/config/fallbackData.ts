import type { LedgerEntry, Reservation } from '../types/triage'

export const fallbackReservations: Reservation[] = [
  {
    id: 'RES-2041',
    patientName: 'Alex Jordan',
    symptoms: 'Shortness of breath after climbing stairs for two weeks.',
    department: 'Cardiology',
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
    priority: 'Low',
    confidence: 0.74,
    requestedTime: '4:10 PM',
    createdAt: new Date().toISOString(),
    status: 'Recorded',
    summary: 'Decision Tree summary: Persistent rash with mild itching. Recommend Dermatology.',
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

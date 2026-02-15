import { create } from 'zustand'
import type { LedgerEntry, Reservation } from '../types/triage'

type SecureHealthStore = {
  reservations: Reservation[]
  ledgerEntries: LedgerEntry[]
  latestReservationId: string | null
  setReservations: (reservations: Reservation[]) => void
  setLedgerEntries: (ledgerEntries: LedgerEntry[]) => void
  setLatestReservationId: (reservationId: string | null) => void
  prependReservation: (reservation: Reservation) => void
  replaceReservation: (reservation: Reservation) => void
  prependLedgerEntry: (entry: LedgerEntry) => void
  clearSensitiveData: () => void
}

const initialSensitiveState = {
  reservations: [],
  ledgerEntries: [],
  latestReservationId: null,
} satisfies Pick<SecureHealthStore, 'reservations' | 'ledgerEntries' | 'latestReservationId'>

const useSecureHealthStore = create<SecureHealthStore>((set) => ({
  ...initialSensitiveState,
  setReservations: (reservations) => set({ reservations }),
  setLedgerEntries: (ledgerEntries) => set({ ledgerEntries }),
  setLatestReservationId: (latestReservationId) => set({ latestReservationId }),
  prependReservation: (reservation) =>
    set((state) => ({
      reservations: [reservation, ...state.reservations],
    })),
  replaceReservation: (reservation) =>
    set((state) => ({
      reservations: state.reservations.map((item) =>
        item.id === reservation.id ? reservation : item
      ),
    })),
  prependLedgerEntry: (entry) =>
    set((state) => ({
      ledgerEntries: [entry, ...state.ledgerEntries],
    })),
  clearSensitiveData: () => set(initialSensitiveState),
}))

export default useSecureHealthStore

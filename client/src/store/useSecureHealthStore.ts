import { useSyncExternalStore } from 'react'
import type { LedgerEntry, Reservation } from '../types'

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

type StoreSelector<T> = (state: SecureHealthStore) => T
type StoreListener = () => void

const listeners = new Set<StoreListener>()

const notifyListeners = () => {
  listeners.forEach((listener) => listener())
}

const subscribe = (listener: StoreListener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const createInitialState = () => ({
  reservations: [] as Reservation[],
  ledgerEntries: [] as LedgerEntry[],
  latestReservationId: null as string | null,
})

let state = createInitialState()

const setState = (updater: Partial<typeof state> | ((prev: typeof state) => Partial<typeof state>)) => {
  const nextPatch = typeof updater === 'function' ? updater(state) : updater
  state = { ...state, ...nextPatch }
  notifyListeners()
}

const actions = {
  setReservations: (reservations: Reservation[]) => setState({ reservations }),
  setLedgerEntries: (ledgerEntries: LedgerEntry[]) => setState({ ledgerEntries }),
  setLatestReservationId: (latestReservationId: string | null) => setState({ latestReservationId }),
  prependReservation: (reservation: Reservation) =>
    setState((prev) => ({
      reservations: [reservation, ...prev.reservations],
    })),
  replaceReservation: (reservation: Reservation) =>
    setState((prev) => ({
      reservations: prev.reservations.map((item) => (item.id === reservation.id ? reservation : item)),
    })),
  prependLedgerEntry: (entry: LedgerEntry) =>
    setState((prev) => ({
      ledgerEntries: [entry, ...prev.ledgerEntries],
    })),
  clearSensitiveData: () => {
    state = createInitialState()
    notifyListeners()
  },
}

const getSnapshot = (): SecureHealthStore => ({
  ...state,
  ...actions,
})

const useSecureHealthStore = <T,>(selector: StoreSelector<T>): T => {
  return useSyncExternalStore(subscribe, () => selector(getSnapshot()), () => selector(getSnapshot()))
}

export type { SecureHealthStore }
export default useSecureHealthStore

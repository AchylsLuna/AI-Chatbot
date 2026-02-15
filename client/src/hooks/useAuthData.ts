import { useEffect, useMemo, useState } from 'react'
import { requiresAuth } from '../config/accessControl'
import { fallbackLedger, fallbackReservations } from '../config/fallbackData'
import { api, setAuthToken } from '../services/api'
import useSecureHealthStore from '../store/useSecureHealthStore'
import type { AppPage } from '../types/navigation'
import type {
  AppointmentUpdateDraft,
  AuthSession,
  LedgerEntry,
  LoginOtpChallenge,
  Reservation,
  ReservationDraft,
} from '../types/triage'
import { sanitizeText } from '../utils/sanitize'
import { getDefaultPageForRole } from '../utils/roles'
import type { NavigateToPage } from './useAppRouting'

type UseAuthDataArgs = {
  currentPage: AppPage
  navigateToPage: NavigateToPage
}

const useAuthData = ({ currentPage, navigateToPage }: UseAuthDataArgs) => {
  const reservations = useSecureHealthStore((state) => state.reservations)
  const ledgerEntries = useSecureHealthStore((state) => state.ledgerEntries)
  const latestReservationId = useSecureHealthStore((state) => state.latestReservationId)
  const setStoreReservations = useSecureHealthStore((state) => state.setReservations)
  const setStoreLedgerEntries = useSecureHealthStore((state) => state.setLedgerEntries)
  const setStoreLatestReservationId = useSecureHealthStore((state) => state.setLatestReservationId)
  const prependReservation = useSecureHealthStore((state) => state.prependReservation)
  const replaceReservation = useSecureHealthStore((state) => state.replaceReservation)
  const prependLedgerEntry = useSecureHealthStore((state) => state.prependLedgerEntry)
  const clearSensitiveData = useSecureHealthStore((state) => state.clearSensitiveData)
  const [apiReady, setApiReady] = useState(false)
  const [authToken, setAuthTokenState] = useState<string | null>(null)
  const [authUser, setAuthUser] = useState<AuthSession['user'] | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [postLoginPage, setPostLoginPage] = useState<AppPage | null>(null)
  const [pendingOtpChallenge, setPendingOtpChallenge] = useState<
    (LoginOtpChallenge & { targetPage?: AppPage | null }) | null
  >(null)

  const latestReservation = useMemo(
    () =>
      latestReservationId
        ? reservations.find((reservation) => reservation.id === latestReservationId)
        : undefined,
    [latestReservationId, reservations]
  )

  useEffect(() => {
    setAuthToken(authToken)
  }, [authToken])

  useEffect(() => {
    if (!authToken) {
      clearSensitiveData()
    }
  }, [authToken, clearSensitiveData])

  useEffect(() => {
    const storedToken = localStorage.getItem('pulse-ledger-token')
    if (storedToken) {
      setAuthTokenState(storedToken)
      setIsAuthLoading(true)
    }
  }, [])

  useEffect(() => {
    const needsAuth = Boolean(requiresAuth[currentPage])
    if (!needsAuth) return
    if (authUser) return
    if (authToken && isAuthLoading) return
    if (currentPage !== 'login' && currentPage !== 'admin_login' && currentPage !== 'otp') {
      setPostLoginPage(currentPage)
      const needsAdminLogin = currentPage === 'admin' || currentPage === 'doctor_dashboard'
      navigateToPage(needsAdminLogin ? 'admin_login' : 'login', { replace: true })
    }
  }, [authToken, authUser, currentPage, isAuthLoading, navigateToPage])

  useEffect(() => {
    let isMounted = true

    const loadProtectedData = async () => {
      if (!authToken) return
      setIsAuthLoading(true)
      try {
        const user = await api.getSession()
        const reservationData = await api.getAppointments()
        let ledgerData: LedgerEntry[] = []

        if (user.role === 'admin' || user.role === 'system_admin') {
          try {
            ledgerData = await api.getLedger()
          } catch (ledgerError) {
            console.warn('Ledger unavailable for current session.', ledgerError)
          }
        }

        if (!isMounted) return
        setAuthUser(user)
        setStoreReservations(reservationData)
        setStoreLedgerEntries(ledgerData)
        setApiReady(true)
      } catch (error) {
        console.error('API unavailable or unauthorized, using fallback data.', error)
        const message = error instanceof Error ? error.message : ''
        if (message.match(/invalid|expired|missing authorization|forbidden/i)) {
          setAuthTokenState(null)
          localStorage.removeItem('pulse-ledger-token')
          clearSensitiveData()
        }
        if (isMounted) {
          setStoreReservations(fallbackReservations)
          setStoreLedgerEntries(fallbackLedger)
        }
      } finally {
        if (isMounted) setIsAuthLoading(false)
      }
    }

    loadProtectedData()

    return () => {
      isMounted = false
    }
  }, [authToken, clearSensitiveData, setStoreLedgerEntries, setStoreReservations])

  const handleCreateReservation = async (draft: ReservationDraft) => {
    try {
      const { reservation, ledgerEntry } = await api.createReservation(draft)
      prependReservation(reservation)
      setStoreLatestReservationId(reservation.id)
      prependLedgerEntry(ledgerEntry)
      setApiReady(true)
    } catch (error) {
      console.error('Failed to create reservation', error)
      const fallback: Reservation = {
        id: `RES-${Math.floor(1000 + Math.random() * 9000)}`,
        patientName: sanitizeText(draft.patientName),
        symptoms: sanitizeText(draft.symptoms),
        department: sanitizeText(draft.summary.department),
        priority: draft.summary.priority,
        confidence: draft.summary.confidence,
        requestedTime: sanitizeText(draft.requestedTime),
        createdAt: new Date().toISOString(),
        status: 'Booked',
        summary: sanitizeText(draft.summary.summary),
      }
      prependReservation(fallback)
      setStoreLatestReservationId(fallback.id)
    }
  }

  const handleUpdateReservation = async (reservationId: string, updates: AppointmentUpdateDraft) => {
    const updated = await api.updateAppointment(reservationId, updates)
    replaceReservation(updated)
    return updated
  }

  const handleLogin = async (username: string, password: string, targetPage?: AppPage) => {
    setAuthError(null)
    setIsAuthLoading(true)
    try {
      const challenge = await api.requestOtpChallenge(username, password)
      const resolvedTargetPage = targetPage ?? postLoginPage ?? null
      setPendingOtpChallenge({ ...challenge, targetPage: resolvedTargetPage })
      setPostLoginPage(null)
      navigateToPage('otp')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Login failed')
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleVerifyOtp = async (code: string) => {
    if (!pendingOtpChallenge) {
      setAuthError('No active OTP challenge. Start login again.')
      navigateToPage('login')
      return
    }

    setAuthError(null)
    setIsAuthLoading(true)
    try {
      const session = await api.verifyOtpLogin(pendingOtpChallenge.challengeId, code)
      setAuthTokenState(session.token)
      setAuthUser(session.user)
      localStorage.setItem('pulse-ledger-token', session.token)
      setApiReady(true)

      const defaultPageByRole = getDefaultPageForRole(session.user.role)
      const resolvedTargetPage =
        pendingOtpChallenge.targetPage ?? postLoginPage ?? defaultPageByRole
      const isAdminDashboardTarget = resolvedTargetPage === 'admin'
      const isDoctorDashboardTarget = resolvedTargetPage === 'doctor_dashboard'
      const hasAdminDashboardRole =
        session.user.role === 'admin' || session.user.role === 'system_admin'
      const hasAdminLoginRole = hasAdminDashboardRole || session.user.role === 'nurse'

      setPendingOtpChallenge(null)
      setPostLoginPage(null)

      if (isAdminDashboardTarget && !hasAdminDashboardRole) {
        setAuthError('Super Admin or Admin account required for Admin Dashboard.')
        navigateToPage('admin_login')
        return
      }

      if (isDoctorDashboardTarget && !hasAdminLoginRole) {
        setAuthError('Super Admin, Admin, or Nurse account required for Doctor Dashboard.')
        navigateToPage('admin_login')
        return
      }

      navigateToPage(resolvedTargetPage)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'OTP verification failed')
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleCancelOtp = () => {
    setPendingOtpChallenge(null)
    navigateToPage('login')
  }

  const handleSignupSuccess = (session: AuthSession) => {
    setAuthTokenState(session.token)
    setAuthUser(session.user)
    setAuthError(null)
    localStorage.setItem('pulse-ledger-token', session.token)
    setApiReady(true)
    navigateToPage(getDefaultPageForRole(session.user.role))
  }

  const handleLogout = () => {
    setAuthTokenState(null)
    setAuthUser(null)
    setAuthError(null)
    localStorage.removeItem('pulse-ledger-token')
    clearSensitiveData()
    setPendingOtpChallenge(null)
    setApiReady(false)
    setPostLoginPage(null)
    navigateToPage('landing')
  }

  const isCheckingSession = Boolean(authToken && isAuthLoading && !authUser)

  return {
    apiReady,
    authToken,
    authUser,
    authError,
    isAuthLoading,
    isCheckingSession,
    reservations,
    ledgerEntries,
    latestReservation,
    pendingOtpChallenge,
    handleCreateReservation,
    handleUpdateReservation,
    handleLogin,
    handleVerifyOtp,
    handleCancelOtp,
    handleSignupSuccess,
    handleLogout,
  }
}

export default useAuthData

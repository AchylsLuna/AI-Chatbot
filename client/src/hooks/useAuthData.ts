import { useEffect, useMemo, useState } from 'react'
import { requiresAuth } from '../config/accessControl'
import { fallbackLedger, fallbackReservations } from '../config/fallbackData'
import { api, setAuthToken } from '../services/api'
import type { AppPage } from '../types/navigation'
import type { AuthSession, LedgerEntry, Reservation, ReservationDraft } from '../types/triage'
import { getDefaultPageForRole } from '../utils/roles'
import type { NavigateToPage } from './useAppRouting'

type UseAuthDataArgs = {
  currentPage: AppPage
  navigateToPage: NavigateToPage
}

const useAuthData = ({ currentPage, navigateToPage }: UseAuthDataArgs) => {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [latestReservationId, setLatestReservationId] = useState<string | null>(null)
  const [apiReady, setApiReady] = useState(false)
  const [authToken, setAuthTokenState] = useState<string | null>(null)
  const [authUser, setAuthUser] = useState<AuthSession['user'] | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [postLoginPage, setPostLoginPage] = useState<AppPage | null>(null)

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
    if (currentPage !== 'login' && currentPage !== 'admin_login') {
      setPostLoginPage(currentPage)
      navigateToPage(currentPage === 'admin' ? 'admin_login' : 'login', { replace: true })
    }
  }, [authToken, authUser, currentPage, isAuthLoading, navigateToPage])

  useEffect(() => {
    let isMounted = true

    const loadProtectedData = async () => {
      if (!authToken) return
      setIsAuthLoading(true)
      try {
        const [user, reservationData, ledgerData] = await Promise.all([
          api.getSession(),
          api.getReservations(),
          api.getLedger(),
        ])
        if (!isMounted) return
        setAuthUser(user)
        setReservations(reservationData)
        setLedgerEntries(ledgerData)
        setApiReady(true)
      } catch (error) {
        console.error('API unavailable or unauthorized, using fallback data.', error)
        const message = error instanceof Error ? error.message : ''
        if (message.match(/invalid|expired|missing authorization|forbidden/i)) {
          setAuthTokenState(null)
          localStorage.removeItem('pulse-ledger-token')
        }
        if (isMounted) {
          setReservations(fallbackReservations)
          setLedgerEntries(fallbackLedger)
        }
      } finally {
        if (isMounted) setIsAuthLoading(false)
      }
    }

    loadProtectedData()

    return () => {
      isMounted = false
    }
  }, [authToken])

  const handleCreateReservation = async (draft: ReservationDraft) => {
    try {
      const { reservation, ledgerEntry } = await api.createReservation(draft)
      setReservations((prev) => [reservation, ...prev])
      setLatestReservationId(reservation.id)
      setLedgerEntries((prev) => [ledgerEntry, ...prev])
      setApiReady(true)
    } catch (error) {
      console.error('Failed to create reservation', error)
      const fallback: Reservation = {
        id: `RES-${Math.floor(1000 + Math.random() * 9000)}`,
        patientName: draft.patientName,
        symptoms: draft.symptoms,
        department: draft.summary.department,
        priority: draft.summary.priority,
        confidence: draft.summary.confidence,
        requestedTime: draft.requestedTime,
        createdAt: new Date().toISOString(),
        status: 'Booked',
        summary: draft.summary.summary,
      }
      setReservations((prev) => [fallback, ...prev])
      setLatestReservationId(fallback.id)
    }
  }

  const handleLogin = async (username: string, password: string, targetPage?: AppPage) => {
    setAuthError(null)
    setIsAuthLoading(true)
    try {
      const session = await api.login(username, password)
      setAuthTokenState(session.token)
      setAuthUser(session.user)
      localStorage.setItem('pulse-ledger-token', session.token)
      setApiReady(true)
      const defaultPageByRole = getDefaultPageForRole(session.user.role)
      const resolvedTargetPage = targetPage ?? postLoginPage ?? defaultPageByRole
      setPostLoginPage(null)
      const isAdminTarget = resolvedTargetPage === 'admin'
      const hasAdminRole =
        session.user.role === 'admin' || session.user.role === 'system_admin'

      if (isAdminTarget && !hasAdminRole) {
        setAuthError('Admin or System Admin account required for Admin Dashboard.')
        navigateToPage('admin_login')
        return
      }

      navigateToPage(resolvedTargetPage)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Login failed')
    } finally {
      setIsAuthLoading(false)
    }
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
    setReservations([])
    setLedgerEntries([])
    setLatestReservationId(null)
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
    handleCreateReservation,
    handleLogin,
    handleSignupSuccess,
    handleLogout,
  }
}

export default useAuthData

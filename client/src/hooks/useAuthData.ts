import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { requiresAuth } from '../config/accessControl'
import { fallbackLedger, fallbackReservations } from '../config/fallbackData'
import { api, setAuthToken } from '../services/api'
import {
  getAuth0Session,
  getAuthProvider,
  handleAuth0Redirect,
  hasAuth0RedirectParams,
  isAuth0Enabled,
  isBiometricHookAvailable,
  logoutAuth0Session,
  startAuth0Login,
} from '../services/authProvider'
import useSecureHealthStore from '../store/useSecureHealthStore'
import type { AppPage } from '../types/navigation'
import type {
  AppointmentUpdateDraft,
  AuthSession,
  LedgerEntry,
  LoginOtpChallenge,
  Reservation,
  ReservationDraft,
} from '../types'
import { sanitizeText } from '../utils/sanitize'
import { getDefaultPageForRole } from '../utils/roles'
import type { NavigateToPage } from './useAppRouting'

type UseAuthDataArgs = {
  currentPage: AppPage
  navigateToPage: NavigateToPage
}

const unauthorizedSessionPattern =
  /invalid|expired|missing authorization|forbidden|unauthorized|mfa token required|mfa required|multi-factor|2fa|required for this role/i

const isUnauthorizedSessionError = (message: string) => unauthorizedSessionPattern.test(message)

const useAuthData = ({ currentPage, navigateToPage }: UseAuthDataArgs) => {
  const authProvider = getAuthProvider()
  const auth0Enabled = isAuth0Enabled()
  const initialStoredToken =
    authProvider === 'local' && typeof window !== 'undefined'
      ? localStorage.getItem('pulse-ledger-token')
      : null
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
  const [authToken, setAuthTokenState] = useState<string | null>(initialStoredToken)
  const [authUser, setAuthUser] = useState<AuthSession['user'] | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(Boolean(initialStoredToken))
  const [postLoginPage, setPostLoginPage] = useState<AppPage | null>(null)
  const [pendingOtpChallenge, setPendingOtpChallenge] = useState<
    (LoginOtpChallenge & { targetPage?: AppPage | null }) | null
  >(null)
  const [isBiometricReady, setIsBiometricReady] = useState(false)
  const [idleWarningOpen, setIdleWarningOpen] = useState(false)
  const [idleRemainingSeconds, setIdleRemainingSeconds] = useState<number>(0)

  const clearLocalTokenStorage = useCallback(() => {
    if (authProvider === 'local') {
      localStorage.removeItem('pulse-ledger-token')
    }
  }, [authProvider])

  const clearUnauthorizedSession = useCallback(() => {
    setAuthTokenState(null)
    setAuthUser(null)
    setApiReady(false)
    clearLocalTokenStorage()
    clearSensitiveData()
  }, [clearLocalTokenStorage, clearSensitiveData])

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

  // Idle/session timeout handling
  const WARNING_MS = 5 * 60 * 1000 // 10 minutes
  const LOGOUT_MS = 10 * 60 * 1000 // 15 minutes
  const warningTimerRef = useRef<number | null>(null)
  const logoutTimerRef = useRef<number | null>(null)
  const countdownIntervalRef = useRef<number | null>(null)
  const logoutRef = useRef<(() => Promise<void>) | null>(null)

  const clearIdleTimers = useCallback(() => {
    if (warningTimerRef.current) {
      window.clearTimeout(warningTimerRef.current)
      warningTimerRef.current = null
    }
    if (logoutTimerRef.current) {
      window.clearTimeout(logoutTimerRef.current)
      logoutTimerRef.current = null
    }
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    setIdleWarningOpen(false)
    setIdleRemainingSeconds(0)
  }, [])

  const startIdleTimers = useCallback(() => {
    clearIdleTimers()
    // schedule warning and logout
    warningTimerRef.current = window.setTimeout(() => {
      // show warning and start 5-minute countdown
      const remaining = Math.floor((LOGOUT_MS - WARNING_MS) / 1000)
      setIdleRemainingSeconds(remaining)
      setIdleWarningOpen(true)
      // interval to decrement
      countdownIntervalRef.current = window.setInterval(() => {
        setIdleRemainingSeconds((prev) => {
          if (prev <= 1) return 0
          return prev - 1
        })
      }, 1000)
    }, WARNING_MS)

    logoutTimerRef.current = window.setTimeout(() => {
      // auto logout
      clearIdleTimers()
      void (logoutRef.current ? logoutRef.current() : Promise.resolve())
    }, LOGOUT_MS)
  }, [clearIdleTimers])


  const activityHandler = useCallback(() => {
    if (!authUser) return
    // if warning is visible, don't automatically close here — user must click Stay signed in
    if (idleWarningOpen) return
    startIdleTimers()
  }, [authUser, idleWarningOpen, startIdleTimers])

  const acknowledgeIdle = useCallback(async () => {
    // user wants to stay signed in
    setIdleWarningOpen(false)
    setIdleRemainingSeconds(0)
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    try {
      // ping server to refresh session (best-effort)
      await api.getSession()
    } catch (err) {
      // ignore errors
    }
    startIdleTimers()
  }, [startIdleTimers])

  // wire activity listeners when authenticated
  useEffect(() => {
    if (!authUser) {
      clearIdleTimers()
      return
    }
    // start fresh timers
    startIdleTimers()

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll']
    events.forEach((ev) => window.addEventListener(ev, activityHandler))
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, activityHandler))
      clearIdleTimers()
    }
  }, [authUser, activityHandler, clearIdleTimers, startIdleTimers])

  useEffect(() => {
    if (!authToken) {
      clearSensitiveData()
    }
  }, [authToken, clearSensitiveData])

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      const supported = await isBiometricHookAvailable()
      if (isMounted) {
        setIsBiometricReady(supported)
      }
    })()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (authProvider !== 'local') return
    const storedToken = localStorage.getItem('pulse-ledger-token')
    if (storedToken && !authToken) {
      setAuthTokenState(storedToken)
      setIsAuthLoading(true)
    }
  }, [authProvider, authToken])

  useEffect(() => {
    if (!auth0Enabled) return
    let isMounted = true

    const bootstrapAuth0Session = async () => {
      const hasRedirect = hasAuth0RedirectParams()
      if (hasRedirect) setIsAuthLoading(true)
      try {
        const redirectTarget = hasRedirect ? await handleAuth0Redirect() : null
        if (hasRedirect) {
          const path = window.location.pathname
          window.history.replaceState({}, document.title, path)
        }
        const session = await getAuth0Session()
        if (!isMounted || !session) return

        setAuthTokenState(session.token)
        setAuthUser(session.user)
        setApiReady(true)
        if (redirectTarget) {
          const resolvedRedirectTarget =
            session.user.role === 'user' ? getDefaultPageForRole(session.user.role) : redirectTarget
          navigateToPage(resolvedRedirectTarget, { replace: true })
        }
      } catch (error) {
        if (!isMounted) return
        setAuthError(error instanceof Error ? error.message : 'Auth0 login failed')
      } finally {
        if (isMounted) {
          setIsAuthLoading(false)
        }
      }
    }

    void bootstrapAuth0Session()

    return () => {
      isMounted = false
    }
  }, [auth0Enabled, navigateToPage])

  useEffect(() => {
    const needsAuth = Boolean(requiresAuth[currentPage])
    if (!needsAuth) return
    if (authUser) return
    if (authToken) return
    if (auth0Enabled && isAuthLoading) return
    if (currentPage !== 'login' && currentPage !== 'admin_login' && currentPage !== 'otp') {
      setPostLoginPage(currentPage)
      const needsAdminLogin = currentPage === 'admin' || currentPage === 'doctor_dashboard'
      navigateToPage(needsAdminLogin ? 'admin_login' : 'login', { replace: true })
    }
  }, [auth0Enabled, authToken, authUser, currentPage, isAuthLoading, navigateToPage])

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
        const isUnauthorized = isUnauthorizedSessionError(message)

        if (isUnauthorized) {
          clearUnauthorizedSession()
          setAuthError('Session expired or unauthorized. Please sign in again.')
        }

        if (isMounted) {
          if (isUnauthorized) {
            setStoreReservations([])
            setStoreLedgerEntries([])
          } else {
            setStoreReservations(fallbackReservations)
            setStoreLedgerEntries(fallbackLedger)
          }
        }
      } finally {
        if (isMounted) setIsAuthLoading(false)
      }
    }

    loadProtectedData()

    return () => {
      isMounted = false
    }
  }, [
    authToken,
    clearUnauthorizedSession,
    setStoreLedgerEntries,
    setStoreReservations,
  ])

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

  const handleProviderLogin = async (targetPage?: AppPage) => {
    if (!auth0Enabled) {
      throw new Error('Auth0 is not enabled in this environment.')
    }
    setAuthError(null)
    setIsAuthLoading(true)
    try {
      await startAuth0Login(targetPage ?? postLoginPage ?? undefined)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Auth0 login failed')
      setIsAuthLoading(false)
    }
  }

  const finalizeAuthenticatedSession = (
    session: AuthSession,
    preferredTargetPage?: AppPage | null
  ) => {
    setAuthTokenState(session.token)
    setAuthUser(session.user)
    if (authProvider === 'local') {
      localStorage.setItem('pulse-ledger-token', session.token)
    }
    setApiReady(true)

    const defaultPageByRole = getDefaultPageForRole(session.user.role)
    const resolvedTargetPage = preferredTargetPage ?? defaultPageByRole
    const finalTargetPage = session.user.role === 'user' ? defaultPageByRole : resolvedTargetPage
    const isAdminDashboardTarget = finalTargetPage === 'admin'
    const isDoctorDashboardTarget = finalTargetPage === 'doctor_dashboard'
    const hasAdminWorkspaceRole =
      session.user.role === 'nurse' || session.user.role === 'admin' || session.user.role === 'system_admin'
    const hasDoctorWorkspaceRole = hasAdminWorkspaceRole

    setPendingOtpChallenge(null)
    setPostLoginPage(null)

    if (isAdminDashboardTarget && !hasAdminWorkspaceRole) {
      setAuthError('Nurse, Admin, or Super Admin account required for Admin Workspace.')
      navigateToPage('admin_login')
      return
    }

    if (isDoctorDashboardTarget && !hasDoctorWorkspaceRole) {
      setAuthError('Super Admin, Admin, or Nurse account required for Doctor Dashboard.')
      navigateToPage('admin_login')
      return
    }

    navigateToPage(finalTargetPage)
  }

  const handleLogin = async (username: string, password: string, targetPage?: AppPage) => {
    if (auth0Enabled) {
      await handleProviderLogin(targetPage)
      return
    }
    setAuthError(null)
    setIsAuthLoading(true)
    try {
      const result = await api.login(username, password)

      // If server returned an OTP challenge, set it and navigate to OTP flow
      if ((result as any)?.challengeId) {
        const challenge = result as unknown as LoginOtpChallenge & { targetPage?: AppPage | null }
        setPendingOtpChallenge({ ...challenge, targetPage: targetPage ?? postLoginPage ?? null })
        navigateToPage('otp')
        return
      }

      // Otherwise it's an auth session
      const session = result as unknown as AuthSession
      const resolvedTargetPage = targetPage ?? postLoginPage ?? null
      finalizeAuthenticatedSession(session, resolvedTargetPage)
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
      const resolvedTargetPage = pendingOtpChallenge.targetPage ?? postLoginPage ?? null
      finalizeAuthenticatedSession(session, resolvedTargetPage)
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
    if (authProvider === 'local') {
      localStorage.setItem('pulse-ledger-token', session.token)
    }
    setApiReady(true)
    navigateToPage(getDefaultPageForRole(session.user.role))
  }

  const handleLogout = async (target?: 'login' | 'landing' | 'admin_login') => {
    const prevRole = authUser?.role
    if (auth0Enabled) {
      void logoutAuth0Session()
    }

    // Inform server to destroy session when possible
    try {
      if (authProvider === 'local') {
        await api.logout()
      }
    } catch (err) {
      console.warn('Server logout failed', err)
    }

    setAuthTokenState(null)
    setAuthUser(null)
    setAuthError(null)
    clearLocalTokenStorage()
    clearSensitiveData()
    setPendingOtpChallenge(null)
    setApiReady(false)
    setPostLoginPage(null)

    // Determine where to navigate after logout
    if (target) {
      navigateToPage(target)
      return
    }

    if (prevRole === 'user') {
      navigateToPage('login')
      return
    }

    if (prevRole) {
      // Any staff/admin role -> admin login
      navigateToPage('admin_login')
      return
    }

    navigateToPage('landing')
  }

  // keep a ref to the latest logout handler for timers defined earlier
  useEffect(() => {
    logoutRef.current = handleLogout
  }, [handleLogout])

  const isCheckingSession = Boolean(
    !authUser &&
      ((authToken && (isAuthLoading || !apiReady)) || (auth0Enabled && isAuthLoading))
  )
  const sessionStatus = authUser
    ? isAuthLoading
      ? 'Refreshing session'
      : 'Session active'
    : isAuthLoading
      ? 'Authenticating'
      : 'No active session'

  return {
    authProvider,
    auth0Enabled,
    isBiometricReady,
    sessionStatus,
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
    handleProviderLogin,
    handleLogin,
    handleVerifyOtp,
    handleCancelOtp,
    handleSignupSuccess,
    handleLogout,
    idleWarningOpen,
    idleRemainingSeconds,
    acknowledgeIdle,
  }
}

export default useAuthData

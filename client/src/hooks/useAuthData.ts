import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { requiresAuth } from '../config/accessControl'
import { api, setAuthToken, setCsrfToken } from '../services/api'
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
import {
  getDefaultPageForRole,
  isAdminRole,
  isDoctorRole,
} from '../utils/roleRoutes'
import { resolveAuthPageFromPath } from '../config/routing'
import {
  isTabPathForPage,
  resolveTabCanonicalPath,
} from '../config/roleTabRoutes'
import { resolveReturnTo } from '../utils/appRouteState'
import {
  clearStoredPostLoginTarget,
  readStoredPostLoginTarget,
  writeStoredPostLoginTarget,
} from '../utils/postLoginTarget'
import type { NavigateToPage } from './useAppRouting'

type UseAuthDataArgs = {
  currentPage: AppPage
  navigateToPage: NavigateToPage
}

type AuthUiAction = 'login' | 'provider' | 'otp' | null
type OtpSourcePage = Extract<AppPage, 'login' | 'doctor_login' | 'admin_login'>
type OtpTargetPage = Extract<AppPage, 'appointments' | 'doctor_dashboard' | 'admin'>
type PendingOtpChallenge = LoginOtpChallenge & {
  sourcePage: OtpSourcePage
  targetPage: OtpTargetPage
  targetPath: string | null
}

const unauthorizedSessionPattern =
  /invalid|expired|missing authorization|forbidden|unauthorized|mfa token required|mfa required|multi-factor|2fa|required for this role/i

const isUnauthorizedSessionError = (message: string) => unauthorizedSessionPattern.test(message)
const areAuthUsersEqual = (
  left: AuthSession['user'] | null,
  right: AuthSession['user'] | null
) => {
  if (left === right) return true
  if (!left || !right) return false

  return (
    left.username === right.username &&
    left.firstName === right.firstName &&
    left.lastName === right.lastName &&
    left.role === right.role &&
    left.accountType === right.accountType &&
    left.authMethod === right.authMethod &&
    left.mfa === right.mfa &&
    left.sessionId === right.sessionId
  )
}
const otpRestartPattern = /otp has expired|otp challenge not found|challenge not found|start login again/i
const isOtpSourcePage = (page?: AppPage | null): page is OtpSourcePage =>
  page === 'login' || page === 'doctor_login' || page === 'admin_login'
const isOtpTargetPage = (page?: AppPage | null): page is OtpTargetPage =>
  page === 'appointments' || page === 'doctor_dashboard' || page === 'admin'
const resolveAuthPageForProtectedPage = (page?: AppPage | null): OtpSourcePage => {
  if (page === 'admin') return 'admin_login'
  if (page === 'doctor_dashboard') return 'doctor_login'
  return 'login'
}

const GOOGLE_CODE_QUERY_PARAM = 'google_code'
const GOOGLE_ERROR_QUERY_PARAM = 'google_error'

const readGoogleAuthSearch = () => {
  if (typeof window === 'undefined') {
    return { googleCode: null as string | null, googleError: null as string | null }
  }

  const params = new URLSearchParams(window.location.search)
  const googleCode = params.get(GOOGLE_CODE_QUERY_PARAM)
  const googleError = params.get(GOOGLE_ERROR_QUERY_PARAM)
  return {
    googleCode: googleCode && googleCode.trim() ? googleCode.trim() : null,
    googleError: googleError && googleError.trim() ? googleError.trim() : null,
  }
}

const clearGoogleAuthSearch = () => {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  url.searchParams.delete(GOOGLE_CODE_QUERY_PARAM)
  url.searchParams.delete(GOOGLE_ERROR_QUERY_PARAM)
  const nextSearch = url.searchParams.toString()
  const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`
  window.history.replaceState(window.history.state, document.title, nextUrl)
}

const useAuthData = ({ currentPage, navigateToPage }: UseAuthDataArgs) => {
  const authProvider = getAuthProvider()
  const auth0Enabled = isAuth0Enabled()
  const initialStoredToken = null
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
  const [authUiAction, setAuthUiAction] = useState<AuthUiAction>(null)
  const [postLoginPage, setPostLoginPage] = useState<AppPage | null>(null)
  const [postLoginPath, setPostLoginPath] = useState<string | null>(null)
  const [postLoginAuthPage, setPostLoginAuthPage] = useState<OtpSourcePage | null>(null)
  const [pendingOtpChallenge, setPendingOtpChallenge] = useState<PendingOtpChallenge | null>(null)
  const [isBiometricReady, setIsBiometricReady] = useState(false)
  const [idleWarningOpen, setIdleWarningOpen] = useState(false)
  const [idleRemainingSeconds, setIdleRemainingSeconds] = useState<number>(0)
  const hasBootstrappedLocalSessionRef = useRef(false)

  const clearLocalTokenStorage = useCallback(() => {
    if (authProvider === 'local') {
      localStorage.removeItem('pulse-ledger-token')
    }
  }, [authProvider])

  const clearUnauthorizedSession = useCallback(() => {
    setAuthTokenState(null)
    setCsrfToken(null)
    setAuthUser(null)
    setApiReady(false)
    setAuthUiAction(null)
    clearLocalTokenStorage()
    clearSensitiveData()
    clearStoredPostLoginTarget()
  }, [clearLocalTokenStorage, clearSensitiveData])

  const clearActiveSessionState = useCallback(() => {
    setAuthTokenState(null)
    setCsrfToken(null)
    setAuthUser(null)
    setApiReady(false)
    clearSensitiveData()
  }, [clearSensitiveData])

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
  const WARNING_MS = 3 * 60 * 1000
  const LOGOUT_MS = 5 * 60 * 1000
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
      // show warning and start the remaining countdown until auto logout
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
      if (!authUser) {
        clearSensitiveData()
      }
    }
  }, [authToken, authUser, clearSensitiveData])

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
    clearLocalTokenStorage()
  }, [authProvider, clearLocalTokenStorage])

  useEffect(() => {
    if (!auth0Enabled) return
    let isMounted = true

    const bootstrapAuth0Session = async () => {
      const hasRedirect = hasAuth0RedirectParams()
      if (hasRedirect) {
        setAuthUiAction('provider')
        setIsAuthLoading(true)
      }
      try {
        const redirectTarget = hasRedirect ? await handleAuth0Redirect() : null
        if (hasRedirect) {
          const path = window.location.pathname
          window.history.replaceState({}, document.title, path)
        }
        const session = await getAuth0Session()
        if (!isMounted || !session) return
        if (!session.token) {
          throw new Error('Auth0 session missing token')
        }

        setAuthTokenState(session.token)
        setAuthUser(session.user)
        setApiReady(true)
        if (redirectTarget) {
          const resolvedRedirectTarget =
            session.user.role === 'user'
              ? getDefaultPageForRole(session.user.role, session.user.accountType)
              : redirectTarget
          navigateToPage(resolvedRedirectTarget, { replace: true })
        }
      } catch (error) {
        if (!isMounted) return
        setAuthError(error instanceof Error ? error.message : 'Auth0 login failed')
      } finally {
        if (isMounted) {
          setAuthUiAction(null)
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
    if (authProvider !== 'local') return
    if (auth0Enabled) return
    if (hasBootstrappedLocalSessionRef.current) return
    hasBootstrappedLocalSessionRef.current = true

    let isMounted = true
    ;(async () => {
      try {
        setIsAuthLoading(true)
        const { googleCode, googleError } = readGoogleAuthSearch()

        if (googleError) {
          setAuthError(
            googleError === 'account_route_mismatch'
              ? 'This account must use its matching sign-in page.'
              : 'Google sign in failed. Try again.'
          )
          clearGoogleAuthSearch()
        }

        if (googleCode) {
          setAuthUiAction('provider')
          const session = await api.exchangeGoogleAuthCode(googleCode)
          if (!isMounted) return
          clearGoogleAuthSearch()
          clearActiveSessionState()
          finalizeAuthenticatedSession(session)
          return
        }

        const user = await api.getSession()
        if (!isMounted || !user) return
        setAuthUser(user)
        setApiReady(true)
      } catch (error) {
        if (!isMounted) return
        const message = error instanceof Error ? error.message : ''
        if (readGoogleAuthSearch().googleCode) {
          clearGoogleAuthSearch()
        }
        if (message) {
          setAuthError(message)
        }
      } finally {
        if (isMounted) {
          setAuthUiAction(null)
          setIsAuthLoading(false)
        }
      }
    })()

    return () => {
      isMounted = false
    }
  }, [auth0Enabled, authProvider, clearActiveSessionState])

  useEffect(() => {
    const needsAuth = Boolean(requiresAuth[currentPage])
    if (!needsAuth) return
    if (!isOtpTargetPage(currentPage)) return
    if (authUser) return
    if (authToken) return
    if (auth0Enabled && isAuthLoading) return
    if (authProvider === 'local' && isAuthLoading) return

    const targetPath = resolveTabCanonicalPath(window.location.pathname) ?? resolveReturnTo()
    const authPage = resolveAuthPageFromPath(window.location.pathname)
    setPostLoginPage(currentPage)
    setPostLoginAuthPage(authPage)
    setPostLoginPath(
      targetPath && isTabPathForPage(targetPath, currentPage) ? targetPath : null
    )
    writeStoredPostLoginTarget({
      page: currentPage,
      authPage,
      path: targetPath && isTabPathForPage(targetPath, currentPage) ? targetPath : null,
    })
    navigateToPage(authPage, {
      replace: true,
      state: {
        returnTo: targetPath && isTabPathForPage(targetPath, currentPage) ? targetPath : undefined,
      },
    })
  }, [auth0Enabled, authProvider, authToken, authUser, currentPage, isAuthLoading, navigateToPage])

  useEffect(() => {
    let isMounted = true

    const loadProtectedData = async () => {
      const hasAuthenticatedSession =
        Boolean(authToken) || (authProvider === 'local' && Boolean(authUser))
      if (!hasAuthenticatedSession) return
      setIsAuthLoading(true)
      try {
        const user = await api.getSession()
        if (!isMounted) return
        setAuthUser((previous) => (areAuthUsersEqual(previous, user) ? previous : user))

        let reservationData: Reservation[] = []
        let ledgerData: LedgerEntry[] = []
        let protectedDataError: string | null = null

        try {
          reservationData = await api.getAppointments()
        } catch (error) {
          const message = error instanceof Error ? error.message : ''
          if (isUnauthorizedSessionError(message)) {
            throw error
          }
          protectedDataError = message || 'Unable to load appointments right now.'
        }

        if (user.role === 'admin' || user.role === 'system_admin') {
          try {
            ledgerData = await api.getLedger()
          } catch (error) {
            const message = error instanceof Error ? error.message : ''
            if (isUnauthorizedSessionError(message)) {
              throw error
            }
            if (!protectedDataError) {
              protectedDataError = message || 'Unable to load ledger data right now.'
            }
          }
        }

        if (!isMounted) return
        setStoreReservations(reservationData)
        setStoreLedgerEntries(ledgerData)
        setApiReady(true)
        setAuthError(protectedDataError)
      } catch (error) {
        console.error('API unavailable or unauthorized for authenticated session.', error)
        const message = error instanceof Error ? error.message : ''
        const isUnauthorized = isUnauthorizedSessionError(message)

        if (isUnauthorized && isMounted) {
          clearUnauthorizedSession()
          setAuthError('Session expired or unauthorized. Please sign in again.')
          setStoreReservations([])
          setStoreLedgerEntries([])
          return
        }

        if (isMounted) {
          setStoreReservations([])
          setStoreLedgerEntries([])
          setAuthError(message || 'Unable to load account data right now.')
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
    authProvider,
    authToken,
    authUser,
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
      throw (error instanceof Error ? error : new Error('Failed to create reservation'))
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
    const storedTarget = getStoredTarget()
    setAuthError(null)
    setAuthUiAction('provider')
    setIsAuthLoading(true)
    try {
      await startAuth0Login(targetPage ?? postLoginPage ?? storedTarget?.page ?? undefined)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Auth0 login failed')
      setAuthUiAction(null)
      setIsAuthLoading(false)
    }
  }

  const resolveTargetDashboardPath = (
    targetPath: string | null | undefined,
    page: AppPage
  ) => {
    if (!targetPath) return null
    const canonical = resolveTabCanonicalPath(targetPath)
    if (!canonical) return null
    if (!isTabPathForPage(canonical, page)) return null
    return canonical
  }

  const getStoredTarget = () => readStoredPostLoginTarget()

  const resolveIntendedProtectedPage = (requestedPage?: AppPage | null): OtpTargetPage => {
    if (isOtpTargetPage(requestedPage)) return requestedPage
    if (isOtpTargetPage(postLoginPage)) return postLoginPage
    const storedTarget = getStoredTarget()
    if (isOtpTargetPage(storedTarget?.page)) return storedTarget.page
    if (currentPage === 'admin_login') return 'admin'
    if (currentPage === 'doctor_login') return 'doctor_dashboard'
    return 'appointments'
  }

  const resolveOtpSourcePage = (targetPage: OtpTargetPage): OtpSourcePage => {
    if (isOtpSourcePage(currentPage)) return currentPage
    return resolveAuthPageForProtectedPage(targetPage)
  }

  const navigateToOtpSource = (
    sourcePage?: OtpSourcePage | null,
    options?: { replace?: boolean }
  ) => {
    const storedTarget = getStoredTarget()
    navigateToPage(
      sourcePage ??
        postLoginAuthPage ??
        storedTarget?.authPage ??
        resolveAuthPageForProtectedPage(postLoginPage),
      {
        replace: options?.replace,
      }
    )
  }

  const finalizeAuthenticatedSession = (
    session: AuthSession,
    preferredTargetPage?: AppPage | null,
    preferredTargetPath?: string | null
  ) => {
    const storedTarget = getStoredTarget()
    const resolvedToken = authProvider === 'local' ? null : session.token ?? null
    setAuthTokenState(resolvedToken)
    setCsrfToken(session.csrfToken ?? null)
    setAuthUser(session.user)
    setApiReady(true)

    const defaultPageByRole = getDefaultPageForRole(session.user.role, session.user.accountType)
    const resolvedTargetPage = preferredTargetPage ?? storedTarget?.page ?? defaultPageByRole
    const finalTargetPage = session.user.role === 'user' ? defaultPageByRole : resolvedTargetPage
    const isAdminDashboardTarget = finalTargetPage === 'admin'
    const isDoctorDashboardTarget = finalTargetPage === 'doctor_dashboard'
    const hasAdminDashboardRole = isAdminRole(session.user.role, session.user.accountType)
    const hasDoctorDashboardRole = isDoctorRole(session.user.role, session.user.accountType)

    setPendingOtpChallenge(null)
    setPostLoginPage(null)
    setPostLoginPath(null)
    setPostLoginAuthPage(null)
    clearStoredPostLoginTarget()

    if (isAdminDashboardTarget && !hasAdminDashboardRole) {
      if (hasDoctorDashboardRole) {
        navigateToPage('doctor_dashboard')
        return
      }
      setAuthError('Admin account required for Admin Dashboard.')
      navigateToPage('admin_login')
      return
    }

    if (isDoctorDashboardTarget && !hasDoctorDashboardRole) {
      if (hasAdminDashboardRole) {
        navigateToPage('admin')
        return
      }
      setAuthError('Doctor account required for Doctor Dashboard.')
      navigateToPage('doctor_login')
      return
    }

    const resolvedTargetPath =
      resolveTargetDashboardPath(preferredTargetPath, finalTargetPage) ??
      resolveTargetDashboardPath(postLoginPath, finalTargetPage) ??
      resolveTargetDashboardPath(storedTarget?.path, finalTargetPage)

    if (resolvedTargetPath) {
      navigateToPage(finalTargetPage, { path: resolvedTargetPath })
      return
    }

    navigateToPage(finalTargetPage)
  }

  const handleLogin = async (username: string, password: string, targetPage?: AppPage) => {
    if (auth0Enabled) {
      await handleProviderLogin(targetPage)
      return
    }
    const storedTarget = getStoredTarget()
    const resolvedTargetPage = resolveIntendedProtectedPage(targetPage)
    const resolvedTargetPath =
      resolveTargetDashboardPath(postLoginPath, resolvedTargetPage) ??
      resolveTargetDashboardPath(resolveReturnTo(), resolvedTargetPage) ??
      resolveTargetDashboardPath(storedTarget?.path, resolvedTargetPage)
    const sourcePage = resolveOtpSourcePage(resolvedTargetPage)

    setAuthError(null)
    setPendingOtpChallenge(null)
    setAuthUiAction('login')
    setIsAuthLoading(true)
    setPostLoginPage(resolvedTargetPage)
    setPostLoginPath(resolvedTargetPath)
    setPostLoginAuthPage(sourcePage)
    writeStoredPostLoginTarget({
      page: resolvedTargetPage,
      authPage: sourcePage,
      path: resolvedTargetPath,
    })
    try {
      const result = await api.login(username, password, sourcePage)

      if ((result as any)?.challengeId) {
        clearActiveSessionState()
        setPendingOtpChallenge({
          ...(result as LoginOtpChallenge),
          sourcePage,
          targetPage: resolvedTargetPage,
          targetPath: resolvedTargetPath,
        })
        navigateToPage('otp', {
          state: {
            returnTo: resolvedTargetPath ?? undefined,
          },
        })
        return
      }

      const session = result as unknown as AuthSession
      clearActiveSessionState()
      finalizeAuthenticatedSession(session, resolvedTargetPage, resolvedTargetPath)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Login failed')
    } finally {
      setAuthUiAction(null)
      setIsAuthLoading(false)
    }
  }

  const handleVerifyOtp = async (code: string) => {
    if (!pendingOtpChallenge) {
      setAuthError('No active OTP challenge. Start login again.')
      navigateToOtpSource(undefined, { replace: true })
      return
    }

    setAuthError(null)
    setAuthUiAction('otp')
    setIsAuthLoading(true)
    try {
      const session = await api.verifyOtpLogin(pendingOtpChallenge.challengeId, code)
      const storedTarget = getStoredTarget()
      const resolvedTargetPage =
        pendingOtpChallenge.targetPage ?? postLoginPage ?? storedTarget?.page ?? null
      const resolvedTargetPath =
        pendingOtpChallenge.targetPath ??
        (resolvedTargetPage
          ? resolveTargetDashboardPath(postLoginPath, resolvedTargetPage) ??
            resolveTargetDashboardPath(storedTarget?.path, resolvedTargetPage)
          : null)
      finalizeAuthenticatedSession(session, resolvedTargetPage, resolvedTargetPath)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OTP verification failed'
      if (otpRestartPattern.test(message)) {
        setPendingOtpChallenge(null)
        setAuthError(message)
        navigateToOtpSource(pendingOtpChallenge.sourcePage, { replace: true })
        return
      }
      setAuthError(message)
    } finally {
      setAuthUiAction(null)
      setIsAuthLoading(false)
    }
  }

  const handleCancelOtp = () => {
    const storedTarget = getStoredTarget()
    const sourcePage =
      pendingOtpChallenge?.sourcePage ??
      postLoginAuthPage ??
      storedTarget?.authPage ??
      resolveAuthPageForProtectedPage(postLoginPage)
    setAuthError(null)
    setAuthUiAction(null)
    setPendingOtpChallenge(null)
    navigateToPage(sourcePage, { replace: true })
  }

  const handleResendOtp = async () => {
    if (!pendingOtpChallenge) {
      setAuthError('No active OTP challenge. Start login again.')
      navigateToOtpSource(undefined, { replace: true })
      return
    }

    setAuthError(null)
    try {
      const resentChallenge = await api.resendOtp(pendingOtpChallenge.challengeId)
      setPendingOtpChallenge((previous) => {
        if (!previous) return previous
        return {
          ...previous,
          challengeId: resentChallenge.challengeId,
          expiresInSeconds: resentChallenge.expiresInSeconds,
          expiresAt: new Date(
            Date.now() + resentChallenge.expiresInSeconds * 1000
          ).toISOString(),
          otpPreview: resentChallenge.otpPreview ?? previous.otpPreview,
        }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to resend OTP'
      if (otpRestartPattern.test(message)) {
        setPendingOtpChallenge(null)
        setAuthError(message)
        navigateToOtpSource(pendingOtpChallenge.sourcePage, { replace: true })
        return
      }
      setAuthError(message)
    }
  }

  const handleSignupSuccess = (session?: AuthSession) => {
    if (session) {
      finalizeAuthenticatedSession(session)
      return
    }

    setAuthError(null)
    setAuthUiAction(null)
    setCsrfToken(null)
    setPendingOtpChallenge(null)
    setPostLoginPage(null)
    setPostLoginPath(null)
    setPostLoginAuthPage(null)
    clearStoredPostLoginTarget()
    navigateToPage('login')
  }

  const patchAuthUser = useCallback((updates: Partial<AuthSession['user']>) => {
    setAuthUser((previous) => {
      if (!previous) return previous
      return { ...previous, ...updates }
    })
  }, [])

  const handleLogout = async (
    target?: 'login' | 'landing' | 'admin_login' | 'doctor_login'
  ) => {
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
    setCsrfToken(null)
    setAuthUser(null)
    setAuthError(null)
    setAuthUiAction(null)
    clearLocalTokenStorage()
    clearSensitiveData()
    setPendingOtpChallenge(null)
    setApiReady(false)
    setPostLoginPage(null)
    setPostLoginPath(null)
    setPostLoginAuthPage(null)
    clearStoredPostLoginTarget()

    // Determine where to navigate after logout
    if (target) {
      navigateToPage(target)
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
      (((authToken && (isAuthLoading || !apiReady)) ||
        (authProvider === 'local' && isAuthLoading) ||
        (auth0Enabled && isAuthLoading)))
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
    authUiAction,
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
    handleResendOtp,
    handleSignupSuccess,
    patchAuthUser,
    handleLogout,
    idleWarningOpen,
    idleRemainingSeconds,
    acknowledgeIdle,
  }
}

export default useAuthData

import { useCallback, useEffect, useState } from 'react'
import AccessPage from './pages/AccessPage'
import AdminDashboard from './pages/AdminDashboard'
import ContactPage from './pages/ContactPage'
import Dashboard from './pages/Dashboard'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import PatientProfile from './pages/PatientProfile'
import SignupPage from './pages/SignupPage'
import TriagePage from './pages/TriagePage'
import useScrollReveal from './hooks/useScrollReveal'
import { api, setAuthToken } from './services/api'
import type { AppPage } from './types/navigation'
import type { AuthSession, LedgerEntry, Reservation, ReservationDraft, UserRole } from './types/triage'

const fallbackReservations: Reservation[] = [
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

const fallbackLedger: LedgerEntry[] = [
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

const PAGE_ROUTES: Record<AppPage, string> = {
  landing: '/',
  access: '/access',
  triage: '/triage',
  dashboard: '/dashboard',
  admin: '/admin',
  login: '/login',
  signup: '/signup',
  patient: '/patient',
  contact: '/contact',
}

const buildRoute = (page: AppPage) => {
  const base = import.meta.env.BASE_URL || '/'
  const baseTrimmed = base === '/' ? '' : base.replace(/\/$/, '')
  const route = PAGE_ROUTES[page]
  if (!baseTrimmed) return route
  if (route === '/') return baseTrimmed || '/'
  return `${baseTrimmed}${route}`
}

const normalizePath = (path: string) => {
  const [pathname] = path.split('?')
  let cleaned = pathname || '/'
  const base = import.meta.env.BASE_URL || '/'
  const baseTrimmed = base === '/' ? '' : base.replace(/\/$/, '')
  if (
    baseTrimmed &&
    (cleaned === baseTrimmed || cleaned.startsWith(`${baseTrimmed}/`))
  ) {
    cleaned = cleaned.slice(baseTrimmed.length) || '/'
  }
  if (!cleaned.startsWith('/')) cleaned = `/${cleaned}`
  if (cleaned.length > 1 && cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1)
  }
  return cleaned
}

const resolvePageFromPath = (path: string): AppPage => {
  const normalized = normalizePath(path)
  const match = (Object.entries(PAGE_ROUTES) as Array<[AppPage, string]>).find(
    ([, route]) => normalizePath(route) === normalized
  )
  return match?.[0] ?? 'landing'
}

const allRoles: UserRole[] = ['user', 'nurse', 'admin', 'system_admin']

const requiresAuth: Partial<Record<AppPage, UserRole[]>> = {
  triage: allRoles,
  dashboard: ['nurse', 'admin', 'system_admin'],
  admin: ['admin', 'system_admin'],
}

const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem('pulse-ledger-theme')
  if (stored === 'light' || stored === 'dark') return stored
  return 'light'
}

function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>(() => {
    if (typeof window === 'undefined') return 'landing'
    return resolvePageFromPath(window.location.pathname)
  })
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [latestReservationId, setLatestReservationId] = useState<string | null>(null)
  const [apiReady, setApiReady] = useState(false)
  const [authToken, setAuthTokenState] = useState<string | null>(null)
  const [authUser, setAuthUser] = useState<AuthSession['user'] | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [postLoginPage, setPostLoginPage] = useState<AppPage | null>(null)

  const navigateToPage = useCallback(
    (page: AppPage, options?: { replace?: boolean; scroll?: boolean }) => {
      setCurrentPage(page)
      if (typeof window === 'undefined') return
      const target = buildRoute(page)
      const nextPath = normalizePath(target)
      const currentPath = normalizePath(window.location.pathname)
      if (nextPath !== currentPath) {
        if (options?.replace) {
          window.history.replaceState({}, '', target)
        } else {
          window.history.pushState({}, '', target)
        }
      }
      if (options?.scroll !== false) {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
      }
    },
    []
  )

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const canAccessPage = (page: AppPage, role?: UserRole | null) => {
    const allowedRoles = requiresAuth[page]
    if (!allowedRoles) return true
    if (!role) return false
    return allowedRoles.includes(role)
  }

  const isLanding = currentPage === 'landing'
  useScrollReveal(currentPage)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = document.documentElement
    root.classList.remove('theme-dark', 'theme-light')
    root.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light')
    document.body.classList.remove('theme-dark', 'theme-light')
    document.body.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light')
    window.localStorage.setItem('pulse-ledger-theme', theme)
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePopState = () => {
      const resolved = resolvePageFromPath(window.location.pathname)
      setCurrentPage(resolved)
      const normalized = normalizePath(window.location.pathname)
      const known = Object.values(PAGE_ROUTES).some(
        (route) => normalizePath(route) === normalized
      )
      if (!known) {
        navigateToPage('landing', { replace: true })
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [navigateToPage])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const normalized = normalizePath(window.location.pathname)
    const known = Object.values(PAGE_ROUTES).some(
      (route) => normalizePath(route) === normalized
    )
    if (!known) {
      navigateToPage('landing', { replace: true })
    }
  }, [navigateToPage])

  useEffect(() => {
    const needsAuth = Boolean(requiresAuth[currentPage])
    if (!needsAuth) return
    if (authUser) return
    if (authToken && isAuthLoading) return
    if (currentPage !== 'access') {
      setPostLoginPage(currentPage)
      navigateToPage('access', { replace: true })
    }
  }, [authToken, authUser, currentPage, isAuthLoading, navigateToPage])
  const latestReservation = latestReservationId
    ? reservations.find((reservation) => reservation.id === latestReservationId)
    : undefined

  useEffect(() => {
    const storedToken = localStorage.getItem('pulse-ledger-token')
    if (storedToken) {
      setAuthTokenState(storedToken)
      setAuthToken(storedToken)
      setIsAuthLoading(true)
    }
  }, [])

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
          setAuthToken(null)
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

  const handleLogin = async (username: string, password: string) => {
    setAuthError(null)
    setIsAuthLoading(true)
    try {
      const session = await api.login(username, password)
      setAuthTokenState(session.token)
      setAuthToken(session.token)
      setAuthUser(session.user)
      localStorage.setItem('pulse-ledger-token', session.token)
      setApiReady(true)
      const targetPage = postLoginPage ?? 'dashboard'
      setPostLoginPage(null)
      navigateToPage(targetPage)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Login failed')
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleLogout = () => {
    setAuthTokenState(null)
    setAuthUser(null)
    setAuthError(null)
    setAuthToken(null)
    localStorage.removeItem('pulse-ledger-token')
    setReservations([])
    setLedgerEntries([])
    setApiReady(false)
    setPostLoginPage(null)
    navigateToPage('landing')
  }

  const isCheckingSession = Boolean(authToken && isAuthLoading && !authUser)

  const AuthLoadingCard = ({ label }: { label: string }) => (
    <div className="min-h-screen pb-20">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div
          className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 text-sm text-white/70 shadow-2xl shadow-black/40"
          data-reveal
        >
          {label}
        </div>
      </div>
    </div>
  )

  const AccessDenied = ({ title, detail }: { title: string; detail: string }) => (
    <div className="min-h-screen pb-20">
      <div className="mx-auto w-full max-w-4xl px-6 py-14">
        <div
          className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-8 shadow-2xl shadow-black/40"
          data-reveal
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
            Access blocked
          </p>
          <h1 className="mt-2 text-2xl font-display font-semibold text-white">{title}</h1>
          <p className="mt-2 text-sm text-[color:var(--agent-muted)]">{detail}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => navigateToPage('access')}
              className="rounded-xl bg-[color:var(--agent-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--agent-on-accent)] transition hover:-translate-y-0.5"
            >
              Switch account
            </button>
            <button
              onClick={() => navigateToPage('landing')}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
            >
              Back to overview
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div
      className={`${theme === 'dark' ? 'theme-dark' : 'theme-light'} relative min-h-screen bg-[color:var(--agent-bg)] text-[color:var(--agent-ink)]`}
    >
      {!isLanding && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 agent-grid opacity-20" />
          <div className="absolute -top-48 left-[15%] h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(124,252,196,0.3),_transparent_65%)] blur-3xl animate-drift-slow" />
          <div className="absolute top-1/3 right-[5%] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,_rgba(90,215,255,0.28),_transparent_60%)] blur-3xl animate-drift" />
          <div className="absolute bottom-[-120px] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(255,209,102,0.2),_transparent_65%)] blur-3xl animate-float-slow" />
        </div>
      )}

      <div className="relative z-10">
        {!isLanding && (
          <header className="sticky top-0 z-40 border-b border-white/10 bg-[color:var(--agent-bg)] shadow-[0_6px_20px_rgba(0,0,0,0.35)]">
            <div className="mx-auto w-full max-w-6xl px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <button
                  onClick={() => navigateToPage('landing')}
                  className="flex items-center gap-3 text-left"
                >
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/5 shadow-lg shadow-black/40">
                    <svg
                      className="h-6 w-6 text-[color:var(--agent-accent)]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 12h4l2-3 3 6 2-3h5"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Pulse Ledger</p>
                    <p className="text-xs text-white/50">Decision Tree triage management</p>
                  </div>
                </button>

              <nav className="flex flex-wrap items-center gap-3">
                <button
                  onClick={toggleTheme}
                  className="rounded-full border border-white/10 px-5 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                </button>
                <button
                  onClick={() => navigateToPage('triage')}
                  className="rounded-full bg-[color:var(--agent-accent)] px-5 py-2 text-xs font-semibold text-[color:var(--agent-on-accent)] shadow-lg transition hover:-translate-y-0.5"
                >
                  Get Started
                </button>
                <button
                  onClick={() => navigateToPage('access')}
                  className="rounded-full border border-white/10 px-5 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  Log in
                </button>
                </nav>
              </div>
            </div>
          </header>
        )}

        <main className={isLanding ? '' : 'pt-20'}>
          {currentPage === 'landing' && (
            <LandingPage
              onNavigate={navigateToPage}
              onCreateReservation={handleCreateReservation}
              latestReservation={latestReservation}
              theme={theme}
              onToggleTheme={toggleTheme}
            />
          )}
          {currentPage === 'access' && (
            <AccessPage
              isAuthLoading={isAuthLoading}
              onLogin={handleLogin}
            />
          )}
          {currentPage === 'triage' && (
            <TriagePage
              onCreateReservation={handleCreateReservation}
              latestReservation={latestReservation}
            />
          )}
          {currentPage === 'dashboard' &&
            (isCheckingSession ? (
              <AuthLoadingCard label="Checking dashboard access..." />
            ) : !authUser ? (
              <LoginPage
                authUser={authUser}
                authError={authError}
                isAuthLoading={isAuthLoading}
                onLogin={handleLogin}
                onLogout={handleLogout}
                apiReady={apiReady}
                onNavigate={navigateToPage}
              />
            ) : !canAccessPage('dashboard', authUser.role) ? (
              <AccessDenied
                title="Dashboard access required"
                detail="Your account does not have permission to view operational dashboards. Ask an Admin or System Admin to grant Nurse/Doctor or Admin access."
              />
            ) : (
              <Dashboard
                reservations={reservations}
                ledgerEntries={ledgerEntries}
                authUser={authUser}
                authError={authError}
                isAuthLoading={isAuthLoading}
                onLogin={handleLogin}
                onLogout={handleLogout}
                apiReady={apiReady}
              />
            ))}
          {currentPage === 'admin' &&
            (isCheckingSession ? (
              <AuthLoadingCard label="Checking admin access..." />
            ) : !authUser ? (
              <LoginPage
                authUser={authUser}
                authError={authError}
                isAuthLoading={isAuthLoading}
                onLogin={handleLogin}
                onLogout={handleLogout}
                apiReady={apiReady}
                onNavigate={navigateToPage}
              />
            ) : !canAccessPage('admin', authUser.role) ? (
              <AccessDenied
                title="Admin access required"
                detail="This section is limited to Admin and System Admin roles. Sign in with the correct role or request elevated access."
              />
            ) : (
              <AdminDashboard authUser={authUser} />
            ))}
          {currentPage === 'login' &&
            (isCheckingSession ? (
              <AuthLoadingCard label="Checking session..." />
            ) : (
              <LoginPage
                authUser={authUser}
                authError={authError}
                isAuthLoading={isAuthLoading}
                onLogin={handleLogin}
                onLogout={handleLogout}
                apiReady={apiReady}
                onNavigate={navigateToPage}
              />
            ))}
          {currentPage === 'signup' && <SignupPage onNavigate={navigateToPage} />}
          {currentPage === 'contact' && <ContactPage />}
          {currentPage === 'patient' && <PatientProfile />}
        </main>

        {!isLanding && !apiReady && (
          <div className="fixed bottom-6 right-6 rounded-2xl border border-amber-400/30 bg-amber-400/15 px-4 py-3 text-xs font-semibold text-amber-200 shadow-lg shadow-black/40">
            {authToken ? 'API offline - showing local fallback data.' : 'Sign in to access live data.'}
          </div>
        )}
      </div>
    </div>
  )
}

export default App

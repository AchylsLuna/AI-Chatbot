import { useEffect, useState } from 'react'
import ContactPage from './pages/ContactPage'
import Dashboard from './pages/Dashboard'
import LandingPage from './pages/LandingPage'
import PatientProfile from './pages/PatientProfile'
import TriagePage from './pages/TriagePage'
import useScrollReveal from './hooks/useScrollReveal'
import { api, setAuthToken } from './services/api'
import type {
  AuthSession,
  LedgerEntry,
  Reservation,
  ReservationDraft,
  ReservationStatus,
} from './types/triage'

type PageType = 'landing' | 'triage' | 'dashboard' | 'contact' | 'patient'

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
    status: 'Pending',
    summary: 'AI summary: Shortness of breath on exertion. Recommend Cardiology.',
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
    status: 'Approved',
    summary: 'AI summary: Persistent rash with mild itching. Recommend Dermatology.',
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
  },
]

const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem('pulse-ledger-theme')
  if (stored === 'light' || stored === 'dark') return stored
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('landing')
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([])
  const [latestReservationId, setLatestReservationId] = useState<string | null>(null)
  const [apiReady, setApiReady] = useState(false)
  const [authToken, setAuthTokenState] = useState<string | null>(null)
  const [authUser, setAuthUser] = useState<AuthSession['user'] | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isAuthLoading, setIsAuthLoading] = useState(false)

  const isLanding = currentPage === 'landing'
  useScrollReveal(currentPage)
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('pulse-ledger-theme', theme)
  }, [theme])
  const latestReservation = latestReservationId
    ? reservations.find((reservation) => reservation.id === latestReservationId)
    : undefined

  useEffect(() => {
    const storedToken = localStorage.getItem('pulse-ledger-token')
    if (storedToken) {
      setAuthTokenState(storedToken)
      setAuthToken(storedToken)
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
      const reservation = await api.createReservation(draft)
      setReservations((prev) => [reservation, ...prev])
      setLatestReservationId(reservation.id)
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
        status: 'Pending',
        summary: draft.summary.summary,
      }
      setReservations((prev) => [fallback, ...prev])
      setLatestReservationId(fallback.id)
    }
  }

  const handleUpdateStatus = async (reservationId: string, status: ReservationStatus) => {
    try {
      const { reservation, ledgerEntry } = await api.updateReservationStatus(reservationId, status)
      setReservations((prev) =>
        prev.map((item) => (item.id === reservation.id ? reservation : item))
      )
      if (ledgerEntry) {
        setLedgerEntries((prev) => [ledgerEntry, ...prev])
      }
      setApiReady(true)
    } catch (error) {
      console.error('Failed to update reservation status', error)
      setReservations((prev) =>
        prev.map((item) => (item.id === reservationId ? { ...item, status } : item))
      )
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
  }

  const navItems = [
    {
      label: 'Guided Intake',
      page: 'triage',
      icon: 'M9 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    },
    {
      label: 'Nurse Dashboard',
      page: 'dashboard',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    },
    {
      label: 'Patient Profile',
      page: 'patient',
      icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    },
    {
      label: 'Contact',
      page: 'contact',
      icon: 'M21 8V7a2 2 0 00-2-2H5a2 2 0 00-2 2v1m18 0l-9 6-9-6m18 0v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8',
    },
  ] as const

  return (
    <div
      className={`${theme === 'dark' ? 'theme-dark' : 'theme-light'} relative min-h-screen bg-[color:var(--agent-bg)] text-[color:var(--agent-ink)]`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 agent-grid opacity-20" />
        <div className="absolute -top-48 left-[15%] h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(124,252,196,0.3),_transparent_65%)] blur-3xl animate-drift-slow" />
        <div className="absolute top-1/3 right-[5%] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,_rgba(90,215,255,0.28),_transparent_60%)] blur-3xl animate-drift" />
        <div className="absolute bottom-[-120px] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(255,209,102,0.2),_transparent_65%)] blur-3xl animate-float-slow" />
      </div>

      <div className="relative z-10">
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[color:var(--agent-bg)]/80 backdrop-blur">
          <div className="mx-auto w-full max-w-6xl px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                onClick={() => setCurrentPage('landing')}
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
                  <p className="text-xs text-white/50">AI triage management</p>
                </div>
              </button>

              <nav className="flex flex-wrap items-center gap-2">
                {navItems.map((item) => (
                  <button
                    key={item.page}
                    onClick={() => setCurrentPage(item.page)}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                      currentPage === item.page
                        ? 'bg-[color:var(--agent-accent)] text-[color:var(--agent-on-accent)] shadow-[0_12px_28px_rgba(124,252,196,0.28)]'
                        : 'border border-white/10 text-white/70 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                    {item.label}
                  </button>
                ))}
              </nav>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
                  aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                  {theme === 'dark' ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364-1.414 1.414M8.05 15.95l-1.414 1.414M15.95 15.95l1.414 1.414M8.05 8.05 6.636 6.636M12 7a5 5 0 100 10 5 5 0 000-10z"
                      />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"
                      />
                    </svg>
                  )}
                  {theme === 'dark' ? 'Light' : 'Dark'}
                </button>
                <button
                  onClick={() => setCurrentPage(isLanding ? 'triage' : 'dashboard')}
                  className="rounded-full bg-white px-5 py-2 text-xs font-semibold text-[color:var(--agent-on-light)] shadow-lg transition hover:-translate-y-0.5"
                >
                  {isLanding ? 'Start guided intake' : 'Launch nurse console'}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main>
          {currentPage === 'landing' && <LandingPage onNavigate={setCurrentPage} />}
          {currentPage === 'triage' && (
            <TriagePage
              onCreateReservation={handleCreateReservation}
              latestReservation={latestReservation}
            />
          )}
          {currentPage === 'dashboard' && (
            <Dashboard
              reservations={reservations}
              ledgerEntries={ledgerEntries}
              onUpdateStatus={handleUpdateStatus}
              authUser={authUser}
              authError={authError}
              isAuthLoading={isAuthLoading}
              onLogin={handleLogin}
              onLogout={handleLogout}
              apiReady={apiReady}
            />
          )}
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

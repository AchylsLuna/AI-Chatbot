import { useMemo, useState, type ReactNode } from 'react'
import GlobalAssistantChat from './components/chat/GlobalAssistantChat'
import AppErrorBoundary from './components/states/AppErrorBoundary'
import { doctorNurseAssignments, fallbackReservations } from './config/fallbackData'
import useAppRouting from './hooks/useAppRouting'
import useScrollReveal from './hooks/useScrollReveal'
import useAppTheme from './hooks/useAppTheme'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AppointmentsPage from './pages/user/AppointmentsPage'
import DoctorDashboardPage from './pages/admin/DoctorDashboardPage'
import ForgotPasswordPage from './pages/user/ForgotPasswordPage'
import LandingPage from './pages/user/LandingPage'
import LoginPage from './pages/user/LoginPage'
import OtpPage from './pages/user/OtpPage'
import SignupPage from './pages/user/SignupPage'
import type {
  AppointmentUpdateDraft,
  AuthSession,
  LoginOtpChallenge,
  Reservation,
  ReservationCreateDraft,
} from './types'
import type { AppPage } from './types/navigation'

const cloneReservations = (): Reservation[] => fallbackReservations.map((reservation) => ({ ...reservation }))

const createDemoOtpChallenge = (username: string): LoginOtpChallenge => {
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  return {
    challengeId: `demo-${Date.now()}`,
    username,
    expiresAt,
    expiresInSeconds: 300,
    otpPreview: '123456',
  }
}

function App() {
  const { currentPage, navigateToPage, navigateBack, isLanding, isAuthPage } = useAppRouting()
  const { theme, toggleTheme } = useAppTheme(isLanding || isAuthPage)
  const [dataMaskingEnabled, setDataMaskingEnabled] = useState(true)
  const [reservations, setReservations] = useState<Reservation[]>(() => cloneReservations())
  const [authUser, setAuthUser] = useState<AuthSession['user'] | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [pendingOtpChallenge, setPendingOtpChallenge] = useState<LoginOtpChallenge | null>(() =>
    createDemoOtpChallenge('demo.user@aihealthcare.com')
  )

  const sessionStatus = authUser ? 'Demo session active' : 'Demo mode (no active session)'
  const latestReservation = useMemo(() => reservations[0], [reservations])

  useScrollReveal(`${currentPage}-${authUser?.role ?? 'guest'}`)

  const handleUpdateReservation = async (reservationId: string, updates: AppointmentUpdateDraft) => {
    const existing = reservations.find((reservation) => reservation.id === reservationId)
    if (!existing) {
      throw new Error('Appointment not found')
    }

    const nextReservation: Reservation = {
      ...existing,
      ...(updates.requestedTime ? { requestedTime: updates.requestedTime.trim() || existing.requestedTime } : {}),
      ...(updates.department ? { department: updates.department.trim() || existing.department } : {}),
      ...(updates.status ? { status: updates.status } : {}),
      ...(updates.priority ? { priority: updates.priority } : {}),
      ...(updates.summary ? { summary: updates.summary.trim() || existing.summary } : {}),
    }

    setReservations((previous) =>
      previous.map((reservation) => (reservation.id === reservationId ? nextReservation : reservation))
    )

    return nextReservation
  }

  const handleCreateReservation = async (draft: ReservationCreateDraft) => {
    const patientName = draft.patientName.trim()
    const symptoms = draft.symptoms.trim()
    const requestedTime = draft.requestedTime.trim()
    const major = draft.major.trim()
    const doctorName = draft.doctorName.trim()

    if (!patientName || !symptoms || !requestedTime || !major || !doctorName) {
      throw new Error('Please complete all booking details.')
    }

    const nextSequence =
      reservations.reduce((max, reservation) => {
        const matches = reservation.id.match(/\d+/g)
        if (!matches?.length) return max
        const numeric = Number(matches[matches.length - 1])
        if (!Number.isFinite(numeric)) return max
        return Math.max(max, numeric)
      }, 0) + 1

    const id = `RES-${String(nextSequence).padStart(4, '0')}`
    const normalizedSymptoms = symptoms.endsWith('.') ? symptoms.slice(0, -1) : symptoms

    const nextReservation: Reservation = {
      id,
      patientName,
      symptoms,
      department: major,
      doctorName,
      nurseName: doctorNurseAssignments[doctorName] ?? undefined,
      priority: 'Routine',
      confidence: 0.75,
      requestedTime,
      createdAt: new Date().toISOString(),
      status: 'Booked',
      summary: `Decision Tree summary: ${normalizedSymptoms}. Recommend ${major}.`,
    }

    setReservations((previous) => [nextReservation, ...previous])

    return nextReservation
  }

  const handleUserLogin = (username: string, password: string) => {
    void password
    const normalizedUsername = username.trim().toLowerCase() || 'demo.user@aihealthcare.com'
    setAuthError(null)
    setAuthUser({
      username: normalizedUsername,
      role: 'user',
      authMethod: 'demo',
      mfa: false,
      sessionId: `demo-user-${Date.now()}`,
    })
    setPendingOtpChallenge(createDemoOtpChallenge(normalizedUsername))
    navigateToPage('appointments')
  }

  const handleAdminLogin = (username: string, _password: string, targetPage?: AppPage) => {
    const normalizedUsername = username.trim().toLowerCase() || 'demo.admin@aihealthcare.com'
    setAuthError(null)
    setAuthUser({
      username: normalizedUsername,
      role: 'admin',
      authMethod: 'demo',
      mfa: true,
      sessionId: `demo-admin-${Date.now()}`,
    })
    navigateToPage(targetPage ?? 'doctor_dashboard')
  }

  const handleVerifyOtp = (code: string) => {
    void code
    setAuthError(null)
    setAuthUser((previous) => ({
      username: previous?.username ?? pendingOtpChallenge?.username ?? 'demo.user@aihealthcare.com',
      role: 'user',
      authMethod: 'demo-otp',
      mfa: true,
      sessionId: `demo-otp-${Date.now()}`,
    }))
    navigateToPage('appointments')
  }

  const handleCancelOtp = () => {
    navigateToPage('login')
  }

  const handleSignupSuccess = (session: AuthSession) => {
    setAuthError(null)
    setAuthUser({
      ...session.user,
      authMethod: session.user.authMethod || 'demo-signup',
    })
    navigateToPage('login')
  }

  const handleLogout = () => {
    setAuthError(null)
    setAuthUser(null)
    setPendingOtpChallenge(createDemoOtpChallenge('demo.user@aihealthcare.com'))
    navigateToPage('landing')
  }

  const withWorkspaceBoundary = (content: ReactNode, section: string) => (
    <AppErrorBoundary section={section} resetKey={`${currentPage}-${authUser?.role ?? 'guest'}`}>
      {content}
    </AppErrorBoundary>
  )

  let pageContent: ReactNode

  switch (currentPage) {
    case 'landing':
      pageContent = (
        <LandingPage
          onNavigate={navigateToPage}
          latestReservation={latestReservation}
          isAuthenticated={Boolean(authUser)}
        />
      )
      break

    case 'appointments':
      pageContent = withWorkspaceBoundary(
        <AppointmentsPage
          reservations={reservations}
          authUser={authUser}
          onNavigate={navigateToPage}
          onCreateReservation={handleCreateReservation}
          sessionStatus={sessionStatus}
          theme={theme}
          onToggleTheme={toggleTheme}
          dataMaskingEnabled={dataMaskingEnabled}
          onToggleDataMasking={() => setDataMaskingEnabled((previous) => !previous)}
        />,
        'Appointments workspace'
      )
      break

    case 'doctor_dashboard':
      pageContent = withWorkspaceBoundary(
        <DoctorDashboardPage
          reservations={reservations}
          authUser={authUser}
          onNavigate={navigateToPage}
          onLogout={handleLogout}
          onUpdateReservation={handleUpdateReservation}
          sessionStatus={sessionStatus}
          theme={theme}
          onToggleTheme={toggleTheme}
          dataMaskingEnabled={dataMaskingEnabled}
          onToggleDataMasking={() => setDataMaskingEnabled((previous) => !previous)}
        />,
        "Doctor's dashboard"
      )
      break

    case 'admin':
      pageContent = withWorkspaceBoundary(
        <AdminDashboard
          authUser={authUser}
          reservations={reservations}
          onNavigate={navigateToPage}
          onLogout={handleLogout}
          sessionStatus={sessionStatus}
          theme={theme}
          onToggleTheme={toggleTheme}
          dataMaskingEnabled={dataMaskingEnabled}
          onToggleDataMasking={() => setDataMaskingEnabled((previous) => !previous)}
        />,
        'Admin dashboard'
      )
      break

    case 'admin_login':
      pageContent = (
        <AdminLoginPage
          authUser={authUser}
          authError={authError}
          isAuthLoading={false}
          onLogin={handleAdminLogin}
          onLogout={handleLogout}
          onNavigate={navigateToPage}
          onGoBack={() => navigateBack('landing')}
        />
      )
      break

    case 'login':
      pageContent = (
        <LoginPage
          authUser={authUser}
          authError={authError}
          isAuthLoading={false}
          onLogin={handleUserLogin}
          onLogout={handleLogout}
          onNavigate={navigateToPage}
          onGoBack={() => navigateBack('landing')}
        />
      )
      break

    case 'otp':
      pageContent = (
        <OtpPage
          challenge={pendingOtpChallenge}
          authError={authError}
          isAuthLoading={false}
          onVerifyOtp={handleVerifyOtp}
          onCancelOtp={handleCancelOtp}
          onNavigate={navigateToPage}
        />
      )
      break

    case 'signup':
      pageContent = (
        <SignupPage
          onNavigate={navigateToPage}
          onSignupSuccess={handleSignupSuccess}
          onGoBack={() => navigateBack('login')}
        />
      )
      break

    case 'forgot_password':
      pageContent = (
        <ForgotPasswordPage onNavigate={navigateToPage} onGoBack={() => navigateBack('login')} />
      )
      break

    default:
      pageContent = null
  }

  return (
    <div
      className={`${theme === 'dark' ? 'theme-dark' : 'theme-light'} relative min-h-screen bg-[color:var(--agent-bg)] text-[color:var(--agent-ink)]`}
    >
      {!isLanding && !authUser && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 agent-grid opacity-15" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.08),transparent_55%)]" />
        </div>
      )}

      <div className="relative z-10">
        <main>{pageContent}</main>
        <GlobalAssistantChat
          key={`global-chat-${authUser?.username ?? 'guest'}-${authUser?.role ?? 'guest'}`}
          isIdentified={Boolean(authUser)}
          userRole={authUser?.role ?? null}
        />
      </div>
    </div>
  )
}

export default App

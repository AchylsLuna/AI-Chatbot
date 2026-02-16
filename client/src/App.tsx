import { useEffect, useState, type ReactNode } from 'react'
import GlobalAssistantChat from './components/chat/GlobalAssistantChat'
import AppHeader from './components/layout/AppHeader'
import WorkspaceHeader from './components/layout/WorkspaceHeader'
import AppErrorBoundary from './components/states/AppErrorBoundary'
import { AccessDeniedCard, AuthLoadingCard } from './components/states/RouteGuardCards'
import { canAccessPage } from './config/accessControl'
import useAuthData from './hooks/useAuthData'
import useAppRouting from './hooks/useAppRouting'
import useScrollReveal from './hooks/useScrollReveal'
import useAppTheme from './hooks/useAppTheme'
import AdminDashboard from './pages/AdminDashboard'
import AdminLoginPage from './pages/AdminLoginPage'
import AppointmentsPage from './pages/AppointmentsPage'
import Dashboard from './pages/Dashboard'
import DoctorDashboardPage from './pages/DoctorDashboardPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import OtpPage from './pages/OtpPage'
import SignupPage from './pages/SignupPage'
import TriagePage from './pages/TriagePage'
import type { AppPage } from './types/navigation'

type DashboardWorkspacePage =
  | 'dashboard'
  | 'analytics'
  | 'clinical_reports'
  | 'care_alerts'
  | 'care_support'
  | 'ledger_monitoring'
  | 'intake_monitoring'
  | 'security'
  | 'user_management'

type ProtectedPage = 'triage' | 'appointments' | 'doctor_dashboard' | DashboardWorkspacePage

const dashboardWorkspacePages: DashboardWorkspacePage[] = [
  'dashboard',
  'analytics',
  'clinical_reports',
  'care_alerts',
  'care_support',
  'ledger_monitoring',
  'intake_monitoring',
  'security',
  'user_management',
]

function App() {
  const { currentPage, navigateToPage, navigateBack, isLanding, isAuthPage } = useAppRouting()
  const { theme, toggleTheme } = useAppTheme(isLanding || isAuthPage)
  const [dataMaskingEnabled, setDataMaskingEnabled] = useState(true)

  const {
    authProvider,
    auth0Enabled,
    isBiometricReady,
    sessionStatus,
    apiReady,
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
  } = useAuthData({ currentPage, navigateToPage })
  const isDashboardWorkspaceRoute = (page: AppPage): page is DashboardWorkspacePage =>
    dashboardWorkspacePages.includes(page as DashboardWorkspacePage)

  const isProtectedRoute =
    currentPage === 'triage' ||
    currentPage === 'appointments' ||
    currentPage === 'doctor_dashboard' ||
    isDashboardWorkspaceRoute(currentPage) ||
    currentPage === 'admin'
  const showPublicHeader = !isLanding && !isAuthPage && !authUser && !isProtectedRoute
  const showWorkspaceHeader = Boolean(authUser) && !isAuthPage && currentPage !== 'landing'

  useEffect(() => {
    if (!authUser) return
    if (authUser.role !== 'user') return
    if (currentPage === 'appointments') return
    navigateToPage('appointments', { replace: true })
  }, [authUser, currentPage, navigateToPage])

  useScrollReveal(currentPage)

  const loginPage = isCheckingSession ? (
    <AuthLoadingCard label="Checking session..." />
  ) : (
    <LoginPage
      authUser={authUser}
      authError={authError}
      isAuthLoading={isAuthLoading}
      onLogin={handleLogin}
      onProviderLogin={auth0Enabled ? () => handleProviderLogin() : undefined}
      authProvider={authProvider}
      isBiometricReady={isBiometricReady}
      onLogout={handleLogout}
      onNavigate={navigateToPage}
      onGoBack={() => navigateBack('landing')}
    />
  )

  const adminLoginPage = isCheckingSession ? (
    <AuthLoadingCard label="Checking admin session..." />
  ) : (
    <AdminLoginPage
      authUser={authUser}
      authError={authError}
      isAuthLoading={isAuthLoading}
      onLogin={handleLogin}
      onProviderLogin={auth0Enabled ? () => handleProviderLogin('doctor_dashboard') : undefined}
      authProvider={authProvider}
      isBiometricReady={isBiometricReady}
      onLogout={handleLogout}
      onNavigate={navigateToPage}
      onGoBack={() => navigateBack('landing')}
    />
  )

  const otpPage = (
    <OtpPage
      challenge={pendingOtpChallenge}
      authError={authError}
      isAuthLoading={isAuthLoading}
      onVerifyOtp={handleVerifyOtp}
      onCancelOtp={handleCancelOtp}
      onNavigate={navigateToPage}
    />
  )

  const renderProtectedPage = (
    page: ProtectedPage,
    options: {
      loadingLabel: string
      deniedTitle: string
      deniedDetail: string
      allowedContent: ReactNode
    }
  ) => {
    if (isCheckingSession) {
      return <AuthLoadingCard label={options.loadingLabel} />
    }

    if (!authUser) {
      return page === 'doctor_dashboard' ? adminLoginPage : loginPage
    }

    if (!canAccessPage(page, authUser.role)) {
      return (
        <AccessDeniedCard
          title={options.deniedTitle}
          detail={options.deniedDetail}
          onSwitchAccount={() =>
            navigateToPage(page === 'doctor_dashboard' ? 'admin_login' : 'login')
          }
          onBackToOverview={() => navigateToPage('landing')}
        />
      )
    }

    return options.allowedContent
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
          onCreateReservation={handleCreateReservation}
          latestReservation={latestReservation}
          isAuthenticated={Boolean(authUser)}
        />
      )
      break

    case 'triage':
      pageContent = renderProtectedPage('triage', {
        loadingLabel: 'Checking triage access...',
        deniedTitle: 'Triage access required',
        deniedDetail:
          'Sign in with a User, Nurse, Admin, or Super Admin account to access triage.',
        allowedContent: (
          withWorkspaceBoundary(
            <TriagePage
              onCreateReservation={handleCreateReservation}
              latestReservation={latestReservation}
              onNavigate={navigateToPage}
              authRole={authUser?.role ?? null}
            />,
            'Triage workspace'
          )
        ),
      })
      break

    case 'appointments':
      pageContent = renderProtectedPage('appointments', {
        loadingLabel: 'Checking appointment access...',
        deniedTitle: 'Appointment access required',
        deniedDetail: 'Sign in to view your appointment list.',
        allowedContent: (
          withWorkspaceBoundary(
            <AppointmentsPage
              reservations={reservations}
              authUser={authUser}
              onNavigate={navigateToPage}
              onUpdateReservation={handleUpdateReservation}
              theme={theme}
              onToggleTheme={toggleTheme}
              dataMaskingEnabled={dataMaskingEnabled}
            />,
            'Appointments workspace'
          )
        ),
      })
      break

    case 'doctor_dashboard':
      pageContent = renderProtectedPage('doctor_dashboard', {
        loadingLabel: "Checking doctor's dashboard access...",
        deniedTitle: "Doctor's dashboard access required",
        deniedDetail: 'This page is available for Nurse, Admin, and Super Admin roles.',
        allowedContent: (
          withWorkspaceBoundary(
            <DoctorDashboardPage
              reservations={reservations}
              authUser={authUser}
              onNavigate={navigateToPage}
              onLogout={handleLogout}
              onUpdateReservation={handleUpdateReservation}
              dataMaskingEnabled={dataMaskingEnabled}
            />,
            "Doctor's dashboard"
          )
        ),
      })
      break

    case 'dashboard':
    case 'analytics':
    case 'clinical_reports':
    case 'care_alerts':
    case 'care_support':
    case 'ledger_monitoring':
    case 'intake_monitoring':
    case 'security':
    case 'user_management':
      pageContent = renderProtectedPage(currentPage, {
        loadingLabel: 'Checking dashboard access...',
        deniedTitle: 'Dashboard access required',
        deniedDetail:
          'Your account does not have permission to view operational dashboards. Ask an Admin or Super Admin for access.',
        allowedContent: (
          withWorkspaceBoundary(
            <Dashboard
              reservations={reservations}
              ledgerEntries={ledgerEntries}
              authUser={authUser}
              onLogout={handleLogout}
              apiReady={apiReady}
              theme={theme}
              onNavigate={navigateToPage}
              activePage={currentPage}
              dataMaskingEnabled={dataMaskingEnabled}
            />,
            'Clinical dashboard'
          )
        ),
      })
      break

    case 'admin':
      if (isCheckingSession) {
        pageContent = <AuthLoadingCard label="Checking admin access..." />
      } else if (!authUser) {
        pageContent = adminLoginPage
      } else if (!canAccessPage('admin', authUser.role)) {
        pageContent = (
          <AccessDeniedCard
            title="Admin access required"
            detail="This section is limited to Admin and Super Admin roles. Sign in with the correct role or request elevated access."
            onSwitchAccount={() => navigateToPage('admin_login')}
            onBackToOverview={() => navigateToPage('landing')}
          />
        )
      } else {
        pageContent = withWorkspaceBoundary(
          <AdminDashboard authUser={authUser} onNavigate={navigateToPage} />,
          'Admin dashboard'
        )
      }
      break

    case 'admin_login':
      pageContent = adminLoginPage
      break

    case 'login':
      pageContent = loginPage
      break

    case 'otp':
      pageContent = otpPage
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
          <div className="absolute inset-0 agent-grid opacity-20" />
          <div className="absolute -top-48 left-[15%] h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(124,252,196,0.3),_transparent_65%)] blur-3xl animate-drift-slow" />
          <div className="absolute top-1/3 right-[5%] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,_rgba(90,215,255,0.28),_transparent_60%)] blur-3xl animate-drift" />
          <div className="absolute bottom-[-120px] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(255,209,102,0.2),_transparent_65%)] blur-3xl animate-float-slow" />
        </div>
      )}

      <div className="relative z-10">
        {showPublicHeader && (
          <AppHeader theme={theme} onToggleTheme={toggleTheme} onNavigate={navigateToPage} />
        )}
        {showWorkspaceHeader && authUser && (
          <WorkspaceHeader
            key={`workspace-header-${currentPage}-${authUser.username}-${authUser.role}`}
            authUser={authUser}
            currentPage={currentPage}
            onNavigate={navigateToPage}
            onLogout={handleLogout}
            theme={theme}
            onToggleTheme={toggleTheme}
            dataMaskingEnabled={dataMaskingEnabled}
            onToggleDataMasking={() => setDataMaskingEnabled((prev) => !prev)}
            securityStatus={{
              encryption: 'TLS 1.3 + AES-256-GCM',
              session: sessionStatus,
              provider: authProvider,
              mfa: Boolean(authUser.mfa),
              biometricReady: isBiometricReady,
            }}
          />
        )}

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

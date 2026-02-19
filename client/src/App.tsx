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
import DoctorDashboardPage from './pages/DoctorDashboardPage'
import DoctorLoginPage from './pages/DoctorLoginPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import OtpPage from './pages/OtpPage'
import SignupPage from './pages/SignupPage'
import ConfirmModal from './components/ui/ConfirmModal'

type ProtectedPage = 'appointments' | 'doctor_dashboard'

function App() {
  const { currentPage, navigateToPage, navigateBack, isLanding, isAuthPage } = useAppRouting()
  const { theme, toggleTheme } = useAppTheme(isLanding || isAuthPage)
  const [dataMaskingEnabled, setDataMaskingEnabled] = useState(true)

  const {
    authProvider,
    auth0Enabled,
    isBiometricReady,
    sessionStatus,
    authUser,
    authError,
    isAuthLoading,
    isCheckingSession,
    reservations,
    latestReservation,
    pendingOtpChallenge,
    handleProviderLogin,
    handleLogin,
    handleVerifyOtp,
    handleCancelOtp,
    handleResendOtp,
    handleSignupSuccess,
    handleLogout,
    idleWarningOpen,
    idleRemainingSeconds,
    acknowledgeIdle,
  } = useAuthData({ currentPage, navigateToPage })

  const isProtectedRoute =
    currentPage === 'appointments' || currentPage === 'doctor_dashboard' || currentPage === 'admin'
  const isReferenceDashboardPage =
    currentPage === 'appointments' || currentPage === 'doctor_dashboard'
  const showPublicHeader = !isLanding && !isAuthPage && !authUser && !isProtectedRoute
  const showWorkspaceHeader =
    Boolean(authUser) && !isAuthPage && currentPage !== 'landing' && !isReferenceDashboardPage
  const showSupportAssistant = true

  useEffect(() => {
    if (!authUser) return
    if (authUser.role !== 'user') return
    if (currentPage === 'appointments') return
    if (currentPage !== 'doctor_dashboard' && currentPage !== 'admin') return
    navigateToPage('appointments', { replace: true })
  }, [authUser, currentPage, navigateToPage])

  useEffect(() => {
    if (!authUser) return
    if (authUser.role === 'user') return
    if (currentPage !== 'appointments') return
    navigateToPage('doctor_dashboard', { replace: true })
  }, [authUser, currentPage, navigateToPage])

  useScrollReveal(`${currentPage}-${isCheckingSession}-${authUser?.role ?? 'guest'}`)

  const loginPage = (
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

  const adminLoginPage = (
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
      onResendOtp={handleResendOtp}
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
          latestReservation={latestReservation}
          isAuthenticated={Boolean(authUser)}
          onLogout={handleLogout}
        />
      )
      break

    case 'appointments':
      if (authUser && authUser.role !== 'user') {
        pageContent = <AuthLoadingCard label="Redirecting to doctor's dashboard..." />
      } else {
        pageContent = renderProtectedPage('appointments', {
          loadingLabel: 'Checking appointment access...',
          deniedTitle: 'Appointment access required',
          deniedDetail:
            'This page is the User appointment portal. Sign in with a User account to view personal appointments.',
          allowedContent: (
            withWorkspaceBoundary(
              <AppointmentsPage
                reservations={reservations}
                authUser={authUser}
                onNavigate={navigateToPage}
                onLogout={handleLogout}
                sessionStatus={sessionStatus}
                theme={theme}
                onToggleTheme={toggleTheme}
                dataMaskingEnabled={dataMaskingEnabled}
                onToggleDataMasking={() => setDataMaskingEnabled((prev) => !prev)}
              />,
              'Appointments workspace'
            )
          ),
        })
      }
      break

    case 'doctor_dashboard':
      if (authUser?.role === 'user') {
        pageContent = <AuthLoadingCard label="Redirecting to appointments..." />
      } else {
        pageContent = renderProtectedPage('doctor_dashboard', {
          loadingLabel: "Checking doctor's dashboard access...",
          deniedTitle: "Doctor's dashboard access required",
          deniedDetail: 'This page is available for Nurse, Admin, and Super Admin roles.',
          allowedContent: (
            withWorkspaceBoundary(
              <DoctorDashboardPage
                authUser={authUser}
                reservations={reservations}
                onNavigate={navigateToPage}
                onLogout={handleLogout}
                sessionStatus={sessionStatus}
                theme={theme}
                onToggleTheme={toggleTheme}
                dataMaskingEnabled={dataMaskingEnabled}
                onToggleDataMasking={() => setDataMaskingEnabled((prev) => !prev)}
              />,
              "Doctor's dashboard"
            )
          ),
        })
      }
      break

    case 'admin':
      if (authUser?.role === 'user') {
        pageContent = <AuthLoadingCard label="Redirecting to appointments..." />
      } else if (isCheckingSession) {
        pageContent = <AuthLoadingCard label="Checking admin access..." />
      } else if (!authUser) {
        pageContent = adminLoginPage
      } else if (!canAccessPage('admin', authUser.role)) {
        pageContent = (
          <AccessDeniedCard
            title="Admin access required"
            detail="This section is limited to Nurse, Admin, and Super Admin roles. Sign in with the correct role or request elevated access."
            onSwitchAccount={() => navigateToPage('admin_login')}
            onBackToOverview={() => navigateToPage('landing')}
          />
        )
      } else {
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
            onToggleDataMasking={() => setDataMaskingEnabled((prev) => !prev)}
          />,
          'Admin dashboard'
        )
      }
      break

    case 'admin_login':
      if (authUser?.role === 'user') {
        pageContent = (
          <AccessDeniedCard
            title="Staff login only"
            detail="This login is for nurse, admin, and super admin accounts only. Switch account to continue."
            onSwitchAccount={() => {
              void handleLogout()
            }}
            onBackToOverview={() => navigateToPage('landing')}
          />
        )
      } else {
        pageContent = adminLoginPage
      }
      break

    case 'doctor_login':
      if (authUser?.role === 'user') {
        pageContent = (
          <AccessDeniedCard
            title="Doctor login only"
            detail="This login is for doctor and admin accounts only. Switch account to continue."
            onSwitchAccount={() => {
              void handleLogout()
            }}
            onBackToOverview={() => navigateToPage('landing')}
          />
        )
      } else {
        pageContent = (
          <DoctorLoginPage
            authError={authError}
            isAuthLoading={isAuthLoading}
            onLogin={handleLogin}
            onProviderLogin={auth0Enabled ? () => handleProviderLogin('doctor_dashboard') : undefined}
            authProvider={authProvider}
            isBiometricReady={isBiometricReady}
            onNavigate={navigateToPage}
          />
        )
      }
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
          <div className="absolute inset-0 agent-grid opacity-15" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.08),transparent_55%)]" />
        </div>
      )}

      <div className="relative z-10">
        <ConfirmModal
          open={Boolean(idleWarningOpen)}
          title="Session timeout warning"
          message={
            idleRemainingSeconds > 0
              ? `You've been idle. You will be logged out in ${Math.floor(
                  idleRemainingSeconds / 60
                )}:${String(idleRemainingSeconds % 60).padStart(2, '0')}.`
              : "You've been idle. You will be logged out soon."
          }
          confirmLabel="Stay signed in"
          cancelLabel="Logout now"
          onConfirm={() => {
            acknowledgeIdle()
          }}
          onCancel={() => {
            void handleLogout()
          }}
        />
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
          />
        )}

        <main>{pageContent}</main>
        {showSupportAssistant && (
          <GlobalAssistantChat
            key={`global-chat-${authUser?.username ?? 'guest'}-${authUser?.role ?? 'guest'}`}
            isIdentified={Boolean(authUser)}
            userRole={authUser?.role ?? null}
          />
        )}
      </div>
    </div>
  )
}

export default App

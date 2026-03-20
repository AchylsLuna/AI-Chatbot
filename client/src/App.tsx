import { Suspense, lazy, useEffect, type ReactNode } from 'react'
import GlobalAssistantChat from './components/chat/GlobalAssistantChat'
import AppHeader from './components/layout/AppHeader'
import PageHeader from './components/layout/PageHeader'
import AppErrorBoundary from './components/states/AppErrorBoundary'
import { AccessDeniedCard, AuthLoadingCard } from './components/states/RouteGuardCards'
import { canAccessPage } from './config/accessControl'
import useAuthData from './hooks/useAuthData'
import useAppRouting from './hooks/useAppRouting'
import useScrollReveal from './hooks/useScrollReveal'
import useAppTheme from './hooks/useAppTheme'
import { isAdminRole, isDoctorRole } from './utils/roleRoutes'
import ConfirmModal from './components/ui/ConfirmModal'
import { resolveSourcePage } from './utils/appRouteState'

const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'))
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'))
const DoctorDashboardPage = lazy(() => import('./pages/doctor/DoctorDashboardPage'))
const PatientAppointmentsPage = lazy(() => import('./pages/patient/PatientAppointmentsPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const LandingPage = lazy(() => import('./pages/LandingPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const OtpPage = lazy(() => import('./pages/OtpPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const SignupPage = lazy(() => import('./pages/SignupPage'))
const TermsPage = lazy(() => import('./pages/TermsPage'))

type ProtectedPage = 'appointments' | 'doctor_dashboard'
const AUTH_SOURCE_PAGES = ['login', 'doctor_login', 'admin_login'] as const
const SIGNUP_SOURCE_PAGES = ['signup', 'doctor_signup'] as const

function App() {
  const { currentPage, navigateToPage, navigateBack, isLanding, isAuthPage } = useAppRouting()
  const dataMaskingEnabled = false

  const {
    authProvider,
    auth0Enabled,
    isBiometricReady,
    sessionStatus,
    authUser,
    authError,
    authUiAction,
    isCheckingSession,
    reservations,
    latestReservation,
    pendingOtpChallenge,
    handleCreateReservation,
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
  } = useAuthData({ currentPage, navigateToPage })
  const { theme, toggleTheme } = useAppTheme(
    authUser ? `${authUser.username}:${authUser.role}` : null
  )

  const isProtectedRoute =
    currentPage === 'appointments' || currentPage === 'doctor_dashboard' || currentPage === 'admin'
  const isTabPage =
    currentPage === 'appointments' || currentPage === 'doctor_dashboard' || currentPage === 'admin'
  const showPublicHeader = !isLanding && !isAuthPage && !authUser && !isProtectedRoute
  const showPageHeader =
    Boolean(authUser) && !isAuthPage && currentPage !== 'landing' && !isTabPage
  const showSupportAssistant = true
  const isDoctorAuthenticated = isDoctorRole(authUser?.role, authUser?.accountType)
  const isAdminAuthenticated = isAdminRole(authUser?.role, authUser?.accountType)
  const isPatientAuthenticated =
    Boolean(authUser) && !isDoctorAuthenticated && !isAdminAuthenticated
  const isLoginActionLoading = authUiAction === 'login' || authUiAction === 'provider'
  const isOtpActionLoading = authUiAction === 'otp'
  const forgotPasswordSourcePage = resolveSourcePage(AUTH_SOURCE_PAGES, 'login')
  const legalSourcePage = resolveSourcePage(SIGNUP_SOURCE_PAGES, 'signup')

  useEffect(() => {
    if (!isPatientAuthenticated) return
    if (currentPage === 'appointments') return
    if (currentPage !== 'doctor_dashboard' && currentPage !== 'admin') return
    navigateToPage('appointments', { replace: true })
  }, [currentPage, isPatientAuthenticated, navigateToPage])

  useEffect(() => {
    if (!authUser) return
    if (currentPage !== 'appointments') return
    if (isDoctorAuthenticated) {
      navigateToPage('doctor_dashboard', { replace: true })
      return
    }
    if (isAdminAuthenticated) {
      navigateToPage('admin', { replace: true })
    }
  }, [authUser, currentPage, isAdminAuthenticated, isDoctorAuthenticated, navigateToPage])

  useEffect(() => {
    if (!authUser) return
    if (currentPage !== 'doctor_dashboard') return
    if (!isAdminAuthenticated) return
    navigateToPage('admin', { replace: true })
  }, [authUser, currentPage, isAdminAuthenticated, navigateToPage])

  useEffect(() => {
    if (!authUser) return
    if (currentPage !== 'admin') return
    if (!isDoctorAuthenticated) return
    navigateToPage('doctor_dashboard', { replace: true })
  }, [authUser, currentPage, isDoctorAuthenticated, navigateToPage])

  useScrollReveal(`${currentPage}-${isCheckingSession}-${authUser?.role ?? 'guest'}`)

  const loginPage = (
    <LoginPage
      key="login-patient"
      authUser={authUser}
      authError={authError}
      isAuthLoading={isLoginActionLoading}
      onLogin={handleLogin}
      onProviderLogin={auth0Enabled ? () => handleProviderLogin() : undefined}
      authProvider={authProvider}
      isBiometricReady={isBiometricReady}
      onLogout={handleLogout}
      onNavigate={navigateToPage}
      onForgotPassword={() =>
        navigateToPage('forgot_password', { state: { sourcePage: 'login' } })
      }
      onGoBack={() => navigateBack('landing')}
      defaultRoleTab="patient"
    />
  )

  const doctorLoginPage = (
    <LoginPage
      key="login-doctor"
      authUser={authUser}
      authError={authError}
      isAuthLoading={isLoginActionLoading}
      onLogin={handleLogin}
      onProviderLogin={auth0Enabled ? () => handleProviderLogin('doctor_dashboard') : undefined}
      authProvider={authProvider}
      isBiometricReady={isBiometricReady}
      onLogout={handleLogout}
      onNavigate={navigateToPage}
      onForgotPassword={() =>
        navigateToPage('forgot_password', { state: { sourcePage: 'doctor_login' } })
      }
      onGoBack={() => navigateBack('landing')}
      defaultRoleTab="doctor"
    />
  )

  const adminLoginPage = (
    <AdminLoginPage
      authUser={authUser}
      authError={authError}
      isAuthLoading={isLoginActionLoading}
      onLogin={handleLogin}
      onProviderLogin={auth0Enabled ? () => handleProviderLogin('admin') : undefined}
      authProvider={authProvider}
      isBiometricReady={isBiometricReady}
      onLogout={handleLogout}
      onNavigate={navigateToPage}
      onForgotPassword={() =>
        navigateToPage('forgot_password', { state: { sourcePage: 'admin_login' } })
      }
      onGoBack={() => navigateBack('landing')}
    />
  )

  const otpPage = (
    <OtpPage
      challenge={pendingOtpChallenge}
      sourcePage={pendingOtpChallenge?.sourcePage}
      authError={authError}
      isAuthLoading={isOtpActionLoading}
      onVerifyOtp={handleVerifyOtp}
      onCancelOtp={handleCancelOtp}
      onResendOtp={handleResendOtp}
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
      return page === 'doctor_dashboard' ? doctorLoginPage : loginPage
    }

    if (!canAccessPage(page, authUser.role)) {
      return (
        <AccessDeniedCard
          title={options.deniedTitle}
          detail={options.deniedDetail}
          onSwitchAccount={() =>
            navigateToPage(page === 'doctor_dashboard' ? 'doctor_login' : 'login')
          }
          onBackToOverview={() => navigateToPage('landing')}
        />
      )
    }

    return options.allowedContent
  }

  const withDashboardBoundary = (content: ReactNode, section: string) => (
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
      if (authUser && !isPatientAuthenticated) {
        pageContent = (
          <AuthLoadingCard
            label={isAdminAuthenticated ? 'Redirecting to admin dashboard...' : "Redirecting to doctor's dashboard..."}
          />
        )
      } else {
        pageContent = renderProtectedPage('appointments', {
          loadingLabel: 'Checking appointment access...',
          deniedTitle: 'Appointment access required',
          deniedDetail:
            'This page is the Patient appointment portal. Sign in with a Patient account to view personal appointments.',
          allowedContent: (
            withDashboardBoundary(
              <PatientAppointmentsPage
                reservations={reservations}
                authUser={authUser}
                onNavigate={navigateToPage}
                onLogout={handleLogout}
                onCreateReservation={handleCreateReservation}
                sessionStatus={sessionStatus}
                theme={theme}
                onToggleTheme={toggleTheme}
                dataMaskingEnabled={dataMaskingEnabled}
              />,
              'Appointments'
            )
          ),
        })
      }
      break

    case 'doctor_dashboard':
      if (isPatientAuthenticated) {
        pageContent = <AuthLoadingCard label="Redirecting to appointments..." />
      } else if (isAdminAuthenticated) {
        pageContent = <AuthLoadingCard label="Redirecting to admin dashboard..." />
      } else {
        pageContent = renderProtectedPage('doctor_dashboard', {
          loadingLabel: "Checking doctor's dashboard access...",
          deniedTitle: "Doctor's dashboard access required",
          deniedDetail: 'This page is available for doctor-role accounts only.',
          allowedContent: (
            withDashboardBoundary(
              <DoctorDashboardPage
                authUser={authUser}
                reservations={reservations}
                onLogout={handleLogout}
                onPatchAuthUser={patchAuthUser}
                sessionStatus={sessionStatus}
                theme={theme}
                onToggleTheme={toggleTheme}
                dataMaskingEnabled={dataMaskingEnabled}
              />,
              "Doctor's dashboard"
            )
          ),
        })
      }
      break

    case 'admin':
      if (isPatientAuthenticated) {
        pageContent = <AuthLoadingCard label="Redirecting to appointments..." />
      } else if (isDoctorAuthenticated) {
        pageContent = <AuthLoadingCard label="Redirecting to doctor's dashboard..." />
      } else if (isCheckingSession) {
        pageContent = <AuthLoadingCard label="Checking admin access..." />
      } else if (!authUser) {
        pageContent = adminLoginPage
      } else if (!canAccessPage('admin', authUser.role)) {
        pageContent = (
          <AccessDeniedCard
            title="Admin access required"
            detail="This section is limited to Admin accounts. Sign in with an authorized account."
            onSwitchAccount={() => navigateToPage('admin_login')}
            onBackToOverview={() => navigateToPage('landing')}
          />
        )
      } else {
        pageContent = withDashboardBoundary(
          <AdminDashboardPage
            authUser={authUser}
            reservations={reservations}
            onNavigate={navigateToPage}
            onLogout={handleLogout}
            sessionStatus={sessionStatus}
            theme={theme}
            onToggleTheme={toggleTheme}
            dataMaskingEnabled={dataMaskingEnabled}
          />,
          'Admin dashboard'
        )
      }
      break

    case 'admin_login':
      if (isPatientAuthenticated) {
        pageContent = (
          <AccessDeniedCard
            title="Staff login only"
            detail="This login is for Doctor and Admin accounts only. Switch account to continue."
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
      pageContent = doctorLoginPage
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
          key="signup-patient"
          onNavigate={navigateToPage}
          onOpenTerms={() => navigateToPage('terms', { state: { sourcePage: 'signup' } })}
          onOpenPrivacy={() =>
            navigateToPage('privacy_policy', { state: { sourcePage: 'signup' } })
          }
          onSignupSuccess={handleSignupSuccess}
          onGoBack={() => navigateBack('login')}
          sourcePage="signup"
          defaultRoleTab="patient"
        />
      )
      break
    case 'doctor_signup':
      pageContent = (
        <SignupPage
          key="signup-doctor"
          onNavigate={navigateToPage}
          onOpenTerms={() =>
            navigateToPage('terms', { state: { sourcePage: 'doctor_signup' } })
          }
          onOpenPrivacy={() =>
            navigateToPage('privacy_policy', { state: { sourcePage: 'doctor_signup' } })
          }
          onGoBack={() => navigateBack('doctor_login')}
          sourcePage="doctor_signup"
          defaultRoleTab="doctor"
        />
      )
      break

    case 'forgot_password':
      pageContent = (
        <ForgotPasswordPage
          onNavigate={navigateToPage}
          onGoBack={() => navigateToPage(forgotPasswordSourcePage, { replace: true })}
          sourcePage={forgotPasswordSourcePage}
        />
      )
      break

    case 'terms':
      pageContent = (
        <TermsPage
          onNavigate={navigateToPage}
          onGoBack={() => navigateToPage(legalSourcePage, { replace: true })}
        />
      )
      break

    case 'privacy_policy':
      pageContent = (
        <PrivacyPolicyPage
          onNavigate={navigateToPage}
          onGoBack={() => navigateToPage(legalSourcePage, { replace: true })}
        />
      )
      break

    default:
      pageContent = null
  }

  return (
    <div
      className={`${theme === 'dark' ? 'theme-dark' : 'theme-light'} relative min-h-screen bg-[color:var(--agent-bg)] text-[color:var(--agent-ink)]`}
    >
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
          <AppHeader onNavigate={navigateToPage} />
        )}
        {showPageHeader && authUser && (
          <PageHeader
            key={`dashboard-header-${currentPage}-${authUser.username}-${authUser.role}`}
            authUser={authUser}
            currentPage={currentPage}
            onNavigate={navigateToPage}
          />
        )}

        <main>
          <Suspense fallback={<AuthLoadingCard label="Loading page..." />}>
            {pageContent}
          </Suspense>
        </main>
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

import type { ReactNode } from 'react'
import { AccessDeniedCard, AuthLoadingCard } from './components/states/RouteGuardCards'
import AppHeader from './components/layout/AppHeader'
import { canAccessPage } from './config/accessControl'
import useAuthData from './hooks/useAuthData'
import useAppRouting from './hooks/useAppRouting'
import useScrollReveal from './hooks/useScrollReveal'
import useAppTheme from './hooks/useAppTheme'
import AdminDashboard from './pages/AdminDashboard'
import AdminLoginPage from './pages/AdminLoginPage'
import ContactPage from './pages/ContactPage'
import Dashboard from './pages/Dashboard'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import PatientProfile from './pages/PatientProfile'
import SignupPage from './pages/SignupPage'
import TriagePage from './pages/TriagePage'

type ProtectedPage = 'dashboard'

function App() {
  const { currentPage, navigateToPage, isLanding, isAuthPage } = useAppRouting()
  const { theme, toggleTheme } = useAppTheme()

  const {
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
  } = useAuthData({ currentPage, navigateToPage })

  useScrollReveal(currentPage)

  const loginPage = isCheckingSession ? (
    <AuthLoadingCard label="Checking session..." />
  ) : (
    <LoginPage
      authUser={authUser}
      authError={authError}
      isAuthLoading={isAuthLoading}
      onLogin={handleLogin}
      onLogout={handleLogout}
      onNavigate={navigateToPage}
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
      onLogout={handleLogout}
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
      return loginPage
    }

    if (!canAccessPage(page, authUser.role)) {
      return (
        <AccessDeniedCard
          title={options.deniedTitle}
          detail={options.deniedDetail}
          onSwitchAccount={() => navigateToPage('login')}
          onBackToOverview={() => navigateToPage('landing')}
        />
      )
    }

    return options.allowedContent
  }

  let pageContent: ReactNode

  switch (currentPage) {
    case 'landing':
      pageContent = (
        <LandingPage
          onNavigate={navigateToPage}
          onCreateReservation={handleCreateReservation}
          latestReservation={latestReservation}
          theme={theme}
          onToggleTheme={toggleTheme}
          isAuthenticated={Boolean(authUser)}
        />
      )
      break

    case 'triage':
      pageContent = (
        <TriagePage
          onCreateReservation={handleCreateReservation}
          latestReservation={latestReservation}
        />
      )
      break

    case 'dashboard':
      pageContent = renderProtectedPage('dashboard', {
        loadingLabel: 'Checking dashboard access...',
        deniedTitle: 'Dashboard access required',
        deniedDetail:
          'Your account does not have permission to view operational dashboards. Ask an Admin or System Admin to grant Nurse/Doctor or Admin access.',
        allowedContent: (
          <Dashboard
            reservations={reservations}
            ledgerEntries={ledgerEntries}
            authUser={authUser}
            authError={authError}
            isAuthLoading={isAuthLoading}
            onLogin={handleLogin}
            onLogout={handleLogout}
            apiReady={apiReady}
            onNavigate={navigateToPage}
          />
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
            detail="This section is limited to Admin and System Admin roles. Sign in with the correct role or request elevated access."
            onSwitchAccount={() => navigateToPage('admin_login')}
            onBackToOverview={() => navigateToPage('landing')}
          />
        )
      } else {
        pageContent = <AdminDashboard authUser={authUser} />
      }
      break

    case 'admin_login':
      pageContent = adminLoginPage
      break

    case 'login':
      pageContent = loginPage
      break

    case 'signup':
      pageContent = (
        <SignupPage onNavigate={navigateToPage} onSignupSuccess={handleSignupSuccess} />
      )
      break

    case 'forgot_password':
      pageContent = <ForgotPasswordPage onNavigate={navigateToPage} />
      break

    case 'contact':
      pageContent = <ContactPage />
      break

    case 'patient':
      pageContent = <PatientProfile />
      break

    default:
      pageContent = null
  }

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
        {!isLanding && !authUser && !isAuthPage && (
          <AppHeader theme={theme} onToggleTheme={toggleTheme} onNavigate={navigateToPage} />
        )}

        <main className={isLanding || isAuthPage ? '' : 'pt-20'}>{pageContent}</main>

        {!isLanding && !isAuthPage && !apiReady && (
          <div className="fixed bottom-6 right-6 rounded-2xl border border-amber-400/30 bg-amber-400/15 px-4 py-3 text-xs font-semibold text-amber-200 shadow-lg shadow-black/40">
            {authToken
              ? 'API offline - showing local fallback data.'
              : 'Sign in to access live data.'}
          </div>
        )}
      </div>
    </div>
  )
}

export default App

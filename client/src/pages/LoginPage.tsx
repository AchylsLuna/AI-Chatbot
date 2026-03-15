import { useState } from 'react'
import AuthSplitLayout from '../components/auth/AuthSplitLayout'
import type { AppPage } from '../types/navigation'
import type { AuthProvider, AuthSession } from '../types'
import { getDefaultPageForRole } from '../utils/roles'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i
type LoginRoleTab = 'patient' | 'doctor'

type LoginPageProps = {
  authUser: AuthSession['user'] | null
  authError: string | null
  isAuthLoading: boolean
  onLogin: (username: string, password: string, targetPage?: AppPage) => void
  onProviderLogin?: () => void
  authProvider?: AuthProvider
  isBiometricReady?: boolean
  onLogout: () => void
  onNavigate?: (page: AppPage) => void
  onGoBack?: () => void
  defaultRoleTab?: LoginRoleTab
}

const LoginPage = ({
  authUser,
  authError,
  isAuthLoading,
  onLogin,
  onProviderLogin,
  authProvider = 'local',
  isBiometricReady = false,
  onLogout,
  onNavigate,
  onGoBack,
  defaultRoleTab = 'patient',
}: LoginPageProps) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [roleTab, setRoleTab] = useState<LoginRoleTab>(defaultRoleTab)
  const [doctorLicenseId, setDoctorLicenseId] = useState('')
  const homePage: AppPage = getDefaultPageForRole(authUser?.role)
  const homeLabel =
    homePage === 'appointments'
      ? 'Go to appointments'
      : homePage === 'doctor_dashboard'
        ? "Go to doctor's dashboard"
        : homePage === 'admin'
          ? 'Go to admin dashboard'
          : 'Go to dashboard'

  return (
    <AuthSplitLayout variant="lovable">
      <div className="auth-lovable-page">
        {onGoBack ? (
          <button
            type="button"
            onClick={() => (onGoBack ? onGoBack() : onNavigate?.('landing'))}
            className="auth-lovable-back-link"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
          </button>
        ) : null}

        <h2 className="auth-lovable-title">Welcome back</h2>
        <p className="auth-lovable-subtitle">Sign in to continue your health journey</p>

        {authUser ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-[color:var(--auth-lovable-border)] bg-[color:var(--auth-lovable-surface-soft)] p-3 text-sm text-[color:var(--auth-lovable-muted)]">
              Signed in as{' '}
              <span className="font-semibold text-[color:var(--auth-lovable-ink)]">
                {authUser.username}
              </span>
              .
            </div>
            <div className="auth-lovable-actions">
              <button onClick={onLogout} className="auth-lovable-secondary-button px-4 py-2.5">
                Sign out
              </button>
              <button
                onClick={() => onNavigate?.(homePage)}
                className="auth-lovable-primary-button px-4 py-2.5"
              >
                {homeLabel}
              </button>
            </div>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              const email = username.trim().toLowerCase()
              if (!EMAIL_PATTERN.test(email)) {
                setEmailError('Use a valid email address before signing in.')
                return
              }
              setEmailError(null)
              onLogin(email, password, roleTab === 'doctor' ? 'doctor_dashboard' : 'appointments')
            }}
        >
          <div className="auth-lovable-role-wrap">
            <button
              type="button"
              onClick={() => {
                setRoleTab('patient')
                if (emailError) setEmailError(null)
              }}
              className={`auth-lovable-role-button ${roleTab === 'patient' ? 'is-active' : ''}`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 12a4 4 0 100-8 4 4 0 000 8z" />
                <path d="M4 21a8 8 0 0116 0" />
              </svg>
              Patient
            </button>
            <button
              type="button"
              onClick={() => {
                setRoleTab('doctor')
                if (emailError) setEmailError(null)
              }}
              className={`auth-lovable-role-button ${roleTab === 'doctor' ? 'is-active' : ''}`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3v18M3 12h18" />
              </svg>
              Doctor
            </button>
          </div>

          <div className="relative">
            <span className="auth-lovable-input-icon">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 6h16" />
                <path d="M4 6l8 6 8-6" />
                <rect x="4" y="4" width="16" height="16" rx="2" opacity="0" />
              </svg>
            </span>
            <input
              type="email"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value)
                if (emailError) setEmailError(null)
              }}
              placeholder={roleTab === 'doctor' ? 'Doctor email address' : 'Email address'}
              className="auth-lovable-input pl-10"
              aria-invalid={emailError ? 'true' : 'false'}
            />
          </div>
          {emailError ? <p className="auth-lovable-field-error" role="alert">{emailError}</p> : null}

          {roleTab === 'doctor' ? (
            <div className="relative">
              <span className="auth-lovable-input-icon">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="4" y="3" width="16" height="18" rx="2" />
                  <path d="M8 7h8M8 11h8M8 15h5" />
                </svg>
              </span>
              <input
                type="text"
                value={doctorLicenseId}
                onChange={(event) => {
                  setDoctorLicenseId(event.target.value)
                }}
                placeholder="Medical License ID (optional)"
                className="auth-lovable-input pl-10"
              />
            </div>
          ) : null}

          <div className="relative">
            <span className="auth-lovable-input-icon">
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="4" y="10" width="16" height="10" rx="2" />
                <path d="M8 10V7a4 4 0 018 0v3" />
              </svg>
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
              }}
              placeholder="Password"
              className="auth-lovable-input pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="auth-lovable-password-toggle"
            >
              {showPassword ? (
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 3l18 18" />
                  <path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" />
                  <path d="M9.88 4.24A9.9 9.9 0 0112 4c5.05 0 9.27 3.11 11 8-0.6 1.69-1.61 3.2-2.92 4.41" />
                  <path d="M6.23 6.23C4.04 7.48 2.4 9.46 1 12c1.73 4.89 5.95 8 11 8 1.62 0 3.15-0.32 4.53-0.9" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onNavigate?.('forgot_password')}
              className="auth-lovable-link text-sm"
            >
              Forgot password?
            </button>
          </div>

          <button type="submit" disabled={isAuthLoading} className="auth-lovable-primary-button w-full h-12">
            {isAuthLoading ? 'Signing in...' : roleTab === 'doctor' ? 'Sign In as Doctor' : 'Sign In'}
          </button>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                const apiBase = (import.meta.env.VITE_API_URL ?? 'http://localhost:5001/api').replace(/\/$/, '')
                window.location.href = `${apiBase}/auth/google`
              }}
              disabled={isAuthLoading}
              className="auth-lovable-secondary-button h-11 w-full"
            >
              Continue with Google
            </button>

            {onProviderLogin ? (
              <button
                type="button"
                disabled={isAuthLoading}
                onClick={onProviderLogin}
                className="auth-lovable-secondary-button h-11 w-full"
              >
                Continue with Auth0
              </button>
            ) : null}
          </div>

          {authProvider === 'auth0' ? (
            <p className="text-center text-[11px] text-[color:var(--auth-lovable-muted)]">
              Secure SSO mode is active{isBiometricReady ? ' with biometric hooks ready.' : '.'}
            </p>
          ) : null}

          {authError ? <p className="auth-lovable-alert-error">{authError}</p> : null}

            <p className="text-center text-sm text-[color:var(--auth-lovable-muted)]">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => onNavigate?.(roleTab === 'doctor' ? 'doctor_signup' : 'signup')}
                className="auth-lovable-link font-medium"
              >
                Create one
              </button>
            </p>
          </form>
        )}
      </div>
    </AuthSplitLayout>
  )
}

export default LoginPage

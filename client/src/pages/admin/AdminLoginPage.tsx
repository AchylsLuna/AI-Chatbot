import { useEffect, useRef, useState } from 'react'
import AuthSplitLayout from '../../components/auth/AuthSplitLayout'
import PasswordVisibilityToggle from '../../components/auth/PasswordVisibilityToggle'
import type { AppPage } from '../../types/navigation'
import type { AuthProvider, AuthSession } from '../../types'
import { formatRoleLabel } from '../../utils/roles'
import { isAdminRole, isDoctorRole } from '../../utils/roleRoutes'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

type AdminLoginPageProps = {
  authUser: AuthSession['user'] | null
  authError: string | null
  isAuthLoading: boolean
  onLogin: (username: string, password: string, targetPage?: AppPage) => void
  onProviderLogin?: () => void
  authProvider?: AuthProvider
  isBiometricReady?: boolean
  onLogout: () => void
  onNavigate?: (page: AppPage) => void
  onForgotPassword?: () => void
  onGoBack?: () => void
}

const AdminLoginPage = ({
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
}: AdminLoginPageProps) => {
  const [username, setUsername] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const passwordInputRef = useRef<HTMLInputElement | null>(null)

  const hasAdminPortalAccess = isAdminRole(authUser?.role, authUser?.accountType)
  const hasDoctorDashboardAccess = isDoctorRole(authUser?.role, authUser?.accountType)

  const clearPasswordInputValue = () => {
    if (passwordInputRef.current) {
      passwordInputRef.current.value = ''
    }
  }

  const resetPasswordField = () => {
    clearPasswordInputValue()
    setShowPassword(false)
  }

  useEffect(() => {
    if (!authError) return
    clearPasswordInputValue()
  }, [authError])

  return (
    <AuthSplitLayout variant="lovable">
      <div className="auth-lovable-page">
        {onGoBack ? (
          <button
            type="button"
            onClick={onGoBack}
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

        <p className="auth-lovable-section-label">Restricted access</p>
        <h2 className="auth-lovable-title">Admin login</h2>
        <p className="auth-lovable-subtitle">
          Use an authorized admin account to access user management, audit history, and operational controls.
        </p>

        {authUser ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border border-[color:var(--auth-lovable-border)] bg-[color:var(--auth-lovable-surface-soft)] p-3 text-sm text-[color:var(--auth-lovable-muted)]">
              Signed in as{' '}
              <span className="font-semibold text-[color:var(--auth-lovable-ink)]">
                {authUser.username}
              </span>{' '}
              ({formatRoleLabel(authUser.role)}).
            </div>

            {hasAdminPortalAccess ? (
              <div className="space-y-4">
                <p className="text-sm text-[color:var(--auth-lovable-muted)]">
                  Access verified. Continue to the Admin Dashboard or sign out to switch accounts.
                </p>
                <div className="auth-lovable-actions">
                  <button
                    type="button"
                    onClick={() => onNavigate?.('admin')}
                    className="auth-lovable-primary-button px-4 py-2.5"
                  >
                    Open Admin Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="auth-lovable-secondary-button px-4 py-2.5"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                  {hasDoctorDashboardAccess
                    ? 'This account does not have admin access. Open the Doctor Dashboard or sign out and use an Admin account.'
                    : 'This account does not have admin access. Sign out and use an Admin account.'}
                </p>
                <div className="auth-lovable-actions">
                  <button
                    type="button"
                    onClick={onLogout}
                    className="auth-lovable-secondary-button px-4 py-2.5"
                  >
                    Sign out
                  </button>
                  {hasDoctorDashboardAccess ? (
                    <button
                      type="button"
                      onClick={() => onNavigate?.('doctor_dashboard')}
                      className="auth-lovable-primary-button px-4 py-2.5"
                    >
                      Doctor Dashboard
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onNavigate?.('login')}
                      className="auth-lovable-primary-button px-4 py-2.5"
                    >
                      Patient Login
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              const email = username.trim().toLowerCase()
              const passwordValue = passwordInputRef.current?.value ?? ''

              if (!EMAIL_PATTERN.test(email)) {
                setFormError('Use a valid email address before signing in.')
                return
              }
              if (!passwordValue.trim()) {
                setFormError('Enter your password before signing in.')
                return
              }

              setFormError(null)
              onLogin(email, passwordValue, 'admin')
              resetPasswordField()
            }}
          >
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
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value)
                  if (formError) setFormError(null)
                }}
                placeholder="Admin email address"
                className="auth-lovable-input pl-10"
              />
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
                  <rect x="4" y="10" width="16" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 018 0v3" />
                </svg>
              </span>
              <input
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onInput={() => {
                  if (formError) setFormError(null)
                }}
                placeholder="Password"
                className="auth-lovable-input pl-10 pr-10"
              />
              <PasswordVisibilityToggle
                visible={showPassword}
                onToggle={() => setShowPassword((previous) => !previous)}
              />
            </div>

            {formError || authError ? (
              <p className="auth-lovable-alert-error">{formError ?? authError}</p>
            ) : null}

            <button
              type="submit"
              disabled={isAuthLoading}
              className="auth-lovable-primary-button h-12 w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAuthLoading ? 'Signing in...' : 'Sign in as Admin'}
            </button>

            {onProviderLogin ? (
              <button
                type="button"
                onClick={onProviderLogin}
                disabled={isAuthLoading}
                className="auth-lovable-secondary-button w-full px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continue with Auth0 SSO
              </button>
            ) : null}

            {authProvider === 'auth0' ? (
              <p className="text-center text-[11px] text-[color:var(--auth-lovable-muted)]">
                Enterprise SSO active{isBiometricReady ? ' with biometric hook support.' : '.'}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </AuthSplitLayout>
  )
}

export default AdminLoginPage

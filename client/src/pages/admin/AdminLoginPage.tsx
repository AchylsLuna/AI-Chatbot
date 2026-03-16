import { useEffect, useRef, useState } from 'react'
import AuthSplitLayout from '../../components/auth/AuthSplitLayout'
import type { AppPage } from '../../types/navigation'
import type { AuthProvider, AuthSession } from '../../types'
import { formatRoleLabel } from '../../utils/roles'

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
}: AdminLoginPageProps) => {
  const [username, setUsername] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const passwordInputRef = useRef<HTMLInputElement | null>(null)

  const hasAdminPortalAccess = authUser
    ? authUser.role === 'admin' || authUser.role === 'system_admin'
    : false
  const hasDoctorDashboardAccess = authUser ? authUser.role === 'doctor' : false

  const clearPasswordField = () => {
    if (passwordInputRef.current) {
      passwordInputRef.current.value = ''
    }
  }

  useEffect(() => {
    if (!authError) return
    clearPasswordField()
  }, [authError])

  return (
    <AuthSplitLayout layout="center" centerBorderless>
      <div className="mx-auto w-full max-w-md rounded-3xl bg-[color:var(--agent-surface)] p-6 sm:p-8">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center text-[color:var(--agent-accent)]">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l7 4v5c0 5-3.5 8.5-7 9-3.5-0.5-7-4-7-9V7l7-4z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--agent-accent)]">
            Restricted Access
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-[color:var(--agent-ink)]">Admin Login</h2>
          <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
            Use an Admin account to continue.
          </p>
        </div>

        {authUser ? (
          <div className="mt-6 space-y-4 text-center">
            <div className="rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-4 text-sm text-[color:var(--agent-muted)]">
              Signed in as <span className="font-semibold text-[color:var(--agent-ink)]">{authUser.username}</span> (
              {formatRoleLabel(authUser.role)}).
            </div>

            {hasAdminPortalAccess ? (
              <div className="space-y-3">
                <p className="text-sm text-emerald-300">
                  Access verified. Continue to the Admin Dashboard.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button onClick={() => onNavigate?.('admin')} className="agent-button w-full">
                    Open Admin Dashboard
                  </button>
                  <button onClick={onLogout} className="agent-button-ghost w-full">
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-rose-300">
                  {hasDoctorDashboardAccess
                    ? 'This account does not have admin portal access. Open the Doctor Dashboard or sign out and use an Admin account.'
                    : 'This account does not have admin portal access. Sign out and use an Admin account.'}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button onClick={onLogout} className="agent-button-ghost w-full">
                    Sign out
                  </button>
                  {hasDoctorDashboardAccess ? (
                    <button onClick={() => onNavigate?.('doctor_dashboard')} className="agent-button w-full">
                      Doctor Dashboard
                    </button>
                  ) : (
                    <button onClick={() => onNavigate?.('login')} className="agent-button w-full">
                      Staff login
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <form
            className="mt-6 space-y-4 text-left"
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
              clearPasswordField()
            }}
          >
            <div className="space-y-2">
              <label
                htmlFor="admin-login-username"
                className="text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--agent-muted)]"
              >
                Admin email
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[color:var(--agent-muted-soft)]">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 4h16v16H4z" opacity="0" />
                    <path d="M4 6h16" />
                    <path d="M4 6l8 6 8-6" />
                  </svg>
                </span>
                <input
                  id="admin-login-username"
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
                  className="agent-input agent-input-icon"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="admin-login-password"
                className="text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--agent-muted)]"
              >
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[color:var(--agent-muted-soft)]">
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
                  id="admin-login-password"
                  type="password"
                  autoComplete="current-password"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onInput={() => {
                    if (formError) setFormError(null)
                  }}
                  placeholder="Password"
                  className="agent-input agent-input-icon"
                />
              </div>
            </div>

            {(formError || authError) && (
              <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-300">
                {formError ?? authError}
              </p>
            )}

            <button
              type="submit"
              disabled={isAuthLoading}
              className="agent-button w-full disabled:cursor-not-allowed"
            >
              {isAuthLoading ? 'Signing in...' : 'Sign in'}
            </button>

            {onProviderLogin ? (
              <button
                type="button"
                onClick={onProviderLogin}
                disabled={isAuthLoading}
                className="agent-button-ghost w-full disabled:cursor-not-allowed"
              >
                Continue with Auth0 SSO
              </button>
            ) : null}

            {authProvider === 'auth0' ? (
              <p className="text-center text-[11px] text-[color:var(--agent-muted)]">
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

import { useState } from 'react'
import AuthSplitLayout from '../../components/auth/AuthSplitLayout'
import type { AppPage } from '../../types/navigation'
import type { AuthProvider, AuthSession } from '../../types'
import { formatRoleLabel } from '../../utils/roles'

const COM_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.com$/i

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
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const hasAdminLoginAccess = authUser
    ? authUser.role === 'nurse' || authUser.role === 'admin' || authUser.role === 'system_admin'
    : false
  const hasAdminWorkspaceAccess = authUser
    ? authUser.role === 'nurse' || authUser.role === 'admin' || authUser.role === 'system_admin'
    : false

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
            Use Super Admin, Admin (Doctor), or Nurse account to continue.
          </p>
        </div>

        {authUser ? (
          <div className="mt-6 space-y-4 text-center">
            <div className="rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-4 text-sm text-[color:var(--agent-muted)]">
              Signed in as <span className="font-semibold text-[color:var(--agent-ink)]">{authUser.username}</span> (
              {formatRoleLabel(authUser.role)}).
            </div>

            {hasAdminLoginAccess ? (
              <div className="space-y-3">
                <p className="text-sm text-emerald-300">
                  Access verified. Continue to the Doctor Dashboard.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button onClick={() => onNavigate?.('doctor_dashboard')} className="agent-button w-full">
                    Open Doctor Dashboard
                  </button>
                  {hasAdminWorkspaceAccess && (
                    <button onClick={() => onNavigate?.('admin')} className="agent-button-ghost w-full">
                      Open Admin Workspace
                    </button>
                  )}
                  <button
                    onClick={onLogout}
                    className={`agent-button-ghost w-full ${hasAdminWorkspaceAccess ? 'sm:col-span-2' : 'sm:col-span-1'}`}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-rose-300">
                  This account does not have admin portal access. Sign out and use Super Admin,
                  Admin, or Nurse account.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button onClick={onLogout} className="agent-button-ghost w-full">
                    Sign out
                  </button>
                  <button onClick={() => onNavigate?.('login')} className="agent-button w-full">
                    Staff login
                  </button>
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
              if (!COM_EMAIL_PATTERN.test(email)) {
                setFormError('Use a valid .com email address before signing in.')
                return
              }
              onLogin(email, password, 'doctor_dashboard')
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
                  id="admin-login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    if (formError) setFormError(null)
                  }}
                  placeholder="Password"
                  className="agent-input agent-input-icon agent-input-icon-right"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--agent-muted-soft)] transition hover:text-[color:var(--agent-ink)]"
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

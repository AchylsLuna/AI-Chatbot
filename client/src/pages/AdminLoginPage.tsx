import { useState } from 'react'
import AuthSplitLayout from '../components/auth/AuthSplitLayout'
import type { AppPage } from '../types/navigation'
import type { AuthProvider, AuthSession } from '../types'
import { formatRoleLabel } from '../utils/roles'

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
  onProviderLogin,
  authProvider = 'local',
  isBiometricReady = false,
  onLogout,
  onNavigate,
}: AdminLoginPageProps) => {
  const [username, setUsername] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [previewMessage, setPreviewMessage] = useState<string | null>(null)

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
                setPreviewMessage(null)
                return
              }
              setFormError(null)
              setPreviewMessage(
                'Preview mode enabled: password is temporarily hidden, and sign-in is disabled.'
              )
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

            {(formError || authError) && (
              <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-300">
                {formError ?? authError}
              </p>
            )}
            {previewMessage ? (
              <p className="rounded-xl border border-sky-300/30 bg-sky-300/10 px-3 py-2 text-xs font-semibold text-sky-300">
                {previewMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled
              className="agent-button w-full disabled:cursor-not-allowed"
            >
              Preview mode
            </button>

            {onProviderLogin ? (
              <button
                type="button"
                onClick={onProviderLogin}
                disabled
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

            <p className="text-center text-[11px] text-[color:var(--agent-muted-soft)]">
              Temporary UI visualization mode: password and authentication are disabled on this screen.
            </p>
          </form>
        )}
      </div>
    </AuthSplitLayout>
  )
}

export default AdminLoginPage

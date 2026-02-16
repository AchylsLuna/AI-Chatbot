import { useState } from 'react'
import AuthSplitLayout from '../components/auth/AuthSplitLayout'
import type { AppPage } from '../types/navigation'
import type { AuthProvider, AuthSession } from '../types/triage'
import { getDefaultPageForRole } from '../utils/roles'

const COM_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.com$/i

type LoginPageProps = {
  authUser: AuthSession['user'] | null
  authError: string | null
  isAuthLoading: boolean
  onLogin: (username: string, password: string) => void
  onProviderLogin?: () => void
  authProvider?: AuthProvider
  isBiometricReady?: boolean
  onLogout: () => void
  onNavigate?: (page: AppPage) => void
  onGoBack?: () => void
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
}: LoginPageProps) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const homePage: AppPage = getDefaultPageForRole(authUser?.role)
  const homeLabel =
    homePage === 'appointments'
      ? 'Go to appointments'
      : homePage === 'doctor_dashboard'
        ? "Go to doctor's dashboard"
        : homePage === 'triage'
          ? 'Go to triage'
          : 'Go to dashboard'

  return (
    <AuthSplitLayout>
      <div>
        <button
          type="button"
          onClick={() => (onGoBack ? onGoBack() : onNavigate?.('landing'))}
          className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-white/60 transition hover:text-white"
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

        <h2 className="text-2xl font-semibold text-white">Welcome back</h2>
        <p className="mt-2 text-sm text-white/60">Sign in, then verify OTP to continue.</p>
      </div>

      {authUser ? (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            Signed in as <span className="font-semibold text-white">{authUser.username}</span>.
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={onLogout} className="agent-button-ghost">
              Sign out
            </button>
            <button onClick={() => onNavigate?.(homePage)} className="agent-button">
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
            if (!COM_EMAIL_PATTERN.test(email)) {
              setFormError('Use a valid .com email address before signing in.')
              return
            }
            onLogin(email, password)
          }}
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-white/40">
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
              type="email"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value)
                if (formError) setFormError(null)
              }}
              placeholder="Email address"
              className="agent-input agent-input-icon"
            />
          </div>

          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-white/40">
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
                if (formError) setFormError(null)
              }}
              placeholder="Password"
              className="agent-input agent-input-icon agent-input-icon-right"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 transition hover:text-white"
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

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => onNavigate?.('forgot_password')}
              className="text-xs font-semibold text-[color:var(--agent-accent)] transition hover:text-[color:var(--agent-accent-strong)]"
            >
              Forgot password?
            </button>
          </div>

          <button type="submit" disabled={isAuthLoading} className="agent-button w-full disabled:cursor-not-allowed">
            {isAuthLoading ? 'Requesting OTP...' : 'Continue to OTP'}
          </button>

          {onProviderLogin ? (
            <button
              type="button"
              disabled={isAuthLoading}
              onClick={onProviderLogin}
              className="agent-button-ghost w-full disabled:cursor-not-allowed"
            >
              Continue with Auth0
            </button>
          ) : null}

          {authProvider === 'auth0' ? (
            <p className="text-center text-[11px] text-white/55">
              Secure SSO mode is active{isBiometricReady ? ' with biometric hooks ready.' : '.'}
            </p>
          ) : null}

          {(formError || authError) && (
            <p className="text-xs font-semibold text-rose-300">{formError ?? authError}</p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/60">
            <span>Don't have an account?</span>
            <button
              type="button"
              onClick={() => onNavigate?.('signup')}
              className="font-semibold text-[color:var(--agent-accent)] transition hover:text-[color:var(--agent-accent-strong)]"
            >
              Create one
            </button>
          </div>
        </form>
      )}
    </AuthSplitLayout>
  )
}

export default LoginPage

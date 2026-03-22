import { useEffect, useRef, useState } from 'react'
import AuthSplitLayout from '../components/auth/AuthSplitLayout'
import PasswordVisibilityToggle from '../components/auth/PasswordVisibilityToggle'
import { api } from '../services/api'
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
  onForgotPassword?: () => void
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
  onForgotPassword,
  onGoBack,
  defaultRoleTab = 'patient',
}: LoginPageProps) => {
  const [username, setUsername] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [doctorLicenseId, setDoctorLicenseId] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const passwordInputRef = useRef<HTMLInputElement | null>(null)
  const roleTab: LoginRoleTab = defaultRoleTab === 'doctor' ? 'doctor' : 'patient'
  const currentAuthPage: AppPage = roleTab === 'doctor' ? 'doctor_login' : 'login'
  const homePage: AppPage = getDefaultPageForRole(authUser?.role)
  const homeLabel =
    homePage === 'appointments'
      ? 'Go to appointments'
      : homePage === 'doctor_dashboard'
        ? "Go to doctor's dashboard"
        : homePage === 'admin'
          ? 'Go to admin dashboard'
          : 'Go to dashboard'

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
              const passwordValue = passwordInputRef.current?.value ?? ''
              if (!EMAIL_PATTERN.test(email)) {
                setEmailError('Use a valid email address before signing in.')
                return
              }
              if (!passwordValue.trim()) {
                setPasswordError('Enter your password before signing in.')
                return
              }
              setEmailError(null)
              setPasswordError(null)
              onLogin(email, passwordValue, roleTab === 'doctor' ? 'doctor_dashboard' : 'appointments')
              resetPasswordField()
            }}
        >
          <p className="auth-lovable-section-label">
            {roleTab === 'doctor' ? 'Doctor access' : 'Patient access'}
          </p>

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
              ref={passwordInputRef}
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onInput={() => {
                if (passwordError) setPasswordError(null)
              }}
              placeholder="Password"
              className="auth-lovable-input pl-10 pr-10"
            />
            <PasswordVisibilityToggle
              visible={showPassword}
              onToggle={() => setShowPassword((previous) => !previous)}
            />
          </div>
          {passwordError ? <p className="auth-lovable-field-error" role="alert">{passwordError}</p> : null}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (onForgotPassword) {
                  onForgotPassword()
                  return
                }
                onNavigate?.('forgot_password')
              }}
              className="auth-lovable-link text-sm"
            >
              Forgot password?
            </button>
          </div>

          <button type="submit" disabled={isAuthLoading} className="auth-lovable-primary-button w-full h-12">
            {isAuthLoading ? 'Signing in...' : roleTab === 'doctor' ? 'Sign In as Doctor' : 'Sign In'}
          </button>

          <div className="auth-lovable-divider">
            <span>Or continue with</span>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                window.location.href = api.buildGoogleAuthUrl(currentAuthPage)
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

import { type FormEvent, useMemo, useState } from 'react'
import AuthSplitLayout from '../components/auth/AuthSplitLayout'
import PasswordVisibilityToggle from '../components/auth/PasswordVisibilityToggle'
import { api } from '../services/api'
import type { AppPage } from '../types/navigation'

type ForgotPasswordSourcePage = Extract<AppPage, 'login' | 'doctor_login' | 'admin_login'>

type ForgotPasswordPageProps = {
  onNavigate?: (page: AppPage) => void
  onGoBack?: () => void
  sourcePage?: ForgotPasswordSourcePage
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const sourceLabelMap: Record<ForgotPasswordSourcePage, string> = {
  login: 'patient sign in',
  doctor_login: 'doctor sign in',
  admin_login: 'admin sign in',
}

const meetsPasswordPolicy = (value: string) => {
  if (value.length < 8) return false
  if (!/[A-Z]/.test(value)) return false
  if (!/[a-z]/.test(value)) return false
  if (!/\d/.test(value)) return false
  if (!/[^A-Za-z0-9]/.test(value)) return false
  return true
}

const readForgotPasswordSearch = () => {
  if (typeof window === 'undefined') {
    return { resetToken: null, sourcePage: null as ForgotPasswordSourcePage | null }
  }

  const params = new URLSearchParams(window.location.search)
  const resetToken = params.get('reset')
  const source = params.get('source')
  const sourcePage: ForgotPasswordSourcePage | null =
    source === 'login' || source === 'doctor_login' || source === 'admin_login'
      ? source
      : null

  return {
    resetToken: resetToken && resetToken.trim() ? resetToken.trim() : null,
    sourcePage,
  }
}

const ForgotPasswordPage = ({
  onNavigate,
  onGoBack,
  sourcePage,
}: ForgotPasswordPageProps) => {
  const searchState = useMemo(readForgotPasswordSearch, [])
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const loginTarget: ForgotPasswordSourcePage = sourcePage ?? searchState.sourcePage ?? 'login'
  const sourceLabel = sourceLabelMap[loginTarget]
  const signupTarget: AppPage = loginTarget === 'doctor_login' ? 'doctor_signup' : 'signup'
  const showCreateAccountLink = loginTarget !== 'admin_login'
  const isResetMode = Boolean(searchState.resetToken)

  const handleRequestSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedEmail) {
      setEmailError('Please enter your email address.')
      return
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setEmailError('Please enter a valid email address.')
      return
    }

    setEmail(trimmedEmail)
    setEmailError(null)
    setRequestError(null)
    setPreviewUrl(null)
    setIsSubmitting(true)
    try {
      const result = await api.requestPasswordReset(trimmedEmail, loginTarget)
      setPreviewUrl(result.previewUrl ?? null)
      setSubmitted(true)
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Unable to send reset instructions.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const nextPassword = newPassword.trim()
    const nextConfirmPassword = confirmPassword.trim()

    if (!nextPassword || !nextConfirmPassword) {
      setResetError('Enter your new password and confirm it.')
      return
    }

    if (!meetsPasswordPolicy(nextPassword)) {
      setResetError(
        'Use a stronger password: at least 8 characters with uppercase, lowercase, number, and special character.'
      )
      return
    }

    if (nextPassword !== nextConfirmPassword) {
      setResetError('New password and confirm password do not match.')
      return
    }

    setResetError(null)
    setIsResetting(true)
    try {
      await api.resetPassword(searchState.resetToken!, nextPassword)
      setResetSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
      setShowNewPassword(false)
      setShowConfirmPassword(false)
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Unable to reset password.')
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <AuthSplitLayout variant="lovable">
      <div className="auth-lovable-page">
        <button
          type="button"
          onClick={() => (onGoBack ? onGoBack() : onNavigate?.(loginTarget))}
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
          Back to {sourceLabel}
        </button>

        {isResetMode ? (
          resetSuccess ? (
            <>
              <h2 className="auth-lovable-title">Password updated</h2>
              <p className="auth-lovable-subtitle">
                Your password has been reset successfully. Return to {sourceLabel} and sign in with
                your new password.
              </p>

              <div className="mt-6 auth-lovable-actions">
                <button
                  type="button"
                  onClick={() => onNavigate?.(loginTarget)}
                  className="auth-lovable-primary-button px-4 py-2.5"
                >
                  Go to {sourceLabel}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="auth-lovable-title">Reset password</h2>
              <p className="auth-lovable-subtitle">
                Enter a new password for your account. This reset link expires after a short time
                for security.
              </p>

              <form className="mt-6 space-y-4" onSubmit={handleResetSubmit}>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value)
                      if (resetError) setResetError(null)
                    }}
                    placeholder="New password"
                    className="auth-lovable-input pr-10"
                  />
                  <PasswordVisibilityToggle
                    visible={showNewPassword}
                    onToggle={() => setShowNewPassword((previous) => !previous)}
                    visibleLabel="Hide new password"
                    hiddenLabel="Show new password"
                  />
                </div>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value)
                      if (resetError) setResetError(null)
                    }}
                    placeholder="Confirm new password"
                    className="auth-lovable-input pr-10"
                  />
                  <PasswordVisibilityToggle
                    visible={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword((previous) => !previous)}
                    visibleLabel="Hide confirm password"
                    hiddenLabel="Show confirm password"
                  />
                </div>
                {resetError ? <p className="auth-lovable-alert-error">{resetError}</p> : null}
                <button
                  type="submit"
                  disabled={isResetting}
                  className="auth-lovable-primary-button h-12 w-full disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isResetting ? 'Updating password...' : 'Reset password'}
                </button>
              </form>
            </>
          )
        ) : submitted ? (
          <>
            <h2 className="auth-lovable-title">Check your inbox</h2>
            <p className="auth-lovable-subtitle">
              If an account exists for {email}, reset instructions were sent. For security, we do
              not confirm whether that email is registered.
            </p>

            <div className="mt-6 rounded-xl border border-[color:var(--auth-lovable-border)] bg-[color:var(--auth-lovable-surface-soft)] p-3 text-sm text-[color:var(--auth-lovable-muted)]">
              Reset links expire for security. If you do not receive an email soon, try again with
              the same address or a different one.
            </div>

            {previewUrl ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
                Development preview available.
                <a
                  href={previewUrl}
                  className="auth-lovable-link ml-1 font-medium"
                >
                  Open reset link
                </a>
              </div>
            ) : null}

            <div className="mt-6 auth-lovable-actions">
              <button
                type="button"
                onClick={() => onNavigate?.(loginTarget)}
                className="auth-lovable-primary-button px-4 py-2.5"
              >
                Back to {sourceLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false)
                  setEmailError(null)
                  setRequestError(null)
                  setPreviewUrl(null)
                }}
                className="auth-lovable-secondary-button px-4 py-2.5"
              >
                Try another email
              </button>
            </div>

            {showCreateAccountLink ? (
              <p className="mt-4 text-sm text-[color:var(--auth-lovable-muted)]">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => onNavigate?.(signupTarget)}
                  className="auth-lovable-link font-medium"
                >
                  Create one
                </button>
              </p>
            ) : null}
          </>
        ) : (
          <>
            <h2 className="auth-lovable-title">Forgot password</h2>
            <p className="auth-lovable-subtitle">
              Enter your account email and we will send reset instructions.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleRequestSubmit}>
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
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    if (emailError) setEmailError(null)
                    if (requestError) setRequestError(null)
                  }}
                  placeholder="Email address"
                  className="auth-lovable-input pl-10"
                  aria-invalid={emailError ? 'true' : 'false'}
                />
              </div>
              {emailError ? (
                <p className="auth-lovable-field-error" role="alert">
                  {emailError}
                </p>
              ) : null}
              {requestError ? <p className="auth-lovable-alert-error">{requestError}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="auth-lovable-primary-button h-12 w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Sending reset link...' : 'Send reset link'}
              </button>

              <div className="flex justify-center">
                <p className="text-sm text-[color:var(--auth-lovable-muted)]">
                  Back to{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate?.(loginTarget)}
                    className="auth-lovable-link font-medium"
                  >
                    {sourceLabel}
                  </button>
                  {showCreateAccountLink ? (
                    <>
                      {' '}or{' '}
                      <button
                        type="button"
                        onClick={() => onNavigate?.(signupTarget)}
                        className="auth-lovable-link font-medium"
                      >
                        create an account
                      </button>
                    </>
                  ) : null}
                  .
                </p>
              </div>
            </form>
          </>
        )}
      </div>
    </AuthSplitLayout>
  )
}

export default ForgotPasswordPage

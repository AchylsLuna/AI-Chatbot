import { type FormEvent, useState } from 'react'
import AuthSplitLayout from '../components/auth/AuthSplitLayout'
import type { AppPage } from '../types/navigation'

type ForgotPasswordPageProps = {
  onNavigate?: (page: AppPage) => void
  onGoBack?: () => void
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ForgotPasswordPage = ({ onNavigate, onGoBack }: ForgotPasswordPageProps) => {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent) => {
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
    setSubmitted(true)
  }

  return (
    <AuthSplitLayout variant="lovable">
      <div className="auth-lovable-page">
        <button
          type="button"
          onClick={() => (onGoBack ? onGoBack() : onNavigate?.('login'))}
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

        {submitted ? (
          <>
            <h2 className="auth-lovable-title">Check your inbox</h2>
            <p className="auth-lovable-subtitle">
              If an account exists for {email}, reset instructions were sent. For security, we do
              not confirm whether that email is registered.
            </p>

            <div className="mt-6 rounded-xl border border-[color:var(--auth-lovable-border)] bg-[color:var(--auth-lovable-surface-soft)] p-3 text-sm text-[color:var(--auth-lovable-muted)]">
              Reset links expire for security. If you do not receive an email soon, try again with
              the same address or a different one. If you do not have an account yet, create one
              instead.
            </div>

            <div className="mt-6 auth-lovable-actions">
              <button
                type="button"
                onClick={() => onNavigate?.('login')}
                className="auth-lovable-primary-button px-4 py-2.5"
              >
                Back to login
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false)
                  setEmailError(null)
                }}
                className="auth-lovable-secondary-button px-4 py-2.5"
              >
                Try another email
              </button>
            </div>

            <p className="mt-4 text-sm text-[color:var(--auth-lovable-muted)]">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => onNavigate?.('signup')}
                className="auth-lovable-link font-medium"
              >
                Create one
              </button>
            </p>
          </>
        ) : (
          <>
            <h2 className="auth-lovable-title">Forgot password</h2>
            <p className="auth-lovable-subtitle">
              Enter your account email and we will send reset instructions. If you do not have an
              account yet, sign up instead.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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

              <button type="submit" className="auth-lovable-primary-button h-12 w-full">
                Send reset link
              </button>

              <div className="flex justify-center">
                <p className="text-sm text-[color:var(--auth-lovable-muted)]">
                  Back to{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate?.('login')}
                    className="auth-lovable-link font-medium"
                  >
                    login
                  </button>
                  {' '}or{' '}
                  <button
                    type="button"
                    onClick={() => onNavigate?.('signup')}
                    className="auth-lovable-link font-medium"
                  >
                    create an account
                  </button>
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

import { useState } from 'react'
import type { FormEvent } from 'react'
import AuthSplitLayout from '../components/auth/AuthSplitLayout'
import type { AppPage } from '../types/navigation'
import { backChipButtonClass } from '../styles/uiClassNames'

type ForgotPasswordPageProps = {
  onNavigate?: (page: AppPage) => void
  onGoBack?: () => void
}

const ForgotPasswordPage = ({ onNavigate, onGoBack }: ForgotPasswordPageProps) => {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setEmailError('Please enter your email address.')
      return
    }

    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
    if (!isValidEmail) {
      setEmailError('Please enter a valid email address.')
      return
    }

    setEmailError(null)
    setSubmitted(true)
  }

  return (
    <AuthSplitLayout>
      <button
        type="button"
        onClick={() => (onGoBack ? onGoBack() : onNavigate?.('login'))}
        className={`${backChipButtonClass} mb-4`}
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
        <div>
          <p className="agent-eyebrow">Reset requested</p>
          <h2 className="mt-4 agent-section-title">Check your inbox</h2>
          <p className="mt-3 text-sm leading-7 text-[color:var(--agent-muted)]">
            If an account exists for <span className="font-semibold text-[color:var(--agent-ink)]">{email}</span>,
            password reset instructions were sent.
          </p>

          <div className="agent-alert agent-alert--info mt-5">
            Reset links expire for security. If you do not receive an email soon, try again.
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={() => onNavigate?.('login')} className="agent-button px-4 py-2.5 text-[color:var(--agent-on-accent)]">
              Back to login
            </button>
            <button
              onClick={() => {
                setSubmitted(false)
                setEmailError(null)
              }}
              className="agent-button-ghost px-4 py-2.5"
            >
              Try another email
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p className="agent-eyebrow">Recovery</p>
          <h2 className="mt-4 agent-section-title">Forgot password</h2>
          <p className="mt-3 text-sm leading-7 text-[color:var(--agent-muted)]">
            Enter your account email and we will send reset instructions.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  if (emailError) setEmailError(null)
                }}
                placeholder="Email address"
                className="agent-input agent-input-icon"
                aria-invalid={emailError ? 'true' : 'false'}
              />
            </div>
            {emailError ? <p className="agent-field-error" role="alert">{emailError}</p> : null}

            <button type="submit" className="agent-button w-full text-[color:var(--agent-on-accent)]">
              Send reset link
            </button>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => onNavigate?.('login')}
                className="text-xs font-semibold text-[color:var(--agent-muted)] transition hover:text-[color:var(--agent-ink)]"
              >
                Back to login
              </button>
            </div>
          </form>
        </div>
      )}
    </AuthSplitLayout>
  )
}

export default ForgotPasswordPage

import { useState } from 'react'
import type { FormEvent } from 'react'
import AuthSplitLayout from '../components/auth/AuthSplitLayout'
import type { AppPage } from '../types/navigation'

type ForgotPasswordPageProps = {
  onNavigate?: (page: AppPage) => void
}

const ForgotPasswordPage = ({ onNavigate }: ForgotPasswordPageProps) => {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setError('Please enter your email address.')
      return
    }

    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
    if (!isValidEmail) {
      setError('Please enter a valid email address.')
      return
    }

    setError(null)
    setSubmitted(true)
  }

  return (
    <AuthSplitLayout>
      <button
        type="button"
        onClick={() => onNavigate?.('login')}
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

      {submitted ? (
        <div>
          <h2 className="text-2xl font-semibold text-white">Check your inbox</h2>
          <p className="mt-2 text-sm text-white/60">
            If an account exists for <span className="font-semibold text-white">{email}</span>,
            password reset instructions were sent.
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            Reset links expire for security. If you do not receive an email soon, try again.
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button onClick={() => onNavigate?.('login')} className="agent-button">
              Back to login
            </button>
            <button
              onClick={() => {
                setSubmitted(false)
                setError(null)
              }}
              className="agent-button-ghost"
            >
              Try another email
            </button>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-2xl font-semibold text-white">Forgot password</h2>
          <p className="mt-2 text-sm text-white/60">
            Enter your account email and we will send reset instructions.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
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
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email address"
                className="agent-input agent-input-icon"
              />
            </div>

            {error && <p className="text-xs font-semibold text-rose-300">{error}</p>}

            <button type="submit" className="agent-button w-full">
              Send reset link
            </button>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => onNavigate?.('login')}
                className="text-xs font-semibold text-white/60 transition hover:text-white"
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

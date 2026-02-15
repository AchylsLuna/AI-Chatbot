import { useState } from 'react'
import AuthSplitLayout from '../components/auth/AuthSplitLayout'
import { api } from '../services/api'
import type { AppPage } from '../types/navigation'
import type { AuthSession, SignupDraft } from '../types/triage'

type SignupPageProps = {
  onNavigate?: (page: AppPage) => void
  onSignupSuccess?: (session: AuthSession) => void
  onGoBack?: () => void
}

const meetsPasswordPolicy = (value: string) => {
  if (value.length < 8) return false
  if (!/[A-Z]/.test(value)) return false
  if (!/[a-z]/.test(value)) return false
  if (!/\d/.test(value)) return false
  return true
}

const getPasswordStrength = (value: string): { label: 'Weak' | 'Medium' | 'Strong'; score: 1 | 2 | 3 } => {
  let points = 0
  if (value.length >= 8) points += 1
  if (/[a-z]/.test(value)) points += 1
  if (/[A-Z]/.test(value)) points += 1
  if (/\d/.test(value)) points += 1
  if (/[^A-Za-z0-9]/.test(value)) points += 1

  if (points >= 4) return { label: 'Strong', score: 3 }
  if (points >= 3) return { label: 'Medium', score: 2 }
  return { label: 'Weak', score: 1 }
}

const SignupPage = ({ onNavigate, onSignupSuccess, onGoBack }: SignupPageProps) => {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [signupSession, setSignupSession] = useState<AuthSession | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const passwordStrength = getPasswordStrength(password)
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword

  return (
    <AuthSplitLayout>
      {signupSession ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Account created</h2>
          <p className="text-sm text-white/60">
            Your account is ready. Sign in and verify OTP to continue.
          </p>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            <p>Username: {signupSession.user.username}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => onNavigate?.('login')} className="agent-button">
              Go to login
            </button>
            <button
              onClick={() => {
                setSignupSession(null)
                setSubmitError(null)
                setFullName('')
                setEmail('')
                setPassword('')
                setConfirmPassword('')
              }}
              className="agent-button-ghost"
            >
              Create another account
            </button>
          </div>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => (onGoBack ? onGoBack() : onNavigate?.('login'))}
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

          <h2 className="text-2xl font-semibold text-white">Create your account</h2>
          <p className="mt-2 text-sm text-white/60">Start your AI-powered health journey today</p>

          <form
            className="mt-6 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault()
              const cleanedFullName = fullName.trim()
              const cleanedEmail = email.trim()
              const cleanedPassword = password.trim()
              const cleanedConfirmPassword = confirmPassword.trim()

              if (!cleanedFullName || !cleanedEmail || !cleanedPassword || !cleanedConfirmPassword) {
                setSubmitError('Please complete all required fields.')
                return
              }
              if (!meetsPasswordPolicy(cleanedPassword)) {
                setSubmitError(
                  'Use a stronger password: at least 8 characters with uppercase, lowercase, and number.'
                )
                return
              }
              if (cleanedPassword !== cleanedConfirmPassword) {
                setSubmitError('Password and confirm password do not match.')
                return
              }
              setIsSubmitting(true)
              setSubmitError(null)
              try {
                const payload: SignupDraft = {
                  username: cleanedEmail,
                  password: cleanedPassword,
                  fullName: cleanedFullName,
                  email: cleanedEmail,
                }
                const session = await api.signup(payload)
                setSignupSession(session)
                onSignupSuccess?.(session)
              } catch (error) {
                setSubmitError(error instanceof Error ? error.message : 'Submission failed')
              } finally {
                setIsSubmitting(false)
              }
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
                  <path d="M5 21h14" />
                  <path d="M7 21v-4a5 5 0 0110 0v4" />
                  <path d="M12 11a4 4 0 100-8 4 4 0 000 8z" />
                </svg>
              </span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Full name"
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
                  if (submitError) setSubmitError(null)
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

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">Password strength</span>
                <span
                  className={`font-semibold ${
                    passwordStrength.label === 'Strong'
                      ? 'text-emerald-300'
                      : passwordStrength.label === 'Medium'
                        ? 'text-amber-300'
                        : 'text-rose-300'
                  }`}
                >
                  {passwordStrength.label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((bar) => (
                  <div
                    key={bar}
                    className={`h-1.5 rounded-full ${
                      passwordStrength.score >= bar
                        ? passwordStrength.label === 'Strong'
                          ? 'bg-emerald-400'
                          : passwordStrength.label === 'Medium'
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                        : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-white/50">
                Use at least 8 characters with uppercase, lowercase, and number.
              </p>
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
                  <path d="M9 15l2 2 4-4" />
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value)
                  if (submitError) setSubmitError(null)
                }}
                placeholder="Confirm password"
                className="agent-input agent-input-icon"
              />
            </div>

            {confirmPassword.length > 0 && (
              <p className={`text-xs font-semibold ${passwordsMatch ? 'text-emerald-300' : 'text-rose-300'}`}>
                {passwordsMatch ? 'Passwords match.' : 'Passwords do not match.'}
              </p>
            )}

            <button type="submit" disabled={isSubmitting} className="agent-button w-full disabled:cursor-not-allowed">
              {isSubmitting ? 'Creating...' : 'Create Account'}
            </button>

            <p className="text-xs text-white/50">
              By signing up, you agree to our Terms of Service and Privacy Policy.
            </p>

            {submitError && <p className="text-xs font-semibold text-rose-300">{submitError}</p>}

            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-white/60">
              <span>Already have an account?</span>
              <button
                type="button"
                onClick={() => onNavigate?.('login')}
                className="font-semibold text-[color:var(--agent-accent)] transition hover:text-[color:var(--agent-accent-strong)]"
              >
                Sign in
              </button>
            </div>
          </form>
        </div>
      )}
    </AuthSplitLayout>
  )
}

export default SignupPage

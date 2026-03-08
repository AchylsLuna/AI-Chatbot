import { useState } from 'react'
import AuthSplitLayout from '../components/auth/AuthSplitLayout'
import { api } from '../services/api'
import { backChipButtonClass, modalBackdropClass, modalPanelClass } from '../styles/uiClassNames'
import type { AppPage } from '../types/navigation'
import type { AuthSession, SignupDraft } from '../types'

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
  const [hasPasswordInteracted, setHasPasswordInteracted] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null)
  const [signupSession, setSignupSession] = useState<AuthSession | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const passwordStrength = getPasswordStrength(password)
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword

  return (
    <AuthSplitLayout>
      {signupSession ? (
        <div className="space-y-4">
          <p className="agent-eyebrow">Registration complete</p>
          <h2 className="mt-4 agent-section-title">Account created</h2>
          <p className="text-sm leading-7 text-[color:var(--agent-muted)]">
            Your account is ready. Sign in and verify OTP to continue.
          </p>
          <div className="agent-alert agent-alert--success">
            <p>Username: {signupSession.user.username}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => onNavigate?.('login')} className="agent-button px-4 py-2.5 text-[color:var(--agent-on-accent)]">
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
              className="agent-button-ghost px-4 py-2.5"
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

          <p className="agent-eyebrow">Create account</p>
          <h2 className="mt-4 agent-section-title">Create your account</h2>
          <p className="mt-3 text-sm leading-7 text-[color:var(--agent-muted)]">
            Register once to access patient booking workflows and secure clinical entry points.
          </p>

          <form
            className="mt-6 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault()
              const cleanedFullName = fullName.trim()
              const cleanedEmail = email.trim().toLowerCase()
              const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
              const cleanedPassword = password.trim()
              const cleanedConfirmPassword = confirmPassword.trim()

              if (!cleanedFullName || !cleanedEmail || !cleanedPassword || !cleanedConfirmPassword) {
                setEmailError(null)
                setSubmitError('Please complete all required fields.')
                return
              }
              if (!EMAIL_PATTERN.test(cleanedEmail)) {
                setEmailError('Please use a valid email address.')
                setSubmitError(null)
                return
              }
              setEmailError(null)
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
              if (!acceptedTerms) {
                setSubmitError('Please accept the Terms and Conditions to continue.')
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
                await api.signup(payload)
                const session = { user: { username: cleanedEmail, role: 'user' } } as unknown as AuthSession
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
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => {
                  if (!hasPasswordInteracted) setHasPasswordInteracted(true)
                  setPassword(event.target.value)
                  if (submitError) setSubmitError(null)
                }}
                onFocus={() => setHasPasswordInteracted(true)}
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

            {hasPasswordInteracted && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[color:var(--agent-muted)]">Password strength</span>
                  <span
                    className={`font-semibold ${
                      passwordStrength.label === 'Strong'
                        ? 'text-[color:var(--agent-success)]'
                        : passwordStrength.label === 'Medium'
                          ? 'text-[color:var(--agent-warning)]'
                          : 'text-[color:var(--agent-danger)]'
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
                            ? 'bg-[color:var(--agent-success)]'
                            : passwordStrength.label === 'Medium'
                              ? 'bg-[color:var(--agent-warning)]'
                              : 'bg-[color:var(--agent-danger)]'
                          : 'bg-[color:var(--agent-overlay)]'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-[color:var(--agent-muted-soft)]">
                  Use at least 8 characters with uppercase, lowercase, and number.
                </p>
              </div>
            )}

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
              <p
                className={`text-xs font-semibold ${
                  passwordsMatch ? 'text-[color:var(--agent-success)]' : 'text-[color:var(--agent-danger)]'
                }`}
              >
                {passwordsMatch ? 'Passwords match.' : 'Passwords do not match.'}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="agent-button w-full text-[color:var(--agent-on-accent)] disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Account'}
            </button>

            <label className="flex items-start gap-2 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-overlay)] px-3 py-3 text-xs text-[color:var(--agent-muted)]">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(event) => {
                  setAcceptedTerms(event.target.checked)
                  if (submitError) setSubmitError(null)
                }}
                className="mt-0.5 h-4 w-4 rounded border-white/30 bg-transparent accent-[color:var(--agent-accent)]"
              />
              <span>
                By signing up, you agree to our{' '}
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setLegalModal('terms')
                  }}
                  className="font-semibold text-[color:var(--agent-accent)] underline-offset-2 hover:underline"
                >
                  Terms and Conditions
                </button>{' '}
                and{' '}
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setLegalModal('privacy')
                  }}
                  className="font-semibold text-[color:var(--agent-accent)] underline-offset-2 hover:underline"
                >
                  Privacy Policy
                </button>
                .
              </span>
            </label>

            {submitError && <p className="agent-alert agent-alert--error">{submitError}</p>}

            <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-[color:var(--agent-muted)]">
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

          {legalModal && (
            <div className={`${modalBackdropClass} z-[70]`}>
              <div className={`${modalPanelClass} max-w-lg`}>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-base font-semibold text-[color:var(--agent-ink)]">
                    {legalModal === 'terms' ? 'Terms and Conditions' : 'Privacy Policy'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setLegalModal(null)}
                    className="text-xs font-semibold text-[color:var(--agent-muted)] transition hover:text-[color:var(--agent-ink)]"
                  >
                    Close
                  </button>
                </div>

                {legalModal === 'terms' ? (
                  <div className="mt-3 space-y-2 text-xs text-[color:var(--agent-ink)]/75">
                    <p>1. This platform provides guidance tools and scheduling workflows only.</p>
                    <p>2. Emergency cases should be handled through local emergency services.</p>
                    <p>3. Users must keep account credentials secure and confidential.</p>
                    <p>4. Role-based access rules apply to all dashboards and records.</p>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2 text-xs text-[color:var(--agent-ink)]/75">
                    <p>1. We process account and booking data for clinical workflow support.</p>
                    <p>2. Access is protected through role controls and session security checks.</p>
                    <p>3. Sensitive identifiers may be masked depending on security settings.</p>
                    <p>4. Audit events are recorded for integrity and compliance operations.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </AuthSplitLayout>
  )
}

export default SignupPage

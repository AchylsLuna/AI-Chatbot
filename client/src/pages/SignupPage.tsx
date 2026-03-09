import { useState } from 'react'
import AuthSplitLayout from '../components/auth/AuthSplitLayout'
import { api } from '../services/api'
import type { AppPage } from '../types/navigation'
import type { AuthSession, SignupDraft } from '../types'

type SignupPageProps = {
  onNavigate?: (page: AppPage) => void
  onSignupSuccess?: (session: AuthSession) => void
  onGoBack?: () => void
}

type SignupRoleTab = 'patient' | 'doctor'

const meetsPasswordPolicy = (value: string) => {
  if (value.length < 8) return false
  if (!/[A-Z]/.test(value)) return false
  if (!/[a-z]/.test(value)) return false
  if (!/\d/.test(value)) return false
  return true
}

const LEGAL_TERMS_VIEWED_KEY = 'pulse-ledger-legal-terms-viewed'
const LEGAL_PRIVACY_VIEWED_KEY = 'pulse-ledger-legal-privacy-viewed'

const getInitialLegalViewedState = (key: string) => {
  if (typeof window === 'undefined') return false
  return window.sessionStorage.getItem(key) === 'true'
}

const SignupPage = ({ onNavigate, onSignupSuccess, onGoBack }: SignupPageProps) => {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [roleTab, setRoleTab] = useState<SignupRoleTab>('patient')
  const [doctorLicenseId, setDoctorLicenseId] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [hospitalName, setHospitalName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [hasViewedTerms, setHasViewedTerms] = useState<boolean>(() =>
    getInitialLegalViewedState(LEGAL_TERMS_VIEWED_KEY)
  )
  const [hasViewedPrivacy, setHasViewedPrivacy] = useState<boolean>(() =>
    getInitialLegalViewedState(LEGAL_PRIVACY_VIEWED_KEY)
  )
  const [signupSession, setSignupSession] = useState<AuthSession | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const markTermsViewedAndOpen = () => {
    setHasViewedTerms(true)
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(LEGAL_TERMS_VIEWED_KEY, 'true')
    }
    onNavigate?.('terms')
  }

  const markPrivacyViewedAndOpen = () => {
    setHasViewedPrivacy(true)
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(LEGAL_PRIVACY_VIEWED_KEY, 'true')
    }
    onNavigate?.('privacy_policy')
  }

  if (signupSession) {
    return (
      <AuthSplitLayout variant="lovable">
        <div className="auth-lovable-page">
          <h2 className="auth-lovable-title">Account created</h2>
          <p className="auth-lovable-subtitle">Your account is ready. Sign in and verify OTP to continue.</p>
          <div className="mt-4 rounded-xl border border-[color:var(--auth-lovable-border)] bg-[color:var(--auth-lovable-surface-soft)] p-3 text-sm text-[color:var(--auth-lovable-muted)]">
            Username: {signupSession.user.username}
          </div>
          <div className="auth-lovable-actions mt-5">
            <button
              onClick={() => onNavigate?.('login')}
              className="auth-lovable-primary-button px-4 py-2.5"
            >
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
                setDoctorLicenseId('')
                setSpecialty('')
                setHospitalName('')
                setAcceptedTerms(false)
                setHasViewedTerms(false)
                setHasViewedPrivacy(false)
                if (typeof window !== 'undefined') {
                  window.sessionStorage.removeItem(LEGAL_TERMS_VIEWED_KEY)
                  window.sessionStorage.removeItem(LEGAL_PRIVACY_VIEWED_KEY)
                }
              }}
              className="auth-lovable-secondary-button px-4 py-2.5"
            >
              Create another account
            </button>
          </div>
        </div>
      </AuthSplitLayout>
    )
  }

  return (
    <AuthSplitLayout variant="lovable">
      <div className="auth-lovable-page">
        {onGoBack ? (
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
        ) : null}

        <h2 className="auth-lovable-title">Create your account</h2>
        <p className="auth-lovable-subtitle">Start your AI-powered health journey today</p>

        <div className="auth-lovable-role-wrap mt-6">
          <button
            type="button"
            onClick={() => setRoleTab('patient')}
            className={`auth-lovable-role-button ${roleTab === 'patient' ? 'is-active' : ''}`}
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
              <path d="M12 12a4 4 0 100-8 4 4 0 000 8z" />
              <path d="M4 21a8 8 0 0116 0" />
            </svg>
            Patient
          </button>
          <button
            type="button"
            onClick={() => setRoleTab('doctor')}
            className={`auth-lovable-role-button ${roleTab === 'doctor' ? 'is-active' : ''}`}
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
              <path d="M12 3v18M3 12h18" />
            </svg>
            Doctor
          </button>
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={async (event) => {
          event.preventDefault()
          const cleanedFullName = fullName.trim()
          const cleanedEmail = email.trim().toLowerCase()
          const cleanedPassword = password.trim()
          const cleanedConfirmPassword = confirmPassword.trim()
          const cleanedDoctorLicenseId = doctorLicenseId.trim()
          const cleanedSpecialty = specialty.trim()
          const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

          if (!cleanedFullName || !cleanedEmail || !cleanedPassword || !cleanedConfirmPassword) {
            setSubmitError('Please complete all required fields.')
            setEmailError(null)
            return
          }
          if (!EMAIL_PATTERN.test(cleanedEmail)) {
            setEmailError('Please use a valid email address.')
            setSubmitError(null)
            return
          }
          setEmailError(null)
          if (roleTab === 'doctor' && (!cleanedDoctorLicenseId || !cleanedSpecialty)) {
            setSubmitError('Doctor sign up requires Medical License ID and Specialty.')
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
          if (!hasViewedTerms || !hasViewedPrivacy) {
            setSubmitError(
              'Please open Terms and Conditions and Privacy Policy (RA 10173) before continuing.'
            )
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
              organization:
                roleTab === 'doctor'
                  ? `${cleanedSpecialty}${hospitalName.trim() ? ` • ${hospitalName.trim()}` : ''}`
                  : undefined,
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
              <path d="M5 21h14" />
              <path d="M7 21v-4a5 5 0 0110 0v4" />
              <path d="M12 11a4 4 0 100-8 4 4 0 000 8z" />
            </svg>
          </span>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder={roleTab === 'doctor' ? 'Dr. Full Name' : 'Full name'}
            className="auth-lovable-input pl-10"
          />
        </div>

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
            placeholder={roleTab === 'doctor' ? 'Professional email' : 'Email address'}
            className="auth-lovable-input pl-10"
            aria-invalid={emailError ? 'true' : 'false'}
          />
        </div>
        {emailError ? <p className="auth-lovable-field-error">{emailError}</p> : null}

        {roleTab === 'doctor' ? (
          <>
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
                onChange={(event) => setDoctorLicenseId(event.target.value)}
                placeholder="Medical License ID"
                className="auth-lovable-input pl-10"
              />
            </div>

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
                  <path d="M12 3v18M3 12h18" />
                </svg>
              </span>
              <input
                type="text"
                value={specialty}
                onChange={(event) => setSpecialty(event.target.value)}
                placeholder="Specialty (e.g. Cardiology)"
                className="auth-lovable-input pl-10"
              />
            </div>

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
                  <path d="M3 21h18" />
                  <path d="M5 21V8l7-4 7 4v13" />
                  <path d="M9 11h6M9 15h6" />
                </svg>
              </span>
              <input
                type="text"
                value={hospitalName}
                onChange={(event) => setHospitalName(event.target.value)}
                placeholder="Hospital / Clinic name"
                className="auth-lovable-input pl-10"
              />
            </div>
          </>
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
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="auth-lovable-input pl-10 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="auth-lovable-password-toggle"
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
              <path d="M9 15l2 2 4-4" />
            </svg>
          </span>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm password"
            className="auth-lovable-input pl-10"
          />
        </div>

        <label className="flex items-start gap-2 rounded-xl border border-[color:var(--auth-lovable-border)] bg-[color:var(--auth-lovable-surface-soft)] px-3 py-3 text-xs text-[color:var(--auth-lovable-muted)]">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[color:var(--auth-lovable-border)] bg-white accent-[color:var(--auth-lovable-primary)]"
          />
          <span>
            By signing up, you agree to our{' '}
            <button
              type="button"
              className="auth-lovable-link underline underline-offset-2"
              onClick={(event) => {
                event.preventDefault()
                markTermsViewedAndOpen()
              }}
            >
              Terms and Conditions
            </button>{' '}
            and{' '}
            <button
              type="button"
              className="auth-lovable-link underline underline-offset-2"
              onClick={(event) => {
                event.preventDefault()
                markPrivacyViewedAndOpen()
              }}
            >
              Privacy Policy
            </button>{' '}
            (Data Privacy Act of 2012, Republic Act No. 10173).
            {!hasViewedTerms || !hasViewedPrivacy ? (
              <span className="mt-1 block text-[11px] text-[color:var(--auth-lovable-muted)]">
                Open both links before submitting.
              </span>
            ) : null}
          </span>
        </label>

        {submitError ? <p className="auth-lovable-alert-error">{submitError}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="auth-lovable-primary-button h-12 w-full"
        >
          {isSubmitting
            ? 'Creating...'
            : roleTab === 'doctor'
              ? 'Register as Doctor'
              : 'Create Account'}
        </button>

          <p className="text-center text-sm text-[color:var(--auth-lovable-muted)]">
            Already have an account?{' '}
            <button type="button" onClick={() => onNavigate?.('login')} className="auth-lovable-link font-medium">
              Sign in
            </button>
          </p>
        </form>
      </div>
    </AuthSplitLayout>
  )
}

export default SignupPage

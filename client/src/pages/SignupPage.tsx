import { useState } from 'react'
import { api } from '../services/api'
import type { AuthSession, SignupDraft, UserRole } from '../types/triage'
import type { AppPage } from '../types/navigation'
import { formatRoleLabel } from '../utils/roles'

type SignupPageProps = {
  onNavigate?: (page: AppPage) => void
  onSignupSuccess?: (session: AuthSession) => void
}

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: 'user', label: 'User' },
  { value: 'nurse', label: 'Nurse / Doctor' },
  { value: 'admin', label: 'Admin' },
  { value: 'system_admin', label: 'System Admin' },
]

const onboardingSteps = [
  'Create your account and choose your primary role.',
  'Credentials are stored securely with hashed passwords.',
  'Role-based access policies are enforced on sign-in.',
  'Admins can adjust access after onboarding if needed.',
]

const roleDetails = [
  {
    title: 'User',
    description: 'Self-service access to personal appointment status and updates.',
  },
  {
    title: 'Nurse / Doctor',
    description: 'Clinical access to triage summaries, overrides, and documentation.',
  },
  {
    title: 'Admin',
    description: 'Operational access for staffing, policy controls, and analytics.',
  },
  {
    title: 'System Admin',
    description: 'Infrastructure ownership, security policies, and integrations.',
  },
]

const SignupPage = ({ onNavigate, onSignupSuccess }: SignupPageProps) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [organization, setOrganization] = useState('')
  const [roleRequested, setRoleRequested] = useState<UserRole>('user')
  const [signupSession, setSignupSession] = useState<AuthSession | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <div className="min-h-screen pb-20">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4" data-reveal>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Account setup
            </p>
            <h1 className="text-3xl font-display font-semibold text-white">Sign up</h1>
            <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
              Create your Pulse Ledger account with the role that matches your workflow.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70">
            4 roles available
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              {signupSession ? (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold text-white">Account created</h2>
                  <p className="text-sm text-[color:var(--agent-muted)]">
                    Your account is ready. You can now sign in with your new credentials.
                  </p>
                  <div className="rounded-2xl border border-white/10 bg-[color:var(--agent-surface-strong)] p-4 text-sm text-white/70">
                    <p>Username: {signupSession.user.username}</p>
                    <p>Role: {formatRoleLabel(signupSession.user.role)}</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => onNavigate?.('login')}
                      className="rounded-xl bg-[color:var(--agent-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--agent-on-accent)] transition hover:-translate-y-0.5"
                    >
                      Go to login
                    </button>
                    <button
                      onClick={() => {
                        setSignupSession(null)
                        setSubmitError(null)
                        setUsername('')
                        setPassword('')
                        setFullName('')
                        setEmail('')
                        setOrganization('')
                        setRoleRequested('user')
                      }}
                      className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
                    >
                      Create another account
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  className="grid gap-4"
                  onSubmit={async (event) => {
                    event.preventDefault()
                    if (!username.trim() || !password.trim()) {
                      setSubmitError('Please enter a username and password.')
                      return
                    }
                    if (password.trim() !== confirmPassword.trim()) {
                      setSubmitError('Passwords do not match.')
                      return
                    }
                    setIsSubmitting(true)
                    setSubmitError(null)
                    try {
                      const payload: SignupDraft = {
                        username: username.trim(),
                        password: password.trim(),
                        role: roleRequested,
                        fullName: fullName.trim() || undefined,
                        email: email.trim() || undefined,
                        organization: organization.trim() || undefined,
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
                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="Username"
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                    />
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Password"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 transition hover:text-white"
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
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Confirm password"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-10 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 transition hover:text-white"
                      >
                        {showConfirmPassword ? (
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
                    <input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Full name"
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Work email"
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                    />
                  </div>
                  <input
                    value={organization}
                    onChange={(event) => setOrganization(event.target.value)}
                    placeholder="Organization / hospital"
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                  />
                  <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                    <select
                      value={roleRequested}
                      onChange={(event) => setRoleRequested(event.target.value as UserRole)}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none"
                    >
                      {roleOptions.map((role) => (
                        <option key={role.value} value={role.value} className="text-slate-900">
                          {role.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-xl bg-[color:var(--agent-accent)] px-4 py-3 text-sm font-semibold text-[color:var(--agent-on-accent)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-emerald-200"
                    >
                      {isSubmitting ? 'Creating...' : 'Create account'}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-white/60">
                    <p>Already have access?</p>
                    <button
                      type="button"
                      onClick={() => onNavigate?.('login')}
                      className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/70 transition hover:border-white/40 hover:text-white"
                    >
                      Go to login
                    </button>
                  </div>
                  {submitError && (
                    <p className="text-xs font-semibold text-rose-300">{submitError}</p>
                  )}
                </form>
              )}
            </div>

            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <h3 className="text-lg font-semibold text-white">Signup details</h3>
              <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
                Role-based access controls are enforced at sign-in. Admins can revise roles after
                onboarding if needed.
              </p>
              <ul className="mt-4 space-y-3 text-sm text-white/70">
                {onboardingSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-6">
            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <h3 className="text-lg font-semibold text-white">Role overview</h3>
              <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
                Choose the minimum role needed for your workflow. Admins can always expand access
                later.
              </p>
              <div className="mt-4 space-y-3">
                {roleDetails.map((role) => (
                  <div
                    key={role.title}
                    className="rounded-2xl border border-white/10 bg-[color:var(--agent-surface-strong)] p-4"
                  >
                    <p className="text-sm font-semibold text-white">{role.title}</p>
                    <p className="mt-1 text-xs text-white/60">{role.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <h3 className="text-lg font-semibold text-white">Need help?</h3>
              <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
                If your role is unclear, request User access and add notes for your department.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => onNavigate?.('landing')}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  Back to overview
                </button>
                <button
                  onClick={() => onNavigate?.('login')}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  Go to login
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SignupPage

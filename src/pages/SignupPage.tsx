import { useState } from 'react'
import { api } from '../services/api'
import type { AccessRequest, AccessRequestDraft, UserRole } from '../types/triage'
import type { AppPage } from '../types/navigation'
import { formatRoleLabel } from '../utils/roles'

type SignupPageProps = {
  onNavigate?: (page: AppPage) => void
}

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: 'user', label: 'User' },
  { value: 'nurse', label: 'Nurse / Doctor' },
  { value: 'admin', label: 'Admin' },
  { value: 'system_admin', label: 'System Admin' },
]

const onboardingSteps = [
  'Submit your access request with the desired role and department.',
  'Admin reviews and assigns least-privilege permissions.',
  'System Admin approves security-sensitive roles.',
  'Credentials are issued with audit logging enabled.',
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

const SignupPage = ({ onNavigate }: SignupPageProps) => {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [organization, setOrganization] = useState('')
  const [roleRequested, setRoleRequested] = useState<UserRole>('user')
  const [notes, setNotes] = useState('')
  const [accessRequest, setAccessRequest] = useState<AccessRequest | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <div className="min-h-screen pb-20">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4" data-reveal>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Account request
            </p>
            <h1 className="text-3xl font-display font-semibold text-white">Sign up</h1>
            <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
              Submit a request to access Pulse Ledger. All accounts are reviewed for role-based
              alignment.
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
              {accessRequest ? (
                <div className="space-y-3">
                  <h2 className="text-lg font-semibold text-white">Request submitted</h2>
                  <p className="text-sm text-[color:var(--agent-muted)]">
                    Your access request was captured. An Admin or System Admin will review your
                    requested role and follow up with next steps.
                  </p>
                  <div className="rounded-2xl border border-white/10 bg-[color:var(--agent-surface-strong)] p-4 text-sm text-white/70">
                    <p>Request ID: {accessRequest.id}</p>
                    <p>Requested role: {formatRoleLabel(accessRequest.roleRequested)}</p>
                    <p>Status: {accessRequest.status}</p>
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
                        setAccessRequest(null)
                        setSubmitError(null)
                        setFullName('')
                        setEmail('')
                        setOrganization('')
                        setRoleRequested('user')
                        setNotes('')
                      }}
                      className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
                    >
                      Submit another request
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  className="grid gap-4"
                  onSubmit={async (event) => {
                    event.preventDefault()
                    if (!fullName.trim() || !email.trim()) {
                      setSubmitError('Please provide your full name and work email.')
                      return
                    }
                    setIsSubmitting(true)
                    setSubmitError(null)
                    const payload: AccessRequestDraft = {
                      fullName: fullName.trim(),
                      email: email.trim(),
                      organization: organization.trim(),
                      roleRequested,
                      notes: notes.trim() || undefined,
                    }
                    try {
                      const request = await api.createAccessRequest(payload)
                      setAccessRequest(request)
                    } catch (error) {
                      setSubmitError(error instanceof Error ? error.message : 'Submission failed')
                    } finally {
                      setIsSubmitting(false)
                    }
                  }}
                >
                  <div className="grid gap-4 md:grid-cols-2">
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
                      {isSubmitting ? 'Submitting...' : 'Submit request'}
                    </button>
                  </div>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={4}
                    placeholder="Notes for the Admin (department, shift, urgency)"
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                  />
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
                Access requests are reviewed by Admin and System Admin roles to ensure least-
                privilege security.
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

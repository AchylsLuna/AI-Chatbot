import { useState } from 'react'
import { api } from '../services/api'
import type { AccessRequestDraft, UserRole } from '../types/triage'

type AccessPageProps = {
  isAuthLoading: boolean
  onLogin: (username: string, password: string) => void
}

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: 'user', label: 'User' },
  { value: 'nurse', label: 'Nurse / Doctor' },
  { value: 'admin', label: 'Admin' },
  { value: 'system_admin', label: 'System Admin' },
]

const AccessPage = ({ isAuthLoading, onLogin }: AccessPageProps) => {
  const [loginUsername, setLoginUsername] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [organization, setOrganization] = useState('')
  const [roleRequested, setRoleRequested] = useState<UserRole>('user')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  return (
    <div className="min-h-screen pb-20">
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-8 shadow-2xl shadow-black/40">
            <h3 className="text-xl font-semibold text-white">Log in</h3>
            <form
              className="mt-6 grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                onLogin(loginUsername, loginPassword)
              }}
            >
              <input
                value={loginUsername}
                onChange={(event) => setLoginUsername(event.target.value)}
                placeholder="Username"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              />
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                placeholder="Password"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isAuthLoading}
                className="rounded-2xl bg-[color:var(--agent-accent)] px-4 py-3 text-sm font-semibold text-[color:var(--agent-on-accent)] shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
              >
                {isAuthLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-8 shadow-2xl shadow-black/40">
            <h3 className="text-xl font-semibold text-white">Sign up</h3>
            <form
              className="mt-6 grid gap-3"
                onSubmit={async (event) => {
                  event.preventDefault()
                  if (!fullName.trim() || !email.trim()) {
                    return
                  }
                  setIsSubmitting(true)
                  const payload: AccessRequestDraft = {
                    fullName: fullName.trim(),
                    email: email.trim(),
                  organization: organization.trim(),
                  roleRequested,
                  notes: notes.trim() || undefined,
                }
                  try {
                    await api.createAccessRequest(payload)
                    setFullName('')
                    setEmail('')
                    setOrganization('')
                    setRoleRequested('user')
                    setNotes('')
                  } catch (error) {
                    console.error('Access request submission failed', error)
                  } finally {
                    setIsSubmitting(false)
                  }
                }}
            >
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Full name"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Work email"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              />
              <input
                value={organization}
                onChange={(event) => setOrganization(event.target.value)}
                placeholder="Organization / hospital"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              />
              <select
                value={roleRequested}
                onChange={(event) => setRoleRequested(event.target.value as UserRole)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none"
              >
                {roleOptions.map((role) => (
                  <option key={role.value} value={role.value} className="text-slate-900">
                    {role.label}
                  </option>
                ))}
              </select>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                placeholder="Notes for the Admin (department, shift, urgency)"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-2xl bg-[color:var(--agent-accent)] px-4 py-3 text-sm font-semibold text-[color:var(--agent-on-accent)] shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
              >
                {isSubmitting ? 'Submitting...' : 'Submit request'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AccessPage

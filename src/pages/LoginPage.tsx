import { useState } from 'react'
import type { AuthSession } from '../types/triage'
import type { AppPage } from '../types/navigation'
import { formatRoleLabel } from '../utils/roles'

type LoginPageProps = {
  authUser: AuthSession['user'] | null
  authError: string | null
  isAuthLoading: boolean
  onLogin: (username: string, password: string) => void
  onLogout: () => void
  apiReady: boolean
  onNavigate?: (page: AppPage) => void
}

const accessNotes = [
  'Staff credentials are provisioned by Admin or System Admin.',
  'Sessions are tied to role-based access policies.',
  'Audit logs capture sign-in, sign-out, and role changes.',
]

const roleHighlights = [
  { title: 'User', detail: 'View your own appointments and status updates.' },
  { title: 'Nurse / Doctor', detail: 'Review triage output and approve bookings.' },
  { title: 'Admin', detail: 'Manage departments, staff, and reporting.' },
  { title: 'System Admin', detail: 'Own security policies and integrations.' },
]

const LoginPage = ({
  authUser,
  authError,
  isAuthLoading,
  onLogin,
  onLogout,
  apiReady,
  onNavigate,
}: LoginPageProps) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div className="min-h-screen pb-20">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4" data-reveal>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Secure access portal
            </p>
            <h1 className="text-3xl font-display font-semibold text-white">Login</h1>
            <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
              Sign in to review appointments, approve triage decisions, and manage operational data.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70">
            API status: {apiReady ? 'Connected' : 'Offline'}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    Staff sign-in
                  </p>
                  <h2 className="text-lg font-semibold text-white">
                    {authUser ? `Signed in as ${authUser.username}` : 'Enter your credentials'}
                  </h2>
                  <p className="text-sm text-[color:var(--agent-muted)]">
                    {authUser
                      ? `Role: ${formatRoleLabel(
                          authUser.role
                        )}. Access is enforced by role-based policies.`
                      : 'Use credentials issued by your Admin or System Admin.'}
                  </p>
                </div>
              </div>

              {authUser ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    onClick={onLogout}
                    className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
                  >
                    Sign out
                  </button>
                  <button
                    onClick={() => onNavigate?.('dashboard')}
                    className="rounded-xl bg-[color:var(--agent-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--agent-on-accent)] transition hover:-translate-y-0.5"
                  >
                    Go to dashboard
                  </button>
                </div>
              ) : (
                <form
                  className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]"
                  onSubmit={(event) => {
                    event.preventDefault()
                    onLogin(username, password)
                  }}
                >
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Username"
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isAuthLoading}
                    className="rounded-xl bg-[color:var(--agent-accent)] px-4 py-3 text-sm font-semibold text-[color:var(--agent-on-accent)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-emerald-200"
                  >
                    {isAuthLoading ? 'Signing in...' : 'Sign in'}
                  </button>
                </form>
              )}
              {authError && (
                <p className="mt-3 text-xs font-semibold text-rose-300">{authError}</p>
              )}
            </div>

            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <h3 className="text-lg font-semibold text-white">Login details</h3>
              <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
                Access controls align with healthcare compliance requirements and least-privilege
                policies.
              </p>
              <ul className="mt-4 space-y-3 text-sm text-white/70">
                {accessNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-6">
            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <h3 className="text-lg font-semibold text-white">Roles at a glance</h3>
              <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
                Four roles govern access to patient data, clinical oversight, and system
                administration.
              </p>
              <div className="mt-4 space-y-3">
                {roleHighlights.map((role) => (
                  <div
                    key={role.title}
                    className="rounded-2xl border border-white/10 bg-[color:var(--agent-surface-strong)] p-4"
                  >
                    <p className="text-sm font-semibold text-white">{role.title}</p>
                    <p className="mt-1 text-xs text-white/60">{role.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <h3 className="text-lg font-semibold text-white">Access support</h3>
              <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
                Contact your Admin if you need role adjustments or access to additional departments.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => onNavigate?.('admin')}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  View admin dashboard
                </button>
                <button
                  onClick={() => onNavigate?.('landing')}
                  className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  Return to overview
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage

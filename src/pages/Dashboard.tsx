import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { AuthSession, LedgerEntry, Reservation, ReservationStatus } from '../types/triage'
import { formatRoleLabel } from '../utils/roles'

type DashboardProps = {
  reservations: Reservation[]
  ledgerEntries: LedgerEntry[]
  authUser: AuthSession['user'] | null
  authError: string | null
  isAuthLoading: boolean
  onLogin: (username: string, password: string) => void
  onLogout: () => void
  apiReady: boolean
}

const statusStyles: Record<ReservationStatus, string> = {
  Booked: 'border border-amber-400/30 bg-amber-400/15 text-amber-200',
  Recorded: 'border border-emerald-400/30 bg-emerald-400/15 text-emerald-200',
  Failed: 'border border-rose-400/30 bg-rose-400/15 text-rose-200',
}

const sidebarLinks = [
  { label: 'Overview', hint: 'KPIs & alerts', targetId: 'dashboard-overview' },
  { label: 'Appointments', hint: 'Triage results', targetId: 'dashboard-appointments' },
  { label: 'Ledger', hint: 'On-chain logs', targetId: 'dashboard-ledger' },
  { label: 'Access', hint: 'Sign-in & role', targetId: 'dashboard-access' },
]

const Dashboard = ({
  reservations,
  ledgerEntries,
  authUser,
  authError,
  isAuthLoading,
  onLogin,
  onLogout,
  apiReady,
}: DashboardProps) => {
  const [selectedId, setSelectedId] = useState(reservations[0]?.id || '')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const activeReservation = useMemo(() => {
    return reservations.find((reservation) => reservation.id === selectedId) ?? reservations[0]
  }, [reservations, selectedId])

  useEffect(() => {
    if (!reservations.length) return
    if (!reservations.some((reservation) => reservation.id === selectedId)) {
      setSelectedId(reservations[0].id)
    }
  }, [reservations, selectedId])

  const metrics = useMemo(() => {
    const booked = reservations.filter((r) => r.status === 'Booked').length
    const recorded = reservations.filter((r) => r.status === 'Recorded').length
    const failed = reservations.filter((r) => r.status === 'Failed').length
    return { booked, recorded, failed, total: reservations.length }
  }, [reservations])

  const [activeSection, setActiveSection] = useState(sidebarLinks[0].targetId)
  const statusReservation = activeReservation ?? null

  const handleSidebarClick = (targetId: string) => {
    const element = document.getElementById(targetId)
    if (element) {
      setActiveSection(targetId)
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  useEffect(() => {
    const elements = sidebarLinks
      .map((link) => document.getElementById(link.targetId))
      .filter((element): element is HTMLElement => Boolean(element))

    if (!elements.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]?.target?.id) {
          setActiveSection(visible[0].target.id)
        }
      },
      {
        rootMargin: '-10% 0px -55% 0px',
        threshold: [0.2, 0.5, 0.8],
      }
    )

    elements.forEach((element) => observer.observe(element))

    return () => {
      observer.disconnect()
    }
  }, [])

  return (
    <div className="min-h-screen pb-20">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside
            className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-5 shadow-2xl shadow-black/40"
            data-reveal
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Operations hub
                </p>
                <p className="mt-2 text-lg font-semibold text-white">Dashboard</p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-white/70">
                Live
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {sidebarLinks.map((link) => (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => handleSidebarClick(link.targetId)}
                  className={`w-full rounded-2xl border p-3 text-left transition ${
                    activeSection === link.targetId
                      ? 'border-[color:var(--agent-accent)] bg-white/10 shadow-[0_12px_30px_rgba(124,252,196,0.12)]'
                      : 'border-white/10 bg-[color:var(--agent-surface-strong)] hover:border-white/30 hover:bg-white/10'
                  }`}
                  aria-label={`Jump to ${link.label}`}
                  aria-current={activeSection === link.targetId ? 'true' : undefined}
                >
                  <p className="text-xs font-semibold text-white">{link.label}</p>
                  <p className="mt-1 text-[11px] text-white/50">{link.hint}</p>
                </button>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/70">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
                Status tracker
              </p>
              <p className="mt-1 text-[11px] text-white/50">Live updates after submission.</p>
              <div className="mt-3 flex items-center justify-between text-xs text-white/60">
                <span>Appointment</span>
                <span className="font-semibold text-white">
                  {statusReservation ? statusReservation.status : 'Not submitted'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-semibold">
                {(['Booked', 'Recorded', 'Failed'] as ReservationStatus[]).map((status) => (
                  <div
                    key={status}
                    className={`rounded-full border px-2 py-1 text-center ${
                      statusReservation?.status === status
                        ? 'border-white/40 bg-white/10 text-white'
                        : 'border-white/10 text-white/50'
                    }`}
                  >
                    {status}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-white/50">
                Booked appointments are immutably written to the blockchain ledger for auditability.
              </p>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
              API status: {apiReady ? 'Connected' : 'Offline'}
            </div>
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
              {authUser
                ? `${authUser.username} · ${formatRoleLabel(authUser.role)}`
                : 'Not signed in'}
            </div>
          </aside>

          <div>
            <div
              id="dashboard-overview"
              className="mb-8 scroll-mt-24 flex flex-wrap items-center justify-between gap-4"
              data-reveal
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Operations oversight layer
                </p>
                <h1 className="text-3xl font-display font-semibold text-white">
                  Operations dashboard
                </h1>
                <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
                  Monitor booked appointments, Decision Tree summaries, and blockchain logging status.
                </p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70">
                RBAC protected
              </div>
            </div>

            <div
              id="dashboard-access"
              className="mb-8 scroll-mt-24 rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                Access control
              </p>
              <h2 className="text-lg font-semibold text-white">
                {authUser ? `Signed in as ${authUser.username}` : 'Staff sign-in'}
              </h2>
              <p className="text-sm text-[color:var(--agent-muted)]">
                {authUser
                  ? `Role: ${formatRoleLabel(
                      authUser.role
                    )}. Viewing requires Nurse/Doctor, Admin, or System Admin access.`
                  : 'Log in to review appointments and blockchain entries.'}
              </p>
            </div>
            <div className="text-xs font-semibold text-white/60">
              API status: {apiReady ? 'Connected' : 'Offline'}
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
          {!authUser && (
            <p className="mt-3 text-xs text-white/50">
              Demo accounts are configured in the API server environment variables.
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-[color:var(--agent-surface)] p-4 shadow-xl shadow-black/30" data-reveal>
            <p className="text-xs text-white/60">Total appointments</p>
            <p className="mt-2 text-2xl font-semibold text-white">{metrics.total}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[color:var(--agent-surface)] p-4 shadow-xl shadow-black/30" data-reveal style={{ '--reveal-delay': '80ms' } as CSSProperties}>
            <p className="text-xs text-white/60">Booked</p>
            <p className="mt-2 text-2xl font-semibold text-amber-200">{metrics.booked}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[color:var(--agent-surface)] p-4 shadow-xl shadow-black/30" data-reveal style={{ '--reveal-delay': '160ms' } as CSSProperties}>
            <p className="text-xs text-white/60">Recorded</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-200">{metrics.recorded}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[color:var(--agent-surface)] p-4 shadow-xl shadow-black/30" data-reveal style={{ '--reveal-delay': '240ms' } as CSSProperties}>
            <p className="text-xs text-white/60">Failed writes</p>
            <p className="mt-2 text-2xl font-semibold text-rose-200">{metrics.failed}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            <div
              id="dashboard-appointments"
              className="scroll-mt-24 rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Recent appointments</h2>
                  <p className="text-xs text-white/60">
                    Live view of appointments after Decision Tree triage
                  </p>
                </div>
                <span className="text-xs font-semibold text-white/60">
                  {metrics.booked} booked
                </span>
              </div>

              {reservations.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/60">
                  No appointments yet. Book one from the guided intake page.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {reservations.map((reservation) => (
                    <div
                      key={reservation.id}
                      className={`rounded-2xl border p-4 transition ${
                        reservation.id === activeReservation?.id
                          ? 'border-white/30 bg-white/10'
                          : 'border-white/10 bg-[color:var(--agent-surface-strong)]'
                      }`}
                      data-reveal
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {reservation.patientName}
                          </p>
                          <p className="text-xs text-white/60">
                            {reservation.department} - Requested {reservation.requestedTime}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              statusStyles[reservation.status]
                            }`}
                          >
                            {reservation.status}
                          </span>
                          <button
                            onClick={() => setSelectedId(reservation.id)}
                            className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
                          >
                            View
                          </button>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-[color:var(--agent-muted)]">{reservation.summary}</p>
                      <p className="mt-4 text-xs text-white/50">
                        Status reflects the on-chain write attempt for this appointment.
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              id="dashboard-ledger"
              className="scroll-mt-24 rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Blockchain secure layer</h2>
                  <p className="text-xs text-white/60">Immutable record after booking</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/60">
                  Ethereum log
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {ledgerEntries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/60">
                    Booked appointments will appear here with blockchain hashes.
                  </div>
                ) : (
                  ledgerEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-2xl border border-white/10 bg-[color:var(--agent-surface-strong)] p-4"
                      data-reveal
                    >
                      <div className="flex items-center justify-between text-xs text-white/60">
                        <span>{entry.department}</span>
                        <span>{entry.timestamp}</span>
                      </div>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {entry.patientName} - {entry.reservationId}
                      </p>
                      <p className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-white/70">
                        {entry.hash}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/60">
                        <span className="rounded-full border border-white/10 px-2 py-1">
                          Chain: {entry.chainId ?? 'local'}
                        </span>
                        <span className="rounded-full border border-white/10 px-2 py-1">
                          Tx: {entry.txStatus ?? 'pending'}
                        </span>
                        {entry.txHash && (
                          <span className="rounded-full border border-white/10 px-2 py-1">
                            {entry.txHash}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <h2 className="text-lg font-semibold text-white">Appointment details</h2>
              {activeReservation ? (
                <div className="mt-4 space-y-4 text-sm text-[color:var(--agent-muted)]">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/60">Patient</p>
                    <p className="mt-1 font-semibold text-white">
                      {activeReservation.patientName}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/60">Department</p>
                    <p className="mt-1 font-semibold text-white">
                      {activeReservation.department}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/60">Priority</p>
                    <p className="mt-1 font-semibold text-white">
                      {activeReservation.priority}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/60">Decision Tree confidence</p>
                    <p className="mt-1 font-semibold text-white">
                      {Math.round(activeReservation.confidence * 100)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/60">Summary</p>
                    <p className="mt-1">{activeReservation.summary}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-white/60">Status</p>
                    <span
                      className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        statusStyles[activeReservation.status]
                      }`}
                    >
                      {activeReservation.status}
                    </span>
                  </div>
                  <p className="text-xs text-white/50">
                    Appointments log on-chain immediately after booking.
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-white/60">
                  Select an appointment to view details.
                </p>
              )}
            </div>

            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <h2 className="text-lg font-semibold text-white">HITL audit logic</h2>
              <ul className="mt-4 space-y-3 text-sm text-[color:var(--agent-muted)]">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[color:var(--agent-accent)]" />
                Decision Tree guidance is advisory only and not a diagnosis.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[color:var(--agent-accent)]" />
                  Bookings are created immediately after a recommendation.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[color:var(--agent-accent)]" />
                  Recorded hashes are immutable and tamper-proof.
                </li>
              </ul>
            </div>

            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <h2 className="text-lg font-semibold text-white">Tech stack</h2>
              <p className="mt-2 text-xs text-white/60">
                Shared stack across Decision Tree, web, and blockchain platforms.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-[color:var(--agent-muted)]">
                {[
                  'Decision Tree Platform: MedQuad-informed triage model',
                  'Web Platform: React, TypeScript, Tailwind CSS, Node.js, Express.js, REST API, MongoDB',
                  'Blockchain Platform: Ethereum smart contracts and immutable ledger',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[color:var(--agent-accent)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  </div>
  )
}

export default Dashboard

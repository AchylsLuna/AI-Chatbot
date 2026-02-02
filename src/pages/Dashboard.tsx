import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { AuthSession, LedgerEntry, Reservation, ReservationStatus } from '../types/triage'

type DashboardProps = {
  reservations: Reservation[]
  ledgerEntries: LedgerEntry[]
  onUpdateStatus: (reservationId: string, status: ReservationStatus) => void
  authUser: AuthSession['user'] | null
  authError: string | null
  isAuthLoading: boolean
  onLogin: (username: string, password: string) => void
  onLogout: () => void
  apiReady: boolean
}

const statusStyles: Record<ReservationStatus, string> = {
  Pending: 'border border-amber-400/30 bg-amber-400/15 text-amber-200',
  Approved: 'border border-emerald-400/30 bg-emerald-400/15 text-emerald-200',
  Declined: 'border border-rose-400/30 bg-rose-400/15 text-rose-200',
}

const Dashboard = ({
  reservations,
  ledgerEntries,
  onUpdateStatus,
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

  const canReview = authUser?.role === 'nurse' || authUser?.role === 'admin'

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
    const pending = reservations.filter((r) => r.status === 'Pending').length
    const approved = reservations.filter((r) => r.status === 'Approved').length
    const declined = reservations.filter((r) => r.status === 'Declined').length
    return { pending, approved, declined, total: reservations.length }
  }, [reservations])

  return (
    <div className="min-h-screen pb-20">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4" data-reveal>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
              Administrative confirmation layer
            </p>
            <h1 className="text-3xl font-display font-semibold text-white">Nurse dashboard</h1>
            <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
              Review AI triage summaries and accept or decline reservations before blockchain
              logging.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70">
            RBAC enabled
          </div>
        </div>

        <div className="mb-8 rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40" data-reveal>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                Access control
              </p>
              <h2 className="text-lg font-semibold text-white">
                {authUser ? `Signed in as ${authUser.username}` : 'Nurse/admin sign-in'}
              </h2>
              <p className="text-sm text-[color:var(--agent-muted)]">
                {authUser
                  ? `Role: ${authUser.role}. Status updates require nurse or admin access.`
                  : 'Log in to review reservations and write approved records to the blockchain.'}
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
            <p className="text-xs text-white/60">Total reservations</p>
            <p className="mt-2 text-2xl font-semibold text-white">{metrics.total}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[color:var(--agent-surface)] p-4 shadow-xl shadow-black/30" data-reveal style={{ '--reveal-delay': '80ms' } as CSSProperties}>
            <p className="text-xs text-white/60">Pending review</p>
            <p className="mt-2 text-2xl font-semibold text-amber-200">{metrics.pending}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[color:var(--agent-surface)] p-4 shadow-xl shadow-black/30" data-reveal style={{ '--reveal-delay': '160ms' } as CSSProperties}>
            <p className="text-xs text-white/60">Approved</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-200">{metrics.approved}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[color:var(--agent-surface)] p-4 shadow-xl shadow-black/30" data-reveal style={{ '--reveal-delay': '240ms' } as CSSProperties}>
            <p className="text-xs text-white/60">Declined</p>
            <p className="mt-2 text-2xl font-semibold text-rose-200">{metrics.declined}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Incoming reservations</h2>
                  <p className="text-xs text-white/60">AI summaries require human confirmation</p>
                </div>
                <span className="text-xs font-semibold text-white/60">
                  {metrics.pending} awaiting review
                </span>
              </div>

              {reservations.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/60">
                  No reservations yet. Submit a reservation from the guided intake page.
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
                      {reservation.status === 'Pending' && canReview && (
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            onClick={() => onUpdateStatus(reservation.id, 'Approved')}
                            className="rounded-xl bg-emerald-400/90 px-4 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-300"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => onUpdateStatus(reservation.id, 'Declined')}
                            className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-xs font-semibold text-rose-200 transition hover:border-rose-300/60"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                      {reservation.status === 'Pending' && !canReview && (
                        <p className="mt-4 text-xs text-white/50">
                          Sign in with nurse/admin credentials to approve or decline.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Blockchain secure layer</h2>
                  <p className="text-xs text-white/60">Immutable record after acceptance</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/60">
                  Ethereum log
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {ledgerEntries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/60">
                    Approved reservations will appear here with blockchain hashes.
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
              <h2 className="text-lg font-semibold text-white">Reservation details</h2>
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
                    <p className="text-xs uppercase tracking-wider text-white/60">AI confidence</p>
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
                  {activeReservation.status === 'Pending' && canReview && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => onUpdateStatus(activeReservation.id, 'Approved')}
                        className="flex-1 rounded-xl bg-emerald-400/90 px-4 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-300"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => onUpdateStatus(activeReservation.id, 'Declined')}
                        className="flex-1 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-2 text-xs font-semibold text-rose-200 transition hover:border-rose-300/60"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {activeReservation.status === 'Pending' && !canReview && (
                    <p className="text-xs text-white/50">
                      Nurse/admin access required to approve or decline.
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-white/60">Select a reservation to view details.</p>
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
                  AI guidance is advisory only.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[color:var(--agent-accent)]" />
                  Nurses approve or decline before any blockchain write.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[color:var(--agent-accent)]" />
                  Approved records are immutable and tamper-proof.
                </li>
              </ul>
            </div>

            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <h2 className="text-lg font-semibold text-white">Tech stack</h2>
              <p className="mt-2 text-xs text-white/60">
                Shared stack across AI, web, and blockchain platforms.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-[color:var(--agent-muted)]">
                {[
                  'AI Platform: NLP triage engine and advice-only logic',
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
  )
}

export default Dashboard

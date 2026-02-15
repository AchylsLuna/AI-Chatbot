import type { CSSProperties } from 'react'
import type { AppPage } from '../types/navigation'
import type { Reservation, ReservationDraft } from '../types/triage'
import AppLogoBadge from '../components/branding/AppLogoBadge'
import TriagePage from './TriagePage'

type LandingPageProps = {
  onNavigate?: (page: AppPage) => void
  onCreateReservation: (draft: ReservationDraft) => void
  latestReservation?: Reservation
  isAuthenticated?: boolean
}

const headlineStats = [
  { label: 'Average intake', value: '2-4 min' },
  { label: 'Routing confidence', value: '92%+' },
  { label: 'Ledger writes', value: 'Hash-only' },
  { label: 'Role model', value: 'RBAC-ready' },
]

const workflowSteps = [
  {
    step: '01',
    title: 'Guided Intake',
    detail: 'Patients submit symptoms through structured chat prompts.',
  },
  {
    step: '02',
    title: 'AI Recommendation',
    detail: 'Decision-tree logic returns department, priority, and confidence.',
  },
  {
    step: '03',
    title: 'Appointment Booking',
    detail: 'Teams confirm booking and assign the correct service lane.',
  },
  {
    step: '04',
    title: 'Immutable Audit',
    detail: 'Payload hash is written on-chain for tamper-evident records.',
  },
]

const moduleCards = [
  {
    title: 'AI Triage Engine',
    description: 'Decision-tree intake with guardrails and confidence scoring.',
  },
  {
    title: 'Secure Operations Layer',
    description: 'RBAC-ready access controls for clinical and administrative teams.',
  },
  {
    title: 'Blockchain Audit Trail',
    description: 'Booking hashes logged to Ethereum-compatible infrastructure.',
  },
]

const footerColumns: Array<{ title: string; links: string[] }> = [
  { title: 'Product', links: ['Features', 'How It Works', 'Testimonials'] },
  { title: 'Company', links: ['About Us', 'Careers', 'Contact'] },
  { title: 'Legal', links: ['Privacy Policy', 'Terms of Service', 'HIPAA Compliance'] },
]

const revealDelay = (ms: number): CSSProperties =>
  ({
    '--reveal-delay': `${ms}ms`,
  } as CSSProperties)

const LandingPage = ({
  onNavigate,
  onCreateReservation,
  latestReservation,
  isAuthenticated = false,
}: LandingPageProps) => {
  const handleScrollTop = () => {
    if (typeof window === 'undefined') return
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[color:var(--agent-bg)] text-[color:var(--agent-ink)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 agent-grid opacity-15" />
        <div className="absolute -top-48 left-[10%] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(124,252,196,0.26),transparent_62%)] blur-3xl animate-drift-slow" />
        <div className="absolute top-[30%] right-[4%] h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(90,215,255,0.22),transparent_62%)] blur-3xl animate-drift" />
        <div className="absolute bottom-[-120px] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,209,102,0.16),transparent_62%)] blur-3xl animate-float-slow" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[color:var(--agent-bg)]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <button
            type="button"
            onClick={handleScrollTop}
            className="flex items-center gap-3 text-left"
            data-reveal
            style={revealDelay(40)}
          >
            <AppLogoBadge className="h-10 w-10" markClassName="h-[18px] w-[18px] text-[#3bb4db]" />
            <div>
              <p className="text-sm font-semibold text-white">AI Health Care</p>
              <p className="text-[11px] text-white/50">AI triage and immutable operations</p>
            </div>
          </button>

          <div className="flex items-center gap-2" data-reveal style={revealDelay(90)}>
            <button
              type="button"
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white sm:px-5"
              onClick={() => onNavigate?.('login')}
            >
              Sign in
            </button>
            <button
              type="button"
              className="rounded-full bg-[color:var(--agent-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--agent-on-accent)] transition hover:-translate-y-0.5 hover:bg-[color:var(--agent-accent-strong)] sm:px-5"
              onClick={() => onNavigate?.(isAuthenticated ? 'triage' : 'signup')}
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 pb-24">
        <section
          id="home"
          className="mx-auto grid w-full max-w-6xl gap-8 px-6 pb-16 pt-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center"
        >
          <div data-reveal style={revealDelay(140)}>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">
              Healthcare Triage Platform
            </p>
            <h1 className="mt-5 text-balance font-display text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              Professional AI intake with secure operational traceability.
            </h1>
            <p className="mt-5 max-w-2xl text-base text-[color:var(--agent-muted)] sm:text-lg">
              AI Health Care helps teams route patients quickly, standardize booking decisions, and
              maintain tamper-evident audit records for every appointment.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="rounded-full bg-[color:var(--agent-accent)] px-6 py-3 text-sm font-semibold text-[color:var(--agent-on-accent)] transition hover:-translate-y-0.5 hover:bg-[color:var(--agent-accent-strong)]"
                onClick={() => onNavigate?.(isAuthenticated ? 'triage' : 'signup')}
              >
                Get started
              </button>
              <button
                type="button"
                className="rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
                onClick={() => onNavigate?.('login')}
              >
                Sign in
              </button>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">
              <span className="rounded-full border border-white/10 px-3 py-2">Advice-only AI</span>
              <span className="rounded-full border border-white/10 px-3 py-2">Role-based access</span>
              <span className="rounded-full border border-white/10 px-3 py-2">Immutable hashes</span>
            </div>
          </div>

          <div className="space-y-4" data-reveal style={revealDelay(220)}>
            <div className="rounded-3xl agent-card p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">
                  Platform snapshot
                </p>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold text-[color:var(--agent-accent)]">
                  Production-ready UI
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {headlineStats.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">{item.label}</p>
                    <p className="mt-2 text-xl font-semibold text-[color:var(--agent-accent)]">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl agent-card-soft p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">
                Latest booking
              </p>
              {latestReservation ? (
                <div className="mt-3">
                  <p className="text-sm font-semibold text-white">{latestReservation.patientName}</p>
                  <p className="mt-1 text-xs text-white/60">
                    {latestReservation.department} | {latestReservation.priority} priority
                  </p>
                  <p className="mt-2 text-sm text-[color:var(--agent-muted)]">{latestReservation.summary}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[color:var(--agent-muted)]">
                  No booking yet. Run the triage demo to generate your first appointment.
                </p>
              )}
            </div>
          </div>
        </section>

        <section id="about" className="mx-auto w-full max-w-6xl px-6 pb-24">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div data-reveal style={revealDelay(120)}>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Platform</p>
              <h2 className="mt-4 text-3xl font-display font-semibold text-white sm:text-4xl">
                AI triage supported by an immutable ledger.
              </h2>
              <p className="mt-4 text-sm text-[color:var(--agent-muted)] sm:text-base">
                The platform pairs clinician-friendly triage recommendations with secure operation
                logs, so care teams can move quickly without losing accountability.
              </p>
            </div>

            <div className="rounded-3xl agent-card p-7" data-reveal style={revealDelay(180)}>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">Trust model</p>
              <ul className="mt-4 space-y-3 text-sm text-[color:var(--agent-muted)]">
                <li>Decision-tree triage for consistent and explainable routing.</li>
                <li>Booking payloads summarized for clinical and operations review.</li>
                <li>Blockchain entries store hashes only and never raw PHI.</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="workflow" className="mx-auto w-full max-w-6xl px-6 pb-24">
          <div className="text-center" data-reveal style={revealDelay(120)}>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Workflow</p>
            <h2 className="mt-4 text-3xl font-display font-semibold text-white sm:text-4xl">
              From intake to audit trail in four steps.
            </h2>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {workflowSteps.map((item, index) => (
              <div
                key={item.step}
                className="rounded-3xl agent-card p-6"
                data-reveal
                style={revealDelay(170 + index * 70)}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">Step {item.step}</p>
                <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-[color:var(--agent-muted)]">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="triage" className="mx-auto w-full max-w-6xl px-6 pb-24">
          <div className="text-center" data-reveal style={revealDelay(120)}>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Live triage</p>
            <h2 className="mt-4 text-3xl font-display font-semibold text-white sm:text-4xl">
              Test the intake and booking flow in real time.
            </h2>
            <p className="mt-3 text-sm text-[color:var(--agent-muted)]">
              Guidance is advice-only. Bookings can be written to an immutable on-chain log.
            </p>
          </div>

          <div className="mt-10 rounded-3xl border border-white/10 bg-white/[0.02] p-2" data-reveal style={revealDelay(190)}>
            <TriagePage
              onCreateReservation={onCreateReservation}
              latestReservation={latestReservation}
              variant="embedded"
            />
          </div>
        </section>

        <section id="projects" className="mx-auto w-full max-w-6xl px-6 pb-24">
          <div className="text-center" data-reveal style={revealDelay(120)}>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">Modules</p>
            <h2 className="mt-4 text-3xl font-display font-semibold text-white sm:text-4xl">
              Core capabilities for modern care operations.
            </h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {moduleCards.map((item, index) => (
              <article
                key={item.title}
                className="rounded-3xl agent-card p-7"
                data-reveal
                style={revealDelay(180 + index * 70)}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/60">Module</p>
                <h3 className="mt-3 text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-[color:var(--agent-muted)]">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <footer id="site-footer" className="mx-auto w-full max-w-6xl px-6 pb-10">
          <div
            className="rounded-[34px] border border-white/10 bg-[color:var(--agent-surface-strong)] px-8 py-10 sm:px-12 sm:py-12"
            data-reveal
            style={revealDelay(150)}
          >
            <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:items-start">
              <div className="flex items-center gap-4">
                <AppLogoBadge className="h-14 w-14" markClassName="h-[22px] w-[22px] text-[#3bb4db]" />
                <p className="font-display text-4xl font-semibold tracking-tight text-white">HealthAI</p>
              </div>

              <div className="grid gap-8 sm:grid-cols-3">
                {footerColumns.map((column) => (
                  <div key={column.title}>
                    <p className="text-lg font-semibold text-white">{column.title}</p>
                    <ul className="mt-5 space-y-3 text-base text-white/55">
                      {column.links.map((link) => (
                        <li key={link}>{link}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 border-t border-white/10 pt-6 text-center text-sm text-white/45">
              &copy; 2024 HealthAI. All rights reserved.
            </div>
          </div>
        </footer>
      </main>
    </div>
  )
}

export default LandingPage

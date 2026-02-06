import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { AppPage } from '../types/navigation'
import type { Reservation, ReservationDraft } from '../types/triage'
import TriagePage from './TriagePage'

type LandingPageProps = {
  onNavigate?: (page: AppPage) => void
  onCreateReservation: (draft: ReservationDraft) => void
  latestReservation?: Reservation
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

type NavTarget = 'home' | 'about' | 'workflow' | 'triage' | 'projects'

const navItems: Array<{ label: string; target: NavTarget; active?: boolean }> = [
  { label: 'Home', target: 'home', active: true },
  { label: 'Platform', target: 'about' },
  { label: 'Workflow', target: 'workflow' },
  { label: 'Triage', target: 'triage' },
  { label: 'Modules', target: 'projects' },
]

const revealDelay = (ms: number): CSSProperties =>
  ({
    '--reveal-delay': `${ms}ms`,
  } as CSSProperties)

const LandingPage = ({
  onNavigate,
  onCreateReservation,
  latestReservation,
  theme,
  onToggleTheme,
}: LandingPageProps) => {
  const [isNavHidden, setIsNavHidden] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    let lastY = window.scrollY
    let ticking = false

    const onScroll = () => {
      const currentY = window.scrollY
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const isNearTop = currentY <= 8
          if (isNearTop) {
            setIsNavHidden(false)
          } else if (currentY > lastY + 8) {
            setIsNavHidden(true)
          } else if (currentY < lastY - 8) {
            setIsNavHidden(false)
          }
          lastY = currentY
          ticking = false
        })
        ticking = true
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleNav = (target: NavTarget) => {
    if (typeof window === 'undefined') return
    if (target === 'home') {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
      return
    }
    const node = document.getElementById(target)
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--agent-bg)] text-[color:var(--agent-ink)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 agent-grid opacity-20" />
        <div className="absolute -top-48 left-[15%] h-72 w-72 rounded-full bg-[radial-gradient(circle_at_center,_rgba(124,252,196,0.3),_transparent_65%)] blur-3xl" />
        <div className="absolute top-1/3 right-[5%] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,_rgba(90,215,255,0.28),_transparent_60%)] blur-3xl" />
        <div className="absolute bottom-[-120px] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(255,209,102,0.2),_transparent_65%)] blur-3xl" />
      </div>

      <header
        className={`sticky top-0 z-40 border-b border-white/10 bg-[color:var(--agent-bg)] shadow-[0_6px_20px_rgba(0,0,0,0.35)] transition-transform duration-300 ${
          isNavHidden ? '-translate-y-full' : 'translate-y-0'
        }`}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 pt-8">
          <div className="flex items-center gap-3" data-reveal style={revealDelay(40)}>
            <div className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              <svg
                className="h-5 w-5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 12h4l2-3 3 6 2-3h3"
                />
              </svg>
            </div>
            <span className="text-lg font-semibold tracking-[0.2em] text-white">
              PULSE LEDGER
            </span>
          </div>

          <nav
            className="order-3 flex w-full items-center justify-center gap-6 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm text-white/60 md:order-none md:w-auto"
            data-reveal
            style={revealDelay(120)}
          >
            {navItems.map((item) => (
              <button
                key={item.label}
                className={`transition ${
                  item.active ? 'text-white font-semibold' : 'text-white/60 hover:text-white'
                }`}
                onClick={() => handleNav(item.target)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div
            className="order-2 flex items-center gap-3 md:order-none"
            data-reveal
            style={revealDelay(80)}
          >
            <button
              className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
              onClick={onToggleTheme}
            >
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <button
              className="rounded-full border border-white/10 px-5 py-2 text-xs font-semibold text-white/80 transition hover:border-white/30 hover:text-white"
              onClick={() => onNavigate?.('access')}
            >
              Log in
            </button>
            <button
              className="rounded-full bg-[color:var(--agent-accent)] px-5 py-2 text-xs font-semibold text-[color:var(--agent-on-accent)] shadow-lg transition hover:-translate-y-0.5"
              onClick={() => onNavigate?.('access')}
            >
              Sign up
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 pt-24">
        <section className="mx-auto flex w-full max-w-4xl scroll-mt-24 flex-col items-center px-6 pb-16 pt-6 text-center">
          <h1
            className="text-balance font-display text-4xl font-semibold leading-[1.05] text-white sm:text-5xl md:text-6xl lg:text-7xl"
            data-reveal
            style={revealDelay(200)}
          >
            Build a Healthcare Triage System
            <span className="block text-white">Powered by AI Guidance</span>
            <span className="block text-white/60">and an Immutable Ledger</span>
          </h1>
          <p
            className="mt-6 text-sm uppercase tracking-[0.2em] text-[color:var(--agent-muted)] sm:text-base"
            data-reveal
            style={revealDelay(260)}
          >
            Advice-only AI routing for outpatient care teams
          </p>
          <button
            className="mt-8 rounded-full bg-[color:var(--agent-accent)] px-7 py-3 text-sm font-semibold text-[color:var(--agent-on-accent)] shadow-lg transition hover:-translate-y-0.5"
            onClick={() => handleNav('triage')}
            data-reveal
            style={revealDelay(320)}
          >
            Launch Triage Demo
          </button>

          <div
            className="mt-8 text-[11px] uppercase tracking-[0.35em] text-white/50"
            data-reveal
            style={revealDelay(380)}
          >
            Created by COMSEC 01
          </div>
        </section>

        <section className="mx-auto w-full max-w-5xl scroll-mt-24 px-6 pb-24">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Avg intake time', value: '2–4 min' },
              { label: 'Routing confidence', value: '92%+' },
              { label: 'Ledger record', value: 'Hash-only' },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-white/10 bg-[color:var(--agent-surface)] p-5 text-left shadow-2xl shadow-black/30"
                data-reveal
                style={revealDelay(120 + index * 80)}
              >
                <p className="text-xs uppercase tracking-[0.25em] text-white/60">
                  {stat.label}
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="about" className="mx-auto w-full max-w-5xl scroll-mt-24 px-6 pb-24">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div data-reveal style={revealDelay(120)}>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Platform</p>
              <h2 className="mt-4 text-3xl font-display font-semibold text-white sm:text-4xl">
                AI triage with blockchain-grade auditability.
              </h2>
              <p className="mt-3 text-sm text-[color:var(--agent-muted)]">
                Pulse Ledger guides patients to the right department, summarizes recommendations for
                clinicians, and records each booking as a hash-only on-chain entry for immutable proof.
              </p>
              <div className="mt-6 flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em] text-white/60">
                <span className="rounded-full border border-white/10 px-4 py-2">Advice-only AI</span>
                <span className="rounded-full border border-white/10 px-4 py-2">RBAC-ready</span>
                <span className="rounded-full border border-white/10 px-4 py-2">Hash ledger</span>
              </div>
            </div>
            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-8 shadow-2xl shadow-black/40"
              data-reveal
              style={revealDelay(180)}
            >
              <p className="text-xs uppercase tracking-[0.25em] text-white/60">Safety & Trust</p>
              <ul className="mt-4 space-y-3 text-sm text-[color:var(--agent-muted)]">
                <li>Decision-tree triage keeps guidance consistent.</li>
                <li>Clinician summary with priority and confidence.</li>
                <li>Blockchain logs store hashes only, never PHI.</li>
              </ul>
            </div>
          </div>
        </section>

        <section id="workflow" className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 pb-24">
          <div className="text-center" data-reveal style={revealDelay(120)}>
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Workflow</p>
            <h2 className="mt-4 text-3xl font-display font-semibold text-white sm:text-4xl">
              A guided path from intake to immutable record.
            </h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {[
              { step: '01', title: 'Guided Intake', detail: 'Patients answer structured questions.' },
              { step: '02', title: 'AI Recommendation', detail: 'Decision-tree routing + confidence.' },
              { step: '03', title: 'Instant Booking', detail: 'Appointments confirmed in-system.' },
              { step: '04', title: 'Ledger Record', detail: 'Hash logged on-chain for audit.' },
            ].map((item, index) => (
              <div
                key={item.step}
                className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 text-left shadow-2xl shadow-black/30"
                data-reveal
                style={revealDelay(160 + index * 80)}
              >
                <p className="text-xs uppercase tracking-[0.25em] text-white/60">
                  Step {item.step}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-[color:var(--agent-muted)]">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="triage" className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 pb-24">
          <div className="text-center" data-reveal style={revealDelay(120)}>
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Live Triage</p>
            <h2 className="mt-4 text-3xl font-display font-semibold text-white sm:text-4xl">
              Try the intake experience in real time.
            </h2>
            <p className="mt-3 text-sm text-[color:var(--agent-muted)]">
              This demo uses advice-only guidance. Every booking can be recorded as a hash on-chain.
            </p>
          </div>
          <div className="mt-10">
            <TriagePage
              onCreateReservation={onCreateReservation}
              latestReservation={latestReservation}
              variant="embedded"
            />
          </div>
        </section>

        <section id="projects" className="mx-auto w-full max-w-6xl scroll-mt-24 px-6 pb-24">
          <div className="text-center" data-reveal style={revealDelay(120)}>
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Modules</p>
            <h2 className="mt-4 text-3xl font-display font-semibold text-white sm:text-4xl">
              Core building blocks for care delivery.
            </h2>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              'AI Triage Engine',
              'Secure Intake + RBAC',
              'Immutable Ledger',
            ].map((title, index) => (
              <div
                key={title}
                className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-8 text-left shadow-2xl shadow-black/30"
                data-reveal
                style={revealDelay(180 + index * 80)}
              >
                <p className="text-xs uppercase tracking-[0.25em] text-white/60">Module</p>
                <h3 className="mt-3 text-xl font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
                  {title === 'AI Triage Engine' &&
                    'Decision-tree + NLP intake with guidance guardrails.'}
                  {title === 'Secure Intake + RBAC' &&
                    'JWT-based access for patients, nurses, and admins.'}
                  {title === 'Immutable Ledger' &&
                    'Appointment hashes recorded on Ethereum for audit trails.'}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default LandingPage

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { buildRoute } from '../config/routing'
import type { AppPage } from '../types/navigation'
import type { Reservation, ReservationDraft } from '../types/triage'
import TriagePage from './TriagePage'

type LandingPageProps = {
  onNavigate?: (page: AppPage) => void
  onCreateReservation: (draft: ReservationDraft) => void
  latestReservation?: Reservation
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  isAuthenticated?: boolean
}

type NavTarget = 'home' | 'about' | 'workflow' | 'triage' | 'projects'

const navItems: Array<{ label: string; target: NavTarget }> = [
  { label: 'Home', target: 'home' },
  { label: 'Platform', target: 'about' },
  { label: 'Workflow', target: 'workflow' },
  { label: 'Triage', target: 'triage' },
  { label: 'Modules', target: 'projects' },
]

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
  isAuthenticated = false,
}: LandingPageProps) => {
  const [isNavHidden, setIsNavHidden] = useState(false)
  const [activeTarget, setActiveTarget] = useState<NavTarget>('home')
  const adminDashboardRoute = buildRoute('admin_login')

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

  useEffect(() => {
    if (typeof window === 'undefined') return

    const sectionOrder: NavTarget[] = ['home', 'about', 'workflow', 'triage', 'projects']
    const observed = sectionOrder
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => Boolean(node))

    if (!observed.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        if (visible[0]?.target?.id) {
          setActiveTarget(visible[0].target.id as NavTarget)
        }
      },
      {
        rootMargin: '-25% 0px -55% 0px',
        threshold: [0.2, 0.45, 0.7],
      }
    )

    observed.forEach((node) => observer.observe(node))

    return () => {
      observer.disconnect()
    }
  }, [])

  const handleNav = (target: NavTarget) => {
    if (typeof window === 'undefined') return
    setActiveTarget(target)
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
        <div className="absolute inset-0 agent-grid opacity-15" />
        <div className="absolute -top-48 left-[10%] h-80 w-80 rounded-full bg-[radial-gradient(circle_at_center,rgba(124,252,196,0.26),transparent_62%)] blur-3xl animate-drift-slow" />
        <div className="absolute top-[30%] right-[4%] h-96 w-96 rounded-full bg-[radial-gradient(circle_at_center,rgba(90,215,255,0.22),transparent_62%)] blur-3xl animate-drift" />
        <div className="absolute bottom-[-120px] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,209,102,0.16),transparent_62%)] blur-3xl animate-float-slow" />
      </div>

      {!isAuthenticated && (
        <header
          className={`sticky top-0 z-40 border-b border-white/10 bg-[color:var(--agent-bg)]/95 backdrop-blur transition-transform duration-300 ${
            isNavHidden ? '-translate-y-full' : 'translate-y-0'
          }`}
        >
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
            <button
              type="button"
              onClick={() => handleNav('home')}
              className="flex items-center gap-3 text-left"
              data-reveal
              style={revealDelay(40)}
            >
              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/5">
                <svg
                  className="h-5 w-5 text-[color:var(--agent-accent)]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h4l2-3 3 6 2-3h3" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">AI Health Care</p>
                <p className="text-[11px] text-white/50">AI triage and immutable operations</p>
              </div>
            </button>

            <nav
              className="hidden items-center gap-3 rounded-full border border-white/10 bg-white/5 p-1 md:flex"
              data-reveal
              style={revealDelay(90)}
            >
              {navItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                    activeTarget === item.target
                      ? 'bg-white/10 text-white'
                      : 'text-white/60 hover:text-white'
                  }`}
                  onClick={() => handleNav(item.target)}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2" data-reveal style={revealDelay(130)}>
              <button
                type="button"
                className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white sm:px-4"
                onClick={onToggleTheme}
                title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              >
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
              </button>
              <button
                type="button"
                className="rounded-full bg-[color:var(--agent-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--agent-on-accent)] transition hover:-translate-y-0.5 hover:bg-[color:var(--agent-accent-strong)] sm:px-5"
                onClick={() => onNavigate?.('login')}
              >
                Log in
              </button>
            </div>
          </div>
        </header>
      )}

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
                onClick={() => handleNav('triage')}
              >
                Launch Triage Demo
              </button>
              <button
                type="button"
                className="rounded-full border border-white/10 px-6 py-3 text-sm font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
                onClick={() => handleNav('workflow')}
              >
                View Workflow
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

          <div className="mt-10 text-center" data-reveal style={revealDelay(260)}>
            <a
              href={adminDashboardRoute}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-[color:var(--agent-accent)] transition hover:text-[color:var(--agent-accent-strong)]"
            >
              Admin Dashboard
            </a>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/50">
              BSIT3 - COMSEC - 01
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

export default LandingPage

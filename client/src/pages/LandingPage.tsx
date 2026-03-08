import { type FormEvent, useEffect, useRef, useState } from 'react'
import type { AppPage } from '../types/navigation'
import ConfirmModal from '../components/ui/ConfirmModal'
import type { Reservation } from '../types'
import AppLogoBadge from '../components/branding/AppLogoBadge'
import { chipButtonClass } from '../styles/uiClassNames'
import { isDoctorRole } from '../utils/dashboardRoutes'

type LandingPageProps = {
  onNavigate?: (page: AppPage) => void
  latestReservation?: Reservation
  isAuthenticated?: boolean
  authRole?: string | null
  authAccountType?: string | null
  onLogout?: () => void
}

type LandingSectionId = 'overview' | 'details' | 'contact'

type ContactFormErrors = {
  fullName?: string
  email?: string
  message?: string
}

const featureCards = [
  {
    title: 'Guided Booking',
    detail: 'Clear booking flow with concise scheduling guidance.',
  },
  {
    title: 'Appointment Tracking',
    detail: 'Simple booking status view for patients and care staff.',
  },
  {
    title: 'Role-Safe Access',
    detail: 'Patient, doctor, and admin routes are separated clearly.',
  },
]

const heroMetrics = [
  { value: '24/7', label: 'Booking intake' },
  { value: '3 roles', label: 'Workspace lanes' },
  { value: '< 2 min', label: 'Typical booking flow' },
  { value: 'Live', label: 'Status visibility' },
] as const

const sectionTabs: Array<{ id: LandingSectionId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'details', label: 'Details' },
  { id: 'contact', label: 'Contact' },
]

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i
const publicHeaderClass =
  'sticky top-0 z-50 border-b border-[color:var(--card-border)] bg-[color:var(--agent-bg)]'
const publicBrandClass = 'inline-flex items-center gap-3 text-left'
const sectionPanelClass =
  'rounded-[1.8rem] border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] shadow-[var(--card-shadow)]'
const metricCardClass =
  'rounded-[1.2rem] border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-4 shadow-[var(--card-shadow-soft)]'
const featureCardClass =
  'rounded-[1.45rem] border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-6 shadow-[var(--card-shadow-soft)]'
const featureIconClass =
  'grid h-11 w-11 place-items-center rounded-[1rem] bg-[color:var(--agent-accent-soft)] text-[color:var(--agent-accent)]'

const LandingPage = ({
  onNavigate,
  latestReservation,
  isAuthenticated = false,
  authRole = null,
  authAccountType = null,
  onLogout,
}: LandingPageProps) => {
  const [activeSection, setActiveSection] = useState<LandingSectionId>('overview')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<ContactFormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const doctorDestination: AppPage = isDoctorRole(authRole, authAccountType)
    ? 'doctor_dashboard'
    : 'doctor_login'
  const adminDestination: AppPage =
    authRole === 'admin' || authRole === 'system_admin' ? 'admin' : 'admin_login'

  const overviewRef = useRef<HTMLElement | null>(null)
  const detailsRef = useRef<HTMLElement | null>(null)
  const contactRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const sections = [overviewRef.current, detailsRef.current, contactRef.current].filter(
      Boolean
    ) as HTMLElement[]

    if (!sections.length || typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        if (!visible.length) return
        const id = visible[0].target.id as LandingSectionId
        setActiveSection(id)
      },
      {
        rootMargin: '-42% 0px -42% 0px',
        threshold: [0.15, 0.35, 0.6],
      }
    )

    sections.forEach((section) => observer.observe(section))

    return () => {
      observer.disconnect()
    }
  }, [])

  const scrollToSection = (sectionId: LandingSectionId) => {
    const sectionMap: Record<LandingSectionId, HTMLElement | null> = {
      overview: overviewRef.current,
      details: detailsRef.current,
      contact: contactRef.current,
    }

    const target = sectionMap[sectionId] ?? document.getElementById(sectionId)
    if (!target) return

    setActiveSection(sectionId)
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleContactSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: ContactFormErrors = {}
    const cleanedName = fullName.trim()
    const cleanedEmail = email.trim().toLowerCase()
    const cleanedMessage = message.trim()

    if (!cleanedName) nextErrors.fullName = 'Full name is required.'
    if (!cleanedEmail) {
      nextErrors.email = 'Email is required.'
    } else if (!emailPattern.test(cleanedEmail)) {
      nextErrors.email = 'Enter a valid email address.'
    }
    if (!cleanedMessage) nextErrors.message = 'Message is required.'

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setSubmitted(false)
      return
    }

    setSubmitted(true)
    setErrors({})
    setFullName('')
    setEmail('')
    setMessage('')
  }

  return (
    <div className="min-h-screen text-[color:var(--agent-ink)]">
      <header className={publicHeaderClass}>
        <div className="mx-auto grid w-full max-w-[84rem] grid-cols-1 gap-3 px-4 py-4 md:grid-cols-[auto_1fr_auto] md:items-center md:px-6">
          <button
            type="button"
            className={`${publicBrandClass} md:justify-self-start`}
            onClick={() => onNavigate?.('landing')}
          >
            <AppLogoBadge className="h-9 w-9" />
            <div>
              <p className="text-sm font-extrabold text-[color:var(--agent-ink)]">AI Health Care</p>
              <p className="text-xs text-[color:var(--agent-muted)]">Clinical scheduling and role-safe workflows</p>
            </div>
          </button>

          <nav
            aria-label="Landing sections"
            className="order-3 flex gap-2 overflow-x-auto pb-1 md:order-2 md:justify-self-center md:pb-0"
          >
            {sectionTabs.map((tab) => {
              const isActive = activeSection === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => scrollToSection(tab.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className={`shrink-0 ${chipButtonClass} ${
                    isActive
                      ? 'border-[color:var(--agent-accent)] bg-[color:var(--agent-accent-soft)]'
                      : ''
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </nav>

          <div className="order-2 flex flex-wrap items-center gap-2 md:order-3 md:justify-self-end">
            {!isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate?.('login')}
                  className={chipButtonClass}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.('signup')}
                  className="agent-button px-4 py-2 text-xs text-[color:var(--agent-on-accent)]"
                >
                  Sign up
                </button>
              </>
            ) : (
              <LogoutControls onLogout={onLogout} />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[84rem] px-4 pb-16 pt-6 sm:px-6">
        <section id="overview" ref={overviewRef} className="scroll-mt-32">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.16fr)_minmax(20rem,0.84fr)]">
            <div className={`${sectionPanelClass} p-6 sm:p-8`}>
              <span className="agent-eyebrow">Clinical appointment platform</span>
              <h1 className="mt-4 max-w-[12ch] font-serif text-[clamp(2.8rem,8vw,5rem)] font-bold leading-[0.96] tracking-[-0.04em] text-[color:var(--agent-ink)]">
                Professional appointment workflows for patients, doctors, and admins.
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[color:var(--agent-muted)]">
                Book consultations, monitor queue status, and move between role-safe workspaces through a cleaner, calmer interface built for repeated daily use.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate?.(isAuthenticated ? 'appointments' : 'login')}
                  className="agent-button px-5 py-3 text-sm text-[color:var(--agent-on-accent)]"
                >
                  {isAuthenticated ? 'Open patient workspace' : 'Sign in to continue'}
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('details')}
                  className="agent-button-ghost px-5 py-3 text-sm"
                >
                  Review workflow details
                </button>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="agent-status-badge agent-status-badge--info">Patient booking</span>
                <span className="agent-status-badge agent-status-badge--success">Doctor triage</span>
                <span className="agent-status-badge agent-status-badge--warning">Admin oversight</span>
              </div>
            </div>

            <aside className={`${sectionPanelClass} grid gap-4 p-5`}>
              <div className="rounded-[1.35rem] border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
                  Latest booking snapshot
                </p>
                {latestReservation ? (
                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-lg font-semibold text-[color:var(--agent-ink)]">{latestReservation.patientName}</p>
                      <p className="mt-1 text-sm text-[color:var(--agent-muted)]">
                        {latestReservation.department} · {latestReservation.priority} priority
                      </p>
                    </div>
                    <p className="text-sm leading-7 text-[color:var(--agent-muted)]">
                      {latestReservation.summary}
                    </p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm leading-7 text-[color:var(--agent-muted)]">
                    No booking is on record yet. Use the patient workspace to submit and monitor the first request.
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {heroMetrics.map((metric) => (
                  <article key={metric.label} className={metricCardClass}>
                    <p className="text-2xl font-extrabold text-[color:var(--agent-ink)]">{metric.value}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
                      {metric.label}
                    </p>
                  </article>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section id="details" ref={detailsRef} className="mt-6 scroll-mt-32 space-y-6">
          <div className={`${sectionPanelClass} p-6 sm:p-8`}>
            <span className="agent-eyebrow">Workflow overview</span>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {featureCards.map((item, index) => (
                <article key={item.title} className={featureCardClass}>
                  <span className={featureIconClass} aria-hidden="true">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                      {index === 0 ? <path d="M4 6h16M7 3v6M17 3v6M4 10h16v10H4z" /> : null}
                      {index === 1 ? <path d="M5 12h5l2-3 3 7 2-4h2" /> : null}
                      {index === 2 ? <path d="M12 3 4 7v6c0 4.5 3 7.3 8 8 5-0.7 8-3.5 8-8V7l-8-4z" /> : null}
                    </svg>
                  </span>
                  <h2 className="mt-5 text-lg font-semibold text-[color:var(--agent-ink)]">{item.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-[color:var(--agent-muted)]">{item.detail}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <article className={`${sectionPanelClass} p-6`}>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
                Patient path
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-[color:var(--agent-ink)]">From booking request to visible status updates.</h2>
              <ol className="mt-4 space-y-3 text-sm leading-7 text-[color:var(--agent-muted)]">
                <li>1. Sign in and open the patient workspace.</li>
                <li>2. Submit symptoms, department, and preferred time.</li>
                <li>3. Track booking status, notifications, and account controls from one place.</li>
              </ol>
            </article>

            <article className={`${sectionPanelClass} p-6`}>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
                Staff access
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-[color:var(--agent-ink)]">Separate doctor and admin lanes keep operational visibility clear.</h2>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate?.(doctorDestination)}
                  className="agent-button-ghost px-4 py-2.5 text-sm"
                >
                  Doctor access
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.(adminDestination)}
                  className="agent-button-ghost px-4 py-2.5 text-sm"
                >
                  Admin access
                </button>
              </div>
              <p className="mt-4 text-sm leading-7 text-[color:var(--agent-muted)]">
                Role checks remain intact while each workspace stays focused on its own operational tasks.
              </p>
            </article>
          </div>
        </section>

        <section id="contact" ref={contactRef} className="mt-6 scroll-mt-32">
          <div className={`${sectionPanelClass} p-6 sm:p-8`}>
            <span className="agent-eyebrow">Contact</span>
            <h2 className="mt-4 text-3xl font-semibold text-[color:var(--agent-ink)]">Need help or have feedback?</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--agent-muted)]">
              Send us a message. This form is frontend-only demo mode and does not send data to a
              backend service.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleContactSubmit} noValidate>
              <div>
                <label className="agent-field-label">
                  Full Name
                </label>
                <input
                  value={fullName}
                  onChange={(event) => {
                    setFullName(event.target.value)
                    setErrors((prev) => ({ ...prev, fullName: undefined }))
                    if (submitted) setSubmitted(false)
                  }}
                  placeholder="Your full name"
                  className="agent-input"
                />
                {errors.fullName ? (
                  <p className="mt-2 text-xs font-semibold text-[color:var(--agent-danger)]">{errors.fullName}</p>
                ) : null}
              </div>

              <div>
                <label className="agent-field-label">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setErrors((prev) => ({ ...prev, email: undefined }))
                    if (submitted) setSubmitted(false)
                  }}
                  placeholder="you@example.com"
                  className="agent-input"
                />
                {errors.email ? (
                  <p className="mt-2 text-xs font-semibold text-[color:var(--agent-danger)]">{errors.email}</p>
                ) : null}
              </div>

              <div>
                <label className="agent-field-label">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value)
                    setErrors((prev) => ({ ...prev, message: undefined }))
                    if (submitted) setSubmitted(false)
                  }}
                  placeholder="Tell us what you need help with"
                  className="agent-textarea min-h-[130px]"
                />
                {errors.message ? (
                  <p className="mt-2 text-xs font-semibold text-[color:var(--agent-danger)]">{errors.message}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className="agent-button px-4 py-2.5 text-sm text-[color:var(--agent-on-accent)]">
                  Submit Message
                </button>
                <p className="text-xs text-[color:var(--agent-muted-soft)]">
                  Demo mode only. No message is sent externally.
                </p>
              </div>
            </form>

            {submitted ? (
              <p className="agent-alert agent-alert--success mt-4 text-sm">
                Thanks. Your message was saved locally in this demo view.
              </p>
            ) : null}
          </div>
        </section>
      </main>

      <footer
        id="site-footer"
        className="border-t border-[color:var(--card-border)] px-4 py-4 text-xs text-[color:var(--agent-muted)] sm:px-6"
      >
        <div className="mx-auto flex w-full max-w-[84rem] items-center gap-3">
          <span>AI Health Care</span>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage

function LogoutControls({ onLogout }: { onLogout?: () => void }) {
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        className={chipButtonClass}
      >
        Logout
      </button>

      <ConfirmModal
        open={showConfirm}
        title="Confirm logout"
        message="Are you sure you want to logout?"
        confirmLabel="Logout"
        cancelLabel="Cancel"
        onConfirm={() => {
          setShowConfirm(false)
          onLogout?.()
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  )
}

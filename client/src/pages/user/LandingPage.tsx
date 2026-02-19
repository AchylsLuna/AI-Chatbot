import { type FormEvent, useEffect, useRef, useState } from 'react'
import type { AppPage } from '../../types/navigation'
import type { Reservation } from '../../types'
import AppLogoBadge from '../../components/branding/AppLogoBadge'

type LandingPageProps = {
  onNavigate?: (page: AppPage) => void
  latestReservation?: Reservation
  isAuthenticated?: boolean
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
    detail: 'User, doctor, admin, and super admin routes are separated clearly.',
  },
]

const sectionTabs: Array<{ id: LandingSectionId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'details', label: 'Details' },
  { id: 'contact', label: 'Contact' },
]

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i

const LandingPage = ({
  onNavigate,
  latestReservation,
  isAuthenticated = false,
}: LandingPageProps) => {
  const [activeSection, setActiveSection] = useState<LandingSectionId>('overview')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<ContactFormErrors>({})
  const [submitted, setSubmitted] = useState(false)

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
    <div className="min-h-screen bg-[color:var(--agent-bg)] text-[color:var(--agent-ink)]">
      <header className="sticky top-0 z-40 border-b border-[color:var(--card-border)] bg-[color:var(--agent-surface)]/95 backdrop-blur">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-3 px-4 py-4 sm:px-6 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <button
            type="button"
            className="flex items-center gap-2.5 text-left md:justify-self-start"
            onClick={() => onNavigate?.('landing')}
          >
            <AppLogoBadge className="h-9 w-9" />
            <div>
              <p className="text-sm font-semibold">AI Health Care</p>
              <p className="text-xs text-[color:var(--agent-muted)]">Minimal care workspace</p>
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
                  className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                    isActive
                      ? 'border-[color:var(--agent-accent)] bg-[color:var(--agent-accent-soft)] text-[color:var(--agent-ink)]'
                      : 'border-[color:var(--card-border)] bg-[color:var(--agent-surface)] text-[color:var(--agent-muted)] hover:border-[color:var(--agent-line)] hover:text-[color:var(--agent-ink)]'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </nav>

          <div className="order-2 flex flex-wrap items-center gap-2 md:order-3 md:justify-self-end">
            <button
              type="button"
              onClick={() => onNavigate?.('login')}
              className="rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] px-4 py-2 text-xs font-semibold text-[color:var(--agent-ink)] transition hover:bg-[color:var(--agent-overlay)]"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('signup')}
              className="rounded-full bg-[color:var(--agent-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--agent-on-accent)] transition hover:bg-[color:var(--agent-accent-strong)]"
            >
              Sign up
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-12 pt-8 sm:px-6">
        <section id="overview" ref={overviewRef} className="scroll-mt-32">
          <div className="rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-6 shadow-[var(--card-shadow-soft)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
              AI appointment workflow
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Cleaner care workflow, minimal interface.
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-[color:var(--agent-muted)] sm:text-base">
              Book appointments and monitor status with role-safe access. The interface is
              streamlined for speed, clarity, and daily use.
            </p>
            {isAuthenticated ? (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate?.('appointments')}
                  className="rounded-xl bg-[color:var(--agent-accent)] px-4 py-2.5 text-sm font-semibold text-[color:var(--agent-on-accent)] transition hover:bg-[color:var(--agent-accent-strong)]"
                >
                  Open appointments
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <section id="details" ref={detailsRef} className="mt-6 scroll-mt-32 space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {featureCards.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-5"
              >
                <h2 className="text-base font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm text-[color:var(--agent-muted)]">{item.detail}</p>
              </article>
            ))}
          </div>

          <div className="rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
              Latest booking snapshot
            </p>
            {latestReservation ? (
              <div className="mt-3">
                <p className="text-sm font-semibold">{latestReservation.patientName}</p>
                <p className="mt-1 text-sm text-[color:var(--agent-muted)]">
                  {latestReservation.department} · {latestReservation.priority} priority
                </p>
                <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
                  {latestReservation.summary}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-[color:var(--agent-muted)]">
                No booking yet. Open appointments to track your first booking.
              </p>
            )}
          </div>
        </section>

        <section id="contact" ref={contactRef} className="mt-6 scroll-mt-32">
          <div className="rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-6 shadow-[var(--card-shadow-soft)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
              Contact
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Need help or have feedback?</h2>
            <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
              Send us a message. This form runs in frontend-only demo mode and stores entries in
              local demo state only.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleContactSubmit} noValidate>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--agent-muted)]">
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
                  <p className="mt-1 text-xs font-semibold text-rose-500">{errors.fullName}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--agent-muted)]">
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
                  <p className="mt-1 text-xs font-semibold text-rose-500">{errors.email}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-[color:var(--agent-muted)]">
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
                  <p className="mt-1 text-xs font-semibold text-rose-500">{errors.message}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className="agent-button">
                  Submit Message
                </button>
                <p className="text-xs text-[color:var(--agent-muted-soft)]">
                  Demo mode only. No message is sent externally.
                </p>
              </div>
            </form>

            {submitted ? (
              <p className="mt-4 rounded-xl border border-emerald-300/40 bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-700">
                Thanks. Your message was saved locally in this demo view.
              </p>
            ) : null}
          </div>
        </section>
      </main>

      <footer
        id="site-footer"
        className="border-t border-[color:var(--card-border)] bg-[color:var(--agent-surface)] px-4 py-4 text-center text-xs text-[color:var(--agent-muted)] sm:px-6"
      >
        AI Health Care
      </footer>
    </div>
  )
}

export default LandingPage

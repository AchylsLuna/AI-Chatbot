import { type CSSProperties, type FormEvent, useEffect, useRef, useState } from 'react'
import type { AppPage } from '../types/navigation'
import ConfirmModal from '../components/ui/ConfirmModal'
import type { Reservation } from '../types'
import AppLogoBadge from '../components/branding/AppLogoBadge'
import { api } from '../services/api'

type LandingPageProps = {
  onNavigate?: (page: AppPage) => void
  latestReservation?: Reservation
  isAuthenticated?: boolean
  onLogout?: () => void
}

type LandingSectionId = 'home' | 'services' | 'about' | 'contact'

type ContactFormErrors = {
  fullName?: string
  email?: string
  message?: string
}

type PlaceholderCardProps = {
  title: string
  note?: string
  className?: string
}

const serviceCards = [
  {
    title: 'Booking Intake',
    detail: 'Capture appointment requests with a clear and consistent patient flow.',
  },
  {
    title: 'Queue Visibility',
    detail: 'Track booking status updates and operational follow-up from one place.',
  },
  {
    title: 'Role Separation',
    detail: 'Patient, doctor, and admin experiences stay focused and policy-safe.',
  },
  {
    title: 'Secure Access',
    detail: 'Authentication checks and OTP flows protect all privileged workflows.',
  },
]

const processSteps = [
  {
    title: 'Schedule',
    detail: 'Submit appointment details quickly and clearly.',
  },
  {
    title: 'Assessment',
    detail: 'Care teams review and route requests appropriately.',
  },
  {
    title: 'Treatment',
    detail: 'Track outcomes and status updates in one place.',
  },
]

const quickOverviewItems = [
  'Role-safe routing for patient, doctor, and admin paths.',
  'Session-aware checks for protected account access.',
  'Clear booking visibility from request to status updates.',
]

const sectionTabs: Array<{ id: LandingSectionId; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'services', label: 'Services' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
]

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i
const fullNameMinLength = 2
const fullNameMaxLength = 80
const messageMinLength = 10
const messageMaxLength = 1200
const publicHeaderClass = 'landing-ref-header sticky top-0 z-50'
const publicBrandClass = 'inline-flex items-center gap-3 text-left'
const sectionPanelClass = 'landing-ref-card rounded-[1.3rem] border p-6 shadow-[var(--card-shadow-soft)]'
const softCardClass = 'landing-ref-soft-card rounded-[1rem] border'
const featureIconClass =
  'landing-ref-feature-icon grid h-10 w-10 place-items-center rounded-[0.8rem] text-[color:var(--agent-accent)]'

const revealDelay = (delay: number): CSSProperties => ({
  ['--reveal-delay' as string]: `${delay}ms`,
})

const ImagePlaceholderCard = ({
  title,
  note = 'Image placeholder',
  className = '',
}: PlaceholderCardProps) => (
  <div
    className={`${softCardClass} landing-ref-placeholder ${className} flex flex-col items-center justify-center gap-2 p-4 text-center`}
  >
    <span className="landing-ref-placeholder-icon grid h-10 w-10 place-items-center rounded-[0.75rem] border text-[color:var(--agent-muted-soft)]">
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3.5" y="5" width="17" height="14" rx="2" />
        <path d="M3.5 15 8 11l3.2 3 3.1-2.7L20.5 16" />
        <circle cx="15.2" cy="9.2" r="1.2" />
      </svg>
    </span>
    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
      {title}
    </p>
    <p className="text-xs text-[color:var(--agent-muted)]">{note}</p>
  </div>
)

const LandingPage = ({
  onNavigate,
  isAuthenticated = false,
  onLogout,
}: LandingPageProps) => {
  const [activeSection, setActiveSection] = useState<LandingSectionId>('home')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<ContactFormErrors>({})
  const [submitted, setSubmitted] = useState(false)
  const [submittedTicketId, setSubmittedTicketId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const homeRef = useRef<HTMLElement | null>(null)
  const servicesRef = useRef<HTMLElement | null>(null)
  const aboutRef = useRef<HTMLElement | null>(null)
  const contactRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const sections = [
      homeRef.current,
      servicesRef.current,
      aboutRef.current,
      contactRef.current,
    ].filter(Boolean) as HTMLElement[]

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
        rootMargin: '-38% 0px -42% 0px',
        threshold: [0.2, 0.45, 0.7],
      }
    )

    sections.forEach((section) => observer.observe(section))

    return () => observer.disconnect()
  }, [])

  const scrollToSection = (sectionId: LandingSectionId) => {
    const sectionMap: Record<LandingSectionId, HTMLElement | null> = {
      home: homeRef.current,
      services: servicesRef.current,
      about: aboutRef.current,
      contact: contactRef.current,
    }
    const target = sectionMap[sectionId] ?? document.getElementById(sectionId)
    if (!target) return

    setActiveSection(sectionId)
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const clearSubmissionFeedback = () => {
    if (submitted) setSubmitted(false)
    if (submittedTicketId) setSubmittedTicketId(null)
    if (submitError) setSubmitError(null)
  }

  const handleContactSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors: ContactFormErrors = {}
    const cleanedName = fullName.trim()
    const cleanedEmail = email.trim().toLowerCase()
    const cleanedMessage = message.trim()

    if (!cleanedName) {
      nextErrors.fullName = 'Full name is required.'
    } else if (cleanedName.length < fullNameMinLength || cleanedName.length > fullNameMaxLength) {
      nextErrors.fullName = `Full name must be between ${fullNameMinLength} and ${fullNameMaxLength} characters.`
    }
    if (!cleanedEmail) {
      nextErrors.email = 'Email is required.'
    } else if (!emailPattern.test(cleanedEmail)) {
      nextErrors.email = 'Enter a valid email address.'
    }
    if (!cleanedMessage) {
      nextErrors.message = 'Message is required.'
    } else if (cleanedMessage.length < messageMinLength || cleanedMessage.length > messageMaxLength) {
      nextErrors.message = `Message must be between ${messageMinLength} and ${messageMaxLength} characters.`
    }

    setErrors(nextErrors)
    setSubmitError(null)
    if (Object.keys(nextErrors).length > 0) {
      setSubmitted(false)
      setSubmittedTicketId(null)
      return
    }

    setIsSubmitting(true)

    try {
      const ticketId = await api.submitSupportTicket({
        fullName: cleanedName,
        email: cleanedEmail,
        message: cleanedMessage,
      })
      setSubmitted(true)
      setSubmittedTicketId(ticketId)
      setSubmitError(null)
      setErrors({})
      setFullName('')
      setEmail('')
      setMessage('')
    } catch (error) {
      setSubmitted(false)
      setSubmittedTicketId(null)
      setSubmitError(
        error instanceof Error ? error.message : 'Unable to submit your request right now.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="landing-ref-shell min-h-screen text-[color:var(--agent-ink)]">
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
              <p className="text-xs text-[color:var(--agent-muted)]">
                Clinical scheduling and role-safe workflows
              </p>
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
                  className={`landing-ref-nav-chip ${isActive ? 'is-active' : ''}`}
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
                  className="landing-ref-nav-chip"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.('signup')}
                  className="landing-ref-primary-chip"
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

      <main className="mx-auto w-full max-w-[84rem] space-y-8 px-4 pb-16 pt-6 sm:px-6">
        <section id="home" ref={homeRef} className="scroll-mt-28">
          <div
            data-reveal="fade"
            style={revealDelay(30)}
            className="landing-ref-hero-stage overflow-hidden rounded-[1.75rem] border border-[color:var(--card-border)] shadow-[var(--card-shadow)]"
          >
            <div className="grid min-h-[29rem] gap-0 lg:grid-cols-[minmax(0,0.43fr)_minmax(0,0.57fr)]">
              <div
                data-reveal="slide-right"
                style={revealDelay(80)}
                className="landing-ref-hero-copy px-6 pb-6 pt-7 sm:px-8 sm:pt-8"
              >
                <span className="agent-eyebrow">
                  <span className="landing-ref-pulse-dot" aria-hidden="true" />
                  Clinical appointment platform
                </span>
                <h1 className="mt-4 max-w-[10ch] text-[clamp(2.25rem,6.4vw,4.4rem)] font-medium leading-[0.95] tracking-[-0.03em] text-[color:var(--agent-ink)]">
                  Your trusted appointment workflow starts here.
                </h1>
                <p className="mt-4 max-w-[34ch] text-sm leading-7 text-[color:var(--agent-muted)] sm:text-base">
                  Coordinate booking intake, status tracking, and role-specific access with a
                  clearer clinical experience.
                </p>
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => onNavigate?.(isAuthenticated ? 'appointments' : 'login')}
                    className="landing-ref-primary-button px-5 py-2.5 text-sm"
                  >
                    {isAuthenticated ? 'Open patient portal' : 'Sign in to continue'}
                  </button>
                </div>
              </div>

              <div
                data-reveal="slide-left"
                style={revealDelay(140)}
                className="landing-ref-hero-visual-wrap px-5 pb-5 pt-6 sm:px-8 sm:pb-8 sm:pt-8"
              >
                <ImagePlaceholderCard
                  title="Hero Image"
                  note="Replace with featured clinical photo"
                  className="landing-ref-float h-full min-h-[18rem] rounded-[1.4rem]"
                />
              </div>
            </div>

          </div>
        </section>

        <section id="services" ref={servicesRef} className="scroll-mt-28">
          <div data-reveal="fade" style={revealDelay(50)} className={`${sectionPanelClass} sm:p-8`}>
            <span className="agent-eyebrow">
              <span className="landing-ref-pulse-dot" aria-hidden="true" />
              Services
            </span>
            <h2 className="mt-4 text-[1.75rem] font-semibold leading-tight text-[color:var(--agent-ink)]">
              Core workflow capabilities
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--agent-muted)]">
              Structured modules support patient booking, care-team review, and role-based
              daily operations.
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {quickOverviewItems.map((item) => (
                <li
                  key={`overview-${item}`}
                  className="flex items-center gap-2 text-xs text-[color:var(--agent-muted)]"
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--agent-accent)]"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {serviceCards.map((item, index) => (
                <article
                  key={item.title}
                  data-reveal="fade"
                  style={revealDelay(120 + index * 90)}
                  className={`${softCardClass} landing-ref-card-interactive p-4`}
                >
                  <span className={featureIconClass} aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      {index === 0 ? <path d="M4 6h16M7 3v6M17 3v6M4 10h16v10H4z" /> : null}
                      {index === 1 ? <path d="M5 12h5l2-3 3 7 2-4h2" /> : null}
                      {index === 2 ? <path d="M12 3 4 7v6c0 4.5 3 7.3 8 8 5-0.7 8-3.5 8-8V7l-8-4z" /> : null}
                      {index === 3 ? <path d="M6 12h12M12 6v12M4 4h16v16H4z" /> : null}
                    </svg>
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-[color:var(--agent-ink)]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--agent-muted)]">
                    {item.detail}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="about" ref={aboutRef} className="scroll-mt-28 space-y-4">
          <div
            data-reveal="fade"
            style={revealDelay(40)}
            className={`${sectionPanelClass} overflow-hidden sm:p-8`}
          >
            <span className="agent-eyebrow">
              <span className="landing-ref-pulse-dot" aria-hidden="true" />
              About
            </span>
            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="relative min-h-[17.5rem] sm:min-h-[20.5rem]" data-reveal="slide-right" style={revealDelay(140)}>
                <ImagePlaceholderCard
                  title="Primary Image"
                  note="Replace with clinic photo"
                  className="h-[16.5rem] w-[79%] sm:h-[20rem]"
                />
                <ImagePlaceholderCard
                  title="Supporting Image"
                  note="Replace with team photo"
                  className="absolute bottom-2 right-0 h-[9.5rem] w-[46%] sm:h-[11rem]"
                />
              </div>

              <div data-reveal="slide-left" style={revealDelay(170)}>
                <h2 className="text-[1.75rem] font-semibold leading-tight text-[color:var(--agent-ink)]">
                  Professional care coordination with clear operational lanes.
                </h2>
                <p className="mt-3 text-sm leading-7 text-[color:var(--agent-muted)]">
                  This platform is designed to keep patient requests, doctor triage, and admin
                  oversight synchronized without route or access confusion.
                </p>
                <p className="mt-3 text-sm leading-7 text-[color:var(--agent-muted)]">
                  Teams can move through high-frequency daily workflows with consistent status
                  visibility and role-safe access at each step.
                </p>
              </div>
            </div>
          </div>

          <div
            data-reveal="fade"
            style={revealDelay(80)}
            className={`${sectionPanelClass} landing-ref-process-panel sm:p-7`}
          >
            <span className="agent-eyebrow">
              <span className="landing-ref-pulse-dot" aria-hidden="true" />
              Process
            </span>
            <h3 className="mt-4 text-[1.6rem] font-semibold leading-tight text-[color:var(--agent-ink)]">
              Simple three-step patient flow
            </h3>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {processSteps.map((step, index) => (
                <article
                  key={step.title}
                  data-reveal="fade"
                  style={revealDelay(150 + index * 90)}
                  className={`${softCardClass} landing-ref-card-interactive p-4`}
                >
                  <p className="text-[1.9rem] font-semibold leading-none text-[color:var(--agent-accent)]">
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <h4 className="mt-2 text-base font-semibold text-[color:var(--agent-ink)]">
                    {step.title}
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--agent-muted)]">
                    {step.detail}
                  </p>
                </article>
              ))}
            </div>
            <div className="mt-5">
              <button
                type="button"
                onClick={() => onNavigate?.(isAuthenticated ? 'appointments' : 'login')}
                className="landing-ref-primary-button px-5 py-2.5 text-sm"
              >
                Book now
              </button>
            </div>
          </div>
        </section>

        <section id="contact" ref={contactRef} className="scroll-mt-28">
          <div
            data-reveal="fade"
            style={revealDelay(60)}
            className={`${sectionPanelClass} sm:p-8`}
          >
            <span className="agent-eyebrow">
              <span className="landing-ref-pulse-dot" aria-hidden="true" />
              Contact
            </span>
            <h2 className="mt-4 text-[1.95rem] font-semibold leading-tight text-[color:var(--agent-ink)]">
              Need help or have feedback?
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--agent-muted)]">
              Send us a message and we will log a support request for follow-up.
            </p>

            <form className="mt-5 space-y-4" onSubmit={handleContactSubmit} noValidate>
              <div>
                <label className="agent-field-label">Full Name</label>
                <input
                  value={fullName}
                  onChange={(event) => {
                    setFullName(event.target.value)
                    setErrors((prev) => ({ ...prev, fullName: undefined }))
                    clearSubmissionFeedback()
                  }}
                  placeholder="Your full name"
                  className="agent-input"
                  maxLength={fullNameMaxLength}
                />
                {errors.fullName ? (
                  <p className="mt-2 text-xs font-semibold text-[color:var(--agent-danger)]">
                    {errors.fullName}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="agent-field-label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    setErrors((prev) => ({ ...prev, email: undefined }))
                    clearSubmissionFeedback()
                  }}
                  placeholder="you@example.com"
                  className="agent-input"
                  maxLength={254}
                />
                {errors.email ? (
                  <p className="mt-2 text-xs font-semibold text-[color:var(--agent-danger)]">
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="agent-field-label">Message</label>
                <textarea
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value)
                    setErrors((prev) => ({ ...prev, message: undefined }))
                    clearSubmissionFeedback()
                  }}
                  placeholder="Tell us what you need help with"
                  className="agent-textarea min-h-[130px]"
                  maxLength={messageMaxLength}
                />
                {errors.message ? (
                  <p className="mt-2 text-xs font-semibold text-[color:var(--agent-danger)]">
                    {errors.message}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="landing-ref-primary-button px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
                <p className="text-xs text-[color:var(--agent-muted-soft)]">
                  We validate each field before your request is submitted.
                </p>
              </div>
            </form>

            {submitError ? (
              <p className="agent-alert agent-alert--danger mt-4 text-sm">{submitError}</p>
            ) : null}
            {submitted ? (
              <p className="agent-alert agent-alert--success mt-4 text-sm">
                Support request submitted successfully
                {submittedTicketId ? ` · Reference ${submittedTicketId.slice(-6).toUpperCase()}` : ''}.
              </p>
            ) : null}
          </div>
        </section>
      </main>

      <footer
        id="site-footer"
        className="border-t border-[color:var(--card-border)] px-4 py-4 text-xs text-[color:var(--agent-muted)] sm:px-6"
      >
        <div className="mx-auto flex w-full max-w-[84rem] items-center justify-center gap-3 text-center">
          <span>AI Health Care</span>
          <span className="text-[color:var(--agent-muted-soft)]">|</span>
          <span>Clinical scheduling and role-safe workflows</span>
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
        className="landing-ref-nav-chip"
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

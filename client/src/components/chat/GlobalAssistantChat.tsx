import { useEffect, useRef, useState } from 'react'
import type { UserRole } from '../../types'

type ChatMessage = {
  id: string
  sender: 'assistant' | 'user'
  text: string
}

type GlobalAssistantChatProps = {
  isIdentified?: boolean
  userRole?: UserRole | null
}

const RobotLogo = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="5" y="8" width="14" height="11" rx="3" />
    <path d="M12 4v4" />
    <circle cx="9" cy="13" r="1" />
    <circle cx="15" cy="13" r="1" />
    <path d="M9 16h6" />
  </svg>
)

const quickSupportPrompts = [
  'Introduce the system',
  'How do I book an appointment?',
  'How do I use the system?',
]

const roleLabel = (role?: UserRole | null) => {
  if (role === 'system_admin') return 'Super Admin'
  if (role === 'admin') return 'Admin'
  if (role === 'nurse') return 'Doctor'
  if (role === 'user') return 'User'
  return 'Guest'
}

const includesAny = (value: string, patterns: string[]) =>
  patterns.some((pattern) => value.includes(pattern))

const buildIntroReply = (context: { isIdentified: boolean; userRole?: UserRole | null }) => {
  const identityLine = context.isIdentified
    ? `You are signed in as ${roleLabel(context.userRole)}.`
    : 'You can use this assistant even without signing in.'

  return [
    'Welcome to AI Health Care.',
    identityLine,
    'This system helps with appointment booking, appointment tracking, and role-based dashboards.',
    'Ask me: "How do I book an appointment?" or "How do I use the system?"',
  ].join(' ')
}

const buildBookingReply = (context: { isIdentified: boolean }) => {
  const accessLine = context.isIdentified
    ? 'You already have access to booking.'
    : 'To complete booking, sign in first.'

  return [
    accessLine,
    'Requirements: patient full name, clear symptoms, and preferred schedule.',
    'Steps: 1) Open Appointments. 2) Enter booking details and requested schedule.',
    '3) Submit booking and review current status updates in the appointments view.',
    'For emergencies, contact local emergency services immediately.',
  ].join(' ')
}

const buildSystemGuideReply = (context: { isIdentified: boolean; userRole?: UserRole | null }) => {
  const roleHint = context.isIdentified
    ? `Current role: ${roleLabel(context.userRole)}.`
    : 'Guest mode supports guidance and navigation help.'

  return [
    roleHint,
    'System flow: Landing -> Login -> Appointments.',
    'Staff roles can also access Doctor/Admin dashboards based on permissions.',
    'Use top navigation for quick page access and use AI Chat anytime for help.',
  ].join(' ')
}

const buildReply = (
  prompt: string,
  context: { isIdentified: boolean; userRole?: UserRole | null }
) => {
  const normalized = prompt.toLowerCase()
  const guestHint = context.isIdentified
    ? ''
    : 'You can use this assistant even without signing in. '
  const roleHint = context.isIdentified ? `Current role: ${roleLabel(context.userRole)}. ` : ''

  if (
    includesAny(normalized, [
      'introduce',
      'introduction',
      'about this',
      'what is this',
      'what can you do',
      'start here',
      'hello',
      'hi',
      'hey',
    ])
  ) {
    return buildIntroReply(context)
  }

  if (
    includesAny(normalized, [
      'how to book',
      'book appointment',
      'booking',
      'book now',
      'requirements',
      'booking steps',
    ])
  ) {
    return buildBookingReply(context)
  }

  if (
    includesAny(normalized, [
      'how to use',
      'use the system',
      'system guide',
      'how it works',
      'navigation',
      'where to start',
      'workflow',
    ])
  ) {
    return buildSystemGuideReply(context)
  }

  if (normalized.includes('home') || normalized.includes('alert') || normalized.includes('risk')) {
    return `${guestHint}${roleHint}Home shows aggregated risk scores and critical alerts.`
  }

  if (normalized.includes('diagnostic') || normalized.includes('radiology') || normalized.includes('lab')) {
    return `${guestHint}${roleHint}Diagnostics focuses on AI-assisted radiology and lab analysis trends.`
  }

  if (normalized.includes('predictive') || normalized.includes('ward') || normalized.includes('admission') || normalized.includes('discharge')) {
    return `${guestHint}${roleHint}Predictive Ward displays expected admissions/discharges and capacity pressure.`
  }

  if (normalized.includes('registry') || normalized.includes('ehr') || normalized.includes('patient history')) {
    return `${guestHint}${roleHint}Patient Registry is the secure EHR area. You can review structure in guest mode, but patient records need signed-in permissions.`
  }

  if (normalized.includes('care ai') || normalized.includes('literature') || normalized.includes('chat')) {
    return `${guestHint}${roleHint}Care AI Chat can assist with workflow questions, medical literature lookup guidance, and navigation help across all modules.`
  }

  if (normalized.includes('compliance') || normalized.includes('hipaa') || normalized.includes('gdpr') || normalized.includes('security')) {
    return `${guestHint}${roleHint}Compliance Shield indicates HIPAA/GDPR status. Signed-in users get full operational security context.`
  }

  if (normalized.includes('appointment') || normalized.includes('book')) {
    return `${guestHint}Open Appointments to create and track bookings. Booking actions require login.`
  }
  if (normalized.includes('otp') || normalized.includes('code')) {
    return `${guestHint}OTP is currently optional in this build. Standard sign-in uses email and password.`
  }
  if (normalized.includes('admin')) {
    return `${guestHint}Admin Log in supports Super Admin and Admin accounts.`
  }
  if (normalized.includes('doctor') || normalized.includes('dashboard')) {
    return `${guestHint}Doctor Dashboard is available after Doctor Sign in. Admin and Super Admin can also open it for oversight.`
  }
  if (normalized.includes('login') || normalized.includes('register') || normalized.includes('sign up')) {
    return `${guestHint}Choose User Sign in, Doctor Sign in, or Admin Log in based on your role. Register first for new user accounts.`
  }

  return `${guestHint}${roleHint}I can introduce the system, explain booking requirements/steps, and guide navigation across appointments, login, and dashboard modules.`
}

const GlobalAssistantChat = ({
  isIdentified = false,
  userRole = null,
}: GlobalAssistantChatProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [liftedFromFooter, setLiftedFromFooter] = useState(false)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const messagesViewportRef = useRef<HTMLDivElement | null>(null)
  const nextMessageIdRef = useRef(1)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'seed',
      sender: 'assistant',
      text: buildIntroReply({ isIdentified, userRole }),
    },
  ])

  useEffect(() => {
    const handleOpenChat = () => {
      setIsOpen(true)
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }

    window.addEventListener('healix:open-care-chat', handleOpenChat)
    window.addEventListener('ai-health-care:open-assistant', handleOpenChat)
    return () => {
      window.removeEventListener('healix:open-care-chat', handleOpenChat)
      window.removeEventListener('ai-health-care:open-assistant', handleOpenChat)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  useEffect(() => {
    const viewport = messagesViewportRef.current
    if (!viewport || !isOpen) return
    requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight
    })
  }, [isOpen, messages])

  useEffect(() => {
    const footer = document.getElementById('site-footer')
    if (!footer || typeof IntersectionObserver === 'undefined') {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some((entry) => entry.isIntersecting)
        setLiftedFromFooter(isVisible)
      },
      {
        threshold: 0.05,
      }
    )

    observer.observe(footer)
    return () => {
      observer.disconnect()
    }
  }, [])

  const createMessageId = (prefix: 'u' | 'a') => {
    const id = `${prefix}-${nextMessageIdRef.current}`
    nextMessageIdRef.current += 1
    return id
  }

  const sendMessage = () => {
    const text = input.trim()
    if (!text) return

    const userMessage: ChatMessage = {
      id: createMessageId('u'),
      sender: 'user',
      text,
    }
    const assistantMessage: ChatMessage = {
      id: createMessageId('a'),
      sender: 'assistant',
      text: buildReply(text, { isIdentified, userRole }),
    }
    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setInput('')
  }

  const sendPresetPrompt = (text: string) => {
    const userMessage: ChatMessage = {
      id: createMessageId('u'),
      sender: 'user',
      text,
    }
    const assistantMessage: ChatMessage = {
      id: createMessageId('a'),
      sender: 'assistant',
      text: buildReply(text, { isIdentified, userRole }),
    }
    setMessages((prev) => [...prev, userMessage, assistantMessage])
  }

  return (
    <div
      className={`fixed right-2 z-50 flex max-w-[calc(100vw-1rem)] flex-col items-end gap-2 transition-[bottom] duration-200 sm:right-4 sm:max-w-[calc(100vw-2rem)] ${
        liftedFromFooter ? 'bottom-20 sm:bottom-24' : 'bottom-3 sm:bottom-5'
      }`}
    >
      <div
        aria-hidden={!isOpen}
        className={`origin-bottom-right flex flex-col overflow-hidden rounded-[26px] border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] shadow-[var(--card-shadow)] backdrop-blur-xl transition-all duration-200 ${
          isOpen
            ? 'pointer-events-auto mb-1 h-[min(72vh,38.5rem)] w-[min(26rem,calc(100vw-1rem))] translate-y-0 opacity-100'
            : 'pointer-events-none h-0 w-0 translate-y-2 opacity-0'
        }`}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--card-border)] px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-accent-soft)] text-[color:var(--agent-accent)]">
              <RobotLogo className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[color:var(--agent-ink)]">AI Assistant</p>
              <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--agent-muted)]">
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.9)]" />
                Online
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-overlay)] px-3 py-1.5 text-xs font-semibold text-[color:var(--agent-muted)] transition hover:border-[color:var(--agent-line)] hover:bg-[color:var(--agent-overlay-strong)] hover:text-[color:var(--agent-ink)]"
          >
            Close
          </button>
        </div>

        <div
          ref={messagesViewportRef}
          className="flex-1 space-y-3 overflow-y-auto px-3.5 py-3.5 sm:px-4"
        >
          {messages.map((message) => (
            <article
              key={message.id}
              className={`max-w-[90%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[86%] ${
                message.sender === 'user'
                  ? 'ml-auto rounded-br-md bg-[linear-gradient(140deg,var(--agent-accent),var(--agent-accent-strong))] text-[color:var(--agent-on-accent)]'
                  : 'mr-auto rounded-bl-md border border-[color:var(--card-border)] bg-[color:var(--agent-overlay)] text-[color:var(--agent-ink)]'
              }`}
            >
              {message.text}
            </article>
          ))}
        </div>

        <div className="border-t border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] px-3.5 py-3.5">
          <div className="mb-3 flex flex-wrap gap-2">
            {quickSupportPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendPresetPrompt(prompt)}
                className="rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-overlay)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--agent-muted)] transition hover:border-[color:var(--agent-line)] hover:bg-[color:var(--agent-accent-soft)] hover:text-[color:var(--agent-ink)]"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="flex items-end gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Type your message..."
              className="min-w-0 flex-1 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] px-3.5 py-2.5 text-sm text-[color:var(--agent-ink)] placeholder:text-[color:var(--agent-muted-soft)] outline-none transition focus:border-[color:var(--agent-accent)] focus:ring-2 focus:ring-[color:var(--agent-accent-soft)]"
            />
            <button
              type="button"
              onClick={sendMessage}
              className="shrink-0 rounded-xl bg-[color:var(--agent-accent)] px-4 py-2.5 text-sm font-semibold text-[color:var(--agent-on-accent)] transition hover:bg-[color:var(--agent-accent-strong)]"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? 'Close AI chat' : 'Open AI chat'}
        className="group inline-flex h-14 w-14 items-center justify-center rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-[9px] text-[color:var(--agent-accent)] shadow-[var(--card-shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--card-shadow)] sm:h-[74px] sm:w-[74px] sm:p-[11px]"
      >
        <span className="grid h-full w-full place-items-center rounded-full bg-[color:var(--agent-accent-soft)] text-[color:var(--agent-accent)]">
          <RobotLogo className="h-6 w-6" />
        </span>
      </button>
    </div>
  )
}

export default GlobalAssistantChat

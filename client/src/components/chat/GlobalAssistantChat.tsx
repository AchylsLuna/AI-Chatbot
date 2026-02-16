import { useEffect, useRef, useState } from 'react'
import type { UserRole } from '../../types/triage'

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
  if (role === 'admin') return 'Admin / Doctor'
  if (role === 'nurse') return 'Nurse'
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
    'This system helps with AI-guided triage, appointment booking, appointment tracking, and role-based dashboards.',
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
    'Steps: 1) Open Book Appointment/Triage. 2) Enter symptoms in guided chat.',
    '3) Review recommendation and confidence. 4) Enter patient name and requested time.',
    '5) Submit booking, then check status in Appointments.',
    'For emergencies, contact local emergency services immediately.',
  ].join(' ')
}

const buildSystemGuideReply = (context: { isIdentified: boolean; userRole?: UserRole | null }) => {
  const roleHint = context.isIdentified
    ? `Current role: ${roleLabel(context.userRole)}.`
    : 'Guest mode supports guidance and navigation help.'

  return [
    roleHint,
    'System flow: Landing -> Login -> OTP -> Book Appointment -> Appointments.',
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
      'triage steps',
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

  if (normalized.includes('appointment') || normalized.includes('book') || normalized.includes('triage')) {
    return `${guestHint}Open Triage to book an appointment, then use Appointments to track status. Booking actions require login.`
  }
  if (normalized.includes('otp') || normalized.includes('code')) {
    return `${guestHint}Login uses OTP: enter email and password, then verify the 6-digit code.`
  }
  if (normalized.includes('admin')) {
    return `${guestHint}Admin Login supports Super Admin, Admin (Doctor), and Nurse accounts.`
  }
  if (normalized.includes('doctor') || normalized.includes('dashboard')) {
    return `${guestHint}Doctor's Dashboard is available for Nurse, Admin, and Super Admin after Admin Login.`
  }
  if (normalized.includes('login') || normalized.includes('register') || normalized.includes('sign up')) {
    return `${guestHint}Register first, then Login and verify OTP to access protected pages.`
  }

  return `${guestHint}${roleHint}I can introduce the system, explain booking requirements/steps, and guide navigation across appointments, triage, login/OTP, and dashboard modules.`
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
    return () => {
      window.removeEventListener('healix:open-care-chat', handleOpenChat)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
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
      className={`fixed right-5 z-50 flex flex-col items-end gap-3 transition-all ${
        liftedFromFooter ? 'bottom-24' : 'bottom-5'
      }`}
    >
      {isOpen && (
        <div className="flex h-[min(78vh,40rem)] w-[min(94vw,24rem)] flex-col overflow-hidden rounded-[30px] border border-white/15 bg-[linear-gradient(170deg,rgba(8,18,40,0.96),rgba(11,24,48,0.95))] shadow-[0_24px_60px_rgba(0,0,0,0.46)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-cyan-300/15 text-cyan-200">
                <RobotLogo className="h-4 w-4" />
              </span>
              AI Assistant
            </p>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-white/60 transition hover:text-white"
            >
              Close
            </button>
          </div>

          <div
            ref={messagesViewportRef}
            className="flex-1 space-y-3 overflow-y-auto px-3 py-3"
          >
            {messages.map((message) => (
              <article
                key={message.id}
                className={`max-w-[84%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  message.sender === 'user'
                    ? 'ml-auto rounded-br-md bg-[color:var(--agent-accent)] text-[color:var(--agent-on-accent)]'
                    : 'mr-auto rounded-bl-md border border-white/10 bg-white/10 text-white/85'
                }`}
              >
                {message.text}
              </article>
            ))}
          </div>

          <div className="border-t border-white/10 bg-[rgba(7,16,34,0.72)] px-3 py-3">
            <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
              {quickSupportPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendPresetPrompt(prompt)}
                  className="shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/75 transition hover:border-white/35 hover:text-white"
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
                className="flex-1 rounded-2xl border border-white/15 bg-[rgba(20,33,61,0.68)] px-4 py-3 text-sm text-white placeholder:text-white/45 outline-none transition focus:border-cyan-200/70 focus:ring-2 focus:ring-cyan-300/20"
              />
              <button
                type="button"
                onClick={sendMessage}
                className="rounded-2xl bg-[color:var(--agent-accent)] px-5 py-3 text-sm font-semibold text-[color:var(--agent-on-accent)] transition hover:bg-[color:var(--agent-accent-strong)]"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? 'Close AI chat' : 'Open AI chat'}
        className="group inline-flex h-[82px] w-[82px] items-center justify-center rounded-full bg-[radial-gradient(circle_at_32%_24%,rgba(19,46,88,0.68),rgba(8,18,40,0.95))] p-[12px] text-cyan-100 shadow-[0_16px_34px_rgba(12,28,56,0.58)] transition hover:-translate-y-0.5"
      >
        <span className="grid h-full w-full place-items-center rounded-full bg-[radial-gradient(circle_at_36%_28%,rgba(100,255,218,0.24),rgba(59,154,184,0.2)_52%,rgba(9,30,56,0.72)_100%)] text-cyan-200">
          <RobotLogo className="h-6 w-6" />
        </span>
      </button>
    </div>
  )
}

export default GlobalAssistantChat

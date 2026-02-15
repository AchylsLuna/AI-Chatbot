import { useEffect, useMemo, useRef, useState } from 'react'
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
  const nextMessageIdRef = useRef(1)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'seed',
      sender: 'assistant',
      text: buildIntroReply({ isIdentified, userRole }),
    },
  ])

  const latestMessages = useMemo(() => messages.slice(-8), [messages])

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
        <div className="w-[min(92vw,22rem)] rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-4 shadow-[0_20px_50px_rgba(10,20,38,0.35)] backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">AI Assistant</p>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-white/60 transition hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-3">
            {latestMessages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl px-3 py-2 text-xs ${
                  message.sender === 'user'
                    ? 'bg-[color:var(--agent-accent)] text-[color:var(--agent-on-accent)]'
                    : 'bg-white/10 text-white/80'
                } whitespace-pre-line`}
              >
                {message.text}
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {quickSupportPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendPresetPrompt(prompt)}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-white/75 transition hover:border-white/25 hover:text-white"
              >
                {prompt}
              </button>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
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
              placeholder="Ask anything..."
              className="agent-input flex-1"
            />
            <button type="button" onClick={sendMessage} className="agent-button">
              Send
            </button>
          </div>

        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="rounded-full bg-[color:var(--agent-accent)] px-5 py-3 text-sm font-semibold text-[color:var(--agent-on-accent)] shadow-[0_14px_30px_rgba(79,209,197,0.45)] transition hover:-translate-y-0.5 hover:bg-[color:var(--agent-accent-strong)]"
      >
        {isOpen ? 'Hide AI Chat' : 'AI Chat'}
      </button>
    </div>
  )
}

export default GlobalAssistantChat

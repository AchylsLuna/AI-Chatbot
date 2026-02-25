import { useEffect, useRef, useState } from 'react'
import type { UserRole } from '../../types'

type ChatMessage = {
  id: string
  sender: 'assistant' | 'user'
  text: string
  options?: { value: string; label: string }[]
  meta?: { mode?: 'triage' | 'gemini'; nodeId?: string; kind?: 'typing' }
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
  'Symptom Check (Decision Tree)',
]

const roleLabel = (role?: UserRole | null) => {
  if (role === 'system_admin') return 'Admin'
  if (role === 'admin') return 'Admin'
  if (role === 'nurse') return 'Doctor'
  if (role === 'user') return 'Patient'
  return 'Guest'
}

const buildIntroReply = (context: { isIdentified: boolean; userRole?: UserRole | null }) => {
  const identityLine = context.isIdentified
    ? `You are signed in as ${roleLabel(context.userRole)}.`
    : 'You can use this assistant even without signing in.'

  return [
    'Welcome to AI Health Care.',
    identityLine,
    'This system helps with appointment booking, appointment tracking, and role-based dashboards.',
    'You can also run a Symptom Check (Decision Tree) for quick triage guidance.',
  ].join(' ')
}

const GlobalAssistantChat = ({
  isIdentified = false,
  userRole = null,
}: GlobalAssistantChatProps) => {
  const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api').replace(/\/$/, '')
  const [isOpen, setIsOpen] = useState(false)
  const [liftedFromFooter, setLiftedFromFooter] = useState(false)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const messagesViewportRef = useRef<HTMLDivElement | null>(null)
  const nextMessageIdRef = useRef(1)

  const [mode, setMode] = useState<'gemini' | 'triage'>('gemini')
  const [triageNodeId, setTriageNodeId] = useState<string | null>(null)

  const [isTyping, setIsTyping] = useState(false)

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 'seed', sender: 'assistant', text: buildIntroReply({ isIdentified, userRole }) },
  ])

  const createMessageId = (prefix: 'u' | 'a') => {
    const id = `${prefix}-${nextMessageIdRef.current}`
    nextMessageIdRef.current += 1
    return id
  }

  // ---- typing bubble helpers ----
  const TYPING_ID = 'assistant-typing'

  const showTyping = (forMode: 'gemini' | 'triage') => {
    setIsTyping(true)
    setMessages((prev) => {
      // prevent duplicates
      if (prev.some((m) => m.id === TYPING_ID)) return prev
      return [
        ...prev,
        {
          id: TYPING_ID,
          sender: 'assistant',
          text: 'Typing…',
          meta: { mode: forMode, kind: 'typing' },
        },
      ]
    })
  }

  const hideTyping = () => {
    setIsTyping(false)
    setMessages((prev) => prev.filter((m) => m.id !== TYPING_ID))
  }

  const callGemini = async (prompt: string) => {
    const resp = await fetch(`${API_BASE}/debug/gemini-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, useDataset: true }),
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`)
    return data?.text ? String(data.text) : ''
  }

  const triageStart = async () => {
    const resp = await fetch(`${API_BASE}/triage/start`)
    const data = await resp.json()
    if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`)
    return data
  }

  const triageNext = async (nodeId: string, answer: string) => {
    const resp = await fetch(`${API_BASE}/triage/next`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId, answer }),
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data?.error || `HTTP ${resp.status}`)
    return data
  }

  // Optional: Replace intro with Gemini-generated intro (if it works)
  useEffect(() => {
    ;(async () => {
      try {
        showTyping('gemini')
        const intro = await callGemini(
          'Introduce the AI Health Care assistant. Explain that you can help navigate the system and assist with appointment booking. Avoid giving medical diagnoses.'
        )
        hideTyping()
        if (intro) setMessages([{ id: 'seed', sender: 'assistant', text: intro }])
      } catch {
        hideTyping()
        // keep fallback intro
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isIdentified, userRole])

  useEffect(() => {
    const handleOpenChat = () => {
      setIsOpen(true)
      requestAnimationFrame(() => inputRef.current?.focus())
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
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
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
    if (!footer || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => setLiftedFromFooter(entries.some((e) => e.isIntersecting)),
      { threshold: 0.05 }
    )
    observer.observe(footer)
    return () => observer.disconnect()
  }, [])

  const pushAssistantNode = (nodeId: string, node: any) => {
    setTriageNodeId(nodeId)
    setMessages((prev) => [
      ...prev,
      {
        id: createMessageId('a'),
        sender: 'assistant',
        text: node?.question || 'Choose an option:',
        options: Array.isArray(node?.options)
          ? node.options.map((o: any) => ({ value: o.value, label: o.label }))
          : [],
        meta: { mode: 'triage', nodeId },
      },
    ])
  }

  const startDecisionTree = async () => {
    setMode('triage')
    showTyping('triage')
    try {
      const data = await triageStart()
      hideTyping()
      pushAssistantNode(data.nodeId, data.node)
    } catch (err) {
      hideTyping()
      setMessages((prev) => [
        ...prev,
        { id: createMessageId('a'), sender: 'assistant', text: `Triage start error: ${(err as any)?.message || 'unknown error'}` },
      ])
    }
  }

  const exitDecisionTree = () => {
    setMode('gemini')
    setTriageNodeId(null)
    hideTyping()
    setMessages((prev) => [
      ...prev,
      { id: createMessageId('a'), sender: 'assistant', text: 'Exited Symptom Check. You can ask anything now.' },
    ])
  }

  const handleTriageAnswer = async (answer: string) => {
    if (!triageNodeId) {
      await startDecisionTree()
      return
    }

    // record user's selection
    setMessages((prev) => [
      ...prev,
      { id: createMessageId('u'), sender: 'user', text: answer },
    ])

    showTyping('triage')

    try {
      const data = await triageNext(triageNodeId, answer)
      hideTyping()

      if (data.done) {
        const title = data?.outcome?.title ? String(data.outcome.title) : 'Result'
        const text = data?.outcome?.text ? String(data.outcome.text) : ''
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId('a'),
            sender: 'assistant',
            text: `Decision Tree Result: ${title}\n\n${text}\n\nTip: You can type "exit" to leave symptom check, or continue chatting for booking help.`,
            meta: { mode: 'triage' },
          },
        ])
        setTriageNodeId(null)
        return
      }

      pushAssistantNode(data.nodeId, data.node)
    } catch (err: any) {
      hideTyping()
      setMessages((prev) => [
        ...prev,
        { id: createMessageId('a'), sender: 'assistant', text: `Triage error: ${err?.message || 'unknown error'}` },
      ])
    }
  }

  const sendMessage = () => {
    const text = input.trim()
    if (!text || isTyping) return
    setInput('')

    if (text.toLowerCase() === 'exit') {
      exitDecisionTree()
      return
    }

    // TRIAGE MODE
    if (mode === 'triage') {
      handleTriageAnswer(text)
      return
    }

    // GEMINI MODE
    const userMessage: ChatMessage = { id: createMessageId('u'), sender: 'user', text }
    setMessages((prev) => [...prev, userMessage])

    showTyping('gemini')

    ;(async () => {
      try {
        const reply = await callGemini(text)
        hideTyping()
        setMessages((prev) => [
          ...prev,
          { id: createMessageId('a'), sender: 'assistant', text: reply || '…' },
        ])
      } catch (err: any) {
        hideTyping()
        setMessages((prev) => [
          ...prev,
          { id: createMessageId('a'), sender: 'assistant', text: `Gemini error: ${err?.message || 'unknown error'}` },
        ])
      }
    })()
  }

  const sendPresetPrompt = (text: string) => {
    if (isTyping) return

    if (text === 'Symptom Check (Decision Tree)') {
      startDecisionTree()
      return
    }

    setMessages((prev) => [...prev, { id: createMessageId('u'), sender: 'user', text }])

    showTyping('gemini')

    ;(async () => {
      try {
        const reply = await callGemini(text)
        hideTyping()
        setMessages((prev) => [
          ...prev,
          { id: createMessageId('a'), sender: 'assistant', text: reply || '…' },
        ])
      } catch (err: any) {
        hideTyping()
        setMessages((prev) => [
          ...prev,
          { id: createMessageId('a'), sender: 'assistant', text: `Gemini error: ${err?.message || 'unknown error'}` },
        ])
      }
    })()
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
                {isTyping ? 'Typing…' : mode === 'triage' ? 'Symptom Check' : 'Online'}
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

        <div ref={messagesViewportRef} className="flex-1 space-y-3 overflow-y-auto px-3.5 py-3.5 sm:px-4">
          {messages.map((message) => (
            <div key={message.id} className="space-y-2">
              <article
                className={`max-w-[90%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[86%] ${
                  message.sender === 'user'
                    ? 'ml-auto rounded-br-md bg-[linear-gradient(140deg,var(--agent-accent),var(--agent-accent-strong))] text-[color:var(--agent-on-accent)]'
                    : 'mr-auto rounded-bl-md border border-[color:var(--card-border)] bg-[color:var(--agent-overlay)] text-[color:var(--agent-ink)]'
                } ${message.meta?.kind === 'typing' ? 'opacity-80 italic' : ''}`}
              >
                {message.text}
              </article>

              {message.sender === 'assistant' &&
                message.options &&
                message.options.length > 0 &&
                mode === 'triage' &&
                message.meta?.kind !== 'typing' && (
                  <div className="mr-auto flex max-w-[90%] flex-wrap gap-2">
                    {message.options.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={isTyping}
                        onClick={() => handleTriageAnswer(opt.value)}
                        className="rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-overlay)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--agent-muted)] transition hover:border-[color:var(--agent-line)] hover:bg-[color:var(--agent-accent-soft)] hover:text-[color:var(--agent-ink)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          ))}
        </div>

        <div className="border-t border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] px-3.5 py-3.5">
          <div className="mb-3 flex flex-wrap gap-2">
            {quickSupportPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={isTyping}
                onClick={() => sendPresetPrompt(prompt)}
                className="rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-overlay)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--agent-muted)] transition hover:border-[color:var(--agent-line)] hover:bg-[color:var(--agent-accent-soft)] hover:text-[color:var(--agent-ink)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {prompt}
              </button>
            ))}

            {mode === 'triage' && (
              <button
                type="button"
                disabled={isTyping}
                onClick={exitDecisionTree}
                className="rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-overlay)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--agent-muted)] transition hover:border-[color:var(--agent-line)] hover:bg-[color:var(--agent-accent-soft)] hover:text-[color:var(--agent-ink)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Exit Symptom Check
              </button>
            )}
          </div>

          <div className="flex items-end gap-2">
            <input
              ref={inputRef}
              value={input}
              disabled={isTyping}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  sendMessage()
                }
              }}
              placeholder={
                mode === 'triage'
                  ? 'Type option value or press buttons… (type "exit" to leave)'
                  : 'Type your message...'
              }
              className="min-w-0 flex-1 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] px-3.5 py-2.5 text-sm text-[color:var(--agent-ink)] placeholder:text-[color:var(--agent-muted-soft)] outline-none transition focus:border-[color:var(--agent-accent)] focus:ring-2 focus:ring-[color:var(--agent-accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              disabled={isTyping}
              onClick={sendMessage}
              className="shrink-0 rounded-xl bg-[color:var(--agent-accent)] px-4 py-2.5 text-sm font-semibold text-[color:var(--agent-on-accent)] transition hover:bg-[color:var(--agent-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isTyping ? 'Sending…' : 'Send'}
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
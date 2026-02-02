import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import type { Reservation, ReservationDraft, TriageSummary } from '../types/triage'

const quickPrompts = [
  'How long have these symptoms been present?',
  'Any fever, chest pain, or dizziness to note?',
  'Thanks. I will summarize this for nurse review.',
]

const techStack = [
  'AI Platform: NLP triage engine and advice-only logic',
  'Web Platform: React, TypeScript, Tailwind CSS, Node.js, Express.js, REST API, MongoDB',
  'Blockchain Platform: Ethereum smart contracts and immutable ledger',
]

type Message = {
  id: string
  sender: 'ai' | 'user'
  text: string
}

type TriagePageProps = {
  onCreateReservation: (draft: ReservationDraft) => void
  latestReservation?: Reservation
}

const inferDepartment = (
  text: string
): Pick<TriageSummary, 'department' | 'priority' | 'confidence'> => {
  const content = text.toLowerCase()
  if (content.match(/chest|breath|palpitation|cardio/)) {
    return { department: 'Cardiology', priority: 'Routine', confidence: 0.78 }
  }
  if (content.match(/rash|skin|itch/)) {
    return { department: 'Dermatology', priority: 'Low', confidence: 0.74 }
  }
  if (content.match(/stomach|abdominal|nausea|vomit/)) {
    return { department: 'Gastroenterology', priority: 'Routine', confidence: 0.71 }
  }
  if (content.match(/headache|migraine|dizzy|neuro/)) {
    return { department: 'Neurology', priority: 'Routine', confidence: 0.7 }
  }
  if (content.match(/injury|sprain|fracture|bone|joint/)) {
    return { department: 'Orthopedics', priority: 'Routine', confidence: 0.69 }
  }
  if (content.match(/fever|flu|cough|sore throat/)) {
    return { department: 'General Medicine', priority: 'Routine', confidence: 0.66 }
  }
  return { department: 'General Medicine', priority: 'Low', confidence: 0.62 }
}

const formatConfidence = (value: number) => `${Math.round(value * 100)}%`

const buildFallbackSummary = (symptomsText: string): TriageSummary => {
  const { department, priority, confidence } = inferDepartment(symptomsText)
  const cleanedSymptoms = symptomsText.trim()
  return {
    department,
    priority,
    confidence,
    summary: cleanedSymptoms
      ? `Route to ${department} with ${priority.toLowerCase()} priority based on reported symptoms.`
      : 'No symptoms provided yet.',
    symptoms: cleanedSymptoms || 'No symptoms provided yet.',
    source: 'rules',
  }
}

const TriagePage = ({ onCreateReservation, latestReservation }: TriagePageProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'intro',
      sender: 'ai',
      text: 'Hello! I will guide you through a few questions to understand your symptoms. This is advice only and not a diagnosis.',
    },
  ])
  const [input, setInput] = useState('')
  const [promptIndex, setPromptIndex] = useState(0)
  const [patientName, setPatientName] = useState('')
  const [requestedTime, setRequestedTime] = useState('')
  const [aiSummary, setAiSummary] = useState<TriageSummary | null>(null)
  const [isSummaryLoading, setIsSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const symptomsText = useMemo(() => {
    return messages
      .filter((message) => message.sender === 'user')
      .map((message) => message.text)
      .join(' ')
      .trim()
  }, [messages])

  const fallbackSummary = useMemo(() => buildFallbackSummary(symptomsText), [symptomsText])
  const summary = aiSummary ?? fallbackSummary

  const canGenerateSummary = symptomsText.length > 0

  useEffect(() => {
    if (!symptomsText.trim()) {
      setAiSummary(null)
      setSummaryError(null)
      setIsSummaryLoading(false)
      return
    }

    let isActive = true
    const controller = new AbortController()
    setIsSummaryLoading(true)
    setSummaryError(null)

    const timeoutId = window.setTimeout(async () => {
      try {
        const generated = await api.generateTriageSummary(symptomsText, controller.signal)
        if (!isActive) return
        setAiSummary(generated)
      } catch (error) {
        if (!isActive) return
        if (error instanceof DOMException && error.name === 'AbortError') return
        setSummaryError('Live AI summary unavailable. Showing rule-based fallback.')
        setAiSummary(null)
      } finally {
        if (isActive) setIsSummaryLoading(false)
      }
    }, 500)

    return () => {
      isActive = false
      controller.abort()
      window.clearTimeout(timeoutId)
    }
  }, [symptomsText])

  const handleSend = () => {
    if (!input.trim()) return
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: input.trim(),
    }
    const aiMessage: Message = {
      id: `ai-${Date.now() + 1}`,
      sender: 'ai',
      text: quickPrompts[Math.min(promptIndex, quickPrompts.length - 1)],
    }
    setMessages((prev) => [...prev, userMessage, aiMessage])
    setInput('')
    setPromptIndex((prev) => prev + 1)
  }

  const handleCreateReservation = () => {
    if (!patientName.trim() || !requestedTime.trim() || !canGenerateSummary) return
    onCreateReservation({
      patientName: patientName.trim(),
      requestedTime,
      symptoms: summary.symptoms,
      summary,
    })
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4" data-reveal>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
              AI guidance layer
            </p>
            <h1 className="text-3xl font-display font-semibold text-white">Guided triage intake</h1>
            <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
              Advice-only guidance. A nurse will confirm before any appointment is finalized.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70">
            Outpatient triage
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div
            className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
            data-reveal
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Guided inquiry</h2>
                <p className="text-xs text-white/60">Structured questions to avoid self-diagnosis</p>
              </div>
              <span className="rounded-full border border-amber-400/30 bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-200">
                Advice only
              </span>
            </div>

            <div className="mt-4 h-[360px] space-y-3 overflow-y-auto rounded-2xl border border-white/10 bg-[color:var(--agent-surface-strong)] p-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      message.sender === 'user'
                        ? 'bg-[color:var(--agent-accent)] text-[color:var(--agent-on-accent)]'
                        : 'bg-white/10 text-white/80'
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Describe symptoms, duration, and context"
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
              />
              <button
                onClick={handleSend}
                className="rounded-2xl bg-[color:var(--agent-accent)] px-4 py-3 text-sm font-semibold text-[color:var(--agent-on-accent)] transition hover:-translate-y-0.5"
              >
                Send
              </button>
            </div>
            <p className="mt-3 text-xs text-white/50">
              The AI provides guidance only. For emergencies, contact local services.
            </p>
          </div>

          <div className="space-y-6">
            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <h3 className="text-lg font-semibold text-white">AI triage summary</h3>
              <p className="mt-2 text-xs text-white/60">
                Generated from the guided inquiry. Final decisions are made by a nurse.
              </p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wider text-white/60">Recommended department</p>
                <p className="mt-2 text-lg font-semibold text-white">{summary.department}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-white/60">
                  <span>Priority: {summary.priority}</span>
                  <span>Confidence: {formatConfidence(summary.confidence)}</span>
                </div>
                <p className="mt-3 text-sm text-[color:var(--agent-muted)]">{summary.summary}</p>
                <p className="mt-2 text-xs text-white/50">{summary.symptoms}</p>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-emerald-200">
                  {isSummaryLoading ? 'Generating live AI summary...' : 'Advice-only logic applied'}
                </span>
                {summary.source === 'ai' && !isSummaryLoading && (
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2 py-1 text-[10px] font-semibold text-emerald-200">
                    Live AI
                  </span>
                )}
                {summary.source !== 'ai' && !isSummaryLoading && (
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/15 px-2 py-1 text-[10px] font-semibold text-amber-200">
                    Rule-based
                  </span>
                )}
              </div>
              {summaryError && (
                <p className="mt-2 text-xs font-semibold text-rose-300">{summaryError}</p>
              )}
            </div>

            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <h3 className="text-lg font-semibold text-white">Create reservation</h3>
              <p className="mt-2 text-xs text-white/60">
                Reservations are provisional until a nurse approves them.
              </p>
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    Patient name
                  </label>
                  <input
                    value={patientName}
                    onChange={(event) => setPatientName(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                    placeholder="Jordan Lee"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-white/60">
                    Requested time
                  </label>
                  <input
                    value={requestedTime}
                    onChange={(event) => setRequestedTime(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none"
                    placeholder="2:30 PM"
                  />
                </div>
                <button
                  onClick={handleCreateReservation}
                  disabled={!canGenerateSummary || !patientName.trim() || !requestedTime.trim()}
                  className="w-full rounded-2xl bg-[color:var(--agent-accent)] px-4 py-3 text-sm font-semibold text-[color:var(--agent-on-accent)] transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
                >
                  Submit reservation request
                </button>
              </div>
            </div>

            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <h3 className="text-lg font-semibold text-white">Status tracker</h3>
              <p className="mt-2 text-xs text-white/60">Live updates after submission.</p>
              <div className="mt-4 space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Reservation</span>
                  <span className="font-semibold text-white">
                    {latestReservation ? latestReservation.status : 'Not submitted'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {['Pending', 'Approved', 'Declined'].map((status) => (
                    <div
                      key={status}
                      className={`rounded-2xl border px-3 py-2 text-center font-semibold ${
                        latestReservation?.status === status
                          ? 'border-white/40 bg-white/10 text-white'
                          : 'border-white/10 text-white/50'
                      }`}
                    >
                      {status}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-white/50">
                  The nurse dashboard controls final approval. Approved reservations are written to
                  the blockchain ledger.
                </p>
              </div>
            </div>

            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <h3 className="text-lg font-semibold text-white">Tech stack</h3>
              <p className="mt-2 text-xs text-white/60">
                Core tools used across AI, web, and blockchain platforms.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-[color:var(--agent-muted)]">
                {techStack.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[color:var(--agent-accent)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TriagePage

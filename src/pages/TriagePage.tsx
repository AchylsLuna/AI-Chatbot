import { useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import { decisionTreeTriage } from '../utils/decisionTree'
import type { Reservation, ReservationDraft, TriageSummary } from '../types/triage'

const quickPrompts = [
  'How long have these symptoms been present?',
  'Any fever, chest pain, or dizziness to note?',
  'Thanks. I will summarize this for your booking.',
]

const techStack = [
  'Decision Tree Platform: MedQuad-informed triage model',
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
  variant?: 'full' | 'embedded'
}

const formatConfidence = (value: number) => `${Math.round(value * 100)}%`
const DISCLAIMER =
  'This recommendation is guidance only. Not a medical diagnosis. For emergencies, contact local services.'

const buildFallbackSummary = (symptomsText: string): TriageSummary => {
  const decision = decisionTreeTriage(symptomsText)
  const cleanedSymptoms = symptomsText.trim()
  const keywordHint = decision.matchedKeywords.length
    ? ` based on ${decision.matchedKeywords.slice(0, 3).join(', ')}`
    : ''
  return {
    department: decision.department,
    priority: decision.priority,
    confidence: decision.confidence,
    summary: cleanedSymptoms
      ? `Decision Tree (MedQuad-informed) recommends ${decision.department}${keywordHint}.`
      : 'No symptoms provided yet.',
    symptoms: cleanedSymptoms || 'No symptoms provided yet.',
    disclaimer: DISCLAIMER,
    source: 'decision_tree',
  }
}

const TriagePage = ({
  onCreateReservation,
  latestReservation,
  variant = 'full',
}: TriagePageProps) => {
  const isEmbedded = variant === 'embedded'
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
  const [summaryLatency, setSummaryLatency] = useState<number | null>(null)
  const [isInputInvalid, setIsInputInvalid] = useState(false)

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
  const canBook = canGenerateSummary && !isInputInvalid

  useEffect(() => {
    if (!symptomsText.trim()) {
      setAiSummary(null)
      setSummaryError(null)
      setIsSummaryLoading(false)
      setSummaryLatency(null)
      setIsInputInvalid(false)
      return
    }

    let isActive = true
    const controller = new AbortController()
    setIsSummaryLoading(true)
    setSummaryError(null)
    setSummaryLatency(null)
    setIsInputInvalid(false)

    const timeoutId = window.setTimeout(async () => {
      try {
        const { summary: generated, elapsedMs } = await api.generateTriageSummary(
          symptomsText,
          controller.signal
        )
        if (!isActive) return
        setAiSummary(generated)
        setSummaryLatency(elapsedMs)
      } catch (error) {
        if (!isActive) return
        if (error instanceof DOMException && error.name === 'AbortError') return
        const message = error instanceof Error ? error.message : 'Unable to generate a summary.'
        const invalidInput = message.toLowerCase().includes('symptom')
        setIsInputInvalid(invalidInput)
        setSummaryError(
          invalidInput
            ? message
            : 'Live AI summary unavailable. Showing Decision Tree fallback.'
        )
        if (invalidInput) {
          setAiSummary(null)
          setSummaryLatency(null)
        }
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
    if (!patientName.trim() || !requestedTime.trim() || !canBook) return
    onCreateReservation({
      patientName: patientName.trim(),
      requestedTime,
      symptoms: summary.symptoms,
      summary,
    })
  }

  return (
    <div className={isEmbedded ? '' : 'min-h-screen'}>
      <div className={`w-full ${isEmbedded ? '' : 'mx-auto max-w-6xl px-6 py-10'}`}>
        {!isEmbedded && (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4" data-reveal>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">
                Decision Tree guidance layer
              </p>
              <h1 className="text-3xl font-display font-semibold text-white">
                Guided triage intake
              </h1>
              <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
                Advice-only guidance with free-text symptom input. Book appointments only after a
                recommendation is generated.
              </p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70">
              Direct booking
            </div>
          </div>
        )}

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
                placeholder="Enter free-text symptoms, duration, and context"
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
              The Decision Tree provides guidance only. For emergencies, contact local services.
            </p>
          </div>

          <div className="space-y-6">
            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <h3 className="text-lg font-semibold text-white">Decision Tree triage summary</h3>
              <p className="mt-2 text-xs text-white/60">
                Generated from the guided inquiry using a MedQuad-informed decision tree.
              </p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                {isInputInvalid ? (
                  <p className="text-sm text-white/60">
                    Enter clear symptoms to receive a department recommendation.
                  </p>
                ) : (
                  <>
                    <p className="text-xs uppercase tracking-wider text-white/60">
                      Recommended department
                    </p>
                    <p className="mt-2 text-lg font-semibold text-white">{summary.department}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-white/60">
                      <span>Priority: {summary.priority}</span>
                      <span>Confidence: {formatConfidence(summary.confidence)}</span>
                    </div>
                    <p className="mt-3 text-sm text-[color:var(--agent-muted)]">{summary.summary}</p>
                    <p className="mt-2 text-xs text-white/50">{summary.symptoms}</p>
                  </>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-emerald-200">
                  {isSummaryLoading
                    ? 'Generating decision tree recommendation...'
                    : 'Decision Tree (MedQuad) applied'}
                </span>
                {summaryLatency !== null && !isSummaryLoading && (
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold text-white/70">
                    {summaryLatency}ms
                  </span>
                )}
                {!isSummaryLoading && (
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold text-white/70">
                    Target response &lt; 5s
                  </span>
                )}
                {summary.source === 'ai' && !isSummaryLoading && (
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/15 px-2 py-1 text-[10px] font-semibold text-emerald-200">
                    AI-assisted summary
                  </span>
                )}
                {summary.source !== 'ai' && !isSummaryLoading && (
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/15 px-2 py-1 text-[10px] font-semibold text-amber-200">
                    Decision Tree
                  </span>
                )}
              </div>
              {summaryError && (
                <p className="mt-2 text-xs font-semibold text-rose-300">{summaryError}</p>
              )}
              {!isInputInvalid && (
                <p className="mt-2 text-xs text-white/50">{summary.disclaimer}</p>
              )}
            </div>

            <div
              className="rounded-3xl border border-white/10 bg-[color:var(--agent-surface)] p-6 shadow-2xl shadow-black/40"
              data-reveal
            >
              <h3 className="text-lg font-semibold text-white">Book appointment</h3>
              <p className="mt-2 text-xs text-white/60">
                Appointments are booked after a recommendation is generated.
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
                  disabled={!canBook || !patientName.trim() || !requestedTime.trim()}
                  className="w-full rounded-2xl bg-[color:var(--agent-accent)] px-4 py-3 text-sm font-semibold text-[color:var(--agent-on-accent)] transition enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40"
                >
                  Book appointment
                </button>
                {latestReservation && (
                  <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-200">
                    Latest booking: {latestReservation.id} · {latestReservation.department}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

export default TriagePage

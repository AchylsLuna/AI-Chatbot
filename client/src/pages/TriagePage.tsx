import { useEffect, useMemo, useState } from 'react'
import WorkspaceCanvas from '../components/layout/WorkspaceCanvas'
import WorkspaceSidebar from '../components/layout/WorkspaceSidebar'
import { api } from '../services/api'
import {
  workspaceFieldClass,
  workspaceHeadingTextClass,
  workspaceMutedTextClass,
  workspacePanelClass,
  workspacePanelSoftClass,
  workspacePrimaryButtonClass,
  workspaceSubtleTextClass,
} from '../styles/workspaceUi'
import type { AppPage } from '../types/navigation'
import { formatRoleLabel } from '../utils/roles'
import { decisionTreeTriage } from '../utils/decisionTree'
import type { Reservation, ReservationDraft, TriageSummary, UserRole } from '../types/triage'

const quickPrompts = [
  'How long have these symptoms been present?',
  'Any fever, chest pain, or dizziness to note?',
  'Thanks. I will summarize this for your booking.',
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
  onNavigate?: (page: AppPage) => void
  authRole?: UserRole | null
}

const formatConfidence = (value: number) => `${Math.round(value * 100)}%`
const DISCLAIMER =
  'This recommendation is guidance only. Not a medical diagnosis. For emergencies, contact local services.'

const panelClass = workspacePanelClass
const panelSoftClass = workspacePanelSoftClass
const headingTextClass = workspaceHeadingTextClass
const mutedTextClass = workspaceMutedTextClass
const subtleTextClass = workspaceSubtleTextClass
const fieldClass = workspaceFieldClass
const primaryButtonClass = workspacePrimaryButtonClass

const buildSidebarLinks = (
  role?: UserRole | null
): Array<{
  key: string
  label: string
  caption: string
  page: AppPage
  icon: 'home' | 'chart' | 'calendar' | 'settings' | 'shield' | 'user'
}> => {
  const links: Array<{
    key: string
    label: string
    caption: string
    page: AppPage
    icon: 'home' | 'chart' | 'calendar' | 'settings' | 'shield' | 'user'
  }> = [
    { key: 'landing', label: 'Home', page: 'landing', caption: 'Platform overview', icon: 'home' },
    { key: 'triage', label: 'Triage', page: 'triage', caption: 'Guided intake workspace', icon: 'chart' },
    {
      key: 'appointments',
      label: 'Appointments',
      page: 'appointments',
      caption: 'View booking status and details',
      icon: 'calendar',
    },
  ]

  if (role && role !== 'user') {
    links.push({
      key: 'dashboard',
      label: 'Dashboard',
      page: 'dashboard',
      caption: 'Operations monitoring',
      icon: 'chart',
    })
  }

  if (role === 'admin' || role === 'system_admin') {
    links.push({
      key: 'admin',
      label: 'Admin',
      page: 'admin',
      caption: 'Restricted controls',
      icon: 'settings',
    })
  } else {
    links.push({
      key: 'admin_login',
      label: 'Admin Login',
      page: 'admin_login',
      caption: 'Super admin, admin, and nurse access',
      icon: 'shield',
    })
  }

  links.push({
    key: 'login',
    label: 'Switch Account',
    page: 'login',
    caption: 'Sign in as another user',
    icon: 'user',
  })
  return links
}

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
  onNavigate,
  authRole = null,
}: TriagePageProps) => {
  const isEmbedded = variant === 'embedded'
  const sideBarLinks = buildSidebarLinks(authRole)
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

  const renderSidebar = (className: string) => (
    <WorkspaceSidebar
      className={className}
      brandTitle="AI Health Care"
      brandSubtitle="Workspace navigation"
      sectionLabel="Main navigation"
      items={sideBarLinks}
      activeKey="triage"
      onSelect={(key) => {
        const selected = sideBarLinks.find((item) => item.key === key)
        if (selected) onNavigate?.(selected.page)
      }}
      statusLabel="Intake mode"
      statusValue="Advice-only workflow active"
      profileLabel="Role"
      profileValue={formatRoleLabel(authRole)}
      profileCaption="Book after recommendation"
    />
  )

  const content = (
    <>
      {!isEmbedded && (
        <section className={`${panelClass} relative overflow-hidden p-6 sm:p-7`} data-reveal>
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] bg-[radial-gradient(circle_at_top,rgba(71,212,200,0.2),transparent_68%)] lg:block" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className={`text-xs uppercase tracking-[0.2em] ${subtleTextClass}`}>
                Decision Tree guidance layer
              </p>
              <h1 className={`mt-3 text-3xl font-semibold tracking-tight sm:text-4xl ${headingTextClass}`}>
                Guided triage intake
              </h1>
              <p className={`mt-3 max-w-3xl text-sm sm:text-base ${mutedTextClass}`}>
                Advice-only guidance with free-text symptom input. Book appointments only after a
                recommendation is generated.
              </p>
            </div>
            <div className="rounded-full border border-[rgba(120,139,198,0.35)] bg-[rgba(12,18,34,0.45)] px-4 py-2 text-xs font-semibold text-[#d5e1ff]">
              Direct booking
            </div>
          </div>
        </section>
      )}

      <div className={`${isEmbedded ? '' : 'mt-6 '}grid gap-6 lg:grid-cols-[1.1fr_0.9fr]`}>
        <div className={`${panelClass} p-6`} data-reveal>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-lg font-semibold ${headingTextClass}`}>Guided inquiry</h2>
              <p className={`text-xs ${subtleTextClass}`}>Structured questions to avoid self-diagnosis</p>
            </div>
            <span className="rounded-full border border-amber-400/30 bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-200">
              Advice only
            </span>
          </div>

          <div className={`mt-4 h-[360px] space-y-3 overflow-y-auto rounded-2xl ${panelSoftClass} p-4`}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    message.sender === 'user'
                      ? 'bg-[linear-gradient(135deg,#49d6c9,#41b8e6)] text-[#031922]'
                      : 'bg-[rgba(20,29,54,0.88)] text-[rgba(211,225,252,0.95)]'
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
              className={`${fieldClass} flex-1`}
            />
            <button onClick={handleSend} className={primaryButtonClass}>
              Send
            </button>
          </div>
          <p className={`mt-3 text-xs ${subtleTextClass}`}>
            The Decision Tree provides guidance only. For emergencies, contact local services.
          </p>
        </div>

        <div className="space-y-6">
          <div className={`${panelClass} p-6`} data-reveal>
            <h3 className={`text-lg font-semibold ${headingTextClass}`}>Decision Tree triage summary</h3>
            <p className={`mt-2 text-xs ${subtleTextClass}`}>
              Generated from the guided inquiry using a MedQuad-informed decision tree.
            </p>
            <div className={`mt-4 rounded-2xl ${panelSoftClass} p-4`}>
              {isInputInvalid ? (
                <p className={`text-sm ${mutedTextClass}`}>
                  Enter clear symptoms to receive a department recommendation.
                </p>
              ) : (
                <>
                  <p className={`text-xs uppercase tracking-wider ${subtleTextClass}`}>
                    Recommended department
                  </p>
                  <p className={`mt-2 text-lg font-semibold ${headingTextClass}`}>{summary.department}</p>
                  <div className={`mt-3 flex items-center justify-between text-xs ${mutedTextClass}`}>
                    <span>Priority: {summary.priority}</span>
                    <span>Confidence: {formatConfidence(summary.confidence)}</span>
                  </div>
                  <p className={`mt-3 text-sm ${mutedTextClass}`}>{summary.summary}</p>
                  <p className={`mt-2 text-xs ${subtleTextClass}`}>{summary.symptoms}</p>
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
                <span className="rounded-full border border-[rgba(120,139,198,0.35)] px-2 py-1 text-[10px] font-semibold text-[#d5e1ff]">
                  {summaryLatency}ms
                </span>
              )}
              {!isSummaryLoading && (
                <span className="rounded-full border border-[rgba(120,139,198,0.35)] px-2 py-1 text-[10px] font-semibold text-[#d5e1ff]">
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
              {summary.proof && !isSummaryLoading && (
                <span className="rounded-full border border-cyan-300/35 bg-cyan-300/15 px-2 py-1 text-[10px] font-semibold text-cyan-100">
                  Signed summary
                </span>
              )}
            </div>
            {summaryError && (
              <p className="mt-2 text-xs font-semibold text-rose-300">{summaryError}</p>
            )}
            {!isInputInvalid && <p className={`mt-2 text-xs ${subtleTextClass}`}>{summary.disclaimer}</p>}
          </div>

          <div className={`${panelClass} p-6`} data-reveal>
            <h3 className={`text-lg font-semibold ${headingTextClass}`}>Book appointment</h3>
            <p className={`mt-2 text-xs ${subtleTextClass}`}>
              Appointments are booked after a recommendation is generated.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className={`text-xs font-semibold uppercase tracking-wider ${subtleTextClass}`}>
                  Patient name
                </label>
                <input
                  value={patientName}
                  onChange={(event) => setPatientName(event.target.value)}
                  className={`${fieldClass} mt-2`}
                  placeholder="Jordan Lee"
                />
              </div>
              <div>
                <label className={`text-xs font-semibold uppercase tracking-wider ${subtleTextClass}`}>
                  Requested time
                </label>
                <input
                  value={requestedTime}
                  onChange={(event) => setRequestedTime(event.target.value)}
                  className={`${fieldClass} mt-2`}
                  placeholder="2:30 PM"
                />
              </div>
              <button
                onClick={handleCreateReservation}
                disabled={!canBook || !patientName.trim() || !requestedTime.trim()}
                className={`${primaryButtonClass} w-full disabled:cursor-not-allowed disabled:opacity-60`}
              >
                Book appointment
              </button>
              {latestReservation && (
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/12 px-4 py-3 text-xs font-semibold text-emerald-200">
                  Latest booking: {latestReservation.id} · {latestReservation.department}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )

  if (isEmbedded) {
    return <div>{content}</div>
  }

  return (
    <WorkspaceCanvas>
      <div className="mx-auto w-full px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
            {renderSidebar(
              'h-fit p-0 lg:rounded-l-none lg:border-l-0 lg:-ml-8 lg:w-[calc(17rem+2rem)]'
            )}
          </div>
          <div>{content}</div>
        </div>
      </div>
    </WorkspaceCanvas>
  )
}

export default TriagePage

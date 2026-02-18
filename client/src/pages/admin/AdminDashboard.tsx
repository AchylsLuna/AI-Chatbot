import { useMemo, useState } from 'react'
import { fallbackCareTeamRatings, type CareTeamRating } from '../../config/fallbackData'
import WorkspaceCanvas from '../../components/layout/WorkspaceCanvas'
import Sidebar, { type SidebarItem } from '../../components/layout/Sidebar'
import SidebarAccountCard from '../../components/layout/SidebarAccountCard'
import WorkspaceTopShell from '../../components/layout/WorkspaceTopShell'
import {
  workspaceGhostButtonClass,
  workspaceHeadingTextClass,
  workspaceMutedTextClass,
  workspacePanelClass,
  workspacePrimaryButtonClass,
  workspaceSubtleTextClass,
} from '../../styles/workspaceUi'
import type { AppPage } from '../../types/navigation'
import type { AuthSession, Reservation } from '../../types'
import { maskIdentifier, maskPersonName } from '../../utils/privacy'
import { getWorkspaceRoleLabel } from '../../utils/roles'

type AdminDashboardProps = {
  authUser: AuthSession['user'] | null
  reservations: Reservation[]
  onNavigate?: (page: AppPage) => void
  onLogout: () => void
  sessionStatus: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  dataMaskingEnabled: boolean
  onToggleDataMasking: () => void
}

type AdminSection = 'performance_dashboard' | 'history'

type AdminHistoryItem = {
  id: string
  actor: string
  type: 'Auth' | 'Reservation' | 'System'
  subject: string
  detail: string
  createdAt: string
  severity: 'Info' | 'Warning' | 'Critical'
}

type PerformanceCategoryKey = keyof CareTeamRating['categoryScores']

type PerformanceCategorySummary = {
  key: PerformanceCategoryKey
  label: string
  average: number
}

const performanceCategoryLabels: Array<{ key: PerformanceCategoryKey; label: string }> = [
  { key: 'communication', label: 'Communication' },
  { key: 'clinicalQuality', label: 'Clinical quality' },
  { key: 'timeliness', label: 'Timeliness' },
  { key: 'followUp', label: 'Follow-up' },
]

const distributionColors = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#22c55e']

const primaryItems: SidebarItem[] = [
  {
    key: 'performance_dashboard',
    label: 'Performance Dashboard',
    caption: 'Doctor and nurse rating analytics',
    icon: 'chart',
  },
  {
    key: 'history',
    label: 'History',
    caption: 'Recent privileged activity log',
    icon: 'report',
  },
]

const utilityItems: SidebarItem[] = [
  {
    key: 'doctor_dashboard',
    label: 'Appointment board',
    caption: 'Back to staff operations',
    icon: 'calendar',
  },
  {
    key: 'landing',
    label: 'Landing',
    caption: 'Public overview page',
    icon: 'home',
  },
]

const FALLBACK_HISTORY: AdminHistoryItem[] = [
  {
    id: 'HIS-901',
    actor: 'System',
    type: 'System',
    subject: 'Privilege audit',
    detail: 'Daily privileged access snapshot was generated.',
    createdAt: '2026-02-17T15:00:00.000Z',
    severity: 'Info',
  },
  {
    id: 'HIS-902',
    actor: 'Admin / Doctor',
    type: 'Reservation',
    subject: 'Booking queue',
    detail: 'Two booking records were marked for follow-up.',
    createdAt: '2026-02-16T10:25:00.000Z',
    severity: 'Warning',
  },
  {
    id: 'HIS-903',
    actor: 'Security',
    type: 'Auth',
    subject: 'Session policy',
    detail: 'Session policy checks passed with no elevated-risk findings.',
    createdAt: '2026-02-15T13:40:00.000Z',
    severity: 'Info',
  },
]

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const parseDate = (value: string) => {
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const formatDateTime = (value: string) => {
  const timestamp = parseDate(value)
  if (!timestamp) return 'Unknown'
  return new Date(timestamp).toLocaleString()
}

const formatRating = (value: number) => clampNumber(value, 0, 5).toFixed(1)

const historySeverityChipClass = (severity: AdminHistoryItem['severity']) => {
  if (severity === 'Critical') return 'border-rose-300/70 bg-rose-100 text-rose-700'
  if (severity === 'Warning') return 'border-amber-300/70 bg-amber-100 text-amber-700'
  return 'border-sky-300/70 bg-sky-100 text-sky-700'
}

const overallCareTeamRating = (item: CareTeamRating) => (item.doctorRating + item.nurseRating) / 2

const feedbackSummary = (rating: number) => {
  if (rating >= 4.7) return 'Excellent care-team feedback from patients and reviewers.'
  if (rating >= 4.3) return 'Strong feedback with minor opportunities for improvement.'
  if (rating >= 3.8) return 'Stable performance with targeted coaching opportunities.'
  return 'Performance requires active quality-improvement follow-up.'
}

const RatingStars = ({
  rating,
  size = 'sm',
}: {
  rating: number
  size?: 'sm' | 'md'
}) => {
  const activeStars = Math.round(clampNumber(rating, 0, 5))
  const iconSize = size === 'md' ? 'h-6 w-6' : 'h-4 w-4'

  return (
    <div className="flex items-center gap-1" aria-label={`${formatRating(rating)} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <svg
          key={`star-${index + 1}`}
          viewBox="0 0 20 20"
          className={`${iconSize} ${index < activeStars ? 'text-amber-400' : 'text-amber-200'}`}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="m10 1.5 2.5 5.1 5.6.8-4 3.9 1 5.5L10 14.2 5 16.8l1-5.5-4-3.9 5.6-.8z" />
        </svg>
      ))}
    </div>
  )
}

const AdminDashboard = ({
  authUser,
  reservations,
  onNavigate,
  onLogout,
  sessionStatus,
  theme,
  onToggleTheme,
  dataMaskingEnabled,
  onToggleDataMasking,
}: AdminDashboardProps) => {
  const [activeSection, setActiveSection] = useState<AdminSection>('performance_dashboard')
  const [searchQuery, setSearchQuery] = useState('')

  const historyItems = useMemo<AdminHistoryItem[]>(() => {
    const sortedReservations = [...reservations]
      .sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt))
      .slice(0, 12)

    const reservationEvents = sortedReservations.map((item) => {
      const patientLabel = dataMaskingEnabled ? maskPersonName(item.patientName) : item.patientName
      const appointmentId = dataMaskingEnabled ? maskIdentifier(item.id) : item.id
      const severity: AdminHistoryItem['severity'] =
        item.status === 'Failed' ? 'Critical' : item.status === 'Booked' ? 'Warning' : 'Info'

      return {
        id: `RES-EVT-${item.id}`,
        actor: 'Booking engine',
        type: 'Reservation' as const,
        subject: `${patientLabel} (${appointmentId})`,
        detail: `${item.department} reservation is now ${item.status.toLowerCase()} at ${item.requestedTime}.`,
        createdAt: item.createdAt,
        severity,
      }
    })

    const authEvent: AdminHistoryItem = {
      id: 'AUTH-SESSION',
      actor: authUser?.username ?? 'Unknown user',
      type: 'Auth',
      subject: `${getWorkspaceRoleLabel(authUser?.role)} workspace session`,
      detail: `Session status: ${sessionStatus}.`,
      createdAt: new Date().toISOString(),
      severity: 'Info',
    }

    const merged = reservationEvents.length > 0
      ? [authEvent, ...reservationEvents, ...FALLBACK_HISTORY]
      : [authEvent, ...FALLBACK_HISTORY]

    return merged
      .sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt))
      .slice(0, 20)
  }, [authUser, dataMaskingEnabled, reservations, sessionStatus])

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredPerformanceItems = useMemo(() => {
    if (!normalizedQuery) return fallbackCareTeamRatings
    return fallbackCareTeamRatings.filter((item) => {
      return (
        item.doctorName.toLowerCase().includes(normalizedQuery) ||
        item.nurseName.toLowerCase().includes(normalizedQuery) ||
        item.department.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [normalizedQuery])

  const filteredHistory = useMemo(() => {
    if (!normalizedQuery) return historyItems
    return historyItems.filter((item) => {
      return (
        item.actor.toLowerCase().includes(normalizedQuery) ||
        item.type.toLowerCase().includes(normalizedQuery) ||
        item.subject.toLowerCase().includes(normalizedQuery) ||
        item.detail.toLowerCase().includes(normalizedQuery) ||
        item.severity.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [historyItems, normalizedQuery])

  const performanceStats = useMemo(() => {
    const uniqueDoctors = new Set(filteredPerformanceItems.map((item) => item.doctorName))
    const totalResponses = filteredPerformanceItems.reduce((sum, item) => sum + item.responses, 0)

    const weightedRating = filteredPerformanceItems.reduce(
      (sum, item) => sum + overallCareTeamRating(item) * item.responses,
      0
    )

    const weightedResponseRate = filteredPerformanceItems.reduce(
      (sum, item) => sum + item.responseRate * item.responses,
      0
    )

    const averageRating = totalResponses > 0 ? weightedRating / totalResponses : 0
    const responseRate = totalResponses > 0 ? weightedResponseRate / totalResponses : 0

    return {
      averageRating,
      totalDoctors: uniqueDoctors.size,
      evaluations: totalResponses,
      responseRate,
    }
  }, [filteredPerformanceItems])

  const categorySummaries = useMemo<PerformanceCategorySummary[]>(() => {
    const totalResponses = filteredPerformanceItems.reduce((sum, item) => sum + item.responses, 0)

    return performanceCategoryLabels.map((entry) => {
      const weightedSum = filteredPerformanceItems.reduce(
        (sum, item) => sum + item.categoryScores[entry.key] * item.responses,
        0
      )

      return {
        key: entry.key,
        label: entry.label,
        average: totalResponses > 0 ? weightedSum / totalResponses : 0,
      }
    })
  }, [filteredPerformanceItems])

  const distributionCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]

    for (const item of filteredPerformanceItems) {
      const rounded = Math.round(overallCareTeamRating(item))
      const bucket = clampNumber(rounded, 1, 5)
      counts[bucket - 1] += item.responses
    }

    return counts
  }, [filteredPerformanceItems])

  const distributionPercentages = useMemo(() => {
    const total = distributionCounts.reduce((sum, count) => sum + count, 0)
    if (!total) return [0, 0, 0, 0, 0]
    return distributionCounts.map((count) => (count / total) * 100)
  }, [distributionCounts])

  const distributionGradient = useMemo(() => {
    const totalPercent = distributionPercentages.reduce((sum, value) => sum + value, 0)
    if (totalPercent <= 0) {
      return 'conic-gradient(rgba(148, 163, 184, 0.35) 0% 100%)'
    }

    let cursor = 0
    const stops = distributionPercentages.map((percentage, index) => {
      const start = cursor
      cursor += percentage
      return `${distributionColors[index]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`
    })

    return `conic-gradient(${stops.join(', ')})`
  }, [distributionPercentages])

  const historyMetrics = useMemo(() => {
    const mostRecentEventDay =
      historyItems.length > 0 ? new Date(historyItems[0].createdAt).toDateString() : null
    const eventsInLatestWindow = mostRecentEventDay
      ? historyItems.filter((item) => new Date(item.createdAt).toDateString() === mostRecentEventDay).length
      : 0
    const authEvents = historyItems.filter((item) => item.type === 'Auth').length
    const reservationEvents = historyItems.filter((item) => item.type === 'Reservation').length

    return [
      { key: 'history-total', label: 'Events', value: historyItems.length, caption: `${filteredHistory.length} matching` },
      { key: 'history-latest', label: 'Latest window', value: eventsInLatestWindow, caption: 'Most recent event day' },
      { key: 'history-auth', label: 'Auth events', value: authEvents, caption: 'Session and role access' },
      { key: 'history-res', label: 'Reservation events', value: reservationEvents, caption: 'Booking activity flow' },
    ]
  }, [filteredHistory.length, historyItems])

  const performanceMetrics = useMemo(() => {
    return [
      {
        key: 'performance-rating',
        label: 'Average rating',
        value: formatRating(performanceStats.averageRating),
        caption: 'Out of 5.0',
      },
      {
        key: 'performance-doctors',
        label: 'Total doctors',
        value: performanceStats.totalDoctors,
        caption: 'With active nurse assignment',
      },
      {
        key: 'performance-evaluations',
        label: 'Evaluations',
        value: performanceStats.evaluations,
        caption: 'Submitted patient responses',
      },
      {
        key: 'performance-response',
        label: 'Response rate',
        value: `${Math.round(performanceStats.responseRate)}%`,
        caption: 'Participation rate',
      },
    ]
  }, [performanceStats])

  const sectionMeta = {
    performance_dashboard: {
      title: 'Performance Dashboard',
      description:
        'Monitor doctor and assigned nurse performance using ratings, category trends, and response quality signals.',
      searchPlaceholder: 'Search by doctor, nurse, or department',
      metrics: performanceMetrics,
    },
    history: {
      title: 'History',
      description:
        'Review recent privileged activity across sessions, reservation operations, and system checks.',
      searchPlaceholder: 'Search history by actor, type, subject, or severity',
      metrics: historyMetrics,
    },
  } as const

  const activeMeta = sectionMeta[activeSection]

  return (
    <WorkspaceCanvas>
      <div className="mx-auto w-full max-w-[1500px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <div className="grid items-start gap-6 xl:grid-cols-[17.75rem_minmax(0,1fr)]">
          <Sidebar
            variant="dashboard"
            className="xl:self-start"
            heightMode="viewport"
            stickyOffset="header"
            brandTitle="AI Health Care"
            brandSubtitle="Admin workspace"
            onBrandClick={() => onNavigate?.('landing')}
            sectionLabel="Primary"
            items={primaryItems}
            activeKey={activeSection}
            onSelect={(key) => {
              if (key === 'performance_dashboard' || key === 'history') {
                setActiveSection(key)
              }
            }}
            auxiliaryLabel="Utilities"
            secondaryItems={utilityItems}
            supportItem={{ key: 'logout', label: 'Logout', icon: 'shield' }}
            onSelectAuxiliary={(key) => {
              if (key === 'logout') {
                onLogout()
                return
              }
              if (key === 'doctor_dashboard') {
                onNavigate?.('doctor_dashboard')
                return
              }
              if (key === 'landing') {
                onNavigate?.('landing')
              }
            }}
            profileExtra={
              <div className="space-y-2.5">
                <SidebarAccountCard
                  username={authUser?.username ?? 'Unknown'}
                  roleLabel={`${getWorkspaceRoleLabel(authUser?.role)} workspace`}
                  sessionStatus={sessionStatus}
                  theme={theme}
                  onToggleTheme={onToggleTheme}
                  dataMaskingEnabled={dataMaskingEnabled}
                  onToggleDataMasking={onToggleDataMasking}
                />
                <button
                  type="button"
                  className={`${workspaceGhostButtonClass} w-full`}
                  onClick={onLogout}
                >
                  Logout
                </button>
              </div>
            }
          />

          <section className="space-y-6">
            <WorkspaceTopShell
              eyebrow="Privileged session"
              title={activeMeta.title}
              description={activeMeta.description}
              searchValue={searchQuery}
              searchPlaceholder={activeMeta.searchPlaceholder}
              onSearchChange={setSearchQuery}
              quickActions={
                <>
                  <button
                    type="button"
                    className={workspacePrimaryButtonClass}
                    onClick={() => onNavigate?.('doctor_dashboard')}
                  >
                    Open appointment board
                  </button>
                  <button type="button" className={workspaceGhostButtonClass} onClick={onLogout}>
                    Logout
                  </button>
                </>
              }
              metrics={activeMeta.metrics}
            />

            {activeSection === 'performance_dashboard' ? (
              <section className="space-y-4">
                <article className={`${workspacePanelClass} p-5`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] px-3 py-1 text-xs font-semibold text-[color:var(--agent-muted)]">
                      CS403
                    </span>
                    <span className="rounded-full border border-emerald-300/70 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Active
                    </span>
                  </div>
                  <h2 className={`mt-3 text-3xl font-semibold tracking-tight ${workspaceHeadingTextClass}`}>
                    Care Team Quality Overview
                  </h2>
                  <p className={`mt-2 text-lg ${workspaceMutedTextClass}`}>Evaluation cycle 2026</p>
                </article>

                <article className="rounded-2xl border border-amber-300/60 bg-amber-50/70 p-5 shadow-[var(--card-shadow-soft)]">
                  <p className="text-lg font-semibold text-slate-700">Average Rating</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <RatingStars rating={performanceStats.averageRating} size="md" />
                    <p className="text-4xl font-semibold text-slate-900">
                      {formatRating(performanceStats.averageRating)}
                      <span className="ml-1 text-xl font-medium text-slate-600">/ 5.0</span>
                    </p>
                  </div>
                  <p className="mt-3 text-base text-slate-700">{feedbackSummary(performanceStats.averageRating)}</p>
                </article>

                <div className="grid gap-4 xl:grid-cols-2">
                  <article className={`${workspacePanelClass} p-5`}>
                    <h3 className={`text-2xl font-semibold ${workspaceHeadingTextClass}`}>Ratings by Category</h3>
                    <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                      Average scores across evaluation categories.
                    </p>

                    <div className="mt-4 space-y-3">
                      {categorySummaries.map((category) => (
                        <div key={category.key}>
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm font-semibold ${workspaceHeadingTextClass}`}>{category.label}</p>
                            <p className={`text-sm font-semibold ${workspaceHeadingTextClass}`}>
                              {formatRating(category.average)}
                            </p>
                          </div>
                          <div className="mt-1 h-2.5 rounded-full bg-[color:var(--agent-overlay-strong)]">
                            <div
                              className="h-2.5 rounded-full bg-sky-500"
                              style={{ width: `${(clampNumber(category.average, 0, 5) / 5) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className={`${workspacePanelClass} p-5`}>
                    <h3 className={`text-2xl font-semibold ${workspaceHeadingTextClass}`}>Rating Distribution</h3>
                    <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                      Breakdown of submitted care-team ratings.
                    </p>

                    <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
                      <div
                        className="mx-auto grid h-48 w-48 place-items-center rounded-full"
                        style={{ background: distributionGradient }}
                        role="img"
                        aria-label="Rating distribution chart"
                      >
                        <div className="grid h-24 w-24 place-items-center rounded-full border border-[color:var(--card-border)] bg-[color:var(--agent-surface)]">
                          <p className={`text-xl font-semibold ${workspaceHeadingTextClass}`}>
                            {formatRating(performanceStats.averageRating)}
                          </p>
                          <p className={`text-xs ${workspaceSubtleTextClass}`}>Average</p>
                        </div>
                      </div>

                      <ul className="space-y-2">
                        {[5, 4, 3, 2, 1].map((star) => {
                          const index = star - 1
                          const percentage = distributionPercentages[index]
                          const count = distributionCounts[index]
                          return (
                            <li key={`dist-${star}`} className="flex items-center justify-between gap-3">
                              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--agent-ink)]">
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: distributionColors[index] }}
                                  aria-hidden="true"
                                />
                                {star} star{star === 1 ? '' : 's'}
                              </span>
                              <span className={`text-sm ${workspaceMutedTextClass}`}>
                                {Math.round(percentage)}% ({count})
                              </span>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </article>
                </div>

                <article className={`${workspacePanelClass} p-5`}>
                  <h3 className={`text-2xl font-semibold ${workspaceHeadingTextClass}`}>
                    Doctor and Assigned Nurse Ratings
                  </h3>
                  <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                    Combined roster with department-level feedback, response counts, and quality ratings.
                  </p>

                  {filteredPerformanceItems.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-4">
                      <p className={`text-sm ${workspaceMutedTextClass}`}>
                        No doctor or nurse ratings match your search query.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full divide-y divide-[color:var(--card-border)] text-sm">
                        <thead>
                          <tr>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Doctor</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Assigned Nurse</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Department</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Doctor Rating</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Nurse Rating</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Responses</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Response Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[color:var(--card-border)]">
                          {filteredPerformanceItems.map((item) => {
                            const doctorLabel = dataMaskingEnabled ? maskPersonName(item.doctorName) : item.doctorName
                            const nurseLabel = dataMaskingEnabled ? maskPersonName(item.nurseName) : item.nurseName

                            return (
                              <tr key={item.id}>
                                <td className="px-3 py-3 align-top">
                                  <p className={`font-semibold ${workspaceHeadingTextClass}`}>{doctorLabel}</p>
                                </td>
                                <td className={`px-3 py-3 ${workspaceMutedTextClass}`}>{nurseLabel}</td>
                                <td className={`px-3 py-3 ${workspaceMutedTextClass}`}>{item.department}</td>
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-2">
                                    <RatingStars rating={item.doctorRating} />
                                    <span className={`text-sm font-semibold ${workspaceHeadingTextClass}`}>
                                      {formatRating(item.doctorRating)}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-2">
                                    <RatingStars rating={item.nurseRating} />
                                    <span className={`text-sm font-semibold ${workspaceHeadingTextClass}`}>
                                      {formatRating(item.nurseRating)}
                                    </span>
                                  </div>
                                </td>
                                <td className={`px-3 py-3 ${workspaceHeadingTextClass}`}>{item.responses}</td>
                                <td className={`px-3 py-3 ${workspaceHeadingTextClass}`}>{Math.round(item.responseRate)}%</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>
              </section>
            ) : null}

            {activeSection === 'history' ? (
              <section className="space-y-3">
                {filteredHistory.length === 0 ? (
                  <article className={`${workspacePanelClass} p-5`}>
                    <p className={`text-sm ${workspaceMutedTextClass}`}>
                      No history events match your search query.
                    </p>
                  </article>
                ) : (
                  filteredHistory.map((item) => (
                    <article key={item.id} className={`${workspacePanelClass} p-5`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>{item.type}</p>
                          <h2 className={`mt-1 text-base font-semibold ${workspaceHeadingTextClass}`}>{item.subject}</h2>
                          <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>{item.detail}</p>
                        </div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${historySeverityChipClass(item.severity)}`}>
                          {item.severity}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[color:var(--agent-muted-soft)]">
                        <span>Actor: {item.actor}</span>
                        <span>{formatDateTime(item.createdAt)}</span>
                      </div>
                    </article>
                  ))
                )}
              </section>
            ) : null}
          </section>
        </div>
      </div>
    </WorkspaceCanvas>
  )
}

export default AdminDashboard

import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import AppLogoBadge from '../components/branding/AppLogoBadge'
import WorkspaceCanvas from '../components/layout/WorkspaceCanvas'
import { api } from '../services/api'
import type { AppPage } from '../types/navigation'
import type { AuthSession, LedgerEntry, Reservation, UserRole } from '../types/triage'
import { canRevealIdentity, maskIdentifier, maskPersonName } from '../utils/privacy'

type DashboardPage =
  | 'dashboard'
  | 'analytics'
  | 'clinical_reports'
  | 'care_alerts'
  | 'care_support'
  | 'ledger_monitoring'
  | 'intake_monitoring'
  | 'security'
  | 'user_management'

type DashboardProps = {
  reservations: Reservation[]
  ledgerEntries: LedgerEntry[]
  authUser: AuthSession['user'] | null
  onLogout: () => void
  apiReady: boolean
  theme: 'light' | 'dark'
  onNavigate?: (page: AppPage) => void
  activePage: DashboardPage
}

type ContextMode = 'patient' | 'department' | 'research'

type VitalsCard = {
  id: string
  patient: string
  ward: string
  trend: number[]
  anomaly: boolean
}

type NavItem = {
  label: string
  hint: string
  page: DashboardPage
  icon: (props: { className?: string }) => ReactElement
  roles?: UserRole[]
}

const navItems: NavItem[] = [
  {
    label: 'Home',
    hint: 'Aggregated risk scores and critical alerts',
    page: 'dashboard',
    icon: HomeIcon,
  },
  {
    label: 'Diagnostics',
    hint: 'AI-assisted radiology and lab analysis',
    page: 'analytics',
    icon: DiagnosticsIcon,
  },
  {
    label: 'Predictive Analytics',
    hint: 'Heatmaps of predicted admissions/discharges',
    page: 'intake_monitoring',
    icon: PredictiveIcon,
  },
  {
    label: 'Patient Registry',
    hint: 'Secure EHR access controls',
    page: 'user_management',
    icon: RegistryIcon,
    roles: ['admin', 'system_admin'],
  },
  {
    label: 'Care AI Chat',
    hint: 'Query literature and case history',
    page: 'care_support',
    icon: ChatIcon,
  },
]

const pageDescription: Record<DashboardPage, string> = {
  dashboard: 'High-fidelity overview of active risk signals, interventions, and operational confidence.',
  analytics: 'Diagnostics performance and trendline quality from current cohorts.',
  clinical_reports: 'Clinical report stream with AI-assisted review checkpoints.',
  care_alerts: 'Critical notifications requiring immediate clinical response.',
  care_support: 'LLM support layer for medical literature and patient context.',
  ledger_monitoring: 'Audit and integrity stream for immutable care records.',
  intake_monitoring: 'Live prediction of admissions/discharges and bed pressure.',
  security: 'Identity and compliance posture with encryption controls.',
  user_management: 'Role-based access layer for registry and EHR permissions.',
}

const contextDescription: Record<ContextMode, string> = {
  patient: 'Patient View active: bedside-level clinical risk and intervention signals.',
  department: 'Departmental Analytics active: staffing pressure and throughput trends.',
  research: 'Predictive Research active: cohort signals and literature correlations.',
}

const toDoctorName = (username?: string | null) => {
  if (!username) return 'Elena Rivera'
  const base = username.includes('@') ? username.split('@')[0] : username
  const cleaned = base.replace(/[._-]+/g, ' ').trim()
  if (!cleaned) return 'Elena Rivera'
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const buildVitals = (reservations: Reservation[]): VitalsCard[] => {
  const source = [...reservations].slice(0, 4)
  if (source.length === 0) {
    return [
      {
        id: 'PT-401',
        patient: 'Patient #401',
        ward: 'Ward B',
        trend: [74, 73, 75, 76, 78, 80, 79, 82, 84, 83, 85, 86],
        anomaly: true,
      },
      {
        id: 'PT-291',
        patient: 'Patient #291',
        ward: 'Ward C',
        trend: [66, 67, 67, 68, 67, 68, 69, 69, 68, 69, 70, 70],
        anomaly: false,
      },
      {
        id: 'PT-176',
        patient: 'Patient #176',
        ward: 'Ward A',
        trend: [61, 62, 62, 63, 64, 63, 64, 65, 64, 65, 66, 66],
        anomaly: false,
      },
    ]
  }

  return source.map((reservation, index) => {
    const base = 62 + Math.round(reservation.confidence * 24) + index * 2
    const trend = Array.from({ length: 12 }, (_unused, offset) => {
      const wave = Math.sin((offset + 1) * (0.46 + index * 0.06)) * 3.8
      const drift = ((offset % 4) - 1.5) * 0.55
      return Math.round(base + wave + drift)
    })
    return {
      id: reservation.id,
      patient: reservation.patientName,
      ward: `Ward ${String.fromCharCode(66 + (index % 3))}`,
      trend,
      anomaly: reservation.priority === 'High' || trend[trend.length - 1] - trend[0] >= 7,
    }
  })
}

const Dashboard = ({
  reservations,
  ledgerEntries,
  authUser,
  onLogout,
  apiReady,
  theme,
  onNavigate,
  activePage,
}: DashboardProps) => {
  const [contextMode, setContextMode] = useState<ContextMode>('patient')
  const [showDeepData, setShowDeepData] = useState(false)
  const [showIdentity, setShowIdentity] = useState(false)
  const [approvedNudges, setApprovedNudges] = useState<string[]>([])
  const role = authUser?.role ?? null
  const canReveal = canRevealIdentity(role)

  const vitals = useMemo(() => buildVitals(reservations), [reservations])
  const visibleNavItems = useMemo(
    () => navItems.filter((item) => !item.roles || (role ? item.roles.includes(role) : false)),
    [role]
  )
  const selectedNav = visibleNavItems.find((item) => item.page === activePage)
  const doctorName = toDoctorName(authUser?.username)

  const riskCount = Math.max(3, vitals.filter((entry) => entry.anomaly).length)
  const occupancyNow = Math.min(96, 62 + reservations.length * 4)
  const occupancyForecast = Math.min(100, occupancyNow + 11)
  const efficacyRows = [
    { label: 'Sepsis', current: 68, best: 79 },
    { label: 'Cardiac', current: 74, best: 81 },
    { label: 'Pulmonary', current: 71, best: 78 },
    { label: 'Dermatology', current: 77, best: 82 },
  ]

  const openCareChat = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('healix:open-care-chat'))
    }
  }

  const logAlertAction = async (
    alertId: string,
    action: 'view' | 'dismiss' | 'approve' | 'open' | 'identity_reveal' | 'identity_hide',
    context?: string
  ) => {
    try {
      await api.logAiAlertAction(alertId, action, context)
    } catch (error) {
      console.warn('Unable to record AI alert audit action', error)
    }
  }

  const handleNav = (page: DashboardPage) => {
    void logAlertAction(`nav-${page}`, 'open', 'dashboard_navigation')
    onNavigate?.(page)
    if (page === 'care_support') {
      openCareChat()
    }
  }

  return (
    <WorkspaceCanvas
      className="bg-[#050c1f]"
      style={{
        fontFamily:
          '"SF Pro Display", "SF Pro Text", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div className="grid gap-4 px-3 pb-6 pt-4 sm:px-5 lg:grid-cols-[280px_minmax(0,1fr)_330px] lg:px-8">
        <aside className="relative overflow-hidden rounded-[30px] border border-[rgba(106,123,179,0.28)] bg-[linear-gradient(180deg,rgba(20,23,44,0.97),rgba(14,18,36,0.96))] p-4 shadow-[0_30px_70px_rgba(0,0,0,0.45)] lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] lg:self-start">
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-[radial-gradient(circle_at_center,rgba(90,215,255,0.28),transparent_72%)] blur-xl" />
          <div className="relative">
            <div className="rounded-[24px] border border-[rgba(141,166,226,0.25)] bg-[linear-gradient(150deg,rgba(30,33,58,0.96),rgba(17,20,39,0.95))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[rgba(194,210,248,0.45)] bg-[rgba(255,255,255,0.94)]">
                  <AppLogoBadge className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-lg font-semibold tracking-tight text-[#f3f7ff]">Healix</p>
                  <p className="text-xs text-[rgba(184,201,236,0.72)]">The Command Center</p>
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgba(157,176,217,0.76)]">
                Context Switcher
              </label>
              <select
                value={contextMode}
                onChange={(event) => setContextMode(event.target.value as ContextMode)}
                className="agent-select mt-2 bg-[rgba(10,22,47,0.72)]"
              >
                <option value="patient">Patient View</option>
                <option value="department">Departmental Analytics</option>
                <option value="research">Predictive Research</option>
              </select>
            </div>
          </div>

          <nav className="mt-5 space-y-2">
            {visibleNavItems.map((item) => {
              const active = item.page === activePage
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleNav(item.page)}
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                    active
                      ? 'border-[rgba(165,188,246,0.36)] bg-[rgba(255,255,255,0.08)] text-[#f7fbff] shadow-[0_12px_30px_rgba(0,0,0,0.26)]'
                      : 'border-transparent bg-transparent text-[rgba(171,188,224,0.74)] hover:border-[rgba(116,139,205,0.28)] hover:bg-[rgba(255,255,255,0.03)] hover:text-[#edf4ff]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 grid h-9 w-9 place-items-center rounded-xl border ${
                        active
                          ? 'border-[rgba(226,237,255,0.82)] bg-[rgba(255,255,255,0.94)] text-[#1a2140]'
                          : 'border-[rgba(113,133,190,0.32)] bg-[rgba(13,18,36,0.62)] text-[rgba(175,194,233,0.8)]'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="mt-1 text-xs text-[rgba(149,169,208,0.7)]">{item.hint}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </nav>

          <div className="mt-5 space-y-3 border-t border-[rgba(116,138,194,0.25)] pt-4">
            <div className="rounded-2xl border border-emerald-300/45 bg-emerald-300/12 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-emerald-200">
                Compliance Shield
              </p>
              <p className="mt-1 text-sm font-semibold text-emerald-100">
                {apiReady ? 'HIPAA/GDPR Active' : 'Compliance stream reconnecting'}
              </p>
            </div>
            <div className="rounded-2xl border border-[rgba(114,135,192,0.35)] bg-[rgba(10,15,30,0.55)] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[rgba(153,174,216,0.82)]">
                User Profile
              </p>
              <p className="mt-1 text-sm font-semibold text-[#ecf4ff]">Dr. {doctorName}</p>
              <p className="text-xs text-[rgba(153,174,216,0.82)]">Role: Chief Surgeon</p>
            </div>
          </div>
        </aside>

        <main className="space-y-4 pb-4">
          <header className="rounded-3xl border border-white/10 bg-[rgba(10,22,48,0.5)] p-5 backdrop-blur-xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
                  Intelligent Canvas
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-white">
                  {selectedNav?.label ?? 'AI Healthcare Dashboard'}
                </h1>
                <p className="mt-1 text-sm text-white/65">{pageDescription[activePage]}</p>
                <p className="mt-2 text-xs text-[#7ee8da]">{contextDescription[contextMode]}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/70">
                  {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                </span>
                <button type="button" onClick={onLogout} className="agent-button-ghost">
                  Logout
                </button>
              </div>
            </div>
          </header>

          <section className="relative overflow-hidden rounded-3xl border border-cyan-300/30 bg-[rgba(14,35,72,0.5)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="pointer-events-none absolute -right-10 -top-12 h-52 w-52 rounded-full bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.32),transparent_70%)] blur-2xl" />
            <div className="pointer-events-none absolute -left-16 bottom-[-70px] h-56 w-56 rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.25),transparent_72%)] blur-2xl" />

            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100/80">
              Risk Prediction
            </p>
            <h2 className="mt-2 max-w-4xl text-xl font-semibold leading-snug text-white sm:text-2xl">
              AI has identified {riskCount} patients in Ward B with a 75% rising risk of sepsis in
              the next 12 hours.
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeepData(true)
                  void logAlertAction('sepsis-ward-b', 'view', 'risk_banner_review')
                  onNavigate?.('user_management')
                }}
                className="agent-button"
              >
                Review Cases
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeepData((previous) => {
                    const next = !previous
                    void logAlertAction(
                      'progressive-disclosure',
                      next ? 'view' : 'dismiss',
                      'risk_details'
                    )
                    return next
                  })
                }}
                className="agent-button-ghost"
              >
                {showDeepData ? 'Hide Details' : 'Progressive Disclosure'}
              </button>
              {canReveal && (
                <button
                  type="button"
                  onClick={() => {
                    const next = !showIdentity
                    setShowIdentity(next)
                    void logAlertAction(
                      'patient-identity',
                      next ? 'identity_reveal' : 'identity_hide',
                      'dashboard_vitals'
                    )
                  }}
                  className="agent-button-ghost"
                >
                  {showIdentity ? 'Hide Identity' : 'View Identity'}
                </button>
              )}
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <article className="rounded-3xl border border-white/10 bg-[rgba(10,22,48,0.52)] p-5 backdrop-blur-xl">
              <h3 className="text-lg font-semibold text-white">Live Vitals</h3>
              <p className="mt-1 text-sm text-white/60">
                Minimalist trendlines for high-priority patients. Amber highlights indicate anomalies.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {vitals.map((card) => (
                  <div
                    key={card.id}
                    className={`rounded-2xl border p-3 ${
                      card.anomaly
                        ? 'border-amber-300/50 bg-amber-300/10'
                        : 'border-white/10 bg-[rgba(10,24,52,0.55)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {showIdentity ? card.patient : maskPersonName(card.patient)}
                        </p>
                        <p className="text-xs text-white/55">
                          {showIdentity ? card.id : maskIdentifier(card.id)} | {card.ward}
                        </p>
                      </div>
                      {card.anomaly && (
                        <span className="rounded-full border border-amber-300/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200">
                          alert
                        </span>
                      )}
                    </div>
                    <div className="mt-3 h-14">
                      <Sparkline points={card.trend} amber={card.anomaly} />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <div className="space-y-4">
              <article className="rounded-3xl border border-white/10 bg-[rgba(10,22,48,0.52)] p-5 backdrop-blur-xl">
                <h3 className="text-lg font-semibold text-white">Resource Optimization</h3>
                <p className="mt-1 text-sm text-white/60">
                  Capacity now vs AI-forecasted weekend occupancy.
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <div
                    className="grid h-28 w-28 place-items-center rounded-full border border-white/10"
                    style={{
                      background: `conic-gradient(#2dd4bf ${occupancyForecast}%, rgba(255,255,255,0.09) 0)`,
                    }}
                  >
                    <div className="grid h-20 w-20 place-items-center rounded-full bg-[#091933]">
                      <div className="text-center">
                        <p className="text-lg font-semibold text-white">{occupancyForecast}%</p>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-white/55">
                          forecast
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-white/65">
                    <p>
                      Current: <span className="font-semibold text-white">{occupancyNow}%</span>
                    </p>
                    <p className="mt-1">
                      Weekend uplift:{' '}
                      <span className="font-semibold text-amber-300">
                        +{Math.max(0, occupancyForecast - occupancyNow)}%
                      </span>
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-3xl border border-white/10 bg-[rgba(10,22,48,0.52)] p-5 backdrop-blur-xl">
                <h3 className="text-lg font-semibold text-white">Treatment Efficacy Map</h3>
                <div className="mt-3 space-y-3">
                  {efficacyRows.map((row) => (
                    <div key={row.label}>
                      <div className="mb-1 flex items-center justify-between text-xs text-white/65">
                        <span>{row.label}</span>
                        <span>
                          Current {row.current}% | Best {row.best}%
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-white/10">
                        <div
                          className="h-2.5 rounded-full bg-[linear-gradient(90deg,#2dd4bf,#38bdf8)]"
                          style={{ width: `${row.current}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>

          {showDeepData && (
            <section className="rounded-3xl border border-white/10 bg-[rgba(10,22,48,0.52)] p-5 backdrop-blur-xl">
              <h3 className="text-lg font-semibold text-white">Progressive Disclosure: Detailed Risk Table</h3>
              <p className="mt-1 text-sm text-white/60">
                Additional diagnostic context appears only when requested.
              </p>
              <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.12em] text-white/60">
                    <tr>
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3">Ward</th>
                      <th className="px-4 py-3">Latest Vital</th>
                      <th className="px-4 py-3">Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vitals.map((row) => (
                      <tr key={row.id} className="border-t border-white/10 text-white/85">
                        <td className="px-4 py-3">
                          {showIdentity ? row.patient : maskPersonName(row.patient)}
                        </td>
                        <td className="px-4 py-3">{row.ward}</td>
                        <td className="px-4 py-3">{row.trend[row.trend.length - 1]}</td>
                        <td className="px-4 py-3">
                          <span className={row.anomaly ? 'text-amber-300' : 'text-emerald-300'}>
                            {row.anomaly ? 'Anomalous trend' : 'Stable'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <footer className="rounded-3xl border border-white/10 bg-[rgba(9,20,43,0.64)] p-4 backdrop-blur-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
              Cybersecurity Encryption Badges
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge text="AES-256 Encrypted" />
              <Badge text="TLS 1.3 Secure Channel" />
              <Badge text="Zero-Trust Identity Gate" />
              <Badge text={`Audit Hash Locked (${ledgerEntries.length})`} />
            </div>
          </footer>
        </main>

        <aside className="rounded-3xl border border-white/10 bg-[rgba(8,18,41,0.58)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] lg:self-start">
          <h3 className="text-lg font-semibold text-white">AI Assistant</h3>
          <p className="mt-1 text-sm text-white/60">
            Agentic suggestions for immediate workflow acceleration.
          </p>

          <div className="mt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
              Actionable Nudges
            </p>
            {[
              {
                id: 'discharge-402',
                text: 'Drafting discharge papers for Patient #402 based on stable vitals...',
              },
              {
                id: 'handoff-102',
                text: 'Preparing sepsis escalation summary for Case #102 with trend deviation.',
              },
            ].map((nudge) => {
              const approved = approvedNudges.includes(nudge.id)
              return (
                <article
                  key={nudge.id}
                  className="rounded-2xl border border-white/10 bg-[rgba(10,23,48,0.58)] p-3"
                >
                  <p className="text-sm text-white/85">{nudge.text}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setApprovedNudges((previous) =>
                        previous.includes(nudge.id) ? previous : [...previous, nudge.id]
                      )
                      void logAlertAction(nudge.id, 'approve', 'assistant_nudge')
                    }}
                    className={`mt-3 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      approved
                        ? 'border border-emerald-300/40 bg-emerald-300/20 text-emerald-200'
                        : 'border border-white/20 bg-white/[0.04] text-white/80 hover:border-white/35'
                    }`}
                  >
                    {approved ? 'Approved' : 'Approve?'}
                  </button>
                </article>
              )
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-[rgba(10,23,48,0.58)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
              Literature Feed
            </p>
            <p className="mt-2 text-sm text-white/85">
              Recent study in The Lancet matches symptoms seen in Case #102.
            </p>
            <button
              type="button"
              onClick={() => {
                void logAlertAction('literature-feed-102', 'open', 'literature_feed')
                onNavigate?.('care_support')
                openCareChat()
              }}
              className="mt-3 agent-button-ghost"
            >
              View Abstract
            </button>
          </div>
        </aside>
      </div>
    </WorkspaceCanvas>
  )
}

const Sparkline = ({ points, amber = false }: { points: number[]; amber?: boolean }) => {
  const safePoints = points.length > 0 ? points : [0, 0]
  const max = Math.max(...safePoints)
  const min = Math.min(...safePoints)
  const span = max - min || 1
  const path = safePoints
    .map((value, index) => {
      const x = (index / Math.max(1, safePoints.length - 1)) * 100
      const y = 100 - ((value - min) / span) * 100
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <polyline
        fill="none"
        stroke={amber ? 'rgb(252 211 77)' : 'rgb(45 212 191)'}
        strokeWidth="3"
        points={path}
      />
    </svg>
  )
}

const Badge = ({ text }: { text: string }) => (
  <span className="rounded-full border border-cyan-200/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
    {text}
  </span>
)

function HomeIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M6 9.5V21h12V9.5" />
    </svg>
  )
}

function DiagnosticsIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16v16H4z" />
      <path d="M8 14h2l2-4 2 6 2-2h2" />
    </svg>
  )
}

function PredictiveIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19h16" />
      <path d="M6 15 10 11l3 2 5-6" />
      <path d="M18 7h-3" />
    </svg>
  )
}

function RegistryIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 3h12v18H6z" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
      <path d="M9 15h4" />
    </svg>
  )
}

function ChatIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5h16v10H8l-4 4z" />
      <path d="M8 9h8" />
      <path d="M8 12h5" />
    </svg>
  )
}

export default Dashboard

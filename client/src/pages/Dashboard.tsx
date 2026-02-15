import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import AppLogoBadge from '../components/branding/AppLogoBadge'
import type { AppPage } from '../types/navigation'
import type {
  AuthSession,
  LedgerEntry,
  Reservation,
  ReservationStatus,
} from '../types/triage'
import { formatRoleLabel } from '../utils/roles'

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

type IconProps = {
  className?: string
}

type SidebarLink = {
  label: string
  icon: (props: IconProps) => ReactElement
  page: DashboardPage
}

type ChartView = 'accepted' | 'recorded' | 'failed'

const sidebarLinks: SidebarLink[] = [
  { label: 'Overview', icon: GridIcon, page: 'dashboard' },
  { label: 'Analytics', icon: ChartIcon, page: 'analytics' },
  { label: 'Medical Reports', icon: ReportIcon, page: 'clinical_reports' },
  { label: 'Notifications', icon: BellIcon, page: 'care_alerts' },
  { label: 'Care Support', icon: SupportIcon, page: 'care_support' },
  { label: 'Ledger Monitoring', icon: WalletIcon, page: 'ledger_monitoring' },
  { label: 'Intake Monitoring', icon: ClipboardIcon, page: 'intake_monitoring' },
  { label: 'Security', icon: ShieldIcon, page: 'security' },
  { label: 'User Management', icon: UsersIcon, page: 'user_management' },
]

const pageDescription: Record<DashboardPage, string> = {
  dashboard: "Here's your health operations overview.",
  analytics: 'Trend signals for appointments and triage outcomes.',
  clinical_reports: 'Clinical reporting snapshots and department performance.',
  care_alerts: 'Escalated outcomes that need care-team attention.',
  care_support: 'Support modules and care workflow references.',
  ledger_monitoring: 'Immutable booking records and chain write status.',
  intake_monitoring: 'Recent intake records and triage decisions.',
  security: 'Compliance, posture, and identity control status.',
  user_management: 'Workspace role profile and account-level controls.',
}

const chartTabs: Array<{ key: ChartView; label: string }> = [
  { key: 'accepted', label: 'Booked' },
  { key: 'recorded', label: 'Recorded' },
  { key: 'failed', label: 'Failed' },
]

const weekLabels = [
  'Week 01',
  'Week 02',
  'Week 03',
  'Week 04',
  'Week 05',
  'Week 06',
  'Week 07',
  'Week 08',
  'Week 09',
  'Week 10',
]

const careModules = [
  'AI symptom triage engine',
  'Clinician scheduling orchestration',
  'FHIR-aligned patient data sync',
  'Blockchain-backed audit trail',
]

const chartWidth = 760
const chartHeight = 232

const shortenHash = (value: string) => {
  if (value.length <= 18) return value
  return `${value.slice(0, 10)}...${value.slice(-6)}`
}

const toDisplayName = (username?: string | null) => {
  if (!username) return 'Clinician'
  const base = username.includes('@') ? username.split('@')[0] : username
  const cleaned = base.replace(/[._-]+/g, ' ').trim()
  if (!cleaned) return 'Clinician'
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const formatWhen = (value?: string) => {
  if (!value) return 'Unknown time'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
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
  const [isSidebarCondensed, setIsSidebarCondensed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.scrollY > 70
  })
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [activeChart, setActiveChart] = useState<ChartView>('accepted')
  const [timeRange, setTimeRange] = useState('This Month')
  const userMenuRef = useRef<HTMLDivElement | null>(null)

  const isDark = theme === 'dark'

  const themeVars = (isDark
    ? {
        '--dash-bg': '#0a101b',
        '--dash-bg-glow-a': '#17263d',
        '--dash-bg-glow-b': '#1a2a40',
        '--dash-sidebar': '#0f1a2c',
        '--dash-card': '#111e31',
        '--dash-card-soft': '#17253b',
        '--dash-border': '#253a57',
        '--dash-text': '#e6eef9',
        '--dash-muted': '#9eb2cd',
        '--dash-muted-strong': '#bfd0e4',
        '--dash-sidebar-item': '#15243a',
        '--dash-sidebar-active': '#21416b',
        '--dash-sidebar-text': '#aac0dd',
        '--dash-sidebar-active-text': '#e4efff',
        '--dash-panel-shadow': '0 22px 50px rgba(0,0,0,0.45)',
        '--dash-soft-shadow': '0 14px 30px rgba(0,0,0,0.35)',
        '--dash-divider': '#223752',
        '--dash-chart-grid': '#253a56',
        '--dash-track': '#1e2f48',
        '--dash-avatar-bg': '#1d3354',
        '--dash-avatar-text': '#b8d1f1',
        '--dash-notify-bg': '#111e31',
        '--dash-notify-text': '#a7bdd8',
      }
    : {
        '--dash-bg': '#eef3fb',
        '--dash-bg-glow-a': '#d6e4fb',
        '--dash-bg-glow-b': '#e4eefc',
        '--dash-sidebar': '#f7fbff',
        '--dash-card': '#ffffff',
        '--dash-card-soft': '#f8fbff',
        '--dash-border': '#dce6f5',
        '--dash-text': '#122b51',
        '--dash-muted': '#647d9c',
        '--dash-muted-strong': '#4f6788',
        '--dash-sidebar-item': '#edf3fc',
        '--dash-sidebar-active': '#e8f0ff',
        '--dash-sidebar-text': '#5e7392',
        '--dash-sidebar-active-text': '#1d4f96',
        '--dash-panel-shadow': '0 20px 45px rgba(18,69,133,0.08)',
        '--dash-soft-shadow': '0 12px 28px rgba(19,68,131,0.08)',
        '--dash-divider': '#e8eef8',
        '--dash-chart-grid': '#e4ebf7',
        '--dash-track': '#e7ecf7',
        '--dash-avatar-bg': '#d9e7ff',
        '--dash-avatar-text': '#2455a0',
        '--dash-notify-bg': '#ffffff',
        '--dash-notify-text': '#627a9b',
      }) as CSSProperties

  const panelStyle: CSSProperties = {
    boxShadow: 'var(--dash-panel-shadow)',
  }

  const tileStyle: CSSProperties = {
    boxShadow: 'var(--dash-soft-shadow)',
  }

  const roleLabel = authUser ? formatRoleLabel(authUser.role) : 'No role assigned'
  const displayName = toDisplayName(authUser?.username)
  const userInitials = authUser?.username.slice(0, 2).toUpperCase() || 'NU'
  const canOpenAdmin = authUser?.role === 'admin' || authUser?.role === 'system_admin'

  const nowLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date()),
    []
  )

  const metrics = useMemo(() => {
    const booked = reservations.filter((reservation) => reservation.status === 'Booked').length
    const recorded = reservations.filter((reservation) => reservation.status === 'Recorded').length
    const failed = reservations.filter((reservation) => reservation.status === 'Failed').length
    const confirmedLedger = ledgerEntries.filter((entry) => entry.txStatus === 'confirmed').length

    const scoreBase = 74 + booked * 3 + recorded * 2 - failed * 2

    return {
      total: reservations.length,
      booked,
      recorded,
      failed,
      confirmedLedger,
      consultations: booked + recorded,
      healthScore: Math.min(96, Math.max(68, scoreBase)),
      complianceScore: reservations.length > 0 ? Math.min(100, 72 + reservations.length * 5) : 68,
    }
  }, [reservations, ledgerEntries])

  const vitals = useMemo(() => {
    const heartRate = 68 + (metrics.booked % 8)
    const systolic = 116 + Math.min(10, metrics.total)
    const diastolic = 76 + Math.min(8, Math.max(1, metrics.recorded))
    const weight = 72 + Math.min(8, metrics.total)
    const temperature = (36.5 + Math.min(0.6, metrics.failed * 0.05)).toFixed(1)

    return [
      { label: 'Heart Rate', value: `${heartRate}`, unit: 'bpm', icon: HeartIcon, state: 'Normal' },
      {
        label: 'Blood Pressure',
        value: `${systolic}/${diastolic}`,
        unit: 'mmHg',
        icon: PulseIcon,
        state: 'Normal',
      },
      { label: 'Weight', value: `${weight}`, unit: 'kg', icon: ScaleIcon, state: 'Normal' },
      {
        label: 'Temperature',
        value: `${temperature}`,
        unit: 'C',
        icon: ThermometerIcon,
        state: 'Normal',
      },
    ]
  }, [metrics.booked, metrics.failed, metrics.recorded, metrics.total])

  const upcomingAppointments = useMemo(
    () => reservations.filter((reservation) => reservation.status !== 'Failed').slice(0, 5),
    [reservations]
  )

  const recentReports = useMemo(() => {
    if (ledgerEntries.length > 0) {
      return ledgerEntries.slice(0, 5).map((entry) => ({
        id: entry.id,
        title: `${entry.department} Report`,
        subtitle: `${entry.patientName} • ${entry.timestamp}`,
        state: entry.txStatus === 'confirmed' ? 'Normal' : 'Review Required',
      }))
    }

    return reservations.slice(0, 5).map((reservation) => ({
      id: reservation.id,
      title: `${reservation.department} Intake Report`,
      subtitle: `${reservation.patientName} • ${formatWhen(reservation.createdAt)}`,
      state: reservation.status === 'Failed' ? 'Review Required' : 'Normal',
    }))
  }, [ledgerEntries, reservations])

  const failedReservations = useMemo(
    () => reservations.filter((reservation) => reservation.status === 'Failed').slice(0, 6),
    [reservations]
  )

  const intakeReservations = useMemo(() => reservations.slice(0, 8), [reservations])

  const topDepartments = useMemo(() => {
    const counts = new Map<string, number>()
    reservations.forEach((reservation) => {
      counts.set(reservation.department, (counts.get(reservation.department) ?? 0) + 1)
    })
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [reservations])

  const roleCapabilities = useMemo(() => {
    switch (authUser?.role) {
      case 'system_admin':
        return [
          'Manage system-wide permissions and policy rules.',
          'Review all triage, ledger, and compliance records.',
          'Configure security controls and onboarding guardrails.',
        ]
      case 'admin':
        return [
          'Approve operational access and role requests.',
          'Monitor intake, alerts, and ledger consistency.',
          'Coordinate clinical support and escalation handling.',
        ]
      case 'nurse':
        return [
          'Review triage outcomes and upcoming appointments.',
          'Track alerts requiring fast clinical follow-up.',
          'Use analytics and reports for day-to-day operations.',
        ]
      default:
        return [
          'Submit and monitor triage appointment requests.',
          'Review intake summaries and recommendations.',
          'Escalate issues through care support workflows.',
        ]
    }
  }, [authUser?.role])

  const chartSeries = useMemo(() => {
    const totalBoost = Math.min(10, metrics.total)
    const recordedBoost = Math.min(8, metrics.recorded)
    const failedBoost = Math.min(6, metrics.failed)

    return {
      accepted: [
        4 + Math.round(totalBoost * 0.2),
        6 + Math.round(totalBoost * 0.25),
        8 + Math.round(totalBoost * 0.35),
        11 + Math.round(totalBoost * 0.45),
        14 + Math.round(totalBoost * 0.55),
        18 + Math.round(totalBoost * 0.65),
        21 + Math.round(totalBoost * 0.75),
        20 + Math.round(totalBoost * 0.7),
        23 + Math.round(totalBoost * 0.8),
        27 + totalBoost,
      ],
      recorded: [
        3 + Math.round(recordedBoost * 0.2),
        4 + Math.round(recordedBoost * 0.25),
        6 + Math.round(recordedBoost * 0.35),
        8 + Math.round(recordedBoost * 0.45),
        10 + Math.round(recordedBoost * 0.55),
        12 + Math.round(recordedBoost * 0.65),
        15 + Math.round(recordedBoost * 0.75),
        14 + Math.round(recordedBoost * 0.7),
        17 + Math.round(recordedBoost * 0.8),
        20 + recordedBoost,
      ],
      failed: [
        1,
        1,
        2 + Math.round(failedBoost * 0.2),
        3 + Math.round(failedBoost * 0.3),
        4 + Math.round(failedBoost * 0.35),
        5 + Math.round(failedBoost * 0.4),
        6 + Math.round(failedBoost * 0.5),
        6 + Math.round(failedBoost * 0.45),
        7 + Math.round(failedBoost * 0.55),
        8 + failedBoost,
      ],
    }
  }, [metrics.failed, metrics.recorded, metrics.total])

  const activeSeries = chartSeries[activeChart]
  const chartMax = Math.max(...activeSeries, 1)
  const axisStep = Math.ceil(chartMax / 4)
  const axisMax = Math.max(4, axisStep * 4)
  const yTicks = [axisMax, axisMax - axisStep, axisMax - axisStep * 2, axisStep, 0]

  const plotPoints = useMemo(
    () =>
      activeSeries.map((value, index) => ({
        x: (index / (activeSeries.length - 1)) * chartWidth,
        y: chartHeight - (value / axisMax) * chartHeight,
        value,
      })),
    [activeSeries, axisMax]
  )

  const linePoints = plotPoints.map((point) => `${point.x},${point.y}`).join(' ')
  const areaPoints = `${linePoints} ${chartWidth},${chartHeight} 0,${chartHeight}`

  const statusStyles: Record<ReservationStatus, string> = isDark
    ? {
        Booked: 'bg-amber-500/20 text-amber-200',
        Recorded: 'bg-emerald-500/20 text-emerald-200',
        Failed: 'bg-rose-500/20 text-rose-200',
      }
    : {
        Booked: 'bg-amber-100 text-amber-700',
        Recorded: 'bg-emerald-100 text-emerald-700',
        Failed: 'bg-rose-100 text-rose-700',
      }

  const activeSidebarLabel =
    sidebarLinks.find((link) => link.page === activePage)?.label ?? 'Overview'

  const profileDialStyle: CSSProperties = {
    background: `conic-gradient(#4f46e5 ${metrics.complianceScore * 3.6}deg, var(--dash-track) 0deg)`,
  }

  useEffect(() => {
    if (!isUserMenuOpen) return

    const handleDocumentClick = (event: MouseEvent) => {
      if (!userMenuRef.current) return
      if (!userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isUserMenuOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleScroll = () => {
      const shouldCondense = window.scrollY > 70
      setIsSidebarCondensed((previous) => (previous === shouldCondense ? previous : shouldCondense))
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const renderOverview = () => {
    const overviewCards = [
      {
        title: 'Total Appointments',
        value: String(metrics.total),
        icon: CalendarIcon,
        iconTone: 'bg-[#2d6cb3]/15 text-[#2d6cb3]',
      },
      {
        title: 'Medical Reports',
        value: String(recentReports.length),
        icon: ReportIcon,
        iconTone: 'bg-[#3f6ed8]/15 text-[#3f6ed8]',
      },
      {
        title: 'Consultations',
        value: String(metrics.consultations),
        icon: VideoIcon,
        iconTone: 'bg-[#3bb4db]/15 text-[#2b9fc4]',
      },
      {
        title: 'Health Score',
        value: `${metrics.healthScore}%`,
        icon: PulseIcon,
        iconTone: 'bg-[#4f8fd4]/15 text-[#2d6cb3]',
      },
    ]

    return (
      <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card) => {
            const Icon = card.icon
            return (
              <article
                key={card.title}
                className="rounded-2xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card)] p-5"
                style={tileStyle}
              >
                <div className="flex items-center gap-4">
                  <span className={`grid h-14 w-14 place-items-center rounded-xl ${card.iconTone}`}>
                    <Icon className="h-7 w-7" />
                  </span>
                  <div>
                    <p className="text-4xl font-semibold leading-none text-[color:var(--dash-text)]">{card.value}</p>
                    <p className="mt-1 text-sm font-medium text-[color:var(--dash-muted)]">{card.title}</p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        <section
          className="mt-5 rounded-2xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card)] p-6"
          style={panelStyle}
        >
          <h2 className="text-2xl font-semibold text-[color:var(--dash-text)]">Health Metrics</h2>
          <div className="mt-4 grid gap-4 xl:grid-cols-4">
            {vitals.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  className="rounded-xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#4f8fd4]/12 text-[#2d6cb3]">
                      <Icon className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-[color:var(--dash-muted)]">{item.label}</p>
                      <p className="mt-1 text-4xl font-semibold leading-none text-[color:var(--dash-text)]">
                        {item.value}
                        <span className="ml-1 text-base font-medium text-[color:var(--dash-muted)]">{item.unit}</span>
                      </p>
                    </div>
                  </div>
                  <span className="mt-3 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    {item.state}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <section
            className="rounded-2xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card)] p-6"
            style={panelStyle}
          >
            <h2 className="text-2xl font-semibold text-[color:var(--dash-text)]">Upcoming Appointments</h2>
            {upcomingAppointments.length === 0 ? (
              <p className="mt-4 rounded-xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] p-4 text-sm text-[color:var(--dash-muted)]">
                No booked appointments yet. Create one from triage.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {upcomingAppointments.map((reservation) => (
                  <article
                    key={reservation.id}
                    className="rounded-xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-[color:var(--dash-text)]">{reservation.patientName}</p>
                        <p className="text-sm text-[color:var(--dash-muted)]">{reservation.department}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[reservation.status]}`}>
                        {reservation.status}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-sm text-[color:var(--dash-muted)]">
                      <ClockIcon className="h-4 w-4" />
                      <span>{reservation.requestedTime}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section
            className="rounded-2xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card)] p-6"
            style={panelStyle}
          >
            <h2 className="text-2xl font-semibold text-[color:var(--dash-text)]">Recent Reports</h2>
            {recentReports.length === 0 ? (
              <p className="mt-4 rounded-xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] p-4 text-sm text-[color:var(--dash-muted)]">
                No reports available yet.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {recentReports.map((report) => (
                  <article
                    key={report.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-10 w-10 place-items-center rounded-lg bg-[#4f8fd4]/12 text-[#2d6cb3]">
                        <ReportIcon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-lg font-semibold text-[color:var(--dash-text)]">{report.title}</p>
                        <p className="text-sm text-[color:var(--dash-muted)]">{report.subtitle}</p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        report.state === 'Normal'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {report.state}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </>
    )
  }

  const renderPlaceholder = (
    title: string,
    detail: string,
    icon: (props: IconProps) => ReactElement
  ) => {
    const Icon = icon

    return (
      <section
        className="rounded-2xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card)] p-8 text-center"
        style={panelStyle}
      >
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-2xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] text-[color:var(--dash-muted)]">
          <Icon className="h-10 w-10" />
        </div>
        <h2 className="mt-5 text-3xl font-semibold text-[color:var(--dash-text)]">{title}</h2>
        <p className="mt-2 text-base text-[color:var(--dash-muted)]">{detail}</p>
      </section>
    )
  }

  const renderModulePage = () => {
    switch (activePage) {
      case 'analytics':
        return (
          <section
            className="rounded-2xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card)] p-6"
            style={panelStyle}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-3xl font-semibold tracking-tight text-[color:var(--dash-text)]">
                  Care Flow Metrics
                </h2>
                <p className="mt-1 text-sm text-[color:var(--dash-muted)]">
                  Trend overview for booked, recorded, and failed appointment outcomes.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {chartTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveChart(tab.key)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      activeChart === tab.key
                        ? 'bg-[#4f46e5] text-[#f5f8ff] shadow-[0_8px_20px_rgba(79,70,229,0.35)]'
                        : 'border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] text-[color:var(--dash-muted)] hover:opacity-90'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                <select
                  value={timeRange}
                  onChange={(event) => setTimeRange(event.target.value)}
                  className="h-10 rounded-xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] px-3 text-sm font-semibold text-[color:var(--dash-muted)] outline-none"
                  aria-label="Select chart time range"
                >
                  <option>This Month</option>
                  <option>Last Month</option>
                  <option>Quarter</option>
                </select>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-[38px_1fr] gap-3">
              <div className="flex flex-col justify-between py-2 text-xs font-semibold text-[color:var(--dash-muted)]">
                {yTicks.map((tick) => (
                  <span key={tick}>{tick}</span>
                ))}
              </div>
              <div className="rounded-2xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] p-3">
                <div className="relative h-[232px]">
                  <div className="pointer-events-none absolute inset-0 grid grid-rows-4">
                    {[0, 1, 2, 3].map((line) => (
                      <div key={line} className="border-b border-dashed border-[color:var(--dash-chart-grid)]" />
                    ))}
                  </div>
                  <div className="pointer-events-none absolute inset-0 grid grid-cols-10">
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((line) => (
                      <div key={line} className="border-r border-dashed border-[color:var(--dash-chart-grid)]" />
                    ))}
                  </div>
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="relative h-full w-full"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="careFlowArea" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.24" />
                        <stop offset="100%" stopColor="#4f46e5" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <polygon points={areaPoints} fill="url(#careFlowArea)" />
                    <polyline
                      points={linePoints}
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    {plotPoints.map((point, index) => (
                      <circle
                        key={`${point.value}-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r="3.2"
                        fill="#4f46e5"
                        stroke={isDark ? '#111e31' : '#ffffff'}
                        strokeWidth="2"
                      />
                    ))}
                  </svg>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-10 text-[11px] font-semibold text-[color:var(--dash-muted)]">
              {weekLabels.map((label) => (
                <span key={label} className="text-center">
                  {label}
                </span>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-6 text-sm font-semibold text-[color:var(--dash-muted-strong)]">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#4f46e5]" />
                {metrics.booked} Booked
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#10b981]" />
                {metrics.recorded} Recorded
              </span>
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#ef4444]" />
                {metrics.failed} Failed
              </span>
            </div>
          </section>
        )

      case 'clinical_reports':
        return (
          <section
            className="rounded-2xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card)] p-6"
            style={panelStyle}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-3xl font-semibold text-[color:var(--dash-text)]">Clinical Reports</h2>
              <span className="rounded-full border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--dash-muted)]">
                {topDepartments.length} active departments
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <article className="rounded-xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--dash-muted)]">Booked rate</p>
                <p className="mt-2 text-3xl font-semibold text-[color:var(--dash-text)]">
                  {metrics.total ? Math.round((metrics.booked / metrics.total) * 100) : 0}%
                </p>
              </article>
              <article className="rounded-xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--dash-muted)]">Recorded rate</p>
                <p className="mt-2 text-3xl font-semibold text-[color:var(--dash-text)]">
                  {metrics.total ? Math.round((metrics.recorded / metrics.total) * 100) : 0}%
                </p>
              </article>
              <article className="rounded-xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[color:var(--dash-muted)]">Follow-up rate</p>
                <p className="mt-2 text-3xl font-semibold text-[color:var(--dash-text)]">
                  {metrics.total ? Math.round((metrics.failed / metrics.total) * 100) : 0}%
                </p>
              </article>
            </div>

            {topDepartments.length === 0 ? (
              <p className="mt-5 rounded-xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] p-4 text-sm text-[color:var(--dash-muted)]">
                No report data yet. Create appointments to generate clinical reports.
              </p>
            ) : (
              <div className="mt-5 space-y-2">
                {topDepartments.map(([department, count]) => (
                  <div
                    key={department}
                    className="flex items-center justify-between rounded-xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-[color:var(--dash-text)]">{department}</span>
                    <span className="font-semibold text-[color:var(--dash-muted-strong)]">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )

      case 'care_alerts':
        return (
          <section
            className="rounded-2xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card)] p-6"
            style={panelStyle}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-3xl font-semibold text-[color:var(--dash-text)]">Care Alerts</h2>
              <span className="text-sm font-semibold text-[color:var(--dash-muted)]">{failedReservations.length} active</span>
            </div>

            {failedReservations.length === 0 ? (
              <p className="mt-4 rounded-xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] p-4 text-sm text-[color:var(--dash-muted)]">
                No urgent alerts right now. Failed outcomes will appear here for follow-up.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {failedReservations.map((reservation) => (
                  <article
                    key={reservation.id}
                    className="rounded-xl border border-rose-300/30 bg-rose-500/10 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-lg font-semibold text-[color:var(--dash-text)]">{reservation.patientName}</p>
                      <span className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200">
                        Escalate
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[color:var(--dash-muted)]">
                      {reservation.department} • {reservation.requestedTime}
                    </p>
                    <p className="mt-2 text-sm text-[color:var(--dash-muted-strong)]">{reservation.summary}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )

      case 'care_support':
        return (
          <section
            className="rounded-2xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card)] p-6"
            style={panelStyle}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-3xl font-semibold text-[color:var(--dash-text)]">Care Support</h2>
              <span className="rounded-full border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--dash-muted)]">
                {careModules.length} modules
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {careModules.map((module) => (
                <article
                  key={module}
                  className="rounded-xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] p-4"
                >
                  <p className="text-base font-semibold text-[color:var(--dash-text)]">{module}</p>
                </article>
              ))}
            </div>
          </section>
        )

      case 'ledger_monitoring':
        return (
          <section
            className="rounded-2xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card)] p-6"
            style={panelStyle}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-3xl font-semibold text-[color:var(--dash-text)]">Ledger Monitoring</h2>
              <span className="text-sm font-semibold text-[color:var(--dash-muted)]">{ledgerEntries.length} entries</span>
            </div>
            {ledgerEntries.length === 0 ? (
              <p className="mt-4 rounded-xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] p-4 text-sm text-[color:var(--dash-muted)]">
                No ledger entries yet. Confirmed bookings will appear here.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {ledgerEntries.slice(0, 8).map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-lg font-semibold text-[color:var(--dash-text)]">{entry.patientName}</p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          entry.txStatus === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : entry.txStatus === 'failed'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {entry.txStatus ?? 'pending'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[color:var(--dash-muted)]">
                      {entry.department} • {entry.timestamp}
                    </p>
                    <p className="mt-2 font-mono text-xs text-[color:var(--dash-muted-strong)]" title={entry.hash}>
                      {shortenHash(entry.hash)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )

      case 'intake_monitoring':
        return (
          <section
            className="rounded-2xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card)] p-6"
            style={panelStyle}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-3xl font-semibold text-[color:var(--dash-text)]">Intake Monitoring</h2>
              <span className="text-sm font-semibold text-[color:var(--dash-muted)]">{intakeReservations.length} recent</span>
            </div>
            {intakeReservations.length === 0 ? (
              <p className="mt-4 rounded-xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] p-4 text-sm text-[color:var(--dash-muted)]">
                No intake records yet.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {intakeReservations.map((reservation) => (
                  <article
                    key={reservation.id}
                    className="rounded-xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-lg font-semibold text-[color:var(--dash-text)]">{reservation.patientName}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[reservation.status]}`}>
                        {reservation.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[color:var(--dash-muted)]">
                      {reservation.department} • {reservation.requestedTime}
                    </p>
                    <p className="mt-2 text-sm text-[color:var(--dash-muted-strong)]">{reservation.summary}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        )

      case 'security':
        return (
          <section
            className="rounded-2xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card)] p-6"
            style={panelStyle}
          >
            <h2 className="text-3xl font-semibold text-[color:var(--dash-text)]">Security</h2>
            <div className="mt-5 grid gap-5 lg:grid-cols-[280px_1fr]">
              <div className="mx-auto h-44 w-44 rounded-full p-2" style={profileDialStyle}>
                <div className="grid h-full w-full place-items-center rounded-full bg-[color:var(--dash-card)] text-center shadow-[inset_0_0_0_1px_var(--dash-border)]">
                  <p className="text-5xl font-semibold leading-none text-[#4a35cc]">{metrics.complianceScore}</p>
                  <p className="text-sm font-semibold text-[#4a35cc]">%</p>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-lg font-semibold text-[color:var(--dash-text)]">Compliance posture</p>
                <p className="text-sm text-[color:var(--dash-muted)]">
                  {apiReady
                    ? 'Identity checks, route guards, and audit logging are running normally.'
                    : 'Live sync is offline. Operating on fallback records until API connection is restored.'}
                </p>
                <ul className="space-y-2 text-sm text-[color:var(--dash-muted-strong)]">
                  <li>Role-based access controls enforced for all protected routes.</li>
                  <li>Audit trail events are written for auth and booking operations.</li>
                  <li>Session validation and token checks are active.</li>
                </ul>
              </div>
            </div>
          </section>
        )

      case 'user_management':
        return (
          <section
            className="rounded-2xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card)] p-6"
            style={panelStyle}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-3xl font-semibold text-[color:var(--dash-text)]">User Management</h2>
              <span className="rounded-full border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--dash-muted)]">
                {roleLabel}
              </span>
            </div>

            <div className="mt-4 rounded-xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] p-4">
              <p className="text-lg font-semibold text-[color:var(--dash-text)]">{authUser?.username ?? 'Unknown user'}</p>
              <p className="mt-1 text-sm text-[color:var(--dash-muted)]">Role capabilities for this workspace account</p>
              <ul className="mt-3 space-y-2 text-sm text-[color:var(--dash-muted-strong)]">
                {roleCapabilities.map((item) => (
                  <li key={item}>- {item}</li>
                ))}
              </ul>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigate?.(canOpenAdmin ? 'admin' : 'admin_login')}
                className="rounded-lg border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--dash-muted-strong)] transition hover:opacity-85"
              >
                {canOpenAdmin ? 'Open Admin Controls' : 'Open Admin Login'}
              </button>
              <button
                type="button"
                onClick={() => onNavigate?.('login')}
                className="rounded-lg border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--dash-muted-strong)] transition hover:opacity-85"
              >
                Switch Account
              </button>
            </div>
          </section>
        )

      default:
        return renderPlaceholder(activeSidebarLabel, pageDescription[activePage], GridIcon)
    }
  }

  return (
    <div
      style={themeVars}
      data-testid="dashboard-shell"
      className="relative mx-auto min-h-screen max-w-[1720px] overflow-x-hidden bg-[color:var(--dash-bg)] text-[color:var(--dash-text)]"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-20 top-0 h-72 w-72 rounded-full bg-[color:var(--dash-bg-glow-a)] blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-80 w-80 rounded-full bg-[color:var(--dash-bg-glow-b)] blur-3xl" />
      </div>

      <div
        className={`relative lg:grid ${
          isSidebarCondensed ? 'lg:grid-cols-[238px_1fr]' : 'lg:grid-cols-[280px_1fr]'
        }`}
      >
        <aside
          className={`flex flex-col border-b border-[color:var(--dash-border)] bg-[color:var(--dash-sidebar)] px-4 py-5 transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:self-start lg:border-b-0 lg:border-r ${
            isSidebarCondensed ? 'lg:px-3' : 'lg:px-4'
          }`}
        >
          <button
            type="button"
            onClick={() => onNavigate?.('landing')}
            className={`flex items-center text-left transition-all duration-300 ${
              isSidebarCondensed ? 'gap-2' : 'gap-3'
            }`}
          >
            <AppLogoBadge className={isSidebarCondensed ? 'h-10 w-10' : 'h-11 w-11'} />
            <div>
              <p
                className={`font-display font-semibold tracking-tight text-[color:var(--dash-text)] transition-all duration-300 ${
                  isSidebarCondensed ? 'text-[1.05rem]' : 'text-[1.45rem]'
                }`}
              >
                AI Health Care
              </p>
            </div>
          </button>

          <nav className={`mt-8 min-h-0 flex-1 space-y-1 ${isSidebarCondensed ? 'pr-0.5' : 'pr-1'}`}>
            {sidebarLinks.map((link) => {
              const Icon = link.icon
              const isActive = activePage === link.page

              return (
                <button
                  key={link.label}
                  type="button"
                  onClick={() => onNavigate?.(link.page)}
                  className={`flex w-full items-center rounded-xl font-medium transition ${
                    isSidebarCondensed ? 'gap-2 px-2.5 py-2 text-[13px]' : 'gap-3 px-3 py-2.5 text-sm'
                  } ${
                    isActive
                      ? 'bg-[color:var(--dash-sidebar-active)] text-[color:var(--dash-sidebar-active-text)]'
                      : 'bg-transparent text-[color:var(--dash-sidebar-text)] hover:bg-[color:var(--dash-sidebar-item)] hover:text-[color:var(--dash-sidebar-active-text)]'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span
                    className={`grid place-items-center rounded-lg ${
                      isSidebarCondensed ? 'h-7 w-7' : 'h-8 w-8'
                    } ${
                      isActive
                        ? 'bg-[color:var(--dash-card)] text-[#2a69bb]'
                        : 'bg-[color:var(--dash-sidebar-item)] text-[color:var(--dash-sidebar-text)]'
                    }`}
                  >
                    <Icon className="h-[16px] w-[16px]" />
                  </span>
                  <span className="truncate">{link.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="mt-auto border-t border-[color:var(--dash-border)] pt-4">
            <p className="text-sm font-semibold text-[color:var(--dash-text)]">{authUser?.username ?? 'Unknown user'}</p>
            <p className="text-xs text-[color:var(--dash-muted)]">{roleLabel}</p>
            <button
              type="button"
              onClick={onLogout}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[color:var(--dash-border)] bg-[color:var(--dash-card-soft)] px-3 py-2 text-xs font-semibold text-[color:var(--dash-muted-strong)] transition hover:opacity-85"
            >
              <LogoutIcon className="h-4 w-4" />
              Logout
            </button>
          </div>
        </aside>

        <section className="px-4 pb-8 pt-6 sm:px-6 lg:px-8">
          <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-[2.55rem] font-semibold tracking-tight text-[color:var(--dash-text)]">
                Welcome back, {displayName}!
              </h1>
              <p className="mt-1 text-base text-[color:var(--dash-muted)]">{pageDescription[activePage]}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[color:var(--dash-border)] bg-[color:var(--dash-card)] px-3 py-1.5 text-xs font-semibold text-[color:var(--dash-muted)]">
                {nowLabel}
              </span>
              <span
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  apiReady
                    ? isDark
                      ? 'border-emerald-400/35 bg-emerald-400/15 text-emerald-200'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : isDark
                      ? 'border-amber-400/35 bg-amber-400/15 text-amber-200'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}
              >
                {apiReady ? 'API Connected' : 'Fallback Data'}
              </span>
              <button
                type="button"
                onClick={() => onNavigate?.('triage')}
                className="inline-flex items-center gap-2 rounded-full bg-[#2d6cb3] px-4 py-2 text-sm font-semibold text-[#f5f9ff] transition hover:bg-[#255a97]"
              >
                <CalendarIcon className="h-4 w-4" />
                Book Appointment
              </button>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full border border-[color:var(--dash-border)] bg-[color:var(--dash-notify-bg)] text-[color:var(--dash-notify-text)] transition hover:opacity-90"
                aria-label="Notifications"
              >
                <BellIcon className="h-[18px] w-[18px]" />
              </button>
              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((previous) => !previous)}
                  className="flex items-center gap-2 rounded-full border border-[color:var(--dash-border)] bg-[color:var(--dash-card)] px-2 py-1.5 text-[color:var(--dash-avatar-text)] transition hover:opacity-90"
                  aria-label="Open user menu"
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--dash-avatar-bg)] text-sm font-bold text-[color:var(--dash-avatar-text)]">
                    {userInitials}
                  </span>
                  <span className="pr-1 text-sm font-semibold">{userInitials}</span>
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-3.5 w-3.5 transition ${isUserMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {isUserMenuOpen && (
                  <div
                    role="menu"
                    aria-label="User menu"
                    className="absolute right-0 top-[calc(100%+0.45rem)] z-30 min-w-[180px] rounded-xl border border-[color:var(--dash-border)] bg-[color:var(--dash-card)] p-2 shadow-[0_16px_28px_rgba(15,35,67,0.18)]"
                  >
                    <p className="px-2 py-1 text-xs font-semibold text-[color:var(--dash-muted)]">
                      {authUser?.username ?? 'Unknown user'}
                    </p>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsUserMenuOpen(false)
                        onLogout()
                      }}
                      className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[color:var(--dash-text)] transition hover:bg-[color:var(--dash-card-soft)]"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <section className="space-y-5">
            {activePage === 'dashboard' ? renderOverview() : renderModulePage()}
          </section>
        </section>
      </div>
    </div>
  )
}

function GridIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function ChartIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 20V4" />
      <path d="M10 20v-8" />
      <path d="M16 20v-5" />
      <path d="M22 20H2" />
    </svg>
  )
}

function ReportIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M7 3h8l4 4v14H7z" />
      <path d="M15 3v4h4" />
      <path d="M10 12h6" />
      <path d="M10 16h6" />
    </svg>
  )
}

function BellIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 9a6 6 0 1 1 12 0v5l2 2H4l2-2z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </svg>
  )
}

function SupportIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.9.8-1.7 1.2-1.7 2.2" />
      <circle cx="12" cy="16.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

function WalletIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M16 12h5" />
      <path d="M6 6v-1a2 2 0 0 1 2-2h10" />
    </svg>
  )
}

function ClipboardIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M9 4.5h6v2H9z" />
      <path d="M9 11h6" />
      <path d="M9 15h4" />
    </svg>
  )
}

function ShieldIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3 5 6v5c0 5 3.3 8 7 10 3.7-2 7-5 7-10V6z" />
    </svg>
  )
}

function UsersIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <circle cx="17" cy="10" r="2.5" />
      <path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M14.5 19c0-2.2 1.8-4 4-4" />
    </svg>
  )
}

function CalendarIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M3 10h18" />
    </svg>
  )
}

function VideoIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="m16 11 5-3v8l-5-3" />
    </svg>
  )
}

function HeartIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 21s-6.5-4.3-9-8.3C1.4 10.2 2.2 6.8 5.3 5.4 7.3 4.5 9.6 5 11 6.6L12 8l1-1.4c1.4-1.6 3.7-2.1 5.7-1.2 3.1 1.4 3.9 4.8 2.3 7.3-2.5 4-9 8.3-9 8.3Z" />
    </svg>
  )
}

function PulseIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l2.2-3.2L12 15l2.4-4 1.8 1H21" />
    </svg>
  )
}

function ScaleIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 9a4 4 0 1 1 8 0" />
      <path d="m12 9 2-2" />
    </svg>
  )
}

function ThermometerIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z" />
      <path d="M12 11v6" />
    </svg>
  )
}

function ClockIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

function LogoutIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M14 3h5v18h-5" />
      <path d="M10 17 5 12l5-5" />
      <path d="M5 12h11" />
    </svg>
  )
}

export default Dashboard

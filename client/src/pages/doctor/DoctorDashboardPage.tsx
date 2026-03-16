import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
  type SVGProps,
} from 'react'
import ConfirmModal from '../../components/ui/ConfirmModal'
import PageCanvas from '../../components/layout/PageCanvas'
import {
  pageChipButtonClass,
  pageFieldClass,
  pageGhostButtonClass,
  pageHeadingTextClass,
  pageMutedTextClass,
  pagePanelClass,
  pagePrimaryButtonClass,
  pageSubtleTextClass,
} from '../../styles/pageUi'
import { buildRouteFromCanonicalPath, normalizePath } from '../../config/routing'
import { getDoctorTabPath, resolveDoctorTabFromPath } from '../../config/roleTabRoutes'
import {
  api,
  type DoctorDashboardOverview,
  type DoctorPatientProfile,
  type DoctorQueueStatus,
  type DoctorQueueTimelineItem,
  type DoctorScheduleDays,
  type DoctorWeeklySchedule,
  type PrescriptionDraft,
  type SoapNotePayload,
} from '../../services/api'
import type { AuthSession, Reservation } from '../../types'
import {
  formatPhilippineDateTime,
  formatPhilippineMonthYear,
  formatPhilippineTime,
} from '../../utils/dateTime'
import { maskIdentifier, maskPersonName } from '../../utils/privacy'
import { getRoleLabel } from '../../utils/roles'
import {
  dangerStatusChipClass,
  infoStatusChipClass,
  neutralStatusChipClass,
  reservationStatusChipClass,
  successStatusChipClass,
  warningStatusChipClass,
} from '../../utils/statusStyles'

type DoctorDashboardPageProps = {
  authUser: AuthSession['user'] | null
  reservations: Reservation[]
  onLogout: () => void
  onPatchAuthUser?: (updates: Partial<AuthSession['user']>) => void
  sessionStatus: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  dataMaskingEnabled: boolean
}

type DoctorSection =
  | 'dashboard'
  | 'appointments'
  | 'calendar'
  | 'schedule'
  | 'queue'
  | 'analytics'
  | 'settings'

type AppointmentListItem = {
  id: string
  patientId?: string
  patientName: string
  department: string
  priority: Reservation['priority']
  requestedTime: string
  status: Reservation['status']
  queueStatus: DoctorQueueStatus
  symptoms: string
  flagged: boolean
  checkupHistory: Array<{
    visitDate: string
    primaryDiagnosis: string
  }>
}

type IconProps = SVGProps<SVGSVGElement>
type MetricTone = 'blue' | 'green' | 'amber' | 'red' | 'slate'
type MetricCardData = {
  key: string
  label: string
  value: number | string
  subtitle: string
  tone?: MetricTone
}

type DoctorNavItem = {
  key: Exclude<DoctorSection, 'settings'>
  label: string
  description: string
  icon: (props: IconProps) => ReactNode
}

const svgStrokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const BrandPulseIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path {...svgStrokeProps} d="M3 12h4l2-3 3 7 2-4h7" />
  </svg>
)

const DashboardIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path {...svgStrokeProps} d="M4 13.5 12 6l8 7.5" />
    <path {...svgStrokeProps} d="M6.5 11.5V20h11v-8.5" />
  </svg>
)

const AppointmentIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path {...svgStrokeProps} d="M8 3v3" />
    <path {...svgStrokeProps} d="M16 3v3" />
    <rect {...svgStrokeProps} x="4" y="5.5" width="16" height="14.5" rx="2.5" />
    <path {...svgStrokeProps} d="M4 9.5h16" />
    <path {...svgStrokeProps} d="m9 14 2 2 4-4" />
  </svg>
)

const CalendarIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path {...svgStrokeProps} d="M8 3v3" />
    <path {...svgStrokeProps} d="M16 3v3" />
    <rect {...svgStrokeProps} x="4" y="5.5" width="16" height="14.5" rx="2.5" />
    <path {...svgStrokeProps} d="M4 9.5h16" />
    <path {...svgStrokeProps} d="M8 13h.01" />
    <path {...svgStrokeProps} d="M12 13h.01" />
    <path {...svgStrokeProps} d="M16 13h.01" />
    <path {...svgStrokeProps} d="M8 17h.01" />
    <path {...svgStrokeProps} d="M12 17h.01" />
  </svg>
)

const ScheduleIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <circle {...svgStrokeProps} cx="12" cy="12" r="8" />
    <path {...svgStrokeProps} d="M12 8v4l3 2" />
  </svg>
)

const QueueIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path {...svgStrokeProps} d="M4 17h16" />
    <path {...svgStrokeProps} d="M7 17v-7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v7" />
    <path {...svgStrokeProps} d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
)

const AnalyticsIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path {...svgStrokeProps} d="M4 19h16" />
    <path {...svgStrokeProps} d="M7 16v-5" />
    <path {...svgStrokeProps} d="M12 16V8" />
    <path {...svgStrokeProps} d="M17 16v-9" />
  </svg>
)

const SearchIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <circle {...svgStrokeProps} cx="11" cy="11" r="6" />
    <path {...svgStrokeProps} d="m20 20-4.2-4.2" />
  </svg>
)

const RefreshIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path {...svgStrokeProps} d="M20 11a8 8 0 1 0 2 5.5" />
    <path {...svgStrokeProps} d="M20 4v7h-7" />
  </svg>
)

const LogoutIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path {...svgStrokeProps} d="M10 7V5.5A1.5 1.5 0 0 1 11.5 4h5A1.5 1.5 0 0 1 18 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 10 18.5V17" />
    <path {...svgStrokeProps} d="M15 12H4" />
    <path {...svgStrokeProps} d="m7.5 8.5-3.5 3.5 3.5 3.5" />
  </svg>
)

const ChevronLeftIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path {...svgStrokeProps} d="m15 18-6-6 6-6" />
  </svg>
)

const ChevronRightIcon = (props: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path {...svgStrokeProps} d="m9 6 6 6-6 6" />
  </svg>
)

const DOCTOR_NAV_ITEMS: readonly DoctorNavItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Clinical overview',
    icon: DashboardIcon,
  },
  {
    key: 'appointments',
    label: 'Appointments',
    description: 'Patient bookings',
    icon: AppointmentIcon,
  },
  {
    key: 'calendar',
    label: 'Calendar',
    description: 'Monthly view',
    icon: CalendarIcon,
  },
  {
    key: 'schedule',
    label: 'Schedule',
    description: 'Availability setup',
    icon: ScheduleIcon,
  },
  {
    key: 'queue',
    label: 'Queue Management',
    description: 'Live patient queue',
    icon: QueueIcon,
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description: 'Department insights',
    icon: AnalyticsIcon,
  },
] as const

const queueStatusOptions: readonly DoctorQueueStatus[] = [
  'Waiting',
  'Arrived',
  'In-Consultation',
  'Checked-Out',
  'No-Show',
]

const scheduleDayOrder: Array<keyof DoctorScheduleDays> = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const scheduleDayLabels: Record<keyof DoctorScheduleDays, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

const metricToneStyles: Record<MetricTone, CSSProperties> = {
  blue: {
    background: 'color-mix(in srgb, var(--agent-accent-soft) 78%, var(--agent-surface))',
    borderColor: 'color-mix(in srgb, var(--agent-accent) 18%, var(--card-border))',
  },
  green: {
    background: 'color-mix(in srgb, var(--agent-success-soft) 82%, var(--agent-surface))',
    borderColor: 'color-mix(in srgb, var(--agent-success) 18%, var(--card-border))',
  },
  amber: {
    background: 'color-mix(in srgb, var(--agent-warning-soft) 82%, var(--agent-surface))',
    borderColor: 'color-mix(in srgb, var(--agent-warning) 18%, var(--card-border))',
  },
  red: {
    background: 'color-mix(in srgb, var(--agent-danger-soft) 82%, var(--agent-surface))',
    borderColor: 'color-mix(in srgb, var(--agent-danger) 18%, var(--card-border))',
  },
  slate: {
    background: 'color-mix(in srgb, var(--agent-bg) 58%, var(--agent-surface))',
    borderColor: 'var(--card-border)',
  },
}

const metricValueStyles: Record<MetricTone, CSSProperties> = {
  blue: { color: 'var(--agent-accent)' },
  green: { color: 'var(--agent-success)' },
  amber: { color: 'var(--agent-warning)' },
  red: { color: 'var(--agent-danger)' },
  slate: { color: 'var(--agent-ink)' },
}

const compactGhostButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] px-3 py-2 text-xs font-semibold text-[color:var(--agent-ink)] transition hover:bg-[color:var(--agent-overlay)] disabled:cursor-not-allowed disabled:opacity-60'

const compactPrimaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-[color:var(--agent-accent)] px-3 py-2 text-xs font-semibold text-[color:var(--agent-on-accent)] transition hover:bg-[color:var(--agent-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60'

const compactFieldClass =
  'w-full rounded-lg border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] px-3 py-2 text-sm text-[color:var(--agent-ink)] outline-none transition placeholder:text-[color:var(--agent-muted-soft)] focus:border-[color:var(--agent-accent)] focus:ring-2 focus:ring-[color:var(--agent-accent-soft)]'

const DoctorPanel = ({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) => (
  <section className={`${pagePanelClass} p-5 lg:p-6 ${className}`}>{children}</section>
)

const DoctorPanelHeader = ({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description: string
  actions?: ReactNode
}) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0">
      {eyebrow ? (
        <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${pageSubtleTextClass}`}>
          {eyebrow}
        </p>
      ) : null}
      <h2 className={`mt-1 text-xl font-bold ${pageHeadingTextClass}`}>{title}</h2>
      <p className={`mt-1 text-sm ${pageMutedTextClass}`}>{description}</p>
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
  </div>
)

const DoctorMetricCard = ({ label, value, subtitle, tone = 'slate' }: MetricCardData) => {
  const isLongValue = typeof value === 'string' && value.length > 14

  return (
    <article
      className="rounded-[1.1rem] border p-4 shadow-[var(--card-shadow-soft)]"
      style={metricToneStyles[tone]}
    >
      <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${pageSubtleTextClass}`}>
        {label}
      </p>
      <p
        className={`mt-2 font-bold ${isLongValue ? 'text-lg leading-tight' : 'text-[2rem]'} ${pageHeadingTextClass}`}
        style={metricValueStyles[tone]}
      >
        {value}
      </p>
      <p className={`mt-1 text-xs ${pageMutedTextClass}`}>{subtitle}</p>
    </article>
  )
}

const emptyDoctorScheduleDays = (): DoctorScheduleDays => ({
  monday: { morning: false, afternoon: false },
  tuesday: { morning: false, afternoon: false },
  wednesday: { morning: false, afternoon: false },
  thursday: { morning: false, afternoon: false },
  friday: { morning: false, afternoon: false },
  saturday: { morning: false, afternoon: false },
  sunday: { morning: false, afternoon: false },
})

const parseDate = (value: string) => {
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const parseDateForCalendar = (value: string) => {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1])
    const monthIndex = Number(dateOnlyMatch[2]) - 1
    const day = Number(dateOnlyMatch[3])
    const localDate = new Date(year, monthIndex, day)
    return Number.isNaN(localDate.getTime()) ? null : localDate
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const formatDateTime = (value: string) => {
  const timestamp = parseDate(value)
  if (!timestamp) return 'Unknown'
  return formatPhilippineDateTime(timestamp)
}

const formatTime = (value: string) => {
  const timestamp = parseDate(value)
  if (!timestamp) return 'Unknown'
  return formatPhilippineTime(timestamp)
}

const formatMonthInputValue = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const toDateInputValue = (value: Date) => {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

const getMondayDate = (value: Date) => {
  const base = new Date(value)
  base.setHours(0, 0, 0, 0)
  const day = base.getDay()
  const diff = day === 0 ? -6 : 1 - day
  base.setDate(base.getDate() + diff)
  return base
}

const buildDefaultScheduleWeek = () => toDateInputValue(getMondayDate(new Date()))

const normalizeWeekInputValue = (value: string) => {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return buildDefaultScheduleWeek()
  return toDateInputValue(getMondayDate(parsed))
}

const queueStatusChipClass = (queueStatus: DoctorQueueStatus) => {
  if (queueStatus === 'Arrived') return warningStatusChipClass
  if (queueStatus === 'In-Consultation') return infoStatusChipClass
  if (queueStatus === 'Checked-Out') return successStatusChipClass
  if (queueStatus === 'No-Show') return dangerStatusChipClass
  return neutralStatusChipClass
}

const formatCountdown = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const mins = Math.floor(safeSeconds / 60)
  const secs = safeSeconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const priorityChipClass = (priority: Reservation['priority']) => {
  if (priority === 'High') return dangerStatusChipClass
  if (priority === 'Routine') return infoStatusChipClass
  if (priority === 'Low') return neutralStatusChipClass
  return neutralStatusChipClass
}

const meetsPasswordPolicy = (value: string) => {
  if (value.length < 8) return false
  if (!/[A-Z]/.test(value)) return false
  if (!/[a-z]/.test(value)) return false
  if (!/\d/.test(value)) return false
  if (!/[^A-Za-z0-9]/.test(value)) return false
  return true
}

const normalizeWhitespace = (value: string) => value.trim().replace(/\s+/g, ' ')

const splitDisplayName = (value: string) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return { firstName: '', lastName: '' }

  const [firstName, ...rest] = normalized.split(' ')
  return {
    firstName,
    lastName: rest.join(' ') || 'Doctor',
  }
}

const buildDoctorDisplayName = (user: AuthSession['user'] | null) => {
  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
  if (fullName) return fullName
  return 'Doctor'
}

const buildInitials = (value: string) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return 'DR'
  return normalized
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const matchesAppointmentQuery = (item: AppointmentListItem, query: string) => {
  return (
    item.patientName.toLowerCase().includes(query) ||
    item.id.toLowerCase().includes(query) ||
    item.department.toLowerCase().includes(query) ||
    item.symptoms.toLowerCase().includes(query) ||
    item.priority.toLowerCase().includes(query)
  )
}

const matchesQueueQuery = (item: AppointmentListItem, query: string) => {
  return (
    item.patientName.toLowerCase().includes(query) ||
    item.id.toLowerCase().includes(query) ||
    item.department.toLowerCase().includes(query) ||
    item.symptoms.toLowerCase().includes(query)
  )
}

const DoctorDashboardPage = ({
  authUser,
  reservations,
  onLogout,
  onPatchAuthUser,
  sessionStatus,
  theme,
  onToggleTheme,
  dataMaskingEnabled,
}: DoctorDashboardPageProps) => {
  const [activeSection, setActiveSection] = useState<DoctorSection>(() => {
    if (typeof window === 'undefined') return 'dashboard'
    return resolveDoctorTabFromPath(window.location.pathname) ?? 'dashboard'
  })
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [calendarViewDate, setCalendarViewDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentListItem | null>(null)
  const [showAppointmentDetail, setShowAppointmentDetail] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [profileName, setProfileName] = useState(() => buildDoctorDisplayName(authUser))
  const [profileNameDraft, setProfileNameDraft] = useState(() => buildDoctorDisplayName(authUser))
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [doctorOverview, setDoctorOverview] = useState<DoctorDashboardOverview | null>(null)
  const [queueTimeline, setQueueTimeline] = useState<DoctorQueueTimelineItem[]>([])
  const [doctorDataError, setDoctorDataError] = useState<string | null>(null)
  const [isLoadingDoctorData, setIsLoadingDoctorData] = useState(false)
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null)
  const [soapNoteDraft, setSoapNoteDraft] = useState<SoapNotePayload>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  })
  const [soapSaveMessage, setSoapSaveMessage] = useState<string | null>(null)
  const [soapSaveError, setSoapSaveError] = useState<string | null>(null)
  const [prescriptionDraft, setPrescriptionDraft] = useState<PrescriptionDraft>({
    medication: '',
    dosage: '',
    frequency: '',
    durationDays: 7,
    instructions: '',
  })
  const [pendingPrescriptions, setPendingPrescriptions] = useState<PrescriptionDraft[]>([])
  const [prescriptionMessage, setPrescriptionMessage] = useState<string | null>(null)
  const [prescriptionError, setPrescriptionError] = useState<string | null>(null)
  const [frequentPrescriptions, setFrequentPrescriptions] = useState<Array<{ medication: string; count: number }>>([])
  const [medicationQuery, setMedicationQuery] = useState('')
  const [medicationMatches, setMedicationMatches] = useState<Array<{ name: string }>>([])
  const [clockTick, setClockTick] = useState(() => Date.now())
  const [patientProfile, setPatientProfile] = useState<DoctorPatientProfile | null>(null)
  const [isPatientProfileLoading, setIsPatientProfileLoading] = useState(false)
  const [patientProfileError, setPatientProfileError] = useState<string | null>(null)
  const [doctorAppointments, setDoctorAppointments] = useState<Reservation[]>(reservations)
  const [scheduleWeekStart, setScheduleWeekStart] = useState(buildDefaultScheduleWeek)
  const [scheduleDraft, setScheduleDraft] = useState<DoctorScheduleDays>(emptyDoctorScheduleDays)
  const [scheduleWeekSlots, setScheduleWeekSlots] = useState<DoctorWeeklySchedule['weeklySlots']>({})
  const [scheduleHasPublishedWeek, setScheduleHasPublishedWeek] = useState(false)
  const [scheduleHasEnabledSession, setScheduleHasEnabledSession] = useState(false)
  const [isScheduleLoading, setIsScheduleLoading] = useState(false)
  const [isSavingSchedule, setIsSavingSchedule] = useState(false)
  const [scheduleError, setScheduleError] = useState<string | null>(null)
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null)

  useEffect(() => {
    const nextName = buildDoctorDisplayName(authUser)
    setProfileName(nextName)
    setProfileNameDraft(nextName)
  }, [authUser?.firstName, authUser?.lastName, authUser?.username])

  useEffect(() => {
    setDoctorAppointments(reservations)
  }, [reservations])

  const handleOpenAppointment = (appointment: AppointmentListItem) => {
    setSelectedAppointment(appointment)
    setShowAppointmentDetail(true)
  }

  const confirmAndLogout = () => {
    setShowLogoutConfirm(true)
  }

  const handleSaveProfileName = async () => {
    const normalizedName = normalizeWhitespace(profileNameDraft)
    setProfileError(null)
    setProfileMessage(null)

    if (!normalizedName || normalizedName.length < 2) {
      setProfileError('Enter a valid name with at least 2 characters.')
      return
    }

    if (normalizedName.length > 60) {
      setProfileError('Name is too long. Keep it under 60 characters.')
      return
    }

    const { firstName, lastName } = splitDisplayName(normalizedName)
    if (!firstName || !lastName) {
      setProfileError('Use both first and last name.')
      return
    }

    setIsSavingProfile(true)
    try {
      const updatedUser = await api.updateProfile({ firstName, lastName })
      const updatedName = `${updatedUser.firstName} ${updatedUser.lastName}`.trim()
      setProfileName(updatedName || normalizedName)
      setProfileNameDraft(updatedName || normalizedName)
      setProfileMessage('Name updated successfully.')
      onPatchAuthUser?.({
        username: updatedUser.username,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
      })
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Unable to update name right now.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleSavePassword = async () => {
    const oldValue = currentPassword.trim()
    const nextValue = newPassword.trim()
    const confirmValue = confirmPassword.trim()

    setPasswordError(null)
    setPasswordMessage(null)

    if (!oldValue || !nextValue || !confirmValue) {
      setPasswordError('Fill in current password, new password, and confirm password.')
      return
    }

    if (!meetsPasswordPolicy(nextValue)) {
      setPasswordError(
        'New password must be at least 8 characters with uppercase, lowercase, number, and symbol.'
      )
      return
    }

    if (oldValue === nextValue) {
      setPasswordError('New password must be different from current password.')
      return
    }

    if (nextValue !== confirmValue) {
      setPasswordError('New password and confirm password do not match.')
      return
    }

    setIsSavingPassword(true)
    try {
      await api.changePassword(oldValue, nextValue)
      setPasswordMessage('Password changed successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Unable to change password right now.')
    } finally {
      setIsSavingPassword(false)
    }
  }

  const setSection = (next: DoctorSection) => {
    setActiveSection(next)
    setSearchQuery('')
    setSelectedAppointment(null)
    setShowAppointmentDetail(false)

    if (typeof window === 'undefined') return

    const targetPath = getDoctorTabPath(next)
    if (normalizePath(window.location.pathname) === normalizePath(targetPath)) return

    window.history.pushState(
      { ...(window.history.state ?? {}), appRoute: true, appPage: 'doctor_dashboard' },
      '',
      buildRouteFromCanonicalPath(targetPath)
    )
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = () => {
      setActiveSection(resolveDoctorTabFromPath(window.location.pathname) ?? 'dashboard')
      setSearchQuery('')
      setSelectedAppointment(null)
      setShowAppointmentDetail(false)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const loadDoctorDashboardData = async () => {
    setIsLoadingDoctorData(true)
    setDoctorDataError(null)
    try {
      const [overview, timeline, frequent] = await Promise.all([
        api.getDoctorDashboardOverview(),
        api.getDoctorQueueTimeline(),
        api.getFrequentPrescriptions(),
      ])
      setDoctorOverview(overview)
      setQueueTimeline(timeline)
      setFrequentPrescriptions(frequent)

      try {
        const appointments = await api.getAppointments()
        setDoctorAppointments(appointments)
      } catch (error) {
        console.warn('Unable to refresh doctor appointments list.', error)
      }
    } catch (error) {
      setDoctorDataError(error instanceof Error ? error.message : 'Unable to load doctor data.')
    } finally {
      setIsLoadingDoctorData(false)
    }
  }

  useEffect(() => {
    void loadDoctorDashboardData()
    const interval = window.setInterval(() => {
      void loadDoctorDashboardData()
    }, 30000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (activeSection !== 'schedule') return
    void loadDoctorScheduleForWeek(scheduleWeekStart)
  }, [activeSection, scheduleWeekStart])

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!selectedAppointment) return
    setSoapNoteDraft({
      subjective: selectedAppointment.symptoms || '',
      objective: '',
      assessment: '',
      plan: '',
    })
    setSoapSaveMessage(null)
    setSoapSaveError(null)
    setPendingPrescriptions([])
    setPrescriptionMessage(null)
    setPrescriptionError(null)
    setMedicationQuery('')
    setMedicationMatches([])
    setPatientProfile(null)
    setPatientProfileError(null)
  }, [selectedAppointment?.id])

  useEffect(() => {
    const query = medicationQuery.trim()
    if (!query) {
      setMedicationMatches([])
      return
    }

    const timer = window.setTimeout(async () => {
      try {
        const matches = await api.searchMedications(query)
        setMedicationMatches(matches)
      } catch {
        setMedicationMatches([])
      }
    }, 250)

    return () => window.clearTimeout(timer)
  }, [medicationQuery])

  const handleQueueStatusChange = async (appointmentId: string, queueStatus: DoctorQueueStatus) => {
    setStatusSavingId(appointmentId)
    setDoctorDataError(null)
    try {
      await api.updateDoctorQueueStatus(appointmentId, queueStatus)
      await loadDoctorDashboardData()
    } catch (error) {
      setDoctorDataError(error instanceof Error ? error.message : 'Unable to update queue status.')
    } finally {
      setStatusSavingId(null)
    }
  }

  const handleSaveSoapNote = async () => {
    if (!selectedAppointment) return
    setSoapSaveError(null)
    setSoapSaveMessage(null)
    try {
      await api.saveAppointmentSoapNote(selectedAppointment.id, soapNoteDraft)
      setSoapSaveMessage('SOAP note saved.')
    } catch (error) {
      setSoapSaveError(error instanceof Error ? error.message : 'Unable to save SOAP note.')
    }
  }

  const handleAddPrescription = () => {
    const medication = prescriptionDraft.medication.trim()
    const dosage = prescriptionDraft.dosage.trim()
    if (!medication || !dosage) {
      setPrescriptionError('Medication and dosage are required.')
      return
    }
    setPrescriptionError(null)
    setPendingPrescriptions((previous) => [...previous, { ...prescriptionDraft, medication, dosage }])
    setPrescriptionDraft({
      medication: '',
      dosage: '',
      frequency: '',
      durationDays: 7,
      instructions: '',
    })
    setMedicationQuery('')
    setMedicationMatches([])
  }

  const handleSavePrescriptions = async () => {
    if (!selectedAppointment) return
    if (pendingPrescriptions.length === 0) {
      setPrescriptionError('Add at least one prescription entry.')
      return
    }
    setPrescriptionError(null)
    setPrescriptionMessage(null)
    try {
      await api.saveAppointmentPrescriptions(selectedAppointment.id, pendingPrescriptions)
      setPrescriptionMessage('Prescriptions saved.')
      setPendingPrescriptions([])
      await loadDoctorDashboardData()
    } catch (error) {
      setPrescriptionError(error instanceof Error ? error.message : 'Unable to save prescriptions.')
    }
  }

  const handleLoadPatientProfile = async () => {
    if (!selectedAppointment?.patientId) {
      setPatientProfileError('Patient profile is unavailable for this appointment.')
      return
    }
    setIsPatientProfileLoading(true)
    setPatientProfileError(null)
    try {
      const profile = await api.getDoctorPatientProfile(selectedAppointment.patientId)
      setPatientProfile(profile)
    } catch (error) {
      setPatientProfileError(error instanceof Error ? error.message : 'Unable to load patient profile.')
    } finally {
      setIsPatientProfileLoading(false)
    }
  }

  const loadDoctorScheduleForWeek = async (weekStart: string) => {
    setIsScheduleLoading(true)
    setScheduleError(null)
    try {
      const schedule = await api.getDoctorWeeklySchedule(weekStart)
      setScheduleDraft(schedule.days)
      setScheduleWeekSlots(schedule.weeklySlots)
      setScheduleHasPublishedWeek(schedule.hasSchedule)
      setScheduleHasEnabledSession(schedule.hasEnabledSession)
      setScheduleWeekStart(schedule.weekStart || weekStart)
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Unable to load weekly schedule.')
      setScheduleDraft(emptyDoctorScheduleDays())
      setScheduleWeekSlots({})
      setScheduleHasPublishedWeek(false)
      setScheduleHasEnabledSession(false)
    } finally {
      setIsScheduleLoading(false)
    }
  }

  const toggleScheduleSession = (
    dayKey: keyof DoctorScheduleDays,
    session: 'morning' | 'afternoon'
  ) => {
    setScheduleDraft((previous) => ({
      ...previous,
      [dayKey]: {
        ...previous[dayKey],
        [session]: !previous[dayKey][session],
      },
    }))
    setScheduleMessage(null)
    if (scheduleError) setScheduleError(null)
  }

  const shiftScheduleWeek = (deltaDays: number) => {
    setScheduleWeekStart((previous) => {
      const parsed = new Date(`${previous}T00:00:00`)
      if (Number.isNaN(parsed.getTime())) return previous
      parsed.setDate(parsed.getDate() + deltaDays)
      return normalizeWeekInputValue(toDateInputValue(parsed))
    })
    setScheduleMessage(null)
    if (scheduleError) setScheduleError(null)
  }

  const handleSaveWeeklySchedule = async () => {
    setIsSavingSchedule(true)
    setScheduleError(null)
    setScheduleMessage(null)
    try {
      const saved = await api.saveDoctorWeeklySchedule(scheduleWeekStart, scheduleDraft)
      setScheduleDraft(saved.days)
      setScheduleWeekSlots(saved.weeklySlots)
      setScheduleHasPublishedWeek(saved.hasSchedule)
      setScheduleHasEnabledSession(saved.hasEnabledSession)
      setScheduleWeekStart(saved.weekStart || scheduleWeekStart)
      setScheduleMessage('Weekly schedule saved.')
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Unable to save weekly schedule.')
    } finally {
      setIsSavingSchedule(false)
    }
  }

  const appointmentItems = useMemo<AppointmentListItem[]>(() => {
    if (queueTimeline.length > 0) {
      return [...queueTimeline]
        .sort((a, b) => parseDate(a.scheduledDate) - parseDate(b.scheduledDate))
        .map((item) => ({
          id: item.appointmentId,
          patientId: item.patientId,
          patientName: item.patientName,
          department: item.department,
          priority: item.triageLevel,
          requestedTime: item.scheduledDate,
          status:
            item.queueStatus === 'Checked-Out'
              ? 'Recorded'
              : item.queueStatus === 'No-Show'
                ? 'Failed'
                : 'Booked',
          queueStatus: item.queueStatus,
          symptoms: item.chiefComplaint,
          flagged: item.triageLevel === 'High' || item.urgentFollowUp,
          checkupHistory: item.checkupHistory,
        }))
    }

    const fallbackReservations = doctorAppointments.length > 0 ? doctorAppointments : reservations
    const orderedReservations = [...fallbackReservations].sort(
      (a, b) => parseDate(a.requestedTime) - parseDate(b.requestedTime)
    )

    if (!orderedReservations.length) return []

    return orderedReservations.map((reservation) => ({
      id: reservation.id,
      patientName: reservation.patientName,
      department: reservation.department,
      priority: reservation.priority,
      requestedTime: reservation.requestedTime,
      status: reservation.status,
      queueStatus:
        reservation.status === 'Recorded'
          ? 'Checked-Out'
          : reservation.status === 'Failed'
            ? 'No-Show'
            : 'Waiting',
      symptoms: reservation.symptoms,
      flagged: reservation.status === 'Failed' || reservation.priority === 'High',
      checkupHistory: [],
    }))
  }, [doctorAppointments, queueTimeline, reservations])

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredAppointments = useMemo(() => {
    if (!normalizedQuery) return appointmentItems
    return appointmentItems.filter((item) => matchesAppointmentQuery(item, normalizedQuery))
  }, [appointmentItems, normalizedQuery])

  const pendingCalendarReservations = useMemo(() => {
    const sourceReservations = doctorAppointments.length > 0 ? doctorAppointments : reservations
    const pendingReservations = sourceReservations.filter((item) => item.status === 'Booked')
    if (!normalizedQuery) return pendingReservations

    return pendingReservations.filter((item) => {
      return (
        item.patientName.toLowerCase().includes(normalizedQuery) ||
        item.id.toLowerCase().includes(normalizedQuery) ||
        item.department.toLowerCase().includes(normalizedQuery) ||
        item.symptoms.toLowerCase().includes(normalizedQuery) ||
        item.priority.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [doctorAppointments, normalizedQuery, reservations])

  const calendarView = useMemo(() => {
    const year = calendarViewDate.getFullYear()
    const month = calendarViewDate.getMonth()
    const firstDayOfMonth = new Date(year, month, 1)
    const startWeekday = firstDayOfMonth.getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const appointmentsByDay = new Map<number, Reservation[]>()

    for (const item of pendingCalendarReservations) {
      const date = parseDateForCalendar(item.requestedTime)
      if (!date) continue
      if (date.getFullYear() !== year || date.getMonth() !== month) continue
      const day = date.getDate()
      const bucket = appointmentsByDay.get(day) ?? []
      bucket.push(item)
      appointmentsByDay.set(day, bucket)
    }

    for (const bucket of appointmentsByDay.values()) {
      bucket.sort((a, b) => {
        const aDate = parseDateForCalendar(a.requestedTime)
        const bDate = parseDateForCalendar(b.requestedTime)
        const aTime = aDate ? aDate.getTime() : Number.POSITIVE_INFINITY
        const bTime = bDate ? bDate.getTime() : Number.POSITIVE_INFINITY
        return aTime - bTime
      })
    }

    const cells: Array<{ day: number; appointments: Reservation[] } | null> = []
    for (let index = 0; index < startWeekday; index += 1) cells.push(null)
    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ day, appointments: appointmentsByDay.get(day) ?? [] })
    }
    while (cells.length % 7 !== 0) cells.push(null)

    return {
      monthLabel: formatPhilippineMonthYear(firstDayOfMonth),
      appointmentsThisMonth: Array.from(appointmentsByDay.values()).reduce(
        (sum, items) => sum + items.length,
        0
      ),
      cells,
    }
  }, [calendarViewDate, pendingCalendarReservations])

  const monthAgendaItems = useMemo(() => {
    const year = calendarViewDate.getFullYear()
    const month = calendarViewDate.getMonth()

    return pendingCalendarReservations
      .filter((item) => {
        const date = parseDateForCalendar(item.requestedTime)
        return Boolean(date && date.getFullYear() === year && date.getMonth() === month)
      })
      .sort((a, b) => parseDate(a.requestedTime) - parseDate(b.requestedTime))
      .slice(0, 8)
  }, [calendarViewDate, pendingCalendarReservations])

  const activeQueueItems = useMemo(
    () =>
      appointmentItems.filter(
        (item) => item.queueStatus !== 'Checked-Out' && item.queueStatus !== 'No-Show'
      ),
    [appointmentItems]
  )

  const filteredQueueItems = useMemo(() => {
    if (!normalizedQuery) return activeQueueItems
    return activeQueueItems.filter((item) => matchesQueueQuery(item, normalizedQuery))
  }, [activeQueueItems, normalizedQuery])

  const dashboardTimelineItems = useMemo(
    () => filteredQueueItems.slice(0, 5),
    [filteredQueueItems]
  )

  const dashboardUrgencyFlags = useMemo(() => {
    const flags = doctorOverview?.urgencyFlags ?? []
    if (!normalizedQuery) return flags.slice(0, 5)
    return flags
      .filter((flag) => {
        const patientName = flag.patientName.toLowerCase()
        const triageLevel = flag.triageLevel.toLowerCase()
        const queueStatus = flag.queueStatus.toLowerCase()
        return (
          patientName.includes(normalizedQuery) ||
          triageLevel.includes(normalizedQuery) ||
          queueStatus.includes(normalizedQuery)
        )
      })
      .slice(0, 5)
  }, [doctorOverview?.urgencyFlags, normalizedQuery])

  const departmentBreakdown = useMemo(() => {
    const grouped = new Map<string, number>()
    appointmentItems.forEach((item) => {
      grouped.set(item.department, (grouped.get(item.department) || 0) + 1)
    })
    return Array.from(grouped.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [appointmentItems])

  const maxDepartmentCount = departmentBreakdown[0]?.count ?? 1

  const statusBreakdown = useMemo(
    () => [
      {
        label: 'Booked',
        count: appointmentItems.filter((item) => item.status === 'Booked').length,
        tone: 'blue' as const,
      },
      {
        label: 'Recorded',
        count: appointmentItems.filter((item) => item.status === 'Recorded').length,
        tone: 'green' as const,
      },
      {
        label: 'Failed',
        count: appointmentItems.filter((item) => item.status === 'Failed').length,
        tone: 'red' as const,
      },
    ],
    [appointmentItems]
  )

  const completionRate =
    appointmentItems.length > 0
      ? Math.round(
          (appointmentItems.filter((item) => item.status === 'Recorded').length /
            appointmentItems.length) *
            100
        )
      : 0

  const openDays = useMemo(
    () =>
      scheduleDayOrder.filter((dayKey) => {
        const day = scheduleDraft[dayKey]
        return Boolean(day?.morning || day?.afternoon)
      }).length,
    [scheduleDraft]
  )

  const openSessions = useMemo(
    () =>
      scheduleDayOrder.reduce((sum, dayKey) => {
        const day = scheduleDraft[dayKey]
        return sum + (day?.morning ? 1 : 0) + (day?.afternoon ? 1 : 0)
      }, 0),
    [scheduleDraft]
  )

  const slotCount = useMemo(
    () =>
      scheduleDayOrder.reduce((sum, dayKey) => sum + (scheduleWeekSlots[dayKey]?.length || 0), 0),
    [scheduleWeekSlots]
  )

  const dashboardMetricCards = useMemo<MetricCardData[]>(
    () => [
      {
        key: 'today-total',
        label: "Today's appointments",
        value: doctorOverview?.counter.total ?? appointmentItems.length,
        subtitle: 'All scheduled today',
        tone: 'blue',
      },
      {
        key: 'today-waiting',
        label: 'Waiting',
        value: doctorOverview?.counter.pending ?? activeQueueItems.length,
        subtitle: 'Awaiting review',
        tone: 'amber',
      },
      {
        key: 'today-completed',
        label: 'Completed',
        value:
          doctorOverview?.counter.completed ??
          appointmentItems.filter((item) => item.status === 'Recorded').length,
        subtitle: 'Checked-out visits',
        tone: 'green',
      },
      {
        key: 'today-no-shows',
        label: 'No-show',
        value:
          doctorOverview?.counter.noShows ??
          appointmentItems.filter((item) => item.status === 'Failed').length,
        subtitle: 'Missed appointments',
        tone: 'red',
      },
    ],
    [activeQueueItems.length, appointmentItems, doctorOverview]
  )

  const appointmentMetricCards = useMemo<MetricCardData[]>(
    () => [
      {
        key: 'appt-total',
        label: 'Total appointments',
        value: doctorOverview?.counter.total ?? appointmentItems.length,
        subtitle: `${filteredAppointments.length} visible`,
        tone: 'slate',
      },
      {
        key: 'appt-pending',
        label: 'Pending',
        value:
          doctorOverview?.counter.pending ??
          appointmentItems.filter((item) => item.status === 'Booked').length,
        subtitle: 'Awaiting action',
        tone: 'blue',
      },
      {
        key: 'appt-completed',
        label: 'Completed',
        value:
          doctorOverview?.counter.completed ??
          appointmentItems.filter((item) => item.status === 'Recorded').length,
        subtitle: 'Finished visits',
        tone: 'green',
      },
      {
        key: 'appt-no-shows',
        label: 'No-shows',
        value:
          doctorOverview?.counter.noShows ??
          appointmentItems.filter((item) => item.status === 'Failed').length,
        subtitle: 'Missed today',
        tone: 'red',
      },
    ],
    [appointmentItems, doctorOverview, filteredAppointments.length]
  )

  const queueMetricCards = useMemo<MetricCardData[]>(
    () => [
      {
        key: 'queue-pending',
        label: 'Pending',
        value: activeQueueItems.length,
        subtitle: 'Awaiting review',
        tone: 'amber',
      },
      {
        key: 'queue-departments',
        label: 'Departments',
        value: new Set(activeQueueItems.map((item) => item.department)).size,
        subtitle: 'Active departments',
        tone: 'slate',
      },
      {
        key: 'queue-high',
        label: 'High priority',
        value: activeQueueItems.filter((item) => item.priority === 'High').length,
        subtitle: 'Urgent in queue',
        tone: 'red',
      },
      {
        key: 'queue-arrived',
        label: 'Arrived',
        value: activeQueueItems.filter((item) => item.queueStatus === 'Arrived').length,
        subtitle: `${filteredQueueItems.length} visible`,
        tone: 'blue',
      },
    ],
    [activeQueueItems, filteredQueueItems.length]
  )

  const scheduleMetricCards = useMemo<MetricCardData[]>(
    () => [
      {
        key: 'schedule-week',
        label: 'Week start',
        value: scheduleWeekStart,
        subtitle: 'Monday-based week',
        tone: 'slate',
      },
      {
        key: 'schedule-days',
        label: 'Open days',
        value: openDays,
        subtitle: 'Days with sessions enabled',
        tone: 'blue',
      },
      {
        key: 'schedule-sessions',
        label: 'Open sessions',
        value: openSessions,
        subtitle: 'Morning and afternoon total',
        tone: 'amber',
      },
      {
        key: 'schedule-slots',
        label: 'Slots',
        value: slotCount,
        subtitle: scheduleHasPublishedWeek ? 'Published slot count' : 'Draft only',
        tone: 'green',
      },
    ],
    [openDays, openSessions, scheduleHasPublishedWeek, scheduleWeekStart, slotCount]
  )

  const topDepartment = departmentBreakdown[0]?.department || 'N/A'

  const analyticsMetricCards = useMemo<MetricCardData[]>(
    () => [
      {
        key: 'analytics-departments',
        label: 'Total departments',
        value: departmentBreakdown.length,
        subtitle: 'Active departments',
        tone: 'slate',
      },
      {
        key: 'analytics-top',
        label: 'Top department',
        value: topDepartment,
        subtitle: departmentBreakdown[0] ? `${departmentBreakdown[0].count} appointments` : 'No data',
        tone: 'blue',
      },
      {
        key: 'analytics-completion',
        label: 'Completion rate',
        value: `${completionRate}%`,
        subtitle: 'Recorded vs total',
        tone: 'green',
      },
      {
        key: 'analytics-processing',
        label: 'Processing',
        value: appointmentItems.length,
        subtitle: 'Total processed',
        tone: 'amber',
      },
    ],
    [appointmentItems.length, completionRate, departmentBreakdown, topDepartment]
  )

  const settingsMetricCards = useMemo<MetricCardData[]>(
    () => [
      {
        key: 'settings-name',
        label: 'Doctor',
        value: profileName,
        subtitle: 'Display name',
        tone: 'slate',
      },
      {
        key: 'settings-account',
        label: 'Account',
        value: authUser?.username ?? 'Unknown',
        subtitle: 'Signed-in username',
        tone: 'blue',
      },
      {
        key: 'settings-role',
        label: 'Role',
        value: getRoleLabel(authUser?.role),
        subtitle: 'Access scope',
        tone: 'amber',
      },
      {
        key: 'settings-theme',
        label: 'Theme',
        value: theme === 'dark' ? 'Dark' : 'Light',
        subtitle: `Session ${sessionStatus}`,
        tone: 'green',
      },
    ],
    [authUser?.role, authUser?.username, profileName, sessionStatus, theme]
  )

  const sectionMeta: Record<
    DoctorSection,
    { title: string; description: string; eyebrow: string; searchPlaceholder: string }
  > = {
    dashboard: {
      title: 'Dashboard',
      description: 'Review today’s clinic workload, next patient, and live queue status.',
      eyebrow: 'Doctor Portal',
      searchPlaceholder: 'Search patients, IDs, or departments...',
    },
    appointments: {
      title: 'Appointments',
      description: 'Review bookings, priorities, and open clinical details for every patient slot.',
      eyebrow: 'Appointments',
      searchPlaceholder: 'Search appointments...',
    },
    calendar: {
      title: 'Calendar',
      description: 'Track your monthly appointment calendar and the next upcoming patient slots.',
      eyebrow: 'Calendar',
      searchPlaceholder: 'Search calendar appointments...',
    },
    schedule: {
      title: 'Schedule',
      description: 'Manage weekly availability and publish bookable morning and afternoon sessions.',
      eyebrow: 'Availability',
      searchPlaceholder: '',
    },
    queue: {
      title: 'Queue Management',
      description: 'Manage active patient queue pending review and status updates.',
      eyebrow: 'Queue',
      searchPlaceholder: 'Search queue...',
    },
    analytics: {
      title: 'Analytics',
      description: 'View appointment trends, department load, and operational metrics.',
      eyebrow: 'Insights',
      searchPlaceholder: 'Filter analytics by department or status...',
    },
    settings: {
      title: 'Account Settings',
      description: 'Manage your profile details, security, theme, and doctor session preferences.',
      eyebrow: 'Profile',
      searchPlaceholder: '',
    },
  }

  const activeMeta = sectionMeta[activeSection]
  const activeMetricCards =
    activeSection === 'dashboard'
      ? dashboardMetricCards
      : activeSection === 'appointments' || activeSection === 'calendar'
        ? appointmentMetricCards
        : activeSection === 'schedule'
          ? scheduleMetricCards
          : activeSection === 'queue'
            ? queueMetricCards
            : activeSection === 'analytics'
              ? analyticsMetricCards
              : settingsMetricCards

  const doctorSyncStatus = isLoadingDoctorData ? 'Refreshing clinic data' : 'Live clinic data'
  const nextPatientCountdownSeconds = useMemo(() => {
    if (!doctorOverview?.nextPatient) return 0
    const targetMs = new Date(doctorOverview.nextPatient.scheduledDate).getTime()
    const delta = Math.floor((targetMs - clockTick) / 1000)
    return Math.max(0, delta)
  }, [clockTick, doctorOverview?.nextPatient])

  const doctorInitials = buildInitials(profileName)
  const doctorEmail = authUser?.username ?? 'Doctor account'
  const canShowSearch = activeSection !== 'schedule' && activeSection !== 'settings'

  const runSectionAction = () => {
    if (activeSection === 'schedule') {
      void loadDoctorScheduleForWeek(scheduleWeekStart)
      return
    }
    if (activeSection === 'settings') {
      onToggleTheme()
      return
    }
    void loadDoctorDashboardData()
  }

  const sectionActionLabel =
    activeSection === 'schedule'
      ? isScheduleLoading
        ? 'Refreshing...'
        : 'Reload week'
      : activeSection === 'settings'
        ? `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} theme`
        : isLoadingDoctorData
          ? 'Refreshing...'
          : 'Refresh'

  const sectionActionIcon =
    activeSection === 'settings' ? (
      <BrandPulseIcon className="h-4 w-4" />
    ) : (
      <RefreshIcon className="h-4 w-4" />
    )

  return (
    <PageCanvas className="staff-theme">
      <div className="min-h-screen lg:flex">
        <aside
          className={`border-b border-[color:var(--card-border)] bg-[color:var(--agent-surface)] transition-all duration-200 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r ${isSidebarCollapsed ? 'lg:w-[68px]' : 'lg:w-[220px]'}`}
        >
          <div className="flex h-16 items-center gap-2 border-b border-[color:var(--card-border)] px-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--agent-accent)] text-[color:var(--agent-on-accent)]">
              <BrandPulseIcon className="h-4 w-4" />
            </div>
            {!isSidebarCollapsed ? (
              <span className={`truncate text-sm font-semibold ${pageHeadingTextClass}`}>
                AI Health Care
              </span>
            ) : null}
            <button
              type="button"
              className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--agent-muted)] transition hover:bg-[color:var(--agent-overlay)] hover:text-[color:var(--agent-ink)]"
              onClick={() => setIsSidebarCollapsed((previous) => !previous)}
              aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isSidebarCollapsed ? (
                <ChevronRightIcon className="h-4 w-4" />
              ) : (
                <ChevronLeftIcon className="h-4 w-4" />
              )}
            </button>
          </div>

          <nav className="flex-1 px-2 py-3">
            <div className="space-y-1">
              {DOCTOR_NAV_ITEMS.map((item) => {
                const isActive = activeSection === item.key
                const Icon = item.icon
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSection(item.key)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${isActive ? 'bg-[color:var(--agent-accent-soft)] text-[color:var(--agent-accent)]' : 'text-[color:var(--agent-muted)] hover:bg-[color:var(--agent-overlay)] hover:text-[color:var(--agent-ink)]'}`}
                  >
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-[color:var(--agent-accent)]' : 'text-[color:var(--agent-muted-soft)]'}`} />
                    {!isSidebarCollapsed ? (
                      <span className="min-w-0">
                        <span className="block truncate">{item.label}</span>
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </nav>

          <div className="border-t border-[color:var(--card-border)] p-3">
            <button
              type="button"
              onClick={() => setSection('settings')}
              className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-[color:var(--agent-overlay)] ${activeSection === 'settings' ? 'bg-[color:var(--agent-overlay)]' : ''}`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--agent-accent-soft)] text-sm font-semibold text-[color:var(--agent-accent)]">
                {doctorInitials}
              </div>
              {!isSidebarCollapsed ? (
                <div className="min-w-0 text-left">
                  <p className={`truncate text-xs ${pageSubtleTextClass}`}>{doctorEmail}</p>
                  <p className={`truncate text-sm font-semibold ${pageHeadingTextClass}`}>
                    {profileName}
                  </p>
                </div>
              ) : null}
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-[color:var(--agent-bg)]">
          <div className="mx-auto max-w-[1240px] p-4 lg:p-8">
            <ConfirmModal
              open={showLogoutConfirm}
              title="Confirm logout"
              message="Are you sure you want to logout now?"
              confirmLabel="Logout"
              cancelLabel="Cancel"
              onConfirm={() => {
                setShowLogoutConfirm(false)
                onLogout()
              }}
              onCancel={() => setShowLogoutConfirm(false)}
            />

            <DoctorPanel className="mb-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={pageChipButtonClass}>{activeMeta.eyebrow}</span>
                    <span className={pageChipButtonClass}>{doctorSyncStatus}</span>
                  </div>
                  <h1 className={`mt-4 text-4xl font-bold tracking-[-0.04em] ${pageHeadingTextClass}`}>
                    {activeMeta.title}
                  </h1>
                  <p className={`mt-2 max-w-2xl text-base ${pageMutedTextClass}`}>
                    {activeMeta.description}
                  </p>
                </div>

                <div className="flex w-full flex-col gap-3 lg:max-w-xl lg:items-end">
                  <div className="flex w-full flex-col gap-3 sm:flex-row lg:justify-end">
                    {canShowSearch ? (
                      <label className="relative block min-w-0 flex-1">
                        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--agent-muted-soft)]" />
                        <input
                          value={searchQuery}
                          onChange={(event) => setSearchQuery(event.target.value)}
                          className={`${compactFieldClass} pl-10`}
                          placeholder={activeMeta.searchPlaceholder}
                        />
                      </label>
                    ) : null}
                    <button
                      type="button"
                      className={compactGhostButtonClass}
                      onClick={runSectionAction}
                      disabled={
                        activeSection === 'schedule'
                          ? isScheduleLoading || isSavingSchedule
                          : activeSection === 'settings'
                            ? false
                            : isLoadingDoctorData
                      }
                    >
                      {sectionActionIcon}
                      {sectionActionLabel}
                    </button>
                    <button
                      type="button"
                      className={compactPrimaryButtonClass}
                      onClick={confirmAndLogout}
                    >
                      <LogoutIcon className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                  <div className={`text-xs ${pageSubtleTextClass}`}>
                    Signed in as {profileName} · {getRoleLabel(authUser?.role)}
                  </div>
                </div>
              </div>
            </DoctorPanel>

            {doctorDataError ? (
              <DoctorPanel className="mb-6 border-[color:var(--agent-danger)]">
                <p className="text-sm font-semibold text-[color:var(--agent-danger)]">{doctorDataError}</p>
              </DoctorPanel>
            ) : null}

            <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {activeMetricCards.map(({ key, ...card }) => (
                <DoctorMetricCard key={key} {...card} />
              ))}
            </div>

            {activeSection === 'dashboard' ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <div className="space-y-4">
                  <DoctorPanel>
                    <DoctorPanelHeader
                      eyebrow="Next Patient"
                      title="Up next in clinic"
                      description="The next confirmed patient in your live consultation flow."
                      actions={
                        doctorOverview?.nextPatient ? (
                          <span className={pageChipButtonClass}>
                            {formatCountdown(nextPatientCountdownSeconds)}
                          </span>
                        ) : null
                      }
                    />

                    {doctorOverview?.nextPatient ? (
                      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                        <div className="min-w-0">
                          <p className={`text-2xl font-bold ${pageHeadingTextClass}`}>
                            {dataMaskingEnabled
                              ? maskPersonName(doctorOverview.nextPatient.patientName)
                              : doctorOverview.nextPatient.patientName}
                          </p>
                          <p className={`mt-2 text-sm ${pageMutedTextClass}`}>
                            {doctorOverview.nextPatient.chiefComplaint}
                          </p>
                          <div className={`mt-4 flex flex-wrap items-center gap-2 text-sm ${pageMutedTextClass}`}>
                            <span>Appointment {dataMaskingEnabled ? maskIdentifier(doctorOverview.nextPatient.appointmentId) : doctorOverview.nextPatient.appointmentId}</span>
                            <span>•</span>
                            <span>{formatDateTime(doctorOverview.nextPatient.scheduledDate)}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className={pagePrimaryButtonClass}
                          onClick={() => {
                            const nextItem = appointmentItems.find(
                              (item) => item.id === doctorOverview.nextPatient?.appointmentId
                            )
                            if (nextItem) handleOpenAppointment(nextItem)
                          }}
                        >
                          Open chart
                        </button>
                      </div>
                    ) : (
                      <p className={`mt-5 text-sm ${pageMutedTextClass}`}>
                        No upcoming patients for today.
                      </p>
                    )}
                  </DoctorPanel>

                  <DoctorPanel>
                    <DoctorPanelHeader
                      eyebrow="Queue"
                      title="Patient queue timeline"
                      description="Live view of today’s patient flow with quick access to charts and queue status."
                      actions={
                        <span className={pageChipButtonClass}>
                          {dashboardTimelineItems.length} active
                        </span>
                      }
                    />

                    {dashboardTimelineItems.length === 0 ? (
                      <p className={`mt-5 text-sm ${pageMutedTextClass}`}>
                        No pending patients in the queue.
                      </p>
                    ) : (
                      <div className="mt-5 space-y-3">
                        {dashboardTimelineItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-col gap-3 rounded-[1rem] border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-block h-2.5 w-2.5 rounded-full ${
                                    item.priority === 'High'
                                      ? 'bg-rose-500'
                                      : item.priority === 'Routine'
                                        ? 'bg-amber-400'
                                        : 'bg-emerald-500'
                                  }`}
                                />
                                <p className={`truncate text-sm font-semibold ${pageHeadingTextClass}`}>
                                  {dataMaskingEnabled ? maskPersonName(item.patientName) : item.patientName}
                                </p>
                              </div>
                              <p className={`mt-1 text-xs ${pageMutedTextClass}`}>
                                {dataMaskingEnabled ? maskIdentifier(item.id) : item.id} · {item.department} ·{' '}
                                {formatTime(item.requestedTime)}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityChipClass(item.priority)}`}
                              >
                                {item.priority}
                              </span>
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${queueStatusChipClass(item.queueStatus)}`}
                              >
                                {item.queueStatus}
                              </span>
                              <button
                                type="button"
                                className={compactPrimaryButtonClass}
                                onClick={() => handleOpenAppointment(item)}
                              >
                                Open
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </DoctorPanel>
                </div>

                <div className="space-y-4">
                  <DoctorPanel>
                    <DoctorPanelHeader
                      eyebrow="Urgency"
                      title="Urgency flags"
                      description="Patients that need immediate review or triage follow-up."
                      actions={
                        <span className={pageChipButtonClass}>
                          {dashboardUrgencyFlags.length} flagged
                        </span>
                      }
                    />

                    {dashboardUrgencyFlags.length === 0 ? (
                      <p className={`mt-5 text-sm ${pageMutedTextClass}`}>
                        No urgent flags for the current queue.
                      </p>
                    ) : (
                      <div className="mt-5 space-y-3">
                        {dashboardUrgencyFlags.map((flag) => (
                          <div
                            key={flag.appointmentId}
                            className="rounded-[1rem] border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] px-4 py-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className={`truncate text-sm font-semibold ${pageHeadingTextClass}`}>
                                  {dataMaskingEnabled ? maskPersonName(flag.patientName) : flag.patientName}
                                </p>
                                <p className={`mt-1 text-xs ${pageMutedTextClass}`}>
                                  {flag.urgentFollowUp ? 'Urgent follow-up required' : 'Queue triage alert'}
                                </p>
                              </div>
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityChipClass(flag.triageLevel)}`}
                              >
                                {flag.triageLevel}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${queueStatusChipClass(flag.queueStatus)}`}
                              >
                                {flag.queueStatus}
                              </span>
                              <button
                                type="button"
                                className={compactGhostButtonClass}
                                onClick={() => {
                                  const flaggedItem = appointmentItems.find(
                                    (item) => item.id === flag.appointmentId
                                  )
                                  if (flaggedItem) handleOpenAppointment(flaggedItem)
                                }}
                              >
                                Review patient
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </DoctorPanel>

                  <DoctorPanel>
                    <DoctorPanelHeader
                      eyebrow="Snapshot"
                      title="Today at a glance"
                      description="Quick visibility into queue movement and appointment completion."
                    />

                    <div className="mt-5 space-y-4">
                      {statusBreakdown.map((status) => (
                        <div key={status.label}>
                          <div className="flex items-center justify-between gap-3">
                            <span className={`text-sm font-medium ${pageHeadingTextClass}`}>
                              {status.label}
                            </span>
                            <span className={`text-sm font-semibold ${pageHeadingTextClass}`}>
                              {status.count}
                            </span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--agent-overlay)]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${appointmentItems.length > 0 ? (status.count / appointmentItems.length) * 100 : 0}%`,
                                background:
                                  status.tone === 'green'
                                    ? 'var(--agent-success)'
                                    : status.tone === 'red'
                                      ? 'var(--agent-danger)'
                                      : 'var(--agent-accent)',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </DoctorPanel>
                </div>
              </div>
            ) : null}

            {activeSection === 'appointments' ? (
              <DoctorPanel>
                <DoctorPanelHeader
                  eyebrow="Bookings"
                  title="Appointments"
                  description="Review current bookings, priority levels, and patient details."
                  actions={
                    <>
                      <span className={pageChipButtonClass}>
                        {filteredAppointments.length} visible
                      </span>
                      <span className={pageChipButtonClass}>
                        {appointmentItems.filter((item) => item.priority === 'High').length} high priority
                      </span>
                    </>
                  }
                />

                {filteredAppointments.length === 0 ? (
                  <p className={`mt-5 text-sm ${pageMutedTextClass}`}>
                    No appointments match your search query.
                  </p>
                ) : (
                  <div className="mt-5 space-y-3">
                    {filteredAppointments.map((appointment) => {
                      const displayName = dataMaskingEnabled
                        ? maskPersonName(appointment.patientName)
                        : appointment.patientName
                      const displayId = dataMaskingEnabled
                        ? maskIdentifier(appointment.id)
                        : appointment.id

                      return (
                        <div
                          key={appointment.id}
                          className="rounded-[1rem] border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] px-4 py-4 transition hover:shadow-[var(--card-shadow-soft)]"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className={`truncate text-base font-semibold ${pageHeadingTextClass}`}>
                                  {displayName}
                                </p>
                                {appointment.flagged ? (
                                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" />
                                ) : null}
                              </div>
                              <p className={`mt-1 text-xs ${pageMutedTextClass}`}>{displayId}</p>
                              <p className={`mt-3 text-sm ${pageMutedTextClass}`}>{appointment.symptoms}</p>
                              <div className={`mt-3 flex flex-wrap items-center gap-2 text-xs ${pageMutedTextClass}`}>
                                <span>{appointment.department}</span>
                                <span>•</span>
                                <span>{formatDateTime(appointment.requestedTime)}</span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityChipClass(appointment.priority)}`}
                              >
                                {appointment.priority}
                              </span>
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${reservationStatusChipClass(appointment.status)}`}
                              >
                                {appointment.status}
                              </span>
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${queueStatusChipClass(appointment.queueStatus)}`}
                              >
                                {appointment.queueStatus}
                              </span>
                              <button
                                type="button"
                                className={compactPrimaryButtonClass}
                                onClick={() => handleOpenAppointment(appointment)}
                              >
                                Open chart
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </DoctorPanel>
            ) : null}

            {activeSection === 'calendar' ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <DoctorPanel>
                  <DoctorPanelHeader
                    eyebrow="Calendar"
                    title="Monthly calendar"
                    description="Pending appointments grouped by weekday and date."
                    actions={
                      <>
                        <button
                          type="button"
                          className={compactGhostButtonClass}
                          onClick={() =>
                            setCalendarViewDate(
                              (previous) =>
                                new Date(previous.getFullYear(), previous.getMonth() - 1, 1)
                            )
                          }
                        >
                          <ChevronLeftIcon className="h-4 w-4" />
                          Prev
                        </button>
                        <input
                          type="month"
                          value={formatMonthInputValue(calendarViewDate)}
                          onChange={(event) => {
                            const [year, month] = event.target.value.split('-').map(Number)
                            if (!year || !month) return
                            setCalendarViewDate(new Date(year, month - 1, 1))
                          }}
                          className={compactFieldClass}
                        />
                        <button
                          type="button"
                          className={compactGhostButtonClass}
                          onClick={() =>
                            setCalendarViewDate(
                              (previous) =>
                                new Date(previous.getFullYear(), previous.getMonth() + 1, 1)
                            )
                          }
                        >
                          Next
                          <ChevronRightIcon className="h-4 w-4" />
                        </button>
                      </>
                    }
                  />

                  <div className="mt-5 overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
                            <th
                              key={label}
                              className={`border border-[color:var(--card-border)] bg-[color:var(--agent-bg)] px-2 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] ${pageSubtleTextClass}`}
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: calendarView.cells.length / 7 }, (_, rowIndex) => (
                          <tr key={`week-${rowIndex}`}>
                            {calendarView.cells
                              .slice(rowIndex * 7, rowIndex * 7 + 7)
                              .map((cell, columnIndex) => (
                                <td
                                  key={`cell-${rowIndex}-${columnIndex}`}
                                  className="h-32 align-top border border-[color:var(--card-border)] p-2"
                                >
                                  {cell ? (
                                    <div className="flex h-full min-h-0 flex-col">
                                      <p className={`text-sm font-semibold ${pageHeadingTextClass}`}>
                                        {cell.day}
                                      </p>
                                      {cell.appointments.length > 0 ? (
                                        <div className="mt-2 max-h-20 space-y-1.5 overflow-y-auto pr-1">
                                          {cell.appointments.slice(0, 3).map((appointment) => (
                                            <button
                                              key={appointment.id}
                                              type="button"
                                              className="block w-full rounded-md border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] px-2 py-1 text-left transition hover:bg-[color:var(--agent-overlay)]"
                                              onClick={() => {
                                                const matched = appointmentItems.find(
                                                  (item) => item.id === appointment.id
                                                )
                                                if (matched) handleOpenAppointment(matched)
                                              }}
                                            >
                                              <p className={`text-[11px] font-semibold ${pageHeadingTextClass}`}>
                                                {formatTime(appointment.requestedTime)}
                                              </p>
                                              <p className={`text-[11px] ${pageMutedTextClass}`}>
                                                {dataMaskingEnabled
                                                  ? maskPersonName(appointment.patientName)
                                                  : appointment.patientName}
                                              </p>
                                            </button>
                                          ))}
                                          {cell.appointments.length > 3 ? (
                                            <p className={`text-[11px] font-semibold ${pageSubtleTextClass}`}>
                                              +{cell.appointments.length - 3} more
                                            </p>
                                          ) : null}
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </td>
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DoctorPanel>

                <DoctorPanel>
                  <DoctorPanelHeader
                    eyebrow="Agenda"
                    title={calendarView.monthLabel}
                    description="Upcoming appointments in the currently selected month."
                    actions={
                      <span className={pageChipButtonClass}>
                        {calendarView.appointmentsThisMonth} this month
                      </span>
                    }
                  />

                  {monthAgendaItems.length === 0 ? (
                    <p className={`mt-5 text-sm ${pageMutedTextClass}`}>
                      No pending appointments for this month.
                    </p>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {monthAgendaItems.map((appointment) => {
                        const matched = appointmentItems.find((item) => item.id === appointment.id)

                        return (
                          <button
                            key={appointment.id}
                            type="button"
                            className="block w-full rounded-[1rem] border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] px-4 py-4 text-left transition hover:shadow-[var(--card-shadow-soft)]"
                            onClick={() => {
                              if (matched) handleOpenAppointment(matched)
                            }}
                          >
                            <p className={`text-sm font-semibold ${pageHeadingTextClass}`}>
                              {dataMaskingEnabled
                                ? maskPersonName(appointment.patientName)
                                : appointment.patientName}
                            </p>
                            <p className={`mt-1 text-xs ${pageMutedTextClass}`}>
                              {appointment.department}
                            </p>
                            <p className={`mt-3 text-sm ${pageMutedTextClass}`}>
                              {formatDateTime(appointment.requestedTime)}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </DoctorPanel>
              </div>
            ) : null}

            {activeSection === 'schedule' ? (
              <DoctorPanel>
                <DoctorPanelHeader
                  eyebrow="Publishing"
                  title="Weekly availability schedule"
                  description="Publish your morning and afternoon sessions by week. Patients can only book available one-hour slots from this schedule."
                  actions={
                    <>
                      <span className={pageChipButtonClass}>
                        {scheduleHasPublishedWeek ? 'Published' : 'Draft'}
                      </span>
                      <span className={pageChipButtonClass}>
                        {scheduleHasEnabledSession ? 'Open sessions active' : 'All sessions closed'}
                      </span>
                    </>
                  }
                />

                <div className="mt-5 grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
                  <button
                    type="button"
                    className={compactGhostButtonClass}
                    onClick={() => shiftScheduleWeek(-7)}
                    disabled={isScheduleLoading || isSavingSchedule}
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                    Previous week
                  </button>
                  <input
                    type="date"
                    value={scheduleWeekStart}
                    onChange={(event) => {
                      setScheduleWeekStart(normalizeWeekInputValue(event.target.value))
                      setScheduleMessage(null)
                      if (scheduleError) setScheduleError(null)
                    }}
                    className={compactFieldClass}
                    disabled={isScheduleLoading || isSavingSchedule}
                  />
                  <button
                    type="button"
                    className={compactGhostButtonClass}
                    onClick={() => shiftScheduleWeek(7)}
                    disabled={isScheduleLoading || isSavingSchedule}
                  >
                    Next week
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={compactGhostButtonClass}
                    onClick={() => {
                      setScheduleWeekStart(buildDefaultScheduleWeek())
                      setScheduleMessage(null)
                      if (scheduleError) setScheduleError(null)
                    }}
                    disabled={isScheduleLoading || isSavingSchedule}
                  >
                    This week
                  </button>
                </div>

                <p className={`mt-4 text-xs ${pageSubtleTextClass}`}>
                  Week starts on Monday. Morning session: 8:00 AM - 12:00 PM. Afternoon session:
                  1:30 PM - 5:00 PM.
                </p>
                <p className={`mt-1 text-xs ${pageSubtleTextClass}`}>
                  Schedule status: {scheduleHasPublishedWeek ? 'Published' : 'Not published'} ·{' '}
                  {scheduleHasEnabledSession ? 'Has open sessions' : 'All sessions closed'}
                </p>

                <div className="mt-5 overflow-x-auto">
                  <table className="min-w-[720px] w-full border-collapse">
                    <thead>
                      <tr>
                        <th className={`border border-[color:var(--card-border)] bg-[color:var(--agent-bg)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] ${pageSubtleTextClass}`}>
                          Day
                        </th>
                        <th className={`border border-[color:var(--card-border)] bg-[color:var(--agent-bg)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] ${pageSubtleTextClass}`}>
                          Morning
                        </th>
                        <th className={`border border-[color:var(--card-border)] bg-[color:var(--agent-bg)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] ${pageSubtleTextClass}`}>
                          Afternoon
                        </th>
                        <th className={`border border-[color:var(--card-border)] bg-[color:var(--agent-bg)] px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.14em] ${pageSubtleTextClass}`}>
                          Slot preview
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleDayOrder.map((dayKey) => (
                        <tr key={dayKey}>
                          <td className={`border border-[color:var(--card-border)] px-3 py-3 text-sm font-semibold ${pageHeadingTextClass}`}>
                            {scheduleDayLabels[dayKey]}
                          </td>
                          <td className="border border-[color:var(--card-border)] px-3 py-3">
                            <label className={`inline-flex items-center gap-2 text-sm ${pageHeadingTextClass}`}>
                              <input
                                type="checkbox"
                                checked={Boolean(scheduleDraft[dayKey]?.morning)}
                                onChange={() => toggleScheduleSession(dayKey, 'morning')}
                                disabled={isScheduleLoading || isSavingSchedule}
                              />
                              Open
                            </label>
                          </td>
                          <td className="border border-[color:var(--card-border)] px-3 py-3">
                            <label className={`inline-flex items-center gap-2 text-sm ${pageHeadingTextClass}`}>
                              <input
                                type="checkbox"
                                checked={Boolean(scheduleDraft[dayKey]?.afternoon)}
                                onChange={() => toggleScheduleSession(dayKey, 'afternoon')}
                                disabled={isScheduleLoading || isSavingSchedule}
                              />
                              Open
                            </label>
                          </td>
                          <td className={`border border-[color:var(--card-border)] px-3 py-3 text-xs ${pageMutedTextClass}`}>
                            {(scheduleWeekSlots[dayKey] || []).length > 0
                              ? scheduleWeekSlots[dayKey].map((slot) => slot.label).join(', ')
                              : 'No slots'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {scheduleError ? (
                  <p className="mt-4 text-xs font-semibold text-rose-500">{scheduleError}</p>
                ) : null}
                {scheduleMessage ? (
                  <p className="mt-4 text-xs font-semibold text-emerald-600">{scheduleMessage}</p>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={pagePrimaryButtonClass}
                    onClick={() => {
                      void handleSaveWeeklySchedule()
                    }}
                    disabled={isScheduleLoading || isSavingSchedule}
                  >
                    {isSavingSchedule ? 'Saving...' : 'Publish schedule'}
                  </button>
                  <button
                    type="button"
                    className={pageGhostButtonClass}
                    onClick={() => {
                      void loadDoctorScheduleForWeek(scheduleWeekStart)
                      setScheduleMessage(null)
                    }}
                    disabled={isScheduleLoading || isSavingSchedule}
                  >
                    {isScheduleLoading ? 'Refreshing...' : 'Reload week'}
                  </button>
                </div>
              </DoctorPanel>
            ) : null}

            {activeSection === 'queue' ? (
              <DoctorPanel>
                <DoctorPanelHeader
                  eyebrow="Queue"
                  title="Patient queue timeline"
                  description="Dynamic timeline of today’s slots with triage flags, status toggles, and quick checkup history."
                  actions={
                    <>
                      <span className={pageChipButtonClass}>
                        {activeQueueItems.length} patients
                      </span>
                      <span className={pageChipButtonClass}>
                        Arrived {activeQueueItems.filter((item) => item.queueStatus === 'Arrived').length}
                      </span>
                    </>
                  }
                />

                <div className="mt-5">
                  {filteredQueueItems.length === 0 ? (
                    <p className={`text-sm ${pageMutedTextClass}`}>
                      No pending patients in the queue.
                    </p>
                  ) : (
                    <div className="divide-y divide-[color:var(--card-border)] overflow-hidden rounded-[1rem] border border-[color:var(--card-border)] bg-[color:var(--agent-surface)]">
                      {filteredQueueItems.map((item) => {
                        const displayName = dataMaskingEnabled
                          ? maskPersonName(item.patientName)
                          : item.patientName

                        return (
                          <div
                            key={item.id}
                            className="flex flex-col gap-4 px-5 py-4 transition hover:bg-[color:var(--agent-overlay)] sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="group relative min-w-0 flex-1">
                              <div className="flex items-center gap-4">
                                <div
                                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                    item.priority === 'High'
                                      ? 'bg-rose-500'
                                      : item.priority === 'Routine'
                                        ? 'bg-amber-400'
                                        : 'bg-emerald-500'
                                  }`}
                                />
                                <div className="min-w-0">
                                  <p className={`truncate text-sm font-medium ${pageHeadingTextClass}`}>
                                    {displayName}
                                  </p>
                                  <p className={`mt-1 truncate text-xs ${pageMutedTextClass}`}>
                                    {dataMaskingEnabled ? maskIdentifier(item.id) : item.id} · {item.department} ·{' '}
                                    {formatTime(item.requestedTime)}
                                  </p>
                                </div>
                              </div>

                              <div className="pointer-events-none absolute left-0 top-full z-10 mt-2 hidden w-72 rounded-[1rem] border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-3 shadow-[var(--card-shadow-soft)] group-hover:block">
                                <p className={`text-[11px] font-semibold uppercase tracking-[0.15em] ${pageSubtleTextClass}`}>
                                  Last checkups
                                </p>
                                <div className="mt-2 space-y-1">
                                  {item.checkupHistory.length > 0 ? (
                                    item.checkupHistory.slice(0, 3).map((history) => (
                                      <p
                                        key={`${item.id}-${history.visitDate}`}
                                        className={`text-xs ${pageMutedTextClass}`}
                                      >
                                        {formatDateTime(history.visitDate)} · {history.primaryDiagnosis}
                                      </p>
                                    ))
                                  ) : (
                                    <p className={`text-xs ${pageMutedTextClass}`}>
                                      No prior visit record.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${queueStatusChipClass(item.queueStatus)}`}
                              >
                                {item.queueStatus}
                              </span>
                              <select
                                value={item.queueStatus}
                                onChange={(event) => {
                                  void handleQueueStatusChange(
                                    item.id,
                                    event.target.value as DoctorQueueStatus
                                  )
                                }}
                                disabled={statusSavingId === item.id}
                                className={`${compactFieldClass} w-40 text-xs`}
                              >
                                {queueStatusOptions.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className={compactPrimaryButtonClass}
                                onClick={() => handleOpenAppointment(item)}
                              >
                                Open chart
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </DoctorPanel>
            ) : null}

            {activeSection === 'analytics' ? (
              <DoctorPanel>
                <DoctorPanelHeader
                  eyebrow="Insights"
                  title="Analytics overview"
                  description="Department load, completion rates, and current appointment distribution."
                  actions={
                    <span className={pageChipButtonClass}>
                      {appointmentItems.length} total appointments
                    </span>
                  }
                />

                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-[1rem] border border-[color:var(--card-border)] bg-[color:var(--agent-bg)] p-5">
                    <h3 className={`text-sm font-semibold ${pageHeadingTextClass}`}>
                      Department breakdown
                    </h3>
                    <p className={`mt-1 text-xs ${pageMutedTextClass}`}>
                      Appointment distribution across departments.
                    </p>

                    {departmentBreakdown.length > 0 ? (
                      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                        {departmentBreakdown.map((item) => (
                          <div key={item.department} className="flex flex-col items-center gap-3">
                            <div className="flex h-44 items-end">
                              <div
                                className="w-14 rounded-t-xl bg-[color:var(--agent-accent)]"
                                style={{
                                  height: `${Math.max((item.count / maxDepartmentCount) * 176, 28)}px`,
                                }}
                              />
                            </div>
                            <div className="text-center">
                              <p className={`text-xs font-semibold ${pageHeadingTextClass}`}>
                                {item.department}
                              </p>
                              <p className={`mt-1 text-xs ${pageMutedTextClass}`}>
                                {item.count} appointments
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className={`mt-8 text-sm ${pageMutedTextClass}`}>
                        No department data available.
                      </p>
                    )}
                  </div>

                  <div className="rounded-[1rem] border border-[color:var(--card-border)] bg-[color:var(--agent-bg)] p-5">
                    <h3 className={`text-sm font-semibold ${pageHeadingTextClass}`}>
                      Status distribution
                    </h3>
                    <p className={`mt-1 text-xs ${pageMutedTextClass}`}>
                      Current appointment status breakdown.
                    </p>

                    <div className="mt-6 space-y-4">
                      {statusBreakdown.map((status) => (
                        <div key={status.label}>
                          <div className="flex items-center justify-between gap-3">
                            <span className={`text-sm ${pageHeadingTextClass}`}>{status.label}</span>
                            <span className={`text-sm font-semibold ${pageHeadingTextClass}`}>
                              {status.count}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-3">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[color:var(--agent-overlay)]">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${
                                    appointmentItems.length > 0
                                      ? (status.count / appointmentItems.length) * 100
                                      : 0
                                  }%`,
                                  background:
                                    status.tone === 'green'
                                      ? 'var(--agent-success)'
                                      : status.tone === 'red'
                                        ? 'var(--agent-danger)'
                                        : 'var(--agent-accent)',
                                }}
                              />
                            </div>
                            <span className={`w-8 text-right text-sm font-semibold ${pageHeadingTextClass}`}>
                              {status.count}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </DoctorPanel>
            ) : null}

            {activeSection === 'settings' ? (
              <div className="space-y-4">
                <DoctorPanel>
                  <DoctorPanelHeader
                    eyebrow="Profile"
                    title="Profile details"
                    description="Update your display name for this account."
                    actions={<span className={pageChipButtonClass}>{profileName}</span>}
                  />

                  <form
                    className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)]"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void handleSaveProfileName()
                    }}
                  >
                    <div className="rounded-[1rem] border border-[color:var(--card-border)] bg-[color:var(--agent-bg)] p-4">
                      <p className={`text-[11px] font-semibold uppercase tracking-[0.15em] ${pageSubtleTextClass}`}>
                        Account
                      </p>
                      <p className={`mt-2 text-sm font-semibold ${pageHeadingTextClass}`}>
                        {authUser?.username ?? 'Unknown'}
                      </p>
                      <p className={`mt-4 text-[11px] font-semibold uppercase tracking-[0.15em] ${pageSubtleTextClass}`}>
                        Role
                      </p>
                      <p className={`mt-2 text-sm font-semibold ${pageHeadingTextClass}`}>
                        {getRoleLabel(authUser?.role)}
                      </p>
                    </div>

                    <div className="rounded-[1rem] border border-[color:var(--card-border)] bg-[color:var(--agent-bg)] p-4">
                      <label
                        htmlFor="doctor-profile-name"
                        className={`text-[11px] font-semibold uppercase tracking-[0.15em] ${pageSubtleTextClass}`}
                      >
                        Display name
                      </label>
                      <input
                        id="doctor-profile-name"
                        value={profileNameDraft}
                        onChange={(event) => {
                          setProfileNameDraft(event.target.value)
                          if (profileError) setProfileError(null)
                          if (profileMessage) setProfileMessage(null)
                        }}
                        placeholder="Enter your full name"
                        className={`mt-3 ${pageFieldClass}`}
                      />
                      {profileError ? (
                        <p className="mt-3 text-xs font-semibold text-rose-500">{profileError}</p>
                      ) : null}
                      {profileMessage ? (
                        <p className="mt-3 text-xs font-semibold text-emerald-600">{profileMessage}</p>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="submit"
                          className={pagePrimaryButtonClass}
                          disabled={isSavingProfile}
                        >
                          {isSavingProfile ? 'Saving...' : 'Save name'}
                        </button>
                        <button
                          type="button"
                          className={pageGhostButtonClass}
                          onClick={() => {
                            setProfileNameDraft(profileName)
                            setProfileError(null)
                            setProfileMessage(null)
                          }}
                          disabled={isSavingProfile}
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </form>
                </DoctorPanel>

                <DoctorPanel>
                  <DoctorPanelHeader
                    eyebrow="Security"
                    title="Change password"
                    description="Use a strong password to keep your account secure."
                    actions={<span className={pageChipButtonClass}>Protected session</span>}
                  />

                  <form
                    className="mt-5 grid gap-3 lg:grid-cols-3"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void handleSavePassword()
                    }}
                  >
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(event) => {
                        setCurrentPassword(event.target.value)
                        if (passwordError) setPasswordError(null)
                        if (passwordMessage) setPasswordMessage(null)
                      }}
                      placeholder="Current password"
                      className={pageFieldClass}
                    />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => {
                        setNewPassword(event.target.value)
                        if (passwordError) setPasswordError(null)
                        if (passwordMessage) setPasswordMessage(null)
                      }}
                      placeholder="New password"
                      className={pageFieldClass}
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value)
                        if (passwordError) setPasswordError(null)
                        if (passwordMessage) setPasswordMessage(null)
                      }}
                      placeholder="Confirm password"
                      className={pageFieldClass}
                    />
                  </form>

                  {passwordError ? (
                    <p className="mt-4 text-xs font-semibold text-rose-500">{passwordError}</p>
                  ) : null}
                  {passwordMessage ? (
                    <p className="mt-4 text-xs font-semibold text-emerald-600">{passwordMessage}</p>
                  ) : null}

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className={pagePrimaryButtonClass}
                      onClick={() => {
                        void handleSavePassword()
                      }}
                      disabled={isSavingPassword}
                    >
                      {isSavingPassword ? 'Updating...' : 'Update password'}
                    </button>
                    <p className={`text-xs ${pageSubtleTextClass}`}>
                      Minimum 8 characters with uppercase, lowercase, number, and symbol.
                    </p>
                  </div>
                </DoctorPanel>

                <DoctorPanel>
                  <DoctorPanelHeader
                    eyebrow="Preferences"
                    title="Session preferences"
                    description="Adjust your theme and review the current doctor session status."
                    actions={<span className={pageChipButtonClass}>Session {sessionStatus}</span>}
                  />

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <DoctorMetricCard
                      key="settings-theme-card"
                      label="Theme"
                      value={theme === 'dark' ? 'Dark' : 'Light'}
                      subtitle="Current theme"
                      tone="blue"
                    />
                    <DoctorMetricCard
                      key="settings-session-card"
                      label="Session"
                      value={sessionStatus}
                      subtitle="Current status"
                      tone="green"
                    />
                    <DoctorMetricCard
                      key="settings-queue-card"
                      label="Active queue"
                      value={activeQueueItems.length}
                      subtitle="Patients in queue"
                      tone="amber"
                    />
                    <DoctorMetricCard
                      key="settings-completion-card"
                      label="Completion"
                      value={`${completionRate}%`}
                      subtitle="Recorded vs total"
                      tone="slate"
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button type="button" className={pageGhostButtonClass} onClick={onToggleTheme}>
                      Switch to {theme === 'dark' ? 'Light' : 'Dark'} theme
                    </button>
                  </div>
                </DoctorPanel>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      {selectedAppointment && showAppointmentDetail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className={`${pagePanelClass} max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${pageSubtleTextClass}`}>
                  Appointment detail
                </p>
                <h2 className={`mt-2 text-2xl font-bold ${pageHeadingTextClass}`}>
                  {dataMaskingEnabled
                    ? maskPersonName(selectedAppointment.patientName)
                    : selectedAppointment.patientName}
                </h2>
                <p className={`mt-2 text-sm ${pageMutedTextClass}`}>
                  {selectedAppointment.department} · {formatDateTime(selectedAppointment.requestedTime)}
                </p>
              </div>
              <button
                type="button"
                className={pageGhostButtonClass}
                onClick={() => setShowAppointmentDetail(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1rem] border border-[color:var(--card-border)] bg-[color:var(--agent-bg)] p-4">
                <p className={`text-[11px] font-semibold uppercase tracking-[0.15em] ${pageSubtleTextClass}`}>
                  Appointment status
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${reservationStatusChipClass(selectedAppointment.status)}`}
                  >
                    {selectedAppointment.status}
                  </span>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${queueStatusChipClass(selectedAppointment.queueStatus)}`}
                  >
                    {selectedAppointment.queueStatus}
                  </span>
                </div>
              </div>
              <div className="rounded-[1rem] border border-[color:var(--card-border)] bg-[color:var(--agent-bg)] p-4">
                <p className={`text-[11px] font-semibold uppercase tracking-[0.15em] ${pageSubtleTextClass}`}>
                  Priority
                </p>
                <p className="mt-3">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityChipClass(selectedAppointment.priority)}`}
                  >
                    {selectedAppointment.priority}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-6">
              <p className={`text-[11px] font-semibold uppercase tracking-[0.15em] ${pageSubtleTextClass}`}>
                Symptoms and chief complaint
              </p>
              <p className={`mt-3 text-sm ${pageMutedTextClass}`}>{selectedAppointment.symptoms}</p>
            </div>

            <div className="mt-6">
              <button
                type="button"
                className={pageGhostButtonClass}
                onClick={() => {
                  void handleLoadPatientProfile()
                }}
                disabled={isPatientProfileLoading}
              >
                {isPatientProfileLoading ? 'Loading patient profile...' : 'View patient profile'}
              </button>
              {patientProfileError ? (
                <p className="mt-3 text-xs font-semibold text-rose-500">{patientProfileError}</p>
              ) : null}
              {patientProfile ? (
                <section className="mt-4 rounded-[1rem] border border-[color:var(--card-border)] bg-[color:var(--agent-bg)] p-4">
                  <h3 className={`text-sm font-semibold ${pageHeadingTextClass}`}>Patient profile</h3>
                  <p className={`mt-2 text-sm ${pageMutedTextClass}`}>
                    {`${patientProfile.patient.firstName} ${patientProfile.patient.lastName}`.trim()} ·{' '}
                    {patientProfile.patient.email}
                  </p>
                  <div className={`mt-3 grid gap-2 text-xs sm:grid-cols-2 ${pageMutedTextClass}`}>
                    <p>
                      DOB:{' '}
                      {patientProfile.patient.dateOfBirth
                        ? formatDateTime(patientProfile.patient.dateOfBirth)
                        : 'N/A'}
                    </p>
                    <p>Phone: {patientProfile.patient.phoneNumber || 'N/A'}</p>
                    <p>Gender: {patientProfile.patient.gender || 'N/A'}</p>
                    <p>Blood type: {patientProfile.personalHealthInfo.bloodType || 'N/A'}</p>
                  </div>
                </section>
              ) : null}
            </div>

            <div className="mt-6 space-y-4">
              <section className="rounded-[1rem] border border-[color:var(--card-border)] bg-[color:var(--agent-bg)] p-4">
                <h3 className={`text-sm font-semibold ${pageHeadingTextClass}`}>Digital SOAP notes</h3>
                <p className={`mt-1 text-xs ${pageMutedTextClass}`}>
                  Subjective, Objective, Assessment, and Plan.
                </p>
                <div className="mt-3 space-y-2">
                  <textarea
                    className={pageFieldClass}
                    rows={2}
                    placeholder="Subjective"
                    value={soapNoteDraft.subjective}
                    onChange={(event) =>
                      setSoapNoteDraft((previous) => ({
                        ...previous,
                        subjective: event.target.value,
                      }))
                    }
                  />
                  <textarea
                    className={pageFieldClass}
                    rows={2}
                    placeholder="Objective"
                    value={soapNoteDraft.objective}
                    onChange={(event) =>
                      setSoapNoteDraft((previous) => ({
                        ...previous,
                        objective: event.target.value,
                      }))
                    }
                  />
                  <textarea
                    className={pageFieldClass}
                    rows={2}
                    placeholder="Assessment"
                    value={soapNoteDraft.assessment}
                    onChange={(event) =>
                      setSoapNoteDraft((previous) => ({
                        ...previous,
                        assessment: event.target.value,
                      }))
                    }
                  />
                  <textarea
                    className={pageFieldClass}
                    rows={2}
                    placeholder="Plan"
                    value={soapNoteDraft.plan}
                    onChange={(event) =>
                      setSoapNoteDraft((previous) => ({
                        ...previous,
                        plan: event.target.value,
                      }))
                    }
                  />
                </div>
                {soapSaveError ? (
                  <p className="mt-3 text-xs font-semibold text-rose-500">{soapSaveError}</p>
                ) : null}
                {soapSaveMessage ? (
                  <p className="mt-3 text-xs font-semibold text-emerald-600">{soapSaveMessage}</p>
                ) : null}
                <button
                  type="button"
                  className={`${pagePrimaryButtonClass} mt-4`}
                  onClick={() => {
                    void handleSaveSoapNote()
                  }}
                >
                  Save SOAP note
                </button>
              </section>

              <section className="rounded-[1rem] border border-[color:var(--card-border)] bg-[color:var(--agent-bg)] p-4">
                <h3 className={`text-sm font-semibold ${pageHeadingTextClass}`}>E-prescription module</h3>
                <p className={`mt-1 text-xs ${pageMutedTextClass}`}>
                  Medication search, dosage entry, and frequent shortcuts.
                </p>
                <div className="mt-3 space-y-2">
                  <input
                    className={pageFieldClass}
                    placeholder="Search medication"
                    value={medicationQuery}
                    onChange={(event) => {
                      setMedicationQuery(event.target.value)
                      setPrescriptionDraft((previous) => ({
                        ...previous,
                        medication: event.target.value,
                      }))
                    }}
                  />
                  {medicationMatches.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {medicationMatches.slice(0, 6).map((medication) => (
                        <button
                          key={medication.name}
                          type="button"
                          className={compactGhostButtonClass}
                          onClick={() => {
                            setMedicationQuery(medication.name)
                            setPrescriptionDraft((previous) => ({
                              ...previous,
                              medication: medication.name,
                            }))
                            setMedicationMatches([])
                          }}
                        >
                          {medication.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {frequentPrescriptions.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {frequentPrescriptions.slice(0, 4).map((item) => (
                        <button
                          key={item.medication}
                          type="button"
                          className={compactGhostButtonClass}
                          onClick={() => {
                            setMedicationQuery(item.medication)
                            setPrescriptionDraft((previous) => ({
                              ...previous,
                              medication: item.medication,
                            }))
                          }}
                        >
                          {item.medication}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <input
                    className={pageFieldClass}
                    placeholder="Dosage (e.g. 500mg)"
                    value={prescriptionDraft.dosage ?? ''}
                    onChange={(event) =>
                      setPrescriptionDraft((previous) => ({
                        ...previous,
                        dosage: event.target.value,
                      }))
                    }
                  />
                  <input
                    className={pageFieldClass}
                    placeholder="Frequency (e.g. twice daily)"
                    value={prescriptionDraft.frequency ?? ''}
                    onChange={(event) =>
                      setPrescriptionDraft((previous) => ({
                        ...previous,
                        frequency: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="number"
                    min={1}
                    max={365}
                    className={pageFieldClass}
                    placeholder="Duration (days)"
                    value={prescriptionDraft.durationDays ?? 7}
                    onChange={(event) =>
                      setPrescriptionDraft((previous) => ({
                        ...previous,
                        durationDays: Number(event.target.value) || 1,
                      }))
                    }
                  />
                  <input
                    className={pageFieldClass}
                    placeholder="Instructions"
                    value={prescriptionDraft.instructions ?? ''}
                    onChange={(event) =>
                      setPrescriptionDraft((previous) => ({
                        ...previous,
                        instructions: event.target.value,
                      }))
                    }
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" className={pageGhostButtonClass} onClick={handleAddPrescription}>
                    Add prescription
                  </button>
                  <button
                    type="button"
                    className={pagePrimaryButtonClass}
                    onClick={() => {
                      void handleSavePrescriptions()
                    }}
                  >
                    Save e-prescription
                  </button>
                </div>
                {pendingPrescriptions.length > 0 ? (
                  <div className="mt-4 space-y-1">
                    {pendingPrescriptions.map((item, index) => (
                      <p key={`${item.medication}-${index}`} className={`text-xs ${pageMutedTextClass}`}>
                        {item.medication} - {item.dosage}
                        {item.frequency ? ` - ${item.frequency}` : ''}
                      </p>
                    ))}
                  </div>
                ) : null}
                {prescriptionError ? (
                  <p className="mt-3 text-xs font-semibold text-rose-500">{prescriptionError}</p>
                ) : null}
                {prescriptionMessage ? (
                  <p className="mt-3 text-xs font-semibold text-emerald-600">{prescriptionMessage}</p>
                ) : null}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </PageCanvas>
  )
}

export default DoctorDashboardPage

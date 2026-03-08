import { useEffect, useMemo, useState } from 'react'
import WorkspaceCanvas from '../components/layout/WorkspaceCanvas'
import Sidebar, { type SidebarItem } from '../components/layout/Sidebar'
import WorkspaceSidebarShell from '../components/layout/WorkspaceSidebarShell'
import WorkspaceTopShell from '../components/layout/WorkspaceTopShell'
import {
  workspaceAlertErrorClass,
  workspaceAlertSuccessClass,
  workspaceFieldClass,
  workspaceGhostButtonClass,
  workspacePrimaryButtonClass,
} from '../styles/workspaceUi'
import { buildRouteFromCanonicalPath, normalizePath } from '../config/routing'
import {
  getAppointmentsTabPath,
  resolveAppointmentsTabFromPath,
} from '../config/workspaceTabRoutes'
import type { AppPage } from '../types/navigation'
import ConfirmModal from '../components/ui/ConfirmModal'
import type { AuthSession, Reservation, ReservationDraft } from '../types'
import { maskIdentifier, maskPersonName } from '../utils/privacy'
import { getWorkspaceRoleLabel } from '../utils/roles'

type AppointmentsPageProps = {
  reservations: Reservation[]
  authUser: AuthSession['user'] | null
  onNavigate?: (page: AppPage) => void
  onLogout?: () => void
  onCreateReservation?: (draft: ReservationDraft) => Promise<void>
  sessionStatus: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  dataMaskingEnabled: boolean
  onToggleDataMasking: () => void
}

const USER_SIDEBAR_SECTIONS = [
  'booking_appointments',
  'history',
  'notifications',
  'settings',
] as const

type UserSidebarSection = (typeof USER_SIDEBAR_SECTIONS)[number]

type NotificationPreferences = {
  emailAlerts: boolean
  browserAlerts: boolean
  appointmentReminders: boolean
  securityAlerts: boolean
}

const sidebarItems: SidebarItem[] = [
  { key: 'booking_appointments', label: 'Booking Appointments', icon: 'calendar' },
  { key: 'history', label: 'History', icon: 'report' },
]

const utilityItems: SidebarItem[] = [
  { key: 'notifications', label: 'Notifications', icon: 'alert' },
  { key: 'settings', label: 'Account Settings', icon: 'settings' },
]

const notificationPrefKey = 'pulse-ledger-notification-preferences'
const defaultNotificationPrefs: NotificationPreferences = {
  emailAlerts: true,
  browserAlerts: true,
  appointmentReminders: true,
  securityAlerts: true,
}

const meetsPasswordPolicy = (value: string) => {
  if (value.length < 8) return false
  if (!/[A-Z]/.test(value)) return false
  if (!/[a-z]/.test(value)) return false
  if (!/\d/.test(value)) return false
  return true
}

const departmentOptions = [
  'General Medicine',
  'Cardiology',
  'Orthopedics',
  'Neurology',
  'Dermatology',
  'Pediatrics',
] as const

const formatDateInput = (value: Date) => {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

const buildDefaultRequestedTime = () => {
  const nextHour = new Date(Date.now() + 60 * 60 * 1000)
  nextHour.setMinutes(Math.ceil(nextHour.getMinutes() / 15) * 15, 0, 0)
  return formatDateInput(nextHour)
}

const resolvePatientDisplayName = (user: AuthSession['user'] | null) => {
  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
  if (fullName) return fullName
  const username = user?.username?.trim()
  if (!username) return 'Patient'
  const normalized = username.includes('@') ? username.split('@')[0] : username
  return normalized || 'Patient'
}

const statusBadgeClass = (status: Reservation['status']) => {
  if (status === 'Recorded') return 'agent-status-badge agent-status-badge--success'
  if (status === 'Failed') return 'agent-status-badge agent-status-badge--danger'
  return 'agent-status-badge agent-status-badge--info'
}

const isUserSidebarSection = (key: string): key is UserSidebarSection =>
  USER_SIDEBAR_SECTIONS.includes(key as UserSidebarSection)

const AppointmentsPage = ({
  reservations,
  authUser,
  sessionStatus,
  theme,
  onToggleTheme,
  dataMaskingEnabled,
  onToggleDataMasking,
  onCreateReservation,
  onLogout,
}: AppointmentsPageProps) => {
  const [activeSection, setActiveSection] = useState<UserSidebarSection>(() => {
    if (typeof window === 'undefined') return 'booking_appointments'
    return resolveAppointmentsTabFromPath(window.location.pathname) ?? 'booking_appointments'
  })
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(() => {
    if (typeof window === 'undefined') return defaultNotificationPrefs
    const stored = window.localStorage.getItem(notificationPrefKey)
    if (!stored) return defaultNotificationPrefs
    try {
      return { ...defaultNotificationPrefs, ...JSON.parse(stored) }
    } catch {
      return defaultNotificationPrefs
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(notificationPrefKey, JSON.stringify(notificationPrefs))
  }, [notificationPrefs])

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [bookingDepartment, setBookingDepartment] = useState<(typeof departmentOptions)[number]>(
    'General Medicine'
  )
  const [bookingPriority, setBookingPriority] = useState<Reservation['priority']>('Routine')
  const [bookingRequestedTime, setBookingRequestedTime] = useState(buildDefaultRequestedTime)
  const [bookingSymptoms, setBookingSymptoms] = useState('')
  const [bookingNote, setBookingNote] = useState('')
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [bookingMessage, setBookingMessage] = useState<string | null>(null)
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  const setSection = (next: UserSidebarSection) => {
    setActiveSection(next)
    if (typeof window === 'undefined') return

    const targetPath = getAppointmentsTabPath(next)
    if (normalizePath(window.location.pathname) === normalizePath(targetPath)) return

    window.history.pushState(
      { ...(window.history.state ?? {}), appRoute: true, appPage: 'appointments' },
      '',
      buildRouteFromCanonicalPath(targetPath)
    )
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = () => {
      setActiveSection(resolveAppointmentsTabFromPath(window.location.pathname) ?? 'booking_appointments')
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const sortedReservations = useMemo(
    () =>
      [...reservations].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [reservations]
  )

  const visibleReservations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return sortedReservations

    return sortedReservations.filter((appointment) => {
      return (
        appointment.id.toLowerCase().includes(query) ||
        appointment.patientName.toLowerCase().includes(query) ||
        appointment.department.toLowerCase().includes(query) ||
        appointment.summary.toLowerCase().includes(query)
      )
    })
  }, [searchQuery, sortedReservations])

  const metrics = useMemo(() => {
    const source = sortedReservations
    const booked = source.filter((item) => item.status === 'Booked').length
    const recorded = source.filter((item) => item.status === 'Recorded').length
    const failed = source.filter((item) => item.status === 'Failed').length
    return { total: source.length, booked, recorded, failed }
  }, [sortedReservations])

  const activeBookedAppointment = useMemo(
    () => sortedReservations.find((item) => item.status === 'Booked') ?? null,
    [sortedReservations]
  )

  const submitBooking = async () => {
    setBookingError(null)
    setBookingMessage(null)

    const trimmedSymptoms = bookingSymptoms.trim()
    const trimmedNote = bookingNote.trim()
    if (trimmedSymptoms.length < 5) {
      setBookingError('Add more details in symptoms so the care team can triage your booking.')
      return
    }

    const parsedTime = new Date(bookingRequestedTime)
    if (Number.isNaN(parsedTime.getTime())) {
      setBookingError('Select a valid preferred date and time.')
      return
    }

    if (parsedTime.getTime() <= Date.now()) {
      setBookingError('Preferred date and time must be in the future.')
      return
    }

    if (!onCreateReservation) {
      setBookingError('Booking service is not available in this session.')
      return
    }

    const draft: ReservationDraft = {
      patientName: resolvePatientDisplayName(authUser),
      symptoms: trimmedSymptoms,
      requestedTime: parsedTime.toISOString(),
      summary: {
        department: bookingDepartment,
        priority: bookingPriority,
        confidence: 0.8,
        summary: trimmedNote || trimmedSymptoms,
        symptoms: trimmedSymptoms,
        disclaimer: 'Submitted via patient booking workspace.',
        source: 'rules',
      },
    }

    setIsSubmittingBooking(true)
    try {
      await onCreateReservation(draft)
      setBookingMessage('Booking appointment submitted successfully.')
      setBookingSymptoms('')
      setBookingNote('')
      setBookingRequestedTime(buildDefaultRequestedTime())
      setSection('history')
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'Unable to submit booking right now.')
    } finally {
      setIsSubmittingBooking(false)
    }
  }

  const renderBookingAppointments = () => (
    <section className="grid gap-4 xl:grid-cols-[1.06fr_0.94fr]">
      <form
        className="reference-card p-5"
        onSubmit={(event) => {
          event.preventDefault()
          void submitBooking()
        }}
      >
        <h2 className="reference-section-title">New booking request</h2>
        <p className="reference-widget-subtle mt-2">
          Enter your preferred schedule and symptoms to submit an appointment request.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
              Department
            </span>
            <select
              value={bookingDepartment}
              onChange={(event) =>
                setBookingDepartment(event.target.value as (typeof departmentOptions)[number])
              }
              className={workspaceFieldClass}
            >
              {departmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
              Priority
            </span>
            <select
              value={bookingPriority}
              onChange={(event) => setBookingPriority(event.target.value as Reservation['priority'])}
              className={workspaceFieldClass}
            >
              <option value="Low">Low</option>
              <option value="Routine">Routine</option>
              <option value="High">High</option>
            </select>
          </label>
        </div>

        <label className="mt-3 block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
            Preferred Date and Time
          </span>
          <input
            type="datetime-local"
            value={bookingRequestedTime}
            min={formatDateInput(new Date())}
            onChange={(event) => setBookingRequestedTime(event.target.value)}
            className={workspaceFieldClass}
          />
        </label>

        <label className="mt-3 block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
            Symptoms
          </span>
          <textarea
            value={bookingSymptoms}
            onChange={(event) => setBookingSymptoms(event.target.value)}
            placeholder="Describe symptoms and how long you've experienced them."
            rows={4}
            className={workspaceFieldClass}
          />
        </label>

        <label className="mt-3 block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--agent-muted-soft)]">
            Additional Notes (optional)
          </span>
          <textarea
            value={bookingNote}
            onChange={(event) => setBookingNote(event.target.value)}
            placeholder="Add anything important for scheduling or care context."
            rows={3}
            className={workspaceFieldClass}
          />
        </label>

        {bookingError ? <p className={`mt-3 ${workspaceAlertErrorClass}`}>{bookingError}</p> : null}
        {bookingMessage ? <p className={`mt-3 ${workspaceAlertSuccessClass}`}>{bookingMessage}</p> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="submit" className={workspacePrimaryButtonClass} disabled={isSubmittingBooking}>
            {isSubmittingBooking ? 'Submitting...' : 'Submit booking appointment'}
          </button>
          <button
            type="button"
            className={workspaceGhostButtonClass}
            onClick={() => setSection('history')}
          >
            View booking history
          </button>
        </div>
      </form>

      <div className="space-y-4">
        <article className="reference-card p-5">
          <h3 className="reference-section-title">Booking checklist</h3>
          <ul className="mt-3 space-y-2 text-sm text-[color:var(--agent-muted)]">
            <li>Choose the department closest to your symptoms.</li>
            <li>Pick a future date and time for the consultation.</li>
            <li>Describe symptoms clearly for faster triage.</li>
          </ul>
        </article>

        <article className="reference-card p-5">
          <h3 className="reference-section-title">Current active booking</h3>
          {activeBookedAppointment ? (
            <div className="mt-3 space-y-2 text-sm text-[color:var(--agent-muted)]">
              <p className="font-semibold text-[color:var(--agent-ink)]">
                {activeBookedAppointment.department}
              </p>
              <p>{new Date(activeBookedAppointment.requestedTime).toLocaleString()}</p>
              <p>{activeBookedAppointment.summary}</p>
              <span className={statusBadgeClass(activeBookedAppointment.status)}>{activeBookedAppointment.status}</span>
            </div>
          ) : (
            <p className="reference-widget-subtle mt-2">
              No active booking yet. Submit your first appointment request from this tab.
            </p>
          )}
        </article>
      </div>
    </section>
  )

  const renderHistoryList = () => {
    if (visibleReservations.length === 0) {
      return (
        <article className="reference-card p-5">
          <h2 className="reference-section-title">No history records found</h2>
          <p className="reference-widget-subtle mt-2">
            {searchQuery
              ? 'No records match this search. Clear or adjust your query.'
              : 'Create your first booking and track status from this page.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={workspacePrimaryButtonClass}
              onClick={() => setSection('booking_appointments')}
            >
              Open booking appointments
            </button>
            {searchQuery ? (
              <button
                type="button"
                className={workspaceGhostButtonClass}
                onClick={() => setSearchQuery('')}
              >
                Clear search
              </button>
            ) : null}
          </div>
        </article>
      )
    }

    return (
      <section className="space-y-3">
        {visibleReservations.map((item) => (
          <article key={item.id} className="reference-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.13em] text-[color:var(--agent-muted-soft)]">
                  {dataMaskingEnabled ? maskIdentifier(item.id) : item.id}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-[color:var(--agent-ink)]">
                  {dataMaskingEnabled ? maskPersonName(item.patientName) : item.patientName}
                </h3>
                <p className="mt-1 text-sm text-[color:var(--agent-muted)]">
                  {item.department} · {item.requestedTime}
                </p>
              </div>
              <span className={statusBadgeClass(item.status)}>{item.status}</span>
            </div>
            <p className="mt-3 text-sm text-[color:var(--agent-muted)]">{item.summary}</p>
          </article>
        ))}
      </section>
    )
  }

  const renderNotificationsSection = () => (
    <section className="reference-card p-5">
      <h2 className="reference-section-title">Notifications</h2>
      <p className="reference-widget-subtle mt-2">
        Manage how booking alerts and workspace updates are delivered.
      </p>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="reference-card-soft p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
            Delivery channels
          </p>
          <div className="mt-3 grid gap-2">
            {[
              { key: 'emailAlerts', label: 'Email alerts' },
              { key: 'browserAlerts', label: 'Browser alerts' },
            ].map((item) => {
              const prefKey = item.key as keyof NotificationPreferences
              const active = notificationPrefs[prefKey]
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setNotificationPrefs((prev) => ({ ...prev, [prefKey]: !prev[prefKey] }))}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                    active
                      ? 'border-[color:var(--agent-accent)] bg-[color:var(--agent-accent-soft)] text-[color:var(--agent-ink)]'
                      : 'border-[color:var(--card-border)] bg-[color:var(--agent-surface)] text-[color:var(--agent-muted)] hover:border-[color:var(--agent-line)] hover:text-[color:var(--agent-ink)]'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="reference-card-soft p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
            Booking updates
          </p>
          <div className="mt-3 grid gap-2">
            {[
              { key: 'appointmentReminders', label: 'Appointment reminders' },
              { key: 'securityAlerts', label: 'Security alerts' },
            ].map((item) => {
              const prefKey = item.key as keyof NotificationPreferences
              const active = notificationPrefs[prefKey]
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setNotificationPrefs((prev) => ({ ...prev, [prefKey]: !prev[prefKey] }))}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                    active
                      ? 'border-[color:var(--agent-accent)] bg-[color:var(--agent-accent-soft)] text-[color:var(--agent-ink)]'
                      : 'border-[color:var(--card-border)] bg-[color:var(--agent-surface)] text-[color:var(--agent-muted)] hover:border-[color:var(--agent-line)] hover:text-[color:var(--agent-ink)]'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="reference-card-soft p-4 xl:col-span-2">
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
            Notification status
          </p>
          <p className="mt-2 text-sm text-[color:var(--agent-muted)]">
            Current sync status: <span className="font-semibold text-[color:var(--agent-ink)]">{sessionStatus}</span>
          </p>
          <div className="mt-3">
            <button
              type="button"
              className={workspaceGhostButtonClass}
              onClick={() => setSection('history')}
            >
              View booking history
            </button>
          </div>
        </div>
      </div>
    </section>
  )

  const renderAccountSettingsSection = () => (
    <section className="reference-card p-5">
      <h2 className="reference-section-title">Account settings</h2>
      <p className="reference-widget-subtle mt-2">
        Manage your session controls, privacy preferences, and password.
      </p>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="reference-card-soft p-4">
          <p className="text-sm text-[color:var(--agent-muted)]">
            Signed in as{' '}
            <span className="font-semibold text-[color:var(--agent-ink)]">
              {authUser?.username ?? 'Unknown'}
            </span>
          </p>
          <p className="mt-1 text-sm text-[color:var(--agent-muted)]">
            Role:{' '}
            <span className="font-semibold text-[color:var(--agent-ink)]">
              {getWorkspaceRoleLabel(authUser?.role)} workspace
            </span>
          </p>
          <p className="mt-2 text-xs text-[color:var(--agent-muted-soft)]">Session: {sessionStatus}</p>
        </div>

        <div className="reference-card-soft p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
            Quick controls
          </p>
          <div className="mt-3 grid gap-2">
            <button type="button" className={workspaceGhostButtonClass} onClick={onToggleTheme}>
              Theme: {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
            <button type="button" className={workspaceGhostButtonClass} onClick={onToggleDataMasking}>
              Data masking: {dataMaskingEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        <form
          className="reference-card-soft p-4 xl:col-span-2"
          onSubmit={(event) => {
            event.preventDefault()
            setPasswordError(null)
            setPasswordMessage(null)

            if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
              setPasswordError('Fill in current, new, and confirm password.')
              return
            }

            if (!meetsPasswordPolicy(newPassword.trim())) {
              setPasswordError(
                'New password must be at least 8 characters and include uppercase, lowercase, and number.'
              )
              return
            }

            if (newPassword.trim() !== confirmPassword.trim()) {
              setPasswordError('New password and confirm password do not match.')
              return
            }

            setPasswordMessage('Password updated successfully for this session.')
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
          }}
        >
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
            Change password
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder="Current password"
              className={workspaceFieldClass}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="New password"
              className={workspaceFieldClass}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm password"
              className={workspaceFieldClass}
            />
          </div>
          {passwordError ? <p className={`mt-3 ${workspaceAlertErrorClass}`}>{passwordError}</p> : null}
          {passwordMessage ? <p className={`mt-3 ${workspaceAlertSuccessClass}`}>{passwordMessage}</p> : null}
          <button type="submit" className={`mt-4 ${workspacePrimaryButtonClass}`}>
            Update password
          </button>
        </form>
      </div>
    </section>
  )

  const profileName = authUser?.username ?? 'User'
  const sectionMetaMap: Record<
    UserSidebarSection,
    {
      title: string
      description: string
      searchPlaceholder: string
      showSearch: boolean
      metrics: Array<{ key: string; label: string; value: number | string; caption?: string }>
    }
  > = {
    booking_appointments: {
      title: 'Patient booking workspace',
      description:
        'Submit appointment requests, review the current active booking, and keep booking details complete enough for faster triage.',
      searchPlaceholder: 'Search booking history by id or department',
      showSearch: false,
      metrics: [
        { key: 'total', label: 'Total bookings', value: metrics.total, caption: 'All appointment requests on record' },
        { key: 'booked', label: 'Active booked', value: metrics.booked, caption: 'Current appointment requests awaiting completion' },
        { key: 'status', label: 'Session status', value: sessionStatus, caption: 'Workspace sync and session state' },
        { key: 'privacy', label: 'Data masking', value: dataMaskingEnabled ? 'Enabled' : 'Disabled', caption: 'Identifier masking in the current session' },
      ],
    },
    history: {
      title: 'Appointment history',
      description:
        'Review booking status history, search by patient or department, and keep track of completed or failed requests.',
      searchPlaceholder: 'Search booking history',
      showSearch: true,
      metrics: [
        { key: 'history-total', label: 'Visible records', value: visibleReservations.length, caption: 'Records shown after filtering' },
        { key: 'history-recorded', label: 'Recorded', value: metrics.recorded, caption: 'Requests marked as completed' },
        { key: 'history-failed', label: 'Needs follow-up', value: metrics.failed, caption: 'Requests that did not complete successfully' },
        { key: 'history-query', label: 'Current search', value: searchQuery.trim() || 'All history', caption: 'Active search scope' },
      ],
    },
    notifications: {
      title: 'Notification preferences',
      description:
        'Control delivery channels for appointment reminders, browser updates, and security-related workspace events.',
      searchPlaceholder: 'Search notification preferences',
      showSearch: false,
      metrics: [
        { key: 'alerts-email', label: 'Email alerts', value: notificationPrefs.emailAlerts ? 'On' : 'Off' },
        { key: 'alerts-browser', label: 'Browser alerts', value: notificationPrefs.browserAlerts ? 'On' : 'Off' },
        { key: 'alerts-reminders', label: 'Reminders', value: notificationPrefs.appointmentReminders ? 'On' : 'Off' },
        { key: 'alerts-security', label: 'Security alerts', value: notificationPrefs.securityAlerts ? 'On' : 'Off' },
      ],
    },
    settings: {
      title: 'Patient account settings',
      description:
        'Manage privacy controls, session options, theme mode, and password changes from the same patient workspace.',
      searchPlaceholder: 'Search account settings',
      showSearch: false,
      metrics: [
        { key: 'settings-role', label: 'Workspace', value: `${getWorkspaceRoleLabel(authUser?.role)} workspace` },
        { key: 'settings-theme', label: 'Theme', value: theme === 'dark' ? 'Dark' : 'Light' },
        { key: 'settings-session', label: 'Session', value: sessionStatus },
        { key: 'settings-privacy', label: 'Masking', value: dataMaskingEnabled ? 'On' : 'Off' },
      ],
    },
  }
  const activeMeta = sectionMetaMap[activeSection]

  return (
    <WorkspaceCanvas>
      <div className="w-full">
        <WorkspaceSidebarShell
          className={`workspace-shell--full-side${isSidebarCollapsed ? ' workspace-shell--rail-collapsed' : ''}`}
          contentClassName="px-4 pb-10 pt-5 sm:px-6 lg:px-8"
          mobileTitle="Patient workspace"
          stickyOffsetMode="auto"
          sidebar={
            <Sidebar
              variant="reference"
              mobileMode="drawer"
              fullRail
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed((previous) => !previous)}
              brandTitle="AI Health Care"
              brandSubtitle="Patient workspace"
              sectionLabel="Main"
              items={sidebarItems}
              activeKey={activeSection}
              onSelect={(key) => {
                if (isUserSidebarSection(key)) {
                  setSection(key)
                }
              }}
              auxiliaryLabel="Utilities"
              secondaryItems={utilityItems}
              onSelectAuxiliary={(key) => {
                if (isUserSidebarSection(key)) {
                  setSection(key)
                }
              }}
              footerProfile={{
                name: profileName,
                subtitle: 'Patient workspace',
                onClick: () => setSection('settings'),
              }}
            />
          }
          content={
            <section className="reference-main reference-theme">
              <WorkspaceTopShell
                eyebrow="Patient session"
                title={activeMeta.title}
                description={activeMeta.description}
                searchValue={searchQuery}
                searchPlaceholder={activeMeta.searchPlaceholder}
                onSearchChange={setSearchQuery}
                showSearch={activeMeta.showSearch}
                profileName={profileName}
                profileCaption={`${getWorkspaceRoleLabel(authUser?.role)} workspace`}
                showNotifications
                notificationCount={Math.min(metrics.failed + 1, 99)}
                onSignOut={() => setShowLogoutConfirm(true)}
                metrics={activeMeta.metrics}
                quickActions={
                  <>
                    <button
                      type="button"
                      className={workspacePrimaryButtonClass}
                      onClick={() => setSection('booking_appointments')}
                    >
                      New booking
                    </button>
                    <button
                      type="button"
                      className={workspaceGhostButtonClass}
                      onClick={() => setSection('history')}
                    >
                      View history
                    </button>
                    {activeSection === 'history' && searchQuery ? (
                      <button
                        type="button"
                        className={workspaceGhostButtonClass}
                        onClick={() => setSearchQuery('')}
                      >
                        Clear search
                      </button>
                    ) : null}
                  </>
                }
              />

              {activeSection === 'booking_appointments' ? (
                renderBookingAppointments()
              ) : null}

              {activeSection === 'history' ? renderHistoryList() : null}
              {activeSection === 'notifications' ? renderNotificationsSection() : null}
              {activeSection === 'settings' ? renderAccountSettingsSection() : null}
              <ConfirmModal
                open={showLogoutConfirm}
                title="Confirm logout"
                message="Are you sure you want to logout?"
                confirmLabel="Logout"
                cancelLabel="Cancel"
                onConfirm={() => {
                  setShowLogoutConfirm(false)
                  onLogout?.()
                }}
                onCancel={() => setShowLogoutConfirm(false)}
              />
            </section>
          }
        />
      </div>
    </WorkspaceCanvas>
  )
}

export default AppointmentsPage

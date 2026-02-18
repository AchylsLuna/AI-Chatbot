import { type FormEvent, useEffect, useMemo, useState } from 'react'
import DashboardTopBar from '../../components/layout/DashboardTopBar'
import DashboardWidgetBlocks from '../../components/layout/DashboardWidgetBlocks'
import PaginationControls from '../../components/layout/PaginationControls'
import WorkspaceCanvas from '../../components/layout/WorkspaceCanvas'
import Sidebar, { type SidebarItem } from '../../components/layout/Sidebar'
import {
  workspaceFieldClass,
  workspaceGhostButtonClass,
  workspacePrimaryButtonClass,
} from '../../styles/workspaceUi'
import type { AppPage } from '../../types/navigation'
import type { AuthSession, Reservation, ReservationCreateDraft } from '../../types'
import { maskIdentifier, maskPersonName } from '../../utils/privacy'
import { formatRoleLabel, getWorkspaceRoleLabel } from '../../utils/roles'

type AppointmentsPageProps = {
  reservations: Reservation[]
  authUser: AuthSession['user'] | null
  onNavigate?: (page: AppPage) => void
  onCreateReservation: (draft: ReservationCreateDraft) => Promise<Reservation>
  sessionStatus: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  dataMaskingEnabled: boolean
  onToggleDataMasking: () => void
}

const USER_SIDEBAR_SECTIONS = [
  'dashboard',
  'appointments',
  'notifications',
  'alerts',
  'settings',
] as const

type UserSidebarSection = (typeof USER_SIDEBAR_SECTIONS)[number]

type NotificationPreferences = {
  emailAlerts: boolean
  browserAlerts: boolean
  appointmentReminders: boolean
  securityAlerts: boolean
}

type DoctorMajorOption = {
  name: string
  major: string
}

const sidebarItems: SidebarItem[] = [
  { key: 'dashboard', label: 'Overview', icon: 'home' },
  { key: 'appointments', label: 'Booking Appointment', icon: 'calendar' },
  { key: 'notifications', label: 'History', icon: 'report' },
]

const utilityItems: SidebarItem[] = [
  { key: 'alerts', label: 'Notifications', icon: 'alert' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
]

const notificationPrefKey = 'pulse-ledger-notification-preferences'
const sidebarCollapsedKey = 'pulse-ledger-user-sidebar-collapsed'
const defaultNotificationPrefs: NotificationPreferences = {
  emailAlerts: true,
  browserAlerts: true,
  appointmentReminders: true,
  securityAlerts: true,
}

const doctorMajorDirectory: DoctorMajorOption[] = [
  { name: 'Dr. Mara Santos', major: 'Cardiology' },
  { name: 'Dr. Ian Clarke', major: 'Neurology' },
  { name: 'Dr. Liza Moreno', major: 'Dermatology' },
  { name: 'Dr. Rafiq Noor', major: 'Orthopedics' },
  { name: 'Dr. Mei Tan', major: 'General Medicine' },
]

const meetsPasswordPolicy = (value: string) => {
  if (value.length < 8) return false
  if (!/[A-Z]/.test(value)) return false
  if (!/[a-z]/.test(value)) return false
  if (!/\d/.test(value)) return false
  return true
}

const buildWeeklySeries = (items: Reservation[]) => {
  const buckets = 8
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const now = Date.now()
  const booked = Array.from({ length: buckets }, () => 0)
  const recorded = Array.from({ length: buckets }, () => 0)
  const failed = Array.from({ length: buckets }, () => 0)

  for (const item of items) {
    const timestamp = new Date(item.createdAt).getTime()
    if (Number.isNaN(timestamp)) continue
    const diff = now - timestamp
    const weeksAgo = Math.floor(diff / weekMs)
    const index = buckets - weeksAgo - 1
    if (index < 0 || index >= buckets) continue

    if (item.status === 'Booked') booked[index] += 1
    if (item.status === 'Recorded') recorded[index] += 1
    if (item.status === 'Failed') failed[index] += 1
  }

  const hasData = [...booked, ...recorded, ...failed].some((value) => value > 0)
  if (!hasData) {
    return {
      booked: [4, 6, 5, 7, 8, 7, 5, 4],
      recorded: [2, 3, 4, 4, 5, 4, 3, 2],
      failed: [1, 1, 1, 2, 1, 2, 1, 1],
    }
  }

  return { booked, recorded, failed }
}

const statusBadgeClass = (status: Reservation['status']) => {
  if (status === 'Recorded') return 'bg-emerald-100 text-emerald-700 border-emerald-300/70'
  if (status === 'Failed') return 'bg-rose-100 text-rose-700 border-rose-300/70'
  return 'bg-sky-100 text-sky-700 border-sky-300/70'
}

const PAGINATION_PAGE_SIZE = 10
const MAX_PAGE_BUTTONS = 10

const getPageSlice = <T,>(items: T[], currentPage: number, pageSize = PAGINATION_PAGE_SIZE) => {
  const safePage = Math.max(1, Math.floor(currentPage) || 1)
  const start = (safePage - 1) * pageSize
  return items.slice(start, start + pageSize)
}

const isUserSidebarSection = (key: string): key is UserSidebarSection =>
  USER_SIDEBAR_SECTIONS.includes(key as UserSidebarSection)

const AppointmentsPage = ({
  reservations,
  authUser,
  onCreateReservation,
  sessionStatus,
  theme,
  onToggleTheme,
  dataMaskingEnabled,
  onToggleDataMasking,
}: AppointmentsPageProps) => {
  const [activeSection, setActiveSection] = useState<UserSidebarSection>('dashboard')
  const [searchQuery, setSearchQuery] = useState('')
  const [appointmentsPage, setAppointmentsPage] = useState(1)
  const [historyPage, setHistoryPage] = useState(1)
  const [alertsPage, setAlertsPage] = useState(1)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(sidebarCollapsedKey) === 'true'
  })

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  const [bookingPatientName, setBookingPatientName] = useState('')
  const [bookingSymptoms, setBookingSymptoms] = useState('')
  const [bookingRequestedTime, setBookingRequestedTime] = useState('')
  const [selectedMajor, setSelectedMajor] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState('')
  const [isCreatingBooking, setIsCreatingBooking] = useState(false)
  const [bookingFormError, setBookingFormError] = useState<string | null>(null)
  const [bookingFormSuccess, setBookingFormSuccess] = useState<string | null>(null)

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

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(sidebarCollapsedKey, isSidebarCollapsed ? 'true' : 'false')
  }, [isSidebarCollapsed])

  const majorOptions = useMemo(
    () => Array.from(new Set(doctorMajorDirectory.map((entry) => entry.major))),
    []
  )

  const doctorsForSelectedMajor = useMemo(
    () => doctorMajorDirectory.filter((entry) => entry.major === selectedMajor),
    [selectedMajor]
  )

  useEffect(() => {
    if (!selectedDoctor) return
    if (!doctorsForSelectedMajor.some((entry) => entry.name === selectedDoctor)) {
      setSelectedDoctor('')
    }
  }, [doctorsForSelectedMajor, selectedDoctor])

  const setSection = (next: UserSidebarSection) => {
    if (next !== 'dashboard') {
      setSearchQuery('')
    }
    if (next === 'appointments') {
      setAppointmentsPage(1)
    }
    if (next === 'notifications') {
      setHistoryPage(1)
    }
    if (next === 'alerts') {
      setAlertsPage(1)
    }
    setActiveSection(next)
  }

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
        (appointment.doctorName ?? '').toLowerCase().includes(query) ||
        appointment.summary.toLowerCase().includes(query)
      )
    })
  }, [searchQuery, sortedReservations])

  const appointmentsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(visibleReservations.length / PAGINATION_PAGE_SIZE)),
    [visibleReservations.length]
  )
  const historyTotalPages = useMemo(
    () => Math.max(1, Math.ceil(sortedReservations.length / PAGINATION_PAGE_SIZE)),
    [sortedReservations.length]
  )
  const alertsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(sortedReservations.length / PAGINATION_PAGE_SIZE)),
    [sortedReservations.length]
  )

  useEffect(() => {
    setAppointmentsPage((previous) => Math.min(previous, appointmentsTotalPages))
  }, [appointmentsTotalPages])

  useEffect(() => {
    setHistoryPage((previous) => Math.min(previous, historyTotalPages))
  }, [historyTotalPages])

  useEffect(() => {
    setAlertsPage((previous) => Math.min(previous, alertsTotalPages))
  }, [alertsTotalPages])

  const metrics = useMemo(() => {
    const booked = visibleReservations.filter((item) => item.status === 'Booked').length
    const recorded = visibleReservations.filter((item) => item.status === 'Recorded').length
    const failed = visibleReservations.filter((item) => item.status === 'Failed').length
    return { total: visibleReservations.length, booked, recorded, failed }
  }, [visibleReservations])

  const weeklySeries = useMemo(() => buildWeeklySeries(visibleReservations), [visibleReservations])

  const completionRate = useMemo(() => {
    if (metrics.total === 0) return 0
    return Math.round((metrics.recorded / metrics.total) * 100)
  }, [metrics.recorded, metrics.total])

  const activityItems = useMemo(() => {
    const items = visibleReservations.slice(0, 5).map((item) => ({
      id: item.id,
      title: `${dataMaskingEnabled ? maskPersonName(item.patientName) : item.patientName}`,
      detail: `${item.department} · ${item.status}`,
      meta: new Date(item.createdAt).toLocaleString(),
    }))

    if (items.length > 0) return items

    return [
      {
        id: 'empty-activity',
        title: 'No recent activity yet',
        detail: 'Create your first appointment and track it here.',
        meta: 'Just now',
      },
    ]
  }, [dataMaskingEnabled, visibleReservations])

  const recommendationItems = useMemo(() => {
    const items = visibleReservations.slice(0, 6).map((item) => ({
      id: item.id,
      title: `${item.department} follow-up`,
      subtitle: `${dataMaskingEnabled ? maskIdentifier(item.id) : item.id} · ${item.requestedTime}`,
      detail: item.summary,
      badge: item.status,
    }))

    if (items.length > 0) return items

    return [
      {
        id: 'rec-a',
        title: 'General check-in',
        subtitle: 'Queue availability',
        detail: 'No active bookings yet. Open appointments and create your first booking.',
      },
      {
        id: 'rec-b',
        title: 'Specialist routing',
        subtitle: 'Booking workflow',
        detail: 'Use the appointment workspace to monitor and manage your booking flow.',
      },
    ]
  }, [dataMaskingEnabled, visibleReservations])

  const featuredDoctorItems = useMemo(
    () =>
      doctorMajorDirectory.slice(0, 4).map((entry, index) => ({
        id: `featured-doctor-${index + 1}`,
        title: entry.name,
        subtitle: entry.major,
      })),
    []
  )

  const enabledNotificationChannels = useMemo(
    () => Object.values(notificationPrefs).filter(Boolean).length,
    [notificationPrefs]
  )

  const resetBookingFeedback = () => {
    if (bookingFormError) setBookingFormError(null)
    if (bookingFormSuccess) setBookingFormSuccess(null)
  }

  const handleCreateBooking = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBookingFormError(null)
    setBookingFormSuccess(null)

    const patientName = bookingPatientName.trim()
    const symptoms = bookingSymptoms.trim()
    const requestedTime = bookingRequestedTime.trim()
    const major = selectedMajor.trim()
    const doctorName = selectedDoctor.trim()

    if (!patientName || !symptoms || !requestedTime || !major || !doctorName) {
      setBookingFormError('Patient name, symptoms, requested time, major, and doctor are required.')
      return
    }

    setIsCreatingBooking(true)
    try {
      await onCreateReservation({
        patientName,
        symptoms,
        requestedTime,
        major,
        doctorName,
      })
      setBookingFormSuccess('Booking created successfully.')
      setBookingPatientName('')
      setBookingSymptoms('')
      setBookingRequestedTime('')
      setSelectedMajor('')
      setSelectedDoctor('')
    } catch (error) {
      setBookingFormError(error instanceof Error ? error.message : 'Unable to create booking.')
    } finally {
      setIsCreatingBooking(false)
    }
  }

  const renderBookingForm = () => (
    <form className="reference-card p-5" onSubmit={handleCreateBooking}>
      <h2 className="reference-section-title">Create booking</h2>
      <p className="reference-widget-subtle mt-2">
        Select a major and doctor, then submit full booking details.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          value={bookingPatientName}
          onChange={(event) => {
            resetBookingFeedback()
            setBookingPatientName(event.target.value)
          }}
          placeholder="Patient full name"
          className={workspaceFieldClass}
        />
        <input
          value={bookingRequestedTime}
          onChange={(event) => {
            resetBookingFeedback()
            setBookingRequestedTime(event.target.value)
          }}
          placeholder="Requested time (e.g. 3:00 PM)"
          className={workspaceFieldClass}
        />
        <select
          value={selectedMajor}
          onChange={(event) => {
            resetBookingFeedback()
            setSelectedMajor(event.target.value)
          }}
          className={workspaceFieldClass}
        >
          <option value="">Select major</option>
          {majorOptions.map((major) => (
            <option key={major} value={major}>
              {major}
            </option>
          ))}
        </select>
        <select
          value={selectedDoctor}
          onChange={(event) => {
            resetBookingFeedback()
            setSelectedDoctor(event.target.value)
          }}
          className={workspaceFieldClass}
          disabled={!selectedMajor}
        >
          <option value="">{selectedMajor ? 'Select doctor' : 'Select major first'}</option>
          {doctorsForSelectedMajor.map((entry) => (
            <option key={entry.name} value={entry.name}>
              {entry.name}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={bookingSymptoms}
        onChange={(event) => {
          resetBookingFeedback()
          setBookingSymptoms(event.target.value)
        }}
        placeholder="Symptoms"
        className={`${workspaceFieldClass} mt-3 min-h-[104px]`}
      />

      {bookingFormError ? <p className="mt-3 text-xs font-semibold text-rose-500">{bookingFormError}</p> : null}
      {bookingFormSuccess ? <p className="mt-3 text-xs font-semibold text-emerald-600">{bookingFormSuccess}</p> : null}

      <button
        type="submit"
        disabled={isCreatingBooking}
        className={`${workspacePrimaryButtonClass} mt-4 disabled:cursor-not-allowed disabled:opacity-70`}
      >
        {isCreatingBooking ? 'Creating...' : 'Create booking'}
      </button>
    </form>
  )

  const renderAppointmentsList = () => {
    const pagedReservations = getPageSlice(visibleReservations, appointmentsPage)

    return (
      <section className="space-y-3">
        {renderBookingForm()}

        {visibleReservations.length === 0 ? (
          <article className="reference-card p-5">
            <h2 className="reference-section-title">No appointments found</h2>
            <p className="reference-widget-subtle mt-2">
              {searchQuery
                ? 'No records match this search. Clear or adjust your query.'
                : 'Create your first booking and track status from this page.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={workspacePrimaryButtonClass}
                onClick={() => setSection('dashboard')}
              >
                Back to overview
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
        ) : (
          pagedReservations.map((item) => (
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
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(item.status)}`}>
                  {item.status}
                </span>
              </div>
              <p className="mt-3 text-sm text-[color:var(--agent-muted)]">{item.summary}</p>
            </article>
          ))
        )}

        <PaginationControls
          currentPage={appointmentsPage}
          totalItems={visibleReservations.length}
          pageSize={PAGINATION_PAGE_SIZE}
          maxPageButtons={MAX_PAGE_BUTTONS}
          onPageChange={setAppointmentsPage}
        />
      </section>
    )
  }

  const renderSettings = () => (
    <section className="reference-card p-5">
      <h2 className="reference-section-title">Account settings</h2>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="reference-card-soft p-4">
          <p className="text-sm text-[color:var(--agent-muted)]">
            Signed in as <span className="font-semibold text-[color:var(--agent-ink)]">{authUser?.username ?? 'Unknown'}</span>
          </p>
          <p className="mt-1 text-sm text-[color:var(--agent-muted)]">
            Role:{' '}
            <span className="font-semibold text-[color:var(--agent-ink)]">
              {getWorkspaceRoleLabel(authUser?.role)} workspace
            </span>
          </p>
          <p className="mt-1 text-xs text-[color:var(--agent-muted-soft)]">{formatRoleLabel(authUser?.role)}</p>
          <p className="mt-2 text-xs text-[color:var(--agent-muted-soft)]">Session: {sessionStatus}</p>
        </div>

        <div className="reference-card-soft p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">Quick controls</p>
          <div className="mt-3 grid gap-2">
            <button type="button" className={workspaceGhostButtonClass} onClick={onToggleTheme}>
              Theme: {theme === 'dark' ? 'Dark' : 'Light'}
            </button>
            <button type="button" className={workspaceGhostButtonClass} onClick={onToggleDataMasking}>
              Data masking: {dataMaskingEnabled ? 'On' : 'Off'}
            </button>
          </div>
        </div>

        <div className="reference-card-soft p-4 xl:col-span-2">
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">Notifications</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { key: 'emailAlerts', label: 'Email alerts' },
              { key: 'browserAlerts', label: 'Browser alerts' },
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
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">Change password</p>
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
          {passwordError ? <p className="mt-3 text-xs font-semibold text-rose-500">{passwordError}</p> : null}
          {passwordMessage ? <p className="mt-3 text-xs font-semibold text-emerald-600">{passwordMessage}</p> : null}
          <button type="submit" className={`mt-4 ${workspacePrimaryButtonClass}`}>
            Update password
          </button>
        </form>
      </div>
    </section>
  )

  const renderHistoryTimeline = () => {
    const pagedHistory = getPageSlice(sortedReservations, historyPage)

    return (
      <section className="space-y-3">
        {sortedReservations.length === 0 ? (
          <article className="reference-card p-5">
            <h2 className="reference-section-title">No history yet</h2>
            <p className="reference-widget-subtle mt-2">
              Your booking timeline will appear here after your first appointment is created.
            </p>
          </article>
        ) : (
          pagedHistory.map((item) => (
            <article key={item.id} className="reference-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.13em] text-[color:var(--agent-muted-soft)]">
                    {dataMaskingEnabled ? maskIdentifier(item.id) : item.id}
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[color:var(--agent-ink)]">
                    {dataMaskingEnabled ? maskPersonName(item.patientName) : item.patientName}
                  </h2>
                  <p className="mt-1 text-sm text-[color:var(--agent-muted)]">
                    {item.department} · {item.requestedTime}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--agent-muted-soft)]">
                    Doctor: {item.doctorName ?? 'Unassigned'} · Major: {item.department}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(item.status)}`}>
                  {item.status}
                </span>
              </div>
              <p className="mt-3 text-sm text-[color:var(--agent-muted)]">{item.summary}</p>
              <p className="mt-2 text-xs text-[color:var(--agent-muted-soft)]">
                Logged {new Date(item.createdAt).toLocaleString()}
              </p>
            </article>
          ))
        )}

        <PaginationControls
          currentPage={historyPage}
          totalItems={sortedReservations.length}
          pageSize={PAGINATION_PAGE_SIZE}
          maxPageButtons={MAX_PAGE_BUTTONS}
          onPageChange={setHistoryPage}
        />
      </section>
    )
  }

  const renderNotificationsPanel = () => {
    const pagedAlerts = getPageSlice(sortedReservations, alertsPage)

    return (
      <section className="space-y-3">
        <article className="reference-card p-5">
          <h2 className="reference-section-title">Recent alerts</h2>
          <p className="reference-widget-subtle mt-2">
            Notification channels are managed in Account settings.
          </p>
          {sortedReservations.length === 0 ? (
            <p className="reference-widget-subtle mt-3">No alerts yet. New booking updates will appear here.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {pagedAlerts.map((item) => (
                <div key={`alert-${item.id}`} className="reference-card-soft p-3">
                  <p className="text-xs uppercase tracking-[0.13em] text-[color:var(--agent-muted-soft)]">
                    {dataMaskingEnabled ? maskIdentifier(item.id) : item.id}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[color:var(--agent-ink)]">
                    {dataMaskingEnabled ? maskPersonName(item.patientName) : item.patientName} is now {item.status}.
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--agent-muted)]">
                    {item.department} · {item.requestedTime}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--agent-muted-soft)]">
                    Logged {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </article>

        <PaginationControls
          currentPage={alertsPage}
          totalItems={sortedReservations.length}
          pageSize={PAGINATION_PAGE_SIZE}
          maxPageButtons={MAX_PAGE_BUTTONS}
          onPageChange={setAlertsPage}
        />
      </section>
    )
  }

  const profileName = authUser?.username ?? 'User'
  const sectionTitleMap: Record<UserSidebarSection, string> = {
    dashboard: 'Overview',
    appointments: 'Booking Appointment',
    alerts: 'Notifications',
    settings: 'Account settings',
    notifications: 'History',
  }
  const sectionSearchPlaceholderMap: Record<UserSidebarSection, string> = {
    dashboard: 'Search by appointment id, patient, or department',
    appointments: 'Search appointments',
    alerts: 'Search notifications',
    settings: 'Search settings',
    notifications: 'Search notifications',
  }

  return (
    <WorkspaceCanvas>
      <div className="w-full overflow-x-auto">
        <div
          className={`reference-shell h-screen min-w-[1080px] ${isSidebarCollapsed ? 'reference-shell--sidebar-collapsed' : ''}`}
        >
          <Sidebar
            variant="reference"
            className="self-start"
            heightMode="viewport"
            stickyOffset="compact"
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
            brandTitle="AI Health Care"
            brandSubtitle=""
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
              subtitle: 'Welcome back',
              onClick: () => setSection('settings'),
            }}
          />

          <section className="reference-main h-screen overflow-y-auto px-4 pb-10 pt-5 sm:px-6 lg:px-8">
            {activeSection === 'dashboard' ? (
              <DashboardTopBar
                title={sectionTitleMap[activeSection]}
                searchValue={searchQuery}
                searchPlaceholder={sectionSearchPlaceholderMap[activeSection]}
                onSearchChange={setSearchQuery}
              />
            ) : activeSection !== 'settings' ? (
              <h1 className="reference-page-title">{sectionTitleMap[activeSection]}</h1>
            ) : null}

            {activeSection === 'dashboard' ? (
              <>
                <article className="reference-card p-5">
                  <h2 className="reference-section-title">AI Health Care details</h2>
                  <p className="reference-widget-subtle mt-2">
                    Current overview of booking operations, patient history tracking, and notification visibility.
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-[color:var(--agent-muted)]">
                    <li>Guided booking with patient details, major selection, and doctor assignment.</li>
                    <li>History timeline tracking of booking outcomes and care status updates.</li>
                    <li>Notification channels and recent alert feed for booking events.</li>
                  </ul>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="reference-card-soft p-3">
                      <p className="text-xs uppercase tracking-[0.13em] text-[color:var(--agent-muted-soft)]">
                        Total bookings
                      </p>
                      <p className="mt-1 text-lg font-semibold text-[color:var(--agent-ink)]">{metrics.total}</p>
                    </div>
                    <div className="reference-card-soft p-3">
                      <p className="text-xs uppercase tracking-[0.13em] text-[color:var(--agent-muted-soft)]">
                        Status summary
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[color:var(--agent-ink)]">
                        Booked {metrics.booked} · Recorded {metrics.recorded} · Failed {metrics.failed}
                      </p>
                    </div>
                    <div className="reference-card-soft p-3">
                      <p className="text-xs uppercase tracking-[0.13em] text-[color:var(--agent-muted-soft)]">
                        Channels enabled
                      </p>
                      <p className="mt-1 text-lg font-semibold text-[color:var(--agent-ink)]">
                        {enabledNotificationChannels}/4
                      </p>
                    </div>
                  </div>
                </article>

                <DashboardWidgetBlocks
                  summaryTitle="Care completion"
                  summaryValue={`${completionRate}%`}
                  summaryLabel="Verified"
                  secondaryLabel="Patient flow"
                  showSummaryPanel={false}
                  activityTitle="Recent activities"
                  activityItems={activityItems}
                  chartTitle="Appointment status trend"
                  chartSeries={[
                    { key: 'booked', label: 'Booked', color: '#3b82f6', values: weeklySeries.booked },
                    { key: 'recorded', label: 'Recorded', color: '#10b981', values: weeklySeries.recorded },
                    { key: 'failed', label: 'Failed', color: '#ef4444', values: weeklySeries.failed },
                  ]}
                  recommendationTitle="Recommended care tracks"
                  recommendationItems={recommendationItems}
                  featuredTitle="Featured doctors"
                  featuredItems={featuredDoctorItems}
                />
              </>
            ) : null}

            {activeSection === 'appointments' ? renderAppointmentsList() : null}
            {activeSection === 'settings' ? renderSettings() : null}
            {activeSection === 'alerts' ? renderNotificationsPanel() : null}
            {activeSection === 'notifications' ? renderHistoryTimeline() : null}
          </section>
        </div>
      </div>
    </WorkspaceCanvas>
  )
}

export default AppointmentsPage

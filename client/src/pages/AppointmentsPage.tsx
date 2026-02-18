import { useEffect, useMemo, useState } from 'react'
import DashboardStatStrip from '../components/layout/DashboardStatStrip'
import DashboardTopBar from '../components/layout/DashboardTopBar'
import DashboardWidgetBlocks from '../components/layout/DashboardWidgetBlocks'
import WorkspaceCanvas from '../components/layout/WorkspaceCanvas'
import Sidebar, { type SidebarItem } from '../components/layout/Sidebar'
import {
  workspaceFieldClass,
  workspaceGhostButtonClass,
  workspacePrimaryButtonClass,
} from '../styles/workspaceUi'
import type { AppPage } from '../types/navigation'
import type { AuthSession, Reservation } from '../types'
import { maskIdentifier, maskPersonName } from '../utils/privacy'
import { formatRoleLabel, getWorkspaceRoleLabel } from '../utils/roles'

type AppointmentsPageProps = {
  reservations: Reservation[]
  authUser: AuthSession['user'] | null
  onNavigate?: (page: AppPage) => void
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
  { key: 'dashboard', label: 'Dashboard', icon: 'home' },
  { key: 'appointments', label: 'Appointments', icon: 'calendar' },
]

const utilityItems: SidebarItem[] = [
  { key: 'notifications', label: 'Notifications', icon: 'alert' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
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
}: AppointmentsPageProps) => {
  const [activeSection, setActiveSection] = useState<UserSidebarSection>('dashboard')
  const [searchQuery, setSearchQuery] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

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

  const featuredItems = useMemo(
    () => [
      { id: 'featured-1', title: 'General Medicine', subtitle: 'Core patient care team' },
      { id: 'featured-2', title: 'Cardiology', subtitle: 'Heart health services' },
      { id: 'featured-3', title: 'Orthopedics', subtitle: 'Mobility and recovery unit' },
      { id: 'featured-4', title: 'Neurology', subtitle: 'Nervous system specialists' },
    ],
    []
  )

  const renderAppointmentsList = () => {
    if (visibleReservations.length === 0) {
      return (
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
              onClick={() => setActiveSection('dashboard')}
            >
              Back to dashboard
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
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(item.status)}`}>
                {item.status}
              </span>
            </div>
            <p className="mt-3 text-sm text-[color:var(--agent-muted)]">{item.summary}</p>
          </article>
        ))}
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

  const renderPlaceholderSection = (title: string, detail: string) => (
    <article className="reference-card p-5">
      <h2 className="reference-section-title">{title}</h2>
      <p className="reference-widget-subtle mt-2">{detail}</p>
    </article>
  )

  const profileName = authUser?.username ?? 'User'
  const sectionTitleMap: Record<UserSidebarSection, string> = {
    dashboard: 'Dashboard',
    appointments: 'Appointments',
    settings: 'Account settings',
    notifications: 'Notifications',
  }
  const sectionSearchPlaceholderMap: Record<UserSidebarSection, string> = {
    dashboard: 'Search by appointment id, patient, or department',
    appointments: 'Search appointments',
    settings: 'Search settings',
    notifications: 'Search notifications',
  }

  return (
    <WorkspaceCanvas>
      <div className="mx-auto w-full max-w-[1536px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <div className="reference-shell">
          <Sidebar
            variant="reference"
            className="xl:self-start"
            heightMode="viewport"
            stickyOffset="compact"
            brandTitle="AI Health Care"
            brandSubtitle="Patient workspace"
            sectionLabel="Main"
            items={sidebarItems}
            activeKey={activeSection}
            onSelect={(key) => {
              if (isUserSidebarSection(key)) {
                setActiveSection(key)
              }
            }}
            auxiliaryLabel="Utilities"
            secondaryItems={utilityItems}
            onSelectAuxiliary={(key) => {
              if (isUserSidebarSection(key)) {
                setActiveSection(key)
              }
            }}
            footerProfile={{
              name: profileName,
              subtitle: 'Welcome back',
              onClick: () => setActiveSection('settings'),
            }}
          />

          <section className="reference-main">
            {activeSection !== 'settings' ? (
              <DashboardTopBar
                title={sectionTitleMap[activeSection]}
                searchValue={searchQuery}
                searchPlaceholder={sectionSearchPlaceholderMap[activeSection]}
                onSearchChange={setSearchQuery}
                profileName={profileName}
                profileCaption={`${getWorkspaceRoleLabel(authUser?.role)} workspace`}
                messageCount={Math.min(metrics.total, 99)}
                notificationCount={Math.min(metrics.failed + 1, 99)}
                showMessages={false}
                showProfile={false}
                borderlessActions
              />
            ) : null}

            {activeSection === 'dashboard' ? (
              <>
                <DashboardStatStrip
                  metrics={[
                    { key: 'total', label: 'Total', value: metrics.total },
                    { key: 'booked', label: 'Booked', value: metrics.booked },
                    { key: 'recorded', label: 'Recorded', value: metrics.recorded },
                    { key: 'failed', label: 'Failed', value: metrics.failed },
                  ]}
                />

                <div className="reference-action-row">
                  <button
                    type="button"
                    className={workspacePrimaryButtonClass}
                    onClick={() => setActiveSection('appointments')}
                  >
                    Open appointments
                  </button>
                  <button
                    type="button"
                    className={workspaceGhostButtonClass}
                    onClick={() => setActiveSection('settings')}
                  >
                    Account settings
                  </button>
                </div>

                <DashboardWidgetBlocks
                  summaryTitle="Care completion"
                  summaryValue={`${completionRate}%`}
                  summaryLabel="Verified"
                  secondaryLabel="Patient flow"
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
                  featuredTitle="Featured care departments"
                  featuredItems={featuredItems}
                />
              </>
            ) : null}

            {activeSection === 'appointments' ? renderAppointmentsList() : null}
            {activeSection === 'settings' ? renderSettings() : null}
            {activeSection === 'notifications'
              ? renderPlaceholderSection(
                  'Notifications',
                  'Alerts and updates will surface here. This panel is frontend-only for now.'
                )
              : null}
          </section>
        </div>
      </div>
    </WorkspaceCanvas>
  )
}

export default AppointmentsPage

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
import type { AppointmentUpdateDraft, AuthSession, Reservation } from '../types'
import { maskIdentifier, maskPersonName } from '../utils/privacy'
import { formatRoleLabel, getWorkspaceRoleLabel } from '../utils/roles'

type DoctorDashboardPageProps = {
  reservations: Reservation[]
  authUser: AuthSession['user'] | null
  onNavigate?: (page: AppPage) => void
  onLogout: () => void
  onUpdateReservation: (reservationId: string, updates: AppointmentUpdateDraft) => Promise<Reservation>
  sessionStatus: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  dataMaskingEnabled: boolean
  onToggleDataMasking: () => void
}

type ReservationFilterStatus = 'all' | Reservation['status']
type NotificationPreferences = {
  emailAlerts: boolean
  browserAlerts: boolean
  appointmentReminders: boolean
  securityAlerts: boolean
}

type StaffSidebarSection =
  | 'dashboard'
  | 'appointments'
  | 'messages'
  | 'saved'
  | 'wallet'
  | 'notifications'
  | 'settings'

const sidebarItems: SidebarItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home' },
  { key: 'appointments', label: 'Appointments', icon: 'calendar' },
  { key: 'messages', label: 'Messages', icon: 'message' },
  { key: 'saved', label: 'Saved', icon: 'folder' },
  { key: 'wallet', label: 'Operations', icon: 'report' },
]

const utilityItems: SidebarItem[] = [
  { key: 'notifications', label: 'Notifications', icon: 'alert' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
]

const notificationPrefKey = 'pulse-ledger-staff-notification-preferences'
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
      booked: [7, 6, 8, 7, 9, 8, 7, 6],
      recorded: [4, 5, 4, 6, 5, 6, 5, 4],
      failed: [1, 2, 1, 1, 2, 1, 1, 1],
    }
  }

  return { booked, recorded, failed }
}

const statusBadgeClass = (status: Reservation['status']) => {
  if (status === 'Recorded') return 'bg-emerald-100 text-emerald-700 border-emerald-300/70'
  if (status === 'Failed') return 'bg-rose-100 text-rose-700 border-rose-300/70'
  return 'bg-sky-100 text-sky-700 border-sky-300/70'
}

const DoctorDashboardPage = ({
  reservations,
  authUser,
  onNavigate,
  onLogout,
  onUpdateReservation,
  sessionStatus,
  theme,
  onToggleTheme,
  dataMaskingEnabled,
  onToggleDataMasking,
}: DoctorDashboardPageProps) => {
  const [activeSection, setActiveSection] = useState<StaffSidebarSection>('dashboard')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ReservationFilterStatus>('all')
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

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftStatus, setDraftStatus] = useState<Reservation['status']>('Booked')
  const [draftTime, setDraftTime] = useState('')
  const [draftDepartment, setDraftDepartment] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(notificationPrefKey, JSON.stringify(notificationPrefs))
  }, [notificationPrefs])

  const searchableReservations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const ordered = [...reservations].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    if (!query) return ordered

    return ordered.filter((item) => {
      return (
        item.id.toLowerCase().includes(query) ||
        item.patientName.toLowerCase().includes(query) ||
        item.department.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query)
      )
    })
  }, [reservations, searchQuery])

  const filteredReservations = useMemo(() => {
    if (statusFilter === 'all') return searchableReservations
    return searchableReservations.filter((item) => item.status === statusFilter)
  }, [searchableReservations, statusFilter])

  const metrics = useMemo(() => {
    const booked = searchableReservations.filter((item) => item.status === 'Booked').length
    const recorded = searchableReservations.filter((item) => item.status === 'Recorded').length
    const failed = searchableReservations.filter((item) => item.status === 'Failed').length
    return { total: searchableReservations.length, booked, recorded, failed }
  }, [searchableReservations])

  const weeklySeries = useMemo(() => buildWeeklySeries(searchableReservations), [searchableReservations])

  const completionRate = useMemo(() => {
    if (metrics.total === 0) return 0
    return Math.round((metrics.recorded / metrics.total) * 100)
  }, [metrics.recorded, metrics.total])

  const activityItems = useMemo(() => {
    const items = searchableReservations.slice(0, 5).map((item) => ({
      id: item.id,
      title: `${dataMaskingEnabled ? maskPersonName(item.patientName) : item.patientName}`,
      detail: `${item.department} · ${item.status}`,
      meta: new Date(item.createdAt).toLocaleString(),
    }))

    if (items.length > 0) return items

    return [
      {
        id: 'empty-activity',
        title: 'No active queue yet',
        detail: 'Incoming appointments will appear here once users submit bookings.',
        meta: 'Waiting',
      },
    ]
  }, [dataMaskingEnabled, searchableReservations])

  const recommendationItems = useMemo(() => {
    const items = searchableReservations.slice(0, 6).map((item) => ({
      id: item.id,
      title: `${item.department} queue item`,
      subtitle: `${dataMaskingEnabled ? maskIdentifier(item.id) : item.id} · ${item.requestedTime}`,
      detail: item.summary,
      badge: item.status,
    }))

    if (items.length > 0) return items

    return [
      {
        id: 'ops-a',
        title: 'Queue monitoring',
        subtitle: 'No active records',
        detail: 'Live appointment records appear here for nurse/doctor review.',
      },
      {
        id: 'ops-b',
        title: 'Department balancing',
        subtitle: 'Operations guidance',
        detail: 'Use the appointment board to keep statuses and schedule windows updated.',
      },
    ]
  }, [dataMaskingEnabled, searchableReservations])

  const featuredItems = useMemo(
    () => [
      { id: 'staff-1', title: 'Morning queue', subtitle: 'Primary booking window' },
      { id: 'staff-2', title: 'Specialist lane', subtitle: 'Department handoff flow' },
      { id: 'staff-3', title: 'Follow-up desk', subtitle: 'Recorded appointment review' },
      { id: 'staff-4', title: 'Escalation path', subtitle: 'Failed status recovery' },
    ],
    []
  )

  const hasAdminRouteShortcut =
    authUser?.role === 'nurse' || authUser?.role === 'admin' || authUser?.role === 'system_admin'

  const beginEdit = (reservation: Reservation) => {
    setEditingId(reservation.id)
    setDraftStatus(reservation.status)
    setDraftTime(reservation.requestedTime)
    setDraftDepartment(reservation.department)
    setSaveError(null)
    setSaveMessage(null)
    setActiveSection('appointments')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setSaveError(null)
  }

  const saveEdit = async () => {
    if (!editingId) return

    setIsSaving(true)
    setSaveError(null)
    setSaveMessage(null)

    try {
      await onUpdateReservation(editingId, {
        status: draftStatus,
        requestedTime: draftTime,
        department: draftDepartment,
      })
      setSaveMessage(`Appointment ${editingId} updated successfully.`)
      setEditingId(null)
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to update appointment')
    } finally {
      setIsSaving(false)
    }
  }

  const renderOperationsBoard = () => (
    <section className="space-y-3">
      <article className="reference-card p-4">
        <div className="grid gap-3 md:grid-cols-[180px_180px_1fr] md:items-center">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as ReservationFilterStatus)}
            className={workspaceFieldClass}
          >
            <option value="all">All statuses</option>
            <option value="Booked">Booked</option>
            <option value="Recorded">Recorded</option>
            <option value="Failed">Failed</option>
          </select>

          <button
            type="button"
            className={workspaceGhostButtonClass}
            onClick={() => {
              setStatusFilter('all')
              setSearchQuery('')
            }}
          >
            Reset filters
          </button>

          <p className="text-xs text-[color:var(--agent-muted-soft)]">
            Showing {filteredReservations.length} of {searchableReservations.length} appointments.
          </p>
        </div>

        {saveMessage ? <p className="mt-3 text-sm font-semibold text-emerald-600">{saveMessage}</p> : null}
        {saveError ? <p className="mt-3 text-sm font-semibold text-rose-500">{saveError}</p> : null}
      </article>

      {filteredReservations.length === 0 ? (
        <article className="reference-card p-5">
          <h2 className="reference-section-title">No appointments found</h2>
          <p className="reference-widget-subtle mt-2">
            Adjust your search query or status filter to view matching records.
          </p>
        </article>
      ) : (
        filteredReservations.map((reservation) => {
          const isEditing = editingId === reservation.id

          return (
            <article key={reservation.id} className="reference-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.13em] text-[color:var(--agent-muted-soft)]">
                    {dataMaskingEnabled ? maskIdentifier(reservation.id) : reservation.id}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-[color:var(--agent-ink)]">
                    {dataMaskingEnabled
                      ? maskPersonName(reservation.patientName)
                      : reservation.patientName}
                  </h3>
                  <p className="mt-1 text-sm text-[color:var(--agent-muted)]">
                    {reservation.department} · {reservation.requestedTime}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(reservation.status)}`}
                >
                  {reservation.status}
                </span>
              </div>

              <p className="mt-3 text-sm text-[color:var(--agent-muted)]">{reservation.summary}</p>

              {isEditing ? (
                <div className="reference-card-soft mt-4 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
                    Edit appointment
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <select
                      value={draftStatus}
                      onChange={(event) => setDraftStatus(event.target.value as Reservation['status'])}
                      className={workspaceFieldClass}
                    >
                      <option value="Booked">Booked</option>
                      <option value="Recorded">Recorded</option>
                      <option value="Failed">Failed</option>
                    </select>
                    <input
                      value={draftTime}
                      onChange={(event) => setDraftTime(event.target.value)}
                      className={workspaceFieldClass}
                      placeholder="Requested time"
                    />
                    <input
                      value={draftDepartment}
                      onChange={(event) => setDraftDepartment(event.target.value)}
                      className={workspaceFieldClass}
                      placeholder="Department"
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={saveEdit}
                      disabled={isSaving}
                      className={`${workspacePrimaryButtonClass} disabled:cursor-not-allowed disabled:opacity-70`}
                    >
                      {isSaving ? 'Saving...' : 'Save changes'}
                    </button>
                    <button type="button" onClick={cancelEdit} className={workspaceGhostButtonClass}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  <button type="button" onClick={() => beginEdit(reservation)} className={workspaceGhostButtonClass}>
                    Edit appointment
                  </button>
                </div>
              )}
            </article>
          )
        })
      )}
    </section>
  )

  const renderSettings = () => (
    <section className="reference-card p-5">
      <h2 className="reference-section-title">Account settings</h2>
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
          <p className="mt-1 text-xs text-[color:var(--agent-muted-soft)]">
            {formatRoleLabel(authUser?.role)}
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

        <div className="reference-card-soft p-4 xl:col-span-2">
          <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--agent-muted-soft)]">
            Notifications
          </p>
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

  const profileName = authUser?.username ?? 'Staff'

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
            brandSubtitle="Admin workspace"
            sectionLabel="Main"
            items={sidebarItems}
            activeKey={activeSection}
            onSelect={(key) => {
              const next = key as StaffSidebarSection
              setActiveSection(next)
            }}
            auxiliaryLabel="Utilities"
            secondaryItems={utilityItems}
            onSelectAuxiliary={(key) => {
              if (key === 'logout') {
                onLogout()
                return
              }
              const next = key as StaffSidebarSection
              setActiveSection(next)
            }}
            supportItem={{ key: 'logout', label: 'Logout', icon: 'shield' }}
            footerProfile={{
              name: profileName,
              subtitle: 'Admin workspace',
              onClick: () => setActiveSection('settings'),
            }}
          />

          <section className="reference-main">
            {activeSection !== 'settings' ? (
              <>
                <DashboardTopBar
                  title="Dashboard"
                  searchValue={searchQuery}
                  searchPlaceholder="Search by patient, id, department, or summary"
                  onSearchChange={setSearchQuery}
                  profileName={profileName}
                  profileCaption={`${getWorkspaceRoleLabel(authUser?.role)} workspace`}
                  messageCount={Math.min(metrics.total, 99)}
                  notificationCount={Math.min(metrics.failed + metrics.booked, 99)}
                  showMessages={false}
                  showProfile={false}
                  borderlessActions
                />

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
                    Open appointment board
                  </button>
                  {hasAdminRouteShortcut ? (
                    <button type="button" className={workspaceGhostButtonClass} onClick={() => onNavigate?.('admin')}>
                      Open admin route
                    </button>
                  ) : null}
                  <button type="button" className={workspaceGhostButtonClass} onClick={onLogout}>
                    Logout
                  </button>
                </div>
              </>
            ) : null}

            {activeSection === 'dashboard' ? (
              <DashboardWidgetBlocks
                summaryTitle="Queue completion"
                summaryValue={`${completionRate}%`}
                summaryLabel="Verified"
                secondaryLabel="Operations board"
                activityTitle="Recent activities"
                activityItems={activityItems}
                chartTitle="Vacancy stats"
                chartSeries={[
                  { key: 'booked', label: 'Booked', color: '#3b82f6', values: weeklySeries.booked },
                  { key: 'recorded', label: 'Recorded', color: '#10b981', values: weeklySeries.recorded },
                  { key: 'failed', label: 'Failed', color: '#ef4444', values: weeklySeries.failed },
                ]}
                recommendationTitle="Recommended care operations"
                recommendationItems={recommendationItems}
                featuredTitle="Featured queues"
                featuredItems={featuredItems}
              />
            ) : null}

            {activeSection === 'appointments' ? renderOperationsBoard() : null}
            {activeSection === 'settings' ? renderSettings() : null}
            {activeSection === 'messages'
              ? renderPlaceholderSection(
                  'Messages',
                  'Clinical messaging UI is available as frontend placeholder content in this shell.'
                )
              : null}
            {activeSection === 'saved'
              ? renderPlaceholderSection(
                  'Saved items',
                  'Saved queue filters and presets can be surfaced here in a future iteration.'
                )
              : null}
            {activeSection === 'wallet'
              ? renderPlaceholderSection(
                  'Operations resources',
                  'Resource and shift allocation widgets are frontend-only placeholders in this view.'
                )
              : null}
            {activeSection === 'notifications'
              ? renderPlaceholderSection(
                  'Notifications',
                  'Real-time alerts will appear here. Current implementation is frontend demo only.'
                )
              : null}
          </section>
        </div>
      </div>
    </WorkspaceCanvas>
  )
}

export default DoctorDashboardPage

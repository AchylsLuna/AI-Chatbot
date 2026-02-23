import { useEffect, useMemo, useState } from 'react'
import DashboardTopBar from '../../../components/layout/DashboardTopBar'
import { buildDashboardLogItems } from '../shared/dashboardEvents'
import DoctorAppointmentSection from './sections/DoctorAppointmentSection'
import DoctorDashboardOverviewSection from './sections/DoctorDashboardOverviewSection'
import DoctorReportsLogSection from './sections/DoctorReportsLogSection'
import DoctorSettingsSection from './sections/DoctorSettingsSection'
import WorkspaceCanvas from '../../../components/layout/WorkspaceCanvas'
import Sidebar, { type SidebarItem } from '../../../components/layout/Sidebar'
import WorkspaceSidebarShell from '../../../components/layout/WorkspaceSidebarShell'
import type { AppPage } from '../../../types/navigation'
import type {
  AppointmentUpdateDraft,
  AuthSession,
  Reservation,
} from '../../../types'
import {
  maskIdentifier,
  maskPersonName,
} from '../../../utils/privacy'
import {
  filterReportLogItems,
  getReportLogActionOptions,
  type ReportLogActionFilter,
  type ReportLogSeverityFilter,
  type ReportLogSourceFilter,
} from '../shared/reportLogFilters'

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

type DoctorSidebarSection =
  | 'dashboard'
  | 'appointments'
  | 'reports_log'
  | 'settings'

type ReservationFilterStatus = 'all' | Reservation['status']

type NotificationPreferences = {
  emailAlerts: boolean
  browserAlerts: boolean
  appointmentReminders: boolean
  securityAlerts: boolean
}

const sidebarItems: SidebarItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home' },
  { key: 'appointments', label: 'Appointment', icon: 'calendar' },
  { key: 'reports_log', label: "Report's Log", icon: 'report' },
]

const utilityItems: SidebarItem[] = [
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

const PAGINATION_PAGE_SIZE = 10
const MAX_PAGE_BUTTONS = 10

const getPageSlice = <T,>(items: T[], currentPage: number, pageSize = PAGINATION_PAGE_SIZE) => {
  const safePage = Math.max(1, Math.floor(currentPage) || 1)
  const start = (safePage - 1) * pageSize
  return items.slice(start, start + pageSize)
}

const isDoctorSidebarSection = (value: string): value is DoctorSidebarSection => {
  return (
    value === 'dashboard' ||
    value === 'appointments' ||
    value === 'reports_log' ||
    value === 'settings'
  )
}

const DoctorDashboardPage = ({
  reservations,
  authUser,
  onLogout,
  onUpdateReservation,
  sessionStatus,
  theme,
  onToggleTheme,
  dataMaskingEnabled,
  onToggleDataMasking,
}: DoctorDashboardPageProps) => {
  const [activeSection, setActiveSection] = useState<DoctorSidebarSection>('dashboard')
  const [searchQuery, setSearchQuery] = useState('')
  const [appointmentsPage, setAppointmentsPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<ReservationFilterStatus>('all')
  const [reportSourceFilter, setReportSourceFilter] = useState<ReportLogSourceFilter>('all')
  const [reportSeverityFilter, setReportSeverityFilter] = useState<ReportLogSeverityFilter>('all')
  const [reportActionFilter, setReportActionFilter] = useState<ReportLogActionFilter>('all')

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

  const setSection = (next: DoctorSidebarSection) => {
    setSearchQuery('')
    if (next === 'appointments') {
      setAppointmentsPage(1)
    }
    setActiveSection(next)
  }

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

  const pagedReservations = useMemo(
    () => getPageSlice(filteredReservations, appointmentsPage),
    [filteredReservations, appointmentsPage]
  )

  const appointmentsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredReservations.length / PAGINATION_PAGE_SIZE)),
    [filteredReservations.length]
  )

  useEffect(() => {
    setAppointmentsPage((previous) => Math.min(previous, appointmentsTotalPages))
  }, [appointmentsTotalPages])

  useEffect(() => {
    setAppointmentsPage(1)
  }, [statusFilter])

  const dashboardMetrics = useMemo(() => {
    const booked = searchableReservations.filter((item) => item.status === 'Booked').length
    const recorded = searchableReservations.filter((item) => item.status === 'Recorded').length
    const failed = searchableReservations.filter((item) => item.status === 'Failed').length
    return { total: searchableReservations.length, booked, recorded, failed }
  }, [searchableReservations])

  const completionRate = useMemo(() => {
    if (dashboardMetrics.total === 0) return 0
    return Math.round((dashboardMetrics.recorded / dashboardMetrics.total) * 100)
  }, [dashboardMetrics.recorded, dashboardMetrics.total])

  const weeklySeries = useMemo(() => buildWeeklySeries(searchableReservations), [searchableReservations])

  const activityItems = useMemo(() => {
    const items = searchableReservations.slice(0, 5).map((item) => ({
      id: item.id,
      title: dataMaskingEnabled ? maskPersonName(item.patientName) : item.patientName,
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
        detail: 'Live appointment records appear here for doctor and nurse review.',
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

  const reportLogs = useMemo(
    () => buildDashboardLogItems({ reservations, authUser, sessionStatus }),
    [authUser, reservations, sessionStatus]
  )

  const reportActionOptions = useMemo(() => getReportLogActionOptions(reportLogs), [reportLogs])
  const effectiveReportActionFilter: ReportLogActionFilter =
    reportActionFilter === 'all' || reportActionOptions.includes(reportActionFilter)
      ? reportActionFilter
      : 'all'

  const filteredReportLogs = useMemo(() => {
    return filterReportLogItems({
      items: reportLogs,
      searchQuery,
      sourceFilter: reportSourceFilter,
      severityFilter: reportSeverityFilter,
      actionFilter: effectiveReportActionFilter,
    })
  }, [effectiveReportActionFilter, reportLogs, reportSeverityFilter, reportSourceFilter, searchQuery])

  const resetReportFilters = () => {
    setReportSourceFilter('all')
    setReportSeverityFilter('all')
    setReportActionFilter('all')
  }

  const beginEdit = (reservation: Reservation) => {
    setEditingId(reservation.id)
    setDraftStatus(reservation.status)
    setDraftTime(reservation.requestedTime)
    setDraftDepartment(reservation.department)
    setSaveError(null)
    setSaveMessage(null)
    setSection('appointments')
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

  const searchPlaceholderMap: Record<DoctorSidebarSection, string> = {
    dashboard: 'Search by patient, id, department, or summary',
    appointments: 'Search appointments',
    reports_log: 'Search report logs',
    settings: 'Search settings',
  }

  const searchLabelMap: Record<DoctorSidebarSection, string> = {
    dashboard: 'Search dashboard',
    appointments: 'Search appointments',
    reports_log: "Search report's log",
    settings: 'Search settings',
  }

  const sectionTitleMap: Record<DoctorSidebarSection, string> = {
    dashboard: 'Dashboard',
    appointments: 'Appointment',
    reports_log: "Report's Log",
    settings: 'Settings',
  }

  return (
    <WorkspaceCanvas>
      <div className="w-full px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <WorkspaceSidebarShell
          mobileTitle="Doctor workspace"
          stickyOffsetMode="auto"
          sidebar={
            <Sidebar
              variant="reference"
              mobileMode="drawer"
              fullRail
              brandTitle="AI Health Care"
              brandSubtitle="Doctor workspace"
              sectionLabel="Main"
              items={sidebarItems}
              activeKey={activeSection}
              onSelect={(key) => {
                if (isDoctorSidebarSection(key)) {
                  setSection(key)
                }
              }}
              auxiliaryLabel="Utilities"
              secondaryItems={utilityItems}
              onSelectAuxiliary={(key) => {
                if (isDoctorSidebarSection(key)) {
                  setSection(key)
                  return
                }
                if (key === 'logout') {
                  onLogout()
                }
              }}
              supportItem={{ key: 'logout', label: 'Log out', icon: 'shield' }}
              footerProfile={{
                name: authUser?.username ?? 'Staff',
                subtitle: 'Doctor workspace',
                onClick: () => setSection('settings'),
              }}
            />
          }
          content={
            <section className="reference-main px-4 pb-10 pt-5 sm:px-6 lg:px-8">
            {activeSection === 'dashboard' ? (
              <h1 className="reference-page-title">{sectionTitleMap[activeSection]}</h1>
            ) : activeSection !== 'settings' ? (
              <>
                <h1 className="reference-page-title">{sectionTitleMap[activeSection]}</h1>
                <DashboardTopBar
                  title={undefined}
                  searchValue={searchQuery}
                  searchPlaceholder={searchPlaceholderMap[activeSection]}
                  searchLabel={searchLabelMap[activeSection]}
                  onSearchChange={setSearchQuery}
                />
              </>
            ) : (
              <h1 className="reference-page-title">{sectionTitleMap[activeSection]}</h1>
            )}

            {activeSection === 'dashboard' ? (
              <DoctorDashboardOverviewSection
                metrics={dashboardMetrics}
                completionRate={completionRate}
                weeklySeries={weeklySeries}
                activityItems={activityItems}
                recommendationItems={recommendationItems}
                featuredItems={featuredItems}
              />
            ) : null}

            {activeSection === 'appointments' ? (
              <DoctorAppointmentSection
                pagedReservations={pagedReservations}
                filteredReservations={filteredReservations}
                searchableReservationCount={searchableReservations.length}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                onResetFilters={() => {
                  setStatusFilter('all')
                  setSearchQuery('')
                  setAppointmentsPage(1)
                }}
                dataMaskingEnabled={dataMaskingEnabled}
                editingId={editingId}
                draftStatus={draftStatus}
                draftTime={draftTime}
                draftDepartment={draftDepartment}
                onDraftStatusChange={setDraftStatus}
                onDraftTimeChange={setDraftTime}
                onDraftDepartmentChange={setDraftDepartment}
                onBeginEdit={beginEdit}
                onSaveEdit={() => void saveEdit()}
                onCancelEdit={cancelEdit}
                isSaving={isSaving}
                saveMessage={saveMessage}
                saveError={saveError}
                currentPage={appointmentsPage}
                onPageChange={setAppointmentsPage}
                pageSize={PAGINATION_PAGE_SIZE}
                maxPageButtons={MAX_PAGE_BUTTONS}
              />
            ) : null}

            {activeSection === 'reports_log' ? (
              <DoctorReportsLogSection
                items={filteredReportLogs}
                dataMaskingEnabled={dataMaskingEnabled}
                sourceFilter={reportSourceFilter}
                severityFilter={reportSeverityFilter}
                actionFilter={effectiveReportActionFilter}
                actionOptions={reportActionOptions}
                onSourceFilterChange={setReportSourceFilter}
                onSeverityFilterChange={setReportSeverityFilter}
                onActionFilterChange={setReportActionFilter}
                onResetFilters={resetReportFilters}
              />
            ) : null}

            {activeSection === 'settings' ? (
              <DoctorSettingsSection
                authUser={authUser}
                sessionStatus={sessionStatus}
                theme={theme}
                onToggleTheme={onToggleTheme}
                dataMaskingEnabled={dataMaskingEnabled}
                onToggleDataMasking={onToggleDataMasking}
                notificationPrefs={notificationPrefs}
                onToggleNotificationPref={(key) => {
                  setNotificationPrefs((previous) => ({ ...previous, [key]: !previous[key] }))
                }}
                currentPassword={currentPassword}
                newPassword={newPassword}
                confirmPassword={confirmPassword}
                onCurrentPasswordChange={setCurrentPassword}
                onNewPasswordChange={setNewPassword}
                onConfirmPasswordChange={setConfirmPassword}
                onPasswordSubmit={(event) => {
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
                passwordError={passwordError}
                passwordMessage={passwordMessage}
              />
            ) : null}
            </section>
          }
        />
      </div>
    </WorkspaceCanvas>
  )
}

export default DoctorDashboardPage

import { useEffect, useMemo, useState } from 'react'
import PageTopBar from '../../../components/layout/PageTopBar'
import Sidebar, { type SidebarItem } from '../../../components/layout/Sidebar'
import PageCanvas from '../../../components/layout/PageCanvas'
import SidebarShell from '../../../components/layout/SidebarShell'
import type { AuthSession, Reservation } from '../../../types'
import type { AppPage } from '../../../types/navigation'
import { formatPhilippineDateTime } from '../../../utils/dateTime'
import { maskIdentifier, maskPersonName } from '../../../utils/privacy'
import { buildLogItems } from '../shared/activityEvents'
import {
  filterReportLogItems,
  getReportLogActionOptions,
  type ReportLogActionFilter,
  type ReportLogSeverityFilter,
  type ReportLogSourceFilter,
} from '../shared/reportLogFilters'
import AdminAppointmentsSection from './sections/AdminAppointmentsSection'
import AdminDashboardOverviewSection from './sections/AdminDashboardOverviewSection'
import AdminReportsLogSection from './sections/AdminReportsLogSection'
import AdminSettingsSection from './sections/AdminSettingsSection'
import AdminUserManagementSection, {
  type AdminUserManagementItem,
  type AdminUserManagementTab,
} from './sections/AdminUserManagementSection'
import { fallbackDoctors } from '../../../config/fallbackData'

type AdminDashboardPageProps = {
  authUser: AuthSession['user'] | null
  reservations: Reservation[]
  onNavigate?: (page: AppPage) => void
  onLogout: () => void
  sessionStatus: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  dataMaskingEnabled: boolean
}

type AdminSidebarSection =
  | 'dashboard'
  | 'appointments'
  | 'reports_log'
  | 'user_management'
  | 'settings'

type ReservationFilterStatus = 'all' | Reservation['status']

type NotificationPreferences = {
  emailAlerts: boolean
  browserAlerts: boolean
  appointmentReminders: boolean
  securityAlerts: boolean
}

type ManagementMeta = {
  displayName: string
  accountStatus: 'Active' | 'Disabled'
  contactEmail: string
  note: string
}

const sidebarItems: SidebarItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: 'home' },
  { key: 'appointments', label: 'Appointment', icon: 'calendar' },
  { key: 'reports_log', label: "Report's Log", icon: 'report' },
  { key: 'user_management', label: 'User Management', icon: 'user' },
]

const utilityItems: SidebarItem[] = [
  { key: 'settings', label: 'Settings', icon: 'settings' },
]

const notificationPrefKey = 'pulse-ledger-admin-notification-preferences'
const userMetaKey = 'pulse-ledger-admin-user-management-meta'
const doctorMetaKey = 'pulse-ledger-admin-doctor-management-meta'
const migrationFlagKey = 'pulse-ledger-admin-management-migrated-v1'
const legacyUserMetaKey = 'pulse-ledger-staff-user-management-meta'
const legacyStaffRosterKey = 'pulse-ledger-staff-management-roster'

const defaultNotificationPrefs: NotificationPreferences = {
  emailAlerts: true,
  browserAlerts: true,
  appointmentReminders: true,
  securityAlerts: true,
}

const PAGINATION_PAGE_SIZE = 10
const MAX_PAGE_BUTTONS = 10

const parseDate = (value: string) => {
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const resolveAdminDisplayName = (user: AuthSession['user'] | null) => {
  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
  if (fullName) return fullName
  return 'Admin'
}

const normalizeKey = (value: string, fallback: string) => {
  const normalized = value.trim().toLowerCase()
  return normalized || fallback
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
      booked: [8, 7, 9, 8, 10, 9, 8, 7],
      recorded: [5, 6, 5, 6, 7, 6, 5, 5],
      failed: [1, 2, 1, 1, 2, 1, 1, 1],
    }
  }

  return { booked, recorded, failed }
}

const getPageSlice = <T,>(items: T[], currentPage: number, pageSize = PAGINATION_PAGE_SIZE) => {
  const safePage = Math.max(1, Math.floor(currentPage) || 1)
  const start = (safePage - 1) * pageSize
  return items.slice(start, start + pageSize)
}

const isAdminSidebarSection = (value: string): value is AdminSidebarSection => {
  return (
    value === 'dashboard' ||
    value === 'appointments' ||
    value === 'reports_log' ||
    value === 'user_management' ||
    value === 'settings'
  )
}

const parseStoredMeta = (raw: string | null): Record<string, ManagementMeta> => {
  if (!raw) return {}

  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<ManagementMeta>>
    const next: Record<string, ManagementMeta> = {}
    for (const [key, value] of Object.entries(parsed)) {
      next[key] = {
        displayName: typeof value.displayName === 'string' ? value.displayName : '',
        accountStatus: value.accountStatus === 'Disabled' ? 'Disabled' : 'Active',
        contactEmail: typeof value.contactEmail === 'string' ? value.contactEmail : '',
        note: typeof value.note === 'string' ? value.note : '',
      }
    }
    return next
  } catch {
    return {}
  }
}

const migrateLegacyManagementStorage = () => {
  if (typeof window === 'undefined') return
  if (window.localStorage.getItem(migrationFlagKey) === 'true') return

  const hasUserMeta = Boolean(window.localStorage.getItem(userMetaKey))
  const hasDoctorMeta = Boolean(window.localStorage.getItem(doctorMetaKey))

  if (!hasUserMeta) {
    const legacyUsers = parseStoredMeta(window.localStorage.getItem(legacyUserMetaKey))
    if (Object.keys(legacyUsers).length > 0) {
      window.localStorage.setItem(userMetaKey, JSON.stringify(legacyUsers))
    }
  }

  const shouldMigrateStaff = !hasDoctorMeta
  if (shouldMigrateStaff) {
    const doctorMeta: Record<string, ManagementMeta> = {}

    try {
      const raw = window.localStorage.getItem(legacyStaffRosterKey)
      const parsed = raw ? (JSON.parse(raw) as Array<{ name?: string; role?: string; status?: string }>) : []

      for (const row of parsed) {
        const name = typeof row.name === 'string' ? row.name.trim() : ''
        if (!name) continue
        const key = normalizeKey(name, `legacy-${Object.keys(doctorMeta).length + 1}`)
        const accountStatus: ManagementMeta['accountStatus'] = row.status === 'Offline' ? 'Disabled' : 'Active'
        const base: ManagementMeta = {
          displayName: name,
          accountStatus,
          contactEmail: '',
          note: 'Migrated from previous staff management roster.',
        }

        const role = typeof row.role === 'string' ? row.role.toLowerCase() : ''
        if (role.includes('doctor')) {
          doctorMeta[key] = base
        }
      }
    } catch {
      // ignore malformed legacy roster payload
    }

    if (!hasDoctorMeta && Object.keys(doctorMeta).length > 0) {
      window.localStorage.setItem(doctorMetaKey, JSON.stringify(doctorMeta))
    }
  }

  window.localStorage.setItem(migrationFlagKey, 'true')
}

const loadManagementMeta = (storageKey: string) => {
  if (typeof window === 'undefined') return {}
  migrateLegacyManagementStorage()
  return parseStoredMeta(window.localStorage.getItem(storageKey))
}

const toMeta = (item: AdminUserManagementItem): ManagementMeta => ({
  displayName: item.displayName,
  accountStatus: item.accountStatus,
  contactEmail: item.contactEmail,
  note: item.note,
})

const buildUserItems = (
  reservations: Reservation[],
  meta: Record<string, ManagementMeta>
): AdminUserManagementItem[] => {
  const byUser = new Map<string, AdminUserManagementItem>()

  for (const reservation of reservations) {
    const identity = normalizeKey(reservation.patientName, reservation.id.toLowerCase())
    const existing = byUser.get(identity)

    if (!existing) {
      byUser.set(identity, {
        key: `users:${identity}`,
        displayName: reservation.patientName,
        referenceId: reservation.id,
        bookingCount: 1,
        latestActivity: reservation.createdAt,
        latestStatus: reservation.status,
        accountStatus: 'Active',
        contactEmail: '',
        note: '',
      })
      continue
    }

    existing.bookingCount += 1
    if (parseDate(reservation.createdAt) > parseDate(existing.latestActivity)) {
      existing.referenceId = reservation.id
      existing.latestActivity = reservation.createdAt
      existing.latestStatus = reservation.status
      existing.displayName = reservation.patientName
    }
  }

  return [...byUser.entries()]
    .map(([identity, base]) => {
      const stored = meta[identity]
      return {
        ...base,
        displayName: stored?.displayName?.trim() || base.displayName,
        accountStatus: stored?.accountStatus ?? base.accountStatus,
        contactEmail: stored?.contactEmail ?? base.contactEmail,
        note: stored?.note ?? base.note,
      }
    })
    .sort((a, b) => parseDate(b.latestActivity) - parseDate(a.latestActivity))
}

const buildDoctorItems = (
  reservations: Reservation[],
  meta: Record<string, ManagementMeta>
): AdminUserManagementItem[] => {
  const byStaff = new Map<string, AdminUserManagementItem>()

  for (const reservation of reservations) {
    const sourceName = reservation.doctorName
    if (!sourceName) continue

    const identity = normalizeKey(sourceName, `doctor-${reservation.id.toLowerCase()}`)
    const existing = byStaff.get(identity)

    if (!existing) {
      byStaff.set(identity, {
        key: `doctors:${identity}`,
        displayName: sourceName,
        referenceId: reservation.id,
        bookingCount: 1,
        latestActivity: reservation.createdAt,
        latestStatus: reservation.status,
        accountStatus: 'Active',
        contactEmail: '',
        note: '',
      })
      continue
    }

    existing.bookingCount += 1
    if (parseDate(reservation.createdAt) > parseDate(existing.latestActivity)) {
      existing.referenceId = reservation.id
      existing.latestActivity = reservation.createdAt
      existing.latestStatus = reservation.status
      existing.displayName = sourceName
    }
  }

  if (byStaff.size === 0) {
    fallbackDoctors.forEach((name, index) => {
      const identity = normalizeKey(name, `doctor-${index + 1}`)
      byStaff.set(identity, {
        key: `doctors:${identity}`,
        displayName: name,
        referenceId: `DOCTOR-${String(index + 1).padStart(3, '0')}`,
        bookingCount: 0,
        latestActivity: new Date(0).toISOString(),
        latestStatus: 'None',
        accountStatus: 'Active',
        contactEmail: '',
        note: 'No booking activity yet.',
      })
    })
  }

  return [...byStaff.entries()]
    .map(([identity, base]) => {
      const stored = meta[identity]
      return {
        ...base,
        displayName: stored?.displayName?.trim() || base.displayName,
        accountStatus: stored?.accountStatus ?? base.accountStatus,
        contactEmail: stored?.contactEmail ?? base.contactEmail,
        note: stored?.note ?? base.note,
      }
    })
    .sort((a, b) => {
      const timeDiff = parseDate(b.latestActivity) - parseDate(a.latestActivity)
      if (timeDiff !== 0) return timeDiff
      return a.displayName.localeCompare(b.displayName)
    })
}

const AdminDashboardPage = ({
  authUser,
  reservations,
  onLogout,
  sessionStatus,
  theme,
  onToggleTheme,
  dataMaskingEnabled,
}: AdminDashboardPageProps) => {
  const [activeSection, setActiveSection] = useState<AdminSidebarSection>('dashboard')
  const [searchQuery, setSearchQuery] = useState('')
  const [appointmentsPage, setAppointmentsPage] = useState(1)
  const [managementPage, setManagementPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<ReservationFilterStatus>('all')
  const [reportSourceFilter, setReportSourceFilter] = useState<ReportLogSourceFilter>('all')
  const [reportSeverityFilter, setReportSeverityFilter] = useState<ReportLogSeverityFilter>('all')
  const [reportActionFilter, setReportActionFilter] = useState<ReportLogActionFilter>('all')
  const [managementTab, setManagementTab] = useState<AdminUserManagementTab>('users')

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

  const [userManagementMeta, setUserManagementMeta] = useState<Record<string, ManagementMeta>>(() =>
    loadManagementMeta(userMetaKey)
  )
  const [doctorManagementMeta, setDoctorManagementMeta] = useState<Record<string, ManagementMeta>>(() =>
    loadManagementMeta(doctorMetaKey)
  )

  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftEmail, setDraftEmail] = useState('')
  const [draftNote, setDraftNote] = useState('')
  const [managementActionMessage, setManagementActionMessage] = useState<string | null>(null)
  const [managementActionError, setManagementActionError] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(notificationPrefKey, JSON.stringify(notificationPrefs))
  }, [notificationPrefs])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(userMetaKey, JSON.stringify(userManagementMeta))
  }, [userManagementMeta])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(doctorMetaKey, JSON.stringify(doctorManagementMeta))
  }, [doctorManagementMeta])

  const setSection = (next: AdminSidebarSection) => {
    setSearchQuery('')
    if (next === 'appointments') {
      setAppointmentsPage(1)
    }
    if (next === 'user_management') {
      setManagementPage(1)
      setManagementActionError(null)
      setManagementActionMessage(null)
    }
    setActiveSection(next)
  }

  const searchableReservations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const ordered = [...reservations].sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt))

    if (!query || activeSection === 'user_management') return ordered

    return ordered.filter((item) => {
      return (
        item.id.toLowerCase().includes(query) ||
        item.patientName.toLowerCase().includes(query) ||
        item.department.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query)
      )
    })
  }, [activeSection, reservations, searchQuery])

  const filteredReservations = useMemo(() => {
    if (statusFilter === 'all') return searchableReservations
    return searchableReservations.filter((item) => item.status === statusFilter)
  }, [searchableReservations, statusFilter])

  const appointmentTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredReservations.length / PAGINATION_PAGE_SIZE)),
    [filteredReservations.length]
  )

  const safeAppointmentsPage = Math.min(appointmentsPage, appointmentTotalPages)
  const pagedReservations = useMemo(
    () => getPageSlice(filteredReservations, safeAppointmentsPage),
    [filteredReservations, safeAppointmentsPage]
  )

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
      meta: formatPhilippineDateTime(item.createdAt),
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
      subtitle: `${dataMaskingEnabled ? maskIdentifier(item.id) : item.id} · ${formatPhilippineDateTime(item.requestedTime)}`,
      detail: item.summary,
      badge: item.status,
    }))

    if (items.length > 0) return items

    return [
      {
        id: 'ops-a',
        title: 'Queue monitoring',
        subtitle: 'No active records',
        detail: 'Live appointment records appear here for admin operations and review.',
      },
    ]
  }, [dataMaskingEnabled, searchableReservations])

  const featuredItems = useMemo(
    () => [
      { id: 'admin-1', title: 'Morning queue', subtitle: 'Primary booking window' },
      { id: 'admin-2', title: 'Specialist lane', subtitle: 'Department handoff flow' },
      { id: 'admin-3', title: 'Review desk', subtitle: 'Recorded appointment validation' },
      { id: 'admin-4', title: 'Escalation path', subtitle: 'Failed status recovery' },
    ],
    []
  )

  const reportLogs = useMemo(
    () => buildLogItems({ reservations, authUser, sessionStatus }),
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

  const itemsByTab = useMemo<Record<AdminUserManagementTab, AdminUserManagementItem[]>>(
    () => ({
      users: buildUserItems(reservations, userManagementMeta),
      doctors: buildDoctorItems(reservations, doctorManagementMeta),
    }),
    [reservations, userManagementMeta, doctorManagementMeta]
  )

  const filteredManagementItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const activeItems = itemsByTab[managementTab]
    if (!query) return activeItems

    return activeItems.filter((item) => {
      return (
        item.displayName.toLowerCase().includes(query) ||
        item.referenceId.toLowerCase().includes(query) ||
        item.contactEmail.toLowerCase().includes(query) ||
        item.note.toLowerCase().includes(query)
      )
    })
  }, [itemsByTab, managementTab, searchQuery])

  const managementTotalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredManagementItems.length / PAGINATION_PAGE_SIZE)),
    [filteredManagementItems.length]
  )

  const safeManagementPage = Math.min(managementPage, managementTotalPages)
  const pagedManagementItems = useMemo(
    () => getPageSlice(filteredManagementItems, safeManagementPage),
    [filteredManagementItems, safeManagementPage]
  )
  const resolvedEditingKey =
    editingKey && filteredManagementItems.some((item) => item.key === editingKey)
      ? editingKey
      : null

  const updateTabMeta = (
    tab: AdminUserManagementTab,
    updater: (previous: Record<string, ManagementMeta>) => Record<string, ManagementMeta>
  ) => {
    if (tab === 'users') {
      setUserManagementMeta(updater)
      return
    }
    setDoctorManagementMeta(updater)
  }

  const getIdentityFromKey = (key: string) => {
    const parts = key.split(':')
    return parts[1] ?? key
  }

  const beginManagementEdit = (item: AdminUserManagementItem) => {
    setEditingKey(item.key)
    setDraftName(item.displayName)
    setDraftEmail(item.contactEmail)
    setDraftNote(item.note)
    setManagementActionMessage(null)
    setManagementActionError(null)
  }

  const saveManagementEdit = (key: string) => {
    const nextName = draftName.trim()
    const nextEmail = draftEmail.trim()
    const nextNote = draftNote.trim()

    if (!nextName) {
      setManagementActionError('Display name is required.')
      return
    }

    if (nextEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      setManagementActionError('Enter a valid email format, or leave it blank.')
      return
    }

    const identity = getIdentityFromKey(key)
    const currentItem = itemsByTab[managementTab].find((item) => item.key === key)

    updateTabMeta(managementTab, (previous) => ({
      ...previous,
      [identity]: {
        displayName: nextName,
        accountStatus: currentItem?.accountStatus ?? previous[identity]?.accountStatus ?? 'Active',
        contactEmail: nextEmail,
        note: nextNote,
      },
    }))

    setEditingKey(null)
    setManagementActionError(null)
    setManagementActionMessage(`${managementTab.slice(0, -1)} profile updated.`)
  }

  const setManagementAccountStatus = (key: string, status: 'Active' | 'Disabled') => {
    const identity = getIdentityFromKey(key)
    const currentItem = itemsByTab[managementTab].find((item) => item.key === key)

    updateTabMeta(managementTab, (previous) => ({
      ...previous,
      [identity]: {
        ...(currentItem ? toMeta(currentItem) : previous[identity] ?? { displayName: '', contactEmail: '', note: '', accountStatus: 'Active' }),
        accountStatus: status,
      },
    }))

    setManagementActionError(null)
    setManagementActionMessage(`Record marked as ${status.toLowerCase()}.`)
  }

  const searchPlaceholderMap: Record<AdminSidebarSection, string> = {
    dashboard: 'Search by patient, id, department, or summary',
    appointments: 'Search appointments',
    reports_log: "Search report's log",
    user_management: 'Search users, doctors, or notes',
    settings: 'Search settings',
  }

  const searchLabelMap: Record<AdminSidebarSection, string> = {
    dashboard: 'Search dashboard',
    appointments: 'Search appointments',
    reports_log: "Search report's log",
    user_management: 'Search user management',
    settings: 'Search settings',
  }

  const sectionTitleMap: Record<AdminSidebarSection, string> = {
    dashboard: 'Dashboard',
    appointments: 'Appointment',
    reports_log: "Report's Log",
    user_management: 'User Management',
    settings: 'Settings',
  }
  const profileName = resolveAdminDisplayName(authUser)

  return (
    <PageCanvas>
      <div className="mx-auto w-full max-w-[1500px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <SidebarShell
          mobileTitle="Admin"
          stickyOffsetMode="auto"
          sidebar={
            <Sidebar
              variant="reference"
              mobileMode="drawer"
              fullRail
              brandTitle="AI Health Care"
              brandSubtitle="Admin"
              sectionLabel="Main"
              items={sidebarItems}
              activeKey={activeSection}
              onSelect={(key) => {
                if (isAdminSidebarSection(key)) {
                  setSection(key)
                }
              }}
              auxiliaryLabel="Utilities"
              secondaryItems={utilityItems}
              onSelectAuxiliary={(key) => {
                if (isAdminSidebarSection(key)) {
                  setSection(key)
                  return
                }
                if (key === 'logout') {
                  onLogout()
                }
              }}
              supportItem={{ key: 'logout', label: 'Log out', icon: 'shield' }}
              footerProfile={{
                name: profileName,
                subtitle: 'Admin',
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
                <PageTopBar
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
              <AdminDashboardOverviewSection
                metrics={dashboardMetrics}
                completionRate={completionRate}
                weeklySeries={weeklySeries}
                activityItems={activityItems}
                recommendationItems={recommendationItems}
                featuredItems={featuredItems}
              />
            ) : null}

            {activeSection === 'appointments' ? (
              <AdminAppointmentsSection
                pagedReservations={pagedReservations}
                filteredReservations={filteredReservations}
                searchableReservationCount={searchableReservations.length}
                statusFilter={statusFilter}
                onStatusFilterChange={(next) => {
                  setStatusFilter(next)
                  setAppointmentsPage(1)
                }}
                onResetFilters={() => {
                  setStatusFilter('all')
                  setSearchQuery('')
                  setAppointmentsPage(1)
                }}
                dataMaskingEnabled={dataMaskingEnabled}
                currentPage={safeAppointmentsPage}
                onPageChange={setAppointmentsPage}
                pageSize={PAGINATION_PAGE_SIZE}
                maxPageButtons={MAX_PAGE_BUTTONS}
              />
            ) : null}

            {activeSection === 'reports_log' ? (
              <AdminReportsLogSection
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

            {activeSection === 'user_management' ? (
              <AdminUserManagementSection
                activeTab={managementTab}
                onTabChange={(tab) => {
                  setManagementTab(tab)
                  setManagementPage(1)
                  setEditingKey(null)
                  setManagementActionError(null)
                  setManagementActionMessage(null)
                }}
                itemsByTab={itemsByTab}
                pagedItems={pagedManagementItems}
                currentPage={safeManagementPage}
                onPageChange={setManagementPage}
                pageSize={PAGINATION_PAGE_SIZE}
                maxPageButtons={MAX_PAGE_BUTTONS}
                dataMaskingEnabled={dataMaskingEnabled}
                editingKey={resolvedEditingKey}
                draftName={draftName}
                draftEmail={draftEmail}
                draftNote={draftNote}
                onDraftNameChange={setDraftName}
                onDraftEmailChange={setDraftEmail}
                onDraftNoteChange={setDraftNote}
                onBeginEdit={beginManagementEdit}
                onSaveEdit={saveManagementEdit}
                onCancelEdit={() => {
                  setEditingKey(null)
                  setManagementActionError(null)
                }}
                onSetAccountStatus={setManagementAccountStatus}
                actionMessage={managementActionMessage}
                actionError={managementActionError}
              />
            ) : null}

            {activeSection === 'settings' ? (
              <AdminSettingsSection
                authUser={authUser}
                sessionStatus={sessionStatus}
                theme={theme}
                onToggleTheme={onToggleTheme}
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
    </PageCanvas>
  )
}

export default AdminDashboardPage

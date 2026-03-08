import { useMemo, useState, useEffect, useRef } from 'react'
import ConfirmModal from '../components/ui/ConfirmModal'
import WorkspaceCanvas from '../components/layout/WorkspaceCanvas'
import Sidebar, { type SidebarItem } from '../components/layout/Sidebar'
import WorkspaceSidebarShell from '../components/layout/WorkspaceSidebarShell'
import WorkspaceTopShell from '../components/layout/WorkspaceTopShell'
import {
  workspaceGhostButtonClass,
  workspaceHeadingTextClass,
  workspaceMutedTextClass,
  workspacePanelClass,
  workspaceSubtleTextClass,
} from '../styles/workspaceUi'
import { buildRouteFromCanonicalPath, normalizePath } from '../config/routing'
import { getAdminTabPath, resolveAdminTabFromPath } from '../config/workspaceTabRoutes'
import type { AppPage } from '../types/navigation'
import type { AuthSession, Reservation } from '../types'
import { maskIdentifier, maskPersonName } from '../utils/privacy'
import { formatRoleLabel, getWorkspaceRoleLabel } from '../utils/roles'

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

type AdminSection =
  | 'user_management'
  | 'staff_management'
  | 'history'
  | 'notifications'
  | 'settings'

type AdminUserSummaryItem = {
  id: string
  displayName: string
  bookingCount: number
  latestActivity: string
  latestStatus: Reservation['status'] | 'None'
  flagged: boolean
}

type AdminStaffSummaryItem = {
  id: string
  name: string
  role: string
  workspace: string
  status: 'Online' | 'Idle' | 'Offline'
  lastAction: string
}

type AdminHistoryItem = {
  id: string
  actor: string
  type: 'Auth' | 'Reservation' | 'System'
  subject: string
  detail: string
  createdAt: string
  severity: 'Info' | 'Warning' | 'Critical'
}

type AdminNotificationItem = {
  id: string
  title: string
  detail: string
  createdAt: string
  severity: AdminHistoryItem['severity']
  category: 'Security' | 'Reservation' | 'System'
  read: boolean
}

const primaryItems: SidebarItem[] = [
  {
    key: 'user_management',
    label: 'User Management',
    caption: 'User activity and booking health',
    icon: 'user',
  },
  {
    key: 'staff_management',
    label: 'Staff Management',
    caption: 'Staff roles and workspace status',
    icon: 'hospital',
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
    key: 'notifications',
    label: 'Notifications',
    caption: 'Alerts and operational updates',
    icon: 'alert',
  },
  {
    key: 'settings',
    label: 'Account Settings',
    caption: 'Profile, theme, and privacy',
    icon: 'settings',
  },
]

const FALLBACK_USERS: AdminUserSummaryItem[] = [
  {
    id: 'RES-10021',
    displayName: 'Alyssa Howard',
    bookingCount: 3,
    latestActivity: '2026-02-17T16:20:00.000Z',
    latestStatus: 'Recorded',
    flagged: false,
  },
  {
    id: 'RES-10043',
    displayName: 'Marco Velez',
    bookingCount: 2,
    latestActivity: '2026-02-15T11:10:00.000Z',
    latestStatus: 'Booked',
    flagged: false,
  },
  {
    id: 'RES-10078',
    displayName: 'Sofia Levin',
    bookingCount: 1,
    latestActivity: '2026-02-14T08:40:00.000Z',
    latestStatus: 'Failed',
    flagged: true,
  },
]

const FALLBACK_STAFF: AdminStaffSummaryItem[] = [
  {
    id: 'STF-001',
    name: 'Dr. Mara Santos',
    role: 'Admin / Doctor',
    workspace: 'Doctor dashboard + Admin',
    status: 'Online',
    lastAction: 'Reviewed morning appointment queue',
  },
  {
    id: 'STF-002',
    name: 'Dr. Kim Perez',
    role: 'Doctor',
    workspace: 'Doctor dashboard + Admin',
    status: 'Idle',
    lastAction: 'Updated booking status for triage handoff',
  },
  {
    id: 'STF-003',
    name: 'Samuel Rhodes',
    role: 'Admin',
    workspace: 'Admin',
    status: 'Offline',
    lastAction: 'Completed access-policy review',
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

const FALLBACK_NOTIFICATIONS: AdminNotificationItem[] = [
  {
    id: 'NTF-901',
    title: 'Security policy check completed',
    detail: 'Daily privileged access policy checks completed with no critical findings.',
    createdAt: '2026-02-17T15:12:00.000Z',
    severity: 'Info',
    category: 'Security',
    read: false,
  },
  {
    id: 'NTF-902',
    title: 'Booking queue needs review',
    detail: 'Two reservations were flagged for manual doctor follow-up.',
    createdAt: '2026-02-16T10:35:00.000Z',
    severity: 'Warning',
    category: 'Reservation',
    read: false,
  },
  {
    id: 'NTF-903',
    title: 'System snapshot generated',
    detail: 'The daily operations snapshot is available for admin review.',
    createdAt: '2026-02-15T09:10:00.000Z',
    severity: 'Info',
    category: 'System',
    read: true,
  },
]

const parseDate = (value: string) => {
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const formatDateTime = (value: string) => {
  const timestamp = parseDate(value)
  if (!timestamp) return 'Unknown'
  return new Date(timestamp).toLocaleString()
}

const statusChipClass = (status: AdminUserSummaryItem['latestStatus']) => {
  if (status === 'Recorded') return 'agent-status-badge agent-status-badge--success'
  if (status === 'Failed') return 'agent-status-badge agent-status-badge--danger'
  if (status === 'Booked') return 'agent-status-badge agent-status-badge--info'
  return 'agent-status-badge agent-status-badge--neutral'
}

const staffStatusChipClass = (status: AdminStaffSummaryItem['status']) => {
  if (status === 'Online') return 'agent-status-badge agent-status-badge--success'
  if (status === 'Idle') return 'agent-status-badge agent-status-badge--warning'
  return 'agent-status-badge agent-status-badge--neutral'
}

const historySeverityChipClass = (severity: AdminHistoryItem['severity']) => {
  if (severity === 'Critical') return 'agent-status-badge agent-status-badge--danger'
  if (severity === 'Warning') return 'agent-status-badge agent-status-badge--warning'
  return 'agent-status-badge agent-status-badge--info'
}

const isStaffRole = (role?: AuthSession['user']['role'] | null) =>
  role === 'nurse' || role === 'admin' || role === 'system_admin'

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
  const [activeSection, setActiveSection] = useState<AdminSection>(() => {
    if (typeof window === 'undefined') return 'user_management'
    return resolveAdminTabFromPath(window.location.pathname) ?? 'user_management'
  })
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  // Auto-logout after 15 minutes of inactivity (900000 ms)
  const INACTIVITY_MS = 15 * 60 * 1000
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const resetInactivityTimer = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setShowLogoutConfirm(false)
      // auto logout after inactivity
      onLogout()
    }, INACTIVITY_MS)
  }

  useEffect(() => {
    resetInactivityTimer()
    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart']
    const handler = () => resetInactivityTimer()
    for (const ev of events) window.addEventListener(ev, handler)
    return () => {
      for (const ev of events) window.removeEventListener(ev, handler)
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [onLogout])

  const confirmAndLogout = () => {
    setShowLogoutConfirm(true)
  }

  const setSection = (next: AdminSection) => {
    setActiveSection(next)
    if (typeof window === 'undefined') return

    const targetPath = getAdminTabPath(next)
    if (normalizePath(window.location.pathname) === normalizePath(targetPath)) return

    window.history.pushState(
      { ...(window.history.state ?? {}), appRoute: true, appPage: 'admin' },
      '',
      buildRouteFromCanonicalPath(targetPath)
    )
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handlePopState = () => {
      setActiveSection(resolveAdminTabFromPath(window.location.pathname) ?? 'user_management')
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const userItems = useMemo<AdminUserSummaryItem[]>(() => {
    const orderedReservations = [...reservations].sort(
      (a, b) => parseDate(b.createdAt) - parseDate(a.createdAt)
    )

    if (!orderedReservations.length) {
      return FALLBACK_USERS
    }

    const perUser = new Map<string, AdminUserSummaryItem>()

    for (const reservation of orderedReservations) {
      const normalizedName = reservation.patientName.trim().toLowerCase()
      const key = normalizedName || reservation.id.toLowerCase()
      const existing = perUser.get(key)

      if (!existing) {
        perUser.set(key, {
          id: reservation.id,
          displayName: reservation.patientName,
          bookingCount: 1,
          latestActivity: reservation.createdAt,
          latestStatus: reservation.status,
          flagged: reservation.status === 'Failed',
        })
        continue
      }

      existing.bookingCount += 1
      existing.flagged = existing.flagged || reservation.status === 'Failed'

      if (parseDate(reservation.createdAt) > parseDate(existing.latestActivity)) {
        existing.id = reservation.id
        existing.latestActivity = reservation.createdAt
        existing.latestStatus = reservation.status
      }
    }

    return [...perUser.values()].sort(
      (a, b) => parseDate(b.latestActivity) - parseDate(a.latestActivity)
    )
  }, [reservations])

  const staffItems = useMemo<AdminStaffSummaryItem[]>(() => {
    const items = [...FALLBACK_STAFF]

    if (authUser && isStaffRole(authUser.role)) {
      const statusText: AdminStaffSummaryItem['status'] =
        sessionStatus.toLowerCase().includes('active') ? 'Online' : 'Idle'

      items.unshift({
        id: `STAFF-${authUser.username}`,
        name: authUser.username,
        role: formatRoleLabel(authUser.role),
        workspace:
          authUser.role === 'system_admin' ? 'Admin + Doctor dashboard' : 'Doctor dashboard + Admin',
        status: statusText,
        lastAction: 'Current privileged session active',
      })
    }

    const unique = new Map<string, AdminStaffSummaryItem>()
    for (const item of items) {
      const key = item.name.trim().toLowerCase()
      if (!unique.has(key)) {
        unique.set(key, item)
      }
    }

    return [...unique.values()]
  }, [authUser, sessionStatus])

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

  const filteredUsers = useMemo(() => {
    if (!normalizedQuery) return userItems
    return userItems.filter((item) => {
      return (
        item.displayName.toLowerCase().includes(normalizedQuery) ||
        item.id.toLowerCase().includes(normalizedQuery) ||
        item.latestStatus.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [normalizedQuery, userItems])

  const filteredStaff = useMemo(() => {
    if (!normalizedQuery) return staffItems
    return staffItems.filter((item) => {
      return (
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.role.toLowerCase().includes(normalizedQuery) ||
        item.status.toLowerCase().includes(normalizedQuery) ||
        item.workspace.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [normalizedQuery, staffItems])

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

  const notificationItems = useMemo<AdminNotificationItem[]>(() => {
    if (!historyItems.length) return FALLBACK_NOTIFICATIONS

    return historyItems.slice(0, 12).map((item, index) => ({
      id: `NTF-${item.id}`,
      title: `${item.type} update`,
      detail: `${item.subject}: ${item.detail}`,
      createdAt: item.createdAt,
      severity: item.severity,
      category:
        item.type === 'Auth'
          ? 'Security'
          : item.type === 'Reservation'
            ? 'Reservation'
            : 'System',
      read: index > 3,
    }))
  }, [historyItems])

  const filteredNotifications = useMemo(() => {
    if (!normalizedQuery) return notificationItems
    return notificationItems.filter((item) => {
      return (
        item.title.toLowerCase().includes(normalizedQuery) ||
        item.detail.toLowerCase().includes(normalizedQuery) ||
        item.category.toLowerCase().includes(normalizedQuery) ||
        item.severity.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [normalizedQuery, notificationItems])

  const userMetrics = useMemo(() => {
    const activeUsers = userItems.filter(
      (item) => item.latestStatus === 'Booked' || item.latestStatus === 'Recorded'
    ).length
    const bookedUsers = userItems.filter(
      (item) => item.latestStatus === 'Booked' || item.latestStatus === 'Recorded'
    ).length
    const flaggedUsers = userItems.filter((item) => item.flagged).length

    return [
      { key: 'users-total', label: 'Total patients', value: userItems.length, caption: `${filteredUsers.length} matching` },
      { key: 'users-active', label: 'Active patients', value: activeUsers, caption: 'Booked or recorded' },
      { key: 'users-booked', label: 'Booked patients', value: bookedUsers, caption: 'Booked or recorded' },
      { key: 'users-flagged', label: 'Flagged', value: flaggedUsers, caption: 'Failed latest status' },
    ]
  }, [filteredUsers.length, userItems])

  const staffMetrics = useMemo(() => {
    const onlineStaff = staffItems.filter((item) => item.status === 'Online').length
    const adminStaff = staffItems.filter((item) => item.role.toLowerCase().includes('admin')).length
    const doctorStaff = staffItems.filter((item) => {
      const normalizedRole = item.role.toLowerCase()
      return normalizedRole.includes('doctor') || normalizedRole.includes('nurse')
    }).length

    return [
      { key: 'staff-total', label: 'Total staff', value: staffItems.length, caption: `${filteredStaff.length} matching` },
      { key: 'staff-online', label: 'Online', value: onlineStaff, caption: 'Current session visibility' },
      { key: 'staff-admin', label: 'Admin roles', value: adminStaff, caption: 'Admin workspace operators' },
      { key: 'staff-doctor', label: 'Doctors', value: doctorStaff, caption: 'Doctor workspace operators' },
    ]
  }, [filteredStaff.length, staffItems])

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

  const notificationsMetrics = useMemo(() => {
    const unread = notificationItems.filter((item) => !item.read).length
    const critical = notificationItems.filter((item) => item.severity === 'Critical').length
    const reservationUpdates = notificationItems.filter((item) => item.category === 'Reservation').length

    return [
      {
        key: 'notifications-total',
        label: 'Total alerts',
        value: notificationItems.length,
        caption: `${filteredNotifications.length} matching`,
      },
      {
        key: 'notifications-unread',
        label: 'Unread',
        value: unread,
        caption: 'Needs review',
      },
      {
        key: 'notifications-critical',
        label: 'Critical',
        value: critical,
        caption: 'High priority alerts',
      },
      {
        key: 'notifications-reservation',
        label: 'Reservation updates',
        value: reservationUpdates,
        caption: 'Queue activity signals',
      },
    ]
  }, [filteredNotifications.length, notificationItems])

  const settingsMetrics = useMemo(
    () => [
      { key: 'settings-account', label: 'Account', value: authUser?.username ?? 'Unknown', caption: 'Signed in user' },
      { key: 'settings-role', label: 'Role', value: getWorkspaceRoleLabel(authUser?.role), caption: 'Workspace role' },
      { key: 'settings-theme', label: 'Theme', value: theme === 'dark' ? 'Dark' : 'Light', caption: 'Current theme' },
      { key: 'settings-masking', label: 'Masking', value: dataMaskingEnabled ? 'On' : 'Off', caption: 'Data protection' },
    ],
    [authUser?.role, authUser?.username, dataMaskingEnabled, theme]
  )

  const sectionMeta = {
    user_management: {
      title: 'User Management',
      description:
        'Monitor user booking activity and health-record flow with a focused operational summary.',
      searchPlaceholder: 'Search users by name, reservation id, or status',
      metrics: userMetrics,
    },
    staff_management: {
      title: 'Staff Management',
      description:
        'Track staff access posture and workspace readiness for doctor and admin roles.',
      searchPlaceholder: 'Search staff by name, role, workspace, or status',
      metrics: staffMetrics,
    },
    history: {
      title: 'History',
      description:
        'Review recent privileged activity across sessions, reservation operations, and system checks.',
      searchPlaceholder: 'Search history by actor, type, subject, or severity',
      metrics: historyMetrics,
    },
    notifications: {
      title: 'Notifications',
      description: 'Track operational alerts and security updates across admin and doctor workflows.',
      searchPlaceholder: 'Search notifications by title, category, or severity',
      metrics: notificationsMetrics,
    },
    settings: {
      title: 'Account Settings',
      description: 'Manage admin workspace preferences and session details.',
      searchPlaceholder: 'Search settings',
      metrics: settingsMetrics,
    },
  } as const

  const activeMeta = sectionMeta[activeSection]

  return (
    <WorkspaceCanvas>
      <div className="w-full">
        <WorkspaceSidebarShell
          className={`workspace-shell--full-side${isSidebarCollapsed ? ' workspace-shell--rail-collapsed' : ''}`}
          contentClassName="px-4 pb-10 pt-5 sm:px-6 lg:px-8"
          mobileTitle="Admin workspace"
          stickyOffsetMode="auto"
          sidebar={
            <Sidebar
              variant="dashboard"
              mobileMode="drawer"
              fullRail
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed((previous) => !previous)}
              brandTitle="AI Health Care"
              brandSubtitle="Admin workspace"
              sectionLabel="Primary"
              items={primaryItems}
              activeKey={activeSection}
              onSelect={(key) => {
                if (key === 'user_management' || key === 'staff_management' || key === 'history') {
                  setSection(key)
                }
              }}
              auxiliaryLabel="Utilities"
              secondaryItems={utilityItems}
              onSelectAuxiliary={(key) => {
                if (key === 'notifications') {
                  setSection('notifications')
                  return
                }
                if (key === 'settings') {
                  setSection('settings')
                  return
                }
                if (key === 'landing') {
                  onNavigate?.('landing')
                }
              }}
              footerProfile={{
                name: authUser?.username ?? 'Admin',
                subtitle: 'Admin workspace',
                onClick: () => setSection('settings'),
              }}
            />
          }
          content={
            <section className="space-y-6">
              <WorkspaceTopShell
                eyebrow="Privileged session"
                title={activeMeta.title}
                description={activeMeta.description}
                searchValue={searchQuery}
                searchPlaceholder={activeMeta.searchPlaceholder}
                onSearchChange={setSearchQuery}
                profileName={authUser?.username ?? 'Admin'}
                profileCaption={`${getWorkspaceRoleLabel(authUser?.role)} workspace`}
                showNotifications
                notificationCount={Math.min(notificationItems.filter((item) => !item.read).length, 99)}
                onSignOut={confirmAndLogout}
                metrics={activeMeta.metrics}
              />

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

              {activeSection === 'user_management' ? (
                <section className={`${workspacePanelClass} p-5`}>
                  <h2 className="agent-section-title agent-section-title--compact">User directory</h2>
                  <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                    Frontend-derived user booking visibility with fallback records when activity is empty.
                  </p>

                  {filteredUsers.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-4">
                      <p className={`text-sm ${workspaceMutedTextClass}`}>
                        No users match your search query.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full divide-y divide-[color:var(--card-border)] text-sm">
                        <thead>
                          <tr>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>User</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Bookings</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Latest activity</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[color:var(--card-border)]">
                          {filteredUsers.map((item) => {
                            const displayName = dataMaskingEnabled
                              ? maskPersonName(item.displayName)
                              : item.displayName
                            const displayId = dataMaskingEnabled ? maskIdentifier(item.id) : item.id

                            return (
                              <tr key={`${item.id}-${item.displayName}`}>
                                <td className="px-3 py-3 align-top">
                                  <p className={`font-semibold ${workspaceHeadingTextClass}`}>{displayName}</p>
                                  <p className={`text-xs ${workspaceMutedTextClass}`}>{displayId}</p>
                                </td>
                                <td className={`px-3 py-3 ${workspaceHeadingTextClass}`}>{item.bookingCount}</td>
                                <td className={`px-3 py-3 ${workspaceMutedTextClass}`}>{formatDateTime(item.latestActivity)}</td>
                                <td className="px-3 py-3">
                                  <span className={statusChipClass(item.latestStatus)}>{item.latestStatus}</span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ) : null}

              {activeSection === 'staff_management' ? (
                <section className={`${workspacePanelClass} p-5`}>
                  <h2 className="agent-section-title agent-section-title--compact">Staff directory</h2>
                  <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                    Staff role visibility for doctor and admin workflows.
                  </p>

                  {filteredStaff.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-4">
                      <p className={`text-sm ${workspaceMutedTextClass}`}>
                        No staff records match your search query.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full divide-y divide-[color:var(--card-border)] text-sm">
                        <thead>
                          <tr>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Staff member</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Role</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Workspace</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Last action</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[color:var(--card-border)]">
                          {filteredStaff.map((item) => (
                            <tr key={item.id}>
                              <td className="px-3 py-3 align-top">
                                <p className={`font-semibold ${workspaceHeadingTextClass}`}>{item.name}</p>
                                <p className={`text-xs ${workspaceMutedTextClass}`}>{item.id}</p>
                              </td>
                              <td className={`px-3 py-3 ${workspaceMutedTextClass}`}>{item.role}</td>
                              <td className={`px-3 py-3 ${workspaceMutedTextClass}`}>{item.workspace}</td>
                              <td className={`px-3 py-3 ${workspaceMutedTextClass}`}>{item.lastAction}</td>
                              <td className="px-3 py-3">
                                <span className={staffStatusChipClass(item.status)}>{item.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
                          <span className={historySeverityChipClass(item.severity)}>{item.severity}</span>
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

              {activeSection === 'notifications' ? (
                <section className="space-y-3">
                  {filteredNotifications.length === 0 ? (
                    <article className={`${workspacePanelClass} p-5`}>
                      <p className={`text-sm ${workspaceMutedTextClass}`}>
                        No notifications match your search query.
                      </p>
                    </article>
                  ) : (
                    filteredNotifications.map((item) => (
                      <article
                        key={item.id}
                        className={`${workspacePanelClass} p-5 ${item.read ? '' : 'ring-1 ring-blue-200/70'}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              {!item.read ? (
                                <span
                                  className="inline-block h-2.5 w-2.5 rounded-full bg-[color:var(--agent-accent)]"
                                  title="Unread"
                                />
                              ) : null}
                              <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>
                                {item.category}
                              </p>
                            </div>
                            <h2 className={`mt-1 text-base font-semibold ${workspaceHeadingTextClass}`}>
                              {item.title}
                            </h2>
                            <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>{item.detail}</p>
                          </div>
                          <span className={historySeverityChipClass(item.severity)}>{item.severity}</span>
                        </div>

                        <div className="mt-3 text-xs text-[color:var(--agent-muted-soft)]">
                          <span>{formatDateTime(item.createdAt)}</span>
                        </div>
                      </article>
                    ))
                  )}
                </section>
              ) : null}

              {activeSection === 'settings' ? (
                <section className={`${workspacePanelClass} p-5`}>
                  <h2 className="agent-section-title agent-section-title--compact">Account settings</h2>
                  <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                    Manage profile visibility and workspace preferences from a single tab.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="reference-card-soft p-3">
                      <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Account</p>
                      <p className={`mt-1 text-sm font-semibold ${workspaceHeadingTextClass}`}>{authUser?.username ?? 'Unknown'}</p>
                    </div>
                    <div className="reference-card-soft p-3">
                      <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Role</p>
                      <p className={`mt-1 text-sm font-semibold ${workspaceHeadingTextClass}`}>{getWorkspaceRoleLabel(authUser?.role)}</p>
                    </div>
                    <div className="reference-card-soft p-3">
                      <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Theme</p>
                      <p className={`mt-1 text-sm font-semibold ${workspaceHeadingTextClass}`}>{theme === 'dark' ? 'Dark' : 'Light'}</p>
                    </div>
                    <div className="reference-card-soft p-3">
                      <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Data masking</p>
                      <p className={`mt-1 text-sm font-semibold ${workspaceHeadingTextClass}`}>{dataMaskingEnabled ? 'On' : 'Off'}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" className={workspaceGhostButtonClass} onClick={onToggleTheme}>
                      Switch to {theme === 'dark' ? 'Light' : 'Dark'} theme
                    </button>
                    <button type="button" className={workspaceGhostButtonClass} onClick={onToggleDataMasking}>
                      Turn data masking {dataMaskingEnabled ? 'Off' : 'On'}
                    </button>
                  </div>

                  <p className={`mt-4 text-xs ${workspaceSubtleTextClass}`}>Session: {sessionStatus}</p>
                </section>
              ) : null}
            </section>
          }
        />
      </div>
    </WorkspaceCanvas>
  )
}

export default AdminDashboard

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

type AdminSection = 'user_management' | 'staff_management' | 'history' | 'settings'

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
    key: 'settings',
    label: 'Account Settings',
    caption: 'Profile, theme, and privacy',
    icon: 'settings',
  },
  {
    key: 'landing',
    label: 'Landing',
    caption: 'Public overview page',
    icon: 'home',
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
  if (status === 'Recorded') return 'border-emerald-300/70 bg-emerald-100 text-emerald-700'
  if (status === 'Failed') return 'border-rose-300/70 bg-rose-100 text-rose-700'
  if (status === 'Booked') return 'border-sky-300/70 bg-sky-100 text-sky-700'
  return 'border-[color:var(--card-border)] bg-[color:var(--agent-surface)] text-[color:var(--agent-muted)]'
}

const staffStatusChipClass = (status: AdminStaffSummaryItem['status']) => {
  if (status === 'Online') return 'border-emerald-300/70 bg-emerald-100 text-emerald-700'
  if (status === 'Idle') return 'border-amber-300/70 bg-amber-100 text-amber-700'
  return 'border-slate-300/70 bg-slate-100 text-slate-700'
}

const historySeverityChipClass = (severity: AdminHistoryItem['severity']) => {
  if (severity === 'Critical') return 'border-rose-300/70 bg-rose-100 text-rose-700'
  if (severity === 'Warning') return 'border-amber-300/70 bg-amber-100 text-amber-700'
  return 'border-sky-300/70 bg-sky-100 text-sky-700'
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
                notificationCount={Math.min(filteredHistory.length, 99)}
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
                  <h2 className={`text-lg font-semibold ${workspaceHeadingTextClass}`}>User directory</h2>
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
                                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusChipClass(item.latestStatus)}`}>
                                    {item.latestStatus}
                                  </span>
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
                  <h2 className={`text-lg font-semibold ${workspaceHeadingTextClass}`}>Staff directory</h2>
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
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${staffStatusChipClass(item.status)}`}>
                                  {item.status}
                                </span>
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
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${historySeverityChipClass(item.severity)}`}>
                            {item.severity}
                          </span>
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

              {activeSection === 'settings' ? (
                <section className={`${workspacePanelClass} p-5`}>
                  <h2 className={`text-lg font-semibold ${workspaceHeadingTextClass}`}>Account settings</h2>
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

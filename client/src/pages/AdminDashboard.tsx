import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
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
import { formatPhilippineDateTime } from '../utils/dateTime'
import { maskIdentifier, maskPersonName } from '../utils/privacy'
import { formatRoleLabel, getWorkspaceRoleLabel } from '../utils/roles'
import {
  api,
  type AdminAuditLogRecord,
  type AdminErrorLogRecord,
  type AdminStaffApplicationRecord,
  type AdminUserRecord,
} from '../services/api'

type AdminDashboardProps = {
  authUser: AuthSession['user'] | null
  reservations: Reservation[]
  onNavigate?: (page: AppPage) => void
  onLogout: () => void
  sessionStatus: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  dataMaskingEnabled: boolean
}

type AdminSection =
  | 'user_management'
  | 'staff_management'
  | 'audit_log'
  | 'error_log'
  | 'notifications'
  | 'settings'

type BookingSummary = {
  total: number
  current: number
  future: number
  latestStatus: Reservation['status'] | 'None'
  latestActivity: string | null
  history: Reservation[]
}

type AdminNotificationItem = {
  id: string
  title: string
  detail: string
  createdAt: string
  severity: 'Info' | 'Warning' | 'Critical'
  category: 'Audit' | 'Error' | 'System'
  read: boolean
}

const primaryItems: SidebarItem[] = [
  {
    key: 'user_management',
    label: 'User Management',
    caption: 'Users, profiles, booking history, account status',
    icon: 'user',
  },
  {
    key: 'staff_management',
    label: 'Staff Management',
    caption: 'Staff profiles and current/future bookings',
    icon: 'hospital',
  },
  {
    key: 'audit_log',
    label: 'Audit Log',
    caption: 'Server audit trail',
    icon: 'report',
  },
  {
    key: 'error_log',
    label: 'Error Log',
    caption: 'Server error records',
    icon: 'alert',
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

const parseDate = (value: string | null | undefined) => {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const formatDateTime = (value: string | null | undefined) => {
  const timestamp = parseDate(value)
  if (!timestamp) return 'Unknown'
  return formatPhilippineDateTime(timestamp)
}

const statusChipClass = (status: Reservation['status'] | 'None') => {
  if (status === 'Recorded') return 'border-emerald-300/70 bg-emerald-100 text-emerald-700'
  if (status === 'Failed') return 'border-rose-300/70 bg-rose-100 text-rose-700'
  if (status === 'Booked') return 'border-sky-300/70 bg-sky-100 text-sky-700'
  return 'border-[color:var(--card-border)] bg-[color:var(--agent-surface)] text-[color:var(--agent-muted)]'
}

const accountChipClass = (status: AdminUserRecord['status']) =>
  status === 'disabled'
    ? 'border-rose-300/70 bg-rose-100 text-rose-700'
    : 'border-emerald-300/70 bg-emerald-100 text-emerald-700'

const severityChipClass = (severity: 'Info' | 'Warning' | 'Critical') => {
  if (severity === 'Critical') return 'border-rose-300/70 bg-rose-100 text-rose-700'
  if (severity === 'Warning') return 'border-amber-300/70 bg-amber-100 text-amber-700'
  return 'border-sky-300/70 bg-sky-100 text-sky-700'
}

const buildBookingSummary = (
  reservations: Reservation[],
  matcher: (item: Reservation) => boolean
): BookingSummary => {
  const matched = reservations.filter(matcher).sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt))

  if (matched.length === 0) {
    return {
      total: 0,
      current: 0,
      future: 0,
      latestStatus: 'None',
      latestActivity: null,
      history: [],
    }
  }

  const now = Date.now()
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date(startOfToday)
  endOfToday.setDate(endOfToday.getDate() + 1)

  const current = matched.filter((item) => {
    if (item.status !== 'Booked') return false
    const ts = parseDate(item.requestedTime)
    return ts >= startOfToday.getTime() && ts < endOfToday.getTime()
  }).length

  const future = matched.filter((item) => {
    if (item.status !== 'Booked') return false
    const ts = parseDate(item.requestedTime)
    return ts >= now
  }).length

  return {
    total: matched.length,
    current,
    future,
    latestStatus: matched[0]?.status ?? 'None',
    latestActivity: matched[0]?.createdAt ?? null,
    history: matched,
  }
}

const resolveAdminDisplayName = (user: AuthSession['user'] | null) => {
  const fullName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
  if (fullName) return fullName
  return 'Admin'
}

const AdminDashboard = ({
  authUser,
  reservations,
  onNavigate,
  onLogout,
  sessionStatus,
  theme,
  onToggleTheme,
  dataMaskingEnabled,
}: AdminDashboardProps) => {
  const [activeSection, setActiveSection] = useState<AdminSection>(() => {
    if (typeof window === 'undefined') return 'user_management'
    return resolveAdminTabFromPath(window.location.pathname) ?? 'user_management'
  })
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [users, setUsers] = useState<AdminUserRecord[]>([])
  const [pendingStaffApplications, setPendingStaffApplications] = useState<AdminStaffApplicationRecord[]>([])
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRecord[]>([])
  const [errorLogs, setErrorLogs] = useState<AdminErrorLogRecord[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isDownloadingAuditBackup, setIsDownloadingAuditBackup] = useState(false)
  const [isDownloadingErrorBackup, setIsDownloadingErrorBackup] = useState(false)

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null)
  const [staffApplicationRoleFilter, setStaffApplicationRoleFilter] = useState<'all' | 'doctor'>('all')
  const [selectedStaffApplication, setSelectedStaffApplication] = useState<AdminStaffApplicationRecord | null>(null)
  const [isReviewActionPending, setIsReviewActionPending] = useState(false)

  const INACTIVITY_MS = 15 * 60 * 1000
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const resetInactivityTimer = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setShowLogoutConfirm(false)
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

  const fetchAdminData = async () => {
    setLoadingData(true)
    setDataError(null)
    try {
      const [usersResult, pendingApplicationsResult, auditResult, errorResult] = await Promise.allSettled([
        api.getAdminUsers(),
        api.getPendingStaffApplications('all'),
        api.getAdminAuditLogs(300),
        api.getAdminErrorLogs(300),
      ])

      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value)
      } else {
        setUsers([])
      }

      if (auditResult.status === 'fulfilled') {
        setAuditLogs(auditResult.value)
      } else {
        setAuditLogs([])
      }

      if (pendingApplicationsResult.status === 'fulfilled') {
        setPendingStaffApplications(pendingApplicationsResult.value)
      } else {
        setPendingStaffApplications([])
      }

      if (errorResult.status === 'fulfilled') {
        setErrorLogs(errorResult.value)
      } else {
        setErrorLogs([])
      }

      const failures = [usersResult, pendingApplicationsResult, auditResult, errorResult].filter(
        (item) => item.status === 'rejected'
      )
      if (failures.length > 0) {
        const firstError = failures[0] as PromiseRejectedResult
        const message =
          firstError.reason instanceof Error
            ? firstError.reason.message
            : 'Some admin records could not be loaded.'
        setDataError(message)
      }
    } finally {
      setLoadingData(false)
    }
  }

  useEffect(() => {
    void fetchAdminData()
  }, [])

  const setSection = (next: AdminSection) => {
    setSearchQuery('')
    setActionError(null)
    setActionMessage(null)
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

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const usersWithBookings = useMemo(() => {
    return users
      .filter((item) => item.role === 'user')
      .map((item) => {
        const fullName = `${item.firstName} ${item.lastName}`.trim()
        const summary = buildBookingSummary(reservations, (reservation) => {
          const patientName = reservation.patientName.trim().toLowerCase()
          return patientName === fullName.toLowerCase()
        })
        return { user: item, fullName, summary }
      })
      .sort((a, b) => parseDate(b.summary.latestActivity) - parseDate(a.summary.latestActivity))
  }, [reservations, users])

  const staffWithBookings = useMemo(() => {
    return users
      .filter((item) => item.role === 'doctor')
      .map((item) => {
        const fullName = `${item.firstName} ${item.lastName}`.trim()
        const summary = buildBookingSummary(reservations, (reservation) => {
          const doctorName = (reservation.doctorName ?? '').trim().toLowerCase()
          return doctorName === fullName.toLowerCase()
        })
        return { user: item, fullName, summary }
      })
      .sort((a, b) => parseDate(b.summary.latestActivity) - parseDate(a.summary.latestActivity))
  }, [reservations, users])

  const filteredUsers = useMemo(() => {
    if (!normalizedQuery) return usersWithBookings
    return usersWithBookings.filter(({ user, fullName, summary }) => {
      return (
        fullName.toLowerCase().includes(normalizedQuery) ||
        user.email.toLowerCase().includes(normalizedQuery) ||
        user.status.toLowerCase().includes(normalizedQuery) ||
        (user.profile?.phoneNumber ?? '').toLowerCase().includes(normalizedQuery) ||
        String(summary.total).includes(normalizedQuery)
      )
    })
  }, [normalizedQuery, usersWithBookings])

  const filteredStaff = useMemo(() => {
    if (!normalizedQuery) return staffWithBookings
    return staffWithBookings.filter(({ user, fullName, summary }) => {
      return (
        fullName.toLowerCase().includes(normalizedQuery) ||
        user.email.toLowerCase().includes(normalizedQuery) ||
        user.role.toLowerCase().includes(normalizedQuery) ||
        (user.department ?? '').toLowerCase().includes(normalizedQuery) ||
        String(summary.current).includes(normalizedQuery) ||
        String(summary.future).includes(normalizedQuery)
      )
    })
  }, [normalizedQuery, staffWithBookings])

  const filteredPendingStaffApplications = useMemo(() => {
    const roleFiltered =
      staffApplicationRoleFilter === 'all'
        ? pendingStaffApplications
        : pendingStaffApplications.filter((item) => item.role === staffApplicationRoleFilter)

    if (!normalizedQuery) return roleFiltered

    return roleFiltered.filter((item) => {
      const fullName = `${item.firstName} ${item.lastName}`.trim().toLowerCase()
      return (
        fullName.includes(normalizedQuery) ||
        item.email.toLowerCase().includes(normalizedQuery) ||
        item.role.toLowerCase().includes(normalizedQuery) ||
        (item.department ?? '').toLowerCase().includes(normalizedQuery)
      )
    })
  }, [normalizedQuery, pendingStaffApplications, staffApplicationRoleFilter])

  const filteredAuditLogs = useMemo(() => {
    if (!normalizedQuery) return auditLogs
    return auditLogs.filter((item) => {
      return (
        item.action.toLowerCase().includes(normalizedQuery) ||
        (item.details ?? '').toLowerCase().includes(normalizedQuery) ||
        (item.userId ?? '').toLowerCase().includes(normalizedQuery) ||
        (item.ipAddress ?? '').toLowerCase().includes(normalizedQuery)
      )
    })
  }, [auditLogs, normalizedQuery])

  const filteredErrorLogs = useMemo(() => {
    if (!normalizedQuery) return errorLogs
    return errorLogs.filter((item) => {
      return (
        item.message.toLowerCase().includes(normalizedQuery) ||
        (item.route ?? '').toLowerCase().includes(normalizedQuery) ||
        (item.method ?? '').toLowerCase().includes(normalizedQuery) ||
        (item.userId ?? '').toLowerCase().includes(normalizedQuery) ||
        (item.ipAddress ?? '').toLowerCase().includes(normalizedQuery)
      )
    })
  }, [errorLogs, normalizedQuery])

  const notificationItems = useMemo<AdminNotificationItem[]>(() => {
    const auditNotifications = auditLogs.slice(0, 10).map((item, index) => ({
      id: `audit-${item.id}`,
      title: item.action,
      detail: item.details ?? 'No details',
      createdAt: item.timestamp,
      severity: item.action.includes('DENIED') ? ('Warning' as const) : ('Info' as const),
      category: 'Audit' as const,
      read: index > 3,
    }))

    const errorNotifications = errorLogs.slice(0, 10).map((item, index) => ({
      id: `error-${item.id}`,
      title: item.message,
      detail: `${item.method ?? 'N/A'} ${item.route ?? ''}`.trim(),
      createdAt: item.timestamp,
      severity: 'Critical' as const,
      category: 'Error' as const,
      read: index > 1,
    }))

    return [...errorNotifications, ...auditNotifications]
      .sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt))
      .slice(0, 20)
  }, [auditLogs, errorLogs])

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

  const sectionMeta = {
    user_management: {
      title: 'User Management',
      description:
        'View user accounts from the server, including profile details and booking history. Disable accounts directly.',
      searchPlaceholder: 'Search users by name, email, profile, status, or bookings',
      metrics: [
        { key: 'users-total', label: 'Total users', value: usersWithBookings.length, caption: `${filteredUsers.length} matching` },
        {
          key: 'users-disabled',
          label: 'Disabled',
          value: usersWithBookings.filter((item) => item.user.status === 'disabled').length,
          caption: 'Server account status',
        },
        {
          key: 'users-bookings',
          label: 'Total bookings',
          value: usersWithBookings.reduce((sum, item) => sum + item.summary.total, 0),
          caption: 'All booking history records',
        },
        {
          key: 'users-current',
          label: 'Current bookings',
          value: usersWithBookings.reduce((sum, item) => sum + item.summary.current, 0),
          caption: 'Booked for today',
        },
      ],
    },
    staff_management: {
      title: 'Staff Management',
      description:
        'View staff accounts, profile information, and booking workload with current and future booking visibility.',
      searchPlaceholder: 'Search staff by name, role, department, email, or booking counts',
      metrics: [
        { key: 'staff-total', label: 'Total staff', value: staffWithBookings.length, caption: `${filteredStaff.length} matching` },
        {
          key: 'staff-pending',
          label: 'Pending applications',
          value: pendingStaffApplications.length,
          caption: 'Awaiting license review',
        },
        {
          key: 'staff-current',
          label: 'Current bookings',
          value: staffWithBookings.reduce((sum, item) => sum + item.summary.current, 0),
          caption: 'Booked for today',
        },
        {
          key: 'staff-future',
          label: 'Future bookings',
          value: staffWithBookings.reduce((sum, item) => sum + item.summary.future, 0),
          caption: 'Booked ahead',
        },
      ],
    },
    audit_log: {
      title: 'Audit Log',
      description: 'Server audit records from AuditLog model. Separate from error logs.',
      searchPlaceholder: 'Search audit log by action, details, user id, or IP',
      metrics: [
        { key: 'audit-total', label: 'Audit events', value: auditLogs.length, caption: `${filteredAuditLogs.length} matching` },
        {
          key: 'audit-actions',
          label: 'Unique actions',
          value: new Set(auditLogs.map((item) => item.action)).size,
          caption: 'Distinct action names',
        },
        {
          key: 'audit-latest',
          label: 'Latest event',
          value: formatDateTime(auditLogs[0]?.timestamp),
          caption: 'Most recent timestamp',
        },
        {
          key: 'audit-users',
          label: 'Users logged',
          value: new Set(auditLogs.map((item) => item.userId).filter(Boolean)).size,
          caption: 'Distinct user ids',
        },
      ],
    },
    error_log: {
      title: 'Error Log',
      description: 'Server error records from ErrorLog model. Separate from audit logs.',
      searchPlaceholder: 'Search error log by message, route, method, user id, or IP',
      metrics: [
        { key: 'error-total', label: 'Error events', value: errorLogs.length, caption: `${filteredErrorLogs.length} matching` },
        {
          key: 'error-routes',
          label: 'Routes affected',
          value: new Set(errorLogs.map((item) => item.route).filter(Boolean)).size,
          caption: 'Distinct routes',
        },
        {
          key: 'error-latest',
          label: 'Latest error',
          value: formatDateTime(errorLogs[0]?.timestamp),
          caption: 'Most recent timestamp',
        },
        {
          key: 'error-users',
          label: 'Users involved',
          value: new Set(errorLogs.map((item) => item.userId).filter(Boolean)).size,
          caption: 'Distinct user ids',
        },
      ],
    },
    notifications: {
      title: 'Notifications',
      description: 'Operational and security notifications generated from audit and error events.',
      searchPlaceholder: 'Search notifications by title, category, severity, or detail',
      metrics: [
        {
          key: 'notifications-total',
          label: 'Total alerts',
          value: notificationItems.length,
          caption: `${filteredNotifications.length} matching`,
        },
        {
          key: 'notifications-unread',
          label: 'Unread',
          value: notificationItems.filter((item) => !item.read).length,
          caption: 'Needs review',
        },
        {
          key: 'notifications-critical',
          label: 'Critical',
          value: notificationItems.filter((item) => item.severity === 'Critical').length,
          caption: 'High priority alerts',
        },
        {
          key: 'notifications-errors',
          label: 'Error alerts',
          value: notificationItems.filter((item) => item.category === 'Error').length,
          caption: 'From error logs',
        },
      ],
    },
    settings: {
      title: 'Account Settings',
      description: 'Manage admin workspace preferences and session details.',
      searchPlaceholder: 'Search settings',
      metrics: [
        { key: 'settings-account', label: 'Account', value: authUser?.username ?? 'Unknown', caption: 'Signed in user' },
        { key: 'settings-role', label: 'Role', value: getWorkspaceRoleLabel(authUser?.role), caption: 'Workspace role' },
        { key: 'settings-theme', label: 'Theme', value: theme === 'dark' ? 'Dark' : 'Light', caption: 'Current theme' },
      ],
    },
  } as const

  const activeMeta = sectionMeta[activeSection]
  const profileName = resolveAdminDisplayName(authUser)

  const handleUpdateUserStatus = async (userId: string, status: AdminUserRecord['status']) => {
    setActionMessage(null)
    setActionError(null)
    try {
      const updated = await api.updateAdminUser(userId, { status })
      setUsers((previous) => previous.map((item) => (item.id === userId ? updated : item)))
      setActionMessage(`Account updated to ${status}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update account status.'
      setActionError(message)
    }
  }

  const handleOpenStaffLicense = (application: AdminStaffApplicationRecord) => {
    if (typeof window === 'undefined') return
    if (!application.hasLicenseFile) {
      setActionError('No license file is available for this application.')
      return
    }
    const licenseUrl = api.getStaffApplicationLicenseUrl(application.id)
    window.open(licenseUrl, '_blank', 'noopener,noreferrer')
  }

  const handleApproveStaffApplication = async (application: AdminStaffApplicationRecord) => {
    setIsReviewActionPending(true)
    setActionMessage(null)
    setActionError(null)
    try {
      const approved = await api.approveStaffApplication(application.id)
      setUsers((previous) =>
        previous.some((item) => item.id === approved.id)
          ? previous.map((item) => (item.id === approved.id ? approved : item))
          : [approved, ...previous]
      )
      setPendingStaffApplications((previous) => previous.filter((item) => item.id !== application.id))
      setSelectedStaffApplication(null)
      setActionMessage('Doctor application approved.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to approve staff application.'
      setActionError(message)
    } finally {
      setIsReviewActionPending(false)
    }
  }

  const handleRejectStaffApplication = async (application: AdminStaffApplicationRecord) => {
    setIsReviewActionPending(true)
    setActionMessage(null)
    setActionError(null)
    try {
      await api.rejectStaffApplication(application.id)
      setUsers((previous) => previous.filter((item) => item.id !== application.id))
      setPendingStaffApplications((previous) => previous.filter((item) => item.id !== application.id))
      setSelectedStaffApplication(null)
      setActionMessage('Doctor application rejected and removed.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reject staff application.'
      setActionError(message)
    } finally {
      setIsReviewActionPending(false)
    }
  }

  const handleDownloadAuditBackup = async () => {
    setActionMessage(null)
    setActionError(null)
    setIsDownloadingAuditBackup(true)
    try {
      await api.downloadAdminAuditBackup()
      setActionMessage('Encrypted audit-log backup downloaded.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download audit backup.'
      setActionError(message)
    } finally {
      setIsDownloadingAuditBackup(false)
    }
  }

  const handleDownloadErrorBackup = async () => {
    setActionMessage(null)
    setActionError(null)
    setIsDownloadingErrorBackup(true)
    try {
      await api.downloadAdminErrorBackup()
      setActionMessage('Encrypted error-log backup downloaded.')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download error backup.'
      setActionError(message)
    } finally {
      setIsDownloadingErrorBackup(false)
    }
  }

  const confirmAndLogout = () => {
    setShowLogoutConfirm(true)
  }

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
                if (key === 'user_management' || key === 'staff_management' || key === 'audit_log' || key === 'error_log') {
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
                name: profileName,
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
                profileName={profileName}
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

              {selectedStaffApplication ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
                  <div className={`${workspacePanelClass} w-full max-w-2xl p-5`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>
                          New {selectedStaffApplication.role} application
                        </p>
                        <h3 className={`mt-1 text-lg font-semibold ${workspaceHeadingTextClass}`}>
                          Review staff account request
                        </h3>
                      </div>
                      <button
                        type="button"
                        className={workspaceGhostButtonClass}
                        disabled={isReviewActionPending}
                        onClick={() => setSelectedStaffApplication(null)}
                      >
                        Close
                      </button>
                    </div>

                    <div className={`mt-4 grid gap-3 text-sm ${workspaceMutedTextClass} sm:grid-cols-2`}>
                      <p>
                        Name:{' '}
                        <span className={workspaceHeadingTextClass}>
                          {dataMaskingEnabled
                            ? maskPersonName(`${selectedStaffApplication.firstName} ${selectedStaffApplication.lastName}`.trim())
                            : `${selectedStaffApplication.firstName} ${selectedStaffApplication.lastName}`.trim()}
                        </span>
                      </p>
                      <p>
                        Email:{' '}
                        <span className={workspaceHeadingTextClass}>
                          {dataMaskingEnabled
                            ? maskIdentifier(selectedStaffApplication.email)
                            : selectedStaffApplication.email}
                        </span>
                      </p>
                      <p>
                        Role:{' '}
                        <span className={workspaceHeadingTextClass}>{formatRoleLabel(selectedStaffApplication.role)}</span>
                      </p>
                      <p>
                        Department:{' '}
                        <span className={workspaceHeadingTextClass}>
                          {selectedStaffApplication.department || 'N/A'}
                        </span>
                      </p>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className={workspaceGhostButtonClass}
                        onClick={() => handleOpenStaffLicense(selectedStaffApplication)}
                      >
                        Open uploaded license
                      </button>
                      <button
                        type="button"
                        className={workspaceGhostButtonClass}
                        disabled={isReviewActionPending}
                        onClick={() => void handleApproveStaffApplication(selectedStaffApplication)}
                      >
                        Approve (Enable)
                      </button>
                      <button
                        type="button"
                        className={workspaceGhostButtonClass}
                        disabled={isReviewActionPending}
                        onClick={() => void handleRejectStaffApplication(selectedStaffApplication)}
                      >
                        Reject (Remove)
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {loadingData ? (
                <section className={`${workspacePanelClass} p-5`}>
                  <p className={`text-sm ${workspaceMutedTextClass}`}>Loading admin data from server...</p>
                </section>
              ) : null}

              {dataError ? (
                <section className={`${workspacePanelClass} p-5`}>
                  <p className="text-sm font-semibold text-rose-600">{dataError}</p>
                  <button type="button" className={`${workspaceGhostButtonClass} mt-3`} onClick={() => void fetchAdminData()}>
                    Retry
                  </button>
                </section>
              ) : null}

              {actionMessage ? (
                <section className={`${workspacePanelClass} p-4`}>
                  <p className="text-sm font-semibold text-emerald-600">{actionMessage}</p>
                </section>
              ) : null}

              {actionError ? (
                <section className={`${workspacePanelClass} p-4`}>
                  <p className="text-sm font-semibold text-rose-600">{actionError}</p>
                </section>
              ) : null}

              {activeSection === 'user_management' ? (
                <section className={`${workspacePanelClass} p-5`}>
                  <h2 className={`text-lg font-semibold ${workspaceHeadingTextClass}`}>User directory</h2>
                  <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                    Users with profile details and booking history from server data.
                  </p>

                  {filteredUsers.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-4">
                      <p className={`text-sm ${workspaceMutedTextClass}`}>No users match your search query.</p>
                    </div>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full divide-y divide-[color:var(--card-border)] text-sm">
                        <thead>
                          <tr>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>User</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Profile</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Booking history</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Account</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[color:var(--card-border)]">
                          {filteredUsers.map(({ user, fullName, summary }) => {
                            const displayName = dataMaskingEnabled ? maskPersonName(fullName) : fullName
                            const displayEmail = dataMaskingEnabled ? maskIdentifier(user.email) : user.email
                            const isExpanded = expandedUserId === user.id

                            return (
                              <Fragment key={user.id}>
                                <tr key={user.id}>
                                  <td className="px-3 py-3 align-top">
                                    <p className={`font-semibold ${workspaceHeadingTextClass}`}>{displayName}</p>
                                    <p className={`text-xs ${workspaceMutedTextClass}`}>{displayEmail}</p>
                                  </td>
                                  <td className={`px-3 py-3 ${workspaceMutedTextClass}`}>
                                    <p>Phone: {user.profile?.phoneNumber ?? 'N/A'}</p>
                                    <p>Gender: {user.profile?.gender ?? 'N/A'}</p>
                                    <p>DOB: {formatDateTime(user.profile?.dateOfBirth)}</p>
                                  </td>
                                  <td className="px-3 py-3">
                                    <p className={`${workspaceHeadingTextClass}`}>Total: {summary.total}</p>
                                    <p className={`${workspaceMutedTextClass}`}>Current: {summary.current}</p>
                                    <p className={`${workspaceMutedTextClass}`}>Future: {summary.future}</p>
                                    <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusChipClass(summary.latestStatus)}`}>
                                      {summary.latestStatus}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3">
                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${accountChipClass(user.status)}`}>
                                      {user.status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        className={workspaceGhostButtonClass}
                                        onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                                      >
                                        {isExpanded ? 'Hide history' : 'View history'}
                                      </button>
                                      <button
                                        type="button"
                                        className={workspaceGhostButtonClass}
                                        disabled={user.status === 'disabled'}
                                        onClick={() => void handleUpdateUserStatus(user.id, 'disabled')}
                                      >
                                        Disable
                                      </button>
                                      <button
                                        type="button"
                                        className={workspaceGhostButtonClass}
                                        disabled={user.status === 'active'}
                                        onClick={() => void handleUpdateUserStatus(user.id, 'active')}
                                      >
                                        Activate
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {isExpanded ? (
                                  <tr>
                                    <td colSpan={5} className="px-3 pb-3">
                                      <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-3">
                                        <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Booking history</p>
                                        {summary.history.length === 0 ? (
                                          <p className={`mt-2 text-sm ${workspaceMutedTextClass}`}>No booking history found.</p>
                                        ) : (
                                          <div className="mt-2 space-y-2">
                                            {summary.history.slice(0, 8).map((booking) => (
                                              <div key={`${user.id}-${booking.id}`} className="rounded-lg border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-2 text-xs">
                                                <p className={`${workspaceHeadingTextClass}`}>
                                                  {dataMaskingEnabled ? maskIdentifier(booking.id) : booking.id} · {booking.department}
                                                </p>
                                                <p className={workspaceMutedTextClass}>
                                                  Requested: {formatDateTime(booking.requestedTime)}
                                                </p>
                                                <p className={workspaceMutedTextClass}>Status: {booking.status}</p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ) : null}
                              </Fragment>
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
                    Staff profile visibility with current and future booking workload.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={workspaceGhostButtonClass}
                      onClick={() => setStaffApplicationRoleFilter('all')}
                    >
                      All new applications ({pendingStaffApplications.length})
                    </button>
                    <button
                      type="button"
                      className={workspaceGhostButtonClass}
                      onClick={() => setStaffApplicationRoleFilter('doctor')}
                    >
                      New doctor applications (
                      {pendingStaffApplications.filter((item) => item.role === 'doctor').length})
                    </button>
                  </div>

                  <div className="mt-4 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-4">
                    <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>
                      Staff applications pending review
                    </p>
                    {filteredPendingStaffApplications.length === 0 ? (
                      <p className={`mt-2 text-sm ${workspaceMutedTextClass}`}>
                        No pending applications for this filter.
                      </p>
                    ) : (
                      <div className="mt-3 overflow-x-auto">
                        <table className="min-w-full divide-y divide-[color:var(--card-border)] text-sm">
                          <thead>
                            <tr>
                              <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Applicant</th>
                              <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Details</th>
                              <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>License</th>
                              <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[color:var(--card-border)]">
                            {filteredPendingStaffApplications.map((application) => {
                              const fullName = `${application.firstName} ${application.lastName}`.trim()
                              return (
                                <tr key={application.id}>
                                  <td className="px-3 py-3 align-top">
                                    <p className={`font-semibold ${workspaceHeadingTextClass}`}>
                                      {dataMaskingEnabled ? maskPersonName(fullName) : fullName}
                                    </p>
                                    <p className={`text-xs ${workspaceMutedTextClass}`}>
                                      {dataMaskingEnabled ? maskIdentifier(application.email) : application.email}
                                    </p>
                                  </td>
                                  <td className={`px-3 py-3 ${workspaceMutedTextClass}`}>
                                    <p>Role: {formatRoleLabel(application.role)}</p>
                                    <p>Department: {application.department || 'N/A'}</p>
                                    <p>Status: Pending review</p>
                                  </td>
                                  <td className={`px-3 py-3 ${workspaceMutedTextClass}`}>
                                    {application.hasLicenseFile ? 'Uploaded' : 'Missing'}
                                  </td>
                                  <td className="px-3 py-3">
                                    <button
                                      type="button"
                                      className={workspaceGhostButtonClass}
                                      onClick={() => setSelectedStaffApplication(application)}
                                    >
                                      Open review window
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {filteredStaff.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-4">
                      <p className={`text-sm ${workspaceMutedTextClass}`}>No staff records match your search query.</p>
                    </div>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full divide-y divide-[color:var(--card-border)] text-sm">
                        <thead>
                          <tr>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Staff member</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Profile</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Bookings</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Account</th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[color:var(--card-border)]">
                          {filteredStaff.map(({ user, fullName, summary }) => {
                            const displayName = dataMaskingEnabled ? maskPersonName(fullName) : fullName
                            const displayEmail = dataMaskingEnabled ? maskIdentifier(user.email) : user.email
                            const isExpanded = expandedStaffId === user.id

                            return (
                              <Fragment key={user.id}>
                                <tr key={user.id}>
                                  <td className="px-3 py-3 align-top">
                                    <p className={`font-semibold ${workspaceHeadingTextClass}`}>{displayName}</p>
                                    <p className={`text-xs ${workspaceMutedTextClass}`}>{displayEmail}</p>
                                  </td>
                                  <td className={`px-3 py-3 ${workspaceMutedTextClass}`}>
                                    <p>Role: {formatRoleLabel(user.role)}</p>
                                    <p>Department: {user.department ?? 'N/A'}</p>
                                    <p>Phone: {user.profile?.phoneNumber ?? 'N/A'}</p>
                                  </td>
                                  <td className={`px-3 py-3 ${workspaceMutedTextClass}`}>
                                    <p className={workspaceHeadingTextClass}>Total: {summary.total}</p>
                                    <p>Current: {summary.current}</p>
                                    <p>Future: {summary.future}</p>
                                    <span className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusChipClass(summary.latestStatus)}`}>
                                      {summary.latestStatus}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3">
                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${accountChipClass(user.status)}`}>
                                      {user.status}
                                    </span>
                                  </td>
                                  <td className="px-3 py-3">
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        className={workspaceGhostButtonClass}
                                        onClick={() => setExpandedStaffId(isExpanded ? null : user.id)}
                                      >
                                        {isExpanded ? 'Hide bookings' : 'View bookings'}
                                      </button>
                                      <button
                                        type="button"
                                        className={workspaceGhostButtonClass}
                                        disabled={user.status === 'disabled'}
                                        onClick={() => void handleUpdateUserStatus(user.id, 'disabled')}
                                      >
                                        Disable
                                      </button>
                                      <button
                                        type="button"
                                        className={workspaceGhostButtonClass}
                                        disabled={user.status === 'active'}
                                        onClick={() => void handleUpdateUserStatus(user.id, 'active')}
                                      >
                                        Activate
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {isExpanded ? (
                                  <tr>
                                    <td colSpan={5} className="px-3 pb-3">
                                      <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-3">
                                        <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Current and future booking list</p>
                                        {summary.history.length === 0 ? (
                                          <p className={`mt-2 text-sm ${workspaceMutedTextClass}`}>No bookings assigned.</p>
                                        ) : (
                                          <div className="mt-2 space-y-2">
                                            {summary.history
                                              .filter((booking) => booking.status === 'Booked')
                                              .slice(0, 10)
                                              .map((booking) => (
                                                <div key={`${user.id}-${booking.id}`} className="rounded-lg border border-[color:var(--card-border)] bg-[color:var(--agent-surface)] p-2 text-xs">
                                                  <p className={`${workspaceHeadingTextClass}`}>
                                                    {dataMaskingEnabled ? maskIdentifier(booking.id) : booking.id} · {booking.department}
                                                  </p>
                                                  <p className={workspaceMutedTextClass}>Patient: {dataMaskingEnabled ? maskPersonName(booking.patientName) : booking.patientName}</p>
                                                  <p className={workspaceMutedTextClass}>Scheduled: {formatDateTime(booking.requestedTime)}</p>
                                                </div>
                                              ))}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ) : null}
                              </Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ) : null}

              {activeSection === 'audit_log' ? (
                <section className="space-y-3">
                  <article className={`${workspacePanelClass} p-5`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className={`text-sm ${workspaceMutedTextClass}`}>
                        Download an encrypted backup of audit logs.
                      </p>
                      <button
                        type="button"
                        className={workspaceGhostButtonClass}
                        onClick={() => void handleDownloadAuditBackup()}
                        disabled={isDownloadingAuditBackup}
                      >
                        {isDownloadingAuditBackup ? 'Downloading...' : 'Download Encrypted Backup'}
                      </button>
                    </div>
                  </article>
                  {filteredAuditLogs.length === 0 ? (
                    <article className={`${workspacePanelClass} p-5`}>
                      <p className={`text-sm ${workspaceMutedTextClass}`}>No audit log records match your search query.</p>
                    </article>
                  ) : (
                    filteredAuditLogs.map((item) => (
                      <article key={item.id} className={`${workspacePanelClass} p-5`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Audit</p>
                            <h2 className={`mt-1 text-base font-semibold ${workspaceHeadingTextClass}`}>{item.action}</h2>
                            <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>{item.details ?? 'No details'}</p>
                          </div>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${severityChipClass(item.action.includes('DENIED') ? 'Warning' : 'Info')}`}>
                            {item.action.includes('DENIED') ? 'Warning' : 'Info'}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[color:var(--agent-muted-soft)]">
                          <span>User: {item.userId ?? 'N/A'}</span>
                          <span>IP: {item.ipAddress ?? 'N/A'}</span>
                          <span>{formatDateTime(item.timestamp)}</span>
                        </div>
                      </article>
                    ))
                  )}
                </section>
              ) : null}

              {activeSection === 'error_log' ? (
                <section className="space-y-3">
                  <article className={`${workspacePanelClass} p-5`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className={`text-sm ${workspaceMutedTextClass}`}>
                        Download an encrypted backup of error logs.
                      </p>
                      <button
                        type="button"
                        className={workspaceGhostButtonClass}
                        onClick={() => void handleDownloadErrorBackup()}
                        disabled={isDownloadingErrorBackup}
                      >
                        {isDownloadingErrorBackup ? 'Downloading...' : 'Download Encrypted Backup'}
                      </button>
                    </div>
                  </article>
                  {filteredErrorLogs.length === 0 ? (
                    <article className={`${workspacePanelClass} p-5`}>
                      <p className={`text-sm ${workspaceMutedTextClass}`}>No error log records match your search query.</p>
                    </article>
                  ) : (
                    filteredErrorLogs.map((item) => (
                      <article key={item.id} className={`${workspacePanelClass} p-5`}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Error</p>
                            <h2 className={`mt-1 text-base font-semibold ${workspaceHeadingTextClass}`}>{item.message}</h2>
                            <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                              {(item.method ?? 'N/A').toUpperCase()} {item.route ?? 'N/A'}
                            </p>
                          </div>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${severityChipClass('Critical')}`}>
                            Critical
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[color:var(--agent-muted-soft)]">
                          <span>User: {item.userId ?? 'N/A'}</span>
                          <span>IP: {item.ipAddress ?? 'N/A'}</span>
                          <span>{formatDateTime(item.timestamp)}</span>
                        </div>
                        {item.stack ? (
                          <pre className="mt-3 overflow-x-auto rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-3 text-xs text-[color:var(--agent-muted)]">
                            {item.stack}
                          </pre>
                        ) : null}
                      </article>
                    ))
                  )}
                </section>
              ) : null}

              {activeSection === 'notifications' ? (
                <section className="space-y-3">
                  {filteredNotifications.length === 0 ? (
                    <article className={`${workspacePanelClass} p-5`}>
                      <p className={`text-sm ${workspaceMutedTextClass}`}>No notifications match your search query.</p>
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
                                <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" title="Unread" />
                              ) : null}
                              <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>{item.category}</p>
                            </div>
                            <h2 className={`mt-1 text-base font-semibold ${workspaceHeadingTextClass}`}>{item.title}</h2>
                            <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>{item.detail}</p>
                          </div>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${severityChipClass(item.severity)}`}>
                            {item.severity}
                          </span>
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
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" className={workspaceGhostButtonClass} onClick={onToggleTheme}>
                      Switch to {theme === 'dark' ? 'Light' : 'Dark'} theme
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

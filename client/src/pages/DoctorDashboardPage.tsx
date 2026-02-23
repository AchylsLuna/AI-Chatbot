import { useMemo, useState, useEffect, useRef } from 'react'
import ConfirmModal from '../components/ui/ConfirmModal'
import WorkspaceCanvas from '../components/layout/WorkspaceCanvas'
import Sidebar, { type SidebarItem } from '../components/layout/Sidebar'
import WorkspaceSidebarShell from '../components/layout/WorkspaceSidebarShell'
import WorkspaceTopShell from '../components/layout/WorkspaceTopShell'
import {
  workspaceFieldClass,
  workspaceGhostButtonClass,
  workspaceHeadingTextClass,
  workspaceMutedTextClass,
  workspacePanelClass,
  workspacePrimaryButtonClass,
  workspaceSubtleTextClass,
} from '../styles/workspaceUi'
import { buildRouteFromCanonicalPath, normalizePath } from '../config/routing'
import { getDoctorTabPath, resolveDoctorTabFromPath } from '../config/workspaceTabRoutes'
import { api } from '../services/api'
import type { AuthSession, Reservation } from '../types'
import { maskIdentifier, maskPersonName } from '../utils/privacy'
import { getWorkspaceRoleLabel } from '../utils/roles'

type DoctorDashboardPageProps = {
  authUser: AuthSession['user'] | null
  reservations: Reservation[]
  onLogout: () => void
  onPatchAuthUser?: (updates: Partial<AuthSession['user']>) => void
  sessionStatus: string
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  dataMaskingEnabled: boolean
  onToggleDataMasking: () => void
}

type DoctorSection = 'appointments' | 'queue' | 'analytics' | 'settings'

type AppointmentListItem = {
  id: string
  patientName: string
  department: string
  priority: Reservation['priority']
  requestedTime: string
  status: Reservation['status']
  symptoms: string
  flagged: boolean
}

const primaryItems: SidebarItem[] = [
  {
    key: 'appointments',
    label: 'Appointments',
    caption: 'Current appointment queue',
    icon: 'calendar',
  },
  {
    key: 'queue',
    label: 'Queue Management',
    caption: 'Patient queue and triage',
    icon: 'hospital',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    caption: 'Department and queue insights',
    icon: 'report',
  },
]

const FALLBACK_APPOINTMENTS: AppointmentListItem[] = [
  {
    id: 'APT-20260219-001',
    patientName: 'James Morgan',
    department: 'General Medicine',
    priority: 'High',
    requestedTime: '2026-02-19T09:30:00.000Z',
    status: 'Booked',
    symptoms: 'Acute chest pain, shortness of breath',
    flagged: true,
  },
  {
    id: 'APT-20260219-002',
    patientName: 'Sarah Chen',
    department: 'Cardiology',
    priority: 'Routine',
    requestedTime: '2026-02-19T10:15:00.000Z',
    status: 'Booked',
    symptoms: 'Follow-up consultation post-procedure',
    flagged: false,
  },
  {
    id: 'APT-20260219-003',
    patientName: 'Michael Torres',
    department: 'Orthopedics',
    priority: 'Low',
    requestedTime: '2026-02-19T11:00:00.000Z',
    status: 'Recorded',
    symptoms: 'Routine knee examination',
    flagged: false,
  },
  {
    id: 'APT-20260219-004',
    patientName: 'Emily Rodriguez',
    department: 'Neurology',
    priority: 'High',
    requestedTime: '2026-02-19T14:30:00.000Z',
    status: 'Booked',
    symptoms: 'Severe migraine with aura',
    flagged: true,
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

const formatTime = (value: string) => {
  const timestamp = parseDate(value)
  if (!timestamp) return 'Unknown'
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const priorityChipClass = (priority: Reservation['priority']) => {
  if (priority === 'High') return 'border-rose-300/70 bg-rose-100 text-rose-700'
  if (priority === 'Routine') return 'border-sky-300/70 bg-sky-100 text-sky-700'
  if (priority === 'Low') return 'border-slate-300/70 bg-slate-100 text-slate-700'
  return 'border-[color:var(--card-border)] bg-[color:var(--agent-surface)] text-[color:var(--agent-muted)]'
}

const statusChipClass = (status: Reservation['status']) => {
  if (status === 'Recorded') return 'border-emerald-300/70 bg-emerald-100 text-emerald-700'
  if (status === 'Failed') return 'border-rose-300/70 bg-rose-100 text-rose-700'
  if (status === 'Booked') return 'border-sky-300/70 bg-sky-100 text-sky-700'
  return 'border-[color:var(--card-border)] bg-[color:var(--agent-surface)] text-[color:var(--agent-muted)]'
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

  const username = user?.username?.trim()
  if (!username) return 'Doctor'

  const raw = username.includes('@') ? username.split('@')[0] : username
  const normalized = raw.replace(/[._-]+/g, ' ').trim()
  return normalized || 'Doctor'
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
  onToggleDataMasking,
}: DoctorDashboardPageProps) => {
  const [activeSection, setActiveSection] = useState<DoctorSection>(() => {
    if (typeof window === 'undefined') return 'appointments'
    return resolveDoctorTabFromPath(window.location.pathname) ?? 'appointments'
  })
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
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

  useEffect(() => {
    const nextName = buildDoctorDisplayName(authUser)
    setProfileName(nextName)
    setProfileNameDraft(nextName)
  }, [authUser?.firstName, authUser?.lastName, authUser?.username])

  // Auto-logout after 15 minutes of inactivity (900000 ms)
  const INACTIVITY_MS = 15 * 60 * 1000
  const timerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)

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
      setActiveSection(resolveDoctorTabFromPath(window.location.pathname) ?? 'appointments')
      setSelectedAppointment(null)
      setShowAppointmentDetail(false)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const appointmentItems = useMemo<AppointmentListItem[]>(() => {
    const orderedReservations = [...reservations].sort(
      (a, b) => parseDate(a.requestedTime) - parseDate(b.requestedTime)
    )

    if (!orderedReservations.length) {
      return FALLBACK_APPOINTMENTS
    }

    return orderedReservations.map((reservation) => ({
      id: reservation.id,
      patientName: reservation.patientName,
      department: reservation.department,
      priority: reservation.priority,
      requestedTime: reservation.requestedTime,
      status: reservation.status,
      symptoms: reservation.symptoms,
      flagged: reservation.status === 'Failed' || reservation.priority === 'High',
    }))
  }, [reservations])

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredAppointments = useMemo(() => {
    if (!normalizedQuery) return appointmentItems
    return appointmentItems.filter((item) => {
      return (
        item.patientName.toLowerCase().includes(normalizedQuery) ||
        item.id.toLowerCase().includes(normalizedQuery) ||
        item.department.toLowerCase().includes(normalizedQuery) ||
        item.symptoms.toLowerCase().includes(normalizedQuery) ||
        item.priority.toLowerCase().includes(normalizedQuery)
      )
    })
  }, [normalizedQuery, appointmentItems])

  const queueItems = useMemo(() => {
    if (!normalizedQuery) return appointmentItems
    return appointmentItems.filter((item) => {
      return (
        item.status !== 'Recorded' &&
        (item.patientName.toLowerCase().includes(normalizedQuery) ||
          item.id.toLowerCase().includes(normalizedQuery) ||
          item.department.toLowerCase().includes(normalizedQuery))
      )
    })
  }, [normalizedQuery, appointmentItems])

  const appointmentMetrics = useMemo(() => {
    const total = appointmentItems.length
    const booked = appointmentItems.filter((item) => item.status === 'Booked').length
    const recorded = appointmentItems.filter((item) => item.status === 'Recorded').length
    const highPriority = appointmentItems.filter((item) => item.priority === 'High').length

    return [
      { key: 'apt-total', label: 'Total appointments', value: total, caption: `${filteredAppointments.length} matching` },
      { key: 'apt-booked', label: 'Booked', value: booked, caption: 'Pending review' },
      { key: 'apt-recorded', label: 'Recorded', value: recorded, caption: 'Completed' },
      { key: 'apt-priority', label: 'High priority', value: highPriority, caption: 'Requires attention' },
    ]
  }, [appointmentItems, filteredAppointments.length])

  const queueMetrics = useMemo(() => {
    const pending = queueItems.filter((item) => item.status === 'Booked').length
    const departments = new Set(queueItems.map((item) => item.department)).size
    const avgPriority = queueItems.filter((item) => item.priority === 'High').length

    return [
      { key: 'queue-pending', label: 'Pending', value: pending, caption: 'Awaiting review' },
      { key: 'queue-depts', label: 'Departments', value: departments, caption: 'Active departments' },
      { key: 'queue-high', label: 'High priority', value: avgPriority, caption: 'In queue' },
      { key: 'queue-total', label: 'Total queue', value: queueItems.length, caption: `${queueItems.length} patients` },
    ]
  }, [queueItems])

  const analyticsMetrics = useMemo(() => {
    const byDept = new Map<string, number>()
    appointmentItems.forEach((item) => {
      byDept.set(item.department, (byDept.get(item.department) || 0) + 1)
    })

    const topDept = Array.from(byDept.entries()).sort(([, a], [, b]) => b - a)[0]
    const topDeptCount = topDept ? topDept[1] : 0

    const completionRate =
      appointmentItems.length > 0
        ? Math.round((appointmentItems.filter((i) => i.status === 'Recorded').length / appointmentItems.length) * 100)
        : 0

    return [
      { key: 'analytics-depts', label: 'Total departments', value: byDept.size, caption: 'Active departments' },
      { key: 'analytics-top', label: 'Top department', value: topDeptCount, caption: topDept?.[0] || 'N/A' },
      { key: 'analytics-completion', label: 'Completion rate', value: `${completionRate}%`, caption: 'Recorded vs total' },
      { key: 'analytics-efficiency', label: 'Processing', value: appointmentItems.length, caption: 'Total processed' },
    ]
  }, [appointmentItems])

  const settingsMetrics = useMemo(
    () => [
      { key: 'settings-name', label: 'Name', value: profileName, caption: 'Profile display name' },
      { key: 'settings-account', label: 'Account', value: authUser?.username ?? 'Unknown', caption: 'Signed in user' },
      { key: 'settings-role', label: 'Role', value: getWorkspaceRoleLabel(authUser?.role), caption: 'Workspace role' },
      { key: 'settings-theme', label: 'Theme', value: theme === 'dark' ? 'Dark' : 'Light', caption: 'Current theme' },
    ],
    [authUser?.role, authUser?.username, profileName, theme]
  )

  const sectionMeta = {
    appointments: {
      title: 'Appointments',
      description: 'View and manage the complete appointment queue with patient details and triage information.',
      searchPlaceholder: 'Search by patient name, ID, department, symptoms, or priority',
      metrics: appointmentMetrics,
    },
    queue: {
      title: 'Queue Management',
      description: 'Manage active patient queue pending review and status updates.',
      searchPlaceholder: 'Search by patient name, ID, or department',
      metrics: queueMetrics,
    },
    analytics: {
      title: 'Analytics',
      description: 'View appointment trends, department load, and operational metrics.',
      searchPlaceholder: 'Filter analytics by department or status',
      metrics: analyticsMetrics,
    },
    settings: {
      title: 'Account Settings',
      description: 'Manage profile name, password security, and doctor workspace preferences.',
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
          mobileTitle="Doctor workspace"
          stickyOffsetMode="auto"
          sidebar={
            <Sidebar
              variant="dashboard"
              mobileMode="drawer"
              fullRail
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() => setIsSidebarCollapsed((previous) => !previous)}
              brandTitle="AI Health Care"
              brandSubtitle="Doctor workspace"
              sectionLabel="Primary"
              items={primaryItems}
              activeKey={activeSection}
              onSelect={(key) => {
                if (key === 'appointments' || key === 'queue' || key === 'analytics') {
                  setSection(key)
                }
              }}
              footerProfile={{
                name: profileName,
                subtitle: authUser?.username ?? 'Doctor workspace',
                onClick: () => setSection('settings'),
              }}
            />
          }
          content={
            <section className="space-y-6">
              <WorkspaceTopShell
                eyebrow="Doctor session"
                title={activeMeta.title}
                description={activeMeta.description}
                searchValue={searchQuery}
                searchPlaceholder={activeMeta.searchPlaceholder}
                onSearchChange={setSearchQuery}
                showSearch={activeSection !== 'settings'}
                showAccountMenu={activeSection !== 'settings'}
                profileName={profileName}
                profileCaption={`${getWorkspaceRoleLabel(authUser?.role)} workspace`}
                showNotifications
                notificationCount={Math.min(queueItems.length, 99)}
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

              {/* APPOINTMENTS VIEW */}
              {activeSection === 'appointments' ? (
                <section className={`${workspacePanelClass} p-5`}>
                  <h2 className={`text-lg font-semibold ${workspaceHeadingTextClass}`}>Appointment list</h2>
                  <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                    Complete queue of patient appointments with priority flags and triage data.
                  </p>

                  {filteredAppointments.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-4">
                      <p className={`text-sm ${workspaceMutedTextClass}`}>
                        No appointments match your search query.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {filteredAppointments.map((apt) => {
                        const displayName = dataMaskingEnabled ? maskPersonName(apt.patientName) : apt.patientName
                        const displayId = dataMaskingEnabled ? maskIdentifier(apt.id) : apt.id

                        return (
                          <div
                            key={apt.id}
                            className={`${workspacePanelClass} cursor-pointer p-4 transition-all hover:shadow-md`}
                            onClick={() => {
                              setSelectedAppointment(apt)
                              setShowAppointmentDetail(true)
                            }}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <p className={`font-semibold ${workspaceHeadingTextClass}`}>{displayName}</p>
                                  {apt.flagged && (
                                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" title="Flagged" />
                                  )}
                                </div>
                                <p className={`text-xs ${workspaceMutedTextClass}`}>{displayId}</p>
                                <p className={`mt-2 text-sm ${workspaceMutedTextClass}`}>{apt.symptoms}</p>
                              </div>
                              <div className="flex flex-col gap-2">
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityChipClass(apt.priority)}`}>
                                  {apt.priority}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                              <span className={workspaceMutedTextClass}>{apt.department}</span>
                              <span className={workspaceMutedTextClass}>{formatTime(apt.requestedTime)}</span>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 font-semibold ${statusChipClass(apt.status)}`}>
                                {apt.status}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              ) : null}

              {/* QUEUE MANAGEMENT VIEW */}
              {activeSection === 'queue' ? (
                <section className={`${workspacePanelClass} p-5`}>
                  <h2 className={`text-lg font-semibold ${workspaceHeadingTextClass}`}>Patient queue</h2>
                  <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                    Active queue of pending patients awaiting doctor review and status updates.
                  </p>

                  {queueItems.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-4">
                      <p className={`text-sm ${workspaceMutedTextClass}`}>
                        No pending patients in the queue.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full divide-y divide-[color:var(--card-border)] text-sm">
                        <thead>
                          <tr>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>
                              Patient
                            </th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>
                              Department
                            </th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>
                              Time
                            </th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>
                              Priority
                            </th>
                            <th className={`px-3 py-2 text-left text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[color:var(--card-border)]">
                          {queueItems.map((item) => {
                            const displayName = dataMaskingEnabled ? maskPersonName(item.patientName) : item.patientName

                            return (
                              <tr key={item.id}>
                                <td className="px-3 py-3">
                                  <p className={`font-semibold ${workspaceHeadingTextClass}`}>{displayName}</p>
                                </td>
                                <td className={`px-3 py-3 ${workspaceMutedTextClass}`}>{item.department}</td>
                                <td className={`px-3 py-3 ${workspaceMutedTextClass}`}>{formatTime(item.requestedTime)}</td>
                                <td className="px-3 py-3">
                                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityChipClass(item.priority)}`}>
                                    {item.priority}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  <button
                                    type="button"
                                    className={`${workspacePrimaryButtonClass} text-xs`}
                                    onClick={() => {
                                      setSelectedAppointment(item)
                                      setShowAppointmentDetail(true)
                                    }}
                                  >
                                    View
                                  </button>
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

              {/* ANALYTICS VIEW */}
              {activeSection === 'analytics' ? (
                <section className="space-y-4">
                  <div className={`${workspacePanelClass} p-5`}>
                    <h2 className={`text-lg font-semibold ${workspaceHeadingTextClass}`}>Department breakdown</h2>
                    <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                      Appointment distribution across departments.
                    </p>

                    <div className="mt-4 space-y-2">
                      {Array.from(
                        new Map(
                          appointmentItems.map((item) => [
                            item.department,
                            appointmentItems.filter((i) => i.department === item.department).length,
                          ])
                        ).entries()
                      ).map(([dept, count]) => (
                        <div key={dept} className="flex items-center justify-between">
                          <span className={`text-sm ${workspaceHeadingTextClass}`}>{dept}</span>
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-32 overflow-hidden rounded-full bg-[color:var(--agent-surface)]">
                              <div
                                className="h-full bg-blue-500"
                                style={{
                                  width: `${(count / appointmentItems.length) * 100}%`,
                                }}
                              />
                            </div>
                            <span className={`w-8 text-right text-sm font-semibold ${workspaceHeadingTextClass}`}>{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className={`${workspacePanelClass} p-5`}>
                    <h2 className={`text-lg font-semibold ${workspaceHeadingTextClass}`}>Status distribution</h2>
                    <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                      Current appointment status breakdown.
                    </p>

                    <div className="mt-4 space-y-2">
                      {[
                        {
                          label: 'Booked',
                          count: appointmentItems.filter((i) => i.status === 'Booked').length,
                          color: 'bg-sky-500',
                        },
                        {
                          label: 'Recorded',
                          count: appointmentItems.filter((i) => i.status === 'Recorded').length,
                          color: 'bg-emerald-500',
                        },
                        {
                          label: 'Failed',
                          count: appointmentItems.filter((i) => i.status === 'Failed').length,
                          color: 'bg-rose-500',
                        },
                      ].map(({ label, count, color }) => (
                        <div key={label} className="flex items-center justify-between">
                          <span className={`text-sm ${workspaceHeadingTextClass}`}>{label}</span>
                          <div className="flex items-center gap-3">
                            <div className="h-2 w-32 overflow-hidden rounded-full bg-[color:var(--agent-surface)]">
                              <div
                                className={color}
                                style={{
                                  width: `${appointmentItems.length > 0 ? (count / appointmentItems.length) * 100 : 0}%`,
                                }}
                              />
                            </div>
                            <span className={`w-8 text-right text-sm font-semibold ${workspaceHeadingTextClass}`}>{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}

              {activeSection === 'settings' ? (
                <section className="space-y-4">
                  <section className={`${workspacePanelClass} p-5`}>
                    <h2 className={`text-lg font-semibold ${workspaceHeadingTextClass}`}>Profile details</h2>
                    <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                      Update your display name for this workspace.
                    </p>

                    <form
                      className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
                      onSubmit={(event) => {
                        event.preventDefault()
                        void handleSaveProfileName()
                      }}
                    >
                      <div className="reference-card-soft p-4">
                        <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Account</p>
                        <p className={`mt-1 text-sm font-semibold ${workspaceHeadingTextClass}`}>
                          {authUser?.username ?? 'Unknown'}
                        </p>
                        <p className={`mt-3 text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Role</p>
                        <p className={`mt-1 text-sm font-semibold ${workspaceHeadingTextClass}`}>
                          {getWorkspaceRoleLabel(authUser?.role)}
                        </p>
                      </div>

                      <div className="reference-card-soft p-4">
                        <label
                          htmlFor="doctor-profile-name"
                          className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}
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
                          className={`mt-2 ${workspaceFieldClass}`}
                        />
                        {profileError ? (
                          <p className="mt-3 text-xs font-semibold text-rose-500">{profileError}</p>
                        ) : null}
                        {profileMessage ? (
                          <p className="mt-3 text-xs font-semibold text-emerald-600">{profileMessage}</p>
                        ) : null}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="submit"
                            className={workspacePrimaryButtonClass}
                            disabled={isSavingProfile}
                          >
                            {isSavingProfile ? 'Saving...' : 'Save name'}
                          </button>
                          <button
                            type="button"
                            className={workspaceGhostButtonClass}
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
                  </section>

                  <section className={`${workspacePanelClass} p-5`}>
                    <h2 className={`text-lg font-semibold ${workspaceHeadingTextClass}`}>Change password</h2>
                    <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                      Use a strong password to keep your workspace secure.
                    </p>

                    <form
                      className="mt-4 grid gap-3 md:grid-cols-3"
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
                        className={workspaceFieldClass}
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
                        className={workspaceFieldClass}
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
                        className={workspaceFieldClass}
                      />
                    </form>

                    {passwordError ? (
                      <p className="mt-3 text-xs font-semibold text-rose-500">{passwordError}</p>
                    ) : null}
                    {passwordMessage ? (
                      <p className="mt-3 text-xs font-semibold text-emerald-600">{passwordMessage}</p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        className={workspacePrimaryButtonClass}
                        onClick={() => {
                          void handleSavePassword()
                        }}
                        disabled={isSavingPassword}
                      >
                        {isSavingPassword ? 'Updating...' : 'Update password'}
                      </button>
                      <p className={`text-xs ${workspaceSubtleTextClass}`}>
                        Minimum 8 characters with uppercase, lowercase, number, and symbol.
                      </p>
                    </div>
                  </section>

                  <section className={`${workspacePanelClass} p-5`}>
                    <h2 className={`text-lg font-semibold ${workspaceHeadingTextClass}`}>
                      Workspace preferences
                    </h2>
                    <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>
                      Configure your session view and privacy controls.
                    </p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="reference-card-soft p-3">
                        <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Theme</p>
                        <p className={`mt-1 text-sm font-semibold ${workspaceHeadingTextClass}`}>
                          {theme === 'dark' ? 'Dark' : 'Light'}
                        </p>
                      </div>
                      <div className="reference-card-soft p-3">
                        <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>
                          Data masking
                        </p>
                        <p className={`mt-1 text-sm font-semibold ${workspaceHeadingTextClass}`}>
                          {dataMaskingEnabled ? 'On' : 'Off'}
                        </p>
                      </div>
                      <div className="reference-card-soft p-3">
                        <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Session</p>
                        <p className={`mt-1 text-sm font-semibold ${workspaceHeadingTextClass}`}>{sessionStatus}</p>
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
                  </section>
                </section>
              ) : null}
            </section>
          }
        />
      </div>

      {/* APPOINTMENT DETAIL MODAL */}
      {selectedAppointment && showAppointmentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className={`${workspacePanelClass} max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Appointment detail</p>
                <h2 className={`mt-1 text-2xl font-semibold ${workspaceHeadingTextClass}`}>
                  {dataMaskingEnabled ? maskPersonName(selectedAppointment.patientName) : selectedAppointment.patientName}
                </h2>
              </div>
              <button
                type="button"
                className={workspaceGhostButtonClass}
                onClick={() => setShowAppointmentDetail(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Appointment ID</p>
                <p className={`mt-1 font-semibold ${workspaceHeadingTextClass}`}>
                  {dataMaskingEnabled ? maskIdentifier(selectedAppointment.id) : selectedAppointment.id}
                </p>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Status</p>
                <p className="mt-1">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusChipClass(selectedAppointment.status)}`}>
                    {selectedAppointment.status}
                  </span>
                </p>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Priority</p>
                <p className="mt-1">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priorityChipClass(selectedAppointment.priority)}`}>
                    {selectedAppointment.priority}
                  </span>
                </p>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Department</p>
                <p className={`mt-1 font-semibold ${workspaceHeadingTextClass}`}>{selectedAppointment.department}</p>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Requested time</p>
                <p className={`mt-1 font-semibold ${workspaceHeadingTextClass}`}>{formatDateTime(selectedAppointment.requestedTime)}</p>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Flagged</p>
                <p className={`mt-1 font-semibold ${workspaceHeadingTextClass}`}>{selectedAppointment.flagged ? 'Yes' : 'No'}</p>
              </div>
            </div>

            <div className="mt-6">
              <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>Symptoms & Chief complaint</p>
              <p className={`mt-2 ${workspaceMutedTextClass}`}>{selectedAppointment.symptoms}</p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className={workspacePrimaryButtonClass}
                onClick={() => setShowAppointmentDetail(false)}
              >
                Mark as reviewed
              </button>
              <button
                type="button"
                className={workspaceGhostButtonClass}
                onClick={() => setShowAppointmentDetail(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </WorkspaceCanvas>
  )
}

export default DoctorDashboardPage

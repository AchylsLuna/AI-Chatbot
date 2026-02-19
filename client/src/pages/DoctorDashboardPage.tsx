import { useMemo, useState, useEffect, useRef } from 'react'
import ConfirmModal from '../components/ui/ConfirmModal'
import WorkspaceCanvas from '../components/layout/WorkspaceCanvas'
import Sidebar, { type SidebarItem } from '../components/layout/Sidebar'
import SidebarAccountCard from '../components/layout/SidebarAccountCard'
import WorkspaceTopShell from '../components/layout/WorkspaceTopShell'
import {
  workspaceGhostButtonClass,
  workspaceHeadingTextClass,
  workspaceMutedTextClass,
  workspacePanelClass,
  workspacePrimaryButtonClass,
  workspaceSubtleTextClass,
} from '../styles/workspaceUi'
import type { AppPage } from '../types/navigation'
import type { AuthSession, Reservation } from '../types'
import { maskIdentifier, maskPersonName } from '../utils/privacy'
import { getWorkspaceRoleLabel } from '../utils/roles'

type DoctorDashboardPageProps = {
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

type DoctorSection = 'appointments' | 'queue' | 'analytics'

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

const utilityItems: SidebarItem[] = [
  {
    key: 'admin_dashboard',
    label: 'Admin workspace',
    caption: 'Staff and system management',
    icon: 'shield',
  },
  {
    key: 'landing',
    label: 'Landing',
    caption: 'Public overview page',
    icon: 'home',
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

const DoctorDashboardPage = ({
  authUser,
  reservations,
  onNavigate,
  onLogout,
  sessionStatus,
  theme,
  onToggleTheme,
  dataMaskingEnabled,
  onToggleDataMasking,
}: DoctorDashboardPageProps) => {
  const [activeSection, setActiveSection] = useState<DoctorSection>('appointments')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentListItem | null>(null)
  const [showAppointmentDetail, setShowAppointmentDetail] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  // Auto-logout after 15 minutes of inactivity (900000 ms)
  const INACTIVITY_MS = 15 * 60 * 1000
  const timerRef = useRef<number | null>(null)

  const resetInactivityTimer = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    // @ts-ignore - window.setTimeout returns number in browser
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
  } as const

  const activeMeta = sectionMeta[activeSection]

  return (
    <WorkspaceCanvas>
      <div className="mx-auto w-full max-w-[1500px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <div className="grid items-start gap-6 xl:grid-cols-[17.75rem_minmax(0,1fr)]">
          <Sidebar
            variant="dashboard"
            className="xl:self-start"
            heightMode="viewport"
            stickyOffset="header"
            brandTitle="AI Health Care"
            brandSubtitle="Doctor workspace"
            onBrandClick={() => onNavigate?.('landing')}
            sectionLabel="Primary"
            items={primaryItems}
            activeKey={activeSection}
            onSelect={(key) => {
              if (key === 'appointments' || key === 'queue' || key === 'analytics') {
                setActiveSection(key)
                setSelectedAppointment(null)
                setShowAppointmentDetail(false)
              }
            }}
            auxiliaryLabel="Utilities"
            secondaryItems={utilityItems}
            supportItem={{ key: 'logout', label: 'Logout', icon: 'shield' }}
            onSelectAuxiliary={(key) => {
              if (key === 'logout') {
                confirmAndLogout()
                return
              }
              if (key === 'admin_dashboard' && authUser?.role !== 'user') {
                onNavigate?.('admin')
                return
              }
              if (key === 'landing') {
                onNavigate?.('landing')
              }
            }}
            profileExtra={
              <div className="space-y-2.5">
                <SidebarAccountCard
                  username={authUser?.username ?? 'Unknown'}
                  roleLabel={`${getWorkspaceRoleLabel(authUser?.role)} workspace`}
                  sessionStatus={sessionStatus}
                  theme={theme}
                  onToggleTheme={onToggleTheme}
                  dataMaskingEnabled={dataMaskingEnabled}
                  onToggleDataMasking={onToggleDataMasking}
                />
                <button type="button" className={`${workspaceGhostButtonClass} w-full`} onClick={confirmAndLogout}>
                  Logout
                </button>
              </div>
            }
          />

          <section className="space-y-6">
            <WorkspaceTopShell
              eyebrow="Doctor session"
              title={activeMeta.title}
              description={activeMeta.description}
              searchValue={searchQuery}
              searchPlaceholder={activeMeta.searchPlaceholder}
              onSearchChange={setSearchQuery}
              quickActions={
                <>
                  {authUser?.role !== 'user' && (
                    <button
                      type="button"
                      className={workspacePrimaryButtonClass}
                      onClick={() => onNavigate?.('admin')}
                    >
                      Admin workspace
                    </button>
                  )}
                  <button type="button" className={workspaceGhostButtonClass} onClick={confirmAndLogout}>
                    Logout
                  </button>
                </>
              }
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
          </section>
        </div>
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

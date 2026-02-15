import { useMemo, useState } from 'react'
import WorkspaceCanvas from '../components/layout/WorkspaceCanvas'
import WorkspaceSidebar from '../components/layout/WorkspaceSidebar'
import { api } from '../services/api'
import {
  workspaceGhostButtonClass,
  workspaceHeadingTextClass,
  workspaceMutedTextClass,
  workspacePanelClass,
  workspacePanelSoftClass,
  workspacePrimaryButtonClass,
  workspaceSubtleTextClass,
} from '../styles/workspaceUi'
import type { AppPage } from '../types/navigation'
import type { AppointmentUpdateDraft, AuthSession, Reservation } from '../types/triage'
import { canRevealIdentity, maskIdentifier, maskPersonName } from '../utils/privacy'
import { formatRoleLabel } from '../utils/roles'

type DoctorDashboardPageProps = {
  reservations: Reservation[]
  authUser: AuthSession['user'] | null
  onNavigate?: (page: AppPage) => void
  onLogout: () => void
  onUpdateReservation: (reservationId: string, updates: AppointmentUpdateDraft) => Promise<Reservation>
}

type SidebarSection = 'overview' | 'appointments' | 'analytics' | 'report'

const sidebarItems: Array<{
  key: SidebarSection
  label: string
  caption: string
  icon: 'home' | 'calendar' | 'chart' | 'report'
}> = [
  {
    key: 'overview',
    label: 'Overview',
    caption: 'Current dashboard status',
    icon: 'home',
  },
  {
    key: 'appointments',
    label: 'Appointments',
    caption: 'Review and update records',
    icon: 'calendar',
  },
  {
    key: 'analytics',
    label: 'Analytics',
    caption: 'Operational trends',
    icon: 'chart',
  },
  {
    key: 'report',
    label: 'Report',
    caption: 'Snapshot and summary',
    icon: 'report',
  },
]

const panelClass = workspacePanelClass
const panelSoftClass = workspacePanelSoftClass
const headingTextClass = workspaceHeadingTextClass
const mutedTextClass = workspaceMutedTextClass
const subtleTextClass = workspaceSubtleTextClass
const primaryButtonClass = workspacePrimaryButtonClass
const ghostButtonClass = workspaceGhostButtonClass

const DoctorDashboardPage = ({
  reservations,
  authUser,
  onNavigate,
  onLogout,
  onUpdateReservation,
}: DoctorDashboardPageProps) => {
  const [activeSection, setActiveSection] = useState<SidebarSection>('overview')
  const [showIdentity, setShowIdentity] = useState(false)
  const canOpenAdminDashboard = authUser?.role === 'admin' || authUser?.role === 'system_admin'
  const canReveal = canRevealIdentity(authUser?.role)

  const logIdentityAction = async (action: 'identity_reveal' | 'identity_hide') => {
    try {
      await api.logAiAlertAction('doctor-dashboard-identity', action, 'doctor_dashboard')
    } catch (error) {
      console.warn('Unable to record identity reveal audit action', error)
    }
  }

  const metrics = useMemo(() => {
    const booked = reservations.filter((item) => item.status === 'Booked').length
    const recorded = reservations.filter((item) => item.status === 'Recorded').length
    const failed = reservations.filter((item) => item.status === 'Failed').length
    return { total: reservations.length, booked, recorded, failed }
  }, [reservations])

  const latest = useMemo(
    () =>
      [...reservations]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 8),
    [reservations]
  )

  const completionRate = metrics.total === 0 ? 0 : Math.round((metrics.recorded / metrics.total) * 100)
  const averageConfidence = metrics.total
    ? Math.round(
        (reservations.reduce((total, reservation) => total + reservation.confidence, 0) /
          metrics.total) *
          100
      )
    : 0

  const departmentDistribution = useMemo(() => {
    const map = new Map<string, number>()
    reservations.forEach((reservation) => {
      map.set(reservation.department, (map.get(reservation.department) || 0) + 1)
    })

    return Array.from(map.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 5)
  }, [reservations])

  const markRecorded = async (reservationId: string) => {
    await onUpdateReservation(reservationId, { status: 'Recorded' })
  }

  const renderAppointmentRows = () => {
    if (latest.length === 0) {
      return (
        <p className={`mt-3 text-sm ${mutedTextClass}`}>
          No appointments available. Start from triage.
        </p>
      )
    }

    return (
      <div className="mt-4 space-y-3">
        {latest.map((appointment) => (
          <div
            key={appointment.id}
            className={`flex flex-wrap items-center justify-between gap-3 ${panelSoftClass} p-4`}
          >
            <div>
              <p className={`text-sm font-semibold ${headingTextClass}`}>
                {showIdentity ? appointment.patientName : maskPersonName(appointment.patientName)}
              </p>
              <p className={`text-xs ${mutedTextClass}`}>
                {showIdentity ? appointment.id : maskIdentifier(appointment.id)} |{' '}
                {appointment.department} | {appointment.requestedTime} | {appointment.status}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onNavigate?.('appointments')}
                className={ghostButtonClass}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => markRecorded(appointment.id)}
                className={primaryButtonClass}
              >
                Mark recorded
              </button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <WorkspaceCanvas>
      <div className="mx-auto w-full px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className={`${panelClass} relative overflow-hidden p-6 sm:p-7`}>
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] bg-[radial-gradient(circle_at_top,rgba(71,212,200,0.2),transparent_68%)] lg:block" />
          <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className={`text-xs uppercase tracking-[0.2em] ${subtleTextClass}`}>
                Admin and nurse operations
              </p>
              <h1 className={`mt-3 text-3xl font-semibold tracking-tight sm:text-4xl ${headingTextClass}`}>
                Doctor&apos;s Dashboard
              </h1>
              <p className={`mt-3 max-w-3xl text-sm sm:text-base ${mutedTextClass}`}>
                Clinical workspace for appointment operations, analytics, and reporting.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {canOpenAdminDashboard && (
                  <button
                    className={ghostButtonClass}
                    onClick={() => onNavigate?.('admin')}
                    type="button"
                  >
                    Admin dashboard
                  </button>
                )}
                <button className={primaryButtonClass} onClick={onLogout} type="button">
                  Logout
                </button>
                {canReveal && (
                  <button
                    className={ghostButtonClass}
                    onClick={() => {
                      const next = !showIdentity
                      setShowIdentity(next)
                      void logIdentityAction(next ? 'identity_reveal' : 'identity_hide')
                    }}
                    type="button"
                  >
                    {showIdentity ? 'Hide identity' : 'View identity'}
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Total', value: metrics.total },
                { label: 'Booked', value: metrics.booked },
                { label: 'Recorded', value: metrics.recorded },
                { label: 'Failed', value: metrics.failed },
              ].map((card) => (
                <div key={card.label} className={`${panelSoftClass} p-4`}>
                  <p className={`text-xs uppercase tracking-[0.14em] ${subtleTextClass}`}>{card.label}</p>
                  <p className={`mt-2 text-2xl font-semibold ${headingTextClass}`}>{card.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <WorkspaceSidebar
            className="h-fit p-0 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:rounded-l-none lg:border-l-0 lg:-ml-8 lg:w-[calc(17rem+2rem)]"
            brandTitle="AI Health Care"
            brandSubtitle="Doctor workspace"
            sectionLabel="Doctor navigation"
            items={sidebarItems}
            activeKey={activeSection}
            onSelect={(key) => setActiveSection(key as SidebarSection)}
            statusLabel="Compliance"
            statusValue="HIPAA/GDPR Active"
            profileLabel="Signed in"
            profileValue={authUser?.username ?? 'Unknown'}
            profileCaption={formatRoleLabel(authUser?.role)}
          />

          <section className="space-y-6">
            {activeSection === 'overview' && (
              <>
                <div className={`${panelClass} p-6`}>
                  <h2 className={`text-xl font-semibold ${headingTextClass}`}>Overview summary</h2>
                  <p className={`mt-2 text-sm ${mutedTextClass}`}>
                    Completion rate is <span className={`font-semibold ${headingTextClass}`}>{completionRate}%</span>{' '}
                    with <span className={`font-semibold ${headingTextClass}`}>{averageConfidence}%</span>{' '}
                    average triage confidence.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveSection('appointments')}
                      className={primaryButtonClass}
                    >
                      Go to appointments
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('analytics')}
                      className={ghostButtonClass}
                    >
                      View analytics
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className={`${panelClass} p-4`}>
                    <p className={`text-xs uppercase tracking-[0.16em] ${subtleTextClass}`}>Completion rate</p>
                    <p className={`mt-2 text-2xl font-semibold ${headingTextClass}`}>{completionRate}%</p>
                  </div>
                  <div className={`${panelClass} p-4`}>
                    <p className={`text-xs uppercase tracking-[0.16em] ${subtleTextClass}`}>Avg confidence</p>
                    <p className={`mt-2 text-2xl font-semibold ${headingTextClass}`}>{averageConfidence}%</p>
                  </div>
                  <div className={`${panelClass} p-4`}>
                    <p className={`text-xs uppercase tracking-[0.16em] ${subtleTextClass}`}>Open queue</p>
                    <p className={`mt-2 text-2xl font-semibold ${headingTextClass}`}>{metrics.booked}</p>
                  </div>
                </div>
              </>
            )}

            {activeSection === 'appointments' && (
              <div className={`${panelClass} p-6`}>
                <h2 className={`text-xl font-semibold ${headingTextClass}`}>Recent appointments</h2>
                <p className={`mt-2 text-sm ${mutedTextClass}`}>
                  Review status and update appointment records.
                </p>
                {renderAppointmentRows()}
              </div>
            )}

            {activeSection === 'analytics' && (
              <div className={`${panelClass} p-6`}>
                <h2 className={`text-xl font-semibold ${headingTextClass}`}>Department distribution</h2>
                {departmentDistribution.length === 0 ? (
                  <p className={`mt-3 text-sm ${mutedTextClass}`}>No appointment data available yet.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {departmentDistribution.map((item) => {
                      const width = Math.max(8, Math.min(100, Math.round((item.count / Math.max(1, metrics.total)) * 100)))
                      return (
                        <div key={item.department} className={`${panelSoftClass} p-4`}>
                          <div className="flex items-center justify-between gap-4">
                            <p className={`text-sm font-semibold ${headingTextClass}`}>{item.department}</p>
                            <p className={`text-xs ${mutedTextClass}`}>{item.count} appointments</p>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgba(11,20,40,0.8)]">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(135deg,#49d6c9,#41b8e6)]"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {activeSection === 'report' && (
              <div className={`${panelClass} p-6`}>
                <h2 className={`text-xl font-semibold ${headingTextClass}`}>Operations report</h2>
                <p className={`mt-2 text-sm ${mutedTextClass}`}>
                  Auto summary for handoff and daily review.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className={`${panelSoftClass} p-4 text-sm ${mutedTextClass}`}>
                    Total appointments processed:{' '}
                    <span className={`font-semibold ${headingTextClass}`}>{metrics.total}</span>
                  </div>
                  <div className={`${panelSoftClass} p-4 text-sm ${mutedTextClass}`}>
                    Recorded appointments:{' '}
                    <span className={`font-semibold ${headingTextClass}`}>{metrics.recorded}</span>
                  </div>
                  <div className={`${panelSoftClass} p-4 text-sm ${mutedTextClass}`}>
                    Open appointments: <span className={`font-semibold ${headingTextClass}`}>{metrics.booked}</span>
                  </div>
                  <div className={`${panelSoftClass} p-4 text-sm ${mutedTextClass}`}>
                    Failed writes: <span className={`font-semibold ${headingTextClass}`}>{metrics.failed}</span>
                  </div>
                </div>

                <p className={`mt-4 text-xs ${subtleTextClass}`}>
                  Use this report for admin standups and operations review.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </WorkspaceCanvas>
  )
}

export default DoctorDashboardPage

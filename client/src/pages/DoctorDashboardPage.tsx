import { useMemo, useState } from 'react'
import WorkspaceCanvas from '../components/layout/WorkspaceCanvas'
import WorkspaceSidebar from '../components/layout/WorkspaceSidebar'
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
  dataMaskingEnabled: boolean
}

type SidebarSection = 'population' | 'alerts' | 'resources' | 'security'

type AutomationTask = {
  id: string
  title: string
  detail: string
}

const sidebarItems: Array<{
  key: SidebarSection
  label: string
  caption: string
  icon: 'chart' | 'alert' | 'hospital' | 'shield'
}> = [
  {
    key: 'population',
    label: 'Population Health',
    caption: 'High-level patient risk analytics',
    icon: 'chart',
  },
  {
    key: 'alerts',
    label: 'Risk Alerts',
    caption: 'AI-flagged emergencies',
    icon: 'alert',
  },
  {
    key: 'resources',
    label: 'Resource Manager',
    caption: 'Beds, staffing, and throughput',
    icon: 'hospital',
  },
  {
    key: 'security',
    label: 'Security Logs',
    caption: 'Audit trail and access integrity',
    icon: 'shield',
  },
]

const automationTasks: AutomationTask[] = [
  {
    id: 'draft-discharge-402',
    title: 'Drafting discharge summary for Patient #402',
    detail: 'Stable vitals in the last 8 hours. Ready for physician review.',
  },
  {
    id: 'insurance-claim-117',
    title: 'Preparing insurance claim packet for Case #117',
    detail: 'Required attachments found. Awaiting doctor approval.',
  },
  {
    id: 'lancet-case-102',
    title: 'Literature signal for Case #102',
    detail: 'Recent study in The Lancet aligns with symptom cluster. Open abstract?',
  },
]

const wardHeatmap: Array<Array<{ ward: string; risk: 'low' | 'medium' | 'high'; score: number }>> = [
  [
    { ward: 'Ward A1', risk: 'low', score: 24 },
    { ward: 'Ward A2', risk: 'low', score: 31 },
    { ward: 'Ward A3', risk: 'medium', score: 52 },
    { ward: 'Ward A4', risk: 'high', score: 79 },
  ],
  [
    { ward: 'Ward B1', risk: 'low', score: 29 },
    { ward: 'Ward B2', risk: 'medium', score: 57 },
    { ward: 'Ward B3', risk: 'high', score: 84 },
    { ward: 'Ward B4', risk: 'medium', score: 61 },
  ],
  [
    { ward: 'Ward C1', risk: 'low', score: 27 },
    { ward: 'Ward C2', risk: 'medium', score: 46 },
    { ward: 'Ward C3', risk: 'medium', score: 55 },
    { ward: 'Ward C4', risk: 'high', score: 74 },
  ],
]

const predictiveAdmissions = [14, 18, 22, 19, 25, 28, 24, 26, 31, 29, 27, 32]

const panelClass = workspacePanelClass
const panelSoftClass = workspacePanelSoftClass
const headingTextClass = workspaceHeadingTextClass
const mutedTextClass = workspaceMutedTextClass
const subtleTextClass = workspaceSubtleTextClass
const primaryButtonClass = workspacePrimaryButtonClass
const ghostButtonClass = workspaceGhostButtonClass

const riskColorClass = (risk: 'low' | 'medium' | 'high') => {
  if (risk === 'high') return 'bg-rose-400/55 border-rose-300/80'
  if (risk === 'medium') return 'bg-amber-300/45 border-amber-300/70'
  return 'bg-emerald-400/45 border-emerald-300/70'
}

const PredictiveTrend = ({ values }: { values: number[] }) => {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1

  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100
      const y = 100 - ((value - min) / span) * 100
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg viewBox="0 0 100 100" className="h-44 w-full">
      <polyline fill="none" stroke="#64FFDA" strokeWidth="2.8" points={points} />
    </svg>
  )
}

const DoctorDashboardPage = ({
  reservations,
  authUser,
  onNavigate,
  onLogout,
  onUpdateReservation,
  dataMaskingEnabled,
}: DoctorDashboardPageProps) => {
  const [activeSection, setActiveSection] = useState<SidebarSection>('population')
  const [showIdentity, setShowIdentity] = useState(false)
  const [approvedTasks, setApprovedTasks] = useState<string[]>([])
  const canReveal = canRevealIdentity(authUser?.role)

  const shouldMaskIdentity = dataMaskingEnabled || !showIdentity

  const metrics = useMemo(() => {
    const booked = reservations.filter((item) => item.status === 'Booked').length
    const recorded = reservations.filter((item) => item.status === 'Recorded').length
    const failed = reservations.filter((item) => item.status === 'Failed').length
    return { total: reservations.length, booked, recorded, failed }
  }, [reservations])

  const riskQueue = useMemo(
    () =>
      [...reservations]
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 8)
        .map((reservation) => ({
          ...reservation,
          riskLevel:
            reservation.priority === 'High'
              ? 'High'
              : reservation.confidence >= 0.72
                ? 'Medium'
                : 'Low',
        })),
    [reservations]
  )

  const securityLogRows = useMemo(
    () =>
      riskQueue.slice(0, 6).map((item, index) => ({
        id: `SEC-${index + 1}`,
        action: index % 2 === 0 ? 'Viewed AI alert' : 'Updated appointment status',
        actor: authUser?.username ?? 'unknown@healix',
        target: item.id,
        timestamp: new Date(Date.now() - index * 15 * 60 * 1000).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })),
    [authUser?.username, riskQueue]
  )

  const hasAdminDashboardAccess = authUser?.role === 'admin' || authUser?.role === 'system_admin'

  const markRecorded = async (reservationId: string) => {
    await onUpdateReservation(reservationId, { status: 'Recorded' })
  }

  const renderPopulationSection = () => (
    <div className="space-y-4">
      <article className={`${panelClass} p-6`}>
        <p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>Predictive Risk</p>
        <h3 className={`mt-2 text-xl font-semibold ${headingTextClass}`}>
          7-day risk trend for active monitored cohort
        </h3>
        <div className="mt-4">
          <PredictiveTrend values={predictiveAdmissions} />
        </div>
      </article>

      <article className={`${panelClass} p-6`}>
        <p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>Live Patient Queue</p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-white/70">
              <tr>
                <th className="px-3 py-2 font-semibold">Patient</th>
                <th className="px-3 py-2 font-semibold">Department</th>
                <th className="px-3 py-2 font-semibold">Risk</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {riskQueue.map((row) => (
                <tr key={row.id} className="border-t border-white/10 text-white/85">
                  <td className="px-3 py-2">
                    {shouldMaskIdentity ? maskPersonName(row.patientName) : row.patientName}
                  </td>
                  <td className="px-3 py-2">{row.department}</td>
                  <td className="px-3 py-2">{row.riskLevel}</td>
                  <td className="px-3 py-2">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  )

  const renderAlertsSection = () => (
    <article className={`${panelClass} p-6`}>
      <p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>AI Alert Queue</p>
      <h3 className={`mt-2 text-xl font-semibold ${headingTextClass}`}>
        Immediate clinical review list
      </h3>
      <div className="mt-4 space-y-3">
        {riskQueue.map((item) => (
          <div key={item.id} className={`${panelSoftClass} p-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className={`text-sm font-semibold ${headingTextClass}`}>
                  {shouldMaskIdentity ? maskPersonName(item.patientName) : item.patientName}
                </p>
                <p className={`text-xs ${mutedTextClass}`}>
                  {shouldMaskIdentity ? maskIdentifier(item.id) : item.id} | {item.department}
                </p>
                <p className={`mt-2 text-xs ${mutedTextClass}`}>{item.summary}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-rose-300/45 bg-rose-300/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-100">
                  {item.priority}
                </span>
                <button type="button" onClick={() => markRecorded(item.id)} className={primaryButtonClass}>
                  Mark reviewed
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </article>
  )

  const renderResourceSection = () => (
    <div className="space-y-4">
      <article className={`${panelClass} p-6`}>
        <p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>Resource Manager</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className={`${panelSoftClass} p-4`}>
            <p className={`text-xs uppercase tracking-[0.14em] ${subtleTextClass}`}>Bed occupancy</p>
            <p className={`mt-2 text-2xl font-semibold ${headingTextClass}`}>82%</p>
          </div>
          <div className={`${panelSoftClass} p-4`}>
            <p className={`text-xs uppercase tracking-[0.14em] ${subtleTextClass}`}>Staff-to-patient ratio</p>
            <p className={`mt-2 text-2xl font-semibold ${headingTextClass}`}>1 : 6</p>
          </div>
          <div className={`${panelSoftClass} p-4`}>
            <p className={`text-xs uppercase tracking-[0.14em] ${subtleTextClass}`}>48h admission forecast</p>
            <p className={`mt-2 text-2xl font-semibold ${headingTextClass}`}>+14%</p>
          </div>
        </div>
      </article>

      <article className={`${panelClass} p-6`}>
        <p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>Hospital Risk Heatmap</p>
        <div className="mt-4 grid gap-2">
          {wardHeatmap.map((row) => (
            <div key={row[0].ward} className="grid grid-cols-4 gap-2">
              {row.map((cell) => (
                <div
                  key={cell.ward}
                  className={`rounded-xl border p-3 text-center text-xs text-white ${riskColorClass(cell.risk)}`}
                >
                  <p className="font-semibold">{cell.ward}</p>
                  <p className="mt-1 text-[11px]">Risk {cell.score}%</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </article>
    </div>
  )

  const renderSecuritySection = () => (
    <article className={`${panelClass} p-6`}>
      <p className={`text-xs uppercase tracking-[0.18em] ${subtleTextClass}`}>Security Logs</p>
      <h3 className={`mt-2 text-xl font-semibold ${headingTextClass}`}>
        Audit Trail (STRIDE-aligned)
      </h3>
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-white/70">
            <tr>
              <th className="px-3 py-2 font-semibold">Time</th>
              <th className="px-3 py-2 font-semibold">Action</th>
              <th className="px-3 py-2 font-semibold">Actor</th>
              <th className="px-3 py-2 font-semibold">Target</th>
            </tr>
          </thead>
          <tbody>
            {securityLogRows.map((row) => (
              <tr key={row.id} className="border-t border-white/10 text-white/85">
                <td className="px-3 py-2">{row.timestamp}</td>
                <td className="px-3 py-2">{row.action}</td>
                <td className="px-3 py-2">{row.actor}</td>
                <td className="px-3 py-2">{row.target}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  )

  return (
    <WorkspaceCanvas>
      <div className="mx-auto w-full px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <section className={`${panelClass} relative overflow-hidden p-6 sm:p-7`}>
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] bg-[radial-gradient(circle_at_top,rgba(100,255,218,0.22),transparent_68%)] lg:block" />
          <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className={`text-xs uppercase tracking-[0.2em] ${subtleTextClass}`}>
                Command Center
              </p>
              <h1 className={`mt-3 text-3xl font-semibold tracking-tight sm:text-4xl ${headingTextClass}`}>
                Healix Clinical Operations
              </h1>
              <p className={`mt-3 max-w-3xl text-sm sm:text-base ${mutedTextClass}`}>
                High-density operational dashboard for doctors and admins with role-safe visibility.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <button className={primaryButtonClass} onClick={onLogout} type="button">
                  Logout
                </button>
                {hasAdminDashboardAccess ? (
                  <button className={ghostButtonClass} onClick={() => onNavigate?.('admin')} type="button">
                    Open Admin Dashboard
                  </button>
                ) : null}
                {canReveal ? (
                  <button
                    className={`${ghostButtonClass} ${dataMaskingEnabled ? 'cursor-not-allowed opacity-60' : ''}`}
                    onClick={() => setShowIdentity((prev) => !prev)}
                    type="button"
                    disabled={dataMaskingEnabled}
                  >
                    {dataMaskingEnabled ? 'Data masking active' : showIdentity ? 'Hide Identity' : 'View Identity'}
                  </button>
                ) : null}
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

        <div className="mt-6 grid gap-6 lg:grid-cols-[16.25rem_minmax(0,1fr)_20rem]">
          <WorkspaceSidebar
            className="h-fit p-0 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
            brandTitle="Healix AI"
            brandSubtitle="Doctor workspace"
            onBrandClick={() => onNavigate?.('landing')}
            sectionLabel="Control Center"
            items={sidebarItems}
            activeKey={activeSection}
            onSelect={(key) => setActiveSection(key as SidebarSection)}
            statusLabel="Compliance"
            statusValue={dataMaskingEnabled ? 'HIPAA data masking enabled' : 'Clinical visibility mode'}
            profileLabel="Identity"
            profileValue={`Dr. ${authUser?.username ?? 'Unknown'}`}
            profileCaption={`${formatRoleLabel(authUser?.role)} · Verified Badge`}
          />

          <section className="space-y-6">
            {activeSection === 'population' && renderPopulationSection()}
            {activeSection === 'alerts' && renderAlertsSection()}
            {activeSection === 'resources' && renderResourceSection()}
            {activeSection === 'security' && renderSecuritySection()}
          </section>

          <aside className="rounded-3xl border border-white/10 bg-[rgba(8,18,41,0.58)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] lg:self-start">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Task Automator</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Agentic AI</h3>
            <p className="mt-2 text-sm text-white/65">
              AI drafts discharge and claim actions for one-click physician approval.
            </p>

            <div className="mt-4 space-y-3">
              {automationTasks.map((task) => {
                const approved = approvedTasks.includes(task.id)
                return (
                  <article key={task.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="text-sm font-semibold text-white">{task.title}</p>
                    <p className="mt-1 text-xs text-white/65">{task.detail}</p>
                    <button
                      type="button"
                      onClick={() =>
                        setApprovedTasks((prev) =>
                          prev.includes(task.id) ? prev : [...prev, task.id]
                        )
                      }
                      className="mt-3 rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:border-[#64FFDA] hover:text-[#64FFDA]"
                    >
                      {approved ? 'Approved' : 'Approve'}
                    </button>
                  </article>
                )
              })}
            </div>
          </aside>
        </div>
      </div>
    </WorkspaceCanvas>
  )
}

export default DoctorDashboardPage

import { workspaceMutedTextClass, workspacePanelClass, workspaceSubtleTextClass } from '../../../../styles/workspaceUi'
import { maskIdentifier, maskPersonName } from '../../../../utils/privacy'
import { formatDashboardDateTime } from '../../shared/dashboardEvents'
import { resolveReportLogMetadata } from '../../shared/reportLogMetadata'
import type { DashboardLogItem } from '../../shared/types'

type DoctorReportsLogSectionProps = {
  items: DashboardLogItem[]
  dataMaskingEnabled: boolean
}

const severityClass = (severity: DashboardLogItem['severity']) => {
  if (severity === 'Critical') return 'border-rose-300/70 bg-rose-100 text-rose-700'
  if (severity === 'Warning') return 'border-amber-300/70 bg-amber-100 text-amber-700'
  return 'border-sky-300/70 bg-sky-100 text-sky-700'
}

const DoctorReportsLogSection = ({ items, dataMaskingEnabled }: DoctorReportsLogSectionProps) => {
  if (items.length === 0) {
    return (
      <article className={`${workspacePanelClass} p-5`}>
        <p className={`text-sm ${workspaceMutedTextClass}`}>No report log events match your search query.</p>
      </article>
    )
  }

  return (
    <section className="space-y-3">
      {items.map((item) => {
        const title = dataMaskingEnabled ? maskPersonName(item.title) : item.title
        const detail = dataMaskingEnabled ? maskIdentifier(item.detail) : item.detail
        const metadata = resolveReportLogMetadata(item, dataMaskingEnabled)

        return (
          <article key={item.id} className={`${workspacePanelClass} p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className={`text-xs uppercase tracking-[0.14em] ${workspaceSubtleTextClass}`}>{item.source}</p>
                <h2 className="mt-1 text-base font-semibold text-[color:var(--agent-ink)]">{title}</h2>
                <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>{detail}</p>
              </div>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${severityClass(item.severity)}`}>
                {item.severity}
              </span>
            </div>

            <div className="mt-3 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--agent-surface-strong)] p-3">
              <dl className="space-y-1.5 text-xs text-[color:var(--agent-muted-soft)]">
                <div className="grid grid-cols-[6.5rem_1fr] gap-2">
                  <dt className="font-semibold text-[color:var(--agent-ink)]">User ID</dt>
                  <dd className="break-all">{metadata.userId}</dd>
                </div>
                <div className="grid grid-cols-[6.5rem_1fr] gap-2">
                  <dt className="font-semibold text-[color:var(--agent-ink)]">Action</dt>
                  <dd className="break-all">{metadata.action}</dd>
                </div>
                <div className="grid grid-cols-[6.5rem_1fr] gap-2">
                  <dt className="font-semibold text-[color:var(--agent-ink)]">Details</dt>
                  <dd className="break-all">{metadata.details}</dd>
                </div>
                <div className="grid grid-cols-[6.5rem_1fr] gap-2">
                  <dt className="font-semibold text-[color:var(--agent-ink)]">IP Address</dt>
                  <dd className="break-all">{metadata.ipAddress}</dd>
                </div>
                <div className="grid grid-cols-[6.5rem_1fr] gap-2">
                  <dt className="font-semibold text-[color:var(--agent-ink)]">User Agent</dt>
                  <dd className="break-all">{metadata.userAgent}</dd>
                </div>
                <div className="grid grid-cols-[6.5rem_1fr] gap-2">
                  <dt className="font-semibold text-[color:var(--agent-ink)]">Timestamp</dt>
                  <dd>{formatDashboardDateTime(metadata.timestamp)}</dd>
                </div>
              </dl>
            </div>
          </article>
        )
      })}
    </section>
  )
}

export default DoctorReportsLogSection

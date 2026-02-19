import { workspaceMutedTextClass, workspacePanelClass, workspaceSubtleTextClass } from '../../../../styles/workspaceUi'
import { maskIdentifier, maskPersonName } from '../../../../utils/privacy'
import { formatDashboardDateTime } from '../../shared/dashboardEvents'
import type { DashboardLogItem } from '../../shared/types'

type AdminReportsLogSectionProps = {
  items: DashboardLogItem[]
  dataMaskingEnabled: boolean
}

const severityClass = (severity: DashboardLogItem['severity']) => {
  if (severity === 'Critical') return 'border-rose-300/70 bg-rose-100 text-rose-700'
  if (severity === 'Warning') return 'border-amber-300/70 bg-amber-100 text-amber-700'
  return 'border-sky-300/70 bg-sky-100 text-sky-700'
}

const AdminReportsLogSection = ({ items, dataMaskingEnabled }: AdminReportsLogSectionProps) => {
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

            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[color:var(--agent-muted-soft)]">
              <span>Actor: {item.actor}</span>
              <span>{formatDashboardDateTime(item.createdAt)}</span>
            </div>
          </article>
        )
      })}
    </section>
  )
}

export default AdminReportsLogSection

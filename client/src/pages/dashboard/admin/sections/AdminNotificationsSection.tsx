import { workspaceMutedTextClass, workspacePanelClass, workspaceSubtleTextClass } from '../../../../styles/workspaceUi'
import { maskIdentifier, maskPersonName } from '../../../../utils/privacy'
import { formatDashboardDateTime } from '../../shared/dashboardEvents'
import type { DashboardNotificationItem } from '../../shared/types'

type AdminNotificationsSectionProps = {
  items: DashboardNotificationItem[]
  dataMaskingEnabled: boolean
}

const severityClass = (severity: DashboardNotificationItem['severity']) => {
  if (severity === 'critical') return 'border-rose-300/70 bg-rose-100 text-rose-700'
  if (severity === 'warning') return 'border-amber-300/70 bg-amber-100 text-amber-700'
  return 'border-sky-300/70 bg-sky-100 text-sky-700'
}

const AdminNotificationsSection = ({ items, dataMaskingEnabled }: AdminNotificationsSectionProps) => {
  return (
    <section className="space-y-3">
      {items.map((item) => {
        const title = dataMaskingEnabled ? maskPersonName(item.title) : item.title
        const detail = dataMaskingEnabled ? maskIdentifier(item.detail) : item.detail

        return (
          <article key={item.id} className={`${workspacePanelClass} p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[color:var(--agent-ink)]">{title}</h2>
                <p className={`mt-1 text-sm ${workspaceMutedTextClass}`}>{detail}</p>
                <p className={`mt-2 text-xs ${workspaceSubtleTextClass}`}>{formatDashboardDateTime(item.createdAt)}</p>
              </div>
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${severityClass(item.severity)}`}>
                {item.severity}
              </span>
            </div>
          </article>
        )
      })}
    </section>
  )
}

export default AdminNotificationsSection

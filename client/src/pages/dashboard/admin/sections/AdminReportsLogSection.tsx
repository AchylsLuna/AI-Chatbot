import {
  workspaceGhostButtonClass,
  workspaceMutedTextClass,
  workspacePanelClass,
  workspacePrimaryButtonClass,
  workspaceSubtleTextClass,
} from '../../../../styles/workspaceUi'
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

const escapeCsvCell = (value: string) => {
  const escaped = value.replace(/"/g, '""')
  if (/[",\n]/.test(value)) return `"${escaped}"`
  return escaped
}

const downloadTextFile = (filename: string, content: string, mimeType: string) => {
  if (typeof window === 'undefined') return
  const blob = new Blob([content], { type: mimeType })
  const objectUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(objectUrl)
}

const AdminReportsLogSection = ({ items, dataMaskingEnabled }: AdminReportsLogSectionProps) => {
  const exportRows = items.map((item) => ({
    id: item.id,
    actor: item.actor,
    source: item.source,
    title: dataMaskingEnabled ? maskPersonName(item.title) : item.title,
    detail: dataMaskingEnabled ? maskIdentifier(item.detail) : item.detail,
    severity: item.severity,
    createdAt: formatDashboardDateTime(item.createdAt),
  }))

  const exportTimestamp = new Date().toISOString().replace(/[:.]/g, '-')

  const handleDownloadCsv = () => {
    const header = ['ID', 'Actor', 'Source', 'Title', 'Detail', 'Severity', 'Created At']
    const rows = exportRows.map((item) => [
      item.id,
      item.actor,
      item.source,
      item.title,
      item.detail,
      item.severity,
      item.createdAt,
    ])
    const csv = [header, ...rows].map((line) => line.map((value) => escapeCsvCell(String(value))).join(',')).join('\n')
    downloadTextFile(`reports-log-${exportTimestamp}.csv`, csv, 'text/csv;charset=utf-8')
  }

  const handleDownloadBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      dataMaskingEnabled,
      totalRows: exportRows.length,
      rows: exportRows,
    }
    downloadTextFile(
      `reports-log-backup-${exportTimestamp}.json`,
      JSON.stringify(payload, null, 2),
      'application/json;charset=utf-8'
    )
  }

  return (
    <section className="space-y-3">
      <article className={`${workspacePanelClass} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={`text-sm ${workspaceMutedTextClass}`}>Download the currently displayed report log records.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={workspacePrimaryButtonClass} onClick={handleDownloadCsv}>
              Download CSV
            </button>
            <button type="button" className={workspaceGhostButtonClass} onClick={handleDownloadBackup}>
              Download Backup
            </button>
          </div>
        </div>
      </article>

      {items.length === 0 ? (
        <article className={`${workspacePanelClass} p-5`}>
          <p className={`text-sm ${workspaceMutedTextClass}`}>No report log events match your search query.</p>
        </article>
      ) : (
        items.map((item) => {
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
        })
      )}
    </section>
  )
}

export default AdminReportsLogSection

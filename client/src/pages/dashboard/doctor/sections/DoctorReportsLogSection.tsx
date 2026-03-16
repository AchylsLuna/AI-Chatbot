import {
  pageFieldClass,
  pageGhostButtonClass,
  pageMutedTextClass,
  pagePanelClass,
  pageSubtleTextClass,
} from '../../../../styles/pageUi'
import { maskIdentifier, maskPersonName } from '../../../../utils/privacy'
import { formatEventDateTime } from '../../shared/activityEvents'
import {
  type ReportLogActionFilter,
  type ReportLogSeverityFilter,
  type ReportLogSourceFilter,
} from '../../shared/reportLogFilters'
import { resolveReportLogMetadata } from '../../shared/reportLogMetadata'
import type { LogItem } from '../../shared/types'

type DoctorReportsLogSectionProps = {
  items: LogItem[]
  dataMaskingEnabled: boolean
  sourceFilter: ReportLogSourceFilter
  severityFilter: ReportLogSeverityFilter
  actionFilter: ReportLogActionFilter
  actionOptions: string[]
  onSourceFilterChange: (value: ReportLogSourceFilter) => void
  onSeverityFilterChange: (value: ReportLogSeverityFilter) => void
  onActionFilterChange: (value: ReportLogActionFilter) => void
  onResetFilters: () => void
}

const severityClass = (severity: LogItem['severity']) => {
  if (severity === 'Critical') return 'border-rose-300/70 bg-rose-100 text-rose-700'
  if (severity === 'Warning') return 'border-amber-300/70 bg-amber-100 text-amber-700'
  return 'border-sky-300/70 bg-sky-100 text-sky-700'
}

const sourceOptions: LogItem['source'][] = ['Auth', 'Reservation', 'System']
const severityOptions: LogItem['severity'][] = ['Info', 'Warning', 'Critical']

const DoctorReportsLogSection = ({
  items,
  dataMaskingEnabled,
  sourceFilter,
  severityFilter,
  actionFilter,
  actionOptions,
  onSourceFilterChange,
  onSeverityFilterChange,
  onActionFilterChange,
  onResetFilters,
}: DoctorReportsLogSectionProps) => {

  return (
    <section className="space-y-3">
      <article className={`${pagePanelClass} p-5`}>
        <p className={`text-sm ${pageMutedTextClass}`}>Filter the currently displayed report log records.</p>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
          <select
            value={sourceFilter}
            onChange={(event) => onSourceFilterChange(event.target.value as ReportLogSourceFilter)}
            className={pageFieldClass}
            aria-label="Filter report logs by source"
          >
            <option value="all">All sources</option>
            {sourceOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            value={severityFilter}
            onChange={(event) => onSeverityFilterChange(event.target.value as ReportLogSeverityFilter)}
            className={pageFieldClass}
            aria-label="Filter report logs by severity"
          >
            <option value="all">All severities</option>
            {severityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <select
            value={actionFilter}
            onChange={(event) => onActionFilterChange(event.target.value as ReportLogActionFilter)}
            className={pageFieldClass}
            aria-label="Filter report logs by action"
          >
            <option value="all">All actions</option>
            {actionOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>

          <button type="button" className={pageGhostButtonClass} onClick={onResetFilters}>
            Reset filters
          </button>
        </div>
      </article>

      {items.length === 0 ? (
        <article className={`${pagePanelClass} p-5`}>
          <p className={`text-sm ${pageMutedTextClass}`}>No report log events match your search query.</p>
        </article>
      ) : (
        items.map((item) => {
          const title = dataMaskingEnabled ? maskPersonName(item.title) : item.title
          const detail = dataMaskingEnabled ? maskIdentifier(item.detail) : item.detail
          const metadata = resolveReportLogMetadata(item, dataMaskingEnabled)

          return (
            <article key={item.id} className={`${pagePanelClass} p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className={`text-xs uppercase tracking-[0.14em] ${pageSubtleTextClass}`}>{item.source}</p>
                  <h2 className="mt-1 text-base font-semibold text-[color:var(--agent-ink)]">{title}</h2>
                  <p className={`mt-1 text-sm ${pageMutedTextClass}`}>{detail}</p>
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
                    <dd>{formatEventDateTime(metadata.timestamp)}</dd>
                  </div>
                </dl>
              </div>
            </article>
          )
        })
      )}
    </section>
  )
}

export default DoctorReportsLogSection

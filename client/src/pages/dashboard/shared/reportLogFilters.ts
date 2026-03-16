import { resolveReportLogMetadata } from './reportLogMetadata'
import type { LogItem } from './types'

export type ReportLogSourceFilter = 'all' | LogItem['source']
export type ReportLogSeverityFilter = 'all' | LogItem['severity']
export type ReportLogActionFilter = 'all' | string

type FilterReportLogItemsParams = {
  items: LogItem[]
  searchQuery: string
  sourceFilter: ReportLogSourceFilter
  severityFilter: ReportLogSeverityFilter
  actionFilter: ReportLogActionFilter
}

export const getReportLogActionOptions = (items: LogItem[]) => {
  const actionSet = new Set<string>()

  for (const item of items) {
    const action = resolveReportLogMetadata(item, false).action.trim()
    if (!action) continue
    actionSet.add(action)
  }

  return [...actionSet].sort((a, b) => a.localeCompare(b))
}

export const filterReportLogItems = ({
  items,
  searchQuery,
  sourceFilter,
  severityFilter,
  actionFilter,
}: FilterReportLogItemsParams) => {
  const query = searchQuery.trim().toLowerCase()

  return items.filter((item) => {
    if (query) {
      const isSearchMatch =
        item.actor.toLowerCase().includes(query) ||
        item.source.toLowerCase().includes(query) ||
        item.title.toLowerCase().includes(query) ||
        item.detail.toLowerCase().includes(query)

      if (!isSearchMatch) return false
    }

    if (sourceFilter !== 'all' && item.source !== sourceFilter) return false
    if (severityFilter !== 'all' && item.severity !== severityFilter) return false

    if (actionFilter !== 'all') {
      const action = resolveReportLogMetadata(item, false).action
      if (action !== actionFilter) return false
    }

    return true
  })
}

import { maskIdentifier } from '../../../utils/privacy'
import type { DashboardLogItem } from './types'

export type ReportLogMetadata = {
  userId: string
  action: string
  details: string
  ipAddress: string
  userAgent: string
  timestamp: string
}

const normalizeValue = (value?: string) => {
  const normalized = value?.trim()
  return normalized || undefined
}

const actionFallback = (item: DashboardLogItem) => {
  if (item.source === 'Auth') return 'SESSION_AUDIT'
  if (item.source === 'System') return 'SYSTEM_AUDIT'
  if (item.severity === 'Critical') return 'RESERVATION_FAILED'
  if (item.severity === 'Warning') return 'RESERVATION_BOOKED'
  return 'RESERVATION_RECORDED'
}

const userIdFallback = (item: DashboardLogItem) => {
  const actor = normalizeValue(item.actor)
  if (!actor) return 'unknown-user'
  return actor.toLowerCase().replace(/\s+/g, '.')
}

const browserUserAgentFallback = () => {
  if (typeof window === 'undefined') return 'Unknown user agent'
  if (typeof window.navigator?.userAgent !== 'string') return 'Unknown user agent'
  const agent = window.navigator.userAgent.trim()
  return agent || 'Unknown user agent'
}

export const resolveReportLogMetadata = (
  item: DashboardLogItem,
  dataMaskingEnabled: boolean
): ReportLogMetadata => {
  const userIdRaw = normalizeValue(item.userId) ?? userIdFallback(item)
  const detailsRaw = normalizeValue(item.details) ?? normalizeValue(item.detail) ?? 'No details available.'

  return {
    userId: dataMaskingEnabled ? maskIdentifier(userIdRaw) : userIdRaw,
    action: normalizeValue(item.action) ?? actionFallback(item),
    details: dataMaskingEnabled ? maskIdentifier(detailsRaw) : detailsRaw,
    ipAddress: normalizeValue(item.ipAddress) ?? '127.0.0.1',
    userAgent: normalizeValue(item.userAgent) ?? browserUserAgentFallback(),
    timestamp: normalizeValue(item.timestamp) ?? item.createdAt,
  }
}

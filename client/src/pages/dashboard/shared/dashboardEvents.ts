import type { AuthSession, Reservation } from '../../../types'
import type { DashboardLogItem, DashboardNotificationItem } from './types'
import { formatPhilippineDateTime } from '../../../utils/dateTime'

const parseDate = (value: string) => {
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const resolveReservationAction = (status: Reservation['status']) => {
  if (status === 'Failed') return 'RESERVATION_FAILED'
  if (status === 'Booked') return 'RESERVATION_BOOKED'
  return 'RESERVATION_RECORDED'
}

const getBrowserUserAgent = () => {
  if (typeof window === 'undefined') return undefined
  if (typeof window.navigator?.userAgent !== 'string') return undefined
  return window.navigator.userAgent
}

const fallbackLogs: DashboardLogItem[] = [
  {
    id: 'SYS-LOG-001',
    actor: 'System',
    source: 'System',
    title: 'Daily dashboard snapshot generated',
    detail: 'Automated integrity check completed for workspace event timeline.',
    userId: 'system-service',
    action: 'SYSTEM_AUDIT',
    details: 'Automated integrity check completed for workspace event timeline.',
    ipAddress: '127.0.0.1',
    userAgent: 'System Service',
    timestamp: '2026-02-17T15:00:00.000Z',
    createdAt: '2026-02-17T15:00:00.000Z',
    severity: 'Info',
  },
  {
    id: 'SYS-LOG-002',
    actor: 'Security',
    source: 'System',
    title: 'Session policy verification',
    detail: 'Session policy checks completed with no elevated-risk findings.',
    userId: 'system-security',
    action: 'SYSTEM_AUDIT',
    details: 'Session policy checks completed with no elevated-risk findings.',
    ipAddress: '127.0.0.1',
    userAgent: 'System Service',
    timestamp: '2026-02-16T09:40:00.000Z',
    createdAt: '2026-02-16T09:40:00.000Z',
    severity: 'Info',
  },
]

export const buildDashboardLogItems = (params: {
  reservations: Reservation[]
  authUser: AuthSession['user'] | null
  sessionStatus: string
}): DashboardLogItem[] => {
  const browserUserAgent = getBrowserUserAgent()
  const reservationLogs = [...params.reservations]
    .sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt))
    .slice(0, 20)
    .map<DashboardLogItem>((reservation) => {
      const severity: DashboardLogItem['severity'] =
        reservation.status === 'Failed'
          ? 'Critical'
          : reservation.status === 'Booked'
            ? 'Warning'
            : 'Info'

      const detail = `${reservation.department} appointment is ${reservation.status.toLowerCase()} at ${formatPhilippineDateTime(reservation.requestedTime)}.`

      return {
        id: `RES-LOG-${reservation.id}-${reservation.createdAt}`,
        actor: 'Booking engine',
        source: 'Reservation',
        title: `${reservation.patientName} (${reservation.id})`,
        detail,
        userId: reservation.id,
        action: resolveReservationAction(reservation.status),
        details: detail,
        ipAddress: '127.0.0.1',
        userAgent: browserUserAgent,
        timestamp: reservation.createdAt,
        createdAt: reservation.createdAt,
        severity,
      }
    })

  const authLogCreatedAt = new Date().toISOString()
  const authDetails = `Session status: ${params.sessionStatus}.`
  const authLog: DashboardLogItem = {
    id: 'AUTH-LOG-CURRENT-SESSION',
    actor: params.authUser?.username ?? 'Unknown user',
    source: 'Auth',
    title: 'Current privileged session',
    detail: authDetails,
    userId: params.authUser?.username ?? 'unknown-user',
    action: 'SESSION_AUDIT',
    details: authDetails,
    ipAddress: '127.0.0.1',
    userAgent: browserUserAgent,
    timestamp: authLogCreatedAt,
    createdAt: authLogCreatedAt,
    severity: 'Info',
  }

  return [authLog, ...reservationLogs, ...fallbackLogs]
    .sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt))
    .slice(0, 40)
}

export const buildDashboardNotificationItems = (
  reservations: Reservation[]
): DashboardNotificationItem[] => {
  const items = [...reservations]
    .sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt))
    .slice(0, 30)
    .map<DashboardNotificationItem>((reservation) => {
      const severity: DashboardNotificationItem['severity'] =
        reservation.status === 'Failed'
          ? 'critical'
          : reservation.status === 'Booked'
            ? 'warning'
            : 'info'

      return {
        id: `ALERT-${reservation.id}-${reservation.createdAt}`,
        title: `${reservation.patientName} status update`,
        detail: `${reservation.department} appointment moved to ${reservation.status}. Requested time: ${formatPhilippineDateTime(reservation.requestedTime)}.`,
        createdAt: reservation.createdAt,
        reservationId: reservation.id,
        status: reservation.status,
        severity,
      }
    })

  if (items.length > 0) return items

  return [
    {
      id: 'ALERT-FALLBACK-001',
      title: 'No active alerts',
      detail: 'New reservation events will appear in the notification feed.',
      createdAt: new Date().toISOString(),
      severity: 'info',
    },
  ]
}

export const formatDashboardDateTime = (value: string) => {
  const timestamp = parseDate(value)
  if (!timestamp) return 'Unknown'
  return formatPhilippineDateTime(timestamp)
}

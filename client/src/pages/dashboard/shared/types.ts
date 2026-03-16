import type { Reservation } from '../../../types'

export type LogSeverity = 'Info' | 'Warning' | 'Critical'

export type LogItem = {
  id: string
  actor: string
  source: 'Auth' | 'Reservation' | 'System'
  title: string
  detail: string
  userId?: string
  action?: string
  details?: string
  ipAddress?: string
  userAgent?: string
  timestamp?: string
  createdAt: string
  severity: LogSeverity
}

export type NotificationSeverity = 'info' | 'warning' | 'critical'

export type NotificationItem = {
  id: string
  title: string
  detail: string
  createdAt: string
  reservationId?: Reservation['id']
  status?: Reservation['status']
  severity: NotificationSeverity
}

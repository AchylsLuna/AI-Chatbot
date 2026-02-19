import type { Reservation } from '../../../types'

export type DashboardLogSeverity = 'Info' | 'Warning' | 'Critical'

export type DashboardLogItem = {
  id: string
  actor: string
  source: 'Auth' | 'Reservation' | 'System'
  title: string
  detail: string
  createdAt: string
  severity: DashboardLogSeverity
}

export type DashboardNotificationSeverity = 'info' | 'warning' | 'critical'

export type DashboardNotificationItem = {
  id: string
  title: string
  detail: string
  createdAt: string
  reservationId?: Reservation['id']
  status?: Reservation['status']
  severity: DashboardNotificationSeverity
}

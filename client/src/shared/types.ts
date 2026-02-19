export type DashboardNotificationItem = {
  id: string
  title: string
  detail: string
  severity: 'info' | 'warning' | 'critical'
  timestamp: string
}

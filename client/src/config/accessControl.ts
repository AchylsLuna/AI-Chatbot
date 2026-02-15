import type { AppPage } from '../types/navigation'
import type { UserRole } from '../types/triage'

const allRoles: UserRole[] = ['user', 'nurse', 'admin', 'system_admin']

export const requiresAuth: Partial<Record<AppPage, UserRole[]>> = {
  triage: allRoles,
  appointments: allRoles,
  doctor_dashboard: ['nurse', 'admin', 'system_admin'],
  dashboard: ['nurse', 'admin', 'system_admin'],
  analytics: ['nurse', 'admin', 'system_admin'],
  clinical_reports: ['admin', 'system_admin'],
  care_alerts: ['nurse', 'admin', 'system_admin'],
  care_support: ['nurse', 'admin', 'system_admin'],
  ledger_monitoring: ['admin', 'system_admin'],
  intake_monitoring: ['nurse', 'admin', 'system_admin'],
  security: ['admin', 'system_admin'],
  user_management: ['admin', 'system_admin'],
  admin: ['admin', 'system_admin'],
}

export const canAccessPage = (page: AppPage, role?: UserRole | null) => {
  const allowedRoles = requiresAuth[page]
  if (!allowedRoles) return true
  if (!role) return false
  return allowedRoles.includes(role)
}

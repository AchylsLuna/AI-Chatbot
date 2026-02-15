import type { AppPage } from '../types/navigation'
import type { UserRole } from '../types/triage'

const allRoles: UserRole[] = ['user', 'nurse', 'admin', 'system_admin']

export const requiresAuth: Partial<Record<AppPage, UserRole[]>> = {
  triage: allRoles,
  dashboard: ['nurse', 'admin', 'system_admin'],
  analytics: ['nurse', 'admin', 'system_admin'],
  clinical_reports: ['nurse', 'admin', 'system_admin'],
  care_alerts: ['nurse', 'admin', 'system_admin'],
  care_support: ['nurse', 'admin', 'system_admin'],
  ledger_monitoring: ['nurse', 'admin', 'system_admin'],
  intake_monitoring: ['nurse', 'admin', 'system_admin'],
  security: ['nurse', 'admin', 'system_admin'],
  user_management: ['nurse', 'admin', 'system_admin'],
  admin: ['admin', 'system_admin'],
}

export const canAccessPage = (page: AppPage, role?: UserRole | null) => {
  const allowedRoles = requiresAuth[page]
  if (!allowedRoles) return true
  if (!role) return false
  return allowedRoles.includes(role)
}

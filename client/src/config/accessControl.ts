import type { AppPage } from '../types/navigation'
import type { UserRole } from '../types/triage'

export const allRoles: UserRole[] = ['user', 'nurse', 'admin', 'system_admin']

export const requiresAuth: Partial<Record<AppPage, UserRole[]>> = {
  triage: allRoles,
  dashboard: ['nurse', 'admin', 'system_admin'],
  admin: ['admin', 'system_admin'],
}

export const canAccessPage = (page: AppPage, role?: UserRole | null) => {
  const allowedRoles = requiresAuth[page]
  if (!allowedRoles) return true
  if (!role) return false
  return allowedRoles.includes(role)
}

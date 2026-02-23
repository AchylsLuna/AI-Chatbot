import type { AppPage } from '../types/navigation'
import type { UserRole } from '../types'

export const requiresAuth: Partial<Record<AppPage, UserRole[]>> = {
  appointments: ['user'],
  doctor_dashboard: ['nurse'],
  admin: ['admin', 'system_admin'],
}

export const canAccessPage = (page: AppPage, role?: UserRole | null) => {
  const allowedRoles = requiresAuth[page]
  if (!allowedRoles) return true
  if (!role) return false
  return allowedRoles.includes(role)
}

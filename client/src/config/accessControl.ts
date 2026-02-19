import type { AppPage } from '../types/navigation'
import type { UserRole } from '../types'

export const requiresAuth: Partial<Record<AppPage, UserRole[]>> = {
  appointments: ['user'],
  doctor_dashboard: ['nurse', 'admin', 'system_admin'],
  admin: ['admin', 'system_admin'],
}

export const canAccessPage = (page: AppPage, role?: UserRole | null) => {
  const allowedRoles = requiresAuth[page]
  if (!allowedRoles) return true
  if (!role) return false
  return allowedRoles.includes(role)
}

export const getAuthRedirectPage = (page: AppPage): AppPage => {
  if (page === 'appointments') return 'login'
  if (page === 'doctor_dashboard') return 'doctor_login'
  if (page === 'admin') return 'admin_login'
  return 'landing'
}

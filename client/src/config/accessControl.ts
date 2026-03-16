import type { AppPage } from '../types/navigation'
import type { UserRole } from '../types'
import { normalizeRoleForSession } from '../utils/roleRoutes'

type AccessRole = UserRole | 'nurse'

export const requiresAuth: Partial<Record<AppPage, AccessRole[]>> = {
  appointments: ['user'],
  doctor_dashboard: ['doctor', 'nurse'],
  admin: ['admin', 'system_admin'],
}

export const canAccessPage = (page: AppPage, role?: UserRole | null) => {
  const allowedRoles = requiresAuth[page]
  if (!allowedRoles) return true
  if (!role) return false

  const normalizedRole = normalizeRoleForSession(role)
  return allowedRoles.some((allowedRole) => normalizeRoleForSession(allowedRole) === normalizedRole)
}

import type { AppPage } from '../types/navigation'
import type { UserRole } from '../types'
import { getDefaultDashboardPage } from './dashboardRoutes'

const roleLabels: Record<UserRole, string> = {
  user: 'Patient',
  nurse: 'Doctor',
  admin: 'Admin',
  system_admin: 'Admin',
}

export const formatRoleLabel = (role?: string | null) => {
  if (!role) return 'Unknown'
  const normalized = role as UserRole
  if (roleLabels[normalized]) return roleLabels[normalized]
  return role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export const getWorkspaceRoleLabel = (role?: UserRole | null) => {
  if (!role) return 'Unknown'
  if (role === 'user') return 'Patient'
  if (role === 'nurse') return 'Doctor'
  return 'Admin'
}

export const getDefaultPageForRole = (role?: UserRole | null): AppPage => {
  return getDefaultDashboardPage(role)
}

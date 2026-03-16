import type { AppPage } from '../types/navigation'
import type { UserRole } from '../types'
import { getDefaultPageForRole as resolveDefaultPageForRole } from './roleRoutes'

const roleLabels: Record<UserRole, string> = {
  user: 'Patient',
  doctor: 'Doctor',
  admin: 'Admin',
  system_admin: 'Admin',
}

export const formatRoleLabel = (role?: string | null) => {
  if (!role) return 'Unknown'
  const normalized = role as UserRole
  if (roleLabels[normalized]) return roleLabels[normalized]
  return role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export const getRoleLabel = (role?: UserRole | null) => {
  if (!role) return 'Unknown'
  if (role === 'user') return 'Patient'
  if (role === 'doctor') return 'Doctor'
  return 'Admin'
}

export const getDefaultPageForRole = (role?: UserRole | null): AppPage => {
  return resolveDefaultPageForRole(role)
}

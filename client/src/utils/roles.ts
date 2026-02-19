import type { AppPage } from '../types/navigation'
import type { UserRole } from '../types'

const roleLabels: Record<UserRole, string> = {
  user: 'User',
  nurse: 'Nurse',
  admin: 'Admin',
  system_admin: 'Super Admin',
}

export const formatRoleLabel = (role?: string | null) => {
  if (!role) return 'Unknown'
  const normalized = role as UserRole
  if (roleLabels[normalized]) return roleLabels[normalized]
  return role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export const getWorkspaceRoleLabel = (role?: UserRole | null) => {
  if (!role) return 'Unknown'
  if (role === 'user') return 'User'
  return 'Admin'
}

export const getDefaultPageForRole = (role?: UserRole | null): AppPage => {
  if (role === 'doctor' || role === 'nurse' || role === 'admin' || role === 'system_admin') {
    return 'doctor_dashboard'
  }
  return 'appointments'
}

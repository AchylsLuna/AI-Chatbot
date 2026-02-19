import type { AppPage } from '../types/navigation'
import type { UserRole } from '../types'

const roleLabels: Record<UserRole, string> = {
  user: 'User',
  nurse: 'Nurse',
  admin: 'Admin',
  system_admin: 'System Admin',
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
  if (role === 'nurse') return 'Doctor'
  return 'Admin'
}

export const getDefaultPageForRole = (role?: UserRole | null): AppPage => {
  if (role === 'admin' || role === 'system_admin') return 'admin'
  if (role === 'nurse') return 'doctor_dashboard'
  return 'appointments'
}

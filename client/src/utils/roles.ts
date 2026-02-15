import type { AppPage } from '../types/navigation'
import type { UserRole } from '../types/triage'

const roleLabels: Record<UserRole, string> = {
  user: 'User',
  nurse: 'Nurse / Doctor',
  admin: 'Admin',
  system_admin: 'System Admin',
}

export const formatRoleLabel = (role?: string | null) => {
  if (!role) return 'Unknown'
  const normalized = role as UserRole
  if (roleLabels[normalized]) return roleLabels[normalized]
  return role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

export const getDefaultPageForRole = (role?: UserRole | null): AppPage => {
  if (role === 'nurse' || role === 'admin' || role === 'system_admin') {
    return 'dashboard'
  }
  return 'triage'
}

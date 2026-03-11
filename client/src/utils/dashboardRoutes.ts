import type { AppPage } from '../types/navigation'
import type { UserRole } from '../types'

const normalize = (value?: string | null) => String(value || '').trim().toLowerCase()

const DOCTOR_ROLE_ALIASES = new Set(['doctor'])
const ADMIN_ROLE_ALIASES = new Set(['admin', 'system_admin'])
const PATIENT_ROLE_ALIASES = new Set(['patient', 'user'])

const getNormalizedRole = (role?: string | null, accountType?: string | null) => {
  const normalizedRole = normalize(role)
  const normalizedAccountType = normalize(accountType)

  if (normalizedRole === 'system_admin' || normalizedAccountType === 'system_admin') {
    return 'system_admin'
  }

  if (ADMIN_ROLE_ALIASES.has(normalizedRole) || ADMIN_ROLE_ALIASES.has(normalizedAccountType)) {
    return 'admin'
  }

  if (DOCTOR_ROLE_ALIASES.has(normalizedRole) || DOCTOR_ROLE_ALIASES.has(normalizedAccountType)) {
    return 'doctor'
  }

  if (PATIENT_ROLE_ALIASES.has(normalizedRole) || PATIENT_ROLE_ALIASES.has(normalizedAccountType)) {
    return 'user'
  }

  return null
}

export const normalizeRoleForSession = (
  role?: string | null,
  accountType?: string | null
): UserRole => {
  return (getNormalizedRole(role, accountType) ?? 'user') as UserRole
}

export const isDoctorRole = (role?: string | null, accountType?: string | null) => {
  return getNormalizedRole(role, accountType) === 'doctor'
}

export const isAdminRole = (role?: string | null, accountType?: string | null) => {
  const normalized = getNormalizedRole(role, accountType)
  return normalized === 'admin' || normalized === 'system_admin'
}

export const isSystemAdminRole = (role?: string | null, accountType?: string | null) => {
  return getNormalizedRole(role, accountType) === 'system_admin'
}

export const getDefaultDashboardPage = (
  role?: string | null,
  accountType?: string | null
): AppPage => {
  if (isSystemAdminRole(role, accountType) || isAdminRole(role, accountType)) {
    return 'admin'
  }
  if (isDoctorRole(role, accountType)) {
    return 'doctor_dashboard'
  }
  return 'appointments'
}

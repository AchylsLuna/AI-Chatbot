import type { UserRole } from '../types'

export const maskPersonName = (name: string): string => {
  const cleaned = name.trim()
  return cleaned || 'Patient'
}

export const maskIdentifier = (value: string): string => {
  const cleaned = value.trim()
  return cleaned
}

export const canRevealIdentity = (role?: UserRole | null): boolean =>
  role === 'doctor' || role === 'admin' || role === 'system_admin'

import type { UserRole } from '../types'

const maskWord = (word: string) => {
  if (!word) return ''
  if (word.length <= 2) return `${word[0] || ''}*`
  return `${word[0]}${'•'.repeat(Math.min(5, Math.max(2, word.length - 1)))}`
}

export const maskPersonName = (name: string): string => {
  const cleaned = name.trim()
  if (!cleaned) return 'Patient •••'
  return cleaned
    .split(/\s+/)
    .slice(0, 2)
    .map(maskWord)
    .join(' ')
}

export const maskIdentifier = (value: string): string => {
  const cleaned = value.trim()
  if (!cleaned) return '••••'
  if (cleaned.length <= 5) return `${cleaned[0] || ''}•••`
  return `${cleaned.slice(0, 3)}•••${cleaned.slice(-2)}`
}

export const canRevealIdentity = (role?: UserRole | null): boolean =>
  role === 'nurse' || role === 'admin' || role === 'system_admin'

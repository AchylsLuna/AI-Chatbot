import type { UserRole } from '../types'

const PROFILE_AVATAR_STORAGE_PREFIX = 'pulse-ledger-profile-avatar'
const MAX_PROFILE_AVATAR_BYTES = 2 * 1024 * 1024
const ALLOWED_PROFILE_AVATAR_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

type ProfileAvatarRecord = {
  dataUrl: string
  mimeType: string
  updatedAt: string
}

type AvatarValidationResult =
  | { ok: true }
  | { ok: false; error: string }

const normalizeIdentity = (username: string, role?: UserRole | null) => {
  const normalizedUsername = username.trim().toLowerCase() || 'unknown'
  const normalizedRole = role ?? 'guest'
  return `${normalizedUsername}:${normalizedRole}`
}

const getProfileAvatarStorageKey = (username: string, role?: UserRole | null) =>
  `${PROFILE_AVATAR_STORAGE_PREFIX}:${normalizeIdentity(username, role)}`

const parseProfileAvatarRecord = (value: string | null): ProfileAvatarRecord | null => {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<ProfileAvatarRecord>
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.dataUrl !== 'string') return null
    if (typeof parsed.mimeType !== 'string') return null
    if (typeof parsed.updatedAt !== 'string') return null
    if (!parsed.dataUrl.startsWith('data:')) return null
    return {
      dataUrl: parsed.dataUrl,
      mimeType: parsed.mimeType,
      updatedAt: parsed.updatedAt,
    }
  } catch {
    return null
  }
}

const isClient = () => typeof window !== 'undefined'

export const validateProfileAvatarFile = (file: File): AvatarValidationResult => {
  if (!ALLOWED_PROFILE_AVATAR_TYPES.has(file.type)) {
    return {
      ok: false,
      error: 'Use PNG, JPEG, or WEBP image format.',
    }
  }

  if (file.size > MAX_PROFILE_AVATAR_BYTES) {
    return {
      ok: false,
      error: 'Image size must be 2MB or less.',
    }
  }

  return { ok: true }
}

export const readProfileAvatarAsDataUrl = async (file: File): Promise<string> => {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Unable to read selected image.'))
        return
      }
      resolve(result)
    }
    reader.onerror = () => reject(new Error('Unable to read selected image.'))
    reader.readAsDataURL(file)
  })
}

export const loadProfileAvatar = (username: string, role?: UserRole | null) => {
  if (!isClient()) return null
  const key = getProfileAvatarStorageKey(username, role)
  const stored = window.localStorage.getItem(key)
  const record = parseProfileAvatarRecord(stored)
  return record?.dataUrl ?? null
}

export const saveProfileAvatar = (params: {
  username: string
  role?: UserRole | null
  dataUrl: string
  mimeType: string
}) => {
  if (!isClient()) return
  const key = getProfileAvatarStorageKey(params.username, params.role)
  const payload: ProfileAvatarRecord = {
    dataUrl: params.dataUrl,
    mimeType: params.mimeType,
    updatedAt: new Date().toISOString(),
  }
  window.localStorage.setItem(key, JSON.stringify(payload))
}

export const removeProfileAvatar = (username: string, role?: UserRole | null) => {
  if (!isClient()) return
  const key = getProfileAvatarStorageKey(username, role)
  window.localStorage.removeItem(key)
}

export const getAvatarInitials = (name: string, fallback = 'U') => {
  const tokens = name.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return fallback
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase()
  return `${tokens[0][0] ?? ''}${tokens[1][0] ?? ''}`.toUpperCase()
}


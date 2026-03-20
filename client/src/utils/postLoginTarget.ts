import { normalizePath, resolveCanonicalPath } from '../config/routing'
import { isTabPathForPage } from '../config/roleTabRoutes'
import type { AppPage } from '../types/navigation'

type OtpSourcePage = Extract<AppPage, 'login' | 'doctor_login' | 'admin_login'>
type OtpTargetPage = Extract<AppPage, 'appointments' | 'doctor_dashboard' | 'admin'>

export type StoredPostLoginTarget = {
  page: OtpTargetPage
  authPage: OtpSourcePage
  path: string | null
  updatedAt: number
}

const STORAGE_KEY = 'pulse-post-login-target'
const MAX_AGE_MS = 30 * 60 * 1000

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isOtpSourcePage = (page: unknown): page is OtpSourcePage =>
  page === 'login' || page === 'doctor_login' || page === 'admin_login'

const isOtpTargetPage = (page: unknown): page is OtpTargetPage =>
  page === 'appointments' || page === 'doctor_dashboard' || page === 'admin'

const canUseStorage = () =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'

const sanitizeStoredTargetPath = (path: unknown, page: OtpTargetPage) => {
  if (typeof path !== 'string' || !path.trim()) return null

  try {
    const url = new URL(path, window.location.origin)
    if (url.origin !== window.location.origin) {
      return null
    }

    const canonicalPath = resolveCanonicalPath(url.pathname)
    if (!isTabPathForPage(canonicalPath, page)) {
      return null
    }

    return normalizePath(canonicalPath)
  } catch {
    return null
  }
}

export const readStoredPostLoginTarget = (): StoredPostLoginTarget | null => {
  if (!canUseStorage()) return null

  const raw = window.sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!isRecord(parsed)) {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return null
    }

    const updatedAt = Number(parsed.updatedAt)
    if (!Number.isFinite(updatedAt) || Date.now() - updatedAt > MAX_AGE_MS) {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return null
    }

    if (!isOtpTargetPage(parsed.page) || !isOtpSourcePage(parsed.authPage)) {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return null
    }

    const path = sanitizeStoredTargetPath(parsed.path, parsed.page)

    return {
      page: parsed.page,
      authPage: parsed.authPage,
      path,
      updatedAt,
    }
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export const writeStoredPostLoginTarget = (
  target: Omit<StoredPostLoginTarget, 'updatedAt'>
) => {
  if (!canUseStorage()) return
  const safePath = sanitizeStoredTargetPath(target.path, target.page)
  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...target,
      path: safePath,
      updatedAt: Date.now(),
    })
  )
}

export const clearStoredPostLoginTarget = () => {
  if (!canUseStorage()) return
  window.sessionStorage.removeItem(STORAGE_KEY)
}

import type { AppPage } from '../types/navigation'

export type AppRouteState = {
  appRoute?: boolean
  appPage?: AppPage
  sourcePage?: AppPage
  returnTo?: string
} & Record<string, unknown>

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

export const readAppRouteState = (): AppRouteState => {
  if (typeof window === 'undefined') return {}
  return isRecord(window.history.state) ? (window.history.state as AppRouteState) : {}
}

export const buildAppRouteState = (
  page: AppPage,
  extra?: Record<string, unknown>,
  base?: Record<string, unknown>
): AppRouteState => {
  return {
    ...(base ?? {}),
    appRoute: true,
    appPage: page,
    ...(extra ?? {}),
  }
}

export const resolveSourcePage = <T extends AppPage>(
  allowedPages: readonly T[],
  fallbackPage: T
): T => {
  const sourcePage = readAppRouteState().sourcePage
  if (!sourcePage) return fallbackPage
  return allowedPages.includes(sourcePage as T) ? (sourcePage as T) : fallbackPage
}

export const resolveReturnTo = () => {
  const returnTo = readAppRouteState().returnTo
  return typeof returnTo === 'string' && returnTo.trim() ? returnTo : null
}

import type { AppPage } from '../types/navigation'

export const PAGE_ROUTES: Record<AppPage, string> = {
  landing: '/',
  triage: '/triage',
  dashboard: '/dashboard',
  admin: '/admin',
  admin_login: '/admin-login',
  login: '/login',
  forgot_password: '/forgot-password',
  signup: '/signup',
}

const getBasePrefix = () => {
  const base = import.meta.env.BASE_URL || '/'
  return base === '/' ? '' : base.replace(/\/$/, '')
}

export const buildRoute = (page: AppPage) => {
  const basePrefix = getBasePrefix()
  const route = PAGE_ROUTES[page]
  if (!basePrefix) return route
  if (route === '/') return basePrefix || '/'
  return `${basePrefix}${route}`
}

export const normalizePath = (path: string) => {
  const [pathname] = path.split('?')
  let cleaned = pathname || '/'
  const basePrefix = getBasePrefix()

  if (
    basePrefix &&
    (cleaned === basePrefix || cleaned.startsWith(`${basePrefix}/`))
  ) {
    cleaned = cleaned.slice(basePrefix.length) || '/'
  }

  if (!cleaned.startsWith('/')) cleaned = `/${cleaned}`
  if (cleaned.length > 1 && cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1)
  }

  return cleaned
}

export const hasKnownRoute = (path: string) => {
  const normalized = normalizePath(path)
  return Object.values(PAGE_ROUTES).some(
    (route) => normalizePath(route) === normalized
  )
}

export const resolvePageFromPath = (path: string): AppPage => {
  const normalized = normalizePath(path)
  const match = (Object.entries(PAGE_ROUTES) as Array<[AppPage, string]>).find(
    ([, route]) => normalizePath(route) === normalized
  )
  return match?.[0] ?? 'landing'
}

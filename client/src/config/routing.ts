import type { AppPage } from '../types/navigation'

const PAGE_ROUTES: Record<AppPage, string> = {
  landing: '/',
  triage: '/triage',
  appointments: '/appointments',
  doctor_dashboard: '/doctor-dashboard',
  dashboard: '/dashboard',
  analytics: '/dashboard/analytics',
  clinical_reports: '/dashboard/clinical-reports',
  care_alerts: '/dashboard/care-alerts',
  care_support: '/dashboard/care-support',
  ledger_monitoring: '/dashboard/ledger-monitoring',
  intake_monitoring: '/dashboard/intake-monitoring',
  security: '/dashboard/security',
  user_management: '/dashboard/user-management',
  admin: '/admin',
  admin_login: '/admin-login',
  login: '/login',
  otp: '/otp',
  forgot_password: '/forgot-password',
  signup: '/signup',
}

const LEGACY_ROUTE_ALIASES: Record<string, AppPage> = {
  '/doctor_dashboard': 'doctor_dashboard',
  '/admin_login': 'admin_login',
  '/forgot_password': 'forgot_password',
  '/dashboard/clinical_reports': 'clinical_reports',
  '/dashboard/care_alerts': 'care_alerts',
  '/dashboard/care_support': 'care_support',
  '/dashboard/ledger_monitoring': 'ledger_monitoring',
  '/dashboard/intake_monitoring': 'intake_monitoring',
  '/dashboard/user_management': 'user_management',
  '/doctor': 'doctor_dashboard',
  '/admin/login': 'admin_login',
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
  const isCanonicalRoute = Object.values(PAGE_ROUTES).some(
    (route) => normalizePath(route) === normalized
  )
  if (isCanonicalRoute) return true
  return Object.keys(LEGACY_ROUTE_ALIASES).some(
    (route) => normalizePath(route) === normalized
  )
}

export const resolvePageFromPath = (path: string): AppPage => {
  const normalized = normalizePath(path)
  const match = (Object.entries(PAGE_ROUTES) as Array<[AppPage, string]>).find(
    ([, route]) => normalizePath(route) === normalized
  )
  if (match?.[0]) return match[0]

  const aliasMatch = Object.entries(LEGACY_ROUTE_ALIASES).find(
    ([route]) => normalizePath(route) === normalized
  )
  return aliasMatch?.[1] ?? 'landing'
}

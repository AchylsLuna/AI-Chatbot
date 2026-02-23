import type { AppPage } from '../types/navigation'
import {
  resolveWorkspaceCanonicalPath,
  resolveWorkspacePageFromPath,
} from './workspaceTabRoutes'
import { matchesNamespace, normalizePath, withBasePrefix } from './pathUtils'
import { ROUTES } from '../utils/routes'

export { normalizePath } from './pathUtils'

const PAGE_ROUTES: Record<AppPage, string> = {
  landing: ROUTES.landing,
  appointments: ROUTES.appointments,
  doctor_dashboard: ROUTES.doctor.dashboard,
  admin: ROUTES.admin.dashboard,
  admin_login: ROUTES.adminSignIn,
  doctor_login: ROUTES.doctorSignIn,
  login: ROUTES.signIn,
  otp: ROUTES.otp,
  forgot_password: ROUTES.forgotPassword,
  signup: ROUTES.signup,
}

const LEGACY_ROUTE_ALIASES: Record<string, AppPage> = {
  // Canonical namespace shortcuts
  [ROUTES.doctor.root]: 'doctor_dashboard',
  [ROUTES.doctor.postJob]: 'doctor_dashboard',
  [ROUTES.doctor.jobPosts]: 'doctor_dashboard',
  [ROUTES.doctor.applications]: 'doctor_dashboard',
  [ROUTES.doctor.jobs]: 'doctor_dashboard',
  // Legacy dashboard aliases
  [ROUTES.legacyDashboard.doctor.root]: 'doctor_dashboard',
  [ROUTES.legacyDashboard.doctor.dashboard]: 'doctor_dashboard',
  [ROUTES.legacyDashboard.doctor.postJob]: 'doctor_dashboard',
  [ROUTES.legacyDashboard.doctor.jobPosts]: 'doctor_dashboard',
  [ROUTES.legacyDashboard.doctor.applications]: 'doctor_dashboard',
  [ROUTES.legacyDashboard.doctor.jobs]: 'doctor_dashboard',
  [ROUTES.legacyDashboard.admin.root]: 'admin',
  [ROUTES.legacyDashboard.admin.dashboard]: 'admin',
  // Historical aliases
  '/sign-in': 'login',
  '/signin': 'login',
  '/admin-sign-in': 'admin_login',
  '/doctor-signin': 'doctor_login',
  '/triage': 'appointments',
  '/dashboard': 'doctor_dashboard',
  '/dashboard/analytics': 'doctor_dashboard',
  '/dashboard/clinical-reports': 'doctor_dashboard',
  '/dashboard/care-alerts': 'doctor_dashboard',
  '/dashboard/care-support': 'doctor_dashboard',
  '/dashboard/ledger-monitoring': 'doctor_dashboard',
  '/dashboard/intake-monitoring': 'doctor_dashboard',
  '/dashboard/security': 'doctor_dashboard',
  '/dashboard/user-management': 'doctor_dashboard',
  '/doctor-dashboard': 'doctor_dashboard',
  '/doctor_dashboard': 'doctor_dashboard',
  '/doctor-login': 'doctor_login',
  '/admin_login': 'admin_login',
  '/forgot_password': 'forgot_password',
  '/dashboard/clinical_reports': 'doctor_dashboard',
  '/dashboard/care_alerts': 'doctor_dashboard',
  '/dashboard/care_support': 'doctor_dashboard',
  '/dashboard/ledger_monitoring': 'doctor_dashboard',
  '/dashboard/intake_monitoring': 'doctor_dashboard',
  '/dashboard/user_management': 'doctor_dashboard',
  '/admin/login': 'admin_login',
  '/worker': 'appointments',
  '/worker/dashboard': 'appointments',
}

const DOCTOR_NAMESPACE_ROOTS = [
  ROUTES.doctor.root,
  ROUTES.legacyDashboard.doctor.root,
]

const ADMIN_NAMESPACE_ROOTS = [ROUTES.admin.root, ROUTES.legacyDashboard.admin.root]

const isDoctorNamespacePath = (path: string) => {
  const normalized = normalizePath(path)
  if (normalized === normalizePath(ROUTES.doctorSignIn)) return false
  return DOCTOR_NAMESPACE_ROOTS.some((root) => matchesNamespace(normalized, root))
}

const isAdminNamespacePath = (path: string) => {
  const normalized = normalizePath(path)
  if (normalized === normalizePath(ROUTES.adminSignIn) || normalized === '/admin/login') return false
  return ADMIN_NAMESPACE_ROOTS.some((root) => matchesNamespace(normalized, root))
}

export const buildRoute = (page: AppPage) => {
  return withBasePrefix(PAGE_ROUTES[page])
}

export const buildRouteFromCanonicalPath = (path: string, search = '', hash = '') => {
  return `${withBasePrefix(path)}${search}${hash}`
}

export const buildRouteWithSearchHash = (
  page: AppPage,
  search = '',
  hash = ''
) => {
  return buildRouteFromCanonicalPath(PAGE_ROUTES[page], search, hash)
}

export const hasKnownRoute = (path: string) => {
  const normalized = normalizePath(path)
  if (resolveWorkspacePageFromPath(normalized)) return true
  if (isDoctorNamespacePath(normalized) || isAdminNamespacePath(normalized)) return true

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
  const workspacePage = resolveWorkspacePageFromPath(normalized)
  if (workspacePage) return workspacePage
  if (isDoctorNamespacePath(normalized)) return 'doctor_dashboard'
  if (isAdminNamespacePath(normalized)) return 'admin'

  const match = (Object.entries(PAGE_ROUTES) as Array<[AppPage, string]>).find(
    ([, route]) => normalizePath(route) === normalized
  )
  if (match?.[0]) return match[0]

  const aliasMatch = Object.entries(LEGACY_ROUTE_ALIASES).find(
    ([route]) => normalizePath(route) === normalized
  )
  return aliasMatch?.[1] ?? 'landing'
}

export const resolveAuthPageFromPath = (
  path: string
): Extract<AppPage, 'login' | 'doctor_login' | 'admin_login'> => {
  const page = resolvePageFromPath(path)
  if (page === 'admin' || page === 'admin_login') return 'admin_login'
  if (page === 'doctor_dashboard' || page === 'doctor_login') return 'doctor_login'
  return 'login'
}

export const resolveCanonicalPath = (path: string) => {
  const normalized = normalizePath(path)
  if (!hasKnownRoute(normalized)) return normalizePath(PAGE_ROUTES.landing)

  const workspaceCanonicalPath = resolveWorkspaceCanonicalPath(normalized)
  if (workspaceCanonicalPath) return normalizePath(workspaceCanonicalPath)

  const matchedCanonicalRoute = Object.values(PAGE_ROUTES).find(
    (route) => normalizePath(route) === normalized
  )
  if (matchedCanonicalRoute) return normalizePath(matchedCanonicalRoute)

  const resolvedPage = resolvePageFromPath(normalized)
  return normalizePath(PAGE_ROUTES[resolvedPage])
}

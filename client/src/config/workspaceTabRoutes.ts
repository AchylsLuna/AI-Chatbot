import type { AppPage } from '../types/navigation'
import { matchesNamespace, normalizePath } from './pathUtils'
import { ROUTES } from '../utils/routes'

export const APPOINTMENTS_TAB_PATHS = {
  booking_appointments: ROUTES.appointments,
  history: `${ROUTES.appointments}/history`,
  notifications: `${ROUTES.appointments}/notifications`,
  settings: `${ROUTES.appointments}/settings`,
} as const

export const DOCTOR_TAB_PATHS = {
  appointments: ROUTES.doctor.dashboard,
  queue: `${ROUTES.doctor.root}/queue`,
  analytics: `${ROUTES.doctor.root}/analytics`,
  settings: `${ROUTES.doctor.root}/settings`,
} as const

export const ADMIN_TAB_PATHS = {
  user_management: ROUTES.admin.dashboard,
  staff_management: `${ROUTES.admin.root}/staff-management`,
  history: `${ROUTES.admin.root}/history`,
  notifications: `${ROUTES.admin.root}/notifications`,
  settings: `${ROUTES.admin.root}/settings`,
} as const

export type AppointmentsTab = keyof typeof APPOINTMENTS_TAB_PATHS
export type DoctorTab = keyof typeof DOCTOR_TAB_PATHS
export type AdminTab = keyof typeof ADMIN_TAB_PATHS
export type WorkspacePage = Extract<AppPage, 'appointments' | 'doctor_dashboard' | 'admin'>

const APPOINTMENTS_COMPAT_TAB_MAP: Readonly<Record<string, AppointmentsTab>> = {
  '/worker': 'booking_appointments',
  '/worker/dashboard': 'booking_appointments',
  '/triage': 'booking_appointments',
  [`${ROUTES.appointments}/appointments`]: 'history',
}

const DOCTOR_DEFAULT_COMPAT_PATHS: ReadonlySet<string> = new Set([
  ROUTES.doctor.root,
  ROUTES.legacyDashboard.doctor.root,
  ROUTES.legacyDashboard.doctor.dashboard,
  '/doctor-dashboard',
  '/doctor_dashboard',
])

const ADMIN_DEFAULT_COMPAT_PATHS: ReadonlySet<string> = new Set([
  ROUTES.legacyDashboard.admin.root,
  ROUTES.legacyDashboard.admin.dashboard,
])

const DOCTOR_NAMESPACE_ROOTS = [ROUTES.doctor.root, ROUTES.legacyDashboard.doctor.root]
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

const findTabForPath = <T extends string>(paths: Record<T, string>, path: string): T | null => {
  const normalized = normalizePath(path)
  const entries = Object.entries(paths) as Array<[T, string]>
  for (const [tab, tabPath] of entries) {
    if (normalizePath(tabPath) === normalized) return tab
  }
  return null
}

export const resolveAppointmentsTabFromPath = (path: string): AppointmentsTab | null => {
  const normalized = normalizePath(path)
  const direct = findTabForPath(APPOINTMENTS_TAB_PATHS, normalized)
  if (direct) return direct
  if (normalized in APPOINTMENTS_COMPAT_TAB_MAP) return APPOINTMENTS_COMPAT_TAB_MAP[normalized]
  return null
}

export const resolveDoctorTabFromPath = (path: string): DoctorTab | null => {
  const normalized = normalizePath(path)
  const direct = findTabForPath(DOCTOR_TAB_PATHS, normalized)
  if (direct) return direct
  if (DOCTOR_DEFAULT_COMPAT_PATHS.has(normalized)) return 'appointments'
  return null
}

export const resolveAdminTabFromPath = (path: string): AdminTab | null => {
  const normalized = normalizePath(path)
  const direct = findTabForPath(ADMIN_TAB_PATHS, normalized)
  if (direct) return direct
  if (ADMIN_DEFAULT_COMPAT_PATHS.has(normalized)) return 'user_management'
  return null
}

export const getAppointmentsTabPath = (tab: AppointmentsTab) => APPOINTMENTS_TAB_PATHS[tab]
export const getDoctorTabPath = (tab: DoctorTab) => DOCTOR_TAB_PATHS[tab]
export const getAdminTabPath = (tab: AdminTab) => ADMIN_TAB_PATHS[tab]

export const resolveWorkspacePageFromPath = (path: string): WorkspacePage | null => {
  const normalized = normalizePath(path)

  if (resolveAppointmentsTabFromPath(normalized)) return 'appointments'
  if (resolveDoctorTabFromPath(normalized)) return 'doctor_dashboard'
  if (resolveAdminTabFromPath(normalized)) return 'admin'

  if (isDoctorNamespacePath(normalized)) return 'doctor_dashboard'
  if (isAdminNamespacePath(normalized)) return 'admin'

  return null
}

export const resolveWorkspaceCanonicalPath = (path: string): string | null => {
  const normalized = normalizePath(path)

  const appointmentsTab = resolveAppointmentsTabFromPath(normalized)
  if (appointmentsTab) return getAppointmentsTabPath(appointmentsTab)

  const doctorTab = resolveDoctorTabFromPath(normalized)
  if (doctorTab) return getDoctorTabPath(doctorTab)

  const adminTab = resolveAdminTabFromPath(normalized)
  if (adminTab) return getAdminTabPath(adminTab)

  const page = resolveWorkspacePageFromPath(normalized)
  if (page === 'appointments') return getAppointmentsTabPath('booking_appointments')
  if (page === 'doctor_dashboard') return getDoctorTabPath('appointments')
  if (page === 'admin') return getAdminTabPath('user_management')

  return null
}

export const isWorkspacePathForPage = (path: string, page: AppPage) => {
  if (page !== 'appointments' && page !== 'doctor_dashboard' && page !== 'admin') {
    return false
  }

  const canonical = resolveWorkspaceCanonicalPath(path)
  if (!canonical) return false

  return resolveWorkspacePageFromPath(canonical) === page
}

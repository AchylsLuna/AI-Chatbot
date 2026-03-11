export const ROUTES = {
  landing: '/',
  signIn: '/login',
  adminSignIn: '/admin-login',
  doctorSignIn: '/doctor-sign-in',
  otp: '/otp',
  forgotPassword: '/forgot-password',
  signup: '/signup',
  doctorSignup: '/signup/doctor',
  appointments: '/appointments',
  admin: {
    root: '/admin',
    dashboard: '/admin',
  },
  doctor: {
    root: '/doctor',
    dashboard: '/doctor/dashboard',
    postJob: '/doctor/post-job',
    jobPosts: '/doctor/job-posts',
    applications: '/doctor/applications',
    jobs: '/doctor/jobs',
  },
  legacyDashboard: {
    doctor: {
      root: '/dashboard/doctor',
      dashboard: '/dashboard/doctor/dashboard',
      postJob: '/dashboard/doctor/post-job',
      jobPosts: '/dashboard/doctor/job-posts',
      applications: '/dashboard/doctor/applications',
      jobs: '/dashboard/doctor/jobs',
    },
    admin: {
      root: '/dashboard/admin',
      dashboard: '/dashboard/admin/dashboard',
    },
  },
} as const

export type RouteNamespace = keyof typeof ROUTES

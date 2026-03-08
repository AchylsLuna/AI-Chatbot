# Routes

This document reflects the current frontend routing and redirect behavior implemented in:

- `client/src/config/routing.ts`
- `client/src/config/workspaceTabRoutes.ts`
- `client/src/hooks/useAppRouting.ts`
- `client/src/App.tsx`
- `client/src/config/accessControl.ts`
- `client/src/utils/dashboardRoutes.ts`

## Canonical Routes

### Public and Auth

| Path | Page key | Purpose |
| --- | --- | --- |
| `/` | `landing` | Public landing page |
| `/login` | `login` | Patient sign-in |
| `/doctor-sign-in` | `doctor_login` | Doctor sign-in |
| `/admin-login` | `admin_login` | Admin/staff sign-in |
| `/otp` | `otp` | OTP verification |
| `/forgot-password` | `forgot_password` | Password recovery |
| `/signup` | `signup` | Account registration |

### Patient Workspace

| Path | Workspace | Tab |
| --- | --- | --- |
| `/appointments` | `appointments` | `booking_appointments` |
| `/appointments/history` | `appointments` | `history` |
| `/appointments/notifications` | `appointments` | `notifications` |
| `/appointments/settings` | `appointments` | `settings` |

### Doctor Workspace

| Path | Workspace | Tab |
| --- | --- | --- |
| `/doctor/dashboard` | `doctor_dashboard` | `appointments` |
| `/doctor/queue` | `doctor_dashboard` | `queue` |
| `/doctor/analytics` | `doctor_dashboard` | `analytics` |
| `/doctor/settings` | `doctor_dashboard` | `settings` |

### Admin Workspace

| Path | Workspace | Tab |
| --- | --- | --- |
| `/admin` | `admin` | `user_management` |
| `/admin/staff-management` | `admin` | `staff_management` |
| `/admin/history` | `admin` | `history` |
| `/admin/notifications` | `admin` | `notifications` |
| `/admin/settings` | `admin` | `settings` |

## Access Control

| Page | Allowed roles |
| --- | --- |
| `appointments` | `user` |
| `doctor_dashboard` | `nurse` |
| `admin` | `admin`, `system_admin` |

Notes:

- Legacy `doctor` role values are normalized to `nurse`.
- `admin` and `system_admin` both land on the admin workspace by default.

## Default Role Redirects

When an authenticated user opens `/`, the app redirects them to:

| Role | Default destination |
| --- | --- |
| `user` | `/appointments` |
| `nurse` | `/doctor/dashboard` |
| `admin` | `/admin` |
| `system_admin` | `/admin` |

## Protected Route Redirects

1. Unknown paths are canonicalized back to `/`.
2. Unauthenticated access to patient workspace routes goes to `/login`.
3. Unauthenticated access to doctor workspace routes goes to `/doctor-sign-in`.
4. Unauthenticated access to admin workspace routes goes to `/admin-login`.
5. A patient hitting doctor or admin pages is redirected to `/appointments`.
6. A doctor hitting admin pages is redirected to `/doctor/dashboard`.
7. An admin hitting doctor pages is redirected to `/admin`.
8. Workspace URLs are canonicalized on initial load and browser back/forward navigation.

## Supported Legacy Aliases

These routes are still accepted and resolve to current workspace pages:

| Alias | Canonical destination |
| --- | --- |
| `/sign-in` | `/login` |
| `/signin` | `/login` |
| `/admin-sign-in` | `/admin-login` |
| `/admin_login` | `/admin-login` |
| `/admin/login` | `/admin-login` |
| `/doctor-login` | `/doctor-sign-in` |
| `/doctor-signin` | `/doctor-sign-in` |
| `/doctor-dashboard` | `/doctor/dashboard` |
| `/doctor_dashboard` | `/doctor/dashboard` |
| `/dashboard` | `/doctor/dashboard` |
| `/dashboard/analytics` | `/doctor/dashboard` |
| `/dashboard/clinical-reports` | `/doctor/dashboard` |
| `/dashboard/care-alerts` | `/doctor/dashboard` |
| `/dashboard/care-support` | `/doctor/dashboard` |
| `/dashboard/ledger-monitoring` | `/doctor/dashboard` |
| `/dashboard/intake-monitoring` | `/doctor/dashboard` |
| `/dashboard/security` | `/doctor/dashboard` |
| `/dashboard/user-management` | `/doctor/dashboard` |
| `/dashboard/clinical_reports` | `/doctor/dashboard` |
| `/dashboard/care_alerts` | `/doctor/dashboard` |
| `/dashboard/care_support` | `/doctor/dashboard` |
| `/dashboard/ledger_monitoring` | `/doctor/dashboard` |
| `/dashboard/intake_monitoring` | `/doctor/dashboard` |
| `/dashboard/user_management` | `/doctor/dashboard` |
| `/dashboard/doctor` | `/doctor/dashboard` |
| `/dashboard/doctor/dashboard` | `/doctor/dashboard` |
| `/dashboard/doctor/post-job` | `/doctor/dashboard` |
| `/dashboard/doctor/job-posts` | `/doctor/dashboard` |
| `/dashboard/doctor/applications` | `/doctor/dashboard` |
| `/dashboard/doctor/jobs` | `/doctor/dashboard` |
| `/dashboard/admin` | `/admin` |
| `/dashboard/admin/dashboard` | `/admin` |
| `/triage` | `/appointments` |
| `/worker` | `/appointments` |
| `/worker/dashboard` | `/appointments` |
| `/appointments/appointments` | `/appointments/history` |

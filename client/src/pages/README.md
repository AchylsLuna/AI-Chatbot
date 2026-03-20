# Pages Routing Notes

## File structure
- Canonical role pages live under:
  - `client/src/pages/patient`
  - `client/src/pages/doctor`
  - `client/src/pages/admin`
- Public/auth pages remain directly in `client/src/pages`.
- Legacy deep trees under `client/src/pages/dashboard/*` remain available but are not active routing entrypoints.
- Legacy deep trees are intentionally excluded from active app static checks (`typecheck`/`lint`) to keep maintenance scoped to canonical pages.

## Canonical doctor auth route
- `/doctor-sign-in`

## Canonical doctor app routes
- `/doctor/*`
- Primary dashboard entry: `/doctor/dashboard`

## Active sidebar tab routes
- Patient routes (`appointments`)
  - `booking_appointments` -> `/BookAppointment`
  - `history` -> `/History`
  - `profile` -> `/Profile`
  - `notifications` -> `/Notifications`
  - `settings` -> `/AccountSettings`
- Doctor dashboard (`doctor_dashboard`)
  - `dashboard` -> `/doctor/dashboard`
  - `appointments` -> `/doctor/appointments`
  - `calendar` -> `/doctor/calendar`
  - `schedule` -> `/doctor/schedule`
  - `queue` -> `/doctor/queue`
  - `analytics` -> `/doctor/analytics`
  - `settings` -> `/doctor/settings`
- Admin dashboard (`admin`)
  - `user_management` -> `/admin`
  - `staff_management` -> `/admin/staff-management`
  - `audit_log` -> `/admin/audit-log`
  - `error_log` -> `/admin/error-log`
  - `notifications` -> `/admin/notifications`
  - `settings` -> `/admin/settings`

## Deep links and history
- Sidebar tabs are deep-linkable on active pages, and URLs update on tab changes.
- Browser Back/Forward traverses prior sidebar tabs within the active area.
- Protected tab URLs are restored after login/OTP when access is granted.
- Forgot-password returns to the auth page that opened it when route state is available.
- Terms and privacy pages return to the signup page that opened them when route state is available.

## Compatibility aliases
- Legacy `/appointments/*` patient namespace routes remain supported and canonicalize to the new patient routes.
- Legacy `/dashboard/doctor/*` namespace routes remain supported as compatibility redirects.
- Legacy `/dashboard/admin/*` namespace routes remain supported as compatibility redirects.
- Historical sign-in aliases (`/sign-in`, `/signin`, `/admin-sign-in`, `/doctor-signin`) are normalized to canonical routes.

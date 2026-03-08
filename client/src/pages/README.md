# Pages Routing Notes

## File structure
- Canonical app pages live directly in `client/src/pages`.
- Legacy deep trees under `client/src/pages/dashboard/*` remain available but are not active routing entrypoints.
- Legacy deep trees are intentionally excluded from active app static checks (`typecheck`/`lint`) to keep maintenance scoped to canonical pages.

## Canonical doctor auth route
- `/doctor-sign-in`

## Canonical doctor app routes
- `/doctor/*`
- Primary dashboard entry: `/doctor/dashboard`

## Active sidebar tab routes
- Patient workspace (`appointments`)
  - `dashboard` -> `/appointments`
  - `appointments` -> `/appointments/appointments`
  - `notifications` -> `/appointments/notifications`
  - `settings` -> `/appointments/settings`
- Doctor workspace (`doctor_dashboard`)
  - `appointments` -> `/doctor/dashboard`
  - `queue` -> `/doctor/queue`
  - `analytics` -> `/doctor/analytics`
  - `settings` -> `/doctor/settings`
- Admin workspace (`admin`)
  - `user_management` -> `/admin`
  - `staff_management` -> `/admin/staff-management`
  - `audit_log` -> `/admin/audit-log`
  - `error_log` -> `/admin/error-log`
  - `notifications` -> `/admin/notifications`
  - `settings` -> `/admin/settings`

## Deep links and history
- Sidebar tabs are deep-linkable on active pages, and URLs update on tab changes.
- Browser Back/Forward traverses prior sidebar tabs within a workspace.
- Protected workspace tab URLs are restored after login/OTP when access is granted.

## Compatibility aliases
- Legacy `/dashboard/doctor/*` namespace routes remain supported as compatibility redirects.
- Legacy `/dashboard/admin/*` namespace routes remain supported as compatibility redirects.
- Historical sign-in aliases (`/sign-in`, `/signin`, `/admin-sign-in`, `/doctor-signin`) are normalized to canonical routes.

# API Reference

Base URL: `http://localhost:5000/api`

## Health
- `GET /health`
  - Response: `{ "ok": true }`

## Auth
- `POST /register`
- `POST /login`
  - Returns OTP challenge payload (`requires2FA`, `userId`) for OTP flow
- `POST /auth/otp/request`
  - Returns structured OTP challenge (`challengeId`, `username`, `expiresAt`, `expiresInSeconds`)
- `POST /verify-otp`
  - Request: `{ "userId": "...", "otp": "123456" }`
  - Response: `{ token, user }` where `user.role` is one of `user|nurse|admin|system_admin`
- `POST /resend-otp`
- `POST /logout`
- `GET /session`

## Appointments / Reservations
- `GET /appointments`
  - Response: `{ appointments: Reservation[] }`
- `POST /appointments`
  - Response: `{ reservation, ledgerEntry }`
- `PATCH /appointments/:id`
  - Supports partial updates for:
    - `requestedTime` (maps to `scheduledDate`)
    - `status`, `department`, `priority`, `summary`
  - Response: `{ appointment, ledgerEntry }`
- `GET /reservations`
  - Compatibility alias
  - Response: `{ reservations: Reservation[] }`

### Reservation shape
`Reservation` fields:
- `id`
- `patientName`
- `symptoms`
- `department`
- `priority` (`Low|Routine|High`)
- `confidence` (`0..1`)
- `requestedTime`
- `createdAt`
- `status` (`Booked|Recorded|Failed`)
- `summary`

## Settings
- `GET /users/me/settings`
- `PUT /users/me/settings`

## Admin / Support
- `GET /users`
- `GET /ledger`
  - Response: `{ ledger: LedgerEntry[] }`
- `GET /access-requests`
  - Response: `{ requests: AccessRequest[] }`
- `POST /audit/ai-alert-action`
  - Response: `{ "ok": true }`
- `GET /admin/audit-logs/download`
  - Downloads encrypted audit backup (`.zip.enc` stream)

## Authorization model
- `appointments` workspace: `user`
- `doctor` workspace (internal role): `nurse`
- admin workspace routes: `admin`, `system_admin`

## Route wiring
See `server/Routes/Routes.js` for middleware, validation, and RBAC enforcement.

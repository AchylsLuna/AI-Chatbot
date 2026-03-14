# Database Schema (MongoDB + Mongoose)

## users
Model: `server/Models/UserModel.js`

Key fields:
- `email` (unique)
- `firstName`, `lastName`
- `role`: `user|nurse|admin|system_admin`
- `status`: `active|disabled`
- `department`, `licenseUrl` (required when role is `nurse`)
- `passwordHashed`
- `otp`, `otpExpires`
- `settings.notifications.email|sms|push`
- timestamps

## sessions
Model: `server/Models/SessionModel.js`

Key fields:
- `userId`
- `token` (unique)
- `createdAt` with TTL (7 days)

## appointments
Model: `server/Models/AppointmentsModel.js`

Key fields:
- `patient` (User ref)
- `doctor` (User ref, optional)
- `scheduledDate`
- `status`: `Booked|Recorded|Failed`
- `department`
- `reason`
- `symptoms`
- `priority`: `Low|Routine|High`
- `confidence` (`0..1`)
- `summary`
- timestamps

Indexes:
- `{ patient: 1, createdAt: -1 }`
- `{ doctor: 1, createdAt: -1 }`

## ledgerentries
Model: `server/Models/LedgerEntryModel.js`

Key fields:
- `reservationId`
- `appointmentId`
- `patientName`
- `department`
- `timestamp`
- `hash` (unique)
- `txHash`
- `txStatus`: `confirmed|failed|skipped`
- `chainId`
- `action`: `CREATED_APPOINTMENT|UPDATED_APPOINTMENT`
- `actorUserId`
- `details`

## accessrequests
Model: `server/Models/AccessRequestModel.js`

Key fields:
- `fullName`
- `email`
- `organization`
- `roleRequested`
- `status`: `pending|approved|rejected`
- `notes`
- `reviewedAt`
- timestamps

## auditlogs
Model: `server/Models/AuditLogModel.js`

Key fields:
- `userId`
- `action`
- `details`
- `ipAddress`
- `userAgent`
- `timestamp` with TTL (60 days)

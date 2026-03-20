# Troubleshooting Guide

## Quick Diagnostics

1. Verify server env:
   - `server/.env` must include: `MONGO_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, `BACKUP_PASSWORD`, `EMAIL_USER`, `EMAIL_PASS`.
2. Start backend from `server/`:
   - `npm install`
   - `npm run dev`
3. Start frontend from `client/`:
   - `npm install`
   - `npm run dev`
4. Confirm API base URL in frontend:
   - `VITE_API_URL` (defaults to `http://localhost:5000/api`).
5. Confirm MongoDB is reachable from backend host.

## Server Won't Start

### Symptom
- Process exits immediately with `MONGO_URI is not defined`.

### Cause
- `server/server.js` exits if `process.env.MONGO_URI` is missing.

### Fix
- Add `MONGO_URI` to `server/.env`.
- Restart backend.

## MongoDB Connection Fails

### Symptom
- Backend logs `Failed to connect to DB`.

### Common causes
- Wrong `MONGO_URI`.
- Network/firewall blocks DB host.
- Credentials/authSource mismatch.

### Fix
1. Test URI against your MongoDB instance.
2. Ensure allowlist/network access is configured.
3. Restart backend after `.env` changes.

Note: server currently connects with hardcoded DB name `hospital_ai_blockchain` in `server/server.js` (it does not read `DB_NAME` there).

## CORS / Cookie Auth Issues

### Symptom
- Browser shows CORS errors.
- Login appears successful, then protected routes return `Authentication required.`.

### Cause
- `CLIENT_ORIGIN` does not match frontend origin.
- Browser is not sending cookies cross-origin.

### Fix
1. Set backend `CLIENT_ORIGIN` to exact frontend origin (example: `http://localhost:5173`).
2. Keep frontend requests using `credentials: 'include'` (already set in `client/src/services/api.ts`).
3. Keep backend CORS `credentials: true` (already set in `server/server.js`).

## Login Fails or Gets Rate-Limited

### Symptom
- `Wrong password or Email. Please try again.`
- `Too many login attempts, please try again after 15 minutes.`

### Cause
- Invalid credentials.
- Login limiter in `server/Middleware/rateLimiter.js` allows 5 attempts per 15 minutes.

### Fix
- Wait 15 minutes or test from a different IP in development.
- Verify seeded user credentials.

## Registration Fails

### Symptoms
- `Email is invalid`
- `Password must be at least 8 characters, include uppercase, lowercase, number, and a special character.`
- `Email is already registered.`

### Causes
- Password complexity checks fail.
- Email already exists.

### Fix
1. Use a compliant password (8+ chars, upper/lowercase, number, special character).
2. Sign in instead of re-registering an existing account.

## OTP Not Received / OTP Verification Fails

### Symptoms
- `Failed to send OTP. Please try again.`
- `Invalid OTP.`
- `OTP has expired. Please login again.`

### Causes
- SMTP credentials invalid.
- OTP expired (10-minute TTL).
- Using stale `userId` for verification.

### Fix
1. Verify `EMAIL_USER` and `EMAIL_PASS`.
2. Re-login to generate a fresh OTP.
3. Use returned `userId` from `/login` when calling `/verify-otp`.

Implementation note: `server/Utils/emailService.js` uses Gmail transport and sends `from: process.env.EMAIL_HOST` (name is misleading; value should be a valid sender email).

## "Invalid or expired token" / "Session expired"

### Symptoms
- `Invalid or expired token.`
- `Session expired. Please log in again.`

### Causes
- JWT invalid/expired.
- Session record missing in `Sessions` collection.
- `JWT_SECRET` changed after token issuance.

### Fix
1. Login again to create new JWT + session record.
2. Ensure consistent `JWT_SECRET` across restarts/nodes.
3. Do not manually delete active sessions in DB unless intended.

If `JWT_SECRET` is missing, OTP verification can fail when signing tokens in `server/Controllers/UserController.js`. Set `JWT_SECRET` in `server/.env`.

## Authorization Errors (403)

### Symptom
- `You do not have permission to perform this action.`

### Cause
- Role blocked by RBAC in `server/Middleware/rbacMiddleware.js`.

### Fix
- Verify user `role` in DB.
- Use an `admin` role account for:
  - `/admin/audit-logs/download`
  - `/admin/archive/appointments`
- Use `user` role for creating appointments.

## Appointment Creation Fails

### Common errors
- `Appointment date must be in the future.`
- `You already have an active appointment. Please complete or cancel it first.`
- `You cannot book an appointment with yourself.`

### Cause
- Validation and business rules in `server/Controllers/AppointmentsController.js`.

### Fix
1. Send future `scheduledDate` (ISO-8601).
2. Ensure patient has no `Pending`/`Confirmed` appointment.
3. Use role `user` for appointment creation.

## Doctor Registration Upload Fails

### Symptom
- `Invalid file type. Only JPG, PNG, and PDF are allowed.`
- `File is too large. Maximum size is 5MB.`
- `File upload failed.`

### Cause
- Multer constraints in `server/Middleware/uploadMiddleware.js`.

### Fix
- Upload only `jpg/jpeg/png/pdf`.
- Keep file <= 5MB.
- Ensure `uploads/licenses/` path exists and is writable.

## Admin Audit Backup Download Fails

### Symptoms
- `No audit logs found to backup.`
- `Failed to generate backup.`

### Causes
- No rows in `AuditLog`.
- Missing/incorrect `BACKUP_PASSWORD`.
- Stream/archive failure.

### Fix
1. Generate audit events (login/logout, RBAC events).
2. Set strong `BACKUP_PASSWORD`.
3. Retry with admin-authenticated session.

## Decrypting `audit_logs_backup.zip.enc` Fails

### Symptom
- Decrypt script throws cipher/final errors or output ZIP is invalid.

### Causes
- Wrong password.
- Corrupted/incomplete downloaded file.

### Fix
1. Set `BACKUP_PASSWORD` to the same value used by the server at backup time.
2. Run `node decrypt_backup/decrypt_backup.js <input.enc> <output.zip>`.
3. Re-download the backup if authentication fails during decrypt.

Note: backups now use a versioned AES-256-GCM envelope with authenticated metadata, random salt, and random IV. Do not edit any bytes in the `.enc` file.

## Frontend "Cannot reach API server"

### Symptom
- Error: `Cannot reach API server. Start the backend and verify your API URL.`

### Cause
- Backend down or wrong `VITE_API_URL`.

### Fix
1. Start backend on expected port (default 5000).
2. Set frontend `VITE_API_URL` to actual API base.

## Frontend Schema Validation Errors

### Symptom
- Error like `Invalid ... response (...)` from Zod parser.

### Common causes in current codebase
- Client expects endpoints not currently wired in `server/Routes/Routes.js`:
  - `GET /reservations`
  - `GET /ledger`
  - `GET /access-requests`
  - `POST /audit/ai-alert-action`
  - `PATCH /appointments/:id`
- Role mismatch (`doctor` vs client role enum `user|doctor|admin|system_admin`).

### Fix
1. Prefer currently implemented endpoints (`/appointments`, `/session`, auth routes, admin backup/archive routes).
2. Align client schemas/routes with server outputs.
3. Keep role mapping consistent across server responses and client schemas.

## Google OAuth Issues

### Symptom
- OAuth login fails or callback returns to failure page.

### Causes
- Missing `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
- Incorrect callback URI registration.

### Fix
1. Set OAuth env vars in backend.
2. Register callback URL to match:
   - `/api/auth/google/callback` relative to backend host.

## Script/Seed Account Gotchas

### `npm run create-admin`
- Creates fixed account in `server/scripts/createAdmin.js`.
- If account already exists, script exits with message.

### `npm run create-doctor`
- Script logs "Role: doctor" but currently creates role `admin` in code (`server/scripts/createDoctor.js`).
- Update script if you need a true doctor role path.

## Logs and Where to Look

- API startup and runtime logs: terminal running `server/server.js`.
- Auth/RBAC denials: `AuditLog` entries plus server warnings.
- Client runtime/network errors: browser devtools console + network tab.

## If You Need to Report an Issue

Include:
1. Exact request path and method.
2. HTTP status + response body.
3. Server log lines at failure time.
4. Relevant env vars (redact secrets).
5. Repro steps from clean login/session.

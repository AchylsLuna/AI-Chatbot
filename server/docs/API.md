# API Reference

Base URL: `http://localhost:5000/api`
This document maps public API endpoints to server routes and controller handlers. For route wiring see [server/Routes/Routes.js].

**Authentication**
- POST /register — Register new user  
  Controller: [`register`] in [server/Controllers/UserController.js]
- POST /login — Login (returns session or OTP challenge)  
  Controller: [`login`] in [server/Controllers/UserController.js]
- POST /verify-otp — Verify one-time passcode (OTP)  
  Controller: [`verifyOTP`] in [server/Controllers/UserController.js]
- POST /logout — End session / clear cookies  
  Controller: [`logout`] in [server/Controllers/UserController.js]

**Appointments / Reservations**
- GET /appointments — List appointments for current session user  
  Route: [server/Routes/Routes.js] -> Controller: [`getAppointments`] in [server/Controllers/AppointmentsController.js]
- POST /appointments — Create appointment (validated)  
  Route: [server/Routes/Routes.js] -> Controller: [`createAppointment`] in [server/Controllers/AppointmentsController.js]
- PATCH /appointments/:id — Update appointment (partial)  
  Route: [server/Routes/Routes.js]-> controller (appointments update handler) — see [server/Controllers/AppointmentsController.js]

**Admin / Audit**
- GET /admin/audit-logs/download — Download encrypted audit backup (admin only)  
  Route: [server/Routes/Routes.js] -> Controller: [`downloadAuditBackup`] in [server/Controllers/adminController.js] 
  Note: backup is a ZIP encrypted with AES-256; IV is written first in the stream. Decrypt helper: [decrypt_backup/decrypt_backup.js]
- POST /admin/archive/appointments — Trigger archival of old appointments (admin only)  

**User & Admin utility endpoints**
- GET /users — List users (admin/doctor)  
  Route: [server/Routes/Routes.js]
- GET /ledger — Ledger entries (admin)  
  Called by client via [client/src/services/api.ts]
- GET /access-requests, POST /audit/ai-alert-action, etc. — See client schema callers in [client/src/services/api.ts] and server route wiring in [server/Routes/Routes.js].

**Models referenced**
- Users: [server/Models/UserModel.js] (`User`)
- Appointments: [server/Models/AppointmentsModel.js] (`Appointments`)
- Audit logs: [server/Models/AuditLogModel.j (`AuditLog`)

**Schemas & validation**
- Request/response validation used by the client is defined in [client/src/schemas/apiSchemas.ts].
- Routes use express-validator middleware configured in [server/Routes/Routes.js].

**How the client calls the API**
- Client base URL and helpers: [client/src/services/api.ts] (see `API_BASE` and `request` helpers).
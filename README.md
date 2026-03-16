# Hospital AI & Blockchain Server

A secure backend and UI for appointment booking, staff dashboards, and audit-backed operations.

**Highlights**
- Auth: Local login, OTP (email) and role-based access (User, Doctor, Admin, Super Admin). See controllers: [server/Controllers/UserController.js].
- Role-based dashboards: User appointments, Doctor/Admin dashboard, Admin dashboard. Client routing and access control in [client/src/config/accessControl.ts].
- Audit logging and encrypted backups: admin download implemented in [server/Controllers/adminController.js]. Decrypt helper in [decrypt_backup/decrypt_backup.js].
- Appointment archival service: [server/Utils/archiveService.js] with a script at [server/scripts/runArchiveAppointments.js].

**Quickstart (development)**
1. MongoDB: provide a running MongoDB and set `MONGO_URI`.
2. Server
   - cd server
   - npm install
   - copy `.env` values
   - npm run dev
3. Client
   - cd client
   - npm install
   - npm run dev

**Important files**
- API routes: [server/Routes/Routes.js]
- Server entry: [server/server.js]
- Client API helpers: [client/src/services/api.ts]

**Scripts**
- Start server (dev): `npm run dev` (server/)
- Start client (dev): `npm run dev` (client/)

**Docs**
- API: [docs/API.md] 
- Deployment: [docs/DEPLOYMENT.md]
- Maintenance: [docs/MAINTENANCE.md]
- Security: [docs/SECURITY.md]

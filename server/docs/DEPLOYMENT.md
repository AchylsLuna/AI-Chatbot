# Deployment

This project is a two-part app: an Express API server (server/) and a Vite React client (client/). See startup wiring in [server/server.js].

**Prerequisites**
- Node.js 18+
- MongoDB (Atlas or self-hosted) with network access
- SMTP credentials for email OTP (configured via env)

**Key environment variables (server/.env)**
- MONGO_URI — MongoDB connection string
- DB_NAME — DB name 
- PORT — server port (default 5000)  
- CLIENT_ORIGIN — allowed client origin for CORS (set to your front-end URL)  
- BACKUP_PASSWORD — password used to encrypt audit backups (rotate frequently)  
- EMAIL_USER, EMAIL_PASS, EMAIL_HOST — SMTP settings used by [server/Utils/emailService.js]

**Install & run (development)**
1. Server
   - cd server
   - npm install
   - set .env file
   - npm run dev
2. Client
   - cd client
   - npm install
   - npm run dev

**Production build suggestions**
- Build client: cd client && npm run build — deploy `dist/` to static host / CDN (or serve via reverse proxy).
- Configure server env variables for production, including secure BACKUP_PASSWORD and SMTP creds.
- Run server using a process manager (pm2, systemd, Docker). Use `npm start` to run the built server script ([server/package.json]).

**Database & backups**
- Use managed snapshots (Atlas) or regular `mongodump` exports.
- Use the audit log backup endpoint ([server/Controllers/adminController.js#downloadAuditBackup]) to produce an encrypted ZIP; do not commit `audit_logs_backup.zip.enc` (it's in [.gitignore]).

**Scripts**
- Create admin user (dev): `npm run create-admin` in `server/` (see [server/scripts/createAdmin.js])
- Archive appointments (maintenance): `node server/scripts/runArchiveAppointments.js` (see [server/scripts/runArchiveAppointments.js] and [server/Utils/archiveService.js])
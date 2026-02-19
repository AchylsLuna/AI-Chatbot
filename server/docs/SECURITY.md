# Security Overview

This project includes layered protections and operational guidance.

**Built-in protections**
- HTTP security headers via Helmet: configured in [server/server.js].
- NoSQL injection protection: `express-mongo-sanitize` used in [server/server.js].
- Input validation: express-validator used per-route in [server/Routes/Routes.js].
- RBAC middleware logs and enforces role checks: [server/Middleware/rbacMiddleware.js].
- Password hashing: bcrypt is used in the user model [server/Models/UserModel.js] (see `setPassword` usage in scripts).
- MFA: implemented via email OTP using`nodemailer` helper [server/Utils/emailService.js].

**Sensitive data & backups**
- Audit backups produced by admin endpoint are encrypted with AES-256 before download. See [`downloadAuditBackup`] in [server/Controllers/adminController.js]. The repo includes a local decrypt helper [decrypt_backup/decrypt_backup.js] for authorized operators.
- Keep `BACKUP_PASSWORD` out of source control and rotate regularly.

**Recommendations & operational guidance**
- Run the server under a dedicated service account (non-root) and use a process supervisor (systemd/pm2/docker).
- Secure SMTP credentials used by [server/Utils/emailService.js].
- Enforce strong secrets for admin accounts; change default credentials immediately (see [server/scripts/createAdmin.js]).
- Monitor audit logs and alert on suspicious patterns (frequent ACCESS_DENIED events from the same IP, role escalation attempts).
- Disable or tightly control the audit-download endpoint in production (limit to secure admin sessions and IP allowlists).

**Incident response**
- Revoke compromised credentials and rotate BACKUP_PASSWORD and DB credentials.
- Revoke API tokens/sessions and force password reset for affected users.
- Preserve logs and backups for forensic analysis.

**Relevant code locations**
- Server entry: [server/server.js]  
- Route definitions: [server/Routes/Routes.js]  
- RBAC: [server/Middleware/rbacMiddleware.js]  
- Audit backup: [server/Controllers/adminController.js]  
- Email helper: [server/Utils/emailService.js]  
- Archive service: [server/Utils/archiveService.js]
# Security Summary

## Overview

This document summarizes the primary security controls and areas of interest for the AI-Chatbot project. It points to the code and configuration locations where authentication, authorization, secrets, logging, and other security-relevant functionality live.

## Key Security Controls

- **Authentication:** Implemented server-side via Passport in `server/Config/passport.js`. Client auth flows live in `client/services/authProvider.ts` and UI pages under `client/pages/*`.
- **Authorization / RBAC:** Role-based access controls in `server/Middleware/rbacMiddleware.js` and client-side role helpers in `client/utils/roles.ts` and `client/config/accessControl.ts`.
- **Rate limiting & Abuse Protection:** Request throttling implemented in `server/Middleware/rateLimiter.js`.
- **Session Management:** Sessions and session model handled in `server/Models/SessionModel.js` (session cookie/config considerations apply).
- **Input Validation & Sanitization:** Server controllers should validate inputs (see `server/Controllers/*`). Client sanitization helpers in `client/utils/sanitize.ts`.
- **File Upload Safety:** Upload handling and validation in `server/Middleware/uploadMiddleware.js` — validate types/sizes and store safely.
- **Audit & Logging:** Audit logging model and usage in `server/Models/AuditLogModel.js` and relevant controllers.
- **Secrets & Configuration:** Environment secrets in `server/.env`. Avoid committing secrets; rotate keys if exposed.
- **Backups & Encryption:** Encrypted backup artifact at `decrypt_backup/audit_logs_backup.zip.enc` and helper `decrypt_backup/decrypt_backup.js`.
- **Email / Outbound Services:** Email logic in `server/Utils/emailService.js` — avoid leaking PII in messages.
- **Dependencies & Supply Chain:** See `server/package.json` and `client/package.json` for dependency lists — run periodic dependency scans.

## Locations (quick reference)

- Server config and auth: `server/Config/passport.js`, `server/Middleware/*`, `server/Routes/Routes.js`
- Controllers and models: `server/Controllers/*`, `server/Models/*`
- Scripts that can create privileged accounts: `server/scripts/createAdmin.js`, `server/scripts/createDoctor.js`
- Client controls: `client/config/accessControl.ts`, `client/services/authProvider.ts`, `client/utils/*`
- Documentation: `docs/SECURITY.md`

## Recommended Next Steps

1. Ensure `server/.env` is NOT committed and rotate any keys if found in VCS.
2. Add automated dependency scanning (Snyk, Dependabot, or `npm audit` in CI).
3. Harden HTTP headers (use `helmet`), enable CSP, and enforce HTTPS in production.
4. Ensure session cookies are `Secure`, `HttpOnly`, and use proper sameSite settings.
5. Add input validation libraries and centralized request validation on server endpoints.
6. Add automated SAST / linter rules to catch insecure patterns (e.g., eval, unsanitized DB queries).
7. Review `server/scripts/*` for safe execution and limit access to running scripts.
8. Periodically review and redact logs to avoid PII in audit trails and emails.

## Contact / Ownership

For security issues, contact the repository owners or the engineering lead listed in the project README. Treat any suspected secret exposure as high priority.

---
Generated summary for quick reference. For a deeper review, I can run a light static scan or expand `docs/SECURITY.md` with detailed procedures.

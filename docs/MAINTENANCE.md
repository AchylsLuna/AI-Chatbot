# Maintenance Runbook

## Regular operations
- Keep dependencies updated in `server/package.json`.
- Monitor MongoDB storage, indexes, and backup health.
- Rotate secrets (`JWT_SECRET`, `BACKUP_PASSWORD`, SMTP credentials).

## Data migration
- Run role/status normalization safely (idempotent):
  - `npm run backend:migrate`
- Migration actions:
  - `doctor -> nurse`
  - appointment status remap to `Booked|Recorded|Failed`
  - backfill normalized appointment fields

## Core seed users
- Seed/update core accounts safely (idempotent):
  - `npm run backend:seed`
- Seed roles:
  - `admin` or `system_admin`
  - `nurse` (doctor-equivalent)
  - `user`

## Audit backups
- Endpoint: `GET /api/admin/audit-logs/download`
- Output: encrypted `.zip.enc` stream.
- Ensure `BACKUP_PASSWORD` is managed securely and rotated.

## Troubleshooting
- `401` responses:
  - verify token/cookie and active session in `Sessions` collection.
- `403` responses:
  - verify role against RBAC policy.
- OTP delivery issues:
  - validate SMTP env vars and provider restrictions.
- Empty datasets:
  - expected behavior for `ledger`/`access-requests` when no records exist.

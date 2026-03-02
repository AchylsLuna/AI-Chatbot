# Maintenance & Operations

**Regular tasks**
- Database backups: schedule regular `mongodump` or provider snapshots. Keep backups encrypted and rotate encryption keys.
- Rotate secrets: BACKUP_PASSWORD, JWT keys, SMTP credentials, and DB accounts periodically.
- Patch dependencies: monitor `npm audit` and update server/client dependencies in [server/package.json] and [client/package.json].

**Audit & logs**
- Audit events are written via the `AuditLog` model ([server/Models/AuditLogModel.js]). RBAC denied attempts are logged by [server/Middleware/rbacMiddleware.js].
- Use the admin encrypted backup endpoint to export audit logs: [`downloadAuditBackup`] in [server/Controllers/adminController.js]. Backups are encrypted AES-256; IV is prepended to the stream.

**Archival**
- Archive old appointments using the archive service: [`archiveOldAppointments`] in [server/Utils/archiveService.js].
- Run scheduled archival with the helper script: [server/scripts/runArchiveAppointments.js] (supports `--dry` and `--days`).

**Recovery & decryption**
- Encrypted audit backup files are compatible with the repo helper: [decrypt_backup/decrypt_backup.js]. Keep the BACKUP_PASSWORD secure; do not store it in plaintext in the repository.

**Health checks & monitoring**
- Monitor app logs, DB replication health, and SMTP connectivity.
- Ensure disk space for temp archives and log rotation.

**Maintenance windows**
- Schedule downtime for major schema migrations or bulk operations.
- Before mass archive or restore, create DB backup and note current DB `oplog` / timestamps.
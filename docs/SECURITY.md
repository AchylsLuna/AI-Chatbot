# Security Notes

## Built-in controls
- Helmet security headers
- Mongo sanitize middleware
- Route-level input validation (`express-validator`)
- JWT + session-backed auth validation
- RBAC enforcement with denied-access audit logging
- Password hashing via bcrypt
- OTP-based login completion

## Role model
Canonical backend roles:
- `user`
- `nurse` (doctor-equivalent)
- `admin`
- `system_admin`

Legacy `doctor` role values are normalized to `nurse`.

## Sensitive operations
- Audit backup endpoint is admin-restricted and encrypted.
- Access denied attempts are logged via audit middleware.

## Operational safeguards
- Keep secrets out of source control.
- Restrict CORS to known frontend origin.
- Use HTTPS in production.
- Rotate admin credentials and backup encryption password regularly.
- Limit admin endpoint exposure with network controls where possible.

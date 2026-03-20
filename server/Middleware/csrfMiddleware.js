import AuditLog from "../Models/AuditLogModel.js";
import { CSRF_COOKIE_NAME, hashCsrfToken } from "../Utils/authSecurity.js";

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export const requireCsrf = async (req, res, next) => {
    try {
        if (!MUTATING_METHODS.has(String(req.method || '').toUpperCase())) {
            return next()
        }

        if (req.authTokenSource === 'bearer') {
            return next()
        }

        const session = req.authSession
        if (!session) {
            return res.status(401).json({ message: 'Authentication required.' })
        }

        const csrfHeader = String(req.headers['x-csrf-token'] || '').trim()
        const csrfCookie = String(req.cookies?.[CSRF_COOKIE_NAME] || '').trim()
        const expectedHash = session.csrfTokenHash

        const isValid =
            csrfHeader &&
            csrfCookie &&
            csrfHeader === csrfCookie &&
            hashCsrfToken(csrfHeader) === expectedHash

        if (isValid) {
            return next()
        }

        await AuditLog.create({
            userId: req.user?.id || req.user?._id,
            action: 'CSRF_REJECTED',
            details: `CSRF validation failed for ${req.method} ${req.originalUrl}.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        }).catch(() => {})

        return res.status(403).json({ message: 'Invalid security token.' })
    } catch (error) {
        return next(error)
    }
}

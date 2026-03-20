import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import AuthExchange from "../Models/AuthExchangeModel.js";
import Sessions from "../Models/SessionModel.js";
import { appConfig } from "../Config/env.js";
import { hashSessionToken } from "./sessionTokens.js";
import { normalizeRole } from "./roles.js";

const SESSION_DURATIONS_MS = Object.freeze({
    user: 7 * 24 * 60 * 60 * 1000,
    doctor: 24 * 60 * 60 * 1000,
    admin: 24 * 60 * 60 * 1000,
    system_admin: 24 * 60 * 60 * 1000,
})

const SESSION_INACTIVITY_MS = 12 * 60 * 60 * 1000
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000
const GOOGLE_OAUTH_STATE_EXPIRY_SECONDS = 10 * 60
const GOOGLE_EXCHANGE_EXPIRY_MS = 5 * 60 * 1000

export const TOKEN_COOKIE_NAME = 'token'
export const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
export const GOOGLE_CODE_QUERY_PARAM = 'google_code'
export const GOOGLE_ERROR_QUERY_PARAM = 'google_error'

export const hashCsrfToken = (token) =>
    crypto.createHash("sha256").update(String(token || "")).digest("hex");

const hashExchangeCode = (code) =>
    crypto.createHash("sha256").update(String(code || "")).digest("hex");

export const getSessionDurationMsForRole = (role) => {
    const normalizedRole = normalizeRole(role) || 'user'
    return SESSION_DURATIONS_MS[normalizedRole] || SESSION_DURATIONS_MS.user
}

export const getSessionInactivityMs = () => SESSION_INACTIVITY_MS

export const buildSessionCookieOptions = (maxAgeMs, options = {}) => ({
    httpOnly: true,
    secure: options.isProduction ?? appConfig.isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeMs,
})

export const buildCsrfCookieOptions = (maxAgeMs, options = {}) => ({
    httpOnly: false,
    secure: options.isProduction ?? appConfig.isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeMs,
})

export const clearAuthCookies = (res) => {
    res.clearCookie(TOKEN_COOKIE_NAME, buildSessionCookieOptions(0))
    res.clearCookie(CSRF_COOKIE_NAME, buildCsrfCookieOptions(0))
}

const generateSessionToken = (user) => {
    const normalizedRole = normalizeRole(user?.role) || 'user'
    const expiresInSeconds = Math.floor(getSessionDurationMsForRole(normalizedRole) / 1000)

    return jwt.sign(
        { id: user._id, role: normalizedRole, email: user.email },
        appConfig.jwtSecret,
        { expiresIn: expiresInSeconds }
    )
}

export const createSessionRecord = async (user, token, options = {}) => {
    const normalizedRole = normalizeRole(user?.role) || 'user'
    const now = options.now instanceof Date ? options.now : new Date()
    const maxAgeMs = getSessionDurationMsForRole(normalizedRole)
    const csrfToken = crypto.randomBytes(32).toString('hex')
    const session = await Sessions.create({
        userId: user._id,
        tokenHash: hashSessionToken(token),
        csrfTokenHash: hashCsrfToken(csrfToken),
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + maxAgeMs),
    })

    return {
        session,
        csrfToken,
        maxAgeMs,
    }
}

export const issueAuthenticatedSession = async (res, user, options = {}) => {
    const token = generateSessionToken(user)
    const { session, csrfToken, maxAgeMs } = await createSessionRecord(user, token, options)

    res.cookie(TOKEN_COOKIE_NAME, token, buildSessionCookieOptions(maxAgeMs))
    res.cookie(CSRF_COOKIE_NAME, csrfToken, buildCsrfCookieOptions(maxAgeMs))

    return {
        token,
        csrfToken,
        session,
        maxAgeMs,
    }
}

export const ensureSessionCsrfToken = async (req, res, session) => {
    const csrfCookie = String(req.cookies?.[CSRF_COOKIE_NAME] || '').trim()
    if (csrfCookie && hashCsrfToken(csrfCookie) === session.csrfTokenHash) {
        return csrfCookie
    }

    const csrfToken = crypto.randomBytes(32).toString('hex')
    session.csrfTokenHash = hashCsrfToken(csrfToken)
    await session.save()
    const maxAgeMs = Math.max(1000, new Date(session.expiresAt).getTime() - Date.now())
    res.cookie(CSRF_COOKIE_NAME, csrfToken, buildCsrfCookieOptions(maxAgeMs))
    return csrfToken
}

export const isSessionExpired = (session, now = Date.now()) => {
    if (!session) return true

    const absoluteExpiry = new Date(session.expiresAt || 0).getTime()
    if (!Number.isFinite(absoluteExpiry) || absoluteExpiry <= now) {
        return true
    }

    const lastSeenAt = new Date(session.lastSeenAt || session.createdAt || 0).getTime()
    if (!Number.isFinite(lastSeenAt) || lastSeenAt + SESSION_INACTIVITY_MS <= now) {
        return true
    }

    return false
}

export const touchSessionIfNeeded = async (session, now = new Date()) => {
    const lastSeenAt = new Date(session.lastSeenAt || session.createdAt || 0).getTime()
    if (Number.isFinite(lastSeenAt) && now.getTime() - lastSeenAt < SESSION_TOUCH_INTERVAL_MS) {
        return session
    }

    session.lastSeenAt = now
    await session.save()
    return session
}

export const createGoogleOauthState = (sourcePage = 'login') =>
    jwt.sign(
        {
            purpose: 'google_oauth_state',
            sourcePage,
            nonce: crypto.randomBytes(12).toString('hex'),
        },
        appConfig.jwtSecret,
        { expiresIn: GOOGLE_OAUTH_STATE_EXPIRY_SECONDS }
    )

export const readGoogleOauthState = (state) => {
    const payload = jwt.verify(String(state || ''), appConfig.jwtSecret)
    if (payload?.purpose !== 'google_oauth_state') {
        throw new Error('Invalid OAuth state.')
    }

    const sourcePage = payload?.sourcePage
    if (sourcePage !== 'login' && sourcePage !== 'doctor_login' && sourcePage !== 'admin_login') {
        return 'login'
    }

    return sourcePage
}

export const createGoogleAuthExchange = async (userId, sourcePage = 'login') => {
    const exchangeCode = crypto.randomBytes(32).toString('hex')
    await AuthExchange.create({
        userId,
        codeHash: hashExchangeCode(exchangeCode),
        sourcePage,
        expiresAt: new Date(Date.now() + GOOGLE_EXCHANGE_EXPIRY_MS),
    })

    return exchangeCode
}

export const consumeGoogleAuthExchange = async (exchangeCode) => {
    if (!exchangeCode) return null

    return AuthExchange.findOneAndDelete({
        codeHash: hashExchangeCode(exchangeCode),
        expiresAt: { $gt: new Date() },
    })
}

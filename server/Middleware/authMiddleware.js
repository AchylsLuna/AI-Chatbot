import jwt from "jsonwebtoken";
import Sessions from "../Models/SessionModel.js";
import { appConfig } from "../Config/env.js";
import { hashSessionToken } from "../Utils/sessionTokens.js";
import { normalizeRole } from "../Utils/roles.js";
import {
    clearAuthCookies,
    isSessionExpired,
    touchSessionIfNeeded,
} from "../Utils/authSecurity.js";

const verifyToken = async (req, res, next) => {
    // Check for token in Authorization header or cookies
    let token = req.cookies?.token;
    let tokenSource = token ? 'cookie' : null
    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
            tokenSource = 'bearer'
        }
    }
    if (!token) {
        return res.status(401).json({ message: "Authentication required." });
    }
    try {
        const decoded = jwt.verify(token, appConfig.jwtSecret);
        const activeSession = await Sessions.findOne({
            tokenHash: hashSessionToken(token),
        });
        if (!activeSession) {
            clearAuthCookies(res)
            return res.status(401).json({ message: "Session expired. Please log in again." });
        }

        if (isSessionExpired(activeSession)) {
            await Sessions.deleteOne({ _id: activeSession._id }).catch(() => {})
            clearAuthCookies(res)
            return res.status(401).json({ message: "Session expired. Please log in again." });
        }

        await touchSessionIfNeeded(activeSession)

        req.user = {
            ...decoded,
            id: decoded?.id || decoded?._id || activeSession.userId?.toString?.(),
            role: normalizeRole(decoded?.role) || 'user',
            sessionId: activeSession._id?.toString?.(),
        };
        req.authSession = activeSession
        req.authTokenSource = tokenSource
        next();
    } catch (error) {
        clearAuthCookies(res)
        res.status(401).json({ message: "Invalid or expired token." });
    }
}

export default verifyToken;

import jwt from "jsonwebtoken";
import Sessions from "../Models/SessionModel.js";
import { appConfig } from "../Config/env.js";

const verifyToken = async (req, res, next) => {
    // Check for token in Authorization header or cookies
    let token = req.cookies?.token;
    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }
    if (!token) {
        return res.status(401).json({ message: "Authentication required." });
    }
    try {
        const decoded = jwt.verify(token, appConfig.jwtSecret);
        const activeSession = await Sessions.findOne({ token: token });
        if (!activeSession) {
            return res.status(401).json({ message: "Session expired. Please log in again." });
        }

        const rawRole = decoded?.role;
        const normalizedRole = rawRole === "doctor" ? "nurse" : rawRole;

        req.user = {
            ...decoded,
            id: decoded?.id || decoded?._id || activeSession.userId?.toString?.(),
            role: normalizedRole,
            sessionId: activeSession._id?.toString?.(),
        };
        next();
    } catch (error) {
        res.status(401).json({ message: "Invalid or expired token." });
    }
}

export default verifyToken;

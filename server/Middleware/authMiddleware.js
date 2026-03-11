import jwt from "jsonwebtoken";
import Sessions from "../Models/SessionModel.js";

const verifyToken = async (req, res, next) => {
    const jwtSecret = String(process.env.JWT_SECRET || '').trim();
    if (!jwtSecret) {
        return res.status(500).json({ message: "Server authentication is not configured." });
    }

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
        const decoded = jwt.verify(token, jwtSecret);
        const activeSession = await Sessions.findOne({token:token});
        if (!activeSession) {
            return res.status(401).json({ message: "Session expired. Please log in again."});
        }
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: "Invalid or expired token." });
    }
}

export default verifyToken;
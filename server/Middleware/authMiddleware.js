import jwt from "jsonwebtoken";
import Sessions from "../Models/SessionModel.js";

const verifyToken = async (req, res, next) => {
    // Check for token in Authorization header or cookies
    let token = req.cookies?.token;
    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }e
    }
    if (!token) {
        return res.status(401).json({ message: "Authentication required." });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
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
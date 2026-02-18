import User from "../Models/UserModel.js";
import AuditLog from "../Models/AuditLogModel.js";

export async function getAllUsers(req, res) {
    try {
        const users = await User.find().select("-passwordHashed -otp -otpExpires");

        await AuditLog.create({
            userId: req.user._id, // Taken from authMiddleware
            action: "GET_USERS_SUCCESS",
            details: `${req.user.role.toUpperCase()} | ${req.user.email} successfully retrieved ${users.length} user records.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        });
        await auditLog.save();
        return res.status(200).json(users);
    } catch (error) {
        console.error("Failed to get users:", error);
        return res.status(500).json({ message: "Failed to retrieve users." });
    }
}
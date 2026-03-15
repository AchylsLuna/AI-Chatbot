import AuditLog from "../Models/AuditLogModel.js";
import User from "../Models/UserModel.js";

const resolveRequesterEmail = async (req) => {
    if (req.user?.email) return req.user.email;
    const userId = req.user?.id || req.user?._id;
    if (!userId) return 'Unknown';

    try {
        const user = await User.findById(userId).select('email').lean();
        return user?.email || 'Unknown';
    } catch {
        return 'Unknown';
    }
};

export const authorizeRoles = (...allowedRoles) => {
    return async (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            const requesterEmail = await resolveRequesterEmail(req);

            //Logs if user is denied
            await AuditLog.create({
                userId: req.user?.id || req.user?._id,
                action: "ACCESS_DENIED",
                details: `User ${requesterEmail} tried to access ${req.originalUrl} but lacks permissions.`,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });
            
            console.warn(`[RBAC] Unauthorized access attempt by user ${req.user?.id || req.user?._id || 'unknown'} to ${req.originalUrl}`);
            return res.status(403).json({ 
                message: "You do not have permission to perform this action." 
            });
        }
        next();
    };
};

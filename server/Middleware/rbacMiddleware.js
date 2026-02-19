import AuditLog from "../Models/AuditLogModel.js";

export const authorizeRoles = (...allowedRoles) => {
    return async (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {

            //Logs if user is denied
            await AuditLog.create({
                userId: req.user?._id, // Logs ID if available
                action: "ACCESS_DENIED",
                details: `User ${req.user?.email || 'Unknown'} tried to access ${req.originalUrl} but lacks permissions.`,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            });
            
            console.warn(`[RBAC] Unauthorized access attempt by user ${req.user.id} to ${req.originalUrl}`);
            return res.status(403).json({ 
                message: "You do not have permission to perform this action." 
            });
        }
        next();
    };
};
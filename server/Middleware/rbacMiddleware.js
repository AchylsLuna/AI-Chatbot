import AuditLog from "../Models/AuditLogModel.js";

export const authorizeRoles = (...allowedRoles) => {
    return async (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            try {
                await AuditLog.create({
                    userId: req.user?.id || req.user?._id,
                    action: "ACCESS_DENIED",
                    details: `User role ${req.user?.role || "guest"} tried to access ${req.originalUrl} without permission.`,
                    ipAddress: req.ip,
                    userAgent: req.headers["user-agent"],
                });
            } catch (error) {
                console.warn("[RBAC] Failed to write ACCESS_DENIED audit log", error);
            }

            console.warn(
                `[RBAC] Unauthorized access attempt by user ${req.user?.id || "unknown"} to ${req.originalUrl}`
            );
            return res.status(403).json({ 
                message: "You do not have permission to perform this action." 
            });
        }
        next();
    };
};

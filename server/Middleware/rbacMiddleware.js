export const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            console.warn(`[RBAC] Unauthorized access attempt by user ${req.user.id} to ${req.originalUrl}`);
            return res.status(403).json({ 
                message: "You do not have permission to perform this action." 
            });
        }
        next();
    };
};
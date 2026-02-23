import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import passport from 'passport';
import { isGoogleAuthEnabled } from '../Config/passport.js';
import authMiddleware from '../Middleware/authMiddleware.js';
import { authorizeRoles } from '../Middleware/rbacMiddleware.js';
import { uploadLicense, handleUploadError } from '../Middleware/uploadMiddleware.js';
import { loginLimiter } from '../Middleware/rateLimiter.js';
import { appConfig } from '../Config/env.js';
import {
    register,
    registerDoctor,
    login,
    requestOtpChallenge,
    logout,
    verifyOTP,
    resendOTP,
    getSession,
    getSettings,
    updateSettings,
    debugUser,
    googleCallback,
} from '../Controllers/UserController.js';
import {
    createAppointment,
    getAppointments,
    getReservations,
    updateAppointment,
} from '../Controllers/AppointmentsController.js';
import {
    getAllUsers,
    getLedger,
    getAccessRequests,
    logAiAlertAction,
    downloadAuditBackup,
} from '../Controllers/adminController.js';

const router = Router();

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

router.get('/health', (_req, res) => {
    return res.status(200).json({ ok: true });
});

// Google Login Trigger
if (isGoogleAuthEnabled) {
    router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

    // Google Callback
    router.get(
        '/auth/google/callback',
        passport.authenticate('google', { session: false, failureRedirect: '/login-failed' }),
        googleCallback
    );
} else {
    const googleOauthDisabled = (_req, res) => {
        return res.status(503).json({
            message: 'Google OAuth is not configured on this server.',
        });
    };

    router.get('/auth/google', googleOauthDisabled);
    router.get('/auth/google/callback', googleOauthDisabled);
}

// User routes
router.post(
    '/register',
    [
        body('firstName').trim().notEmpty().escape().withMessage('First name is required'),
        body('lastName').trim().notEmpty().escape().withMessage('Last name is required'),
        body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
        body('password').isLength({ min: 8 }).withMessage('Password too short'),
    ],
    validate,
    register
);

router.post(
    '/register/doctor',
    uploadLicense.single('license'),
    handleUploadError,
    [
        body('firstName').trim().notEmpty().escape().withMessage('First name is required'),
        body('lastName').trim().notEmpty().escape().withMessage('Last name is required'),
        body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
        body('password').isLength({ min: 8 }).withMessage('Password too short'),
        body('department').trim().notEmpty().escape().withMessage('Department is required'),
    ],
    validate,
    registerDoctor
);

router.post(
    '/login',
    loginLimiter,
    [body('email').isEmail().normalizeEmail(), body('password').exists()],
    validate,
    login
);

router.post(
    '/auth/otp/request',
    loginLimiter,
    [
        body('username').optional().isString(),
        body('email').optional().isEmail().normalizeEmail(),
        body('password').exists(),
    ],
    validate,
    requestOtpChallenge
);

router.post(
    '/verify-otp',
    [body('otp').trim().isLength({ min: 6, max: 6 }).escape(), body('userId').isMongoId()],
    validate,
    verifyOTP
);

router.post('/resend-otp', [body('userId').isMongoId()], validate, resendOTP);
router.post('/logout', authMiddleware, logout);
router.get('/session', authMiddleware, getSession);

// User settings
router.get('/users/me/settings', authMiddleware, getSettings);
router.put(
    '/users/me/settings',
    authMiddleware,
    [
        body('settings').optional().isObject(),
        body('settings.notifications.email').optional().isBoolean(),
        body('settings.notifications.sms').optional().isBoolean(),
        body('settings.notifications.push').optional().isBoolean(),
    ],
    validate,
    updateSettings
);

if (appConfig.enableDebugRoutes) {
    router.get(
        '/debug/user',
        authMiddleware,
        authorizeRoles('admin', 'system_admin'),
        debugUser
    );
}

// Appointment routes
router.get('/appointments', authMiddleware, getAppointments);
router.get('/reservations', authMiddleware, getReservations);
router.post(
    '/appointments',
    authMiddleware,
    authorizeRoles('user'),
    [
        body('doctorId').optional().isMongoId().withMessage('Invalid doctor ID'),
        body('scheduledDate').isISO8601().withMessage('Invalid date'),
        body('department').trim().notEmpty().escape(),
        body('reason').optional().trim(),
        body('note').optional().trim(),
    ],
    validate,
    createAppointment
);

router.patch(
    '/appointments/:id',
    authMiddleware,
    authorizeRoles('user', 'nurse', 'admin', 'system_admin'),
    [
        body('requestedTime').optional().isISO8601().withMessage('Invalid requestedTime'),
        body('status').optional().isString(),
        body('department').optional().isString(),
        body('priority').optional().isString(),
        body('summary').optional().isString(),
    ],
    validate,
    updateAppointment
);

// Admin-triggered archive (manual)
router.post(
    '/admin/archive/appointments',
    authMiddleware,
    authorizeRoles('admin', 'system_admin'),
    async (req, res, next) => {
        try {
            const { default: archiveService } = await import('../Utils/archiveService.js');
            const days = req.body?.days ? Number(req.body.days) : undefined;
            const dryRun = req.body?.dry === true;
            const result = await archiveService.archiveOldAppointments({ olderThanDays: days, dryRun });
            return res.json({ ok: true, result });
        } catch (error) {
            next(error);
        }
    }
);

// Admin/support routes
router.get('/users', authMiddleware, authorizeRoles('admin', 'system_admin'), getAllUsers);
router.get('/ledger', authMiddleware, authorizeRoles('admin', 'system_admin'), getLedger);
router.get('/access-requests', authMiddleware, authorizeRoles('admin', 'system_admin'), getAccessRequests);
router.post('/audit/ai-alert-action', authMiddleware, logAiAlertAction);
router.get(
    '/admin/audit-logs/download',
    authMiddleware,
    authorizeRoles('admin', 'system_admin'),
    downloadAuditBackup
);

export default router;

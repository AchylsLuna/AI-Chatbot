import { Router } from 'express';
import {
    register,
    login,
    logout,
    verifyOTP,
    resendOTP,
    getSettings,
    updateSettings,
    googleCallback,
    getMyProfile,
    updateMyProfile,
    upsertPersonalHealthInfo,
    getPatientMedicalProfile,
} from '../Controllers/UserController.js';
import {
    getAllUsers,
    downloadAuditBackup,
    updateUserByAdmin,
    downloadSystemBackup,
} from '../Controllers/adminController.js';
import {
    createAppointment,
    updateAppointmentStatus,
} from '../Controllers/AppointmentsController.js';
import {
    checkSymptoms,
} from '../Controllers/BotController.js';

import authMiddleware from '../Middleware/authMiddleware.js';
import { authorizeRoles } from '../Middleware/rbacMiddleware.js';
import User from '../Models/UserModel.js';
import { uploadLicense, handleUploadError } from '../Middleware/uploadMiddleware.js';
import { loginLimiter } from '../Middleware/rateLimiter.js';
import { body, validationResult } from 'express-validator';
import passport from 'passport';


const router = Router();

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({ errors: errors.array() });
    }
    next();
}

// Google Login
router.get('/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google Callback
router.get('/auth/google/callback', 
    passport.authenticate('google', { session: false, failureRedirect: '/login-failed' }),
    googleCallback 
);

// User Routes
router.post('/register',
    [
        body('firstName').trim().notEmpty().escape().withMessage('First name is required'),
        body('lastName').trim().notEmpty().escape().withMessage('Last name is required'),
        body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
        body('password').isLength({ min: 8 }).withMessage('Password too short') // Add complexity checks if needed
    ],
    validate,
    register
);
router.post('/register/doctor',
    uploadLicense.single('license'), 
    handleUploadError, // Much cleaner!
    [
        body('firstName').trim().notEmpty().escape().withMessage('First name is required'),
        body('lastName').trim().notEmpty().escape().withMessage('Last name is required'),
        body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
        body('password').isLength({ min: 8 }).withMessage('Password too short'),
        body('department').trim().notEmpty().escape().withMessage('Department is required')
    ],
    validate,
    async (req, res, next) => {
        try {
            const controller = await import('../Controllers/UserController.js');
            return controller.registerDoctor(req, res, next);
        } catch (err) {
            next(err);
        }
    }
);

router.post('/login',
    loginLimiter,
    [
        body('email').isEmail().normalizeEmail(),
        body('password').exists()
    ],
    validate,
    login
);
router.post('/verify-otp',
    [
        body('otp').trim().isLength({ min: 6, max: 6 }).escape(),
        body('userId').isMongoId()
    ],
    verifyOTP
);
router.post('/resend-otp',
    [
        body('userId').isMongoId()
    ],
    validate,
    resendOTP
);

router.post('/logout', authMiddleware, logout);

//
router.get('/session', authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id
        if (!userId) return res.status(401).json({ message: 'Invalid session' })
        const user = await User.findById(userId)
        if (!user) return res.status(404).json({ message: 'User not found' })

        return res.json({ username: user.email, role: user.role })
    } catch (error) {
        console.error('Session lookup failed', error)
        return res.status(500).json({ message: 'Session lookup failed' })
    }
})

// User settings
router.get('/users/me/settings', authMiddleware, getSettings)
router.put('/users/me/settings',
    authMiddleware,
    [
        body('settings').optional().isObject(),
        body('settings.notifications.email').optional().isBoolean(),
        body('settings.notifications.sms').optional().isBoolean(),
        body('settings.notifications.push').optional().isBoolean(),
    ],
    validate,
    updateSettings
)

// User profile and personal health information
router.get('/users/me/profile', authMiddleware, getMyProfile)
router.put('/users/me/profile',
    authMiddleware,
    [
        body('firstName').optional().trim().isLength({ min: 1, max: 30 }).escape(),
        body('lastName').optional().trim().isLength({ min: 1, max: 30 }).escape(),
        body('dateOfBirth').optional().isISO8601().toDate(),
        body('phoneNumber').optional().trim().isLength({ max: 30 }).escape(),
        body('address').optional().trim().isLength({ max: 200 }).escape(),
        body('gender').optional().trim().isLength({ max: 30 }).escape(),
    ],
    validate,
    updateMyProfile
)
router.put('/users/me/personal-health-info',
    authMiddleware,
    authorizeRoles('user', 'doctor', 'admin', 'system_admin', 'nurse'),
    [
        body('personalHealthInfo').optional().isObject(),
        body('bloodType').optional().trim().isLength({ max: 10 }).escape(),
        body('notes').optional().trim().isLength({ max: 1000 }).escape(),
        body('emergencyContact').optional().isObject(),
    ],
    validate,
    upsertPersonalHealthInfo
)


// Appointment Routes
router.get('/appointments', authMiddleware, async (req, res, next) => {
    try {
        const controllerModule = await import('../Controllers/AppointmentsController.js')
        return controllerModule.getAppointments(req, res, next)
    } catch (err) {
        next(err)
    }
})
router.post('/appointments', 
    authMiddleware,
    authorizeRoles('user'), 
    [
        body('doctorId').optional().isMongoId().withMessage('Invalid Doctor ID'),
        body('scheduledDate').isISO8601().toDate().withMessage('Invalid Date'),
        body('department').trim().notEmpty().escape(),
        body('reason').optional().trim().escape()
    ],
    validate,
    createAppointment
);
router.patch('/appointments/:appointmentId/status',
    authMiddleware,
    authorizeRoles('doctor', 'admin', 'system_admin'),
    [
        body('status').isIn(['Pending', 'Confirmed', 'Completed', 'Cancelled']).withMessage('Invalid status'),
    ],
    validate,
    updateAppointmentStatus
);

// User Appointment History
router.get('/users/me/appointments/history',
    authMiddleware,
    authorizeRoles('user', 'doctor', 'admin', 'system_admin', 'nurse'),
    async (req, res, next) => {
        try {
            const controllerModule = await import('../Controllers/AppointmentsController.js')
            return controllerModule.getAppointments(req, res, next)
        } catch (err) {
            next(err)
        }
    }
)

// Doctor route for patients profile
router.get('/doctor/patients/:patientId/profile',
    authMiddleware,
    authorizeRoles('doctor', 'admin', 'system_admin'),
    getPatientMedicalProfile
)

// Admin-triggered archive
router.post('/admin/archive/appointments', authMiddleware, authorizeRoles('admin', 'system_admin'), async (req, res, next) => {
    try {
        const { default: archiveService } = await import('../Utils/archiveService.js')
        const days = req.body?.days ? Number(req.body.days) : undefined
        const dryRun = req.body?.dry === true
        const result = await archiveService.archiveOldAppointments({ olderThanDays: days, dryRun })
        return res.json({ ok: true, result })
    } catch (err) {
        next(err)
    }
})

//ADMIN Routes
router.get('/users',
    authMiddleware,
    authorizeRoles('admin', 'system_admin'),
    getAllUsers
)
router.put('/admin/users/:userId',
    authMiddleware,
    authorizeRoles('admin', 'system_admin'),
    [
        body('role').optional().isIn(['user', 'doctor', 'nurse', 'admin', 'system_admin']),
        body('status').optional().isIn(['active', 'disabled']),
        body('department').optional().trim().isLength({ max: 120 }).escape(),
    ],
    validate,
    updateUserByAdmin
)

router.get('/admin/audit-logs/download', 
    authMiddleware, 
    authorizeRoles('admin', 'system_admin'), 
    downloadAuditBackup
);
router.get('/admin/backups/system',
    authMiddleware,
    authorizeRoles('admin', 'system_admin'),
    downloadSystemBackup
);

router.post('/symptoms', checkSymptoms);

export default router;

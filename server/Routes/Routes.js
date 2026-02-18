import { Router } from 'express';
import {
    register,
    login,
    logout,
    verifyOTP,
    getSettings,
    updateSettings,
    debugUser,
} from '../Controllers/UserController.js';
import {
    getAllUsers,
} from '../Controllers/adminController.js';
import {
    createAppointment,
} from '../Controllers/AppointmentsController.js';
import authMiddleware from '../Middleware/authMiddleware.js';
import { authorizeRoles } from '../Middleware/rbacMiddleware.js';
import User from '../Models/UserModel.js';
import { loginLimiter } from '../Middleware/rateLimiter.js';
import { body, validationResult } from 'express-validator';

const router = Router();

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({ errors: errors.array() });
    }
    next();
}


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

router.post('/logout', authMiddleware, logout);

// Session introspection - return minimal user info for client
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

// DEBUG route - local only
router.get('/debug/user', async (req, res, next) => {
    try {
        const controller = await import('../Controllers/UserController.js')
        return controller.debugUser(req, res, next)
    } catch (err) {
        next(err)
    }
})

// Appointment Routes
router.get('/appointments', authMiddleware, async (req, res, next) => {
    // delegate to controller
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

// Admin-triggered archive (manual)
router.post('/admin/archive/appointments', authMiddleware, authorizeRoles('admin'), async (req, res, next) => {
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
    authorizeRoles('admin', 'doctor'),
    getAllUsers
)

export default router;
import { Router } from 'express';
import {
    register,
    registerDoctor,
    login,
    logout,
    verifyOTP,
    resendOTP,
    requestPasswordReset,
    resetPassword,
    changePassword,
    exchangeGoogleAuthCode,
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
    getAuditLogs,
    archiveAuditLogs,
    getErrorLogs,
    getLedger,
    getPendingStaffApplications,
    approveStaffApplication,
    rejectStaffApplication,
    viewStaffApplicationLicense,
    downloadAuditBackup,
    downloadErrorBackup,
    updateUserByAdmin,
    downloadSystemBackup,
} from '../Controllers/adminController.js';
import {
    createAppointment,
    getDoctorAvailableSlots,
    getDoctorWeeklySchedule,
    getAvailableDoctorsByDepartment,
    upsertDoctorWeeklySchedule,
    updateAppointmentStatus,
} from '../Controllers/AppointmentsController.js';
import {
    checkSymptoms,
} from '../Controllers/BotController.js';
import {
    createSupportTicket,
} from '../Controllers/SupportController.js';

import authMiddleware from '../Middleware/authMiddleware.js';
import { requireCsrf } from '../Middleware/csrfMiddleware.js';
import { authorizeRoles } from '../Middleware/rbacMiddleware.js';
import User from '../Models/UserModel.js';
import {
    cleanupUploadedLicenseFiles,
    handleUploadError,
    uploadLicense,
} from '../Middleware/uploadMiddleware.js';
import {
    loginLimiter,
    passwordResetConfirmLimiter,
    passwordResetRequestLimiter,
    otpResendLimiter,
    otpVerifyLimiter,
    symptomCheckLimiter,
    supportTicketLimiter,
} from '../Middleware/rateLimiter.js';
import { body, validationResult } from 'express-validator';
import passport from 'passport';
import { isGoogleAuthConfigured } from '../Config/passport.js';
import { isAdminRole, normalizeRole } from '../Utils/roles.js';
import { createGoogleOauthState, ensureSessionCsrfToken } from '../Utils/authSecurity.js';
import { appConfig } from '../Config/env.js';


const router = Router();
const ALLOWED_DOCTOR_DEPARTMENTS = [
    "Internal Medicine",
    "Pediatrics",
    "Surgery",
    "Obstetrics and Gynecology",
    "Family and Community Medicine",
    "Anesthesiology",
    "Radiology",
    "Pathology",
    "Psychiatry",
    "Ophthalmology",
    "Otorhinolaryngology",
    "Rehabilitation Medicine",
    "Dermatology",
    "Emergency Medicine",
    "Cardiology",
    "Pulmonology",
    "Nephrology",
    "Neurology",
    "Gastroenterology",
];

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()){
        return res.status(400).json({ errors: errors.array() });
    }
    next();
}

const validateDoctorRegistration = async (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        next();
        return;
    }

    await cleanupUploadedLicenseFiles(req).catch((error) => {
        console.warn('Failed to clean up uploaded doctor license files after validation error:', error);
    });

    return res.status(400).json({ errors: errors.array() });
}

const sanitizePlainText = (value) =>
    String(value || '')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
        .replace(/<[^>]*>/g, '')
        .trim();

const uploadStaffLicenses = uploadLicense.fields([
    { name: 'licenses', maxCount: 5 },
    { name: 'license', maxCount: 5 },
    { name: 'licenseFile', maxCount: 5 },
]);
const requireGoogleAuthConfig = (req, res, next) => {
    if (!isGoogleAuthConfigured) {
        return res.status(503).json({ message: 'Google sign-in is not configured for this environment.' });
    }
    next();
};

// Google Login
router.get('/auth/google', 
    requireGoogleAuthConfig,
    (req, res, next) => {
        const sourcePage = ['login', 'doctor_login', 'admin_login'].includes(String(req.query?.sourcePage || ''))
            ? String(req.query.sourcePage)
            : 'login'
        const state = createGoogleOauthState(sourcePage)
        return passport.authenticate('google', {
            scope: ['profile', 'email'],
            state,
            session: false,
        })(req, res, next)
    }
);

// Google Callback
router.get('/auth/google/callback', 
    requireGoogleAuthConfig,
    passport.authenticate('google', {
        session: false,
        failureRedirect: `${appConfig.frontendUrl.replace(/\/$/, '')}/login?google_error=google_login_failed`,
    }),
    googleCallback 
);
router.post('/auth/google/exchange',
    requireGoogleAuthConfig,
    [
        body('exchangeCode')
            .trim()
            .isHexadecimal()
            .isLength({ min: 64, max: 64 })
            .withMessage('Invalid exchange code'),
    ],
    validate,
    exchangeGoogleAuthCode
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
    uploadStaffLicenses, 
    handleUploadError,
    [
        body('firstName').trim().notEmpty().escape().withMessage('First name is required'),
        body('lastName').trim().notEmpty().escape().withMessage('Last name is required'),
        body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
        body('password').isLength({ min: 8 }).withMessage('Password too short'),
        body('department')
            .trim()
            .notEmpty()
            .withMessage('Department is required')
            .isIn(ALLOWED_DOCTOR_DEPARTMENTS)
            .withMessage('Selected doctor department is not allowed')
    ],
    validateDoctorRegistration,
    registerDoctor
);

router.post('/login',
    loginLimiter,
    [
        body('email').isEmail().normalizeEmail(),
        body('password').exists(),
        body('sourcePage')
            .exists()
            .isIn(['login', 'doctor_login', 'admin_login'])
            .withMessage('Invalid sign-in page')
    ],
    validate,
    login
);
router.post('/verify-otp',
    otpVerifyLimiter,
    [
        body('otp')
            .trim()
            .matches(/^\d{6}$/)
            .withMessage('OTP must be exactly 6 digits'),
        body('challengeId').isUUID().withMessage('Invalid OTP challenge'),
    ],
    validate,
    verifyOTP
);
router.post('/resend-otp',
    otpResendLimiter,
    [
        body('challengeId').isUUID().withMessage('Invalid OTP challenge'),
    ],
    validate,
    resendOTP
);
router.post('/forgot-password',
    passwordResetRequestLimiter,
    [
        body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
        body('sourcePage').optional().isIn(['login', 'doctor_login', 'admin_login']),
    ],
    validate,
    requestPasswordReset
);
router.post('/reset-password',
    passwordResetConfirmLimiter,
    [
        body('resetToken').trim().isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('Invalid reset token'),
        body('newPassword').isLength({ min: 8 }).withMessage('Password too short'),
    ],
    validate,
    resetPassword
);

router.post('/logout', authMiddleware, requireCsrf, logout);

router.post('/support/tickets',
    supportTicketLimiter,
    [
        body('fullName')
            .customSanitizer(sanitizePlainText)
            .notEmpty()
            .withMessage('Full name is required')
            .isLength({ min: 2, max: 80 })
            .withMessage('Full name must be between 2 and 80 characters'),
        body('email')
            .isEmail()
            .normalizeEmail()
            .withMessage('Invalid email'),
        body('message')
            .customSanitizer(sanitizePlainText)
            .notEmpty()
            .withMessage('Message is required')
            .isLength({ min: 10, max: 1200 })
            .withMessage('Message must be between 10 and 1200 characters'),
    ],
    validate,
    createSupportTicket
);

//
router.get('/session', authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.id || req.user?._id
        if (!userId) return res.status(401).json({ message: 'Invalid session' })
        const user = await User.findById(userId).select('email firstName lastName role googleId')
        if (!user) return res.status(404).json({ message: 'User not found' })
        const csrfToken = await ensureSessionCsrfToken(req, res, req.authSession)
        const authMethod = user.googleId ? 'google' : 'local'
        const mfa = authMethod === 'local' ? !isAdminRole(user.role) : true

        return res.json({
            username: user.email,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: normalizeRole(user.role) || 'user',
            authMethod,
            mfa,
            sessionId: req.user?.sessionId || null,
            csrfToken,
        })
    } catch (error) {
        console.error('Session lookup failed', error)
        return res.status(500).json({ message: 'Session lookup failed' })
    }
})

// User settings
router.get('/users/me/settings', authMiddleware, getSettings)
router.put('/users/me/settings',
    authMiddleware,
    requireCsrf,
    [
        body('settings').optional().isObject(),
        body('settings.theme').optional().isIn(['light', 'dark']),
        body('settings.notifications.email').optional().isBoolean(),
        body('settings.notifications.sms').optional().isBoolean(),
        body('settings.notifications.push').optional().isBoolean(),
        body('settings.notifications.appointmentReminders').optional().isBoolean(),
        body('settings.notifications.securityAlerts').optional().isBoolean(),
    ],
    validate,
    updateSettings
)
router.put('/users/me/password',
    authMiddleware,
    requireCsrf,
    [
        body('currentPassword').exists().withMessage('Current password is required'),
        body('newPassword').isLength({ min: 8 }).withMessage('Password too short'),
    ],
    validate,
    changePassword
)

// User profile and personal health information
router.get('/users/me/profile', authMiddleware, getMyProfile)
router.put('/users/me/profile',
    authMiddleware,
    requireCsrf,
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
    requireCsrf,
    authorizeRoles('user', 'doctor', 'admin', 'system_admin'),
    [
        body('personalHealthInfo').optional().isObject(),
        body('personalHealthInfo.bloodType').optional().trim().isLength({ max: 10 }).escape(),
        body('personalHealthInfo.notes').optional().trim().isLength({ max: 1000 }).escape(),
        body('personalHealthInfo.allergies').optional().isArray({ max: 50 }),
        body('personalHealthInfo.medications').optional().isArray({ max: 50 }),
        body('personalHealthInfo.chronicConditions').optional().isArray({ max: 50 }),
        body('personalHealthInfo.surgeries').optional().isArray({ max: 50 }),
        body('personalHealthInfo.allergies.*').optional().trim().isLength({ max: 120 }).escape(),
        body('personalHealthInfo.medications.*').optional().trim().isLength({ max: 120 }).escape(),
        body('personalHealthInfo.chronicConditions.*').optional().trim().isLength({ max: 120 }).escape(),
        body('personalHealthInfo.surgeries.*').optional().trim().isLength({ max: 120 }).escape(),
        body('personalHealthInfo.emergencyContact').optional().isObject(),
        body('personalHealthInfo.emergencyContact.name').optional().trim().isLength({ max: 80 }).escape(),
        body('personalHealthInfo.emergencyContact.phone').optional().trim().isLength({ max: 30 }).escape(),
        body('personalHealthInfo.emergencyContact.relationship').optional().trim().isLength({ max: 50 }).escape(),
        body('bloodType').optional().trim().isLength({ max: 10 }).escape(),
        body('notes').optional().trim().isLength({ max: 1000 }).escape(),
        body('allergies').optional().isArray({ max: 50 }),
        body('medications').optional().isArray({ max: 50 }),
        body('chronicConditions').optional().isArray({ max: 50 }),
        body('surgeries').optional().isArray({ max: 50 }),
        body('allergies.*').optional().trim().isLength({ max: 120 }).escape(),
        body('medications.*').optional().trim().isLength({ max: 120 }).escape(),
        body('chronicConditions.*').optional().trim().isLength({ max: 120 }).escape(),
        body('surgeries.*').optional().trim().isLength({ max: 120 }).escape(),
        body('emergencyContact').optional().isObject(),
        body('emergencyContact.name').optional().trim().isLength({ max: 80 }).escape(),
        body('emergencyContact.phone').optional().trim().isLength({ max: 30 }).escape(),
        body('emergencyContact.relationship').optional().trim().isLength({ max: 50 }).escape(),
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
    requireCsrf,
    authorizeRoles('user'), 
    [
        body('doctorId').isMongoId().withMessage('Invalid Doctor ID'),
        body('scheduledDate').isISO8601().toDate().withMessage('Invalid Date'),
        body('department').trim().notEmpty().escape(),
        body('reason').optional().trim().escape()
    ],
    validate,
    createAppointment
);
router.get('/appointments/doctors/available',
    authMiddleware,
    authorizeRoles('user', 'doctor', 'admin', 'system_admin'),
    getAvailableDoctorsByDepartment
)
router.get('/appointments/doctors/:doctorId/slots',
    authMiddleware,
    authorizeRoles('user', 'doctor', 'admin', 'system_admin'),
    getDoctorAvailableSlots
)
// Backward-compatible aliases for doctor availability lookup.
router.get('/appointments/available-doctors',
    authMiddleware,
    authorizeRoles('user', 'doctor', 'admin', 'system_admin'),
    getAvailableDoctorsByDepartment
)
router.get('/doctor/appointments/doctors/available',
    authMiddleware,
    authorizeRoles('user', 'doctor', 'admin', 'system_admin'),
    getAvailableDoctorsByDepartment
)
router.get('/doctor/schedules/:weekStart',
    authMiddleware,
    authorizeRoles('doctor', 'admin', 'system_admin'),
    getDoctorWeeklySchedule
)
router.put('/doctor/schedules/:weekStart',
    authMiddleware,
    requireCsrf,
    authorizeRoles('doctor', 'admin', 'system_admin'),
    [
        body('days').optional().isObject().withMessage('days must be an object'),
    ],
    validate,
    upsertDoctorWeeklySchedule
)
router.patch('/appointments/:appointmentId/status',
    authMiddleware,
    requireCsrf,
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
    authorizeRoles('user', 'doctor', 'admin', 'system_admin'),
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
router.post('/admin/archive/appointments',
    authMiddleware,
    requireCsrf,
    authorizeRoles('admin', 'system_admin'),
    [
        body('days').optional().isInt({ min: 1, max: 3650 }).toInt(),
        body('dry').optional().isBoolean(),
    ],
    validate,
    async (req, res, next) => {
        try {
            const { default: archiveService } = await import('../Utils/archiveService.js')
            const days = typeof req.body?.days === 'number' ? req.body.days : undefined
            const dryRun = req.body?.dry === true
            const result = await archiveService.archiveOldAppointments({ olderThanDays: days, dryRun })
            return res.json({ ok: true, result })
        } catch (err) {
            next(err)
        }
    }
)

//ADMIN Routes
router.get('/users',
    authMiddleware,
    authorizeRoles('admin', 'system_admin'),
    getAllUsers
)
router.get('/ledger',
    authMiddleware,
    authorizeRoles('admin', 'system_admin'),
    getLedger
)
router.put('/admin/users/:userId',
    authMiddleware,
    requireCsrf,
    authorizeRoles('admin', 'system_admin'),
    [
        body('role')
            .optional()
            .custom((value) => Boolean(normalizeRole(value)))
            .withMessage('Invalid role value.')
            .customSanitizer((value) => normalizeRole(value)),
        body('status').optional().isIn(['active', 'disabled']),
        body('department').optional().trim().isLength({ max: 120 }).escape(),
    ],
    validate,
    updateUserByAdmin
)
router.get('/admin/staff-applications',
    authMiddleware,
    authorizeRoles('admin', 'system_admin'),
    getPendingStaffApplications
)
router.patch('/admin/staff-applications/:userId/approve',
    authMiddleware,
    requireCsrf,
    authorizeRoles('admin', 'system_admin'),
    approveStaffApplication
)
router.delete('/admin/staff-applications/:userId/reject',
    authMiddleware,
    requireCsrf,
    authorizeRoles('admin', 'system_admin'),
    rejectStaffApplication
)
router.get('/admin/staff-applications/:userId/license',
    authMiddleware,
    authorizeRoles('admin', 'system_admin'),
    viewStaffApplicationLicense
)

router.get('/admin/audit-logs/download', 
    authMiddleware, 
    authorizeRoles('admin', 'system_admin'), 
    downloadAuditBackup
);
router.get('/admin/error-logs/download',
    authMiddleware,
    authorizeRoles('admin', 'system_admin'),
    downloadErrorBackup
);
router.get('/admin/audit-logs',
    authMiddleware,
    authorizeRoles('admin', 'system_admin'),
    getAuditLogs
);
router.post('/admin/audit-logs/archive',
    authMiddleware,
    requireCsrf,
    authorizeRoles('admin', 'system_admin'),
    [
        body('olderThanDays')
            .optional()
            .isNumeric()
            .withMessage('olderThanDays must be a number.')
            .customSanitizer((value) => Number(value)),
        body('dryRun').optional().isBoolean().withMessage('dryRun must be a boolean.'),
    ],
    validate,
    archiveAuditLogs
);
router.get('/admin/error-logs',
    authMiddleware,
    authorizeRoles('admin', 'system_admin'),
    getErrorLogs
);
router.get('/admin/backups/system',
    authMiddleware,
    authorizeRoles('admin', 'system_admin'),
    downloadSystemBackup
);

router.post('/symptoms',
    symptomCheckLimiter,
    [
        body('message')
            .isString()
            .trim()
            .isLength({ min: 1, max: 1000 })
            .withMessage('Message must be between 1 and 1000 characters.'),
        body('isIdentified').optional().isBoolean(),
        body('userRole').optional().trim().isLength({ max: 40 }).escape(),
    ],
    validate,
    checkSymptoms
);

// Doctor dashboard routes appended for queue/timeline, triage overview, SOAP notes, and prescriptions.
router.get('/doctor/dashboard/overview',
    authMiddleware,
    authorizeRoles('doctor', 'admin', 'system_admin'),
    async (req, res, next) => {
        try {
            const controllerModule = await import('../Controllers/AppointmentsController.js')
            return controllerModule.getDoctorDashboardOverview(req, res, next)
        } catch (err) {
            next(err)
        }
    }
)
router.get('/doctor/queue/timeline',
    authMiddleware,
    authorizeRoles('doctor', 'admin', 'system_admin'),
    async (req, res, next) => {
        try {
            const controllerModule = await import('../Controllers/AppointmentsController.js')
            return controllerModule.getDoctorQueueTimeline(req, res, next)
        } catch (err) {
            next(err)
        }
    }
)
router.patch('/doctor/appointments/:appointmentId/queue-status',
    authMiddleware,
    requireCsrf,
    authorizeRoles('doctor', 'admin', 'system_admin'),
    [
        body('queueStatus').isIn(['Waiting', 'Arrived', 'In-Consultation', 'Checked-Out', 'No-Show']).withMessage('Invalid queue status'),
    ],
    validate,
    async (req, res, next) => {
        try {
            const controllerModule = await import('../Controllers/AppointmentsController.js')
            return controllerModule.updateDoctorQueueStatus(req, res, next)
        } catch (err) {
            next(err)
        }
    }
)
router.put('/doctor/appointments/:appointmentId/soap-note',
    authMiddleware,
    requireCsrf,
    authorizeRoles('doctor', 'admin', 'system_admin'),
    [
        body('subjective').optional().isString().trim().isLength({ max: 4000 }),
        body('objective').optional().isString().trim().isLength({ max: 4000 }),
        body('assessment').optional().isString().trim().isLength({ max: 4000 }),
        body('plan').optional().isString().trim().isLength({ max: 4000 }),
    ],
    validate,
    async (req, res, next) => {
        try {
            const controllerModule = await import('../Controllers/AppointmentsController.js')
            return controllerModule.saveAppointmentSoapNote(req, res, next)
        } catch (err) {
            next(err)
        }
    }
)
router.put('/doctor/appointments/:appointmentId/prescriptions',
    authMiddleware,
    requireCsrf,
    authorizeRoles('doctor', 'admin', 'system_admin'),
    [
        body('prescriptions').isArray({ min: 1 }).withMessage('prescriptions must be a non-empty array'),
        body('prescriptions').isArray({ max: 20 }),
        body('prescriptions.*.medication').trim().notEmpty().isLength({ max: 120 }).escape(),
        body('prescriptions.*.dosage').trim().notEmpty().isLength({ max: 120 }).escape(),
        body('prescriptions.*.frequency').optional().trim().isLength({ max: 120 }).escape(),
        body('prescriptions.*.durationDays').optional().isInt({ min: 1, max: 365 }).toInt(),
        body('prescriptions.*.instructions').optional().trim().isLength({ max: 500 }).escape(),
    ],
    validate,
    async (req, res, next) => {
        try {
            const controllerModule = await import('../Controllers/AppointmentsController.js')
            return controllerModule.saveAppointmentPrescriptions(req, res, next)
        } catch (err) {
            next(err)
        }
    }
)
router.get('/doctor/medications/search',
    authMiddleware,
    authorizeRoles('doctor', 'admin', 'system_admin'),
    async (req, res, next) => {
        try {
            const controllerModule = await import('../Controllers/AppointmentsController.js')
            return controllerModule.getMedicationSearch(req, res, next)
        } catch (err) {
            next(err)
        }
    }
)
router.get('/doctor/prescriptions/frequent',
    authMiddleware,
    authorizeRoles('doctor', 'admin', 'system_admin'),
    async (req, res, next) => {
        try {
            const controllerModule = await import('../Controllers/AppointmentsController.js')
            return controllerModule.getFrequentPrescriptions(req, res, next)
        } catch (err) {
            next(err)
        }
    }
)

export default router;

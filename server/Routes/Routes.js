import { Router } from 'express';
import {
    register,
    login,
    logout,
    verifyOTP,
} from '../Controllers/UserController.js';
import authMiddleware from '../Middleware/authMiddleware.js';
import { loginLimiter } from '../Middleware/rateLimiter.js';
import { authorizeRoles } from '../Middleware/roleMiddleware.js';
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
        // Sanitize: .escape() turns <script> into &lt;script&gt;
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



export default router;
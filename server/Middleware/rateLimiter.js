import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: "Too many login attemps, please try again after 15 minutes.",
    standardHeaders: true,
    legacyHeaders: false,
})
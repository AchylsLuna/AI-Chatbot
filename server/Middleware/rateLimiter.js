import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    // respond with JSON so client can surface a helpful message
    handler: (req, res) => {
        return res.status(429).json({ message: 'Too many login attempts, please try again after 15 minutes.' })
    },
    standardHeaders: true,
    legacyHeaders: false,
})
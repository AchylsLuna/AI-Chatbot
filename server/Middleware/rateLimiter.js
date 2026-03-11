import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const keyGenerator = (req) => {
    const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
    return ipKeyGenerator(ip);
};

export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30,
    keyGenerator,
    // respond with JSON so client can surface a helpful message
    handler: (req, res) => {
        return res.status(429).json({ message: 'Too many login attempts, please try again after 15 minutes.' })
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const otpVerifyLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    keyGenerator,
    handler: (req, res) => {
        return res.status(429).json({ message: 'Too many OTP verification attempts. Please try again later.' });
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const otpResendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator,
    handler: (req, res) => {
        return res.status(429).json({ message: 'Too many OTP resend requests. Please wait before trying again.' });
    },
    standardHeaders: true,
    legacyHeaders: false,
});
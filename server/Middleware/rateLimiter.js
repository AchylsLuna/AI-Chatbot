import rateLimit from 'express-rate-limit';

const createJsonLimiter = ({ windowMs, max, message }) => rateLimit({
    windowMs,
    max,
    handler: (req, res) => {
        return res.status(429).json({ message });
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const loginLimiter = createJsonLimiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: 'Too many login attempts, please try again after 15 minutes.',
});

export const otpVerifyLimiter = createJsonLimiter({
    windowMs: 10 * 60 * 1000,
    max: 12,
    message: 'Too many OTP verification attempts. Please wait before trying again.',
});

export const otpResendLimiter = createJsonLimiter({
    windowMs: 10 * 60 * 1000,
    max: 6,
    message: 'Too many OTP resend requests. Please wait before requesting another code.',
});

export const passwordResetRequestLimiter = createJsonLimiter({
    windowMs: 15 * 60 * 1000,
    max: 8,
    message: 'Too many password reset requests. Please wait before trying again.',
});

export const passwordResetConfirmLimiter = createJsonLimiter({
    windowMs: 15 * 60 * 1000,
    max: 12,
    message: 'Too many password reset attempts. Please wait before trying again.',
});

export const symptomCheckLimiter = createJsonLimiter({
    windowMs: 60 * 1000,
    max: 20,
    message: 'Too many symptom checks. Please slow down and try again shortly.',
});

export const supportTicketLimiter = createJsonLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many support requests. Please wait before submitting another ticket.',
});

import User from "../Models/UserModel.js";
import AuditLog from "../Models/AuditLogModel.js";
import crypto from "node:crypto";
import Sessions from "../Models/SessionModel.js";
import {sendOTP, sendPasswordResetEmail} from "../Utils/emailService.js";
import Appointments from "../Models/AppointmentsModel.js";
import { appConfig } from "../Config/env.js";
import { isAdminRole, normalizeRole } from "../Utils/roles.js";
import {
    cleanupUploadedLicenseFiles,
    getUploadedLicenseFiles,
} from "../Middleware/uploadMiddleware.js";
import {
    clearAuthCookies,
    consumeGoogleAuthExchange,
    createGoogleAuthExchange,
    createGoogleOauthState,
    GOOGLE_CODE_QUERY_PARAM,
    GOOGLE_ERROR_QUERY_PARAM,
    issueAuthenticatedSession,
    readGoogleOauthState,
} from "../Utils/authSecurity.js";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_MAX_FAILED_ATTEMPTS = 5;
const OTP_LOCK_WINDOW_MS = 15 * 60 * 1000;
const OTP_MAX_SENDS_PER_WINDOW = 3;
const OTP_SEND_WINDOW_MS = 10 * 60 * 1000;
const PASSWORD_RESET_EXPIRY_MS = 30 * 60 * 1000;
const OTP_SELECT_FIELDS = "+otp +otpExpires +otpChallengeId +otpFailedAttempts +otpLockUntil +otpSendCount +otpSendWindowStartedAt";
const LOGIN_SELECT_FIELDS = `+passwordHashed ${OTP_SELECT_FIELDS}`;
const RESET_PASSWORD_SELECT_FIELDS = "+resetPasswordTokenHash +resetPasswordExpiresAt";
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_HASH_MIN_ROUNDS = 12;
const FRONTEND_AUTH_PATHS = Object.freeze({
    login: '/login',
    doctor_login: '/doctor-sign-in',
    admin_login: '/admin-login',
})
const AUTH_SOURCE_PAGES = new Set(['login', 'doctor_login', 'admin_login']);

const ALLOWED_DOCTOR_DEPARTMENTS = new Set([
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
]);

const generateOtpCode = () => crypto.randomInt(0, 1000000).toString().padStart(6, "0");

const generateOtpChallengeId = () => crypto.randomUUID();

const hashOtpCode = (challengeId, otpCode) =>
    crypto
        .createHmac("sha256", appConfig.jwtSecret)
        .update(`${String(challengeId || "")}:${String(otpCode || "")}`)
        .digest("hex");

const hashPasswordResetToken = (resetToken) =>
    crypto
        .createHmac("sha256", appConfig.jwtSecret)
        .update(String(resetToken || ""))
        .digest("hex");

const clearOtpChallenge = (user, { keepChallengeId = false, keepRateLimitWindow = false } = {}) => {
    user.otp = undefined;
    user.otpExpires = undefined;
    if (!keepChallengeId) {
        user.otpChallengeId = undefined;
    }
    user.otpFailedAttempts = 0;
    user.otpLockUntil = undefined;
    if (!keepRateLimitWindow) {
        user.otpSendCount = 0;
        user.otpSendWindowStartedAt = undefined;
    }
};

const clearPasswordResetState = (user) => {
    user.resetPasswordTokenHash = undefined;
    user.resetPasswordExpiresAt = undefined;
};

const isStrongPassword = (password) => PASSWORD_REGEX.test(String(password || ""));

const getPasswordHashRounds = (passwordHash) => {
    const hash = String(passwordHash || '')
    const match = /^\$2[abxy]?\$(\d{2})\$/.exec(hash)
    return match ? Number(match[1]) : 0
}

const shouldRehashPassword = (passwordHash) => {
    const rounds = getPasswordHashRounds(passwordHash)
    return rounds > 0 && rounds < PASSWORD_HASH_MIN_ROUNDS
}

const cleanupDoctorRegistrationUploads = async (req) => {
    await cleanupUploadedLicenseFiles(req).catch((error) => {
        console.warn('Failed to clean up doctor registration uploads:', error);
    });
};

const rejectDoctorRegistration = async (req, res, status, payload) => {
    await cleanupDoctorRegistrationUploads(req);
    return res.status(status).json(payload);
};

const resolveAuthSourcePage = (value) =>
    AUTH_SOURCE_PAGES.has(String(value || '').trim()) ? String(value).trim() : 'login';

const getAuthSourceLabel = (sourcePage) => {
    if (sourcePage === 'doctor_login') return 'doctor sign-in';
    if (sourcePage === 'admin_login') return 'admin sign-in';
    return 'patient sign-in';
};

const getExpectedAuthSourcePageForRole = (role) => {
    const normalizedRole = normalizeRole(role) || 'user';

    if (normalizedRole === 'doctor') {
        return 'doctor_login';
    }

    if (normalizedRole === 'admin' || normalizedRole === 'system_admin') {
        return 'admin_login';
    }

    return 'login';
};

const getAuthSourceMismatch = (user, sourcePage) => {
    const expectedSourcePage = getExpectedAuthSourcePageForRole(user?.role);
    const normalizedSourcePage = resolveAuthSourcePage(sourcePage);

    if (expectedSourcePage === normalizedSourcePage) {
        return null;
    }

    return {
        expectedSourcePage,
        message: `This account must sign in from the ${getAuthSourceLabel(expectedSourcePage)} page.`,
    };
};

const buildPasswordResetUrl = (resetToken, sourcePage = "login") => {
    const url = new URL("/forgot-password", appConfig.frontendUrl.replace(/\/$/, "") + "/");
    url.searchParams.set("reset", String(resetToken || ""));
    if (sourcePage) {
        url.searchParams.set("source", String(sourcePage));
    }
    return url.toString();
};

const resetOtpSendWindowIfNeeded = (user, now = new Date()) => {
    const startedAt = user.otpSendWindowStartedAt
        ? new Date(user.otpSendWindowStartedAt)
        : null;

    if (!startedAt || now.getTime() - startedAt.getTime() >= OTP_SEND_WINDOW_MS) {
        user.otpSendWindowStartedAt = now;
        user.otpSendCount = 0;
    }
};

const getRetryAfterSeconds = (targetTime, now = Date.now()) => {
    const remainingMs = new Date(targetTime).getTime() - now;
    return Math.max(1, Math.ceil(remainingMs / 1000));
};

const ensureOtpCanBeIssued = (user, now = new Date()) => {
    if (user.otpLockUntil && new Date(user.otpLockUntil).getTime() > now.getTime()) {
        const error = new Error("Too many invalid OTP attempts. Please try again later.");
        error.statusCode = 429;
        error.retryAfterSeconds = getRetryAfterSeconds(user.otpLockUntil, now.getTime());
        throw error;
    }

    resetOtpSendWindowIfNeeded(user, now);
    const sendCount = Number(user.otpSendCount || 0);
    if (sendCount >= OTP_MAX_SENDS_PER_WINDOW) {
        const windowEndsAt = new Date(user.otpSendWindowStartedAt).getTime() + OTP_SEND_WINDOW_MS;
        const error = new Error("Too many OTP requests. Please try again later.");
        error.statusCode = 429;
        error.retryAfterSeconds = getRetryAfterSeconds(windowEndsAt, now.getTime());
        throw error;
    }
};

const assignOtpChallenge = (user, { reuseChallengeId = false } = {}, now = new Date()) => {
    resetOtpSendWindowIfNeeded(user, now);
    const challengeId = reuseChallengeId && user.otpChallengeId
        ? user.otpChallengeId
        : generateOtpChallengeId();
    const otpCode = generateOtpCode();

    user.otp = hashOtpCode(challengeId, otpCode);
    user.otpExpires = new Date(now.getTime() + OTP_EXPIRY_MS);
    user.otpChallengeId = challengeId;
    user.otpFailedAttempts = 0;
    user.otpLockUntil = undefined;
    user.otpSendCount = Number(user.otpSendCount || 0) + 1;
    user.otpSendWindowStartedAt = user.otpSendWindowStartedAt || now;

    return { otpCode, challengeId };
};

const applyRetryAfter = (res, error) => {
    if (typeof error?.retryAfterSeconds === "number") {
        res.set("Retry-After", String(error.retryAfterSeconds));
    }
};

const resolveSourcePage = (value) =>
    value === 'doctor_login' || value === 'admin_login' || value === 'login'
        ? value
        : 'login'

const buildFrontendAuthUrl = (sourcePage, params = {}) => {
    const pathname = FRONTEND_AUTH_PATHS[resolveSourcePage(sourcePage)] || FRONTEND_AUTH_PATHS.login
    const url = new URL(pathname, appConfig.frontendUrl.replace(/\/$/, "") + "/");
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && String(value).trim()) {
            url.searchParams.set(key, String(value))
        }
    }
    return url.toString()
}

const buildAuthSessionUser = (user, session, authMethod = "local", { mfa = true } = {}) => ({
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: normalizeRole(user.role) || 'user',
    authMethod,
    mfa,
    sessionId: session._id,
})

export async function register(req, res) {
    try {
        const { email, firstName, lastName, password} = req.body;

        if (!firstName || !lastName || !password || !email) {
            return res.status(400).json({ message: "Missing Fields." });
        }

        const emailRegex = /^[a-zA-Z0-9._%+-]+@(gmail\.com|hotmail\.com|yahoo\.com|outlook\.com)$/i;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                message: "Email is invalid" 
            });
        }
        const emailExists = await User.findOne({ email });
        if (emailExists) {
            return res.status(409).json({ message: "Email is already registered." });
        }

        if (!isStrongPassword(password)) {
            return res.status(400).json({ 
                message: "Password must be at least 8 characters, include uppercase, lowercase, number, and a special character." 
            });
        }

        const user = new User({
            email: email,
            firstName: firstName,
            lastName: lastName,
        });
        await user.setPassword(password);
        await user.save();

        return res.status(201).json({ message: "Successfully registered." });
    } catch (error) {
        console.error("Registration Failed.");
        return res.status(500).json({ message: "Registration Failed." });
    }
}

export async function login(req, res) {
    try{
        const {email, password, sourcePage} = req.body;

        if(!email || !password) {
            return res.status(400).json({message: "Missing Fields."});
        }
        const user = await User.findOne({ email: email}).select(LOGIN_SELECT_FIELDS);

        if(!user || !(await user.validatePassword(password))) {
            return res.status(401).json({message: "Wrong password or Email. Please try again."});
        }
        if(user.status !== "active") {
            return res.status(401).json({message: "Account is disabled. Contact an Admin."});
        }

        const authSourceMismatch = getAuthSourceMismatch(user, sourcePage);
        if (authSourceMismatch) {
            return res.status(403).json(authSourceMismatch);
        }

        if (isAdminRole(user.role)) {
            clearOtpChallenge(user);
            if (shouldRehashPassword(user.passwordHashed)) {
                await user.setPassword(password);
            }
            await user.save();

            const { csrfToken, session } = await issueAuthenticatedSession(res, user);
            await AuditLog.create({
                userId: user._id,
                action: "LOGIN_SUCCESS",
                details: `Admin ${user.email} logged in successfully.`,
                ipAddress: req.ip || req.connection?.remoteAddress,
                userAgent: req.headers['user-agent']
            }).catch(() => {});

            return res.status(200).json({
                message: "Login successful.",
                user: buildAuthSessionUser(user, session, "local", { mfa: false }),
                csrfToken,
            });
        }

        const now = new Date();
        try {
            ensureOtpCanBeIssued(user, now);
        } catch (otpError) {
            applyRetryAfter(res, otpError);
            return res.status(otpError.statusCode || 429).json({ message: otpError.message });
        }

        const previousSendCount = Number(user.otpSendCount || 0);
        const previousWindowStart = user.otpSendWindowStartedAt;
        const { otpCode, challengeId } = assignOtpChallenge(user, { reuseChallengeId: false }, now);
        if (shouldRehashPassword(user.passwordHashed)) {
            await user.setPassword(password)
        }
        await user.save();
        
        let otpDelivery = null;
        try {
            otpDelivery = await sendOTP(user.email, otpCode);
        } catch (emailError) {
            console.error("Email sending failed:", emailError);
            clearOtpChallenge(user, { keepRateLimitWindow: true });
            user.otpSendCount = previousSendCount;
            user.otpSendWindowStartedAt = previousWindowStart;
            await user.save().catch(() => {});
            return res.status(500).json({ message: "Failed to send OTP. Please try again." });
        }

        return res.status(200).json({
            message: "OTP sent to your email. Please verify to complete login.",
            challengeId,
            expiresInSeconds: OTP_EXPIRY_MS / 1000,
            ...(otpDelivery?.preview && !appConfig.isProduction ? { otpPreview: otpDelivery.preview } : {}),
            requires2FA: true 
        });
    } catch (error){
        console.error("Login failed:", error);
        res.status(500).json({message: "Login failed."});
    }
}

export async function logout(req, res) {
    try {
        // Remove session record (if any) and clear cookie
        const token = req.cookies?.token || (req.headers.authorization || '').replace(/^Bearer\s+/, '') || null;
        if (token) {
            try {
                // find session to get userId for audit logging
                const session = await Sessions.findOne({
                    tokenHash: crypto.createHash("sha256").update(String(token || "")).digest("hex"),
                });
                if (session) {
                    // create audit log for logout
                    try {
                        await AuditLog.create({
                            userId: session.userId,
                            action: 'LOGOUT',
                            details: `User logged out (session ended)`,
                            ipAddress: req.ip,
                            userAgent: req.headers['user-agent']
                        });
                    } catch (logErr) {
                        console.warn('Failed to write logout audit log', logErr);
                    }

                    await Sessions.deleteOne({ _id: session._id });
                }
            } catch (e) {
                // non-fatal, continue to clear cookie
                console.warn('Failed to remove session record', e);
            }
        } else if (req.user?.id) {
            // If no token but request was authenticated and has user info, log logout
            try {
                const actor = await User.findById(req.user.id).select('email').lean();
                await AuditLog.create({
                    userId: req.user.id,
                    action: 'LOGOUT',
                    details: `User ${req.user.email || actor?.email || req.user.id} logged out`,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent']
                });
            } catch (logErr) {
                console.warn('Failed to write logout audit log', logErr);
            }
        }

        clearAuthCookies(res);

        return res.status(200).json({ message: "Logout successful." });
    } catch (error) {
        console.error("Logout error: ", error);
        return res.status(500).json({ message: "Logout failed." });
    }
}

export async function verifyOTP(req, res) {
    try {

        const { challengeId, otp } = req.body;

        if (!challengeId || !otp) {
            return res.status(400).json({ message: "Missing OTP challenge or OTP." });
        }

        const user = await User.findOne({ otpChallengeId: challengeId }).select(OTP_SELECT_FIELDS);

        if (!user) {
            return res.status(404).json({ message: "OTP challenge not found." });
        }

        if (user.otpLockUntil && new Date(user.otpLockUntil).getTime() > Date.now()) {
            const retryAfterSeconds = getRetryAfterSeconds(user.otpLockUntil);
            res.set("Retry-After", String(retryAfterSeconds));
            return res.status(429).json({ message: "Too many invalid OTP attempts. Please try again later." });
        }

        if (!user.otp || !user.otpExpires) {
            return res.status(400).json({ message: "OTP has expired. Please login again." });
        }

        if (new Date(user.otpExpires).getTime() < Date.now()) {
            clearOtpChallenge(user, { keepChallengeId: true, keepRateLimitWindow: true });
            await user.save();
            return res.status(400).json({ message: "OTP has expired. Please request a new code." });
        }

        const providedOtpHash = hashOtpCode(challengeId, otp);
        const isOtpValid = user.otp === providedOtpHash;

        if (!isOtpValid) {
            user.otpFailedAttempts = Number(user.otpFailedAttempts || 0) + 1;
            if (user.otpFailedAttempts >= OTP_MAX_FAILED_ATTEMPTS) {
                user.otp = undefined;
                user.otpExpires = undefined;
                user.otpLockUntil = new Date(Date.now() + OTP_LOCK_WINDOW_MS);
                await user.save();
                await AuditLog.create({
                    userId: user._id,
                    action: "OTP_LOCKOUT",
                    details: `OTP challenge locked for ${user.email}.`,
                    ipAddress: req.ip || req.connection?.remoteAddress,
                    userAgent: req.headers['user-agent']
                }).catch(() => {})
                const retryAfterSeconds = getRetryAfterSeconds(user.otpLockUntil);
                res.set("Retry-After", String(retryAfterSeconds));
                return res.status(429).json({ message: "Too many invalid OTP attempts. Please try again later." });
            }
            await user.save();
            return res.status(400).json({ message: "Invalid OTP." });
        }

        clearOtpChallenge(user);
        await user.save();
        const normalizedRole = normalizeRole(user.role) || 'user';
        const { csrfToken, session } = await issueAuthenticatedSession(res, user);
        await AuditLog.create({
            userId: user._id,
            action: "LOGIN_SUCCESS",
            details: `User ${user.email} logged in successfully via OTP.`,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
        });

        return res.status(200).json({
            message: "Login successful.",
            user: buildAuthSessionUser(user, session, user.googleId ? "google" : "local"),
            csrfToken,
        });
    } catch (error) {
        console.error("OTP Verification Error:", error);
        res.status(500).json({ message: "Verification failed." });   
    }
}

export async function resendOTP(req, res) {
    try {
        const { challengeId } = req.body;

        if (!challengeId) {
            return res.status(400).json({ message: "Missing OTP challenge." });
        }

        const user = await User.findOne({ otpChallengeId: challengeId }).select(OTP_SELECT_FIELDS);

        if (!user) {
            return res.status(404).json({ message: "OTP challenge not found." });
        }

        if (user.status !== "active") {
            return res.status(401).json({ message: "Account is disabled. Contact an Admin." });
        }

        const now = new Date();
        try {
            ensureOtpCanBeIssued(user, now);
        } catch (otpError) {
            applyRetryAfter(res, otpError);
            return res.status(otpError.statusCode || 429).json({ message: otpError.message });
        }

        const previousSendCount = Number(user.otpSendCount || 0);
        const previousWindowStart = user.otpSendWindowStartedAt;
        const { otpCode } = assignOtpChallenge(user, { reuseChallengeId: true }, now);
        await user.save();

        let otpDelivery = null;
        try {
            otpDelivery = await sendOTP(user.email, otpCode);
        } catch (emailError) {
            console.error("Email sending failed:", emailError);
            clearOtpChallenge(user, { keepChallengeId: true, keepRateLimitWindow: true });
            user.otpSendCount = previousSendCount;
            user.otpSendWindowStartedAt = previousWindowStart;
            await user.save().catch(() => {});
            return res.status(500).json({ message: "Failed to send OTP. Please try again." });
        }

        return res.status(200).json({
            message: "OTP resent to your email.",
            challengeId: user.otpChallengeId,
            expiresInSeconds: OTP_EXPIRY_MS / 1000,
            ...(otpDelivery?.preview && !appConfig.isProduction ? { otpPreview: otpDelivery.preview } : {}),
        });
    } catch (error) {
        console.error("Resend OTP Error:", error);
        res.status(500).json({ message: "Failed to resend OTP." });
    }
}

export async function requestPasswordReset(req, res) {
    try {
        const email = String(req.body?.email || "").trim().toLowerCase();
        const sourcePage = ["login", "doctor_login", "admin_login"].includes(String(req.body?.sourcePage || ""))
            ? String(req.body.sourcePage)
            : "login";

        if (!email) {
            return res.status(400).json({ message: "Email is required." });
        }

        const successPayload = {
            message: "If an account exists for that email, reset instructions were sent.",
        };

        const user = await User.findOne({ email }).select(`email status ${RESET_PASSWORD_SELECT_FIELDS}`);
        if (!user || user.status !== "active") {
            return res.status(200).json(successPayload);
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        user.resetPasswordTokenHash = hashPasswordResetToken(resetToken);
        user.resetPasswordExpiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);
        await user.save();

        const resetUrl = buildPasswordResetUrl(resetToken, sourcePage);
        const delivery = await sendPasswordResetEmail(user.email, resetUrl);

        await AuditLog.create({
            userId: user._id,
            action: "PASSWORD_RESET_REQUEST",
            details: `Password reset requested for ${user.email}.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });

        return res.status(200).json({
            ...successPayload,
            ...(delivery?.previewUrl && !appConfig.isProduction ? { previewUrl: delivery.previewUrl } : {}),
        });
    } catch (error) {
        console.error("Password reset request failed:", error);
        return res.status(500).json({ message: "Unable to start password reset right now." });
    }
}

export async function resetPassword(req, res) {
    try {
        const resetToken = String(req.body?.resetToken || "").trim();
        const newPassword = String(req.body?.newPassword || "");

        if (!resetToken || !newPassword) {
            return res.status(400).json({ message: "Reset token and new password are required." });
        }

        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({
                message: "Password must be at least 8 characters, include uppercase, lowercase, number, and a special character.",
            });
        }

        const tokenHash = hashPasswordResetToken(resetToken);
        const user = await User.findOne({
            resetPasswordTokenHash: tokenHash,
            resetPasswordExpiresAt: { $gt: new Date() },
        }).select(RESET_PASSWORD_SELECT_FIELDS);

        if (!user) {
            return res.status(400).json({ message: "This reset link is invalid or has expired." });
        }

        await user.setPassword(newPassword);
        clearOtpChallenge(user);
        clearPasswordResetState(user);
        await user.save();
        const revokedSessions = await Sessions.deleteMany({ userId: user._id });

        await AuditLog.create({
            userId: user._id,
            action: "PASSWORD_RESET_COMPLETE",
            details: `Password reset completed for ${user.email}.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
        await AuditLog.create({
            userId: user._id,
            action: "SESSIONS_REVOKED",
            details: `Password reset revoked ${revokedSessions.deletedCount || 0} sessions for ${user.email}.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        }).catch(() => {})

        return res.status(200).json({ message: "Password reset successful." });
    } catch (error) {
        console.error("Password reset failed:", error);
        return res.status(500).json({ message: "Unable to reset password right now." });
    }
}

export async function changePassword(req, res) {
    try {
        const userId = req.user?.id || req.user?._id;
        const currentPassword = String(req.body?.currentPassword || "");
        const newPassword = String(req.body?.newPassword || "");

        if (!userId) {
            return res.status(401).json({ message: "Invalid session." });
        }

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "Current password and new password are required." });
        }

        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({
                message: "New password must be at least 8 characters, include uppercase, lowercase, number, and a special character.",
            });
        }

        if (currentPassword === newPassword) {
            return res.status(400).json({ message: "New password must be different from the current password." });
        }

        const user = await User.findById(userId).select(`+passwordHashed ${RESET_PASSWORD_SELECT_FIELDS}`);
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        if (!user.passwordHashed || !String(user.passwordHashed).startsWith("$2")) {
            return res.status(400).json({ message: "Password change is not available for this account." });
        }

        const isCurrentPasswordValid = await user.validatePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({ message: "Current password is incorrect." });
        }

        await user.setPassword(newPassword);
        clearOtpChallenge(user);
        clearPasswordResetState(user);
        await user.save();

        const revokedSessions = await Sessions.deleteMany({ userId: user._id });
        clearAuthCookies(res)

        await AuditLog.create({
            userId: user._id,
            action: "PASSWORD_CHANGE",
            details: `Password changed for ${user.email}.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
        await AuditLog.create({
            userId: user._id,
            action: "SESSIONS_REVOKED",
            details: `Password change revoked ${revokedSessions.deletedCount || 0} sessions for ${user.email}.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        }).catch(() => {})

        return res.status(200).json({ message: "Password changed successfully.", requiresReauth: true });
    } catch (error) {
        console.error("Change password failed:", error);
        return res.status(500).json({ message: "Unable to change password right now." });
    }
}

export async function getSettings(req, res) {
    try {
        const userId = req.user?.id || req.user?._id
        if (!userId) return res.status(401).json({ message: 'Invalid session' })
        const user = await User.findById(userId).select('settings')
        if (!user) return res.status(404).json({ message: 'User not found' })
        return res.json({ settings: user.settings || {} })
    } catch (error) {
        console.error('Get settings failed', error)
        return res.status(500).json({ message: 'Failed to load settings' })
    }
}

export async function updateSettings(req, res) {
    try {
        const userId = req.user?.id || req.user?._id
        if (!userId) return res.status(401).json({ message: 'Invalid session' })
        const { settings } = req.body
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({ message: 'Invalid settings payload' })
        }

        // Only allow updating known keys
        const update = {}
        if (settings.theme === 'light' || settings.theme === 'dark') {
            update['settings.theme'] = settings.theme
        }
        if (settings.notifications && typeof settings.notifications === 'object') {
            update['settings.notifications.email'] = !!settings.notifications.email
            update['settings.notifications.sms'] = !!settings.notifications.sms
            update['settings.notifications.push'] = !!settings.notifications.push
            if (typeof settings.notifications.appointmentReminders === 'boolean') {
                update['settings.notifications.appointmentReminders'] = settings.notifications.appointmentReminders
            }
            if (typeof settings.notifications.securityAlerts === 'boolean') {
                update['settings.notifications.securityAlerts'] = settings.notifications.securityAlerts
            }
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: update },
            { returnDocument: 'after' }
        ).select('settings')
        if (!user) return res.status(404).json({ message: 'User not found' })
        return res.json({ settings: user.settings })
    } catch (error) {
        console.error('Update settings failed', error)
        return res.status(500).json({ message: 'Failed to update settings' })
    }
}

// DEBUG: Local helper to inspect a user record (development only)
export async function debugUser(req, res) {
    try {
        const email = String(req.query.email || '').toLowerCase()
        if (!email) return res.status(400).json({ message: 'email query required' })
        const user = await User.findOne({ email }).select('+passwordHashed settings')
        if (!user) return res.status(404).json({ message: 'User not found' })
        return res.json({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            status: user.status,
            hasPassword: !!user.passwordHashed,
            settings: user.settings || {},
        })
    } catch (err) {
        console.error('Debug user failed', err)
        return res.status(500).json({ message: 'Debug failed' })
    }
}

export async function googleCallback(req, res) {
    try {
        const user = req.user;
        const sourcePage = readGoogleOauthState(req.query?.state);

        if (!user) {
            return res.redirect(buildFrontendAuthUrl(sourcePage, {
                [GOOGLE_ERROR_QUERY_PARAM]: 'google_login_failed',
            }));
        }

        const authSourceMismatch = getAuthSourceMismatch(user, sourcePage);
        if (authSourceMismatch) {
            return res.redirect(buildFrontendAuthUrl(sourcePage, {
                [GOOGLE_ERROR_QUERY_PARAM]: 'account_route_mismatch',
            }));
        }

        const exchangeCode = await createGoogleAuthExchange(user._id, sourcePage);
        return res.redirect(buildFrontendAuthUrl(sourcePage, {
            [GOOGLE_CODE_QUERY_PARAM]: exchangeCode,
        }));

    } catch (error) {
        console.error("Google Auth Error:", error);
        return res.redirect(buildFrontendAuthUrl('login', {
            [GOOGLE_ERROR_QUERY_PARAM]: 'google_login_failed',
        }));
    }
}

export async function exchangeGoogleAuthCode(req, res) {
    try {
        const exchangeCode = String(req.body?.exchangeCode || '').trim()
        if (!exchangeCode) {
            return res.status(400).json({ message: 'Missing exchange code.' })
        }

        const exchange = await consumeGoogleAuthExchange(exchangeCode)
        if (!exchange) {
            return res.status(400).json({ message: 'Exchange code is invalid or expired.' })
        }

        const user = await User.findById(exchange.userId).select('email firstName lastName role googleId status')
        if (!user || user.status !== 'active') {
            return res.status(401).json({ message: 'Account is not available for sign in.' })
        }

        const authSourceMismatch = getAuthSourceMismatch(user, exchange.sourcePage);
        if (authSourceMismatch) {
            return res.status(403).json(authSourceMismatch);
        }

        const { csrfToken, session } = await issueAuthenticatedSession(res, user)

        await AuditLog.create({
            userId: user._id,
            action: "LOGIN_GOOGLE_EXCHANGE",
            details: `User ${user.email} completed Google OAuth exchange.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });

        return res.status(200).json({
            message: 'Google sign in successful.',
            user: buildAuthSessionUser(user, session, 'google'),
            csrfToken,
        })
    } catch (error) {
        console.error("Google exchange failed:", error);
        return res.status(500).json({ message: 'Unable to complete Google sign in right now.' })
    }
}

export async function registerDoctor(req, res) {
    try {
        const { email, firstName, lastName, password, department } = req.body;
        const licenseFiles = getUploadedLicenseFiles(req);
        const licensePaths = licenseFiles.map((file) => String(file.path || '').trim()).filter(Boolean);
        const normalizedDepartment = String(department || '').trim();

        if (!firstName || !lastName || !password || !email || !normalizedDepartment) {
            return rejectDoctorRegistration(req, res, 400, { message: "Missing required field" });
        }
        if (!ALLOWED_DOCTOR_DEPARTMENTS.has(normalizedDepartment)) {
            return rejectDoctorRegistration(req, res, 400, { message: "Selected doctor department is not allowed." });
        }
        if (licensePaths.length === 0) {
            return rejectDoctorRegistration(req, res, 400, {message: "At least one medical license file is required"})
        }
        const emailExists = await User.findOne({ email });
        if (emailExists) {
            return rejectDoctorRegistration(req, res, 409, { message: "Email is already registered." });
        }

        if (!isStrongPassword(password)) {
            return rejectDoctorRegistration(req, res, 400, {
                message: "Password must be at least 8 characters, include uppercase, lowercase, number, and a special character." 
            });
        }

        const doctor = new User({
            email,
            firstName,
            lastName,
            role: "doctor",
            department: normalizedDepartment,
            licenseUrl: licensePaths[0],
            licenseUrls: licensePaths,
            status: "disabled", // Prevents login until Admin verifies the license
            staffApplicationReviewed: false
        });

        await doctor.setPassword(password);
        await doctor.save();

        return res.status(201).json({ 
            message: "Doctor registration submitted successfully. Pending approval." 
        });

    } catch (error) {
        if (error?.code === 11000 && error?.keyPattern?.email) {
            return rejectDoctorRegistration(req, res, 409, { message: "Email is already registered." });
        }
        await cleanupDoctorRegistrationUploads(req);
        console.error("Doctor Registration Failed:", error);
        return res.status(500).json({ message: "Registration Failed." });
    }
}

export async function getMyProfile(req, res) {
    try {
        const userId = req.user?.id || req.user?._id
        if (!userId) return res.status(401).json({ message: 'Invalid session' })

        const user = await User.findById(userId).select(
            'email firstName lastName role status department profile personalHealthInfo'
        )
        if (!user) return res.status(404).json({ message: 'User not found' })

        return res.json({
            profile: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: normalizeRole(user.role) || 'user',
                status: user.status,
                department: user.department,
                ...(user.profile || {}),
            },
            personalHealthInfo: user.personalHealthInfo || {}
        })
    } catch (error) {
        console.error('Get profile failed', error)
        return res.status(500).json({ message: 'Failed to load profile' })
    }
}

export async function updateMyProfile(req, res) {
    try {
        const userId = req.user?.id || req.user?._id
        if (!userId) return res.status(401).json({ message: 'Invalid session' })

        const allowedRoot = ['firstName', 'lastName']
        const allowedProfile = ['dateOfBirth', 'phoneNumber', 'address', 'gender']
        const update = {}

        for (const key of allowedRoot) {
            if (Object.prototype.hasOwnProperty.call(req.body, key)) {
                update[key] = req.body[key]
            }
        }
        for (const key of allowedProfile) {
            if (Object.prototype.hasOwnProperty.call(req.body, key)) {
                update[`profile.${key}`] = req.body[key]
            }
        }

        if (Object.keys(update).length === 0) {
            return res.status(400).json({ message: 'No updatable fields provided.' })
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: update },
            { returnDocument: 'after' }
        )
            .select('email firstName lastName role status department profile')
        if (!user) return res.status(404).json({ message: 'User not found' })

        await AuditLog.create({
            userId,
            action: 'UPDATED_PROFILE',
            details: `User ${user.email} updated profile fields.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        })

        return res.json({
            message: 'Profile updated.',
            profile: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: normalizeRole(user.role) || 'user',
                status: user.status,
                department: user.department,
                ...(user.profile || {})
            }
        })
    } catch (error) {
        console.error('Update profile failed', error)
        return res.status(500).json({ message: 'Failed to update profile' })
    }
}

function sanitizeStringList(list) {
    if (!Array.isArray(list)) return undefined
    return list
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 50)
}

export async function upsertPersonalHealthInfo(req, res) {
    try {
        const userId = req.user?.id || req.user?._id
        if (!userId) return res.status(401).json({ message: 'Invalid session' })

        const incoming = req.body?.personalHealthInfo || req.body
        if (!incoming || typeof incoming !== 'object') {
            return res.status(400).json({ message: 'Invalid personal health info payload.' })
        }

        const listFields = ['allergies', 'medications', 'chronicConditions', 'surgeries']
        for (const field of listFields) {
            if (
                Object.prototype.hasOwnProperty.call(incoming, field) &&
                !Array.isArray(incoming[field])
            ) {
                return res.status(400).json({ message: `${field} must be an array.` })
            }
        }

        const payload = {
            bloodType: incoming.bloodType ? String(incoming.bloodType).trim() : undefined,
            allergies: sanitizeStringList(incoming.allergies),
            medications: sanitizeStringList(incoming.medications),
            chronicConditions: sanitizeStringList(incoming.chronicConditions),
            surgeries: sanitizeStringList(incoming.surgeries),
            notes: incoming.notes ? String(incoming.notes).trim() : undefined,
            updatedAt: new Date(),
        }

        if (incoming.emergencyContact && typeof incoming.emergencyContact === 'object') {
            payload.emergencyContact = {
                name: incoming.emergencyContact.name ? String(incoming.emergencyContact.name).trim() : undefined,
                phone: incoming.emergencyContact.phone ? String(incoming.emergencyContact.phone).trim() : undefined,
                relationship: incoming.emergencyContact.relationship ? String(incoming.emergencyContact.relationship).trim() : undefined,
            }
        }

        const setPayload = {}
        for (const [key, value] of Object.entries(payload)) {
            if (value !== undefined) {
                setPayload[`personalHealthInfo.${key}`] = value
            }
        }
        if (Object.keys(setPayload).length === 0) {
            return res.status(400).json({ message: 'No valid personal health info fields provided.' })
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: setPayload },
            { returnDocument: 'after' }
        ).select('email personalHealthInfo')

        if (!user) return res.status(404).json({ message: 'User not found' })

        await AuditLog.create({
            userId,
            action: 'UPSERT_PERSONAL_HEALTH_INFO',
            details: `User ${user.email} updated personal health information.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        })

        return res.status(200).json({
            message: 'Personal health information saved.',
            personalHealthInfo: user.personalHealthInfo || {}
        })
    } catch (error) {
        console.error('Upsert personal health info failed', error)
        return res.status(500).json({ message: 'Failed to save personal health information' })
    }
}

export async function getPatientMedicalProfile(req, res) {
    try {
        const actorId = req.user?.id || req.user?._id
        const actorRole = normalizeRole(req.user?.role) || 'user'
        const { patientId } = req.params
        if (!actorId) return res.status(401).json({ message: 'Invalid session' })

        if (!isAdminRole(actorRole)) {
            const appointment = await Appointments.findOne({
                doctor: actorId,
                patient: patientId
            }).select('_id')

            if (!appointment) {
                return res.status(403).json({ message: 'You do not have access to this patient record.' })
            }
        }

        const patient = await User.findById(patientId).select(
            'email firstName lastName profile personalHealthInfo status'
        )
        if (!patient) return res.status(404).json({ message: 'Patient not found' })

        await AuditLog.create({
            userId: actorId,
            action: 'VIEWED_PATIENT_MEDICAL_PROFILE',
            details: `${isAdminRole(actorRole) ? 'Admin' : 'Doctor'} viewed patient profile for patientId=${patientId}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        })

        return res.status(200).json({
            patient: {
                id: patient._id,
                email: patient.email,
                firstName: patient.firstName,
                lastName: patient.lastName,
                status: patient.status,
                ...(patient.profile || {}),
            },
            personalHealthInfo: patient.personalHealthInfo || {}
        })
    } catch (error) {
        console.error('Get patient medical profile failed', error)
        return res.status(500).json({ message: 'Failed to load patient profile' })
    }
}

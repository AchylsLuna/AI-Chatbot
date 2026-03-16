import User from "../Models/UserModel.js";
import AuditLog from "../Models/AuditLogModel.js";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import Sessions from "../Models/SessionModel.js";
import {sendOTP} from "../Utils/emailService.js";
import Appointments from "../Models/AppointmentsModel.js";
import { appConfig } from "../Config/env.js";
import { hashSessionToken } from "../Utils/sessionTokens.js";
import { isAdminRole, normalizeRole } from "../Utils/roles.js";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_MAX_FAILED_ATTEMPTS = 5;
const OTP_LOCK_WINDOW_MS = 15 * 60 * 1000;
const OTP_MAX_SENDS_PER_WINDOW = 3;
const OTP_SEND_WINDOW_MS = 10 * 60 * 1000;
const OTP_SELECT_FIELDS = "+otp +otpExpires +otpChallengeId +otpFailedAttempts +otpLockUntil +otpSendCount +otpSendWindowStartedAt";
const LOGIN_SELECT_FIELDS = `+passwordHashed ${OTP_SELECT_FIELDS}`;

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

const extractUploadedLicenses = (req) => {
    if (Array.isArray(req.files)) return req.files;
    if (req.files && typeof req.files === 'object') {
        const byField = req.files;
        return [
            ...(Array.isArray(byField.licenses) ? byField.licenses : []),
            ...(Array.isArray(byField.license) ? byField.license : []),
            ...(Array.isArray(byField.licenseFile) ? byField.licenseFile : []),
        ];
    }
    if (req.file) return [req.file];
    return [];
};

const generateOtpCode = () => crypto.randomInt(0, 1000000).toString().padStart(6, "0");

const generateOtpChallengeId = () => crypto.randomUUID();

const hashOtpCode = (challengeId, otpCode) =>
    crypto
        .createHmac("sha256", appConfig.jwtSecret)
        .update(`${String(challengeId || "")}:${String(otpCode || "")}`)
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

const persistSession = async (userId, token) => {
    const session = await Sessions.create({
        userId,
        tokenHash: hashSessionToken(token),
    });
    return session;
};

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

        // Require: min 8, at least one lower, one upper, one digit, and one non-alphanumeric (any special char)
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

        if (!passwordRegex.test(password)) {
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
        console.log("Login request body:", req.body.email);
        const {email, password} = req.body;

        if(!email || !password) {
            return res.status(400).json({message: "Missing Fields."});
        }
        // Search by phoneNumber or email
        const user = await User.findOne({ email: email}).select(LOGIN_SELECT_FIELDS);

        if(!user || !(await user.validatePassword(password))) {
            return res.status(401).json({message: "Wrong password or Email. Please try again."});
        }
        if(user.status !== "active") {
            return res.status(401).json({message: "Account is disabled. Contact an Admin."});
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
        console.log("Login request body:", req.body.email);
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
                    $or: [{ tokenHash: hashSessionToken(token) }, { token }],
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
                } else {
                    await Sessions.deleteMany({
                        $or: [{ tokenHash: hashSessionToken(token) }, { token }],
                    });
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

        res.clearCookie("token", {
            httpOnly: true,
            sameSite: "strict",
            secure: appConfig.isProduction
        });

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
        const isOtpValid = user.otp === providedOtpHash || user.otp === otp;

        if (!isOtpValid) {
            user.otpFailedAttempts = Number(user.otpFailedAttempts || 0) + 1;
            if (user.otpFailedAttempts >= OTP_MAX_FAILED_ATTEMPTS) {
                user.otp = undefined;
                user.otpExpires = undefined;
                user.otpLockUntil = new Date(Date.now() + OTP_LOCK_WINDOW_MS);
                await user.save();
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

        const token = jwt.sign(
            {id: user._id, role: normalizedRole, email: user.email},
            appConfig.jwtSecret,
            {expiresIn: "7d"}
        );
        const session = await persistSession(user._id, token);

        res.cookie("token", token, {
            httpOnly: true,
            secure: appConfig.isProduction,
            sameSite: "strict",
            maxAge: 7* 24 * 60 * 60 * 1000,
        });
        await AuditLog.create({
            userId: user._id,
            action: "LOGIN_SUCCESS",
            details: `User ${user.email} logged in successfully via OTP.`,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
        });

        return res.status(200).json({
            message: "Login successful.",
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: normalizedRole,
                authMethod: user.googleId ? "google" : "local",
                mfa: true,
                sessionId: session._id,
            }
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
        if (settings.notifications && typeof settings.notifications === 'object') {
            update['settings.notifications.email'] = !!settings.notifications.email
            update['settings.notifications.sms'] = !!settings.notifications.sms
            update['settings.notifications.push'] = !!settings.notifications.push
        }

        const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true }).select('settings')
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
        // Passport already put the user in req.user
        const user = req.user; 

        if (!user) {
            return res.redirect('/login-failed');
        }

        // 1. Generate Token
        const normalizedRole = normalizeRole(user.role) || 'user';
        const token = jwt.sign(
            { id: user._id, role: normalizedRole, email: user.email },
            appConfig.jwtSecret,
            { expiresIn: "7d" }
        );

        // 2. Create Session (This makes logout work!)
        await persistSession(user._id, token);
        await AuditLog.create({
            userId: user._id,
            action: "LOGIN_GOOGLE",
            details: `User ${user.email} logged in via Google OAuth.`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            
        });

        // 4. Set Cookie
        // For cross-site OAuth flows the cookie must be SameSite=None and Secure in production
        res.cookie('token', token, {
            httpOnly: true,
            secure: appConfig.isProduction,
            sameSite: appConfig.isProduction ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // 5. Redirect to Frontend
        return res.redirect(`${appConfig.frontendUrl.replace(/\/$/, '')}/appointments`);

    } catch (error) {
        console.error("Google Auth Error:", error);
        return res.redirect('/login-failed');
    }
}

export async function registerDoctor(req, res) {
    try {
        const { email, firstName, lastName, password, department } = req.body;
        const licenseFiles = extractUploadedLicenses(req);
        const licensePaths = licenseFiles.map((file) => String(file.path || '').trim()).filter(Boolean);
        const normalizedDepartment = String(department || '').trim();

        if (!firstName || !lastName || !password || !email || !normalizedDepartment) {
            return res.status(400).json({ message: "Missing required field" });
        }
        if (!ALLOWED_DOCTOR_DEPARTMENTS.has(normalizedDepartment)) {
            return res.status(400).json({ message: "Selected doctor department is not allowed." });
        }
        if (licensePaths.length === 0) {
            return res.status(400).json({message: "At least one medical license file is required"})
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

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({ 
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

        const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true })
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
            { new: true }
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

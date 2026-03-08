import User from "../Models/UserModel.js";
import AuditLog from "../Models/AuditLogModel.js";
import jwt from "jsonwebtoken";
import Sessions from "../Models/SessionModel.js";
import { sendOTP } from "../Utils/emailService.js";
import { appConfig } from "../Config/env.js";

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeRole = (role) => (role === "doctor" ? "nurse" : role);

const sanitizeEmail = (email) => String(email || "").trim().toLowerCase();

const issueOtpForUser = async (user) => {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otpCode;
    user.otpExpires = Date.now() + OTP_EXPIRY_MS;
    await user.save();

    const delivery = await sendOTP(user.email, otpCode);

    return {
        message: delivery.delivered
            ? "OTP sent to your email. Please verify to complete login."
            : "OTP generated for local login. Use the preview code to continue.",
        userId: user._id,
        requires2FA: true,
        otpPreview: appConfig.isProduction ? undefined : delivery.preview,
    };
};

const createJwtToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            role: normalizeRole(user.role),
        },
        appConfig.jwtSecret,
        { expiresIn: "7d" }
    );
};

const buildAuthResponse = (user, token, sessionId) => ({
    message: "Login successful.",
    token,
    user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.email,
        role: normalizeRole(user.role),
        authMethod: "otp",
        mfa: true,
        sessionId,
    },
});

export async function register(req, res) {
    try {
        const email = sanitizeEmail(req.body?.email);
        const firstName = String(req.body?.firstName || "").trim();
        const lastName = String(req.body?.lastName || "").trim();
        const password = String(req.body?.password || "");

        if (!firstName || !lastName || !password || !email) {
            return res.status(400).json({ message: "Missing Fields." });
        }

        if (!EMAIL_REGEX.test(email)) {
            return res.status(400).json({ message: "Email is invalid" });
        }

        if (!PASSWORD_REGEX.test(password)) {
            return res.status(400).json({
                message:
                    "Password must be at least 8 characters, include uppercase, lowercase, number, and a special character.",
            });
        }

        const emailExists = await User.findOne({ email });
        if (emailExists) {
            return res.status(409).json({ message: "Email is already registered." });
        }

        const user = new User({
            email,
            firstName,
            lastName,
            role: "user",
            status: "active",
        });

        await user.setPassword(password);
        await user.save();

        return res.status(201).json({ message: "Successfully registered." });
    } catch (error) {
        console.error("Registration failed", error);
        return res.status(500).json({ message: "Registration Failed." });
    }
}

export async function registerDoctor(req, res) {
    try {
        const email = sanitizeEmail(req.body?.email);
        const firstName = String(req.body?.firstName || "").trim();
        const lastName = String(req.body?.lastName || "").trim();
        const password = String(req.body?.password || "");
        const department = String(req.body?.department || "").trim();
        const licenseFile = req.file;

        if (!firstName || !lastName || !password || !email || !department) {
            return res.status(400).json({ message: "Missing required field" });
        }

        if (!licenseFile) {
            return res.status(400).json({ message: "Medical license file is required" });
        }

        if (!EMAIL_REGEX.test(email)) {
            return res.status(400).json({ message: "Email is invalid" });
        }

        if (!PASSWORD_REGEX.test(password)) {
            return res.status(400).json({
                message:
                    "Password must be at least 8 characters, include uppercase, lowercase, number, and a special character.",
            });
        }

        const emailExists = await User.findOne({ email });
        if (emailExists) {
            return res.status(409).json({ message: "Email is already registered." });
        }

        const nurseUser = new User({
            email,
            firstName,
            lastName,
            role: "nurse",
            department,
            licenseUrl: licenseFile.path,
            status: "disabled",
        });

        await nurseUser.setPassword(password);
        await nurseUser.save();

        return res.status(201).json({
            message: "Doctor registration submitted successfully. Pending approval.",
        });
    } catch (error) {
        console.error("Doctor registration failed", error);
        return res.status(500).json({ message: "Registration Failed." });
    }
}

export async function login(req, res) {
    try {
        const email = sanitizeEmail(req.body?.email);
        const password = String(req.body?.password || "");

        if (!email || !password) {
            return res.status(400).json({ message: "Missing Fields." });
        }

        const user = await User.findOne({ email }).select("+passwordHashed +otp +otpExpires");

        if (!user || !(await user.validatePassword(password))) {
            return res.status(401).json({ message: "Wrong password or Email. Please try again." });
        }

        if (user.status !== "active") {
            return res.status(401).json({ message: "Account is disabled. Contact an Admin." });
        }

        const payload = await issueOtpForUser(user);
        return res.status(200).json(payload);
    } catch (error) {
        console.error("Login failed", error);
        return res.status(500).json({ message: "Login failed." });
    }
}

export async function requestOtpChallenge(req, res) {
    try {
        const username = sanitizeEmail(req.body?.username);
        const email = sanitizeEmail(req.body?.email) || username;
        const password = String(req.body?.password || "");

        if (!email || !password) {
            return res.status(400).json({ message: "Missing Fields." });
        }

        const user = await User.findOne({ email }).select("+passwordHashed +otp +otpExpires");

        if (!user || !(await user.validatePassword(password))) {
            return res.status(401).json({ message: "Wrong password or Email. Please try again." });
        }

        if (user.status !== "active") {
            return res.status(401).json({ message: "Account is disabled. Contact an Admin." });
        }

        const payload = await issueOtpForUser(user);
        return res.status(200).json({
            challengeId: String(payload.userId),
            username: user.email,
            expiresAt: new Date(Date.now() + OTP_EXPIRY_MS).toISOString(),
            expiresInSeconds: OTP_EXPIRY_MS / 1000,
            otpPreview: payload.otpPreview,
        });
    } catch (error) {
        console.error("OTP challenge request failed", error);
        return res.status(500).json({ message: "Failed to request OTP challenge." });
    }
}

export async function verifyOTP(req, res) {
    try {
        const { userId, otp } = req.body || {};

        if (!userId || !otp) {
            return res.status(400).json({ message: "Missing userId or OTP." });
        }

        const user = await User.findById(userId).select("+otp +otpExpires");

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        if (String(user.otp || "") !== String(otp || "")) {
            return res.status(400).json({ message: "Invalid OTP." });
        }

        if (!user.otpExpires || user.otpExpires.getTime() < Date.now()) {
            return res.status(400).json({ message: "OTP has expired. Please login again." });
        }

        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        const token = createJwtToken(user);
        const session = await Sessions.create({
            userId: user._id,
            token,
        });

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        await AuditLog.create({
            userId: user._id,
            action: "LOGIN_SUCCESS",
            details: `User ${user.email} logged in successfully via OTP.`,
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.headers["user-agent"],
        });

        return res.status(200).json(buildAuthResponse(user, token, session._id?.toString?.() || null));
    } catch (error) {
        console.error("OTP verification failed", error);
        return res.status(500).json({ message: "Verification failed." });
    }
}

export async function resendOTP(req, res) {
    try {
        const { userId } = req.body || {};

        if (!userId) {
            return res.status(400).json({ message: "Missing userId." });
        }

        const user = await User.findById(userId).select("+otp +otpExpires");

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        if (user.status !== "active") {
            return res.status(401).json({ message: "Account is disabled. Contact an Admin." });
        }

        const payload = await issueOtpForUser(user);
        return res.status(200).json({
            message: "OTP resent to your email.",
            userId: payload.userId,
            otpPreview: payload.otpPreview,
        });
    } catch (error) {
        console.error("Resend OTP failed", error);
        return res.status(500).json({ message: "Failed to resend OTP." });
    }
}

export async function logout(req, res) {
    try {
        const token =
            req.cookies?.token ||
            (req.headers.authorization || "").replace(/^Bearer\s+/, "") ||
            null;

        if (token) {
            const session = await Sessions.findOne({ token });
            if (session) {
                try {
                    await AuditLog.create({
                        userId: session.userId,
                        action: "LOGOUT",
                        details: "User logged out (session ended)",
                        ipAddress: req.ip,
                        userAgent: req.headers["user-agent"],
                    });
                } catch (logErr) {
                    console.warn("Failed to write logout audit log", logErr);
                }
                await Sessions.deleteOne({ token });
            }
        }

        res.clearCookie("token", {
            httpOnly: true,
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            secure: process.env.NODE_ENV === "production",
        });

        return res.status(200).json({ message: "Logout successful." });
    } catch (error) {
        console.error("Logout failed", error);
        return res.status(500).json({ message: "Logout failed." });
    }
}

export async function getSession(req, res) {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ message: "Invalid session" });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        return res.json({
            username: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: normalizeRole(user.role),
            authMethod: "otp",
            mfa: true,
            sessionId: req.user?.sessionId || null,
        });
    } catch (error) {
        console.error("Session lookup failed", error);
        return res.status(500).json({ message: "Session lookup failed" });
    }
}

export async function getSettings(req, res) {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ message: "Invalid session" });

        const user = await User.findById(userId).select("settings");
        if (!user) return res.status(404).json({ message: "User not found" });

        return res.json({
            settings: user.settings || {
                notifications: { email: true, sms: false, push: true },
            },
        });
    } catch (error) {
        console.error("Get settings failed", error);
        return res.status(500).json({ message: "Failed to load settings" });
    }
}

export async function updateSettings(req, res) {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ message: "Invalid session" });

        const { settings } = req.body || {};
        if (!settings || typeof settings !== "object") {
            return res.status(400).json({ message: "Invalid settings payload" });
        }

        const update = {};
        if (settings.notifications && typeof settings.notifications === "object") {
            update["settings.notifications.email"] = !!settings.notifications.email;
            update["settings.notifications.sms"] = !!settings.notifications.sms;
            update["settings.notifications.push"] = !!settings.notifications.push;
        }

        const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true }).select("settings");
        if (!user) return res.status(404).json({ message: "User not found" });

        return res.json({ settings: user.settings });
    } catch (error) {
        console.error("Update settings failed", error);
        return res.status(500).json({ message: "Failed to update settings" });
    }
}

export async function updateProfile(req, res) {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ message: "Invalid session" });

        const rawFirstName = String(req.body?.firstName || "").trim();
        const rawLastName = String(req.body?.lastName || "").trim();
        const rawName = String(req.body?.name || "").trim();

        let firstName = rawFirstName;
        let lastName = rawLastName;

        if (!firstName && !lastName && rawName) {
            const [parsedFirstName, ...rest] = rawName.split(/\s+/).filter(Boolean);
            firstName = parsedFirstName || "";
            lastName = rest.join(" ") || "";
        }

        if (!firstName || !lastName) {
            return res.status(400).json({ message: "First name and last name are required." });
        }

        if (firstName.length > 30 || lastName.length > 30) {
            return res.status(400).json({ message: "First name and last name must be 30 characters or less." });
        }

        const user = await User.findByIdAndUpdate(
            userId,
            { $set: { firstName, lastName } },
            { new: true }
        );

        if (!user) return res.status(404).json({ message: "User not found" });

        return res.json({
            message: "Profile updated.",
            user: {
                username: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: normalizeRole(user.role),
            },
        });
    } catch (error) {
        console.error("Update profile failed", error);
        return res.status(500).json({ message: "Failed to update profile" });
    }
}

export async function updatePassword(req, res) {
    try {
        const userId = req.user?.id || req.user?._id;
        if (!userId) return res.status(401).json({ message: "Invalid session" });

        const currentPassword = String(req.body?.currentPassword || "");
        const newPassword = String(req.body?.newPassword || "");

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "Current password and new password are required." });
        }

        if (!PASSWORD_REGEX.test(newPassword)) {
            return res.status(400).json({
                message:
                    "Password must be at least 8 characters, include uppercase, lowercase, number, and a special character.",
            });
        }

        if (currentPassword === newPassword) {
            return res.status(400).json({ message: "New password must be different from current password." });
        }

        const user = await User.findById(userId).select("+passwordHashed");
        if (!user) return res.status(404).json({ message: "User not found" });

        const passwordMatches = await user.validatePassword(currentPassword);
        if (!passwordMatches) {
            return res.status(401).json({ message: "Current password is incorrect." });
        }

        await user.setPassword(newPassword);
        await user.save();

        return res.json({ message: "Password updated." });
    } catch (error) {
        console.error("Update password failed", error);
        return res.status(500).json({ message: "Failed to update password" });
    }
}

// DEBUG: Local helper to inspect a user record (development only)
export async function debugUser(req, res) {
    try {
        const email = sanitizeEmail(req.query?.email);
        if (!email) return res.status(400).json({ message: "email query required" });

        const user = await User.findOne({ email }).select("+passwordHashed settings");
        if (!user) return res.status(404).json({ message: "User not found" });

        return res.json({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: normalizeRole(user.role),
            status: user.status,
            hasPassword: !!user.passwordHashed,
            settings: user.settings || {},
        });
    } catch (error) {
        console.error("Debug user failed", error);
        return res.status(500).json({ message: "Debug failed" });
    }
}

export async function googleCallback(req, res) {
    const frontendBaseUrl = appConfig.frontendUrl.replace(/\/$/, "");
    try {
        const user = req.user;
        if (!user) {
            return res.redirect(`${frontendBaseUrl}/login`);
        }

        const token = createJwtToken(user);
        await Sessions.create({ userId: user._id, token });

        await AuditLog.create({
            userId: user._id,
            action: "LOGIN_GOOGLE",
            details: `User ${user.email} logged in via Google OAuth.`,
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
        });

        const isProd = process.env.NODE_ENV === "production";
        res.cookie("token", token, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? "none" : "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        const normalizedRole = normalizeRole(user.role);
        const redirectPath =
            normalizedRole === "user"
                ? "/appointments"
                : normalizedRole === "nurse"
                  ? "/doctor/dashboard"
                  : normalizedRole === "admin" || normalizedRole === "system_admin"
                    ? "/admin"
                    : "/login";

        return res.redirect(`${frontendBaseUrl}${redirectPath}`);
    } catch (error) {
        console.error("Google auth failed", error);
        return res.redirect(`${frontendBaseUrl}/login`);
    }
}

import User from "../Models/UserModel.js";
import AuditLog from "../Models/AuditLogModel.js";
import jwt from "jsonwebtoken";
import Sessions from "../Models/SessionModel.js";
import {sendOTP} from "../Utils/emailService.js";

export async function register(req, res) {
    try {
        const { email, firstName, lastName, password} = req.body;

        if (!firstName || !lastName || !password || !email) {
            return res.status(400).json({ message: "Missing Fields." });
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
        const user = await User.findOne({ email: email}).select("+passwordHashed");

        if(!user || !(await user.validatePassword(password))) {
            return res.status(401).json({message: "Wrong password or Email. Please try again."});
        }
        if(user.status !== "active") {
            return res.status(401).json({message: "Account is disabled. Contact an Admin."});
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

        user.otp = otpCode;
        user.otpExpires = Date.now() + 10 * 60 * 1000; 
        await user.save();
        
        try {
            await sendOTP(user.email, otpCode);
        } catch (emailError) {
            console.error("Email sending failed:", emailError);
            return res.status(500).json({ message: "Failed to send OTP. Please try again." });
        }

        return res.status(200).json({
            message: "OTP sent to your email. Please verify to complete login.",
            userId: user._id, // Send ID so client knows who is verifying
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
                const session = await Sessions.findOne({ token });
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
                }

                await Sessions.deleteOne({ token });
            } catch (e) {
                // non-fatal, continue to clear cookie
                console.warn('Failed to remove session record', e);
            }
        } else if (req.user?.id) {
            // If no token but request was authenticated and has user info, log logout
            try {
                await AuditLog.create({
                    userId: req.user.id,
                    action: 'LOGOUT',
                    details: `User logged out`,
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
            secure: process.env.NODE_ENV === 'production'
        });

        return res.status(200).json({ message: "Logout successful." });
    } catch (error) {
        console.error("Logout error: ", error);
        return res.status(500).json({ message: "Logout failed." });
    }
}

export async function verifyOTP(req, res) {
    try {

        const { userId, otp } = req.body;

        if (!userId || !otp) {
            return res.status(400).json({ message: "Missing userId or OTP." });
        }

        const user = await User.findById(userId).select('+otp +otpExpires');

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        if (user.otp !== otp) {
            return res.status(400).json({ message: "Invalid OTP." });
        }

        if (user.otpExpires < Date.now()) {
            return res.status(400).json({ message: "OTP has expired. Please login again." });
        }
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        const token = jwt.sign(
            {id: user._id, role: user.role},
            process.env.JWT_SECRET,
            {expiresIn: "7d"}
        );
        await Sessions.create({
            userId: user._id,
            token: token,
        });

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
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

        console.log("[Successful Login]:", req.body.email);

        return res.status(200).json({
            message: "Login successful.",
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("OTP Verification Error:", error);
        res.status(500).json({ message: "Verification failed." });   
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
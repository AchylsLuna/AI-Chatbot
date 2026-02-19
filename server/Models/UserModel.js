import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        googleId: {
            type: String,
            unique: true,
            sparse: true // Allows null/undefined values for non-Google users
        },
        firstName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 30,
        },
        lastName: {
            type: String,
            required: true,
            trim: true,
            maxLength: 30,
        },
        role: {
            type: String,
            set: (value) => (value === "doctor" ? "nurse" : value),
            enum: ["user", "nurse", "admin", "system_admin"],
            default: "user",
        },
        status: {
            type: String,
            enum: ["active", "disabled"],
            default: "active",
        },
        department: {
            type: String,
            trim: true,
            required: function() { return this.role === 'nurse'; }
        },
        licenseUrl: { // Or licensePath, depending on where you store it
            type: String,
            required: function() { return this.role === 'nurse'; }
        },
        passwordHashed: {
            type: String,
            required: false,
        },
        otp: {
            type: String,
            select: false
        },
        otpExpires: {
            type: Date,
            select: false
        }
        ,
        settings: {
            notifications: {
                email: { type: Boolean, default: true },
                sms: { type: Boolean, default: false },
                push: { type: Boolean, default: true },
            },
        }
    },
    { timestamps: true }
);
UserSchema.methods.setPassword = async function (password) {
    this.passwordHashed = await bcrypt.hash(password, 10);
};
UserSchema.methods.validatePassword = async function (password) {
    return bcrypt.compare(password, this.passwordHashed);
}

export default mongoose.model("User", UserSchema)

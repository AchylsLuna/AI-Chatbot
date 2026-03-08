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
            enum: ["user", "doctor", "nurse", "admin", "system_admin"],
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
            required: function() { return this.role === 'doctor' || this.role === 'nurse'; }
        },
        licenseUrl: { // Or licensePath, depending on where you store it
            type: String,
            required: function() { return this.role === 'doctor' || this.role === 'nurse'; }
        },
        licenseUrls: {
            type: [{ type: String, trim: true }],
            default: [],
        },
        staffApplicationReviewed: {
            type: Boolean,
            default: function() { return this.role !== 'doctor' && this.role !== 'nurse'; }
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
        },
        profile: {
            dateOfBirth: { type: Date },
            phoneNumber: { type: String, trim: true, maxlength: 30 },
            address: { type: String, trim: true, maxlength: 200 },
            gender: { type: String, trim: true, maxlength: 30 },
        },
        personalHealthInfo: {
            bloodType: { type: String, trim: true, maxlength: 10 },
            allergies: { type: [{ type: String, trim: true, maxlength: 120 }], default: [] },
            medications: { type: [{ type: String, trim: true, maxlength: 120 }], default: [] },
            chronicConditions: { type: [{ type: String, trim: true, maxlength: 120 }], default: [] },
            surgeries: { type: [{ type: String, trim: true, maxlength: 120 }], default: [] },
            emergencyContact: {
                name: { type: String, trim: true, maxlength: 80 },
                phone: { type: String, trim: true, maxlength: 30 },
                relationship: { type: String, trim: true, maxlength: 50 },
            },
            notes: { type: String, trim: true, maxlength: 1000 },
            updatedAt: { type: Date },
        }
    },
);
UserSchema.methods.setPassword = async function (password) {
    this.passwordHashed = await bcrypt.hash(password, 10);
};
UserSchema.methods.validatePassword = async function (password) {
    return bcrypt.compare(password, this.passwordHashed);
}

export default mongoose.model("User", UserSchema)

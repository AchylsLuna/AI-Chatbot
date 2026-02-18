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
            enum: ["user", "doctor", "admin"],
            default: "user",
        },
        status: {
            type: String,
            enum: ["active", "disabled"],
            default: "active",
        },
        passwordHashed: {
            type: String,
            required: true,
        },
        otp: {
            type: String,
            select: false
        },
        otpExpires: {
            type: Date,
            select: false
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
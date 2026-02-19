import mongoose from "mongoose";

const AccessRequestSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        organization: {
            type: String,
            default: "",
            trim: true,
        },
        roleRequested: {
            type: String,
            enum: ["user", "nurse", "admin", "system_admin"],
            default: "user",
        },
        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },
        notes: {
            type: String,
            trim: true,
        },
        reviewedAt: {
            type: Date,
            required: false,
        },
    },
    { timestamps: true }
);

AccessRequestSchema.index({ createdAt: -1 });
AccessRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("AccessRequest", AccessRequestSchema);

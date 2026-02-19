import mongoose from "mongoose";

const LedgerEntrySchema = new mongoose.Schema(
    {
        reservationId: {
            type: String,
            required: true,
            index: true,
            trim: true,
        },
        appointmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Appointments",
            required: false,
        },
        patientName: {
            type: String,
            required: true,
            trim: true,
        },
        department: {
            type: String,
            required: true,
            trim: true,
        },
        timestamp: {
            type: Date,
            default: Date.now,
            index: true,
        },
        hash: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        txHash: {
            type: String,
            trim: true,
        },
        txStatus: {
            type: String,
            enum: ["confirmed", "failed", "skipped"],
            default: "confirmed",
        },
        chainId: {
            type: String,
            default: "offchain-local",
            trim: true,
        },
        action: {
            type: String,
            enum: ["CREATED_APPOINTMENT", "UPDATED_APPOINTMENT"],
            required: true,
        },
        actorUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false,
        },
        details: {
            type: String,
            trim: true,
        },
    },
    { timestamps: false }
);

LedgerEntrySchema.index({ appointmentId: 1, timestamp: -1 });

export default mongoose.model("LedgerEntry", LedgerEntrySchema);

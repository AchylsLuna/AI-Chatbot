import mongoose from "mongoose";

const AppointmentsSchema = new mongoose.Schema(
    {
        patient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        doctor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false,
        },
        scheduledDate: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            enum: ["Booked", "Recorded", "Failed"],
            default: "Booked",
        },
        department: {
            type: String,
            required: true,
            trim: true,
        },
        reason: {
            type: String,
            default: "",
            trim: true,
        },
        symptoms: {
            type: String,
            required: true,
            trim: true,
        },
        priority: {
            type: String,
            enum: ["Low", "Routine", "High"],
            default: "Routine",
        },
        confidence: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.75,
        },
        summary: {
            type: String,
            required: true,
            trim: true,
        },
    },
    { timestamps: true }
);

AppointmentsSchema.index({ patient: 1, createdAt: -1 });
AppointmentsSchema.index({ doctor: 1, createdAt: -1 });

export default mongoose.model("Appointments", AppointmentsSchema)

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
            required: true,
        },
        scheduledDate: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            enum: ["Pending", "Confirmed", "Completed", "Cancelled"],
            default: "Pending",
        },
        department: {
            type: String,
            required: true,
        },
        reason: {
            type: String,
            required: true,
        },
        blockchainTxHash: {
        type: String,
        default: ""
        },
        soapNoteHashRecord: {
            type: String,
            default: ""
        },
        prescriptionsHashRecord: {
            type: String,
            default: ""
        },
    },
);

// Doctor workspace extensions appended for dashboard queue/triage/clinical actions.
AppointmentsSchema.add({
    queueStatus: {
        type: String,
        enum: ["Waiting", "Arrived", "In-Consultation", "Checked-Out", "No-Show"],
        default: "Waiting",
    },
    triageLevel: {
        type: String,
        enum: ["Low", "Routine", "High"],
        default: "Routine",
    },
    urgentFollowUp: {
        type: Boolean,
        default: false,
    },
    chiefComplaint: {
        type: String,
        default: "",
    },
    soapNote: {
        subjective: { type: String, default: "" },
        objective: { type: String, default: "" },
        assessment: { type: String, default: "" },
        plan: { type: String, default: "" },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        updatedAt: { type: Date },
    },
    prescriptions: [
        {
            medication: { type: String, required: true },
            dosage: { type: String, required: true },
            frequency: { type: String, default: "" },
            durationDays: { type: Number, min: 1, max: 365 },
            instructions: { type: String, default: "" },
            prescribedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            createdAt: { type: Date, default: Date.now },
        }
    ],
})

AppointmentsSchema.index({ doctor: 1, scheduledDate: 1, status: 1 })

export default mongoose.model("Appointments", AppointmentsSchema)

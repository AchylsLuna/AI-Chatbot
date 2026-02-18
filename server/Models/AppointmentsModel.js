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
        }
    },
);

export default mongoose.model("Appointments", AppointmentsSchema)
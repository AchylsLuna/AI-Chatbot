import mongoose from "mongoose";

const SupportTicketSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 80,
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            maxlength: 254,
        },
        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1200,
        },
        source: {
            type: String,
            enum: ["landing_page"],
            default: "landing_page",
        },
        status: {
            type: String,
            enum: ["open", "closed"],
            default: "open",
        },
    },
    { timestamps: true }
);

SupportTicketSchema.index({ createdAt: -1 });
SupportTicketSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("SupportTicket", SupportTicketSchema);

import mongoose from "mongoose";

const ErrorLogSchema = new mongoose.Schema({
    message: { type: String, required: true },
    stack: { type: String },
    route: { type: String },
    method: { type: String },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    ipAddress: { type: String },
    userAgent: { type: String },
    timestamp: {
        type: Date,
        default: Date.now,
        expires: '90d'
    }
});

export default mongoose.model("ErrorLog", ErrorLogSchema);

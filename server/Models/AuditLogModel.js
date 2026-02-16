import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: false
    },
    action: { 
        type: String, 
        required: true 
    },
    details: { 
        type: String 
    },
    ipAddress: { 
        type: String 
    },
    userAgent: { 
        type: String // Stores browser/device info
    },
    timestamp: { 
        type: Date, 
        default: Date.now,
        expires: '60d' // Auto-delete logs after 60 days to save space
    }
});

export default mongoose.model("AuditLog", AuditLogSchema);
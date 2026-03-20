import mongoose from "mongoose";

const AuthExchangeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    codeHash: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    sourcePage: {
        type: String,
        enum: ['login', 'doctor_login', 'admin_login'],
        default: 'login',
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 },
    },
})

export default mongoose.model("AuthExchange", AuthExchangeSchema)

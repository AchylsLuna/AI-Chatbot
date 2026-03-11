import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import helmet from 'helmet'; //security headers
import mongoSanitize from 'express-mongo-sanitize'; //Anti-NoSQL injection
import passport from 'passport'; 
import './Config/passport.js';
import ErrorLog from './Models/ErrorLogModel.js';
import User from './Models/UserModel.js';

import router from './Routes/Routes.js';

const app = express();

const config = {
    PORT: process.env.PORT || 5000,
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    ORIGIN: process.env.CLIENT_ORIGIN || process.env.ORIGIN || 'http://localhost:5173',
    DB_NAME: 'hospital_ai_blockchain',
};

if (!config.MONGO_URI) {
    console.error('MONGO_URI is not defined');
    process.exit(1);
}

if (!config.JWT_SECRET) {
    console.error('JWT_SECRET is not defined');
    process.exit(1);
}

// Security headers
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'none'"],
                baseUri: ["'none'"],
                formAction: ["'none'"],
                frameAncestors: ["'none'"],
            },
        },
    })
);

app.use(
    cors({
        origin: config.ORIGIN,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    })
);

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Initialize Passport
app.use(passport.initialize());

// Data sanitization
app.use(mongoSanitize());

app.use('/api', router);

app.use((err, req, res, next) => {
    console.error(`Error: ${err.message}`);

    // Best-effort centralized error logging for admin backup/audit workflows.
    ErrorLog.create({
        message: err.message || 'Unknown server error',
        stack: err.stack,
        route: req.originalUrl,
        method: req.method,
        userId: req.user?.id || req.user?._id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    }).catch((logErr) => {
        console.error('Failed to persist error log:', logErr.message);
    });

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: err.message || 'Internal Server Error',
    });
});

const startServer = async () => {
    try {
        await mongoose.connect(config.MONGO_URI, { dbName: config.DB_NAME });
        console.log('Connected to DB');

        // Migrate legacy nurse roles to doctor to keep auth flows consistent.
        const migrationResult = await User.updateMany(
            { role: 'nurse' },
            { $set: { role: 'doctor' } }
        );
        if (migrationResult?.modifiedCount) {
            console.log(`Migrated ${migrationResult.modifiedCount} nurse accounts to doctor.`);
        }

        app.listen(config.PORT, '0.0.0.0', () => {
            console.log(`Server is running on http://localhost:${config.PORT}`);
            console.log('Registered admin endpoints: GET /api/ledger, GET /api/admin/audit-logs, GET /api/admin/error-logs');
        });
    } catch (error) {
        console.error('Failed to connect to DB: ', error);
        process.exit(1);
    }
};

startServer();

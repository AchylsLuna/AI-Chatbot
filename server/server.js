import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import helmet from 'helmet'; //security headers
import mongoSanitize from 'express-mongo-sanitize'; //Anti-NoSQL injection
import passport from 'passport'; 
import './Config/passport.js';
import { appConfig } from './Config/env.js';
import ErrorLog from './Models/ErrorLogModel.js';
import User from './Models/UserModel.js';

import router from './Routes/Routes.js';

const app = express();
let inMemoryMongoServer = null;
let isUsingInMemoryMongo = appConfig.useInMemoryMongo;

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
        origin: appConfig.clientOrigin,
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

app.get('/api/health', (req, res) => {
    return res.status(200).json({
        ok: true,
        status: 'healthy',
        dbState: mongoose.connection.readyState,
        inMemoryMongo: isUsingInMemoryMongo,
    });
});

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

const connectOptions = {
    dbName: appConfig.dbName,
    serverSelectionTimeoutMS: appConfig.isProduction ? 30000 : 5000,
};

const createInMemoryMongo = async () => {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    inMemoryMongoServer = await MongoMemoryServer.create({
        binary: { version: '7.0.14' },
    });
    isUsingInMemoryMongo = true;
    console.log(`Using in-memory MongoDB at ${inMemoryMongoServer.getUri()}`);
    return inMemoryMongoServer.getUri();
};

const isLocalMongoUri = (mongoUri) => {
    return /^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(String(mongoUri || '').trim());
};

const shouldFallbackToInMemoryMongo = (mongoUri, error) => {
    if (appConfig.isProduction || appConfig.useInMemoryMongo || !isLocalMongoUri(mongoUri)) {
        return false;
    }

    const message = error instanceof Error ? error.message : String(error || '');
    return /ECONNREFUSED|MongooseServerSelectionError|Server selection timed out/i.test(message);
};

const connectToDatabase = async () => {
    let mongoUri = appConfig.mongoUri;

    if (appConfig.useInMemoryMongo) {
        mongoUri = await createInMemoryMongo();
    }

    try {
        await mongoose.connect(mongoUri, connectOptions);
    } catch (error) {
        if (!shouldFallbackToInMemoryMongo(mongoUri, error)) {
            throw error;
        }

        console.warn(
            `[DB] Unable to reach ${mongoUri}. Falling back to in-memory MongoDB for development.`
        );
        mongoUri = await createInMemoryMongo();
        await mongoose.connect(mongoUri, connectOptions);
    }

    console.log('Connected to DB');
};

const startServer = async () => {
    try {
        await connectToDatabase();

        // Migrate legacy nurse roles to doctor to keep auth flows consistent.
        const migrationResult = await User.updateMany(
            { role: 'nurse' },
            { $set: { role: 'doctor' } }
        );
        if (migrationResult?.modifiedCount) {
            console.log(`Migrated ${migrationResult.modifiedCount} nurse accounts to doctor.`);
        }

        app.listen(appConfig.port, '0.0.0.0', () => {
            console.log(`Server is running on http://localhost:${appConfig.port}`);
            console.log('Registered admin endpoints: GET /api/ledger, GET /api/admin/audit-logs, GET /api/admin/error-logs');
        });
    } catch (error) {
        console.error('Failed to connect to DB: ', error);
        process.exit(1);
    }
};

const stopInMemoryMongo = async () => {
    if (inMemoryMongoServer) {
        await inMemoryMongoServer.stop();
        inMemoryMongoServer = null;
    }
};

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        void stopInMemoryMongo().finally(() => process.exit(0));
    });
}

startServer();

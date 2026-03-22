import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import passport from 'passport';
import './Config/passport.js';
import { appConfig } from './Config/env.js';
import ErrorLog from './Models/ErrorLogModel.js';
import Sessions from './Models/SessionModel.js';
import User from './Models/UserModel.js';
import router from './Routes/Routes.js';
import { seedCoreUsers, shouldAutoSeedCoreUsers } from './Utils/coreUserSeeding.js';

let inMemoryMongoServer = null;
let isUsingInMemoryMongo = appConfig.useInMemoryMongo;

const allowedOrigins = new Set(appConfig.clientOrigins)

const createCorsOptions = () => ({
    origin: (origin, callback) => {
        if (!origin) {
            callback(null, true)
            return
        }

        if (allowedOrigins.has(origin)) {
            callback(null, true)
            return
        }

        const error = new Error('Origin is not allowed.')
        error.statusCode = 403
        error.expose = true
        callback(error)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['Retry-After'],
    maxAge: 10 * 60,
})

export const createApp = () => {
    const app = express();

    if (appConfig.isProduction) {
        app.set('trust proxy', 1);
    }

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
            hsts: appConfig.isProduction
                ? {
                    maxAge: 15552000,
                    includeSubDomains: true,
                    preload: true,
                }
                : false,
        })
    );

    app.use(cors(createCorsOptions()));
    app.use(express.json({ limit: '10kb' }));
    app.use(cookieParser());
    app.use(passport.initialize());
    app.use(mongoSanitize());
    app.use(hpp());

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
        void next;
        const statusCode = Number(err?.statusCode || err?.status || 500)
        const safeMessage =
            statusCode >= 400 && statusCode < 500 && err?.expose
                ? String(err.message || 'Request failed.')
                : statusCode >= 400 && statusCode < 500
                    ? String(err.message || 'Request failed.')
                    : 'Internal Server Error'

        if (statusCode >= 500) {
            console.error(`Error: ${err?.message || safeMessage}`);
        } else {
            console.warn(`Request warning: ${err?.message || safeMessage}`);
        }

        const requestPath = String(req.originalUrl || '').toLowerCase()
        const shouldLogRoute =
            requestPath.startsWith('/api/appointments') ||
            requestPath.startsWith('/api/doctor') ||
            requestPath.startsWith('/api/admin') ||
            requestPath.startsWith('/api/ledger') ||
            requestPath.startsWith('/api/symptoms') ||
            requestPath.includes('blockchain')

        if (shouldLogRoute && statusCode >= 400) {
            ErrorLog.create({
                message: safeMessage,
                stack: undefined,
                route: req.originalUrl,
                method: req.method,
                userId: req.user?.id || req.user?._id,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent']
            }).catch((logErr) => {
                console.error('Failed to persist error log:', logErr.message);
            });
        }

        res.status(statusCode).json({
            success: false,
            message: safeMessage,
        });
    });

    return app
}

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

export const connectToDatabase = async () => {
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

export const stopInMemoryMongo = async () => {
    if (inMemoryMongoServer) {
        await inMemoryMongoServer.stop();
        inMemoryMongoServer = null;
    }
};

const ensureSessionIndexes = async () => {
    try {
        const indexes = await Sessions.collection.indexes();
        const legacyIndex = indexes.find((index) => index.name === 'token_1');
        if (legacyIndex) {
            await Sessions.collection.dropIndex('token_1');
            console.warn('[DB] Dropped legacy Sessions token_1 index.');
        }

        const syncResult = await Sessions.syncIndexes();
        const syncedIndexes = Object.keys(syncResult || {});
        if (syncedIndexes.length > 0) {
            console.log(`[DB] Sessions indexes synced: ${syncedIndexes.join(', ')}`);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error || '');
        if (/ns not found/i.test(message)) {
            try {
                await Sessions.syncIndexes();
            } catch (syncError) {
                console.warn('[DB] Failed to sync Sessions indexes.', syncError);
            }
            return;
        }
        console.warn('[DB] Failed to inspect Sessions indexes.', error);
    }
};

export const startServer = async () => {
    const app = createApp()

    try {
        await connectToDatabase();
        await ensureSessionIndexes();

        const migrationResult = await User.updateMany(
            { role: 'nurse' },
            { $set: { role: 'doctor' } }
        );
        if (migrationResult?.modifiedCount) {
            console.log(`Migrated ${migrationResult.modifiedCount} nurse accounts to doctor.`);
        }

        if (shouldAutoSeedCoreUsers()) {
            const seededResults = await seedCoreUsers();
            const changedSeeds = seededResults.filter((result) => result.action !== 'unchanged');
            if (changedSeeds.length > 0) {
                const summary = changedSeeds
                    .map((result) => `${result.action}:${result.email}(${result.role})`)
                    .join(', ');
                console.log(`[Startup] Core accounts ready: ${summary}`);
            } else {
                console.log('[Startup] Core accounts already provisioned.');
            }
        }

        const server = app.listen(appConfig.port, '0.0.0.0', () => {
            console.log(`Server is running on http://localhost:${appConfig.port}`);
            console.log('Registered admin endpoints: GET /api/ledger, GET /api/admin/audit-logs, GET /api/admin/error-logs');
        });

        return server
    } catch (error) {
        console.error('Failed to connect to DB: ', error);
        process.exit(1);
    }
};

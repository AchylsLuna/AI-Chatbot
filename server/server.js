import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import mongoSanitize from 'express-mongo-sanitize'
import passport from 'passport'
import './Config/passport.js'
import { appConfig } from './Config/env.js'
import router from './Routes/Routes.js'

const app = express()
let inMemoryMongoServer = null

app.use(helmet())

app.use(
  cors({
    origin: appConfig.clientOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
)

app.use(express.json({ limit: '10kb' }))
app.use(cookieParser())
app.use(passport.initialize())
app.use((req, _res, next) => {
  // express-mongo-sanitize's default middleware writes into req.query,
  // which is read-only in Express 5. Sanitize only mutable payload sources.
  if (req.body && typeof req.body === 'object') {
    req.body = mongoSanitize.sanitize(req.body)
  }
  if (req.params && typeof req.params === 'object') {
    req.params = mongoSanitize.sanitize(req.params)
  }
  next()
})

app.use('/api', router)

app.use((err, req, res, next) => {
  console.error(`Error: ${err.message}`)
  const statusCode = err.statusCode || 500
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
  })
})

const startServer = async () => {
  try {
    try {
      await mongoose.connect(appConfig.mongoUri, { dbName: appConfig.dbName })
      console.log(`Connected to DB (${appConfig.mongoUri}/${appConfig.dbName})`)
    } catch (error) {
      if (!appConfig.useInMemoryMongo || appConfig.isProduction) {
        throw error
      }

      console.warn(
        `[db] MongoDB at ${appConfig.mongoUri} is unavailable. Starting in-memory MongoDB fallback.`
      )

      inMemoryMongoServer = await MongoMemoryServer.create({
        instance: {
          ip: '127.0.0.1',
          port: 27017,
          dbName: appConfig.dbName,
        },
      })

      const inMemoryUri = inMemoryMongoServer.getUri()
      await mongoose.connect(inMemoryUri, { dbName: appConfig.dbName })
      console.log(`[db] Connected to in-memory MongoDB (${inMemoryUri})`)
    }

    app.listen(appConfig.port, '0.0.0.0', () => {
      console.log(`Server is running on http://localhost:${appConfig.port}`)
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Failed to connect to DB: ${message}`)
    if (!appConfig.useInMemoryMongo) {
      console.error(
        'Set USE_IN_MEMORY_MONGO=true in server/.env for local fallback, or start MongoDB on localhost:27017.'
      )
    }
    process.exit(1)
  }
}

const shutdown = async () => {
  try {
    if (inMemoryMongoServer) {
      await inMemoryMongoServer.stop()
      inMemoryMongoServer = null
    }
  } catch {
    // ignore shutdown errors
  }
}

process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0))
})

process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0))
})

startServer()

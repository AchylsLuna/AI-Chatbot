import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { connectDb } from './src/config/db.js'
import apiRoutes from './src/routes/api.js'
import { seedUsers } from './src/services/authService.js'
import { seedDemoData } from './src/services/reservationService.js'

const PORT = process.env.PORT ? Number(process.env.PORT) : 5173
const CORS_ORIGIN = 'http://localhost:5173'

const app = express()

// Middleware
app.set('trust proxy', 1)
app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json({ limit: '1mb' }))

// Routes
app.get('/api/health', (_req, res) => res.json({ ok: true }))
app.use('/api', apiRoutes)

// Server Startup
const start = async () => {
  try {
    await connectDb()
    console.log('Database connected')

    // Seed Data
    await seedUsers()
    await seedDemoData()

    app.listen(PORT, () => {
      console.log(`API server running at http://localhost:${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

start()
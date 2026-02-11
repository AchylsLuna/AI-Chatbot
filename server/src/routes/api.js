import express from 'express'
import * as authController from '../controllers/authController.js'
import * as triageController from '../controllers/triageController.js'
import * as reservationController from '../controllers/reservationController.js'
import { requireAuth, requireRole } from '../src/middleware/auth.js'
import { authLimiter } from '../src/middleware/rateLimit.js'

const router = express.Router()

// Auth Routes
router.post('/auth/login', authLimiter, authController.login)
router.post('/auth/signup', authLimiter, authController.signup) // Fixed duplicate route
router.get('/auth/session', requireAuth, authController.getSession)

// Access Requests
router.post('/access-requests', authController.createAccessRequest)
router.get('/access-requests', requireAuth, requireRole(['admin', 'system_admin']), authController.getAccessRequests)

// Triage
router.post('/triage/summary', requireAuth, triageController.getSummary)

// Reservations & Ledger
router.get('/reservations', requireAuth, requireRole(['nurse', 'admin', 'system_admin']), reservationController.getReservations)
router.post('/reservations', reservationController.createReservation)
router.get('/ledger', requireAuth, requireRole(['nurse', 'admin', 'system_admin']), reservationController.getLedger)

export default router
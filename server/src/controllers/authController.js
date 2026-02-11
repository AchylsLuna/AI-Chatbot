import * as authService from '../src/services/authService.js'
import { getDb } from '../src/config/db.js'

export const login = async (req, res) => {
  const { username, password } = req.body || {}
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' })

  try {
    const session = await authService.loginUser(username, password, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    })
    res.json(session)
  } catch (error) {
    const status = error.message.includes('locked') ? 423 : 401
    res.status(status).json({ error: error.message })
  }
}

export const signup = async (req, res) => {
  try {
    const result = await authService.registerUser(req.body)
    res.status(201).json(result)
  } catch (error) {
    const status = error.message.includes('exists') ? 409 : 400
    res.status(status).json({ error: error.message })
  }
}

export const getSession = (req, res) => {
  res.json({ username: req.user.username, role: req.user.role })
}

export const createAccessRequest = async (req, res) => {
  try {
    const request = await authService.createAccessRequest(req.body)
    res.status(201).json({ request })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

export const getAccessRequests = async (_req, res) => {
  const db = getDb()
  const requests = await db.collection('access_requests').find().sort({ createdAt: -1 }).toArray()
  res.json({ requests })
}
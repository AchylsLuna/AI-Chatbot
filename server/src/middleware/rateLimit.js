const createRateLimiter = ({ windowMs, max }) => {
  const hits = new Map()
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`
    const now = Date.now()
    const record = hits.get(key)
    if (!record || now > record.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }
    if (record.count >= max) {
      return res.status(429).json({ error: 'Too many requests.' })
    }
    record.count++
    return next()
  }
}

export const authLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20 })
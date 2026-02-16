import crypto from 'node:crypto'

const DEFAULT_LIMITS = {
  windowMs: 60 * 1000,
  max: 120,
}
const TAG_REGEX = /<[^>]*>/g

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.ip
}

export const buildRequestContext = (req) => {
  return {
    requestId: req.requestId,
    ip: getClientIp(req),
    forwardedFor: req.headers['x-forwarded-for'] || null,
    userAgent: req.headers['user-agent'] || 'unknown',
  }
}

export const assignRequestId = (req, res, next) => {
  const header = req.headers['x-request-id']
  const generatedId =
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : crypto.randomBytes(16).toString('hex')
  const requestId = typeof header === 'string' && header.trim() ? header.trim() : generatedId
  req.requestId = requestId
  res.setHeader('x-request-id', requestId)
  next()
}

export const securityHeaders = (_req, res, next) => {
  res.setHeader('x-content-type-options', 'nosniff')
  res.setHeader('referrer-policy', 'no-referrer')
  res.setHeader('x-frame-options', 'DENY')
  res.setHeader('cross-origin-resource-policy', 'same-site')
  res.setHeader('cross-origin-opener-policy', 'same-origin')
  res.setHeader('permissions-policy', 'geolocation=(), microphone=(), camera=()')
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains')
  }
  next()
}

const buildLimiterKey = (req, keyGenerator) => {
  if (keyGenerator) return keyGenerator(req)
  return `${getClientIp(req)}:${req.path}`
}

const pruneOldEntries = (entries, now) => {
  for (const [key, record] of entries) {
    if (now > record.resetAt) {
      entries.delete(key)
    }
  }
}

export const createRateLimiter = (options = {}) => {
  const { windowMs, max, keyGenerator, name } = { ...DEFAULT_LIMITS, ...options }
  const hits = new Map()

  return (req, res, next) => {
    const now = Date.now()
    if (hits.size > max * 5) {
      pruneOldEntries(hits, now)
    }

    const key = buildLimiterKey(req, keyGenerator)
    const record = hits.get(key)
    if (!record || now > record.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs })
      return next()
    }

    if (record.count >= max) {
      res.setHeader('retry-after', Math.ceil((record.resetAt - now) / 1000))
      return res.status(429).json({
        error: 'Too many requests. Please try again later.',
        limiter: name || 'rate-limit',
      })
    }

    record.count += 1
    hits.set(key, record)
    return next()
  }
}

const sanitizePlainText = (value) => {
  if (typeof value !== 'string') return value
  const withoutControls = [...value]
    .filter((character) => {
      const code = character.charCodeAt(0)
      const isAsciiControl = code <= 31 || code === 127
      const isC1Control = code >= 128 && code <= 159
      return !isAsciiControl && !isC1Control
    })
    .join('')

  return withoutControls.replace(TAG_REGEX, '').trim()
}

const sanitizeValue = (value) => {
  if (typeof value === 'string') return sanitizePlainText(value)
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item))
  if (!value || typeof value !== 'object') return value

  const clean = {}
  for (const [key, item] of Object.entries(value)) {
    clean[key] = sanitizeValue(item)
  }
  return clean
}

export const sanitizeAiRequestBody = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body)
  }
  next()
}

export const sanitizeAiJsonResponse = (_req, res, next) => {
  const originalJson = res.json.bind(res)
  res.json = (payload) => originalJson(sanitizeValue(payload))
  next()
}

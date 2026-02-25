import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import passport from 'passport';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isGoogleAuthEnabled } from '../Config/passport.js';
import authMiddleware from '../Middleware/authMiddleware.js';
import { authorizeRoles } from '../Middleware/rbacMiddleware.js';
import { uploadLicense, handleUploadError } from '../Middleware/uploadMiddleware.js';
import { loginLimiter } from '../Middleware/rateLimiter.js';
import { appConfig } from '../Config/env.js';

import {
  register,
  registerDoctor,
  login,
  requestOtpChallenge,
  logout,
  verifyOTP,
  resendOTP,
  getSession,
  getSettings,
  updateSettings,
  updateProfile,
  updatePassword,
  debugUser,
  googleCallback,
} from '../Controllers/UserController.js';

import {
  createAppointment,
  getAppointments,
  getReservations,
  updateAppointment,
} from '../Controllers/AppointmentsController.js';

import {
  getAllUsers,
  getLedger,
  getAccessRequests,
  logAiAlertAction,
  downloadAuditBackup,
} from '../Controllers/adminController.js';

const router = Router();

/* =============================
   BASIC LOGGER
============================= */
router.use((req, _res, next) => {
  console.info('[routes] %s %s', req.method, req.originalUrl || req.url);
  next();
});

/* =============================
   DATASET LOADING (OPTIONAL)
============================= */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const datasetPath = path.resolve(__dirname, '..', '..', 'dataset', 'symptoms_cleaned.csv');
let datasetPreview = null;

(async () => {
  try {
    const raw = await readFile(datasetPath, { encoding: 'utf8' });
    datasetPreview = raw.slice(0, 16000);
    console.info('[gemini] Dataset loaded from', datasetPath);
  } catch {
    console.warn('[gemini] Dataset not found (continuing without it):', datasetPath);
    datasetPreview = null;
  }
})();

/* =============================
   VALIDATOR HELPER
============================= */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

/* =============================
   HEALTH CHECK
============================= */
router.get('/health', (_req, res) => res.json({ ok: true }));

/* =============================
   GEMINI: LIST MODELS
============================= */
router.get('/debug/gemini-models', async (_req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GENERATIVE_AI_API_KEY;
    if (!apiKey) return res.status(500).json({ ok: false, error: 'GEMINI_API_KEY not set' });

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
    const r = await fetch(url);
    const json = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({
        ok: false,
        error: json?.error?.message || `ListModels error (HTTP ${r.status})`,
        raw: json,
      });
    }

    return res.json({ ok: true, ...json });
  } catch (err) {
    console.error('[gemini] ListModels fatal:', err);
    return res.status(500).json({ ok: false, error: 'Failed to fetch models' });
  }
});

/* =============================
   GEMINI: MODEL PICKER
   - Picks a model that supports generateContent
============================= */
let cachedModelName = null;
let cachedModelFetchedAt = 0;

async function pickSupportedModel({ apiKey, preferredModel } = {}) {
  const now = Date.now();
  const cacheTtlMs = 5 * 60 * 1000; // 5 minutes

  // Use cache when possible
  if (!preferredModel && cachedModelName && now - cachedModelFetchedAt < cacheTtlMs) {
    return cachedModelName;
  }

  // If user asked a preferred model, try it first (no cache overwrite yet)
  if (preferredModel) {
    return preferredModel;
  }

  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const r = await fetch(listUrl);
  const json = await r.json();

  if (!r.ok) {
    const msg = json?.error?.message || `ListModels error (HTTP ${r.status})`;
    throw new Error(msg);
  }

  const models = Array.isArray(json?.models) ? json.models : [];

  // Find first model that supports generateContent
  const supported = models.find((m) => Array.isArray(m?.supportedGenerationMethods) &&
    m.supportedGenerationMethods.includes('generateContent')
  );

  if (!supported?.name) {
    throw new Error('No model available that supports generateContent for this API key.');
  }

  // supported.name is like "models/gemini-1.5-flash"
  // endpoint expects the same "models/xxx" part after /models/
  cachedModelName = supported.name.replace(/^models\//, '');
  cachedModelFetchedAt = now;

  return cachedModelName;
}

/* =============================
   GEMINI CHAT ROUTE (AUTO FIX)
============================= */
router.post('/debug/gemini-chat', async (req, res) => {
  try {
    const { prompt, useDataset = false, model } = req.body || {};

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing prompt string' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: 'GEMINI_API_KEY not set in .env' });
    }

    // Preferred model order:
    // 1) request body model
    // 2) env GEMINI_MODEL
    // 3) auto-pick via ListModels
    const preferred = model || process.env.GEMINI_MODEL || null;
    let modelName = null;

    try {
      modelName = await pickSupportedModel({ apiKey, preferredModel: preferred });
    } catch (e) {
      console.error('[gemini] model pick failed:', e?.message || e);
      return res.status(500).json({
        ok: false,
        error: `Model selection failed: ${e?.message || 'unknown error'}`,
      });
    }

    console.info('[gemini] using model=', modelName);

    const systemContext = [
      'You are an assistant for the AI Health Care system.',
      'Provide concise, practical guidance. If symptoms suggest emergency, advise emergency services.',
    ];

    if (useDataset && datasetPreview) {
      systemContext.push('Reference dataset (partial):');
      systemContext.push(datasetPreview);
    }

    const fullPrompt = `${systemContext.join('\n\n')}\n\nUser: ${prompt}`;

    const apiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const payload = {
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 512,
      },
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await response.json();
    console.info('[gemini] raw response keys=', Object.keys(json || {}));

    if (!response.ok) {
      console.error('[gemini ERROR]', json?.error?.message || json);

      // If env model is wrong, clear cache so next request re-picks
      cachedModelName = null;
      cachedModelFetchedAt = 0;

      return res.status(response.status).json({
        ok: false,
        error: json?.error?.message || `Gemini API error (HTTP ${response.status})`,
        raw: json,
        model: modelName,
      });
    }

    const parts = json?.candidates?.[0]?.content?.parts;
    const assistantText = Array.isArray(parts)
      ? parts.map((p) => p?.text).filter(Boolean).join('')
      : '';

    return res.json({
      ok: true,
      text: assistantText,
      raw: json,
      model: modelName,
    });
  } catch (err) {
    console.error('[gemini FATAL]', err);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

/* =============================
   GOOGLE OAUTH
============================= */
if (isGoogleAuthEnabled) {
  router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

  router.get(
    '/auth/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login-failed' }),
    googleCallback
  );
} else {
  const googleOauthDisabled = (_req, res) =>
    res.status(503).json({ message: 'Google OAuth is not configured on this server.' });

  router.get('/auth/google', googleOauthDisabled);
  router.get('/auth/google/callback', googleOauthDisabled);
}

/* =============================
   USER ROUTES
============================= */
router.post(
  '/register',
  [
    body('firstName').trim().notEmpty().escape().withMessage('First name is required'),
    body('lastName').trim().notEmpty().escape().withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 8 }).withMessage('Password too short'),
  ],
  validate,
  register
);

router.post(
  '/register/doctor',
  uploadLicense.single('license'),
  handleUploadError,
  [
    body('firstName').trim().notEmpty().escape().withMessage('First name is required'),
    body('lastName').trim().notEmpty().escape().withMessage('Last name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 8 }).withMessage('Password too short'),
    body('department').trim().notEmpty().escape().withMessage('Department is required'),
  ],
  validate,
  registerDoctor
);

router.post(
  '/login',
  loginLimiter,
  [body('email').isEmail().normalizeEmail(), body('password').exists()],
  validate,
  login
);

router.post(
  '/auth/otp/request',
  loginLimiter,
  [
    body('username').optional().isString(),
    body('email').optional().isEmail().normalizeEmail(),
    body('password').exists(),
  ],
  validate,
  requestOtpChallenge
);

router.post(
  '/verify-otp',
  [body('otp').trim().isLength({ min: 6, max: 6 }).escape(), body('userId').isMongoId()],
  validate,
  verifyOTP
);

router.post('/resend-otp', [body('userId').isMongoId()], validate, resendOTP);
router.post('/logout', authMiddleware, logout);
router.get('/session', authMiddleware, getSession);

/* =============================
   USER SETTINGS
============================= */
router.get('/users/me/settings', authMiddleware, getSettings);
router.put(
  '/users/me/settings',
  authMiddleware,
  [
    body('settings').optional().isObject(),
    body('settings.notifications.email').optional().isBoolean(),
    body('settings.notifications.sms').optional().isBoolean(),
    body('settings.notifications.push').optional().isBoolean(),
  ],
  validate,
  updateSettings
);

router.put(
  '/users/me/profile',
  authMiddleware,
  [
    body('name').optional().isString().trim().isLength({ min: 2, max: 60 }),
    body('firstName').optional().isString().trim().isLength({ min: 1, max: 30 }),
    body('lastName').optional().isString().trim().isLength({ min: 1, max: 30 }),
  ],
  validate,
  updateProfile
);

router.put(
  '/users/me/password',
  authMiddleware,
  [
    body('currentPassword').isString().notEmpty(),
    body('newPassword').isString().isLength({ min: 8 }),
  ],
  validate,
  updatePassword
);

if (appConfig.enableDebugRoutes) {
  router.get('/debug/user', authMiddleware, authorizeRoles('admin', 'system_admin'), debugUser);
}

/* =============================
   APPOINTMENT ROUTES
============================= */
router.get('/appointments', authMiddleware, getAppointments);
router.get('/reservations', authMiddleware, getReservations);

router.post(
  '/appointments',
  authMiddleware,
  authorizeRoles('user'),
  [
    body('doctorId').optional().isMongoId().withMessage('Invalid doctor ID'),
    body('scheduledDate').isISO8601().withMessage('Invalid date'),
    body('department').trim().notEmpty().escape(),
    body('reason').optional().trim(),
    body('note').optional().trim(),
  ],
  validate,
  createAppointment
);

router.patch(
  '/appointments/:id',
  authMiddleware,
  authorizeRoles('user', 'nurse', 'admin', 'system_admin'),
  [
    body('requestedTime').optional().isISO8601().withMessage('Invalid requestedTime'),
    body('status').optional().isString(),
    body('department').optional().isString(),
    body('priority').optional().isString(),
    body('summary').optional().isString(),
  ],
  validate,
  updateAppointment
);

/* =============================
   ADMIN/SUPPORT ROUTES
============================= */
router.get('/users', authMiddleware, authorizeRoles('admin', 'system_admin'), getAllUsers);
router.get('/ledger', authMiddleware, authorizeRoles('admin', 'system_admin'), getLedger);
router.get('/access-requests', authMiddleware, authorizeRoles('admin', 'system_admin'), getAccessRequests);
router.post('/audit/ai-alert-action', authMiddleware, logAiAlertAction);
router.get('/admin/audit-logs/download', authMiddleware, authorizeRoles('admin', 'system_admin'), downloadAuditBackup);

export default router;
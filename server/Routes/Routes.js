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
   CSV PARSER (LIGHTWEIGHT)
   - handles quoted commas
============================= */
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out.map((s) => s.trim());
}

function safeLower(s) {
  return String(s || '').toLowerCase();
}

/* =============================
   LOAD symptoms_cleaned.csv (FULL)
   - builds a searchable index
============================= */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const symptomsCsvPath = path.resolve(__dirname, '..', '..', 'dataset', 'symptoms_cleaned.csv');

let symptomsHeaders = [];
let symptomsRows = []; // array of objects
let symptomsIndex = []; // array of { text, row }

(async () => {
  try {
    const raw = await readFile(symptomsCsvPath, { encoding: 'utf8' });
    const lines = raw.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) throw new Error('CSV has no data rows');

    symptomsHeaders = parseCsvLine(lines[0]).map((h) => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      if (!cols.length) continue;

      const obj = {};
      for (let j = 0; j < symptomsHeaders.length; j++) {
        obj[symptomsHeaders[j]] = cols[j] ?? '';
      }
      rows.push(obj);
    }

    symptomsRows = rows;

    // index: concatenate all fields to searchable string
    symptomsIndex = rows.map((row) => {
      const joined = symptomsHeaders.map((h) => String(row[h] ?? '')).join(' | ');
      return { text: safeLower(joined), row };
    });

    console.info('[dataset] Loaded symptoms_cleaned.csv rows=', symptomsRows.length);
  } catch (e) {
    console.warn('[dataset] Failed to load symptoms_cleaned.csv:', e?.message || e);
    symptomsHeaders = [];
    symptomsRows = [];
    symptomsIndex = [];
  }
})();

/* =============================
   TRIAGE TREE LOAD
============================= */
const triageTreePath = path.resolve(__dirname, '..', 'dataset', 'triage_tree.json');
let triageTree = null;

(async () => {
  const fallbackPath = path.resolve(__dirname, '..', '..', 'dataset', 'triage_tree.json');
  try {
    const raw = await readFile(triageTreePath, { encoding: 'utf8' });
    triageTree = JSON.parse(raw);
    console.info('[triage] Loaded triage tree from', triageTreePath);
  } catch {
    try {
      const raw2 = await readFile(fallbackPath, { encoding: 'utf8' });
      triageTree = JSON.parse(raw2);
      console.info('[triage] Loaded triage tree from', fallbackPath);
    } catch (e) {
      console.warn('[triage] Could not load triage tree JSON. Triage endpoints will fail.');
      triageTree = null;
    }
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
   HEALTH
============================= */
router.get('/health', (_req, res) => res.json({ ok: true }));

/* =============================
   TRIAGE: DATASET SEARCH (HELPER)
============================= */
function classifyToCategory(text) {
  const t = safeLower(text);

  const hasChest = /(chest|pressure|tight|heart|palpitations)/.test(t);
  const hasBreath = /(shortness of breath|sob|breath|wheez|asthma|dyspnea)/.test(t);
  const hasFever = /(fever|chills|temp|temperature)/.test(t);
  const hasHead = /(headache|migraine|dizz|vertigo|faint|syncope|blurred vision)/.test(t);
  const hasStomach = /(abdominal|stomach|vomit|nausea|diarrhea|poop|stool)/.test(t);
  const hasInjury = /(bleeding|wound|injury|fracture|sprain|accident|cut)/.test(t);

  if (hasChest) return 'chest';
  if (hasBreath) return 'breathing';
  if (hasFever) return 'fever';
  if (hasHead) return 'headache';
  if (hasStomach) return 'stomach';
  if (hasInjury) return 'injury';
  return 'other';
}

function searchSymptomsDataset(query, limit = 6) {
  const q = safeLower(query).trim();
  if (!q) return [];

  // simple contains search (fast + good enough)
  const hits = [];
  for (let i = 0; i < symptomsIndex.length; i++) {
    const item = symptomsIndex[i];
    if (item.text.includes(q)) {
      hits.push(item.row);
      if (hits.length >= limit) break;
    }
  }
  return hits;
}

/* =============================
   TRIAGE API
============================= */
router.get('/triage/start', (_req, res) => {
  if (!triageTree) return res.status(500).json({ ok: false, error: 'Triage tree not loaded' });

  const startId = triageTree.start;
  const node = triageTree.nodes?.[startId];
  if (!node) return res.status(500).json({ ok: false, error: 'Invalid triage tree start node' });

  return res.json({ ok: true, nodeId: startId, node });
});

router.post('/triage/next', async (req, res) => {
  if (!triageTree) return res.status(500).json({ ok: false, error: 'Triage tree not loaded' });

  const { nodeId, answer } = req.body || {};
  if (!nodeId || typeof nodeId !== 'string') return res.status(400).json({ ok: false, error: 'Missing nodeId' });
  if (!answer || typeof answer !== 'string') return res.status(400).json({ ok: false, error: 'Missing answer' });

  // IMPORTANT: synthetic node isn't in triageTree.nodes, so handle it BEFORE lookup
  if (nodeId === 'q_dataset_pick') {
    const map = {
      chest: 'q1_chest_redflags',
      breathing: 'q1_breathing_redflags',
      fever: 'q1_fever',
      headache: 'q1_headache_redflags',
      stomach: 'q1_abdomen_redflags',
      injury: 'q1_injury_redflags',
      other: 'q_other',
    };
    const nextId = map[answer] || 'q_other';
    const nextNode = triageTree.nodes?.[nextId];
    if (!nextNode) return res.status(500).json({ ok: false, error: 'Missing next node in tree' });
    return res.json({ ok: true, done: false, nodeId: nextId, node: nextNode });
  }

  const node = triageTree.nodes?.[nodeId];
  if (!node) return res.status(400).json({ ok: false, error: 'Invalid nodeId' });

  // TEXT NODE: use CSV dataset search and suggest category -> show synthetic chooser
  if (node.type === 'text') {
    const matches = searchSymptomsDataset(answer, 6);
    const category = classifyToCategory(
      matches.length
        ? matches.map((r) => symptomsHeaders.map((h) => r[h]).join(' ')).join(' ')
        : answer
    );

    const previewLines = matches.slice(0, 3).map((row, idx) => {
      const line = symptomsHeaders
        .slice(0, 4)
        .map((h) => `${h}: ${String(row[h] ?? '').slice(0, 60)}`)
        .join(' | ');
      return `${idx + 1}) ${line}`;
    });

    const syntheticNode = {
      question:
        `Dataset suggestion:\n` +
        `I found ${matches.length} matching rows in your dataset.\n\n` +
        (previewLines.length ? `Top matches:\n${previewLines.join('\n')}\n\n` : '') +
        `Suggested path: ${category.toUpperCase()}.\nChoose one to continue:`,
      options: [
        { value: 'chest', label: 'Chest', next: 'q1_chest_redflags' },
        { value: 'breathing', label: 'Breathing', next: 'q1_breathing_redflags' },
        { value: 'fever', label: 'Fever', next: 'q1_fever' },
        { value: 'headache', label: 'Headache', next: 'q1_headache_redflags' },
        { value: 'stomach', label: 'Stomach', next: 'q1_abdomen_redflags' },
        { value: 'injury', label: 'Injury', next: 'q1_injury_redflags' },
        { value: 'other', label: 'Other', next: 'q_other' }
      ]
    };

    return res.json({ ok: true, done: false, nodeId: 'q_dataset_pick', node: syntheticNode });
  }

  // NORMAL single-choice node
  const opt = Array.isArray(node.options) ? node.options.find((o) => o.value === answer) : null;
  if (!opt?.next) return res.status(400).json({ ok: false, error: 'Invalid answer for this node' });

  const nextId = opt.next;

  // Outcome?
  if (triageTree.outcomes?.[nextId]) {
    return res.json({
      ok: true,
      done: true,
      outcomeId: nextId,
      outcome: triageTree.outcomes[nextId],
    });
  }

  // Next node
  const nextNode = triageTree.nodes?.[nextId];
  if (!nextNode) return res.status(500).json({ ok: false, error: 'Tree points to missing node/outcome' });

  return res.json({ ok: true, done: false, nodeId: nextId, node: nextNode });
});

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
   GEMINI: FALLBACK + MULTI-MODEL SUPPORT
   Env recommended:
   GEMINI_MODEL=
   GEMINI_MODEL_FAST=gemini-2.5-flash-lite
   GEMINI_MODEL_PRO=gemini-2.5-flash
   GEMINI_MODEL_LIST=gemini-2.5-flash-lite,gemini-2.5-flash,gemini-1.5-flash
============================= */
let cachedAvailableModels = null;
let cachedAvailableModelsAt = 0;

async function listAvailableModels(apiKey) {
  const ttlMs = 5 * 60 * 1000;
  const now = Date.now();

  if (cachedAvailableModels && now - cachedAvailableModelsAt < ttlMs) {
    return cachedAvailableModels;
  }

  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const r = await fetch(listUrl);
  const json = await r.json();

  if (!r.ok) {
    throw new Error(json?.error?.message || `ListModels error (HTTP ${r.status})`);
  }

  const models = Array.isArray(json?.models) ? json.models : [];
  const supported = models
    .filter(
      (m) =>
        typeof m?.name === 'string' &&
        Array.isArray(m?.supportedGenerationMethods) &&
        m.supportedGenerationMethods.includes('generateContent')
    )
    .map((m) => m.name.replace(/^models\//, ''));

  cachedAvailableModels = supported;
  cachedAvailableModelsAt = now;
  return supported;
}

function parseEnvModelList() {
  const base = (process.env.GEMINI_MODEL || '').trim();
  const fast = (process.env.GEMINI_MODEL_FAST || '').trim();
  const pro = (process.env.GEMINI_MODEL_PRO || '').trim();

  const list = String(process.env.GEMINI_MODEL_LIST || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const combined = [
    ...(base ? [base] : []),
    ...(fast ? [fast] : []),
    ...(pro ? [pro] : []),
    ...list,
  ];

  // de-dup, keep order
  return [...new Set(combined)];
}

function isRateLimitError(json, status) {
  const msg = json?.error?.message ? String(json.error.message).toLowerCase() : '';
  return status === 429 || msg.includes('quota') || msg.includes('rate') || msg.includes('resource exhausted');
}

function isModelNotFound(json, status) {
  const msg = json?.error?.message ? String(json.error.message).toLowerCase() : '';
  return status === 404 || msg.includes('not found') || msg.includes('is not supported') || msg.includes('not supported');
}

function isTransient(json, status) {
  const msg = json?.error?.message ? String(json.error.message).toLowerCase() : '';
  return status === 500 || status === 502 || status === 503 || msg.includes('unavailable') || msg.includes('timeout');
}

async function callGeminiWithFallback({
  apiKey,
  promptText,
  requestedModel,
  temperature = 0.2,
  maxOutputTokens = 512,
}) {
  const available = await listAvailableModels(apiKey);

  // preferred order:
  // 1) explicit requestedModel (client)
  // 2) env model list
  // 3) any available models
  const envList = parseEnvModelList();

  const ordered = [];

  if (requestedModel && available.includes(requestedModel)) ordered.push(requestedModel);

  for (const m of envList) {
    if (available.includes(m) && !ordered.includes(m)) ordered.push(m);
  }

  for (const m of available) {
    if (!ordered.includes(m)) ordered.push(m);
  }

  let last = null;

  for (const modelName of ordered) {
    const apiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const payload = {
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: { temperature, maxOutputTokens },
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await response.json();

    if (response.ok) {
      const parts = json?.candidates?.[0]?.content?.parts;
      const assistantText = Array.isArray(parts)
        ? parts.map((p) => p?.text).filter(Boolean).join('')
        : '';
      return { modelName, assistantText, raw: json };
    }

    last = { modelName, status: response.status, json };

    if (isModelNotFound(json, response.status) || isRateLimitError(json, response.status) || isTransient(json, response.status)) {
      console.warn('[gemini] model failed, trying next:', modelName, response.status, json?.error?.message);
      continue;
    }

    // non-retryable error
    break;
  }

  const errMsg =
    last?.json?.error?.message ||
    `Gemini failed. Last model tried: ${last?.modelName || 'unknown'} (HTTP ${last?.status || 'n/a'})`;

  const err = new Error(errMsg);
  err.details = last;
  throw err;
}

/* =============================
   GEMINI CHAT (WITH FALLBACK)
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

    const systemContext = [
      'You are an assistant for the AI Health Care system.',
      'Provide concise helpful answers and guidance.',
      'Do not provide a medical diagnosis. If emergency signs appear, advise emergency services.',
    ];

    if (useDataset && symptomsRows.length) {
      systemContext.push(`Dataset note: symptoms_cleaned.csv loaded with ${symptomsRows.length} rows.`);
    }

    const fullPrompt = `${systemContext.join('\n\n')}\n\nUser: ${prompt}`;

    const result = await callGeminiWithFallback({
      apiKey,
      promptText: fullPrompt,
      requestedModel: (model || '').trim() || null,
      temperature: 0.2,
      maxOutputTokens: 512,
    });

    return res.json({
      ok: true,
      text: result.assistantText,
      raw: result.raw,
      model: result.modelName,
    });
  } catch (err) {
    console.error('[gemini FATAL]', err?.message || err);
    return res.status(500).json({
      ok: false,
      error: err?.message || 'Internal server error',
      details: err?.details || null,
    });
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
   USER ROUTES (UNCHANGED)
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
   APPOINTMENTS
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
   ADMIN
============================= */
router.get('/users', authMiddleware, authorizeRoles('admin', 'system_admin'), getAllUsers);
router.get('/ledger', authMiddleware, authorizeRoles('admin', 'system_admin'), getLedger);
router.get('/access-requests', authMiddleware, authorizeRoles('admin', 'system_admin'), getAccessRequests);
router.post('/audit/ai-alert-action', authMiddleware, logAiAlertAction);
router.get('/admin/audit-logs/download', authMiddleware, authorizeRoles('admin', 'system_admin'), downloadAuditBackup);

export default router;
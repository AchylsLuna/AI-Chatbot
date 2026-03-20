import User from '../Models/UserModel.js'

const TRUTHY_VALUES = new Set(['1', 'true', 'yes', 'on'])
const FALSY_VALUES = new Set(['0', 'false', 'no', 'off'])
const AUTO_SEED_ENVIRONMENTS = new Set(['development', 'dev', 'local'])

const DEFAULT_CORE_ADMIN_PASSWORD = 'Admin123!'
const DEFAULT_CORE_DOCTOR_PASSWORD = 'Doctor123!'
const DEFAULT_CORE_USER_PASSWORD = 'User123!'

const normalizeNodeEnv = () => String(process.env.NODE_ENV || 'development').trim().toLowerCase()

const normalizeBooleanOverride = (value) => {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (TRUTHY_VALUES.has(normalized)) return true
  if (FALSY_VALUES.has(normalized)) return false
  return null
}

const allowDemoCredentials = () =>
  String(process.env.ALLOW_DEMO_CREDENTIALS || '').trim().toLowerCase() === 'true'

const normalizeEmail = (value, fallback) => String(value || fallback).trim().toLowerCase()
const normalizeText = (value, fallback) => String(value || fallback).trim()

const arraysEqual = (left, right) => {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

const applyDoctorFields = (user, seed) => {
  user.department = seed.department
  user.licenseUrl = seed.licenseUrl
  user.licenseUrls = [seed.licenseUrl]
  user.staffApplicationReviewed = true
}

const clearDoctorFields = (user) => {
  user.department = undefined
  user.licenseUrl = undefined
  user.licenseUrls = []
  user.staffApplicationReviewed = true
}

export const resolveCoreUserSeeds = () => [
  {
    key: 'admin',
    email: normalizeEmail(process.env.CORE_ADMIN_EMAIL, 'demo.admin@aihealthcare.com'),
    password: String(process.env.CORE_ADMIN_PASSWORD || DEFAULT_CORE_ADMIN_PASSWORD),
    passwordEnvKey: 'CORE_ADMIN_PASSWORD',
    defaultPassword: DEFAULT_CORE_ADMIN_PASSWORD,
    firstName: normalizeText(process.env.CORE_ADMIN_FIRST_NAME, 'System'),
    lastName: normalizeText(process.env.CORE_ADMIN_LAST_NAME, 'Admin'),
    role: process.env.CORE_ADMIN_ROLE === 'system_admin' ? 'system_admin' : 'admin',
    status: 'active',
  },
  {
    key: 'doctor',
    email: normalizeEmail(
      process.env.CORE_DOCTOR_EMAIL || process.env.CORE_NURSE_EMAIL,
      'demo.doctor@aihealthcare.com'
    ),
    password: String(
      process.env.CORE_DOCTOR_PASSWORD || process.env.CORE_NURSE_PASSWORD || DEFAULT_CORE_DOCTOR_PASSWORD
    ),
    passwordEnvKey: 'CORE_DOCTOR_PASSWORD',
    defaultPassword: DEFAULT_CORE_DOCTOR_PASSWORD,
    firstName: normalizeText(process.env.CORE_DOCTOR_FIRST_NAME || process.env.CORE_NURSE_FIRST_NAME, 'Demo'),
    lastName: normalizeText(process.env.CORE_DOCTOR_LAST_NAME || process.env.CORE_NURSE_LAST_NAME, 'Doctor'),
    role: 'doctor',
    status: 'active',
    department: normalizeText(
      process.env.CORE_DOCTOR_DEPARTMENT || process.env.CORE_NURSE_DEPARTMENT,
      'Internal Medicine'
    ),
    licenseUrl: normalizeText(
      process.env.CORE_DOCTOR_LICENSE_URL || process.env.CORE_NURSE_LICENSE_URL,
      '/uploads/licenses/placeholder-license.pdf'
    ),
  },
  {
    key: 'user',
    email: normalizeEmail(process.env.CORE_USER_EMAIL, 'demo.user@aihealthcare.com'),
    password: String(process.env.CORE_USER_PASSWORD || DEFAULT_CORE_USER_PASSWORD),
    passwordEnvKey: 'CORE_USER_PASSWORD',
    defaultPassword: DEFAULT_CORE_USER_PASSWORD,
    firstName: normalizeText(process.env.CORE_USER_FIRST_NAME, 'Demo'),
    lastName: normalizeText(process.env.CORE_USER_LAST_NAME, 'User'),
    role: 'user',
    status: 'active',
  },
]

export const shouldAutoSeedCoreUsers = () => {
  const override = normalizeBooleanOverride(process.env.AUTO_SEED_CORE_USERS)
  if (override !== null) return override
  return AUTO_SEED_ENVIRONMENTS.has(normalizeNodeEnv())
}

export const assertCoreUserSeedsAllowed = (seeds = resolveCoreUserSeeds()) => {
  if (AUTO_SEED_ENVIRONMENTS.has(normalizeNodeEnv()) || allowDemoCredentials()) {
    return
  }

  for (const seed of seeds) {
    if (seed.password === seed.defaultPassword) {
      throw new Error(
        `${seed.passwordEnvKey} must be set explicitly outside local environments. ` +
          'Set ALLOW_DEMO_CREDENTIALS=true only for controlled non-production testing.'
      )
    }
  }
}

export const upsertCoreUserSeed = async (seed) => {
  const existing = await User.findOne({ email: seed.email }).select('+passwordHashed')

  if (!existing) {
    const user = new User({
      email: seed.email,
      firstName: seed.firstName,
      lastName: seed.lastName,
      role: seed.role,
      status: seed.status,
      department: seed.role === 'doctor' ? seed.department : undefined,
      licenseUrl: seed.role === 'doctor' ? seed.licenseUrl : undefined,
      licenseUrls: seed.role === 'doctor' ? [seed.licenseUrl] : undefined,
      staffApplicationReviewed: seed.role === 'doctor' ? true : undefined,
    })

    await user.setPassword(seed.password)
    await user.save()
    return { action: 'created', email: seed.email, role: seed.role, key: seed.key }
  }

  const expectedLicenseUrls = seed.role === 'doctor' ? [seed.licenseUrl] : []
  const currentLicenseUrls = Array.isArray(existing.licenseUrls)
    ? existing.licenseUrls.map((value) => String(value || '').trim()).filter(Boolean)
    : []
  const passwordMatches = await existing.validatePassword(seed.password)
  const needsDoctorFields =
    seed.role === 'doctor'
      ? existing.department !== seed.department ||
        existing.licenseUrl !== seed.licenseUrl ||
        !arraysEqual(currentLicenseUrls, expectedLicenseUrls) ||
        existing.staffApplicationReviewed !== true
      : Boolean(existing.department) ||
        Boolean(existing.licenseUrl) ||
        currentLicenseUrls.length > 0 ||
        existing.staffApplicationReviewed !== true
  const needsUpdate =
    existing.firstName !== seed.firstName ||
    existing.lastName !== seed.lastName ||
    existing.role !== seed.role ||
    existing.status !== seed.status ||
    !passwordMatches ||
    needsDoctorFields

  if (!needsUpdate) {
    return { action: 'unchanged', email: seed.email, role: seed.role, key: seed.key }
  }

  existing.firstName = seed.firstName
  existing.lastName = seed.lastName
  existing.role = seed.role
  existing.status = seed.status
  if (seed.role === 'doctor') {
    applyDoctorFields(existing, seed)
  } else {
    clearDoctorFields(existing)
  }

  await existing.setPassword(seed.password)
  await existing.save()
  return { action: 'updated', email: seed.email, role: seed.role, key: seed.key }
}

export const seedCoreUsers = async () => {
  const seeds = resolveCoreUserSeeds()
  assertCoreUserSeedsAllowed(seeds)

  const results = []
  for (const seed of seeds) {
    results.push(await upsertCoreUserSeed(seed))
  }
  return results
}

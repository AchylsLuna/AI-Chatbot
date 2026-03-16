import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import User from '../Models/UserModel.js'

const envFilePath = fileURLToPath(new URL('../.env', import.meta.url))
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envFilePath)
  } catch {
    // no-op when .env is missing
  }
}

const MONGO_URI = process.env.MONGO_URI || process.env.MONGO || 'mongodb://localhost:27017/ai-chatbot'
const DB_NAME = process.env.DB_NAME || 'hospital_ai_blockchain'

const NODE_ENV = String(process.env.NODE_ENV || 'development').toLowerCase()
const ALLOW_DEMO_CREDENTIALS =
  String(process.env.ALLOW_DEMO_CREDENTIALS || '').toLowerCase() === 'true'
const IS_LOCAL_ENV = ['development', 'dev', 'local', 'test'].includes(NODE_ENV)

const DEFAULT_DOCTOR_PASSWORD = 'Doctor123!'
const DEFAULT_PATIENT_PASSWORD = 'User123!'

const ensurePasswordAllowed = (password, defaultPassword, envKey) => {
  if (!IS_LOCAL_ENV && !ALLOW_DEMO_CREDENTIALS && password === defaultPassword) {
    throw new Error(
      `${envKey} must be set explicitly outside local environments. ` +
        'Set ALLOW_DEMO_CREDENTIALS=true only for controlled non-production testing.'
    )
  }
}

const normalizeEmail = (value, fallback) => String(value || fallback).trim().toLowerCase()
const normalizeText = (value, fallback) => String(value || fallback).trim()

const applyDoctorFields = (user, account) => {
  user.department = account.department
  user.licenseUrl = account.licenseUrl
  user.licenseUrls = [account.licenseUrl]
  user.staffApplicationReviewed = true
}

const clearDoctorFields = (user) => {
  user.department = undefined
  user.licenseUrl = undefined
  user.licenseUrls = []
  user.staffApplicationReviewed = true
}

export const resolveDoctorAccount = () => {
  const password = String(process.env.DOCTOR_PASSWORD || DEFAULT_DOCTOR_PASSWORD)
  ensurePasswordAllowed(password, DEFAULT_DOCTOR_PASSWORD, 'DOCTOR_PASSWORD')

  return {
    email: normalizeEmail(process.env.DOCTOR_EMAIL, 'demo.doctor@aihealthcare.com'),
    password,
    firstName: normalizeText(process.env.DOCTOR_FIRST_NAME, 'Demo'),
    lastName: normalizeText(process.env.DOCTOR_LAST_NAME, 'Doctor'),
    role: 'doctor',
    status: 'active',
    department: normalizeText(process.env.DOCTOR_DEPARTMENT, 'Internal Medicine'),
    licenseUrl: normalizeText(
      process.env.DOCTOR_LICENSE_URL,
      '/uploads/licenses/placeholder-license.pdf'
    ),
  }
}

export const resolvePatientAccount = () => {
  const password = String(process.env.PATIENT_PASSWORD || DEFAULT_PATIENT_PASSWORD)
  ensurePasswordAllowed(password, DEFAULT_PATIENT_PASSWORD, 'PATIENT_PASSWORD')

  return {
    email: normalizeEmail(process.env.PATIENT_EMAIL, 'demo.user@aihealthcare.com'),
    password,
    firstName: normalizeText(process.env.PATIENT_FIRST_NAME, 'Demo'),
    lastName: normalizeText(process.env.PATIENT_LAST_NAME, 'User'),
    role: 'user',
    status: 'active',
  }
}

export const connectProvisioningDatabase = async () => {
  console.log('Connecting to', MONGO_URI, 'dbName=', DB_NAME)
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME })
  console.log('Connected to mongo db:', mongoose.connection.name)
  return { mongoUri: MONGO_URI, dbName: DB_NAME }
}

export const disconnectProvisioningDatabase = async () => {
  await mongoose.disconnect()
}

const upsertAccount = async (account) => {
  const existing = await User.findOne({ email: account.email })

  if (existing) {
    existing.email = account.email
    existing.firstName = account.firstName
    existing.lastName = account.lastName
    existing.role = account.role
    existing.status = 'active'

    if (account.role === 'doctor') {
      applyDoctorFields(existing, account)
    } else {
      clearDoctorFields(existing)
    }

    await existing.setPassword(account.password)
    await existing.save()

    return { action: 'updated', ...account }
  }

  const user = new User({
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    role: account.role,
    status: 'active',
    department: account.role === 'doctor' ? account.department : undefined,
    licenseUrl: account.role === 'doctor' ? account.licenseUrl : undefined,
    licenseUrls: account.role === 'doctor' ? [account.licenseUrl] : undefined,
    staffApplicationReviewed: account.role === 'doctor' ? true : undefined,
  })

  await user.setPassword(account.password)
  await user.save()

  return { action: 'created', ...account }
}

export const upsertDoctorAccount = async (account = resolveDoctorAccount()) => {
  return upsertAccount(account)
}

export const upsertPatientAccount = async (account = resolvePatientAccount()) => {
  return upsertAccount(account)
}

export const printProvisioningSummary = (results, dbName = DB_NAME) => {
  console.log('')
  console.log('Saved accounts')
  console.log(`Database: ${dbName}`)
  for (const result of results) {
    const label = result.role === 'doctor' ? 'Doctor' : 'Patient'
    console.log(`${label}: ${result.action}`)
    console.log(`  Email: ${result.email}`)
    console.log(`  Password: ${result.password}`)
  }
}

import assert from 'node:assert/strict'
import test, { after, before, beforeEach } from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-super-secret-value-1234567890'
process.env.BACKUP_PASSWORD = 'test-backup-password-1234567890'

const { default: User } = await import('../Models/UserModel.js')
const {
  seedCoreUsers,
  shouldAutoSeedCoreUsers,
} = await import('../Utils/coreUserSeeding.js')

let mongoServer

const trackedEnvKeys = [
  'NODE_ENV',
  'AUTO_SEED_CORE_USERS',
  'ALLOW_DEMO_CREDENTIALS',
  'CORE_ADMIN_EMAIL',
  'CORE_ADMIN_PASSWORD',
  'CORE_ADMIN_FIRST_NAME',
  'CORE_ADMIN_LAST_NAME',
  'CORE_ADMIN_ROLE',
  'CORE_DOCTOR_EMAIL',
  'CORE_DOCTOR_PASSWORD',
  'CORE_DOCTOR_FIRST_NAME',
  'CORE_DOCTOR_LAST_NAME',
  'CORE_DOCTOR_DEPARTMENT',
  'CORE_DOCTOR_LICENSE_URL',
  'CORE_USER_EMAIL',
  'CORE_USER_PASSWORD',
  'CORE_USER_FIRST_NAME',
  'CORE_USER_LAST_NAME',
]

const originalEnv = new Map(trackedEnvKeys.map((key) => [key, process.env[key]]))

const restoreTrackedEnv = () => {
  for (const [key, value] of originalEnv.entries()) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri(), {
    dbName: 'ai_chatbot_core_user_seed_test',
  })
})

after(async () => {
  restoreTrackedEnv()
  await mongoose.disconnect()
  await mongoServer.stop()
})

beforeEach(async () => {
  restoreTrackedEnv()
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({})
    )
  )
})

test('shouldAutoSeedCoreUsers defaults on in local development and honors explicit overrides', () => {
  process.env.NODE_ENV = 'development'
  delete process.env.AUTO_SEED_CORE_USERS
  assert.equal(shouldAutoSeedCoreUsers(), true)

  process.env.AUTO_SEED_CORE_USERS = 'false'
  assert.equal(shouldAutoSeedCoreUsers(), false)

  process.env.NODE_ENV = 'production'
  process.env.AUTO_SEED_CORE_USERS = 'true'
  assert.equal(shouldAutoSeedCoreUsers(), true)
})

test('seedCoreUsers provisions and updates the configured core accounts', async () => {
  process.env.NODE_ENV = 'development'
  delete process.env.AUTO_SEED_CORE_USERS
  delete process.env.ALLOW_DEMO_CREDENTIALS

  process.env.CORE_ADMIN_EMAIL = 'startup.admin@example.com'
  process.env.CORE_ADMIN_PASSWORD = 'Admin123!'
  process.env.CORE_ADMIN_FIRST_NAME = 'System'
  process.env.CORE_ADMIN_LAST_NAME = 'Admin'
  process.env.CORE_ADMIN_ROLE = 'admin'

  process.env.CORE_DOCTOR_EMAIL = 'startup.doctor@example.com'
  process.env.CORE_DOCTOR_PASSWORD = 'Doctor123!'
  process.env.CORE_DOCTOR_FIRST_NAME = 'Startup'
  process.env.CORE_DOCTOR_LAST_NAME = 'Doctor'
  process.env.CORE_DOCTOR_DEPARTMENT = 'Internal Medicine'
  process.env.CORE_DOCTOR_LICENSE_URL = '/tmp/startup-license.pdf'

  process.env.CORE_USER_EMAIL = 'startup.user@example.com'
  process.env.CORE_USER_PASSWORD = 'User123!'
  process.env.CORE_USER_FIRST_NAME = 'Startup'
  process.env.CORE_USER_LAST_NAME = 'User'

  const firstRun = await seedCoreUsers()
  assert.deepEqual(firstRun.map((result) => result.action), ['created', 'created', 'created'])

  const admin = await User.findOne({ email: 'startup.admin@example.com' }).select('+passwordHashed')
  const doctor = await User.findOne({ email: 'startup.doctor@example.com' }).select('+passwordHashed')
  const user = await User.findOne({ email: 'startup.user@example.com' }).select('+passwordHashed')

  assert.equal(admin?.role, 'admin')
  assert.equal(doctor?.role, 'doctor')
  assert.equal(user?.role, 'user')
  assert.equal(await admin?.validatePassword('Admin123!'), true)
  assert.equal(await doctor?.validatePassword('Doctor123!'), true)
  assert.equal(await user?.validatePassword('User123!'), true)
  assert.equal(doctor?.department, 'Internal Medicine')
  assert.equal(doctor?.licenseUrl, '/tmp/startup-license.pdf')
  assert.deepEqual(doctor?.licenseUrls, ['/tmp/startup-license.pdf'])
  assert.equal(doctor?.staffApplicationReviewed, true)

  const secondRun = await seedCoreUsers()
  assert.ok(secondRun.every((result) => result.action === 'unchanged'))

  process.env.CORE_DOCTOR_PASSWORD = 'BetterDoctor123!'
  const thirdRun = await seedCoreUsers()
  const doctorResult = thirdRun.find((result) => result.key === 'doctor')
  assert.equal(doctorResult?.action, 'updated')

  const updatedDoctor = await User.findOne({ email: 'startup.doctor@example.com' }).select('+passwordHashed')
  assert.equal(await updatedDoctor?.validatePassword('BetterDoctor123!'), true)
})

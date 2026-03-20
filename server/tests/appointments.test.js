import assert from 'node:assert/strict'
import test, { after, before, beforeEach } from 'node:test'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-super-secret-value-1234567890'
process.env.BACKUP_PASSWORD = 'test-backup-password-1234567890'

const { default: Appointments } = await import('../Models/AppointmentsModel.js')
const { default: User } = await import('../Models/UserModel.js')

let mongoServer

const createUser = async ({
  email,
  password = 'User123!',
  role = 'user',
}) => {
  const user = new User({
    email,
    firstName: 'Test',
    lastName: 'User',
    role,
    status: 'active',
    ...(role === 'doctor'
      ? {
          department: 'Internal Medicine',
          licenseUrl: '/tmp/license.pdf',
          licenseUrls: ['/tmp/license.pdf'],
          staffApplicationReviewed: true,
        }
      : {}),
  })
  await user.setPassword(password)
  await user.save()
  return user
}

before(async () => {
  mongoServer = await MongoMemoryServer.create()
  await mongoose.connect(mongoServer.getUri(), {
    dbName: 'ai_chatbot_appointments_test',
  })
  await Promise.all([User.init(), Appointments.init()])
})

after(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({})
    )
  )
})

test('active doctor slots are unique at the database level', async () => {
  const doctor = await createUser({ email: 'doctor.slot@example.com', role: 'doctor' })
  const patientOne = await createUser({ email: 'patient.one@example.com' })
  const patientTwo = await createUser({ email: 'patient.two@example.com' })
  const scheduledDate = new Date('2030-01-07T00:00:00.000Z')

  await Appointments.create({
    patient: patientOne._id,
    doctor: doctor._id,
    scheduledDate,
    status: 'Pending',
    department: 'Internal Medicine',
    reason: 'Initial consultation',
  })

  await assert.rejects(
    Appointments.create({
      patient: patientTwo._id,
      doctor: doctor._id,
      scheduledDate,
      status: 'Confirmed',
      department: 'Internal Medicine',
      reason: 'Follow-up consultation',
    }),
    (error) => {
      assert.equal(error?.code, 11000)
      return true
    }
  )
})

test('completed appointments do not block a new active booking for the same slot', async () => {
  const doctor = await createUser({ email: 'doctor.history@example.com', role: 'doctor' })
  const patientOne = await createUser({ email: 'patient.history.one@example.com' })
  const patientTwo = await createUser({ email: 'patient.history.two@example.com' })
  const scheduledDate = new Date('2030-01-14T00:00:00.000Z')

  await Appointments.create({
    patient: patientOne._id,
    doctor: doctor._id,
    scheduledDate,
    status: 'Completed',
    department: 'Internal Medicine',
    reason: 'Historical appointment',
  })

  const appointment = await Appointments.create({
    patient: patientTwo._id,
    doctor: doctor._id,
    scheduledDate,
    status: 'Pending',
    department: 'Internal Medicine',
    reason: 'New appointment',
  })

  assert.ok(appointment._id)
  assert.equal(appointment.status, 'Pending')
})

import {
  connectProvisioningDatabase,
  disconnectProvisioningDatabase,
  printProvisioningSummary,
  resolveDoctorAccount,
  resolvePatientAccount,
  upsertDoctorAccount,
  upsertPatientAccount,
} from './accountProvisioning.js'

async function run() {
  let exitCode = 0
  let dbName = 'hospital_ai_blockchain'

  try {
    const connection = await connectProvisioningDatabase()
    dbName = connection.dbName

    const doctor = resolveDoctorAccount()
    const patient = resolvePatientAccount()

    const doctorResult = await upsertDoctorAccount(doctor)
    const patientResult = await upsertPatientAccount(patient)

    printProvisioningSummary([doctorResult, patientResult], dbName)
  } catch (error) {
    console.error('Failed to create doctor and patient accounts:', error)
    exitCode = 1
  } finally {
    await disconnectProvisioningDatabase().catch(() => {})
  }

  process.exit(exitCode)
}

void run()

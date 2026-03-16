import {
  connectProvisioningDatabase,
  disconnectProvisioningDatabase,
  printProvisioningSummary,
  resolvePatientAccount,
  upsertPatientAccount,
} from './accountProvisioning.js'

async function run() {
  let exitCode = 0
  let dbName = 'hospital_ai_blockchain'

  try {
    const connection = await connectProvisioningDatabase()
    dbName = connection.dbName

    const patient = resolvePatientAccount()
    const result = await upsertPatientAccount(patient)

    printProvisioningSummary([result], dbName)
  } catch (error) {
    console.error('Failed to create patient account:', error)
    exitCode = 1
  } finally {
    await disconnectProvisioningDatabase().catch(() => {})
  }

  process.exit(exitCode)
}

void run()

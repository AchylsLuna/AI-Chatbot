import mongoose from 'mongoose'
import Appointments from '../Models/AppointmentsModel.js'
import AuditLog from '../Models/AuditLogModel.js'

// Minimal archive service for appointments
// Moves appointments older than `olderThanDays` into appointments_archive collection

const DEFAULT_THRESHOLD_DAYS = Number(process.env.ARCHIVE_BEFORE_DAYS) || 365
const BATCH_SIZE = Number(process.env.ARCHIVE_BATCH_SIZE) || 500

async function archiveOldAppointments({ olderThanDays = DEFAULT_THRESHOLD_DAYS, dryRun = true } = {}) {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)

  const db = mongoose.connection
  const Archive = db.collection('appointments_archive')

  // find in batches
  const query = { scheduledDate: { $lt: cutoff } }
  let totalMoved = 0

  while (true) {
    const docs = await Appointments.find(query).limit(BATCH_SIZE).lean()
    if (!docs || docs.length === 0) break

    if (dryRun) {
      totalMoved += docs.length
      // don't modify DB
      break
    }

    // insert into archive collection (preserve original doc)
    const insertOps = docs.map((d) => ({ ...d, archivedAt: new Date() }))
    try {
      await Archive.insertMany(insertOps, { ordered: false })
    } catch (err) {
      // ignore duplicate key / partial failures
      console.warn('Archive insertMany warning', err)
    }

    // remove from original collection
    const ids = docs.map((d) => d._id)
    await Appointments.deleteMany({ _id: { $in: ids } })

    totalMoved += docs.length
  }

  // write audit log
  try {
    await AuditLog.create({
      action: 'ARCHIVE_APPOINTMENTS',
      details: `Archived ${totalMoved} appointment(s) older than ${olderThanDays} days. dryRun=${dryRun}`,
    })
  } catch (err) {
    console.warn('Failed to write archive audit log', err)
  }

  return { moved: totalMoved, dryRun }
}

export default { archiveOldAppointments }

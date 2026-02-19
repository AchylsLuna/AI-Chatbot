#!/usr/bin/env node
import '../server.js' // ensure DB connection and app env
import archiveService from '../Utils/archiveService.js'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry') || args.includes('-d')
const daysArgIndex = args.findIndex((a) => a === '--days' || a === '-n')
let days
if (daysArgIndex >= 0) {
  const val = args[daysArgIndex + 1]
  if (val && !val.startsWith('-')) {
    days = Number(val)
    if (Number.isNaN(days)) days = undefined
  } else {
    console.warn('Warning: --days provided without a value; ignoring')
    days = undefined
  }
} else {
  days = undefined
}

(async () => {
  try {
    console.log('Starting appointment archive...', { dryRun, days })
    const result = await archiveService.archiveOldAppointments({ olderThanDays: days, dryRun })
    console.log('Archive result:', result)
    process.exit(0)
  } catch (err) {
    console.error('Archive failed', err)
    process.exit(2)
  }
})()

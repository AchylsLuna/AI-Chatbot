const CLINIC_TIMEZONE = 'Asia/Manila'
const CLINIC_UTC_OFFSET_MINUTES = 8 * 60
const SLOT_DURATION_MINUTES = 60

const DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
]

const WEEK_DAY_SEQUENCE = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const SESSION_WINDOWS = {
  morning: {
    startMinute: 8 * 60,
    endMinute: 12 * 60,
  },
  afternoon: {
    startMinute: 13 * 60 + 30,
    endMinute: 17 * 60,
  },
}

const EMPTY_WEEK_DAYS = WEEK_DAY_SEQUENCE.reduce((acc, dayKey) => {
  acc[dayKey] = { morning: false, afternoon: false }
  return acc
}, {})

const pad2 = (value) => String(value).padStart(2, '0')

const formatDateKey = ({ year, month, day }) => `${year}-${pad2(month)}-${pad2(day)}`

const parseDateKey = (value) => {
  const raw = String(value || '').trim()
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  const probe = new Date(Date.UTC(year, month - 1, day))
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null
  }

  return { year, month, day }
}

const clinicPartsFromDate = (dateInput) => {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null

  const shifted = new Date(date.getTime() + CLINIC_UTC_OFFSET_MINUTES * 60 * 1000)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    millisecond: shifted.getUTCMilliseconds(),
  }
}

const utcDateFromClinicDateTime = ({ year, month, day, hour, minute }) => {
  const utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0) - CLINIC_UTC_OFFSET_MINUTES * 60 * 1000
  return new Date(utcMs)
}

const getDayKeyFromWeekday = (weekday) => DAY_KEYS[weekday] || 'sunday'

const getWeekStartDateKey = (dateInput) => {
  const clinicParts = clinicPartsFromDate(dateInput)
  if (!clinicParts) return null

  const daysSinceMonday = (clinicParts.weekday + 6) % 7
  const clinicMidnightMs = Date.UTC(clinicParts.year, clinicParts.month - 1, clinicParts.day)
  const mondayMs = clinicMidnightMs - daysSinceMonday * 24 * 60 * 60 * 1000
  const mondayDate = new Date(mondayMs)

  return formatDateKey({
    year: mondayDate.getUTCFullYear(),
    month: mondayDate.getUTCMonth() + 1,
    day: mondayDate.getUTCDate(),
  })
}

const getWeekStartDateKeyFromDateKey = (dateKey) => {
  const parsed = parseDateKey(dateKey)
  if (!parsed) return null

  const baseMs = Date.UTC(parsed.year, parsed.month - 1, parsed.day)
  const weekday = new Date(baseMs).getUTCDay()
  const daysSinceMonday = (weekday + 6) % 7
  const mondayMs = baseMs - daysSinceMonday * 24 * 60 * 60 * 1000
  const mondayDate = new Date(mondayMs)

  return formatDateKey({
    year: mondayDate.getUTCFullYear(),
    month: mondayDate.getUTCMonth() + 1,
    day: mondayDate.getUTCDate(),
  })
}

const getDayKeyFromDateKey = (dateKey) => {
  const parsed = parseDateKey(dateKey)
  if (!parsed) return null

  const weekday = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay()
  return getDayKeyFromWeekday(weekday)
}

const getSessionSlotStartMinutes = (sessionName) => {
  const window = SESSION_WINDOWS[sessionName]
  if (!window) return []

  const starts = []
  let minute = window.startMinute
  while (minute + SLOT_DURATION_MINUTES <= window.endMinute) {
    starts.push(minute)
    minute += SLOT_DURATION_MINUTES
  }
  return starts
}

const resolveSessionFromMinuteOfDay = (minuteOfDay) => {
  if (getSessionSlotStartMinutes('morning').includes(minuteOfDay)) return 'morning'
  if (getSessionSlotStartMinutes('afternoon').includes(minuteOfDay)) return 'afternoon'
  return null
}

const formatSlotLabel = (startMinute) => {
  const endMinute = startMinute + SLOT_DURATION_MINUTES

  const to12Hour = (minuteOfDay) => {
    const hour24 = Math.floor(minuteOfDay / 60)
    const minute = minuteOfDay % 60
    const period = hour24 >= 12 ? 'PM' : 'AM'
    const hour12 = ((hour24 + 11) % 12) + 1
    return `${hour12}:${pad2(minute)} ${period}`
  }

  return `${to12Hour(startMinute)} - ${to12Hour(endMinute)}`
}

const buildSlotForDateKeyAndMinute = (dateKey, startMinute, sessionName) => {
  const parsed = parseDateKey(dateKey)
  if (!parsed) return null

  const hour = Math.floor(startMinute / 60)
  const minute = startMinute % 60
  const startAt = utcDateFromClinicDateTime({
    year: parsed.year,
    month: parsed.month,
    day: parsed.day,
    hour,
    minute,
  })
  const endAt = new Date(startAt.getTime() + SLOT_DURATION_MINUTES * 60 * 1000)

  return {
    session: sessionName,
    startMinute,
    startAt,
    endAt,
    startIso: startAt.toISOString(),
    endIso: endAt.toISOString(),
    label: formatSlotLabel(startMinute),
  }
}

const normalizeDaySessions = (value) => ({
  morning: Boolean(value?.morning),
  afternoon: Boolean(value?.afternoon),
})

const normalizeWeekDays = (value) => {
  const source = value && typeof value === 'object' ? value : {}
  const normalized = {}

  for (const dayKey of WEEK_DAY_SEQUENCE) {
    normalized[dayKey] = normalizeDaySessions(source[dayKey])
  }

  return normalized
}

const buildSlotsForDateByDaySessions = (dateKey, daySessions) => {
  const sessions = normalizeDaySessions(daySessions)
  const slots = []

  for (const sessionName of ['morning', 'afternoon']) {
    if (!sessions[sessionName]) continue
    const startMinutes = getSessionSlotStartMinutes(sessionName)
    for (const startMinute of startMinutes) {
      const slot = buildSlotForDateKeyAndMinute(dateKey, startMinute, sessionName)
      if (slot) slots.push(slot)
    }
  }

  return slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
}

const getWeekContextForDate = (dateInput) => {
  const clinicParts = clinicPartsFromDate(dateInput)
  if (!clinicParts) return null

  const clinicDateKey = formatDateKey(clinicParts)
  const weekStartDateKey = getWeekStartDateKeyFromDateKey(clinicDateKey)
  const dayKey = getDayKeyFromWeekday(clinicParts.weekday)
  const minuteOfDay = clinicParts.hour * 60 + clinicParts.minute

  return {
    clinicDateKey,
    weekStartDateKey,
    dayKey,
    minuteOfDay,
    sessionName: resolveSessionFromMinuteOfDay(minuteOfDay),
    second: clinicParts.second,
    millisecond: clinicParts.millisecond,
  }
}

export {
  CLINIC_TIMEZONE,
  EMPTY_WEEK_DAYS,
  SLOT_DURATION_MINUTES,
  WEEK_DAY_SEQUENCE,
  SESSION_WINDOWS,
  parseDateKey,
  formatDateKey,
  clinicPartsFromDate,
  getWeekStartDateKey,
  getWeekStartDateKeyFromDateKey,
  getDayKeyFromDateKey,
  getSessionSlotStartMinutes,
  resolveSessionFromMinuteOfDay,
  buildSlotForDateKeyAndMinute,
  buildSlotsForDateByDaySessions,
  normalizeDaySessions,
  normalizeWeekDays,
  getWeekContextForDate,
}

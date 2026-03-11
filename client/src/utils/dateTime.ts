const PHILIPPINES_TIME_ZONE = 'Asia/Manila'

type DateInput = Date | number | string | null | undefined

const dateTimeFormatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: PHILIPPINES_TIME_ZONE,
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

const timeFormatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: PHILIPPINES_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

const monthYearFormatter = new Intl.DateTimeFormat('en-PH', {
  timeZone: PHILIPPINES_TIME_ZONE,
  month: 'long',
  year: 'numeric',
})

const datePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PHILIPPINES_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const toDate = (value: DateInput) => {
  if (value === null || value === undefined) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const text = String(value).trim()
  if (!text) return null
  const parsed = new Date(text)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const formatPhilippineDateTime = (value: DateInput, fallback = 'Unknown') => {
  const parsed = toDate(value)
  if (!parsed) {
    const text = typeof value === 'string' ? value.trim() : ''
    return text || fallback
  }
  return `${dateTimeFormatter.format(parsed)} PHT`
}

export const formatPhilippineTime = (value: DateInput, fallback = 'Unknown') => {
  const parsed = toDate(value)
  if (!parsed) {
    const text = typeof value === 'string' ? value.trim() : ''
    return text || fallback
  }
  return `${timeFormatter.format(parsed)} PHT`
}

export const formatPhilippineMonthYear = (value: DateInput, fallback = 'Unknown') => {
  const parsed = toDate(value)
  if (!parsed) return fallback
  return monthYearFormatter.format(parsed)
}

export const getPhilippineDateParts = (value: DateInput) => {
  const parsed = toDate(value)
  if (!parsed) return null

  const parts = datePartsFormatter.formatToParts(parsed)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }

  return { year, month, day }
}

export { PHILIPPINES_TIME_ZONE }

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function isNumber(value: string | undefined): value is string {
  return value !== undefined && /^\d+$/.test(value)
}

function time(hour: string, minute: string): string {
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
}

/**
 * Turns a cron string into English for the sync button, for example
 * `'0 17 * * 0'` -> `'every Sunday at 17:00 (server time)'`.
 * Common shapes only. Other crons come back as `on the cron schedule "..."`.
 */
export function describeCron(cron: string): string {
  const parts = cron.trim().split(/\s+/)
  // 6 fields: the first is seconds. Payload accepts both forms.
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts.length === 6 ? parts.slice(1) : parts
  const fallback = `on the cron schedule "${cron.trim()}" (server time)`

  if (parts.length !== 5 && parts.length !== 6) return fallback
  if (month !== '*') return fallback

  if (isNumber(minute) && hour === '*' && dayOfMonth === '*' && dayOfWeek === '*') {
    return `every hour at minute ${minute}`
  }
  if (!isNumber(minute) || !isNumber(hour)) return fallback

  const at = `at ${time(hour, minute)} (server time)`
  if (dayOfMonth === '*' && dayOfWeek === '*') return `every day ${at}`
  if (dayOfMonth === '*' && isNumber(dayOfWeek) && DAYS[Number(dayOfWeek)]) {
    return `every ${DAYS[Number(dayOfWeek)]} ${at}`
  }
  if (isNumber(dayOfMonth) && dayOfWeek === '*') return `on day ${dayOfMonth} of every month ${at}`
  return fallback
}

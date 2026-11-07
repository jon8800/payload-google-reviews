import { describe, expect, it } from 'vitest'

import { describeCron } from '../src/lib/describeCron.js'
import { DEFAULT_SCHEDULE } from '../src/options.js'

describe('describeCron', () => {
  it('describes the default schedule', () => {
    expect(describeCron(DEFAULT_SCHEDULE)).toBe('every Sunday at 17:00 (server time)')
  })

  it('reads a 6-field cron with seconds first', () => {
    expect(describeCron('0 0 17 * * 0')).toBe('every Sunday at 17:00 (server time)')
  })

  it('describes daily, hourly and monthly crons', () => {
    expect(describeCron('30 4 * * *')).toBe('every day at 04:30 (server time)')
    expect(describeCron('15 * * * *')).toBe('every hour at minute 15')
    expect(describeCron('0 9 1 * *')).toBe('on day 1 of every month at 09:00 (server time)')
  })

  it('falls back to the raw cron for other shapes', () => {
    expect(describeCron('*/15 * * * *')).toBe('on the cron schedule "*/15 * * * *" (server time)')
    expect(describeCron('0 9 * 1 *')).toBe('on the cron schedule "0 9 * 1 *" (server time)')
  })
})

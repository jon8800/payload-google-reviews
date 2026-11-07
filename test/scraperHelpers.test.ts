import { describe, expect, it } from 'vitest'

import { placeUrl, publishedDate } from '../src/adapters/scraperHelpers.js'

describe('placeUrl', () => {
  it('adds the missing ! after a trailing !1s<id>', () => {
    const url = 'https://www.google.com/maps/place/Bear/data=!4m2!3m1!1s0x6b12ae:0x5017d681632ccc0'
    expect(placeUrl(url)).toBe(`${url}!`)
  })

  it('adds the ! before the query string', () => {
    const base = 'https://www.google.com/maps/place/Bear/data=!4m2!3m1!1s0x6b12ae:0x5017d681632ccc0'
    expect(placeUrl(`${base}?entry=ttu`)).toBe(`${base}!?entry=ttu`)
  })

  it('leaves a URL that already has the ! alone, and trims spaces', () => {
    const url = 'https://www.google.com/maps/place/Bear/data=!4m7!3m6!1s0x6b12ae:0x5017d681632ccc0!8m2!3d-33.8!4d151.2'
    expect(placeUrl(`  ${url}  `)).toBe(url)
  })
})

describe('publishedDate', () => {
  it('reads a 13-digit millisecond time', () => {
    expect(publishedDate('1730000000000')).toBe('2024-10-27T03:33:20.000Z')
  })

  it('reads a 16-digit microsecond time', () => {
    expect(publishedDate('1730000000000000')).toBe('2024-10-27T03:33:20.000Z')
  })

  it('returns null for null, empty and invalid values', () => {
    expect(publishedDate(null)).toBeNull()
    expect(publishedDate('')).toBeNull()
    expect(publishedDate('not a number')).toBeNull()
    expect(publishedDate('0')).toBeNull()
  })
})

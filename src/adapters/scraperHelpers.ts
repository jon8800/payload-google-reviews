/**
 * Pure helpers for the scraper adapter. This file does not load google-maps-review-scraper,
 * so tests (and other code) can use the helpers without the package installed.
 */

/**
 * The scraper finds the place ID by `!1s<id>!`. A shared link (g.page, "Share") opens a URL that
 * ends right after the ID, with no closing `!`, so it would fail with "Invalid URL".
 */
export function placeUrl(mapsUrl: string): string {
  const url = mapsUrl.trim()
  const [base, query] = url.split('?')
  return /!1s[a-zA-Z0-9_:]+$/.test(base) ? `${base}!${query ? `?${query}` : ''}` : url
}

/** Google gives the time in milliseconds; older scraper versions gave microseconds. */
export function publishedDate(value: string | null): string | null {
  if (!value) return null
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return new Date(n > 1e14 ? n / 1000 : n).toISOString()
}

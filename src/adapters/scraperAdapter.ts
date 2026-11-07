/**
 * Google Reviews scraper adapter — uses google-maps-review-scraper to fetch
 * ALL public reviews via reverse-engineered Google Maps internal API.
 * No browser needed — uses TLS-level Chrome impersonation via impit.
 * Returns the same NormalisedReviewsResponse as the Places API adapter.
 *
 * google-maps-review-scraper (and impit, which it installs) is an optional peer dependency.
 * This file is the only place that loads it, at run time, with a dynamic import().
 * A site that uses only the Places API typechecks, builds and runs without it.
 */
import type { NormalisedReviewsResponse, NormalisedReview } from './reviewsAdapter.js'
import { placeUrl, publishedDate } from './scraperHelpers.js'

const SCRAPER_PACKAGE = 'google-maps-review-scraper'

/** The part of google-maps-review-scraper this adapter uses. Typed here, so its types are not needed. */
interface ScraperModule {
  scraper: (options: {
    url: string
    sort_type?: 'relevant' | 'newest' | 'highest_rating' | 'lowest_rating'
    /** -1: every page. */
    pages?: number
    clean?: boolean
  }) => Promise<unknown[]>
}

async function loadScraper(): Promise<ScraperModule> {
  try {
    // The literal name lets a site's bundler externalise and trace the package when it is installed.
    // turbopackOptional stops a build error when it is not installed. The directive below stops the
    // type error then. ScraperModule types the result.
    // @ts-ignore -- optional peer dependency, may not be installed
    return (await import(/* turbopackOptional: true */ 'google-maps-review-scraper')) as unknown as ScraperModule
  } catch (error) {
    throw new Error(
      `The Scraper review source needs the "${SCRAPER_PACKAGE}" package. Install it in the site (pnpm add ${SCRAPER_PACKAGE}), or set Reviews Source to Google Places API.`,
      { cause: error },
    )
  }
}

interface ScrapedReview {
  review_id: string
  time: { published: string | null; last_edited: string | null }
  author: { name: string; profile_url: string; url: string; id: string }
  review: { rating: number; text: string | null; language: string | null }
  images: Array<{ url: string }> | null
  source: string
  response: { text: string | null } | null
}

export async function scrapeGoogleReviews(mapsUrl: string): Promise<NormalisedReviewsResponse> {
  if (!mapsUrl) {
    throw new Error('Google Maps URL not configured in Review Settings')
  }

  console.log(`[scraper] Starting review scrape from: ${mapsUrl}`)

  const { scraper } = await loadScraper()

  const result = await scraper({
    url: placeUrl(mapsUrl),
    sort_type: 'newest',
    pages: -1,
    clean: true,
  })

  if (!Array.isArray(result) || result.length === 0) {
    console.log('[scraper] No reviews returned')
    return { reviews: [], averageRating: null, totalReviewCount: null }
  }

  const reviews: NormalisedReview[] = (result as ScrapedReview[]).map((r) => ({
    googleReviewId: r.review_id || r.author.id,
    authorName: r.author.name || 'Anonymous',
    authorPhotoUrl: r.author.profile_url || null,
    rating: r.review.rating,
    reviewText: r.review.text?.trim() || null,
    publishedAt: publishedDate(r.time.published),
    reviewImageUrls: r.images?.map((img) => img.url) ?? [],
  }))

  // Calculate aggregate from scraped data
  const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0)
  const averageRating = reviews.length > 0 ? Math.round((totalRating / reviews.length) * 10) / 10 : null

  console.log(`[scraper] Done: ${reviews.length} reviews scraped (avg rating: ${averageRating})`)

  if (reviews.length > 0 && reviews.length <= 3) {
    reviews.forEach((r, i) => {
      console.log(`[scraper] Review ${i}: "${r.authorName}" — ${r.rating} stars — "${(r.reviewText || '').slice(0, 60)}..."`)
    })
  }

  return {
    reviews,
    averageRating,
    totalReviewCount: reviews.length,
  }
}

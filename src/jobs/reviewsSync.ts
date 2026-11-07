import type { TaskConfig } from 'payload'
import { fetchGoogleReviews } from '../adapters/reviewsAdapter.js'
import type { NormalisedReview, NormalisedReviewsResponse } from '../adapters/reviewsAdapter.js'
import { fetchBuffer } from '../lib/fetchBuffer.js'
import { SYNC_TASK_SLUG, type ResolvedOptions } from '../options.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Collection/global types regenerated at build time
type PayloadAny = any

type MediaId = number | string

/** Input and output of the sync task. Typed here, so the site's generated types are not needed. */
type ReviewsSyncTaskIO = {
  input: Record<string, never>
  output: { created: number; updated: number }
}

/**
 * Request a larger version of a Google user-content image.
 * Google CDN URLs (lh3.googleusercontent.com) accept size suffixes like =w100-h100, =s256, =w256-h256-p-k-no.
 * This strips any existing suffix and requests a 1200px wide version.
 */
function requestFullSizeImage(url: string): string {
  try {
    const parsed = new URL(url)
    if (!parsed.hostname.includes('googleusercontent.com')) return url
    // Strip existing size suffix (everything after the last =) and request w1200
    parsed.pathname = parsed.pathname.replace(/=.*$/, '') + '=w1200'
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * Downloads review images and uploads them to the Payload media library.
 * Batch-fetches existing media for dedup, then downloads in parallel.
 * Returns an array of media document IDs.
 */
async function uploadReviewPhotos(
  p: PayloadAny,
  mediaCollection: string,
  review: NormalisedReview,
  existingMediaAltToId: Map<string, MediaId>,
): Promise<MediaId[]> {
  if (review.reviewImageUrls.length === 0) return []

  const results = await Promise.allSettled(
    review.reviewImageUrls.map(async (url, i) => {
      const filename = `review-${review.googleReviewId}-${i}.jpg`

      // Check dedup from pre-fetched set
      const existingId = existingMediaAltToId.get(filename)
      if (existingId !== undefined) return existingId

      const fullSizeUrl = requestFullSizeImage(url)
      const buffer = await fetchBuffer(fullSizeUrl)
      const mimetype = 'image/jpeg'

      const media = await p.create({
        collection: mediaCollection,
        data: { alt: filename },
        file: { data: buffer, name: filename, mimetype, size: buffer.length },
        overrideAccess: true,
      })
      return media.id as MediaId
    })
  )

  const mediaIds: MediaId[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') {
      mediaIds.push(r.value)
    } else {
      console.warn(`[reviews-sync] Failed to upload image:`, r.reason)
    }
  }
  return mediaIds
}

export function createReviewsSyncTask(resolved: ResolvedOptions): TaskConfig<ReviewsSyncTaskIO> {
  const { mediaCollection, reviewsSlug, settingsSlug } = resolved
  return {
    slug: SYNC_TASK_SLUG,
    retries: 2,
    inputSchema: [],
    outputSchema: [
      { name: 'created', type: 'number', required: true },
      { name: 'updated', type: 'number', required: true },
    ],
    // The same cron the sync button shows. It fires only when the site runs this queue (jobs.autoRun).
    schedule: resolved.schedule ? [{ cron: resolved.schedule, queue: resolved.queue }] : undefined,
    handler: async ({ req }) => {
      const p = req.payload as PayloadAny

      // Read API credentials from the review-settings global
      const settings = await p.findGlobal({
        slug: settingsSlug,
        overrideAccess: true,
      })

      const source = settings.reviewSource || 'places'
      let result: NormalisedReviewsResponse

      if (source === 'scraper') {
        if (!settings.googleMapsUrl) {
          console.log('Google Reviews sync: skipped — Google Maps URL not configured in Review Settings')
          return { output: { created: 0, updated: 0 } }
        }
        const { scrapeGoogleReviews } = await import('../adapters/scraperAdapter.js')
        result = await scrapeGoogleReviews(settings.googleMapsUrl)
      } else {
        if (!settings.googlePlaceId) {
          console.log('Google Reviews sync: skipped — Place ID not configured in Review Settings')
          return { output: { created: 0, updated: 0 } }
        }
        result = await fetchGoogleReviews(settings.googlePlaceId)
      }

      const { reviews, averageRating, totalReviewCount } = result

      if (reviews.length === 0) {
        console.log('Google Reviews sync: no reviews returned from API')
        return { output: { created: 0, updated: 0 } }
      }

      // Fetch all existing review IDs and media alt texts in one batch for dedup
      const [{ docs: existing }, { docs: existingMedia }] = await Promise.all([
        p.find({
          collection: reviewsSlug,
          limit: 0,
          select: { googleReviewId: true },
          overrideAccess: true,
        }),
        p.find({
          collection: mediaCollection,
          limit: 0,
          where: { alt: { like: 'review-%' } },
          select: { alt: true },
          overrideAccess: true,
        }),
      ])

      const existingMediaAltToId = new Map<string, MediaId>(
        existingMedia.filter((m: PayloadAny) => m.alt).map((m: PayloadAny) => [m.alt, m.id])
      )

      const existingMap = new Map(
        existing.map((doc: PayloadAny) => [doc.googleReviewId, doc.id])
      )

      const toCreate = reviews.filter((r) => !existingMap.has(r.googleReviewId))
      const toUpdate = reviews.filter((r) => existingMap.has(r.googleReviewId))

      const createResults = await Promise.allSettled(
        toCreate.map(async (review) => {
          const photoIds = await uploadReviewPhotos(p, mediaCollection, review, existingMediaAltToId)
          return p.create({
            collection: reviewsSlug,
            data: {
              googleReviewId: review.googleReviewId,
              authorName: review.authorName,
              authorPhotoUrl: review.authorPhotoUrl ?? undefined,
              rating: review.rating,
              reviewText: review.reviewText ?? undefined,
              publishedAt: review.publishedAt ?? undefined,
              photos: photoIds.length > 0 ? photoIds : undefined,
              source: source as 'places' | 'scraper',
            },
            overrideAccess: true,
          })
        })
      )

      const updateResults = await Promise.allSettled(
        toUpdate.map(async (review) => {
          const photoIds = await uploadReviewPhotos(p, mediaCollection, review, existingMediaAltToId)
          return p.update({
            collection: reviewsSlug,
            id: existingMap.get(review.googleReviewId)!,
            data: {
              authorName: review.authorName,
              authorPhotoUrl: review.authorPhotoUrl ?? undefined,
              rating: review.rating,
              reviewText: review.reviewText ?? undefined,
              publishedAt: review.publishedAt ?? undefined,
              photos: photoIds,
            },
            overrideAccess: true,
          })
        })
      )

      const createdCount = createResults.filter((r) => r.status === 'fulfilled').length
      const failedCreates = createResults.filter((r) => r.status === 'rejected').length
      const updatedCount = updateResults.filter((r) => r.status === 'fulfilled').length
      const failedUpdates = updateResults.filter((r) => r.status === 'rejected').length

      if (failedCreates > 0 || failedUpdates > 0) {
        console.warn(`Google Reviews sync: ${failedCreates} creates failed, ${failedUpdates} updates failed`)
        const firstFailedCreate = createResults.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined
        if (firstFailedCreate) {
          console.error('First create error:', firstFailedCreate.reason)
        }
        const firstFailedUpdate = updateResults.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined
        if (firstFailedUpdate) {
          console.error('First update error:', firstFailedUpdate.reason)
        }
      }

      await p.updateGlobal({
        slug: settingsSlug,
        data: {
          averageRating: averageRating ?? undefined,
          totalReviewCount: totalReviewCount ?? undefined,
          lastSyncedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })

      console.log(
        `Google Reviews sync: created ${createdCount}, updated ${updatedCount}`
      )

      return { output: { created: createdCount, updated: updatedCount } }
    },
  }
}

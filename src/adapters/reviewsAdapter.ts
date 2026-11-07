/**
 * Google Reviews adapter — normalises API responses into a common schema.
 * Currently uses the Google Places API (New). When GBP API access is granted,
 * only this file needs to change.
 */

export interface NormalisedReview {
  googleReviewId: string
  authorName: string
  authorPhotoUrl: string | null
  rating: number
  reviewText: string | null
  publishedAt: string | null
  reviewImageUrls: string[]
}

export interface NormalisedReviewsResponse {
  reviews: NormalisedReview[]
  averageRating: number | null
  totalReviewCount: number | null
}

interface PlacesReview {
  name?: string
  relativePublishTimeDescription?: string
  rating?: number
  text?: { text?: string; languageCode?: string }
  originalText?: { text?: string; languageCode?: string }
  authorAttribution?: {
    displayName?: string
    uri?: string
    photoUri?: string
  }
  publishTime?: string
}

interface PlacesResponse {
  reviews?: PlacesReview[]
  rating?: number
  userRatingCount?: number
}

/**
 * Fetches reviews from the Google Places API (New) and normalises them.
 * The API key comes from the GOOGLE_PLACES_API_KEY environment variable.
 */
export async function fetchGoogleReviews(placeId: string): Promise<NormalisedReviewsResponse> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY environment variable is not set')
  }

  if (!placeId) {
    throw new Error('Google Place ID not configured in Review Settings')
  }

  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId.trim())}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000)

  let response: Response
  try {
    response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'reviews,rating,userRatingCount',
      },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Google Places API error (${response.status}): ${errorText}`)
  }

  const data: PlacesResponse = await response.json()

  const reviews: NormalisedReview[] = (data.reviews ?? []).map((review, index) => ({
    googleReviewId: review.name || `places-${placeId}-${index}`,
    authorName: review.authorAttribution?.displayName || 'Anonymous',
    authorPhotoUrl: review.authorAttribution?.photoUri || null,
    rating: review.rating ?? 5,
    reviewText: review.text?.text || review.originalText?.text || null,
    publishedAt: review.publishTime || null,
    reviewImageUrls: [],
  }))

  return {
    reviews,
    averageRating: data.rating ?? null,
    totalReviewCount: data.userRatingCount ?? null,
  }
}

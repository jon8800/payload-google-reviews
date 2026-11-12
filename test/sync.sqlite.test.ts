// Runs the plugin on a real Payload 4 instance (SQLite in memory). The Places API is mocked:
// no request leaves the machine.
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { buildConfig, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { googleReviewsPlugin, SYNC_ENDPOINT_PATH, SYNC_TASK_SLUG } from '../src/index.js'

const PLACE_ID = 'test-place-id'

const placesResponse = {
  rating: 4.6,
  userRatingCount: 128,
  reviews: [
    {
      name: `places/${PLACE_ID}/reviews/a`,
      rating: 5,
      text: { text: 'Lovely stay.' },
      authorAttribution: { displayName: 'Alex', photoUri: 'https://example.com/alex.png' },
      publishTime: '2026-10-01T10:00:00Z',
    },
    {
      name: `places/${PLACE_ID}/reviews/b`,
      rating: 4,
      text: { text: 'Good breakfast.' },
      authorAttribution: { displayName: 'Sam' },
      publishTime: '2026-10-02T10:00:00Z',
    },
  ],
}

let payload: Payload
const realFetch = globalThis.fetch
const placesCalls: string[] = []
let placesDown = false

beforeAll(async () => {
  process.env.GOOGLE_PLACES_API_KEY = 'test-key'
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    if (!url.startsWith('https://places.googleapis.com/')) return realFetch(input, init)
    placesCalls.push(url)
    if (placesDown) return new Response('quota exceeded', { status: 429 })
    return Response.json(placesResponse)
  })

  payload = await getPayload({
    config: buildConfig({
      secret: 'google-reviews-v4-test-secret',
      db: sqliteAdapter({ client: { url: 'file::memory:' }, push: true }),
      typescript: { autoGenerate: false },
      collections: [
        { slug: 'users', auth: true, fields: [] },
        { slug: 'media', upload: true, fields: [{ name: 'alt', type: 'text' }] },
      ],
      // Locked down, to prove the plugin's own calls do not depend on the site's jobs access.
      jobs: { access: { queue: () => false, run: () => false, cancel: () => false } },
      plugins: [googleReviewsPlugin()],
    }),
  })
})

afterAll(async () => {
  vi.unstubAllGlobals()
  delete process.env.GOOGLE_PLACES_API_KEY
  await payload?.destroy()
})

describe('on Payload 4', () => {
  it('keeps versions and authorship off, so the schema matches Payload 3', () => {
    const reviews = payload.collections.reviews.config
    expect(reviews.versions).toBeFalsy()
    expect(reviews.fields.some((field) => 'name' in field && field.name === 'createdBy')).toBe(false)
    const settings = payload.globals.config.find((global) => global.slug === 'review-settings')!
    expect(settings.versions).toBeFalsy()
  })

  it('registers the weekly schedule, which Payload 4 parses', () => {
    const task = payload.config.jobs.tasks?.find((t) => t.slug === SYNC_TASK_SLUG)
    expect(task?.schedule).toEqual([{ cron: '0 17 * * 0', queue: 'default' }])
  })

  it('the sync job creates the reviews, then updates them on the next run', async () => {
    await payload.updateGlobal({
      slug: 'review-settings' as never,
      data: { reviewSource: 'places', googlePlaceId: PLACE_ID } as never,
      overrideAccess: true,
    })

    // A scheduled run has no user. The plugin's own calls pass overrideAccess.
    const first = await payload.jobs.queue({ task: SYNC_TASK_SLUG as never, input: {}, overrideAccess: true })
    const firstRun = await payload.jobs.runByID({ id: first.id, overrideAccess: true })
    expect(firstRun.jobStatus?.[String(first.id)]?.status).toBe('success')


    const { docs } = await payload.find({ collection: 'reviews' as never, sort: 'authorName', overrideAccess: true })
    expect(docs.map((doc: any) => [doc.authorName, doc.rating, doc.source])).toEqual([
      ['Alex', 5, 'places'],
      ['Sam', 4, 'places'],
    ])

    // Google changed one rating. The next run updates the stored review and creates no duplicate.
    placesResponse.reviews[1]!.rating = 3
    const second = await payload.jobs.queue({ task: SYNC_TASK_SLUG as never, input: {}, overrideAccess: true })
    const secondRun = await payload.jobs.runByID({ id: second.id, overrideAccess: true })
    expect(secondRun.jobStatus?.[String(second.id)]?.status).toBe('success')
    const after = await payload.find({ collection: 'reviews' as never, sort: 'authorName', overrideAccess: true })
    expect(after.docs.map((doc: any) => [doc.authorName, doc.rating])).toEqual([
      ['Alex', 5],
      ['Sam', 3],
    ])

    const settings: any = await payload.findGlobal({ slug: 'review-settings' as never, overrideAccess: true })
    expect(settings.averageRating).toBe(4.6)
    expect(settings.totalReviewCount).toBe(128)
    expect(settings.lastSyncedAt).toBeTruthy()
    expect(placesCalls).toHaveLength(2)
  })

  it('the sync endpoint answers 401 without a user and runs the job for a signed-in user', async () => {
    const endpoint = payload.config.endpoints.find((e) => e.path === SYNC_ENDPOINT_PATH)!
    const anonymous = await endpoint.handler({ payload, user: null } as never)
    expect(anonymous.status).toBe(401)

    // The site's jobs access denies everyone. The endpoint's own user check is the gate, as on Payload 3.
    const user = { id: 1, collection: 'users', email: 'editor@example.com' }
    const res = await endpoint.handler({ payload, user } as never)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
  })

  it('the sync endpoint answers 500 with the job error when Google fails', async () => {
    const endpoint = payload.config.endpoints.find((e) => e.path === SYNC_ENDPOINT_PATH)!
    placesDown = true
    try {
      const res = await endpoint.handler({ payload, user: { id: 1, collection: 'users' } } as never)
      expect(res.status).toBe(500)
      expect((await res.json()).error).toContain('Google Places API error (429)')
    } finally {
      placesDown = false
    }
  })

  it('denies anonymous reads of payload-jobs, the Payload 4 default', async () => {
    await expect(payload.find({ collection: 'payload-jobs', overrideAccess: false })).rejects.toThrow()
  })
})

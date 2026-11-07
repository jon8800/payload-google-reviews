import type { CollectionConfig, Config, GlobalConfig } from 'payload'
import { describe, expect, it } from 'vitest'

import { googleReviewsPlugin } from '../src/index.js'
import {
  DEFAULT_ADMIN_GROUP,
  DEFAULT_SCHEDULE,
  resolveOptions,
  SYNC_ENDPOINT_PATH,
  SYNC_TASK_SLUG,
} from '../src/options.js'

function baseConfig(): Config {
  return {
    collections: [{ slug: 'posts', fields: [] }],
    globals: [{ slug: 'header', fields: [] }],
    endpoints: [{ path: '/keep', method: 'get', handler: () => Response.json({}) }],
    jobs: { tasks: [{ slug: 'keep-task', handler: async () => ({ output: {} }) }] },
  } as unknown as Config
}

async function run(options?: Parameters<typeof googleReviewsPlugin>[0]) {
  const config = await googleReviewsPlugin(options)(baseConfig())
  const reviews = config.collections!.at(-1) as CollectionConfig
  const settings = config.globals!.at(-1) as GlobalConfig
  return { config, reviews, settings }
}

// Finds the sync button field inside the global's tabs.
function syncButton(settings: GlobalConfig) {
  const tabs = settings.fields[0] as { tabs: Array<{ fields: Array<{ name?: string; admin?: any }> }> }
  return tabs.tabs.flatMap((tab) => tab.fields).find((field) => field.name === 'syncButton')
}

describe('resolveOptions', () => {
  it('fills in every default', () => {
    expect(resolveOptions()).toEqual({
      enabled: true,
      schedule: DEFAULT_SCHEDULE,
      queue: 'default',
      mediaCollection: 'media',
      reviewsSlug: 'reviews',
      settingsSlug: 'review-settings',
    })
    expect(DEFAULT_SCHEDULE).toBe('0 17 * * 0')
  })

  it('takes custom slugs, queue, media collection and schedule', () => {
    expect(
      resolveOptions({
        schedule: false,
        queue: 'reviews',
        mediaCollection: 'images' as never,
        reviews: { slug: 'google-reviews' },
        settings: { slug: 'google-settings' },
      }),
    ).toEqual({
      enabled: true,
      schedule: false,
      queue: 'reviews',
      mediaCollection: 'images',
      reviewsSlug: 'google-reviews',
      settingsSlug: 'google-settings',
    })
  })
})

describe('googleReviewsPlugin', () => {
  it('adds the collection, global, endpoint and task, and keeps the existing config', async () => {
    const { config, reviews, settings } = await run()
    expect(config.collections!.map((c) => c.slug)).toEqual(['posts', 'reviews'])
    expect(config.globals!.map((g) => g.slug)).toEqual(['header', 'review-settings'])
    expect(config.endpoints!.map((e) => e.path)).toEqual(['/keep', SYNC_ENDPOINT_PATH])
    expect(config.jobs!.tasks!.map((t) => t.slug)).toEqual(['keep-task', SYNC_TASK_SLUG])
    expect(reviews.admin?.group).toBe(DEFAULT_ADMIN_GROUP)
    expect(settings.admin?.group).toBe(DEFAULT_ADMIN_GROUP)
  })

  it('uses custom slugs', async () => {
    const { reviews, settings } = await run({ reviews: { slug: 'google-reviews' }, settings: { slug: 'google-settings' } })
    expect(reviews.slug).toBe('google-reviews')
    expect(settings.slug).toBe('google-settings')
  })

  it('merges the admin options over the defaults', async () => {
    const { reviews, settings } = await run({
      reviews: { admin: { group: 'Content' } },
      settings: { admin: { group: 'Settings' } },
    })
    expect(reviews.admin?.group).toBe('Content')
    expect(reviews.admin?.useAsTitle).toBe('authorName')
    expect(settings.admin?.group).toBe('Settings')
  })

  it('schedules the task with the cron and queue', async () => {
    const { config } = await run({ schedule: '0 3 * * *', queue: 'nightly' })
    const task = config.jobs!.tasks!.find((t) => t.slug === SYNC_TASK_SLUG)
    expect(task?.schedule).toEqual([{ cron: '0 3 * * *', queue: 'nightly' }])
  })

  it('registers the sync button under the package name with the schedule label', async () => {
    const { settings } = await run()
    expect(syncButton(settings)?.admin.components.Field).toEqual({
      path: 'payload-google-reviews/client#SyncReviewsButton',
      clientProps: { scheduleLabel: 'every Sunday at 17:00 (server time)' },
    })
  })

  it('with enabled: false keeps the collection and global but adds no endpoint, task or button', async () => {
    const { config, settings } = await run({ enabled: false })
    expect(config.collections!.map((c) => c.slug)).toEqual(['posts', 'reviews'])
    expect(config.globals!.map((g) => g.slug)).toEqual(['header', 'review-settings'])
    expect(config.endpoints!.map((e) => e.path)).toEqual(['/keep'])
    expect(config.jobs!.tasks!.map((t) => t.slug)).toEqual(['keep-task'])
    expect(syncButton(settings)).toBeUndefined()
  })
})

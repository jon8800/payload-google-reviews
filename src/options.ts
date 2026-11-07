import type { CollectionConfig, CollectionSlug, GlobalConfig } from 'payload'

/** Weekly on Sunday at 17:00 server time (03:00 AEST when the server runs on UTC). */
export const DEFAULT_SCHEDULE = '0 17 * * 0'
export const DEFAULT_QUEUE = 'default'
export const DEFAULT_REVIEWS_SLUG = 'reviews'
export const DEFAULT_SETTINGS_SLUG = 'review-settings'
export const DEFAULT_MEDIA_COLLECTION = 'media'
export const DEFAULT_ADMIN_GROUP = 'Reviews'
export const SYNC_TASK_SLUG = 'reviews-sync'
export const SYNC_ENDPOINT_PATH = '/google-reviews/sync'

export type GoogleReviewsPluginOptions = {
  /**
   * `false` turns off the sync: no job, no schedule, no sync endpoint and no sync button.
   * The collection and the global stay, so the database schema and the stored reviews stay.
   * Default `true`.
   */
  enabled?: boolean
  /**
   * When the sync job runs, as a cron string (5 fields, or 6 with seconds first).
   * The sync button shows the same schedule. `false`: no automatic sync, only the button.
   * The schedule fires only when the site runs Payload jobs, for example with `jobs.autoRun`.
   * Default `'0 17 * * 0'` (every Sunday at 17:00 server time).
   */
  schedule?: string | false
  /** The job queue for the sync job. `jobs.autoRun` must run this queue. Default `'default'`. */
  queue?: string
  /** The upload collection for review photos (scraper only). Default `'media'`. */
  mediaCollection?: CollectionSlug
  /** The reviews collection. */
  reviews?: {
    /** Default `'reviews'`. */
    slug?: string
    /** Merged over the default access: anyone reads, signed-in users write. */
    access?: CollectionConfig['access']
    /** Merged into the collection's `admin` options, for example `{ group: 'Content' }`. Default group `'Reviews'`. */
    admin?: CollectionConfig['admin']
    hooks?: CollectionConfig['hooks']
  }
  /** The Review Settings global. */
  settings?: {
    /** Default `'review-settings'`. */
    slug?: string
    /** Merged over the default access: anyone reads, signed-in users update. */
    access?: GlobalConfig['access']
    /** Merged into the global's `admin` options, for example `{ group: 'Settings' }`. Default group `'Reviews'`. */
    admin?: GlobalConfig['admin']
    hooks?: GlobalConfig['hooks']
  }
}

/** The options with every default filled in. */
export type ResolvedOptions = {
  enabled: boolean
  schedule: string | false
  queue: string
  mediaCollection: CollectionSlug
  reviewsSlug: string
  settingsSlug: string
}

export function resolveOptions(options: GoogleReviewsPluginOptions = {}): ResolvedOptions {
  return {
    enabled: options.enabled ?? true,
    schedule: options.schedule ?? DEFAULT_SCHEDULE,
    queue: options.queue ?? DEFAULT_QUEUE,
    // A site's generated types narrow CollectionSlug to its own slugs. The default is a plain string.
    mediaCollection: options.mediaCollection ?? (DEFAULT_MEDIA_COLLECTION as CollectionSlug),
    reviewsSlug: options.reviews?.slug ?? DEFAULT_REVIEWS_SLUG,
    settingsSlug: options.settings?.slug ?? DEFAULT_SETTINGS_SLUG,
  }
}

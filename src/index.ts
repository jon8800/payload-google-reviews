import type { Plugin } from 'payload'
import { createReviewsCollection } from './collections/reviews.js'
import { createSyncEndpoint } from './endpoints/sync.js'
import { createReviewSettingsGlobal } from './globals/reviewSettings.js'
import { createReviewsSyncTask } from './jobs/reviewsSync.js'
import { resolveOptions, type GoogleReviewsPluginOptions } from './options.js'

export type { GoogleReviewsPluginOptions } from './options.js'
export {
  DEFAULT_ADMIN_GROUP,
  DEFAULT_SCHEDULE,
  SYNC_ENDPOINT_PATH,
  SYNC_TASK_SLUG,
} from './options.js'
export { describeCron } from './lib/describeCron.js'
export type { NormalisedReview, NormalisedReviewsResponse } from './adapters/reviewsAdapter.js'

/**
 * Adds the `reviews` collection, the `review-settings` global, the sync job and the sync endpoint.
 * The schedule fires only when the site runs Payload jobs, for example with `jobs.autoRun`.
 */
export function googleReviewsPlugin(options: GoogleReviewsPluginOptions = {}): Plugin {
  const resolved = resolveOptions(options)

  return (incomingConfig) => {
    // Keep the collection and the global when the plugin is off, so the database schema stays.
    const config = {
      ...incomingConfig,
      collections: [
        ...(incomingConfig.collections || []),
        createReviewsCollection(options.reviews, resolved),
      ],
      globals: [
        ...(incomingConfig.globals || []),
        createReviewSettingsGlobal(options.settings, resolved),
      ],
    }

    if (!resolved.enabled) return config

    return {
      ...config,
      endpoints: [
        ...(incomingConfig.endpoints || []),
        createSyncEndpoint(resolved),
      ],
      jobs: {
        ...incomingConfig.jobs,
        tasks: [
          ...(incomingConfig.jobs?.tasks || []),
          createReviewsSyncTask(resolved),
        ],
      },
    }
  }
}

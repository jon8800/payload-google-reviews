import type { Field, GlobalConfig } from 'payload'
import { describeCron } from '../lib/describeCron.js'
import { DEFAULT_ADMIN_GROUP, type GoogleReviewsPluginOptions, type ResolvedOptions } from '../options.js'

const SYNC_BUTTON_COMPONENT = 'payload-google-reviews/client#SyncReviewsButton'

/** Props the sync button gets from the plugin config. */
export type SyncReviewsButtonProps = {
  /** The schedule in English, for example "every Sunday at 17:00 (server time)". `null`: no schedule. */
  scheduleLabel?: string | null
}

function syncButtonField(resolved: ResolvedOptions): Field {
  const clientProps: SyncReviewsButtonProps = {
    scheduleLabel: resolved.schedule ? describeCron(resolved.schedule) : null,
  }
  return {
    name: 'syncButton',
    type: 'ui',
    admin: {
      components: {
        Field: { path: SYNC_BUTTON_COMPONENT, clientProps },
      },
    },
  }
}

export function createReviewSettingsGlobal(
  options: GoogleReviewsPluginOptions['settings'],
  resolved: ResolvedOptions,
): GlobalConfig {
  return {
    slug: resolved.settingsSlug,
    label: 'Review Settings',
    admin: {
      group: DEFAULT_ADMIN_GROUP,
      ...options?.admin,
    },
    access: {
      read: () => true,
      update: ({ req }) => !!req.user,
      ...options?.access,
    },
    hooks: options?.hooks,
    fields: [
      {
        type: 'tabs',
        tabs: [
          {
            label: 'Google',
            description: 'Configure the Google Reviews data source and connection settings.',
            fields: [
              {
                name: 'reviewSource',
                label: 'Reviews Source',
                type: 'select',
                defaultValue: 'places',
                options: [
                  { label: 'Google Places API (5 reviews)', value: 'places' },
                  { label: 'Scraper (all reviews)', value: 'scraper' },
                ],
                admin: {
                  description:
                    'Places API returns up to 5 reviews and needs the GOOGLE_PLACES_API_KEY environment variable. Scraper fetches all public reviews and needs the google-maps-review-scraper package installed on the site.',
                },
              },
              {
                name: 'googlePlaceId',
                label: 'Google Place ID',
                type: 'text',
                admin: { description: 'The Place ID for this business (used by Places API). Find it at https://developers.google.com/maps/documentation/places/web-service/place-id' },
              },
              {
                name: 'googleMapsUrl',
                label: 'Google Maps URL',
                type: 'text',
                admin: { description: 'The full Google Maps URL for this business (used by Scraper). Copy it from your browser address bar when viewing the business on Google Maps.' },
              },
            ],
          },
          {
            label: 'Sync Status',
            fields: [
              ...(resolved.enabled ? [syncButtonField(resolved)] : []),
              {
                name: 'averageRating',
                type: 'number',
                min: 0,
                max: 5,
                admin: { readOnly: true, description: 'Auto-synced from Google' },
              },
              {
                name: 'totalReviewCount',
                type: 'number',
                admin: { readOnly: true, description: 'Auto-synced from Google' },
              },
              {
                name: 'lastSyncedAt',
                type: 'date',
                admin: { readOnly: true, description: 'Last successful sync timestamp' },
              },
            ],
          },
        ],
      },
    ],
  }
}

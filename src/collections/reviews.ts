import type { CollectionConfig } from 'payload'
import { DEFAULT_ADMIN_GROUP, type GoogleReviewsPluginOptions, type ResolvedOptions } from '../options.js'

export function createReviewsCollection(
  options: GoogleReviewsPluginOptions['reviews'],
  resolved: ResolvedOptions,
): CollectionConfig {
  return {
    slug: resolved.reviewsSlug,
    admin: {
      group: DEFAULT_ADMIN_GROUP,
      useAsTitle: 'authorName',
      defaultColumns: ['authorName', 'rating', 'reviewText', 'publishedAt', 'source'],
      ...options?.admin,
    },
    access: {
      read: () => true,
      create: ({ req }) => !!req.user,
      update: ({ req }) => !!req.user,
      delete: ({ req }) => !!req.user,
      ...options?.access,
    },
    hooks: options?.hooks,
    // Payload 4 turns versions and authorship on by default. The sync job rewrites every review on
    // each run, so versions would only pile up, and authorship would add columns the job never fills.
    // Off keeps the database schema the same as on Payload 3.
    versions: false,
    authorship: false,
    fields: [
      {
        name: 'googleReviewId',
        type: 'text',
        required: true,
        unique: true,
        index: true,
        admin: { readOnly: true },
      },
      {
        name: 'authorName',
        type: 'text',
        required: true,
      },
      {
        name: 'authorPhotoUrl',
        type: 'text',
      },
      {
        name: 'rating',
        type: 'number',
        required: true,
        min: 1,
        max: 5,
      },
      {
        name: 'reviewText',
        type: 'textarea',
      },
      {
        name: 'publishedAt',
        type: 'date',
      },
      {
        name: 'photos',
        type: 'upload',
        relationTo: resolved.mediaCollection,
        hasMany: true,
        admin: {
          description: 'Photos attached to this review, uploaded from Google',
        },
      },
      {
        name: 'source',
        type: 'select',
        defaultValue: 'places',
        options: [
          { label: 'Places API', value: 'places' },
          { label: 'Scraper', value: 'scraper' },
        ],
      },
    ],
  }
}

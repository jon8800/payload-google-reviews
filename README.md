# payload-google-reviews

A Payload CMS 4 plugin that copies a business's Google reviews into your site.

This is the Payload 4 line (`0.5.x`, npm dist-tag `next`): `pnpm add payload-google-reviews@next`. For Payload 3, use `0.4.x` (`latest`).

It adds:

- a `reviews` collection (one document per Google review),
- a `review-settings` global (the review source, the Place ID or Maps URL, the average rating and the review count),
- a `reviews-sync` job that runs on a schedule (weekly by default),
- a **Sync Reviews Now** button in the global, which calls `POST /api/google-reviews/sync`,
- a `googleReviews` block config (`payload-google-reviews/blocks`) for layout builders.

## Requirements

- Payload `^4.0.0-beta.8`, `@payloadcms/ui` `^4.0.0-beta.8`
- React and React DOM `^19.3.1`
- Node `>=24.22.1` (Payload 4's minimum)
- An upload collection for review photos (default `media`). Only the scraper fetches photos.

## Install

```bash
pnpm add payload-google-reviews
```

To use the scraper source as well, install the scraper. See [The scraper (optional)](#the-scraper-optional).

```bash
pnpm add google-maps-review-scraper@^3.1.0
```

Add the plugin in `payload.config.ts`, then regenerate the import map and the types:

```ts
import { googleReviewsPlugin } from 'payload-google-reviews'

export default buildConfig({
  // ...
  plugins: [googleReviewsPlugin()],
  // Needed for the schedule. See "The schedule" below.
  jobs: {
    autoRun: [{ cron: '*/15 * * * *', queue: 'default' }],
    shouldAutoRun: () => process.env.NEXT_PHASE !== 'phase-production-build',
  },
})
```

```bash
pnpm payload generate:importmap
pnpm payload generate:types
```

## Options

Every option is optional. `googleReviewsPlugin()` with no options works as 0.1.0 did.

```ts
googleReviewsPlugin({
  enabled: true,
  schedule: '0 17 * * 0',
  queue: 'default',
  mediaCollection: 'media',
  reviews: {
    slug: 'reviews',
    admin: { group: 'Content' },
    access: { read: () => true },
    hooks: { afterChange: [] },
  },
  settings: {
    slug: 'review-settings',
    admin: { group: 'Settings' },
    access: { update: ({ req }) => Boolean(req.user) },
    hooks: { afterChange: [] },
  },
})
```

| Option | Default | What it does |
| --- | --- | --- |
| `enabled` | `true` | `false` turns off the sync: no job, no schedule, no endpoint, no button. The collection and the global stay, so the database schema and the stored reviews stay. |
| `schedule` | `'0 17 * * 0'` | A cron string for the sync job. The button shows the same schedule. `false`: no automatic sync, only the button. |
| `queue` | `'default'` | The job queue for the sync job. Your `jobs.autoRun` must run this queue. |
| `mediaCollection` | `'media'` | The upload collection for review photos. |
| `reviews.slug` | `'reviews'` | The slug of the reviews collection. |
| `reviews.admin` | `{ group: 'Reviews', useAsTitle: 'authorName', ... }` | Merged into the collection's `admin` options. |
| `reviews.access` | anyone reads, signed-in users write | Merged over the default access. |
| `reviews.hooks` | none | The collection's hooks, for example to revalidate pages. |
| `settings.slug` | `'review-settings'` | The slug of the Review Settings global. |
| `settings.admin` | `{ group: 'Reviews' }` | Merged into the global's `admin` options. |
| `settings.access` | anyone reads, signed-in users update | Merged over the default access. |
| `settings.hooks` | none | The global's hooks. |

If you change a slug on a site that already has data, Payload sees a new collection or global. Move the data yourself.

## Environment variables

| Variable | Needed for | What it is |
| --- | --- | --- |
| `GOOGLE_PLACES_API_KEY` | Places API source | A Google Cloud API key with the Places API (New) turned on. |

The other settings live in the Review Settings global, in the admin:

- **Reviews Source**: `Google Places API` (up to 5 reviews) or `Scraper` (all public reviews).
- **Google Place ID**: for the Places API.
- **Google Maps URL**: for the scraper.

## The schedule

The `schedule` option sets the job's cron. The sync button text comes from the same value, for example "Reviews also sync automatically every Sunday at 17:00 (server time)".

- The cron has 5 fields (`minute hour day month weekday`), or 6 with seconds first.
- A step needs `*` or a range before the `/` (Payload 4 rule): `*/10` and `5-59/15` work, `/10` and `5/15` do not. The plugin throws at startup with the fix in the message.
- It uses the server's time zone. `'0 17 * * 0'` is Sunday 17:00 UTC (Monday 03:00 AEST) on a UTC server.

**The schedule fires only when the site runs Payload jobs.** Payload does not do it on its own. Pick one:

1. **`jobs.autoRun`** (a long-running server, for example Docker or a VPS). Add an entry for the plugin's queue, as in the install example. On each tick, Payload queues the scheduled sync and runs the queued jobs. The sync starts at the first tick after the scheduled time, so `*/15 * * * *` starts it up to 15 minutes late. Use `shouldAutoRun` to keep it off during `next build`.
2. **An outside cron** (serverless hosts such as Vercel, where `autoRun` does not work). Call the Payload jobs endpoints, signed in or with `jobs.access.run` set:
   - `GET /api/payload-jobs/handle-schedules?queue=default` queues the scheduled sync.
   - `GET /api/payload-jobs/run?queue=default` runs it.
3. **The Payload CLI**: `pnpm payload jobs:run --queue default --handle-schedules`.

The **Sync Reviews Now** button does not need any of these. It queues one sync job and runs it at once.

## The scraper (optional)

The Places API returns at most 5 reviews. The scraper returns every public review and their photos. It uses the [`google-maps-review-scraper`](https://www.npmjs.com/package/google-maps-review-scraper) package, which installs `impit` (native code that copies Chrome's TLS).

The scraper is an optional peer dependency. A site that uses only the Places API does not install it: the site typechecks, builds and runs without it. The plugin loads it with a dynamic `import()` only when a sync uses the Scraper source. Without the package, that sync fails with "The Scraper review source needs the google-maps-review-scraper package".

To use the scraper:

```bash
pnpm add google-maps-review-scraper@^3.1.0
```

```js
// next.config.js: keep the native impit code out of the bundle
serverExternalPackages: ['impit', 'google-maps-review-scraper'],
```

- With `output: 'standalone'`, check that the image contains both packages. Next traces them through `serverExternalPackages`.
- The import carries the `turbopackOptional` comment, so a Turbopack build (the Next 16 default) does not fail when the package is missing. A webpack build (`next build --webpack`) needs the package installed.

## Reading the reviews on the site

```ts
const { docs: reviews } = await payload.find({ collection: 'reviews', sort: '-publishedAt', limit: 12 })
const settings = await payload.findGlobal({ slug: 'review-settings' })
// settings.averageRating, settings.totalReviewCount, settings.lastSyncedAt
```

Types: `import type { NormalisedReview, GoogleReviewsPluginOptions } from 'payload-google-reviews/types'`.

## Upgrading from `@sea-la-vie/payload-google-reviews`

1. Remove the old package (`pnpm remove @sea-la-vie/payload-google-reviews`) and run `pnpm add payload-google-reviews`.
2. Change every import from `@sea-la-vie/payload-google-reviews` to `payload-google-reviews`.
3. Remove `@sea-la-vie/payload-google-reviews` from `transpilePackages` in `next.config.js`. The package now ships built JavaScript.
4. Run `pnpm payload generate:importmap`. The sync button path is now `payload-google-reviews/client#SyncReviewsButton`.

The collection, the global and the database schema do not change.

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm pack --pack-destination release
```

`.npmrc` sets `auto-install-peers=false`, so the scraper is not installed here. The typecheck then proves that a Places-only site typechecks.

## Releasing

A `v*` tag runs `.github/workflows/publish.yml`. It checks that the tag matches `package.json`, then runs typecheck, tests and build, packs with pnpm, and publishes with `scripts/publish.mjs`. The workflow needs an `NPM_TOKEN` repository secret: a granular npm token with "bypass 2FA".

```bash
git tag v0.4.0
git push origin v0.4.0
```

## License

MIT

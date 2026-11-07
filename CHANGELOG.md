# Changelog

All notable changes to `payload-google-reviews` (called `@sea-la-vie/payload-google-reviews` before 0.4.0). The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The package uses [semantic versioning](https://semver.org/). Before 1.0, a minor version can break the API.

## [0.4.0] - 2026-11-08

The first release on npm.

### Changed

- **Breaking:** the package is renamed from `@sea-la-vie/payload-google-reviews` to `payload-google-reviews`.
- The package ships built JavaScript and type declarations in `dist/`, not TypeScript source. The `"use client"` directive and the button's `.scss` file are kept.
- The sync button's import map path is now `payload-google-reviews/client#SyncReviewsButton`.
- The package is MIT-licensed and public on npm and GitHub (`jon8800/payload-google-reviews`).

### Migration

1. Run `pnpm remove @sea-la-vie/payload-google-reviews` and `pnpm add payload-google-reviews`.
2. Change the imports from `@sea-la-vie/payload-google-reviews` (and `/types`, `/blocks`, `/client`) to `payload-google-reviews`.
3. Remove the package from `transpilePackages` in `next.config.js`. Next.js no longer needs to compile it.
4. Run `pnpm payload generate:importmap`, so the import map uses the new button path.

The collections, the global and the database schema do not change.

### Development

- Added a build (`pnpm build`: swc for the JavaScript, tsc for the declarations).
- Added vitest tests for the options, the plugin config, `describeCron` and the scraper URL and date helpers (`pnpm test`). The helpers moved to `src/adapters/scraperHelpers.ts`, so tests run without the scraper package.
- Added the publish workflow and `scripts/publish.mjs`, the same as `payload-media-gallery`. A `v*` tag publishes with a raw authenticated PUT.

## [0.3.0] - 2026-11-08

### Changed

- The scraper needs `google-maps-review-scraper` 3.1 or later (`^3.1.0`). Version 2 now gets "403 Forbidden" from Google on every sync. Version 3 takes one options object; the adapter calls it that way.

### Fixed

- Scraped reviews were dated January 1970. Google gives the time in milliseconds, and the adapter divided it by 1000. Microsecond values from older scraper versions still work.
- A Google Maps URL from a share link (g.page, or the "Share" button) failed with "Invalid URL", because it ends right after the place ID. The adapter now adds the `!` the scraper looks for.

## [0.2.1] - 2026-11-07

### Fixed

- A site with generated Payload types failed its typecheck on the review photos field: `mediaCollection` was a plain `string`. It is now a `CollectionSlug`.

## [0.2.0] - 2026-11-07

### Added

- Plugin options: `googleReviewsPlugin({ enabled, schedule, queue, mediaCollection, reviews, settings })`. `reviews` and `settings` take `slug`, `admin` (for example `{ group: 'Content' }`), `access` and `hooks`, merged over the defaults. With no options the plugin works as 0.1.0 did.
- `enabled: false` turns off the job, the schedule, the sync endpoint and the sync button. The collection and the global stay, so the database schema stays.
- `schedule`: the sync job's cron (default `'0 17 * * 0'`, every Sunday at 17:00 server time). `false` turns the automatic sync off.
- `mediaCollection`: the upload collection for review photos (default `'media'`).
- The README: install, options, environment variables, the schedule and `jobs.autoRun`.
- Exports: the `GoogleReviewsPluginOptions` and `SyncReviewsButtonProps` types, `describeCron`, `DEFAULT_SCHEDULE`, `DEFAULT_ADMIN_GROUP`, `SYNC_TASK_SLUG` and `SYNC_ENDPOINT_PATH`.

### Fixed

- The sync button said reviews sync "once daily", but the job ran weekly. The button now shows the job's real schedule, from the same `schedule` value.
- A site without `google-maps-review-scraper` and `impit` failed its typecheck. The scraper adapter now types the package with a local interface and loads it with a dynamic `import()` only when a sync uses the Scraper source. Turbopack builds no longer fail without it either. A missing package gives a clear error message.
- `impit` is no longer a peer dependency. The plugin never imports it; `google-maps-review-scraper` installs it. `google-maps-review-scraper` is now a declared optional peer (`^2.2.0`).
- On TypeScript 6 or 7, a site's typecheck could fail on the button's `.scss` import. The package now declares `*.scss` modules.
- The sync button now uses the site's API route (`routes.api` and `serverURL`), not a fixed `/api`.
- **Sync Reviews Now** reported success when the sync failed. The endpoint now runs only its own job and answers with the job's error.
- The sync task is typed by its own input and output, so it no longer needs `reviews-sync` in the site's generated types.
- Media IDs may be strings (MongoDB), not only numbers.
- The Places API request encodes the Place ID.
- The Reviews Source help text said the scraper uses headless Chromium. It uses `impit`, with no browser.
- The sync spinner stops under reduced motion.
- `pnpm pack` now packs only `src`, the README and the changelog.

## [0.1.0]

### Added

- First version: the `reviews` collection, the `review-settings` global, the weekly `reviews-sync` job, the `POST /api/google-reviews/sync` endpoint with the **Sync Reviews Now** button, the Places API and scraper adapters, and the `googleReviews` block config.

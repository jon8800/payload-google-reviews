# Changelog

All notable changes to `payload-google-reviews` (called `@sea-la-vie/payload-google-reviews` before 0.4.0). The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The package uses [semantic versioning](https://semver.org/). Before 1.0, a minor version can break the API.

## [0.5.0-next.0] - 2026-11-12

The first release for Payload 4. It is published under the npm dist-tag `next`. The Payload 3 line stays on `0.4.x` (`latest`).

### Changed

- **Breaking:** needs Payload and `@payloadcms/ui` `^4.0.0-beta.8`, React `^19.3.1` and Node `>=24.22.1`.
- **Breaking:** the sync button uses Payload 4's own `Button` and `RefreshIcon`. The `lucide-react` peer dependency is gone.
- The button's style is plain CSS on Payload 4's design tokens (`syncReviewsButton.css`). The package ships no `.scss`, so a site needs no `sass`.
- The `reviews` collection and the `review-settings` global set `versions: false` and `authorship: false`. Payload 4 turns both on by default. Off keeps the database schema the same as on Payload 3.
- The sync endpoint queues and runs the job with `overrideAccess: true`. Payload 4 enforces `jobs.access` by default; the endpoint keeps its own rule, as on Payload 3: any signed-in user can sync.
- A `schedule` with a step that has no range before `/` (`/10`, `5/15`) now throws at startup with the fix in the message. Payload 4 rejects these crons.

### Migration

1. Upgrade the site to Payload 4 first (see Payload's 3 to 4 migration guide).
2. Run `pnpm add payload-google-reviews@next`. Remove `lucide-react` if nothing else in the site uses it.
3. Run `pnpm payload generate:importmap` and `pnpm payload generate:types`.
4. If you set `schedule`, check its steps (see above).

On Postgres, Payload 4's own jobs changes (`processingUntil`, `concurrencyKey`, `payload-jobs-stats`) need a migration in production. This plugin adds no schema changes of its own.

### Development

- Added a SQLite integration test on Payload 4: the sync job creates and then updates reviews from a mocked Places API, the endpoint works with locked-down `jobs.access`, and it answers 500 with the job's error.
- Added `.github/workflows/publish-next.yml`: a `v*-next.*` tag publishes to the `next` dist-tag. `publish.yml` skips those tags. `scripts/publish.mjs` takes `--dist-tag` and fails when the version would go to a different dist-tag.
- `pnpm-workspace.yaml` pins Node 24.22.3 for pnpm scripts.

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

# cinemaxxx — verification report

Scope: independent fork of the CINEMAX application, branch `arena/f440e381-cinemaxxx`, base `fd5e758`.
Nothing has been committed, pushed, deployed, or written to a Neon/Vercel account.
Verification ran against an **isolated local PostgreSQL 16.2 database** (not Neon) and a
local production build of Next.js 16.4.3 on port 3000. No device or emulator was available.

## Results

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npm run lint -- --max-warnings 0` | clean |
| `git diff --check` | clean |
| `npm run build` (Turbopack, production) | compiled; 14/14 static pages |
| `npm run verify:api` (real server + DB) | 44 passed, 0 failed |
| `npm run verify:channels` | 73 checks, 0 failures |
| `npm run verify:schema` (rolled back) | 16 checks, 0 failures |
| logo verifier | 317/317 |
| platform verifier | 42/42 |
| share verifier (`verify:share`) | 64 checks, 0 failures |
| legal verifier | 140/140 |
| `npm run verify:promo` | 63 checks, 0 failures; exit code 0 on the final run |
| Playwright `age-declaration.spec.ts` | 4 passed |
| Playwright `channel-management.spec.ts` | 2 passed (desktop, small-mobile) |
| Playwright `redesign.spec.ts` layouts | 3 passed |
| Playwright full UI run (196 tests, first run) | 120 passed, 24 failed, 52 skipped |
| Playwright targeted recheck (redesign, providers, universal-playback) | 67 passed, 5 failed, 48 skipped |
| Android unit / DOM / brand / APK checks | 228 / 73 / 317 / 110, 0 failures |

The 48 skipped tests need the local media fixture provider (`tests/fixtures/local-provider.mjs`
on port 8900 with `FIXTURE_ROOT` media). That provider was not started, so playback coverage
for HLS/DASH/range requests is **not verified** in this run.

### Remaining browser failures (5)

Both remaining failures are in the home page, and the first existed in the base commit:

1. `tests/redesign.spec.ts:7` (all four projects) clicks a `Filter the catalogue` group
   that does not exist in the base commit or in this fork. This is a stale test, not a regression.
2. `tests/redesign.spec.ts:153` (desktop only) expects the verified "Movies" rail to overflow.
   The temporary library had only two verified titles in that rail, so the carousel had nothing
   to scroll. Data dependent; mobile projects pass.

Failures fixed during this session were data and test-setup issues: the official-external test
used a YouTube URL (an embed provider, not a handoff), the age gate blocked the top-level studio
test (`preparePage` was missing), and the hero had no verified slide.

## Test data hygiene

Temporary catalogue rows, slides, channels and categories used for browser tests were deleted
from the isolated test database. A final read confirmed `/api/movies`, `/api/categories` and
`/api/channels` return empty lists. The test database therefore contains no content rows.

## Known limitations

- **Verification-origin APK.** `public/downloads/cinemaxxx-1.1.0.apk` (220,024 bytes,
  sha256 `eef727da…`) is built against `https://verification.example.invalid` and signed with a
  throwaway test key (cert sha256 `41bae55a…`). It is not a production download. Replace it with a
  build from your origin and your release key before publishing.
- **Assetlinks empty.** `public/.well-known/assetlinks.json` has `sha256_cert_fingerprints: []`
  until you publish your release fingerprint, so Android App Links are not verified.
- **Old keystore in Git history.** The tracked test keystore was deleted from the working tree,
  but it remains in history and must be treated as compromised. Rotating the key or rewriting
  history is an operator decision.
- **No device testing.** Splash motion and the native shell were checked only offline (frame timing
  and rendered previews).
- **No Vercel project created.** The connected Vercel account contains no `cinemaxxx` project.
  Creating one needs your confirmation and your environment values.
- **No Neon project used.** All database checks ran on local PostgreSQL 16.2. The SQL file is
  idempotent and was imported twice cleanly, but it has not been executed against Neon.
- **GitHub CI not run.** The workflow changes are present but have not run on GitHub.
- **Age declaration is self-declaration only.** It is not verified age assurance. Browsers may
  refuse `window.close()` on tabs they did not open.
- **Upstream references remain in historical reports** under `docs/round*-report.md`. They describe
  the original project and were left intact.

## Full database schema (`database/cinemaxxx.sql`)

The file is credential-free and idempotent. It is reproduced here in full:

```sql
-- cinemaxxx: complete, additive schema for a NEW, independent Neon database.
-- Run against the new project's database only. Contains no credentials or rows.
-- Existing movies/slides/categories/watchlist/admins shapes are preserved.
-- Re-running this file is safe; it never drops tables or deletes content.
BEGIN;

CREATE TABLE IF NOT EXISTS movies (
  id serial PRIMARY KEY,
  title varchar(500) NOT NULL DEFAULT '',
  description text DEFAULT '',
  year integer DEFAULT 2024,
  rating varchar(10) DEFAULT '8.0',
  duration varchar(50) DEFAULT '2h 0m',
  genre varchar(500) DEFAULT '',
  language varchar(200) DEFAULT 'English',
  type varchar(50) DEFAULT 'Movie',
  director varchar(200) DEFAULT '',
  "cast" text DEFAULT '',
  poster_url text DEFAULT '',
  backdrop_url text DEFAULT '',
  video_url text DEFAULT '',
  subtitle_url text DEFAULT '',
  subtitle_language varchar(100) DEFAULT '',
  rights_confirmed boolean DEFAULT false,
  catalog_status varchar(64) DEFAULT 'verified_playable',
  source_type varchar(64) DEFAULT 'direct',
  license_info varchar(300) DEFAULT '',
  source_attribution varchar(500) DEFAULT '',
  rating_source varchar(100) DEFAULT '',
  release_date varchar(64) DEFAULT '',
  trailer_url text DEFAULT '',
  verification_result text DEFAULT '',
  last_verified_at timestamp,
  category varchar(500) DEFAULT 'trending',
  featured boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS slides (
  id serial PRIMARY KEY,
  title varchar(500) NOT NULL DEFAULT '',
  subtitle text DEFAULT '',
  image_url text DEFAULT '',
  movie_id integer REFERENCES movies(id) ON DELETE SET NULL,
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL DEFAULT '',
  slug varchar(100) NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true
);
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS channels (
  id serial PRIMARY KEY,
  category_id integer NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name varchar(200) NOT NULL,
  description text NOT NULL DEFAULT '',
  stream_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT channels_name_check CHECK (length(btrim(name)) > 0),
  CONSTRAINT channels_stream_url_check CHECK (
    length(stream_url) <= 4096 AND stream_url ~ '^https?://[^[:space:]]+$'
  ),
  CONSTRAINT channels_sort_order_check CHECK (sort_order >= 0)
);

-- Actual uploaded bytes, not an ephemeral filesystem path or a demo image URL.
-- Separate from channel metadata so listing channels never transfers logo blobs.
CREATE TABLE IF NOT EXISTS channel_logos (
  channel_id integer PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
  content bytea NOT NULL,
  mime_type varchar(32) NOT NULL,
  byte_size integer NOT NULL,
  sha256 varchar(64) NOT NULL,
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT channel_logos_mime_type_check CHECK (
    mime_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif')
  ),
  CONSTRAINT channel_logos_byte_size_check CHECK (
    byte_size > 0 AND byte_size <= 2097152 AND octet_length(content) = byte_size
  )
);

CREATE TABLE IF NOT EXISTS watchlist (
  id serial PRIMARY KEY,
  session_id varchar(200) NOT NULL,
  movie_id integer REFERENCES movies(id) ON DELETE CASCADE,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admins (
  id serial PRIMARY KEY,
  email varchar(200) NOT NULL UNIQUE,
  password_hash text NOT NULL DEFAULT ''
);

-- Named constraints also support databases created by the older runtime schema.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_name_check' AND conrelid = 'categories'::regclass) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_name_check CHECK (length(btrim(name)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_slug_check' AND conrelid = 'categories'::regclass) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_slug_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_sort_order_check' AND conrelid = 'categories'::regclass) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_sort_order_check CHECK (sort_order >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_movies_catalog_status ON movies(catalog_status);
CREATE INDEX IF NOT EXISTS idx_movies_category ON movies(category);
CREATE INDEX IF NOT EXISTS idx_movies_featured ON movies(featured);
CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year);
CREATE INDEX IF NOT EXISTS idx_movies_type ON movies(type);
CREATE INDEX IF NOT EXISTS idx_movies_language ON movies(language);
CREATE INDEX IF NOT EXISTS idx_watchlist_session_movie ON watchlist(session_id, movie_id);
CREATE INDEX IF NOT EXISTS idx_slides_active_sort ON slides(active, sort_order);
CREATE INDEX IF NOT EXISTS idx_slides_created_latest ON slides(created_at DESC NULLS LAST, sort_order, id DESC);
CREATE INDEX IF NOT EXISTS idx_categories_enabled_sort ON categories(enabled, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_channels_category_enabled_sort ON channels(category_id, enabled, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_channels_enabled_sort ON channels(enabled, sort_order, id);

COMMIT;
```

## Changed and new files

Output of `git status --short` at the time of this report (uncommitted):

```
 M .env.example
 M .github/workflows/android.yml
 M .gitignore
 M .perf/harness.tsx
 M README.md
 M android/README.md
 M android/app/src/main/AndroidManifest.xml
 D android/app/src/main/java/com/cinemax/app/AppTheme.java
 D android/app/src/main/java/com/cinemax/app/CinemaxBridge.java
 D android/app/src/main/java/com/cinemax/app/CinemaxChromeClient.java
 D android/app/src/main/java/com/cinemax/app/CinemaxSplashView.java
 D android/app/src/main/java/com/cinemax/app/CinemaxWebViewClient.java
 D android/app/src/main/java/com/cinemax/app/MainActivity.java
 D android/app/src/main/java/com/cinemax/app/NavigationPolicy.java
 D android/app/src/main/java/com/cinemax/app/ShareFileProvider.java
 D android/app/src/main/java/com/cinemax/app/ShareLauncher.java
 D android/app/src/main/java/com/cinemax/app/SplashMotion.java
 M android/app/src/main/res/layout/activity_main.xml
 M android/app/src/main/res/values/strings.xml
 M android/build.sh
 D android/keystore/cinemax-release.keystore
 M android/tests/apk_check.py
 M android/tests/install-test-deps.sh
 M android/tests/java/CinemaxAppTest.java
 M android/tests/run-tests.sh
 M android/tests/shell-dom.test.mjs
 M android/tools/SplashPreview.java
 M android/tools/fetch-toolchain.sh
 M android/tools/preview-splash.sh
 M docs/legal-and-sharing.md
 M drizzle.config.ts
 M package-lock.json
 M package.json
 M public/.well-known/assetlinks.json
 D public/downloads/Cinemax-1.1.0.apk
 M public/manifest.json
 M public/offline.html
 M public/sw.js
 M scripts/verify-admin.mjs
 M scripts/verify-app-promo.mjs
 M scripts/verify-share.mjs
 M src/app/api/admin/login/route.ts
 M src/app/api/admin/stats/route.ts
 M src/app/api/categories/[id]/route.ts
 M src/app/api/categories/route.ts
 M src/app/api/health/route.ts
 M src/app/api/media/[...slug]/route.ts
 M src/app/api/stream/[id]/route.ts
 M src/app/categories/page.tsx
 M src/app/category/[slug]/page.tsx
 M src/app/copyright/page.tsx
 M src/app/disclaimer/page.tsx
 M src/app/gate-keeper/dashboard/page.tsx
 M src/app/gate-keeper/layout.tsx
 M src/app/gate-keeper/page.tsx
 M src/app/globals.css
 M src/app/layout.tsx
 M src/app/license/page.tsx
 M src/app/page.tsx
 M src/app/privacy/page.tsx
 M src/app/share/[id]/page.tsx
 M src/components/AppPromo.tsx
 M src/components/BottomNav.tsx
 M src/components/CatalogueProvider.tsx
 M src/components/Header.tsx
 M src/components/HeroSlider.tsx
 M src/components/LegalDocument.tsx
 M src/components/Logo.tsx
 M src/components/PlaybackOverlay.tsx
 M src/components/ProviderLanding.tsx
 M src/components/SplashScreen.tsx
 M src/components/VideoPlayer.tsx
 M src/db/ensure-schema.ts
 M src/db/index.ts
 M src/db/rows.ts
 M src/db/schema.ts
 M src/db/table-map.ts
 M src/db/with-db.ts
 M src/lib/api.ts
 M src/lib/app-promo.ts
 M src/lib/auth.ts
 M src/lib/catalogue.ts
 M src/lib/legal.ts
 M src/lib/movies.ts
 M src/lib/playback/safe-fetch.ts
 M src/lib/playback/web-resolver.ts
 M src/lib/providers/adapters/direct-media.ts
 M src/lib/providers/adapters/generic.ts
 M src/lib/providers/adapters/local-source.ts
 M src/lib/providers/adapters/ott.ts
 M src/lib/share-card.tsx
 M src/lib/share-server.ts
 M src/lib/share.ts
 M tests/helpers.ts
 M tests/network-isolation.spec.ts
 M tests/playback.spec.ts
 M tests/providers.spec.ts
 M tests/redesign.spec.ts
 M tests/universal-playback.spec.ts
?? android/app/src/main/java/com/cinemaxxx/
?? android/tools/configure-deployment.py
?? database/
?? docs/cinemaxxx-deployment.md
?? docs/cinemaxxx-verification.md
?? public/downloads/cinemaxxx-1.1.0.apk
?? scripts/verify-channels.mjs
?? scripts/verify-schema.mjs
?? src/app/api/admin/categories/
?? src/app/api/admin/channels/
?? src/app/api/channels/
?? src/components/AgeDeclaration.tsx
?? src/components/AgeDeclarationContext.ts
?? src/components/ChannelGrid.tsx
?? src/components/studio/
?? src/db/channel-query.ts
?? src/lib/admin-reorder.ts
?? src/lib/channel-logo.ts
?? tests/age-declaration.spec.ts
?? tests/channel-management.spec.ts
```

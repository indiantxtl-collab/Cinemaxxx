# cinemaxxx — independent deployment and verification

This fork keeps the existing Next.js application, visual treatment and studio at
`/gate-keeper`. It adds database-backed category/channel management and an adult
self-declaration. It does not connect to or migrate the original CINEMAX database.

## 1. Create a separate Neon database

These are instructions for your accounts; no Neon project, production database,
Vercel project or deployment was created by this implementation.

1. Sign in to the Neon Console and create a **new project** named `cinemaxxx`.
   Choose your region and PostgreSQL version. Do not select the original
   CINEMAX project or reuse its connection string.
2. In the new project, open **SQL Editor**. Select the new project's database
   (the default is commonly `neondb`; use the database actually shown in your
   connection details) and a role authorized to create tables.
3. Open `database/cinemaxxx.sql` from this repository, paste its **entire**
   contents into the editor, and execute it once with **Run**. The file includes
   its own `BEGIN`/`COMMIT`; it creates no credentials, admin rows or content.
4. Confirm that the execution finishes without an error. In the Neon Tables
   view, confirm these seven tables exist: `movies`, `slides`, `categories`,
   `channels`, `channel_logos`, `watchlist`, `admins`.
5. Open the new project's **Connect** dialog. Select the same database and role,
   enable **Connection pooling**, and copy the PostgreSQL connection string.
   Keep TLS enabled (`sslmode=require`). This is the application's
   `DATABASE_URL`. Never put it in a `NEXT_PUBLIC_*` variable or commit it.

The SQL is additive and repeatable on a fresh database. It does not drop tables
or insert catalogue rows. For an existing fork database, take a backup first;
`CREATE TABLE IF NOT EXISTS` is not a general migration for arbitrary old table
shapes. The application's runtime reconciler handles the legacy column mappings
listed in `src/db/table-map.ts`. Use either the SQL file or the runtime
reconciler to initialize a fresh database; running both was tested locally.

Optional CLI execution against the **new** database, using a connection string
you copied privately into your own shell:

```bash
# psql reads the connection string from your environment; no address is embedded.
export DATABASE_URL='PASTE_YOUR_NEW_NEON_CONNECTION_STRING'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/cinemaxxx.sql
unset DATABASE_URL
```

Do not run the optional demo-catalog cleanup against a fresh empty database.
That script is only for an explicitly identified old demo catalogue and defaults
to a dry run.

## 2. Configure the application

The canonical local configuration file is `.env.local`; `.env.example` is its
credential-free template. Next.js loads `.env.local` automatically. Drizzle also
loads `.env.local` then `.env`. Shell scripts and Android use the exported
process environment, not automatic Next.js env loading.

```bash
npm ci
cp .env.example .env.local
# Edit .env.local privately. Generate a secret without putting it in chat:
openssl rand -base64 48
```

Required values:

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | The new Neon project's pooled TLS connection string |
| `JWT_SECRET` | A new random value of at least 32 characters |
| `ADMIN_EMAIL` | Your chosen studio login email |
| `ADMIN_PASSWORD` | Your chosen strong studio password |
| `NEXT_PUBLIC_SITE_URL` | This fork's actual public HTTPS origin, no path |

There are no working default credentials. Missing/short authentication settings
fail closed with HTTP 503. The password is compared in constant time through
fixed-length digests; sessions use HS256 JWTs with issuer/audience checks and an
HttpOnly, SameSite=Lax cookie (Secure in production). The `admins` table remains
compatible with the existing schema; the current login uses the configured
environment identity, not a seeded admin row.

Optional inherited playback settings are documented in `.env.example`. Leave
`TORRENT_STREAMING_ENABLED=false` unless you operate the separate authorized
gateway. Leave private-host playback access disabled in production.

## 3. Run locally

Use Node.js 22 (the package requires at least 20.9). For local HTTP development,
use your own local PostgreSQL database or a separate Neon development branch.
Production cookies require HTTPS; use an HTTPS deployment to test studio login
with `npm run start` in production mode.

```bash
npm run dev                 # http://localhost:3000
npm run typecheck
npm run lint -- --max-warnings 0
npm run build
```

Open `/gate-keeper`, sign in with your configured identity, and add categories
and channels in the existing studio's **Categories** and **Channels** tabs.
Nothing is seeded. Channel sources must be direct HTTP(S) video/HLS/DASH URLs
that you are authorized to distribute. Logos are actual PNG/JPEG/WebP/GIF bytes
in PostgreSQL, limited to 2 MiB per channel; they are not temporary disk files.
Disabling a category hides its channels from public listings and playback.

## 4. Deploy this fork to Vercel

1. Push this working branch to `indiantxtl-collab/Cinemaxxx` and import that fork
   into a **new** Vercel project. Do not repoint the original CINEMAX project.
2. Use the **Next.js** preset, repository root, `npm ci` install command and
   `npm run build` build command. Leave the Next.js output directory default.
   Use Node.js 22 in Project Settings.
3. Add the five required variables above in Project → Settings → Environment
   Variables for Production and the Preview environments you use. Add optional
   gateway variables only if needed. If a Neon integration added `POSTGRES_URL`,
   verify it belongs to the new project; explicit `DATABASE_URL` takes priority.
4. Set `NEXT_PUBLIC_SITE_URL` to the actual production origin assigned to this
   project (or your verified custom domain). Do not use the upstream domain.
5. Deploy, then redeploy after any environment-variable change. Canonical share
   metadata is generated at build time, so a URL change requires a new build.
6. Verify the deployment using the commands below. Add real content only through
   the studio; do not copy the original database merely to make the app look full.

The connected Vercel account was inspected read-only. No `cinemaxxx` project was
found, and no unrelated project or environment variable was changed. Creating a
project and supplying its real Neon/auth configuration remains an operator step.

## 5. Verify connectivity and persistence

```bash
curl -fsS https://YOUR-ACTUAL-ORIGIN/api/health
curl -fsS https://YOUR-ACTUAL-ORIGIN/api/categories
curl -fsS https://YOUR-ACTUAL-ORIGIN/api/channels
```

`/api/health` must return HTTP 200 with `ok: true`, the expected Neon host/database
in `connection`, and all seven tables in `tables`. It checks connect → schema →
read and does not return the password. A fresh database has zero content rows.
On failure, `stage` identifies connect/schema/read; inspect the message and the
new project's environment settings rather than substituting demo content.

For destructive CRUD checks, use a disposable Neon branch first:

```bash
export BASE_URL='https://YOUR-ACTUAL-ORIGIN'
export ADMIN_EMAIL='YOUR_CONFIGURED_EMAIL'
# Read the password without echoing it into shell history:
read -rs ADMIN_PASSWORD; export ADMIN_PASSWORD
npm run verify:api
npm run verify:channels
npm run verify:schema
unset ADMIN_PASSWORD ADMIN_EMAIL BASE_URL
```

The API scripts create uniquely marked records and remove them. `verify:schema`
uses rolled-back transactions. Browser tests need a populated **test** library;
an empty production database is intentional, not a failed connection. Do not
fill production with fake titles to satisfy a test fixture.

## 6. Android release and download

The application id is `com.cinemaxxx.app`, label `cinemaxxx`, version 1.1.0
(code 2), minSdk 24, targetSdk 34. The existing emblem, colors, native splash
motion and app-only presentation layer are retained. Internal bridge/storage
identifiers remain compatible where changing them would break behavior.

The Android build requires `CINEMAXXX_SITE_URL` as an HTTPS origin. It generates
the host into the manifest and Java constants; there is no upstream host fallback.
Release builds require your private keystore and all signing variables. No
release key/password is shipped. The old tracked keystore was removed.

```bash
export CINEMAXXX_SITE_URL='https://YOUR-ACTUAL-ORIGIN'
export CINEMAXXX_KEYSTORE='/PRIVATE/PATH/cinemaxxx-release.p12'
export CINEMAXXX_KEY_ALIAS='YOUR_KEY_ALIAS'
read -rs CINEMAXXX_STORE_PASS; export CINEMAXXX_STORE_PASS
read -rs CINEMAXXX_KEY_PASS; export CINEMAXXX_KEY_PASS
bash android/build.sh
CINEMAXXX_REQUIRE_JSDOM=1 bash android/tests/run-tests.sh --skip-build
```

The built APK is `android/dist/cinemaxxx-1.1.0.apk`. Before publishing the web
 download, copy the **production-origin, production-key** build to
`public/downloads/cinemaxxx-1.1.0.apk`, replacing any verification artifact, and
run `npm run verify:promo`. The checked-in artifact in this working tree is an
isolated verification build pointing at `verification.example.invalid`; it is
not a production download and must be replaced before release.

Update `public/.well-known/assetlinks.json` with the SHA-256 certificate
fingerprint of your actual release key, then redeploy the website. Its fingerprint
list is deliberately empty until that key exists; do not publish a test key's
fingerprint as production trust. See `android/README.md` for the exact command.

GitHub Actions requires repository variable `CINEMAXXX_SITE_URL` and secrets
`CINEMAXXX_KEYSTORE_BASE64`, `CINEMAXXX_KEY_ALIAS`, `CINEMAXXX_STORE_PASS`,
`CINEMAXXX_KEY_PASS`. The workflow decodes the key into a private temporary file,
builds/tests both variants and removes the temporary key. CI has not been run on
GitHub in this session. The Gradle-free script produces APKs, not a Play Store
AAB; use your release process for store packaging.

## 6a. Custom domain: `cinemaxxx.cinemaxtv.space`

The application's own origin is `https://cinemaxxx.cinemaxtv.space`. It is used
for canonical URLs, `robots.txt` and `sitemap.xml`, Open Graph and share links,
the PWA manifest, the Android origin and App Links. Third-party, API-provider and
database hosts are not part of this change and must not be pointed at it.

Manual steps (DNS, Vercel and the Android side are not automated by the repo):

1. **DNS** (`cinemaxtv.space` zone): add `cinemaxxx` as a `CNAME` to the target
   Vercel shows for the domain (normally `cname.vercel-dns.com`). Do not change
   any existing record for `cinemaxtv.space` or other subdomains.
2. **Vercel**: Project `cinemaxxx` -> Settings -> Domains -> add
   `cinemaxxx.cinemaxtv.space`, and wait for the certificate to show as issued.
3. **Vercel environment** (Production): set `NEXT_PUBLIC_SITE_URL` to
   `https://cinemaxxx.cinemaxtv.space`, then redeploy `main`.
4. **Deployment protection**: turn it off for the production deployment (or the
   public site stays behind Vercel's login page).
5. **Auth**: the admin login is a first-party JWT cookie (`admin_token`,
   host-only, `HttpOnly`, `SameSite=Lax`, `Secure` in production). It has no
   third-party OAuth callback, so no provider console needs a redirect URI. If an
   OAuth provider is added later, register `https://cinemaxxx.cinemaxtv.space/...`
   as its redirect URI.
6. **Android**: build with `CINEMAXXX_SITE_URL=https://cinemaxxx.cinemaxtv.space`
   (also set the GitHub repository variable of that name). `android/tools/configure-deployment.py`
   refuses the old CINEMAX hosts and `localhost`. Then set the release signing
   certificate's SHA-256 in `public/.well-known/assetlinks.json` and serve that
   file from the new origin, so App Links verify for this host.
7. **Verify** after DNS propagates:
   `curl -sI https://cinemaxxx.cinemaxtv.space/robots.txt`,
   `curl -s https://cinemaxxx.cinemaxtv.space/sitemap.xml`,
   `curl -sI https://cinemaxxx.cinemaxtv.space/.well-known/assetlinks.json`,
   and `https://cinemaxxx.cinemaxtv.space/api/health`.

## 7. Age declaration and limits

The first-entry dialog asks **“Are you 18 or older?”**. Yes stores a local
self-declaration; No blocks access, calls the native exit bridge in Android or
attempts `window.close()` in a browser, and leaves an Access blocked screen.
Browsers may refuse to close a tab they did not open, so an actual browser-tab
close cannot be guaranteed. This is **not verified age assurance**.

Verification in this session used isolated PostgreSQL 16.2, not Neon; no device
or emulator was available. See `docs/cinemaxxx-verification.md` for exact test
results, skipped coverage and the complete changed-file inventory.

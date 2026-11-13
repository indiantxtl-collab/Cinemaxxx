import { sql } from "drizzle-orm";
import { getDb } from "./index";

type ColumnSpec = {
  column: string;
  sqlType: string;
  legacy?: readonly string[];
};

const TABLES: Record<string, { createSql: string; columns: readonly ColumnSpec[] }> = {
  movies: {
    createSql: `
      CREATE TABLE IF NOT EXISTS "movies" (
        "id" serial PRIMARY KEY,
        "title" varchar(500) NOT NULL DEFAULT '',
        "description" text DEFAULT '',
        "year" integer DEFAULT 2024,
        "rating" varchar(10) DEFAULT '8.0',
        "duration" varchar(50) DEFAULT '2h 0m',
        "genre" varchar(500) DEFAULT '',
        "language" varchar(200) DEFAULT 'English',
        "type" varchar(50) DEFAULT 'Movie',
        "director" varchar(200) DEFAULT '',
        "cast" text DEFAULT '',
        "poster_url" text DEFAULT '',
        "backdrop_url" text DEFAULT '',
        "video_url" text DEFAULT '',
        "subtitle_url" text DEFAULT '',
        "subtitle_language" varchar(100) DEFAULT '',
        "rights_confirmed" boolean DEFAULT false,
        "catalog_status" varchar(64) DEFAULT 'verified_playable',
        "source_type" varchar(64) DEFAULT 'direct',
        "license_info" varchar(300) DEFAULT '',
        "source_attribution" varchar(500) DEFAULT '',
        "rating_source" varchar(100) DEFAULT '',
        "release_date" varchar(64) DEFAULT '',
        "trailer_url" text DEFAULT '',
        "verification_result" text DEFAULT '',
        "last_verified_at" timestamp,
        "category" varchar(500) DEFAULT 'trending',
        "featured" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now()
      );
    `,
    columns: [
      { column: "title", sqlType: "varchar(500) NOT NULL DEFAULT ''" },
      { column: "description", sqlType: "text DEFAULT ''" },
      { column: "year", sqlType: "integer DEFAULT 2024" },
      { column: "rating", sqlType: "varchar(10) DEFAULT '8.0'" },
      { column: "duration", sqlType: "varchar(50) DEFAULT '2h 0m'" },
      { column: "genre", sqlType: "varchar(500) DEFAULT ''" },
      { column: "language", sqlType: "varchar(200) DEFAULT 'English'" },
      { column: "type", sqlType: "varchar(50) DEFAULT 'Movie'" },
      { column: "director", sqlType: "varchar(200) DEFAULT ''" },
      { column: "cast", sqlType: "text DEFAULT ''" },
      { column: "poster_url", sqlType: "text DEFAULT ''", legacy: ["posterUrl", "poster"] },
      { column: "backdrop_url", sqlType: "text DEFAULT ''", legacy: ["backdropUrl", "backdrop"] },
      { column: "video_url", sqlType: "text DEFAULT ''", legacy: ["videoUrl", "video"] },
      { column: "subtitle_url", sqlType: "text DEFAULT ''", legacy: ["subtitleUrl", "subtitles"] },
      { column: "subtitle_language", sqlType: "varchar(100) DEFAULT ''", legacy: ["subtitleLanguage"] },
      { column: "rights_confirmed", sqlType: "boolean DEFAULT false", legacy: ["rightsConfirmed"] },
      { column: "catalog_status", sqlType: "varchar(64) DEFAULT 'verified_playable'", legacy: ["catalogStatus", "status"] },
      { column: "source_type", sqlType: "varchar(64) DEFAULT 'direct'", legacy: ["sourceType"] },
      { column: "license_info", sqlType: "varchar(300) DEFAULT ''", legacy: ["licenseInfo", "license"] },
      { column: "source_attribution", sqlType: "varchar(500) DEFAULT ''", legacy: ["sourceAttribution", "attribution"] },
      { column: "rating_source", sqlType: "varchar(100) DEFAULT ''", legacy: ["ratingSource"] },
      { column: "release_date", sqlType: "varchar(64) DEFAULT ''", legacy: ["releaseDate"] },
      { column: "trailer_url", sqlType: "text DEFAULT ''", legacy: ["trailerUrl", "trailer"] },
      { column: "verification_result", sqlType: "text DEFAULT ''", legacy: ["verificationResult"] },
      { column: "last_verified_at", sqlType: "timestamp", legacy: ["lastVerifiedAt"] },
      { column: "category", sqlType: "varchar(500) DEFAULT 'trending'" },
      { column: "featured", sqlType: "boolean DEFAULT false" },
      { column: "created_at", sqlType: "timestamp DEFAULT now()", legacy: ["createdAt"] },
    ],
  },
  slides: {
    createSql: `
      CREATE TABLE IF NOT EXISTS "slides" (
        "id" serial PRIMARY KEY,
        "title" varchar(500) NOT NULL DEFAULT '',
        "subtitle" text DEFAULT '',
        "image_url" text DEFAULT '',
        "movie_id" integer REFERENCES "movies"("id") ON DELETE SET NULL,
        "sort_order" integer DEFAULT 0,
        "active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now()
      );
    `,
    columns: [
      { column: "title", sqlType: "varchar(500) NOT NULL DEFAULT ''" },
      { column: "subtitle", sqlType: "text DEFAULT ''" },
      { column: "image_url", sqlType: "text DEFAULT ''", legacy: ["imageUrl", "image"] },
      { column: "movie_id", sqlType: "integer", legacy: ["movieId"] },
      { column: "sort_order", sqlType: "integer DEFAULT 0", legacy: ["sortOrder", "order"] },
      { column: "active", sqlType: "boolean DEFAULT true" },
      { column: "created_at", sqlType: "timestamp DEFAULT now()", legacy: ["createdAt"] },
    ],
  },
  categories: {
    createSql: `
      CREATE TABLE IF NOT EXISTS "categories" (
        "id" serial PRIMARY KEY,
        "name" varchar(100) NOT NULL DEFAULT '',
        "slug" varchar(100) NOT NULL UNIQUE,
        "sort_order" integer NOT NULL DEFAULT 0,
        "enabled" boolean NOT NULL DEFAULT true
      );
    `,
    columns: [
      { column: "name", sqlType: "varchar(100) NOT NULL DEFAULT ''" },
      { column: "slug", sqlType: "varchar(100) NOT NULL" },
      { column: "sort_order", sqlType: "integer NOT NULL DEFAULT 0", legacy: ["sortOrder"] },
      { column: "enabled", sqlType: "boolean NOT NULL DEFAULT true" },
    ],
  },
  channels: {
    createSql: `
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
    `,
    columns: [
      { column: "category_id", sqlType: "integer NOT NULL" },
      { column: "name", sqlType: "varchar(200) NOT NULL" },
      { column: "description", sqlType: "text NOT NULL DEFAULT ''" },
      { column: "stream_url", sqlType: "text NOT NULL" },
      { column: "sort_order", sqlType: "integer NOT NULL DEFAULT 0" },
      { column: "enabled", sqlType: "boolean NOT NULL DEFAULT true" },
      { column: "created_at", sqlType: "timestamp NOT NULL DEFAULT now()" },
      { column: "updated_at", sqlType: "timestamp NOT NULL DEFAULT now()" },
    ],
  },
  channel_logos: {
    createSql: `
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
    `,
    columns: [
      { column: "channel_id", sqlType: "integer PRIMARY KEY" },
      { column: "content", sqlType: "bytea NOT NULL" },
      { column: "mime_type", sqlType: "varchar(32) NOT NULL" },
      { column: "byte_size", sqlType: "integer NOT NULL" },
      { column: "sha256", sqlType: "varchar(64) NOT NULL" },
      { column: "updated_at", sqlType: "timestamp NOT NULL DEFAULT now()" },
    ],
  },
  watchlist: {
    createSql: `
      CREATE TABLE IF NOT EXISTS "watchlist" (
        "id" serial PRIMARY KEY,
        "session_id" varchar(200) NOT NULL,
        "movie_id" integer REFERENCES "movies"("id") ON DELETE CASCADE,
        "created_at" timestamp DEFAULT now()
      );
    `,
    columns: [
      { column: "session_id", sqlType: "varchar(200) NOT NULL DEFAULT ''", legacy: ["sessionId"] },
      { column: "movie_id", sqlType: "integer", legacy: ["movieId"] },
      { column: "created_at", sqlType: "timestamp DEFAULT now()", legacy: ["createdAt"] },
    ],
  },
  admins: {
    createSql: `
      CREATE TABLE IF NOT EXISTS "admins" (
        "id" serial PRIMARY KEY,
        "email" varchar(200) NOT NULL UNIQUE,
        "password_hash" text NOT NULL DEFAULT ''
      );
    `,
    columns: [
      { column: "email", sqlType: "varchar(200) NOT NULL" },
      { column: "password_hash", sqlType: "text NOT NULL DEFAULT ''", legacy: ["passwordHash", "password"] },
    ],
  },
};

export type SchemaReport = {
  ok: boolean;
  error: string | null;
  tables: Record<string, { created: boolean; added: string[]; renamed: string[]; backfilled: string[]; columns: string[] }>;
};

let ensuredPromise: Promise<SchemaReport> | null = null;
let latestReport: SchemaReport | null = null;

export function getSchemaReport(): SchemaReport | null {
  return latestReport;
}

async function inspectColumns(table: string): Promise<Set<string>> {
  const db = getDb();
  const res = await db.execute(
    sql`SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ${table}`
  );
  const rows = (res as unknown as { rows?: Array<{ column_name: string }> }).rows ?? [];
  return new Set(rows.map((r) => r.column_name));
}

async function reconcileTable(
  table: string,
  spec: { createSql: string; columns: readonly ColumnSpec[] }
): Promise<SchemaReport["tables"][string]> {
  const db = getDb();
  let existing = await inspectColumns(table);
  const created = existing.size === 0;

  if (created) {
    await db.execute(sql.raw(spec.createSql));
    existing = await inspectColumns(table);
  }

  const added: string[] = [];
  const renamed: string[] = [];
  const backfilled: string[] = [];

  for (const col of spec.columns) {
    const legacyPresent = (col.legacy ?? []).find((name) => existing.has(name));

    if (!existing.has(col.column) && legacyPresent) {
      await db.execute(sql.raw(`ALTER TABLE "${table}" RENAME COLUMN "${legacyPresent}" TO "${col.column}"`));
      existing.delete(legacyPresent);
      existing.add(col.column);
      renamed.push(`${legacyPresent}->${col.column}`);
    } else if (!existing.has(col.column)) {
      await db.execute(sql.raw(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col.column}" ${col.sqlType}`));
      existing.add(col.column);
      added.push(col.column);
    } else if (legacyPresent) {
      await db.execute(
        sql.raw(
          `UPDATE "${table}" SET "${col.column}" = "${legacyPresent}" WHERE "${col.column}" IS NULL AND "${legacyPresent}" IS NOT NULL`
        )
      );
      backfilled.push(`${legacyPresent}->${col.column}`);
    }
  }

  if (table === "movies") {
    try {
      await db.execute(sql.raw(`ALTER TABLE "movies" ALTER COLUMN "category" TYPE varchar(500)`));
    } catch {
      // Safe no-op if already widened or incompatible
    }
  }

  return { created, added, renamed, backfilled, columns: [...existing].sort() };
}

async function ensureCategoryConstraints() {
  await getDb().execute(sql.raw(`DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_name_check' AND conrelid = 'categories'::regclass) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_name_check CHECK (length(btrim(name)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_slug_check' AND conrelid = 'categories'::regclass) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_slug_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_sort_order_check' AND conrelid = 'categories'::regclass) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_sort_order_check CHECK (sort_order >= 0);
  END IF;
END $$;`));
}

async function ensureIndexes() {
  const db = getDb();
  const statements = [
    `CREATE INDEX IF NOT EXISTS "idx_movies_catalog_status" ON "movies" ("catalog_status")`,
    `CREATE INDEX IF NOT EXISTS "idx_movies_category" ON "movies" ("category")`,
    `CREATE INDEX IF NOT EXISTS "idx_movies_featured" ON "movies" ("featured")`,
    `CREATE INDEX IF NOT EXISTS "idx_movies_year" ON "movies" ("year")`,
    `CREATE INDEX IF NOT EXISTS "idx_movies_type" ON "movies" ("type")`,
    `CREATE INDEX IF NOT EXISTS "idx_movies_language" ON "movies" ("language")`,
    `CREATE INDEX IF NOT EXISTS "idx_watchlist_session_movie" ON "watchlist" ("session_id", "movie_id")`,
    `CREATE INDEX IF NOT EXISTS "idx_slides_active_sort" ON "slides" ("active", "sort_order")`,
    // Latest-first hero ordering (db/slide-order.ts).
    `CREATE INDEX IF NOT EXISTS "idx_slides_created_latest" ON "slides" ("created_at" DESC NULLS LAST, "sort_order", "id" DESC)`,
    `CREATE INDEX IF NOT EXISTS "idx_categories_enabled_sort" ON "categories" ("enabled", "sort_order", "id")`,
    `CREATE INDEX IF NOT EXISTS "idx_channels_category_enabled_sort" ON "channels" ("category_id", "enabled", "sort_order", "id")`,
    `CREATE INDEX IF NOT EXISTS "idx_channels_enabled_sort" ON "channels" ("enabled", "sort_order", "id")`,
  ];
  for (const stmt of statements) {
    try {
      await db.execute(sql.raw(stmt));
    } catch {
      // Index creation is non-fatal
    }
  }
}

export function ensureSchema(force = false): Promise<SchemaReport> {
  if (!ensuredPromise || force) {
    ensuredPromise = (async () => {
      const tables: SchemaReport["tables"] = {};
      for (const [name, spec] of Object.entries(TABLES)) {
        tables[name] = await reconcileTable(name, spec);
      }
      await ensureCategoryConstraints();
      await ensureIndexes();
      const report: SchemaReport = { ok: true, error: null, tables };
      latestReport = report;
      return report;
    })().catch((error) => {
      ensuredPromise = null;
      latestReport = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        tables: {},
      };
      throw error;
    });
  }
  return ensuredPromise;
}

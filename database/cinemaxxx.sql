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

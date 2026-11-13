import { pgTable, serial, text, integer, timestamp, boolean, varchar, customType } from "drizzle-orm/pg-core";

export const movies = pgTable("movies", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description").default(""),
  year: integer("year").default(2024),
  rating: varchar("rating", { length: 10 }).default("8.0"),
  duration: varchar("duration", { length: 50 }).default("2h 0m"),
  genre: varchar("genre", { length: 500 }).default(""),
  language: varchar("language", { length: 200 }).default("English"),
  type: varchar("type", { length: 50 }).default("Movie"),
  director: varchar("director", { length: 200 }).default(""),
  cast: text("cast").default(""),
  posterUrl: text("poster_url").default(""),
  backdropUrl: text("backdrop_url").default(""),
  videoUrl: text("video_url").default(""),
  subtitleUrl: text("subtitle_url").default(""),
  subtitleLanguage: varchar("subtitle_language", { length: 100 }).default(""),
  rightsConfirmed: boolean("rights_confirmed").default(false),
  catalogStatus: varchar("catalog_status", { length: 64 }).default("verified_playable"),
  sourceType: varchar("source_type", { length: 64 }).default("direct"),
  licenseInfo: varchar("license_info", { length: 300 }).default(""),
  sourceAttribution: varchar("source_attribution", { length: 500 }).default(""),
  ratingSource: varchar("rating_source", { length: 100 }).default(""),
  releaseDate: varchar("release_date", { length: 64 }).default(""),
  trailerUrl: text("trailer_url").default(""),
  verificationResult: text("verification_result").default(""),
  lastVerifiedAt: timestamp("last_verified_at"),
  category: varchar("category", { length: 500 }).default("trending"),
  featured: boolean("featured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const slides = pgTable("slides", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  subtitle: text("subtitle").default(""),
  imageUrl: text("image_url").default(""),
  movieId: integer("movie_id").references(() => movies.id, { onDelete: "set null" }),
  sortOrder: integer("sort_order").default(0),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
});

export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 200 }).notNull(),
  movieId: integer("movie_id").references(() => movies.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 200 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
});

export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description").notNull().default(""),
  streamUrl: text("stream_url").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

export const channelLogos = pgTable("channel_logos", {
  channelId: integer("channel_id").primaryKey().references(() => channels.id, { onDelete: "cascade" }),
  content: bytea("content").notNull(),
  mimeType: varchar("mime_type", { length: 32 }).notNull(),
  byteSize: integer("byte_size").notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

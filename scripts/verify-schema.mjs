#!/usr/bin/env node
/** Verify actual PostgreSQL constraints/FKs in a transaction and roll everything back.
 * Uses DATABASE_URL from the environment; never prints it. No schema DDL or demo rows.
 */
import assert from "node:assert/strict";
import pg from "pg";
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING;
if (!url) throw new Error("Set DATABASE_URL to the new cinemaxxx test database.");
const pool = new pg.Pool({ connectionString: url, connectionTimeoutMillis: 10000 });
const db = await pool.connect();
let checks = 0;
const ok = (value, name) => { assert.ok(value, name); checks++; console.log(`  ✓ ${name}`); };
async function rejects(sql, params, code, name) {
  await db.query("SAVEPOINT constraint_probe");
  try {
    await db.query(sql, params);
    assert.fail(`${name}: statement unexpectedly succeeded`);
  } catch (error) {
    assert.equal(error.code, code, `${name}: ${error.message}`);
    checks++; console.log(`  ✓ ${name}`);
  } finally { await db.query("ROLLBACK TO SAVEPOINT constraint_probe"); }
}
try {
  await db.query("BEGIN");
  const tables = await db.query("SELECT tablename FROM pg_tables WHERE schemaname=current_schema() AND tablename=ANY($1)", [["movies", "slides", "categories", "channels", "channel_logos", "watchlist", "admins"]]);
  ok(tables.rowCount === 7, "all seven application tables exist");
  const indexes = await db.query("SELECT indexname FROM pg_indexes WHERE schemaname=current_schema() AND indexname=ANY($1)", [["idx_categories_enabled_sort", "idx_channels_category_enabled_sort", "idx_channels_enabled_sort"]]);
  ok(indexes.rowCount === 3, "category/channel lookup and ordering indexes exist");
  const category = (await db.query("INSERT INTO categories(name,slug,sort_order,enabled) VALUES ($1,$2,0,true) RETURNING id", ["Schema constraint probe", `schema-probe-${Date.now()}`])).rows[0].id;
  await rejects("INSERT INTO categories(name,slug) VALUES ('Probe',$1)", [(await db.query("SELECT slug FROM categories WHERE id=$1", [category])).rows[0].slug], "23505", "category slug uniqueness is enforced");
  await rejects("INSERT INTO categories(name,slug) VALUES (' ','valid-probe-slug')", [], "23514", "blank category names are rejected");
  await rejects("UPDATE categories SET sort_order=-1 WHERE id=$1", [category], "23514", "negative category order is rejected");
  const channel = (await db.query("INSERT INTO channels(category_id,name,stream_url) VALUES ($1,'Constraint probe','https://example.invalid/live.m3u8') RETURNING id", [category])).rows[0].id;
  await rejects("INSERT INTO channels(category_id,name,stream_url) VALUES (2147483647,'Missing parent','https://example.invalid/a.m3u8')", [], "23503", "channel requires an existing category");
  await rejects("DELETE FROM categories WHERE id=$1", [category], "23503", "populated category deletion is restricted");
  await rejects("UPDATE channels SET stream_url='javascript:alert(1)' WHERE id=$1", [channel], "23514", "non-HTTP stream is rejected");
  await rejects("UPDATE channels SET name='' WHERE id=$1", [channel], "23514", "blank channel name is rejected");
  await rejects("UPDATE channels SET sort_order=-1 WHERE id=$1", [channel], "23514", "negative channel order is rejected");
  const bytes = Buffer.from([1, 2, 3]);
  await db.query("INSERT INTO channel_logos(channel_id,content,mime_type,byte_size,sha256) VALUES ($1,$2,'image/png',3,$3)", [channel, bytes, "0".repeat(64)]);
  await rejects("INSERT INTO channel_logos(channel_id,content,mime_type,byte_size,sha256) VALUES ($1,$2,'image/png',3,$3)", [channel, bytes, "0".repeat(64)], "23505", "one persisted logo per channel is enforced");
  await rejects("UPDATE channel_logos SET byte_size=2 WHERE channel_id=$1", [channel], "23514", "logo size must match actual bytes");
  await rejects("UPDATE channel_logos SET mime_type='image/svg+xml' WHERE channel_id=$1", [channel], "23514", "active SVG MIME type is rejected");
  await db.query("DELETE FROM channels WHERE id=$1", [channel]);
  ok((await db.query("SELECT 1 FROM channel_logos WHERE channel_id=$1", [channel])).rowCount === 0, "deleting a channel cascades to its logo");
  await db.query("DELETE FROM categories WHERE id=$1", [category]);
  const movie = (await db.query("INSERT INTO movies(title) VALUES ('Temporary constraint probe') RETURNING id")).rows[0].id;
  const slide = (await db.query("INSERT INTO slides(title,movie_id) VALUES ('Temporary constraint probe',$1) RETURNING id", [movie])).rows[0].id;
  const saved = (await db.query("INSERT INTO watchlist(session_id,movie_id) VALUES ('temporary-constraint-probe',$1) RETURNING id", [movie])).rows[0].id;
  await db.query("DELETE FROM movies WHERE id=$1", [movie]);
  ok((await db.query("SELECT movie_id FROM slides WHERE id=$1", [slide])).rows[0].movie_id === null, "movie deletion preserves slides with a null reference");
  ok((await db.query("SELECT 1 FROM watchlist WHERE id=$1", [saved])).rowCount === 0, "movie deletion cascades to saved-list entries");
  console.log(`\nchecks: ${checks}, failures: 0 (all writes rolled back)`);
} finally {
  await db.query("ROLLBACK");
  db.release();
  await pool.end();
}

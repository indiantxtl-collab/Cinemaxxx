#!/usr/bin/env node
/** Real HTTP + PostgreSQL checks. Creates only uniquely marked rows and cleans up.
 * BASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD are required; no credentials/DB defaults.
 */
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

const base = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD for the test deployment.");
const marker = `channel-verification-${Date.now()}-${randomBytes(3).toString("hex")}`;
let cookie = "";
let checks = 0;
const categoryIds = new Set();
const channelIds = new Set();
function check(value, label) { assert.ok(value, label); checks++; console.log(`  ✓ ${label}`); }
async function call(path, { method = "GET", body, auth = true, headers = {}, raw = false } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(auth && cookie ? { Cookie: cookie } : {}), ...(body && !(body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = response.headers.getSetCookie();
  if (setCookie.length) cookie = setCookie.map((value) => value.split(";")[0]).join("; ");
  const bytes = raw ? Buffer.from(await response.arrayBuffer()) : null;
  const data = raw ? null : await response.json().catch(() => null);
  return { response, data, bytes };
}
async function status(path, expected, options) {
  const result = await call(path, options);
  check(result.response.status === expected, `${options?.method || "GET"} ${path.replace(/\d+/g, ":id")} → ${expected}`);
  return result;
}
async function cleanup() {
  for (const id of channelIds) await call(`/api/admin/channels/${id}`, { method: "DELETE" });
  for (const id of categoryIds) await call(`/api/categories/${id}`, { method: "DELETE" });
}
try {
  await status("/api/admin/channels", 401, { auth: false });
  await status("/api/categories", 401, { method: "POST", auth: false, body: { name: marker } });
  await status("/api/admin/channels/reorder", 401, { method: "PUT", auth: false, body: { ids: [] } });
  const login = await status("/api/admin/login", 200, { method: "POST", auth: false, body: { email, password } });
  check(Boolean(cookie), "login establishes a session");
  check(login.response.headers.getSetCookie().some((value) => /HttpOnly/i.test(value) && /SameSite=lax/i.test(value)), "session cookie is HttpOnly and SameSite");
  await status("/api/admin/login", 401, { method: "POST", auth: false, body: { email, password: `${password}-wrong` } });
  check(Boolean(cookie), "a failed login does not replace the valid test jar");

  const a = await status("/api/categories", 201, { method: "POST", body: { name: `${marker} A`, sortOrder: 2 } });
  const b = await status("/api/categories", 201, { method: "POST", body: { name: `${marker} B`, sortOrder: 1, enabled: false } });
  const categoryA = a.data.id, categoryB = b.data.id;
  categoryIds.add(categoryA); categoryIds.add(categoryB);
  check(a.data.slug.length > 0 && a.data.enabled === true, "category defaults and generated slug persist");
  await status("/api/categories", 400, { method: "POST", body: { name: a.data.name } });
  await status(`/api/categories/${categoryA}`, 400, { method: "PUT", body: { sortOrder: -1 } });
  await status(`/api/categories/${categoryA}`, 400, { method: "PUT", body: { enabled: "false" } });
  await status(`/api/categories/${categoryA}`, 400, { method: "PUT", body: { name: " " } });
  await status("/api/categories/2147483648", 400);
  const renamed = await status(`/api/categories/${categoryA}`, 200, { method: "PUT", body: { name: `${marker} renamed`, slug: `${marker}-renamed`, sortOrder: 3 } });
  check(renamed.data.slug === `${marker}-renamed`, "category rename/slug update persists");
  check((await call(`/api/categories/${categoryA}`)).data.name === renamed.data.name, "fresh category read sees the update");
  await status("/api/admin/categories/reorder", 400, { method: "PUT", body: { ids: [categoryA, categoryA] } });
  await status("/api/admin/categories/reorder", 400, { method: "PUT", body: { ids: [categoryA, 2147483647] } });
  // Include all existing categories so the reorder preserves unrelated records.
  const allCategories = (await call("/api/categories")).data;
  const order = [categoryB, categoryA, ...allCategories.filter((row) => ![categoryA, categoryB].includes(row.id)).map((row) => row.id)];
  await status("/api/admin/categories/reorder", 200, { method: "PUT", body: { ids: order } });
  const orderedCategories = (await call("/api/categories")).data;
  check(orderedCategories[0].id === categoryB && orderedCategories[1].id === categoryA, "category order survives a fresh list");

  const input = { name: `${marker} channel`, description: "Temporary API verification record", categoryId: categoryA, streamUrl: "https://example.invalid/live/master.m3u8", sortOrder: 4, enabled: true };
  const created = await status("/api/admin/channels", 201, { method: "POST", body: input });
  const id = created.data.id; channelIds.add(id);
  check(created.data.logoUrl === null && created.data.categoryName === renamed.data.name, "channel response joins its real category without inventing a logo");
  check((await call("/api/channels")).data.some((row) => row.id === id), "enabled channel is publicly listed");
  const second = await status("/api/admin/channels", 201, { method: "POST", body: { ...input, name: `${marker} second`, sortOrder: 2 } });
  channelIds.add(second.data.id);
  await status("/api/admin/channels", 400, { method: "POST", body: { ...input, categoryId: 2147483647 } });
  for (const patch of [{ name: "" }, { streamUrl: "javascript:alert(1)" }, { streamUrl: "https://user:secret@example.invalid/a.m3u8" }, { streamUrl: "https://www.youtube.com/watch?v=8g18jFHCLXk" }, { streamUrl: "https://example.invalid/watch/1" }, { streamUrl: "https://example.invalid/page.html" }, { categoryId: 0 }, { sortOrder: 1.5 }, { enabled: "true" }]) {
    await status("/api/admin/channels", 400, { method: "POST", body: { ...input, ...patch } });
  }
  await status(`/api/categories/${categoryA}`, 409, { method: "DELETE" });
  const updated = await status(`/api/admin/channels/${id}`, 200, { method: "PUT", body: { name: `${marker} updated`, categoryId: categoryB, streamUrl: "https://example.invalid/video.mp4", sortOrder: 9, enabled: false } });
  check(updated.data.categoryId === categoryB && updated.data.name.endsWith("updated"), "channel rename and category reassignment persist");
  check(!(await call("/api/channels")).data.some((row) => row.id === id), "disabled channel disappears from the public list");
  await status(`/api/channels/${id}/playback`, 404);
  await status(`/api/admin/channels/${id}`, 200, { method: "PUT", body: { categoryId: categoryA, enabled: true } });
  await status(`/api/categories/${categoryA}`, 200, { method: "PUT", body: { enabled: false } });
  check(!(await call("/api/channels")).data.some((row) => row.id === id), "disabled parent hides an enabled channel");
  await status(`/api/channels/${id}/playback`, 404);
  await status(`/api/categories/${categoryA}`, 200, { method: "PUT", body: { enabled: true } });
  const playback = await status(`/api/channels/${id}/playback`, 200);
  check(playback.data.resolution.ok && playback.data.resolution.playback.strategy === "direct", "play-time endpoint resolves an enabled direct stream");
  const allChannels = (await call("/api/admin/channels")).data;
  const channelOrder = [id, second.data.id, ...allChannels.filter((row) => ![id, second.data.id].includes(row.id)).map((row) => row.id)];
  await status("/api/admin/channels/reorder", 400, { method: "PUT", body: { ids: [id, 2147483647] } });
  await status("/api/admin/channels/reorder", 200, { method: "PUT", body: { ids: channelOrder } });
  const freshChannels = (await call("/api/admin/channels")).data;
  check(freshChannels.find((row) => row.id === id).sortOrder === 0, "channel reorder persists");
  check((await call(`/api/channels?categoryId=${categoryA}`)).data.every((row) => row.categoryId === categoryA), "public category filter uses the foreign key");
  await status("/api/channels?categoryId=not-a-number", 400);

  const png = await readFile(new URL("../public/icon-192.png", import.meta.url));
  const form = new FormData(); form.set("logo", new Blob([png], { type: "image/png" }), "logo.png");
  const uploaded = await status(`/api/admin/channels/${id}/logo`, 200, { method: "POST", body: form });
  check(uploaded.data.logoUrl?.includes(`/api/channels/${id}/logo?v=`), "logo upload returns a persisted versioned URL");
  const logo = await call(`/api/channels/${id}/logo`, { auth: false, raw: true });
  check(logo.response.status === 200 && logo.bytes.equals(png), "public logo bytes equal the uploaded file");
  const hash = createHash("sha256").update(png).digest("hex");
  check(logo.response.headers.get("etag") === `"${hash}"`, "logo ETag is the stored SHA-256");
  check(logo.response.headers.get("x-content-type-options") === "nosniff", "logo response prevents MIME sniffing");
  await status(`/api/channels/${id}/logo`, 304, { auth: false, headers: { "If-None-Match": `"${hash}"` }, raw: true });
  const replacement = await readFile(new URL("../public/icon-512.png", import.meta.url));
  const replace = new FormData(); replace.set("logo", new Blob([replacement], { type: "image/png" }), "replacement.png");
  await status(`/api/admin/channels/${id}/logo`, 200, { method: "POST", body: replace });
  check((await call(`/api/channels/${id}/logo`, { raw: true })).bytes.equals(replacement), "replacement overwrites the bytes");
  const invalid = new FormData(); invalid.set("logo", new Blob(["<svg onload='alert(1)'></svg>"], { type: "image/png" }), "fake.png");
  await status(`/api/admin/channels/${id}/logo`, 400, { method: "POST", body: invalid });
  const oversized = new FormData(); oversized.set("logo", new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: "image/png" }), "large.png");
  await status(`/api/admin/channels/${id}/logo`, 400, { method: "POST", body: oversized });
  await status(`/api/admin/channels/${id}/logo`, 200, { method: "DELETE" });
  check((await call(`/api/admin/channels/${id}`)).data.logoUrl === null, "logo removal persists");
  await status(`/api/channels/${id}/logo`, 404, { auth: false });
  await status(`/api/admin/channels/${id}`, 200, { method: "DELETE" }); channelIds.delete(id);
  await status(`/api/admin/channels/${id}`, 404);
  await status(`/api/admin/channels/${id}/logo`, 404, { method: "DELETE" });
  await status(`/api/admin/channels/${second.data.id}`, 200, { method: "DELETE" }); channelIds.delete(second.data.id);
  await status(`/api/categories/${categoryA}`, 200, { method: "DELETE" }); categoryIds.delete(categoryA);
  await status(`/api/categories/${categoryB}`, 200, { method: "DELETE" }); categoryIds.delete(categoryB);
  console.log(`\nchecks: ${checks}, failures: 0`);
} finally {
  await cleanup();
}

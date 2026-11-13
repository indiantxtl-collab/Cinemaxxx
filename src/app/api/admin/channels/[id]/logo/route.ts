import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { categories, channelLogos, channels } from "@/db/schema";
import { normalizeChannel } from "@/db/rows";
import { channelSelection } from "@/db/channel-query";
import { describeDbError, withDb } from "@/db/with-db";
import { badRequest, isAdmin, notFound, parseId, unauthorized } from "@/lib/api";
import { detectLogoMime, MAX_LOGO_BYTES } from "@/lib/channel-logo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

/** POST both uploads and replaces; the upsert is atomic and scoped to this id. */
export async function POST(req: NextRequest, { params }: Context) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    const id = parseId((await params).id);
    if (id === null) return badRequest("Invalid id");
    const limit = MAX_LOGO_BYTES + 65536; // bounded multipart envelope overhead
    if (Number(req.headers.get("content-length") || 0) > limit) {
      return NextResponse.json({ error: "Logo must be 2 MB or smaller" }, { status: 413 });
    }
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.startsWith("multipart/form-data")) return badRequest("Upload a logo as multipart form data");
    if (!req.body) return badRequest("Invalid logo upload");
    // Do not let a chunked request bypass the limit by omitting Content-Length.
    const reader = req.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          return NextResponse.json({ error: "Logo must be 2 MB or smaller" }, { status: 413 });
        }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let form: FormData;
    try { form = await new Response(bytes, { headers: { "Content-Type": contentType } }).formData(); }
    catch { return badRequest("Invalid logo upload"); }
    const file = form.get("logo");
    if (!(file instanceof File)) return badRequest("Choose a PNG, JPEG, WebP or GIF logo");
    if (file.size === 0 || file.size > MAX_LOGO_BYTES) return badRequest("Logo must be nonempty and 2 MB or smaller");
    const content = Buffer.from(await file.arrayBuffer());
    const mimeType = detectLogoMime(content);
    if (!mimeType) return badRequest("The file is not a supported raster image");
    const sha256 = createHash("sha256").update(content).digest("hex");
    const row = await withDb((db) => db.transaction(async (tx) => {
      const existing = await tx.select({ id: channels.id }).from(channels).where(eq(channels.id, id)).limit(1);
      if (!existing.length) return null;
      const updatedAt = new Date();
      const values = { channelId: id, content, mimeType, byteSize: content.length, sha256, updatedAt };
      await tx.insert(channelLogos).values(values).onConflictDoUpdate({ target: channelLogos.channelId, set: values });
      await tx.update(channels).set({ updatedAt }).where(eq(channels.id, id));
      const [result] = await tx.select(channelSelection).from(channels)
        .innerJoin(categories, eq(channels.categoryId, categories.id))
        .leftJoin(channelLogos, eq(channels.id, channelLogos.channelId)).where(eq(channels.id, id));
      return result;
    }));
    if (!row) return notFound("Channel not found");
    return NextResponse.json(normalizeChannel(row), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/admin/channels/:id/logo] POST failed:", error);
    return NextResponse.json({ error: describeDbError(error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Context) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    const id = parseId((await params).id);
    if (id === null) return badRequest("Invalid id");
    const row = await withDb((db) => db.transaction(async (tx) => {
      const existing = await tx.select({ id: channels.id }).from(channels).where(eq(channels.id, id)).limit(1);
      if (!existing.length) return null;
      await tx.delete(channelLogos).where(eq(channelLogos.channelId, id));
      const updatedAt = new Date();
      await tx.update(channels).set({ updatedAt }).where(eq(channels.id, id));
      const [result] = await tx.select(channelSelection).from(channels)
        .innerJoin(categories, eq(channels.categoryId, categories.id))
        .leftJoin(channelLogos, eq(channels.id, channelLogos.channelId)).where(eq(channels.id, id));
      return result;
    }));
    if (!row) return notFound("Channel not found");
    return NextResponse.json(normalizeChannel(row), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: describeDbError(error).message }, { status: 500 });
  }
}

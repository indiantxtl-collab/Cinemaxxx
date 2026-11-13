import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { categories, channelLogos, channels } from "@/db/schema";
import { channelSelection } from "@/db/channel-query";
import { channelPatch, normalizeChannel, ValidationError } from "@/db/rows";
import { describeDbError, withDb } from "@/db/with-db";
import { badRequest, isAdmin, notFound, parseId, readJson, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Context) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    const id = parseId((await params).id);
    if (id === null) return badRequest("Invalid id");
    const rows = await withDb((db) => db.select(channelSelection).from(channels)
      .innerJoin(categories, eq(channels.categoryId, categories.id))
      .leftJoin(channelLogos, eq(channels.id, channelLogos.channelId)).where(eq(channels.id, id)));
    if (!rows.length) return notFound("Channel not found");
    return NextResponse.json(normalizeChannel(rows[0]), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: describeDbError(error).message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Context) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    const id = parseId((await params).id);
    if (id === null) return badRequest("Invalid id");
    const body = await readJson(req);
    if (!body) return badRequest("Invalid JSON body");
    let patch;
    try { patch = channelPatch(body); }
    catch (error) { if (error instanceof ValidationError) return badRequest(error.message); throw error; }
    const row = await withDb(async (db) => {
      if (patch.categoryId !== undefined) {
        const category = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, patch.categoryId)).limit(1);
        if (!category.length) return { invalidCategory: true as const };
      }
      const [updated] = await db.update(channels).set({ ...patch, updatedAt: new Date() }).where(eq(channels.id, id)).returning({ id: channels.id });
      if (!updated) return { missing: true as const };
      const [result] = await db.select(channelSelection).from(channels)
        .innerJoin(categories, eq(channels.categoryId, categories.id))
        .leftJoin(channelLogos, eq(channels.id, channelLogos.channelId)).where(eq(channels.id, id));
      return result;
    });
    if ("missing" in row) return notFound("Channel not found");
    if ("invalidCategory" in row) return badRequest("Choose an existing category");
    return NextResponse.json(normalizeChannel(row), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/admin/channels/:id] PUT failed:", error);
    return NextResponse.json({ error: describeDbError(error).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Context) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    const id = parseId((await params).id);
    if (id === null) return badRequest("Invalid id");
    const removed = await withDb((db) => db.delete(channels).where(eq(channels.id, id)).returning({ id: channels.id }));
    if (!removed.length) return notFound("Channel not found");
    return NextResponse.json({ success: true, id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: describeDbError(error).message }, { status: 500 });
  }
}

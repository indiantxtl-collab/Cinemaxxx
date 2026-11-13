import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { categories, channelLogos, channels } from "@/db/schema";
import { channelSelection, listChannels } from "@/db/channel-query";
import { channelInput, normalizeChannel, ValidationError } from "@/db/rows";
import { describeDbError, withDb } from "@/db/with-db";
import { badRequest, isAdmin, readJson, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    return NextResponse.json(await listChannels(true), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: describeDbError(error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    const body = await readJson(req);
    if (!body) return badRequest("Invalid JSON body");
    let values;
    try { values = channelInput(body); }
    catch (error) { if (error instanceof ValidationError) return badRequest(error.message); throw error; }
    const row = await withDb(async (db) => {
      const category = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, values.categoryId)).limit(1);
      if (!category.length) return null;
      const [created] = await db.insert(channels).values(values).returning();
      const [result] = await db.select(channelSelection).from(channels)
        .innerJoin(categories, eq(channels.categoryId, categories.id))
        .leftJoin(channelLogos, eq(channels.id, channelLogos.channelId))
        .where(eq(channels.id, created.id));
      return result;
    });
    if (!row) return badRequest("Choose an existing category");
    return NextResponse.json(normalizeChannel(row), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/admin/channels] POST failed:", error);
    return NextResponse.json({ error: describeDbError(error).message }, { status: 500 });
  }
}

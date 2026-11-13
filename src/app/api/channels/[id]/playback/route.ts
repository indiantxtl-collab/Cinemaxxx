import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { categories, channels } from "@/db/schema";
import { describeDbError, withDb } from "@/db/with-db";
import { badRequest, notFound, parseId } from "@/lib/api";
import { resolveShareLink } from "@/lib/providers";

export const dynamic = "force-dynamic";

/** Re-check both switches at play time, including a deep link to a disabled row. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    if (id === null) return badRequest("Invalid id");
    const [channel] = await withDb((db) => db.select({ streamUrl: channels.streamUrl }).from(channels)
      .innerJoin(categories, eq(channels.categoryId, categories.id))
      .where(and(eq(channels.id, id), eq(channels.enabled, true), eq(categories.enabled, true))));
    if (!channel) return notFound("Channel is unavailable");
    const resolution = resolveShareLink(channel.streamUrl, { allowUnknownDirect: true });
    if (!resolution.ok || resolution.playback.strategy !== "direct") return badRequest("Channel stream is unavailable");
    return NextResponse.json({ resolution }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: describeDbError(error).message }, { status: 500 });
  }
}

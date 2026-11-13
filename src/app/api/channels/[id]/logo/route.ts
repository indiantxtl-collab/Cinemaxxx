import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { channelLogos } from "@/db/schema";
import { describeDbError, withDb } from "@/db/with-db";
import { badRequest, notFound, parseId } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await params).id);
    if (id === null) return badRequest("Invalid id");
    const [logo] = await withDb((db) => db.select().from(channelLogos).where(eq(channelLogos.channelId, id)));
    if (!logo) return notFound("Logo not found");
    const etag = `"${logo.sha256}"`;
    const headers = {
      "Content-Type": logo.mimeType,
      "Content-Length": String(logo.byteSize),
      "Cache-Control": "public, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      ETag: etag,
    };
    if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });
    return new NextResponse(new Uint8Array(logo.content), { headers });
  } catch (error) {
    return NextResponse.json({ error: describeDbError(error).message }, { status: 500 });
  }
}

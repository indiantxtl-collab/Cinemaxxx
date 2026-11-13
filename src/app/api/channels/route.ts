import { NextRequest, NextResponse } from "next/server";
import { listChannels } from "@/db/channel-query";
import { describeDbError } from "@/db/with-db";
import { badRequest, parseId } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("categoryId");
    const categoryId = raw === null ? undefined : parseId(raw);
    if (raw !== null && categoryId === null) return badRequest("Invalid category id");
    return NextResponse.json(await listChannels(false, categoryId ?? undefined), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: describeDbError(error).message }, { status: 500 });
  }
}

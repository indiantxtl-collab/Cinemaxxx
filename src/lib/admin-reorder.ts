import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { categories, channels } from "@/db/schema";
import { describeDbError, withDb } from "@/db/with-db";
import { badRequest, isAdmin, readJson, unauthorized } from "@/lib/api";

/** Persist a complete visible ordering in one transaction; ties break by id. */
export async function reorderAdminRows(req: NextRequest, kind: "categories" | "channels") {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    const body = await readJson(req);
    const ids = body?.ids;
    if (!Array.isArray(ids) || ids.length > 10000 || ids.some((id) => !Number.isSafeInteger(id) || id <= 0 || id > 2147483647) || new Set(ids).size !== ids.length) {
      return badRequest("Provide an ordered array of unique record ids");
    }
    const ordered = ids as number[];
    const missing = await withDb((db) => db.transaction(async (tx) => {
      const table = kind === "categories" ? categories : channels;
      const found = ordered.length ? await tx.select({ id: table.id }).from(table).where(inArray(table.id, ordered)).for("update") : [];
      if (found.length !== ordered.length) return true;
      for (const [sortOrder, id] of ordered.entries()) {
        if (kind === "categories") await tx.update(categories).set({ sortOrder }).where(eq(categories.id, id));
        else await tx.update(channels).set({ sortOrder, updatedAt: new Date() }).where(eq(channels.id, id));
      }
      return false;
    }));
    if (missing) return badRequest("One or more records no longer exist. Refresh and try again.");
    return NextResponse.json({ success: true, ids: ordered }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: describeDbError(error).message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { categories } from "@/db/schema";
import { describeDbError, withDb } from "@/db/with-db";
import { categoryInput, normalizeCategory, ValidationError } from "@/db/rows";
import { badRequest, isAdmin, readJson, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

/** All records, including disabled ones; public consumers use the enabled flag. */
export async function GET() {
  try {
    const result = await withDb((db) =>
      db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.id))
    );
    return NextResponse.json(result.map((row) => normalizeCategory(row)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[api/categories] GET failed:", e);
    return NextResponse.json({ error: describeDbError(e).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    const body = await readJson(req);
    if (!body) return badRequest("Invalid JSON body");
    let values;
    try { values = categoryInput(body); }
    catch (error) { if (error instanceof ValidationError) return badRequest(error.message); throw error; }

    const result = await withDb((db) =>
      db.insert(categories).values(values).onConflictDoNothing({ target: categories.slug }).returning()
    );
    if (!result.length) return badRequest(`A category with the slug "${values.slug}" already exists`);
    return NextResponse.json(normalizeCategory(result[0]), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[api/categories] POST failed:", e);
    return NextResponse.json({ error: describeDbError(e).message }, { status: 500 });
  }
}

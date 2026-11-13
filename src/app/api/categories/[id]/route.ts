import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { categories, movies } from "@/db/schema";
import { describeDbError, withDb } from "@/db/with-db";
import { categoryPatch, normalizeCategory, ValidationError } from "@/db/rows";
import { badRequest, isAdmin, notFound, parseId, readJson, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Context) {
  try {
    const id = parseId((await params).id);
    if (id === null) return badRequest("Invalid id");
    const result = await withDb((db) => db.select().from(categories).where(eq(categories.id, id)));
    if (!result.length) return notFound("Category not found");
    return NextResponse.json(normalizeCategory(result[0]), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: describeDbError(e).message }, { status: 500 });
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
    try { patch = categoryPatch(body); }
    catch (error) { if (error instanceof ValidationError) return badRequest(error.message); throw error; }

    const result = await withDb(async (db) => {
      const [current] = await db.select().from(categories).where(eq(categories.id, id));
      if (!current) return { missing: true as const };
      if (patch.slug && patch.slug !== current.slug) {
        const clash = await db.select({ id: categories.id }).from(categories)
          .where(and(eq(categories.slug, patch.slug), ne(categories.id, id))).limit(1);
        if (clash.length) return { conflict: true as const };
      }
      return db.transaction(async (tx) => {
        const [updated] = await tx.update(categories).set(patch).where(eq(categories.id, id)).returning();
        if (!updated) return { missing: true as const };
        if (patch.slug && patch.slug !== current.slug) {
          // Preserve other category/platform tags instead of overwriting the field.
          const attached = await tx.select({ id: movies.id, category: movies.category }).from(movies)
            .where(sql`exists (select 1 from unnest(string_to_array(lower(coalesce(${movies.category}, '')), ',')) item where btrim(item) = ${current.slug})`);
          for (const movie of attached) {
            const tags = (movie.category ?? "").split(",").map((tag) =>
              tag.trim().toLowerCase() === current.slug ? patch.slug! : tag.trim()
            ).filter(Boolean);
            await tx.update(movies).set({ category: tags.join(",") }).where(eq(movies.id, movie.id));
          }
        }
        return updated;
      });
    });
    if ("missing" in result) return notFound("Category not found");
    if ("conflict" in result) return badRequest(`A category with the slug "${patch.slug}" already exists`);
    return NextResponse.json(normalizeCategory(result), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[api/categories/:id] PUT failed:", e);
    const cause = (e as { cause?: { code?: string } }).cause;
    if (cause?.code === "23505" || (e as { code?: string }).code === "23505") return badRequest("That category slug already exists");
    return NextResponse.json({ error: describeDbError(e).message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Context) {
  try {
    if (!(await isAdmin(req))) return unauthorized();
    const id = parseId((await params).id);
    if (id === null) return badRequest("Invalid id");
    const result = await withDb(async (db) => {
      try {
        return await db.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id });
      } catch (error) {
        const cause = (error as { cause?: { code?: string } }).cause;
        if (cause?.code === "23503" || (error as { code?: string }).code === "23503") return { restricted: true as const };
        throw error;
      }
    });
    if ("restricted" in result) return NextResponse.json({ error: "Move or delete this category’s channels before deleting it." }, { status: 409 });
    if (!result.length) return notFound("Category not found");
    return NextResponse.json({ success: true, id }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: describeDbError(e).message }, { status: 500 });
  }
}

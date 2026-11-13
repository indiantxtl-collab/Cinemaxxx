import { and, asc, eq } from "drizzle-orm";
import { categories, channelLogos, channels } from "@/db/schema";
import { normalizeChannel } from "@/db/rows";
import { withDb } from "@/db/with-db";

export const channelSelection = {
  channel: channels,
  categoryName: categories.name,
  categorySlug: categories.slug,
  logoUpdatedAt: channelLogos.updatedAt,
};

/** The studio sees disabled records; the public catalogue never does. */
export async function listChannels(admin: boolean, categoryId?: number) {
  const rows = await withDb((db) => {
    const query = db.select(channelSelection).from(channels)
      .innerJoin(categories, eq(channels.categoryId, categories.id))
      .leftJoin(channelLogos, eq(channels.id, channelLogos.channelId));
    const condition = categoryId !== undefined
      ? and(eq(channels.categoryId, categoryId), admin ? undefined : and(eq(channels.enabled, true), eq(categories.enabled, true)))
      : admin ? undefined : and(eq(channels.enabled, true), eq(categories.enabled, true));
    const filtered = condition ? query.where(condition) : query;
    return filtered.orderBy(asc(categories.sortOrder), asc(categories.id), asc(channels.sortOrder), asc(channels.id));
  });
  return rows.map((row) => normalizeChannel(row));
}

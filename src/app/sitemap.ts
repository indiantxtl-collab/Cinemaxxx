import type { MetadataRoute } from "next";

/** Canonical origin of this deployment; empty when not configured (then the sitemap is empty). */
function siteOrigin(): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  try {
    const url = new URL(configured);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : "";
  } catch {
    return "";
  }
}

/** Public, indexable pages. Title pages are not listed here: they come from the live catalogue. */
const PUBLIC_PATHS = ["/", "/categories", "/search", "/download", "/privacy", "/disclaimer", "/license", "/copyright", "/attributions"];

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  if (!origin) return [];
  return PUBLIC_PATHS.map((path) => ({
    url: `${origin}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" ? "daily" : "monthly",
    priority: path === "/" ? 1 : 0.5,
  }));
}

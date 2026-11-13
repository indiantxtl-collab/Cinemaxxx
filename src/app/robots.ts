import type { MetadataRoute } from "next";

/** Canonical origin of this deployment; empty when not configured (then no absolute URLs are emitted). */
function siteOrigin(): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  try {
    const url = new URL(configured);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : "";
  } catch {
    return "";
  }
}

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/gate-keeper"] },
    ...(origin ? { sitemap: `${origin}/sitemap.xml`, host: origin } : {}),
  };
}

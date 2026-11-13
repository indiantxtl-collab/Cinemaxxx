import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./globals.css";
import SplashScreen from "@/components/SplashScreen";
import AppChrome from "@/components/AppChrome";
import AppPromo from "@/components/AppPromo";
import AgeDeclaration from "@/components/AgeDeclaration";

const manrope = localFont({ src: "./fonts/manrope.woff2", display: "swap", variable: "--font-manrope", weight: "200 800" });
const outfit = localFont({ src: "./fonts/outfit.woff2", display: "swap", variable: "--font-outfit", weight: "100 900" });

/** The deployment's own canonical origin; never the inherited CINEMAX domain. */
function canonicalSiteUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  try {
    const url = new URL(configured);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : "";
  } catch { return ""; }
}

const siteUrl = canonicalSiteUrl();

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: { default: "cinemaxxx — Movies & Series", template: "%s · cinemaxxx" },
  description: "Discover movies, series and anime. Save your favourites and pick up where you left off on cinemaxxx.",
  manifest: "/manifest.json",
  icons: [
    { rel: "icon", url: "/brand/cinemax-symbol.svg", type: "image/svg+xml" },
    { rel: "icon", url: "/icon-192.png" },
    { rel: "apple-touch-icon", url: "/icon-192.png" },
  ],
};

export const viewport: Viewport = {
  themeColor: "#050507",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en" suppressHydrationWarning>
    <body className={`${manrope.variable} ${outfit.variable}`}>
      <script dangerouslySetInnerHTML={{ __html: `try { if (sessionStorage.getItem('cinemax:prism-intro:v1') === '1') document.documentElement.dataset.cinemaxIntro = 'seen'; } catch {}` }} />
      <AgeDeclaration>
        <SplashScreen />
        <AppChrome>{children}</AppChrome>
        <AppPromo />
      </AgeDeclaration>
      <script dangerouslySetInnerHTML={{ __html: `
        if ('serviceWorker' in navigator) {
          window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
        }
      ` }} />
    </body>
  </html>;
}

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

const TITLE = "cinemaxxx — Movies & Series";
const DESCRIPTION = "Discover movies, series and anime. Save your favourites and pick up where you left off on cinemaxxx.";

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  applicationName: "cinemaxxx",
  title: { default: TITLE, template: "%s · cinemaxxx" },
  description: DESCRIPTION,
  manifest: "/manifest.json",
  ...(siteUrl ? { alternates: { canonical: "/" } } : {}),
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: "cinemaxxx",
    title: TITLE,
    description: DESCRIPTION,
    url: siteUrl || undefined,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "cinemaxxx" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
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
      <script dangerouslySetInnerHTML={{ __html: `try { var d = document.documentElement; if (sessionStorage.getItem('cinemax:prism-intro:v1') === '1') { d.dataset.cinemaxIntro = 'seen'; } else if (location.pathname === '/' && localStorage.getItem('cinemaxxx:age-declaration:v1') === 'accepted' && sessionStorage.getItem('cinemaxxx:age-declined:v1') !== '1') { d.dataset.cinemaxIntroPending = '1'; } } catch {}` }} />
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

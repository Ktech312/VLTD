import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-serif",
});
import "./vltd-design.css";
import "./vault-pass.css";
import "./museum-pass.css";
import "./quick-add-pass.css";
import "./vault-utility-pass.css";
import "./vault-directives-pass.css";
import "./insurance-pass.css";
import "./theme-override.css";
import AddressBarHider from "@/components/AddressBarHider";
import BugReporter from "@/components/BugReporter";
import PresenceHeartbeat from "@/components/PresenceHeartbeat";
import PublicProfileSync from "@/components/PublicProfileSync";
import NavShell from "@/components/NavShell";
import Providers from "@/components/Providers";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import SeasonalThemeProvider from "@/components/SeasonalThemeProvider";
import RouteTransition from "@/components/RouteTransition";
import { ThemeBoot } from "@/components/ThemeBoot";
import ThemeScript from "@/components/ThemeScript";
import { ThemeProvider } from "@/lib/ThemeContext";
import { SITE_URL } from "@/lib/siteUrl";

const siteUrl = SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "VLTD",
  title: {
    default: "VLTD (Vaulted) | Collection Tracker for Cards, Comics & More",
    template: "%s | VLTD",
  },
  description:
    "VLTD (pronounced Vaulted) is a collection tracker for cards, comics, records and games. Catalog pieces, track value, share public exhibitions. Private beta.",
  keywords: [
    "collection tracker",
    "collectible vault",
    "comic collection tracker",
    "trading card inventory",
    "collector gallery",
    "memorabilia inventory",
    "VLTD",
    "Vaulted",
  ],
  authors: [{ name: "VLTD" }],
  creator: "VLTD",
  publisher: "VLTD",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "VLTD",
    title: "VLTD (Vaulted) | Collection Tracker for Cards, Comics & More",
    description:
      "VLTD (pronounced Vaulted) is a collection tracker for cards, comics, records and games. Catalog pieces, track value, share public exhibitions. Private beta.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "VLTD \u2014 Collection tracker and public exhibitions",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VLTD (Vaulted) | Collection Tracker for Cards, Comics & More",
    description:
      "VLTD (pronounced Vaulted) is a collection tracker for cards, comics, records and games. Catalog pieces, track value, share public exhibitions. Private beta.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0B0B0B",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${cormorant.variable}`}>
      <head>
        <ThemeScript />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icons/icon-192x192.png" type="image/png" sizes="192x192" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="VLTD" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.className} bg-vault-base min-h-screen`}>
        <ThemeBoot />
        <AddressBarHider />

        <ThemeProvider>
          <Providers>
            <SeasonalThemeProvider>
              <NavShell>
                <RouteTransition>{children}</RouteTransition>
              </NavShell>
              <PWAInstallBanner />
              <BugReporter />
              <PresenceHeartbeat />
              <PublicProfileSync />
            </SeasonalThemeProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}

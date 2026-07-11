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
import "./portfolio-pass.css";
import "./quick-add-pass.css";
import "./vault-utility-pass.css";
import "./vault-directives-pass.css";
import "./insurance-pass.css";
import "./theme-override.css";
import BugReporter from "@/components/BugReporter";
import NavShell from "@/components/NavShell";
import Providers from "@/components/Providers";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import SeasonalThemeProvider from "@/components/SeasonalThemeProvider";
import RouteTransition from "@/components/RouteTransition";
import { ThemeBoot } from "@/components/ThemeBoot";
import ThemeScript from "@/components/ThemeScript";
import { ThemeProvider } from "@/lib/ThemeContext";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vltd.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "VLTD",
  title: {
    default: "VLTD | Collectible Vaults and Public Galleries",
    template: "%s | VLTD",
  },
  description:
    "VLTD helps collectors organize comics, cards, music, games, memorabilia, and other collectibles in a private vault with polished public galleries.",
  keywords: [
    "collectible vault",
    "collection management",
    "comic collection tracker",
    "trading card inventory",
    "collector gallery",
    "memorabilia inventory",
    "VLTD",
  ],
  authors: [{ name: "VLTD" }],
  creator: "VLTD",
  publisher: "VLTD",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "VLTD",
    title: "VLTD | Collectible Vaults and Public Galleries",
    description:
      "Organize private collector inventory and share polished public galleries for comics, cards, music, games, memorabilia, and more.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "VLTD \u2014 Collectible Vaults and Public Galleries",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VLTD | Collectible Vaults and Public Galleries",
    description:
      "A private collector vault with polished public galleries for sharing your collection.",
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
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="VLTD" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.className} bg-vault-base min-h-screen`}>
        <ThemeBoot />

        <ThemeProvider>
          <Providers>
            <SeasonalThemeProvider>
              <NavShell>
                <RouteTransition>{children}</RouteTransition>
              </NavShell>
              <PWAInstallBanner />
              <BugReporter />
            </SeasonalThemeProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}

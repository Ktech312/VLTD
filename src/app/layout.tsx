import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
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
import NavShell from "@/components/NavShell";
import Providers from "@/components/Providers";
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
        alt: "VLTD — Collectible Vaults and Public Galleries",
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
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <ThemeScript />
      </head>
      <body className={`${inter.className} bg-vault-base min-h-screen`}>
        <ThemeBoot />

        <ThemeProvider>
          <Providers>
            <NavShell>
              <RouteTransition>{children}</RouteTransition>
            </NavShell>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}

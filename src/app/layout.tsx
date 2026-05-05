import type { Metadata, Viewport } from "next";

import "./globals.css";
import "./vltd-design.css";
import "./vault-pass.css";
import "./museum-pass.css";
import "./portfolio-pass.css";
import "./quick-add-pass.css";
import "./vault-utility-pass.css";
import TopNav from "@/components/TopNav";
import Providers from "@/components/Providers";
import { ThemeBoot } from "@/components/ThemeBoot";
import ThemeScript from "@/components/ThemeScript";

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
        url: "/themes/classic-shelf-wall.webp",
        width: 1200,
        height: 900,
        alt: "VLTD collectible gallery wall",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VLTD | Collectible Vaults and Public Galleries",
    description:
      "A private collector vault with polished public galleries for sharing your collection.",
    images: ["/themes/classic-shelf-wall.webp"],
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
  themeColor: "#050816",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ThemeBoot />

        <Providers>
          <TopNav />
          <div style={{ paddingTop: "var(--topnav-h)" }}>{children}</div>
        </Providers>
      </body>
    </html>
  );
}

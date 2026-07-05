import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://vltd.app";

export const metadata: Metadata = {
  title: "Explore Exhibitions",
  description:
    "Browse public galleries from collectors across every universe - comics, trading cards, vinyl, sports memorabilia, games, and more.",
  alternates: { canonical: `${siteUrl}/discover` },
  openGraph: {
    title: "Explore Exhibitions | VLTD",
    description:
      "Browse public galleries from collectors across every universe - comics, trading cards, vinyl, sports memorabilia, games, and more.",
    url: `${siteUrl}/discover`,
    siteName: "VLTD",
    type: "website",
    images: [
      {
        url: `${siteUrl}/discover/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "VLTD - Explore Exhibitions",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Explore Exhibitions | VLTD",
    description:
      "Browse public galleries from collectors across every universe.",
    images: [`${siteUrl}/discover/opengraph-image`],
    site: "@vltdapp",
  },
};

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import type { Metadata } from "next";

import PublicHomeClient from "./PublicHomeClient";

export const metadata: Metadata = {
  title: "Collectible Vaults and Public Galleries",
  description:
    "Build a private inventory for collectibles, track item records, and publish clean public galleries for comics, cards, music, games, memorabilia, and more.",
  alternates: {
    canonical: "/",
  },
};

const homeJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "VLTD",
  applicationCategory: "LifestyleApplication",
  operatingSystem: "Web",
  description:
    "VLTD helps collectors organize private inventory and share polished public galleries for collectibles.",
  offers: {
    "@type": "Offer",
    category: "Collector inventory management",
  },
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      <PublicHomeClient />
    </>
  );
}

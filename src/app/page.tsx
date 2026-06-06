import type { Metadata } from "next";

import PublicHomeClient from "./PublicHomeClient";

export const metadata: Metadata = {
  title: "VLTD - Private Collector Vault, Museum, Insurance & Sales Prep",
  description:
    "Scan, document, value, insure, share, and prepare listings for every collectible category in one private, exportable vault.",
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
    "VLTD helps collectors scan, document, value, insure, share, and prepare listings for collectibles across every category.",
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

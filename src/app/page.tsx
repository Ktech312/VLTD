import type { Metadata } from "next";

import { HOME_FAQ } from "@/lib/homeFaq";
import { SITE_URL } from "@/lib/siteUrl";

import PublicHomeClient from "./PublicHomeClient";

export const metadata: Metadata = {
  title: { absolute: "VLTD (Vaulted) | Collection Tracker for Cards, Comics & More" },
  description:
    "VLTD (pronounced Vaulted) is a collection tracker for cards, comics, records and games. Catalog pieces, track value, share public exhibitions. Private beta.",
  alternates: {
    canonical: "/",
  },
};

const homeJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "VLTD",
      alternateName: ["Vaulted", "VauLTeD"],
      url: SITE_URL,
      logo: `${SITE_URL}/icons/icon-512x512.png`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "VLTD",
      alternateName: "Vaulted",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#app`,
      name: "VLTD",
      alternateName: "Vaulted",
      url: SITE_URL,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web",
      description:
        "VLTD (pronounced Vaulted) is a collection tracker for cards, comics, records, games, and other collectibles. Catalog pieces with photos and condition notes, record purchase prices and estimated values, and share selected pieces in public exhibitions. Founding access is open to the first 50 real collector accounts.",
      featureList: [
        "Catalog collectibles with photos, descriptions, and condition notes",
        "Record purchase prices and estimated values",
        "AI-assisted item identification that you review before saving",
        "Public exhibitions to share selected pieces with a link",
        "One collection for cards, comics, records, games, and more",
      ],
      image: `${SITE_URL}/og-image-v2.png`,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "FAQPage",
      mainEntity: HOME_FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ],
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

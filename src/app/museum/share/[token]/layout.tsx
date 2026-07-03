// Server component — provides OG metadata for the public exhibit share page.
// The page itself is "use client" so can't export generateMetadata;
// a layout at the same segment level can, and is the correct Next.js pattern.

import type { Metadata } from "next";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type GalleryRow = {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  layout: { itemIds?: string[] } | null;
  profile_id: string;
};

type ProfileRow = { display_name: string | null };

async function fetchGalleryMeta(
  token: string
): Promise<{ title: string; description: string; imageUrl: string; itemCount: number | null; collector: string }> {
  const fallback = {
    title: "VLTD Exhibition",
    description: "View this curated collectibles exhibition on VLTD.",
    imageUrl: `https://vltd.vercel.app/museum/share/${encodeURIComponent(token)}/opengraph-image`,
    itemCount: null,
    collector: "Collector",
  };

  if (!SUPABASE_URL || !SUPABASE_ANON) return fallback;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/galleries?public_token=eq.${encodeURIComponent(token)}&visibility=eq.PUBLIC&select=id,title,description,cover_image,layout,profile_id&limit=1`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }, next: { revalidate: 120 } }
    );
    const rows: GalleryRow[] = await res.json().catch(() => []);
    const gallery = rows[0];
    if (!gallery) return fallback;

    const itemCount = Array.isArray(gallery.layout?.itemIds) ? gallery.layout!.itemIds.length : null;

    let collector = "Collector";
    try {
      const pRes = await fetch(
        `${SUPABASE_URL}/rest/v1/public_profiles?profile_id=eq.${gallery.profile_id}&select=display_name&limit=1`,
        { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }, next: { revalidate: 120 } }
      );
      const profiles: ProfileRow[] = await pRes.json().catch(() => []);
      collector = profiles[0]?.display_name ?? "Collector";
    } catch { /* ignore */ }

    const descParts = [
      gallery.description?.trim(),
      itemCount !== null ? `${itemCount} item${itemCount !== 1 ? "s" : ""}` : null,
      `Curated by ${collector}`,
    ].filter(Boolean);

    return {
      title: gallery.title,
      description: descParts.join(" · "),
      imageUrl: `https://vltd.vercel.app/museum/share/${encodeURIComponent(token)}/opengraph-image`,
      itemCount,
      collector,
    };
  } catch {
    return fallback;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params;
  const meta = await fetchGalleryMeta(token);
  const pageUrl = `https://vltd.vercel.app/museum/share/${token}`;

  return {
    title: `${meta.title} · VLTD`,
    description: meta.description,
    alternates: { canonical: pageUrl },
    openGraph: {
      url: pageUrl,
      title: meta.title,
      description: meta.description,
      images: [{ url: meta.imageUrl, width: 1200, height: 630, alt: meta.title }],
      type: "website",
      siteName: "VLTD",
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: [meta.imageUrl],
      site: "@vltdapp",
    },
  };
}

export default function ShareTokenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

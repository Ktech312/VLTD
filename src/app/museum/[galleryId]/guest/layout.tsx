// Server component — injects OG/Twitter metadata for the public guest gallery page.
import type { Metadata } from "next";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vltd.vercel.app";
const PLACEHOLDERS = new Set(["collector", "user", "vltd user", "vltd collector", ""]);

type GalleryRow = {
  title: string;
  description: string | null;
  layout: { itemIds?: string[] } | null;
  profile_id: string;
  alias_enabled: boolean | null;
  alias_name: string | null;
};
type ProfileRow = { display_name: string | null };

async function fetchMeta(galleryId: string) {
  const fallback = { title: "VLTD Gallery", description: "", itemCount: null as number | null, collector: "" };
  if (!SUPABASE_URL || !SUPABASE_ANON) return fallback;
  const h = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/galleries?id=eq.${galleryId}&visibility=eq.PUBLIC&select=title,description,layout,profile_id,alias_enabled,alias_name&limit=1`,
      { headers: h, next: { revalidate: 120 } }
    );
    const rows: GalleryRow[] = await res.json().catch(() => []);
    const g = rows[0];
    if (!g) return fallback;
    const itemCount = Array.isArray(g.layout?.itemIds) ? g.layout!.itemIds.length : null;

    // Aliased exhibition: use the made-up name, never fetch the real profile.
    const aliasName = g.alias_enabled ? (g.alias_name ?? "").trim() : "";
    if (aliasName) {
      return { title: g.title, description: g.description ?? "", itemCount, collector: aliasName };
    }

    let collector = "";
    try {
      const pRes = await fetch(
        `${SUPABASE_URL}/rest/v1/public_profiles?profile_id=eq.${g.profile_id}&select=display_name&limit=1`,
        { headers: h, next: { revalidate: 120 } }
      );
      const profiles: ProfileRow[] = await pRes.json().catch(() => []);
      const rawName = profiles[0]?.display_name ?? "";
      collector = PLACEHOLDERS.has(rawName.trim().toLowerCase()) ? "" : rawName.trim();
    } catch { /* ignore */ }
    return { title: g.title, description: g.description ?? "", itemCount, collector };
  } catch {
    return fallback;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ galleryId: string }> }
): Promise<Metadata> {
  const { galleryId } = await params;
  const meta = await fetchMeta(galleryId);
  const pageUrl = `${BASE}/museum/${galleryId}/guest`;
  const imgUrl = `${BASE}/museum/${galleryId}/guest/opengraph-image`;

  const descParts = [
    meta.description,
    meta.itemCount !== null ? `${meta.itemCount} item${meta.itemCount !== 1 ? "s" : ""}` : null,
    meta.collector ? `Curated by ${meta.collector}` : null,
  ].filter(Boolean);

  const description = descParts.join(" · ") || "A curated collection on VLTD.";

  return {
    title: `${meta.title} · VLTD`,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      url: pageUrl,
      title: meta.title,
      description,
      images: [{ url: imgUrl, width: 1200, height: 630, alt: meta.title }],
      type: "website",
      siteName: "VLTD",
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description,
      images: [imgUrl],
      site: "@vltdapp",
    },
  };
}

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

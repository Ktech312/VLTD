// Server component — injects OG metadata for the public exhibit share page.
// The opengraph-image.tsx at this route segment fetches its own data,
// so we only need to set the text metadata here.
import type { Metadata } from "next";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vltd.vercel.app";

type GalleryRow = {
  title: string;
  description: string | null;
  layout: { itemIds?: string[] } | null;
  profile_id: string;
};
type ProfileRow = { display_name: string | null };

async function fetchGalleryMeta(token: string) {
  const fallback = { title: "VLTD Exhibition", description: "", itemCount: null as number | null, collector: "" };
  if (!SUPABASE_URL || !SUPABASE_ANON) return fallback;
  const h = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/galleries?public_token=eq.${encodeURIComponent(token)}&select=title,description,layout,profile_id&limit=1`,
      { headers: h, next: { revalidate: 120 } }
    );
    const rows: GalleryRow[] = await res.json().catch(() => []);
    const g = rows[0];
    if (!g) return fallback;
    const itemCount = Array.isArray(g.layout?.itemIds) ? g.layout!.itemIds.length : null;
    let collector = "";
    try {
      const pRes = await fetch(
        `${SUPABASE_URL}/rest/v1/public_profiles?profile_id=eq.${g.profile_id}&select=display_name&limit=1`,
        { headers: h, next: { revalidate: 120 } }
      );
      const profiles: ProfileRow[] = await pRes.json().catch(() => []);
      collector = profiles[0]?.display_name ?? "";
    } catch { /* ignore */ }
    return { title: g.title, description: g.description ?? "", itemCount, collector };
  } catch {
    return fallback;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params;
  const meta = await fetchGalleryMeta(token);
  const pageUrl = `${BASE}/museum/share/${token}`;
  const imgUrl = `${BASE}/museum/share/${token}/opengraph-image`;

  const descParts = [
    meta.description,
    meta.itemCount !== null ? `${meta.itemCount} item${meta.itemCount !== 1 ? "s" : ""}` : null,
    meta.collector ? `Curated by ${meta.collector}` : null,
  ].filter(Boolean);

  return {
    title: `${meta.title} · VLTD`,
    description: descParts.join(" · "),
    alternates: { canonical: pageUrl },
    openGraph: {
      url: pageUrl,
      title: meta.title,
      description: descParts.join(" · "),
      images: [{ url: imgUrl, width: 1200, height: 630, alt: meta.title }],
      type: "website",
      siteName: "VLTD",
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: descParts.join(" · "),
      images: [imgUrl],
    },
  };
}

export default function ShareTokenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

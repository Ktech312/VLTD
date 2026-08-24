// Server component — injects OG metadata for the public exhibit share page.
// The opengraph-image.tsx at this route segment fetches its own data,
// so we only need to set the text metadata here.
import type { Metadata } from "next";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// Matches opengraph-image.tsx in this same route segment: the anon-key
// policy that used to let a plain `public_token=eq.X` filter read a
// gallery row (galleries_anon_read_by_public_token) only ever checked
// that a token existed at all, not that it matched — removed in
// 20260823_fix_gallery_share_and_invite_tokens.sql. Service role runs
// server-side only here (never shipped to the browser) and is safe for
// the same reason it already was in opengraph-image.tsx.
const SUPABASE_ANON =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vltd.vercel.app";

type GalleryRow = {
  title: string;
  description: string | null;
  layout: { itemIds?: string[] } | null;
  profile_id: string;
  alias_enabled: boolean | null;
  alias_name: string | null;
};
type ProfileRow = { display_name: string | null };

async function fetchGalleryMeta(token: string) {
  const fallback = { title: "VLTD Exhibition", description: "", itemCount: null as number | null, collector: "" };
  if (!SUPABASE_URL || !SUPABASE_ANON) return fallback;
  const h = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/galleries?public_token=eq.${encodeURIComponent(token)}&select=title,description,layout,profile_id,alias_enabled,alias_name&limit=1`,
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
      const PLACEHOLDERS = new Set(["collector", "user", "vltd user", "vltd collector", ""]);
      collector = PLACEHOLDERS.has(rawName.trim().toLowerCase()) ? "" : rawName.trim();
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

// Server component — provides OG metadata for the public exhibit share page.
import type { Metadata } from "next";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type GalleryRow = {
  id: string;
  title: string;
  description: string | null;
  layout: { itemIds?: string[] } | null;
  profile_id: string;
};

type ProfileRow = { display_name: string | null };

async function fetchGalleryMeta(token: string) {
  const fallback = { title: "VLTD Exhibition", description: "", itemCount: null as number | null, collector: "" };
  if (!SUPABASE_URL || !SUPABASE_ANON) return fallback;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/galleries?public_token=eq.${encodeURIComponent(token)}&select=id,title,description,layout,profile_id&limit=1`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }, next: { revalidate: 120 } }
    );
    const rows: GalleryRow[] = await res.json().catch(() => []);
    const gallery = rows[0];
    if (!gallery) return fallback;

    const itemCount = Array.isArray(gallery.layout?.itemIds) ? gallery.layout!.itemIds.length : null;
    let collector = "";
    try {
      const pRes = await fetch(
        `${SUPABASE_URL}/rest/v1/public_profiles?profile_id=eq.${gallery.profile_id}&select=display_name&limit=1`,
        { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` }, next: { revalidate: 120 } }
      );
      const profiles: ProfileRow[] = await pRes.json().catch(() => []);
      collector = profiles[0]?.display_name ?? "";
    } catch { /* ignore */ }

    return {
      title: gallery.title,
      description: gallery.description ?? "",
      itemCount,
      collector,
    };
  } catch {
    return fallback;
  }
}

const BASE = "https://vltd.vercel.app";

export async function generateMetadata(
  { params }: { params: Promise<{ token: string }> }
): Promise<Metadata> {
  const { token } = await params;
  const meta = await fetchGalleryMeta(token);
  const pageUrl = `${BASE}/museum/share/${token}`;

  // Build the og:image URL with the data baked in as query params
  // so the image edge function needs zero network calls
  const imgUrl = new URL(`${BASE}/museum/share/${token}/opengraph-image`);
  imgUrl.searchParams.set("t", meta.title);
  if (meta.description) imgUrl.searchParams.set("d", meta.description);
  if (meta.itemCount !== null) imgUrl.searchParams.set("n", String(meta.itemCount));
  if (meta.collector) imgUrl.searchParams.set("c", meta.collector);

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
      images: [{ url: imgUrl.toString(), width: 1200, height: 630, alt: meta.title }],
      type: "website",
      siteName: "VLTD",
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: descParts.join(" · "),
      images: [imgUrl.toString()],
    },
  };
}

export default function ShareTokenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

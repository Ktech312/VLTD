// Path: src/app/museum/share/[token]/opengraph-image.tsx
// Dynamic OG image for public exhibit share pages.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VLTD Exhibition";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

async function fetchGalleryByToken(token: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON) {
    return { title: "VLTD Exhibition", description: null, itemCount: null, collector: "Collector" };
  }
  try {
    const [galRes, ] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/galleries?public_token=eq.${encodeURIComponent(token)}&visibility=eq.PUBLIC&select=id,title,description,layout,profile_id&limit=1`,
        { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
      ),
    ]);
    const rows = await galRes.json().catch(() => []) as Array<{
      id: string; title: string; description: string | null;
      layout: { itemIds?: string[] } | null; profile_id: string;
    }>;
    const gallery = rows[0];
    if (!gallery) return { title: "VLTD Exhibition", description: null, itemCount: null, collector: "Collector" };

    const itemCount = Array.isArray(gallery.layout?.itemIds) ? gallery.layout!.itemIds.length : null;

    let collector = "Collector";
    if (gallery.profile_id) {
      const pRes = await fetch(
        `${SUPABASE_URL}/rest/v1/public_profiles?profile_id=eq.${gallery.profile_id}&select=display_name&limit=1`,
        { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } }
      );
      const profiles = await pRes.json().catch(() => []) as Array<{ display_name: string | null }>;
      collector = profiles[0]?.display_name ?? "Collector";
    }

    return { title: gallery.title, description: gallery.description, itemCount, collector };
  } catch {
    return { title: "VLTD Exhibition", description: null, itemCount: null, collector: "Collector" };
  }
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { title, description, itemCount, collector } = await fetchGalleryByToken(token);

  const titleSize = title.length > 40 ? "44px" : title.length > 25 ? "52px" : "62px";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          background: "linear-gradient(135deg, #0B0B0B 0%, #111827 60%, #1a0e00 100%)",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          position: "relative",
        }}
      >
        {/* Gold top bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "linear-gradient(90deg, transparent 0%, #F5B548 20%, #F5B548 80%, transparent 100%)",
          }}
        />

        {/* Top: VLTD wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "0.25em", color: "#F5B548" }}>
            VLTD
          </div>
          <div style={{ width: "1px", height: "16px", background: "rgba(245,181,72,0.35)" }} />
          <div style={{ fontSize: "12px", color: "rgba(245,181,72,0.55)", letterSpacing: "0.14em" }}>
            COLLECTOR VAULT
          </div>
        </div>

        {/* Middle: main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Badge */}
          <div
            style={{
              display: "flex",
              width: "fit-content",
              alignItems: "center",
              background: "rgba(245,181,72,0.12)",
              border: "1px solid rgba(245,181,72,0.28)",
              borderRadius: "100px",
              padding: "6px 16px",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: "#F5B548",
            }}
          >
            PUBLIC EXHIBITION
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: titleSize,
              fontWeight: 800,
              color: "#F0EAD6",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: "900px",
            }}
          >
            {title}
          </div>

          {/* Description */}
          {description ? (
            <div style={{ fontSize: "18px", color: "rgba(240,234,214,0.5)", lineHeight: 1.5, maxWidth: "700px" }}>
              {description.slice(0, 100)}
            </div>
          ) : null}
        </div>

        {/* Bottom: meta row */}
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          {itemCount !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#F5B548" }} />
              <span style={{ fontSize: "16px", color: "rgba(245,181,72,0.85)", fontWeight: 600 }}>
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </span>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "rgba(160,149,107,0.55)" }} />
            <span style={{ fontSize: "16px", color: "rgba(160,149,107,0.7)" }}>
              Curated by {collector}
            </span>
          </div>
          <div
            style={{
              marginLeft: "auto",
              background: "linear-gradient(135deg, #7a5c10, #F5B548)",
              borderRadius: "100px",
              padding: "10px 24px",
              fontSize: "15px",
              fontWeight: 700,
              color: "#0B0B0B",
            }}
          >
            View Exhibition →
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

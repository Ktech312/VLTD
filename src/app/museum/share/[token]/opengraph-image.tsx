import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VLTD Exhibition";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type GalleryRow = {
  title: string;
  layout: { itemIds?: string[] } | null;
};

async function fetchByToken(token: string): Promise<{ title: string; itemCount: number | null }> {
  const fallback = { title: "VLTD Exhibition", itemCount: null };
  if (!SUPABASE_URL || !SUPABASE_ANON) return fallback;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/galleries?public_token=eq.${encodeURIComponent(token)}&select=title,layout&limit=1`,
      {
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
        cache: "no-store",
      }
    );
    const rows: GalleryRow[] = await res.json().catch(() => []);
    const gallery = rows[0];
    if (!gallery) return fallback;
    const itemCount = Array.isArray(gallery.layout?.itemIds) ? gallery.layout!.itemIds.length : null;
    return { title: gallery.title, itemCount };
  } catch {
    return fallback;
  }
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { title, itemCount } = await fetchByToken(token);

  const sub = itemCount !== null ? `${itemCount} item${itemCount !== 1 ? "s" : ""}` : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
          backgroundColor: "#0A0A12",
          fontFamily: "sans-serif",
        }}
      >
        {/* Gold left accent */}
        <div style={{ width: "5px", height: "630px", backgroundColor: "#F5B548", flexShrink: 0 }} />

        {/* Content */}
        <div style={{ display: "flex", flexDirection: "column", padding: "52px 60px", flex: 1 }}>
          {/* Top label */}
          <div style={{ display: "flex", marginBottom: "32px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.25em", color: "#F5B548" }}>
              VLTD · PUBLIC EXHIBITION
            </span>
          </div>

          {/* Title */}
          <div style={{ display: "flex", flex: 1, alignItems: "flex-start" }}>
            <span
              style={{
                fontSize: title.length > 30 ? "52px" : "68px",
                fontWeight: 800,
                color: "#F0EAD6",
                lineHeight: 1,
              }}
            >
              {title}
            </span>
          </div>

          {/* Meta + CTA */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "32px" }}>
            <span style={{ fontSize: "16px", color: "rgba(245,181,72,0.75)", fontWeight: 500 }}>
              {sub || "vltd.app"}
            </span>
            <div
              style={{
                padding: "10px 28px",
                borderRadius: "100px",
                backgroundColor: "#F5B548",
                fontSize: "14px",
                fontWeight: 700,
                color: "#0A0A12",
              }}
            >
              View Exhibition
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

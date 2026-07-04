import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VLTD Exhibition";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type GalleryRow = {
  title: string;
  description: string | null;
  cover_image: string | null;
  layout: { itemIds?: string[] } | null;
  profile_id: string;
};

type ProfileRow = { display_name: string | null };

async function fetchData(token: string) {
  const fallback = {
    title: "VLTD Exhibition",
    description: null as string | null,
    coverImage: null as string | null,
    itemCount: null as number | null,
    collector: "",
  };
  if (!SUPABASE_URL || !SUPABASE_ANON) return fallback;
  const headers = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/galleries?public_token=eq.${encodeURIComponent(token)}&select=title,description,cover_image,layout,profile_id&limit=1`,
      { headers, cache: "no-store" }
    );
    const rows: GalleryRow[] = await res.json().catch(() => []);
    const g = rows[0];
    if (!g) return fallback;
    const itemCount = Array.isArray(g.layout?.itemIds) ? g.layout!.itemIds.length : null;
    let collector = "";
    try {
      const pRes = await fetch(
        `${SUPABASE_URL}/rest/v1/public_profiles?profile_id=eq.${g.profile_id}&select=display_name&limit=1`,
        { headers, cache: "no-store" }
      );
      const profiles: ProfileRow[] = await pRes.json().catch(() => []);
      collector = profiles[0]?.display_name ?? "";
    } catch { /* ignore */ }
    return { title: g.title, description: g.description ?? null, coverImage: g.cover_image ?? null, itemCount, collector };
  } catch {
    return fallback;
  }
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { title, description, coverImage, itemCount, collector } = await fetchData(token);

  const meta = [
    itemCount !== null ? `${itemCount} item${itemCount !== 1 ? "s" : ""}` : null,
    collector ? `Curated by ${collector}` : null,
  ].filter(Boolean).join("  ·  ");

  const titleSize = title.length > 30 ? "52px" : title.length > 20 ? "64px" : "72px";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "row",
          background: "#0A0A12",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
          overflow: "hidden",
        }}
      >
        {/* LEFT: dark text column */}
        <div
          style={{
            width: "560px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "48px 52px 52px 56px",
            background: "#0A0A12",
            position: "relative",
          }}
        >
          {/* Gold left border accent */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "4px",
              height: "630px",
              background: "#F5B548",
            }}
          />

          {/* Top: brand */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "0.28em", color: "#F5B548" }}>
              VLTD
            </span>
            <span style={{ fontSize: "16px", color: "rgba(245,181,72,0.6)", letterSpacing: "0.18em", fontWeight: 500 }}>
              PUBLIC EXHIBITION
            </span>
          </div>

          {/* Middle: title + description */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                fontSize: titleSize,
                fontWeight: 800,
                color: "#F0EAD6",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
              }}
            >
              {title}
            </div>
            {description && (
              <div
                style={{
                  fontSize: "18px",
                  color: "rgba(240,234,214,0.55)",
                  lineHeight: 1.45,
                  fontWeight: 400,
                }}
              >
                {description.length > 80 ? description.slice(0, 77) + "…" : description}
              </div>
            )}
          </div>

          {/* Bottom: meta + CTA */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {meta && (
              <span style={{ fontSize: "20px", color: "rgba(245,181,72,0.85)", fontWeight: 600 }}>
                {meta}
              </span>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: "15px", color: "rgba(160,149,107,0.55)" }}>vltd.app</span>
              <div
                style={{
                  background: "#F5B548",
                  borderRadius: "100px",
                  padding: "12px 28px",
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "#0A0A12",
                }}
              >
                View Exhibition
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: image contained, not stretched */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0A0A12",
            overflow: "hidden",
          }}
        >
          {coverImage ? (
            <img
              src={coverImage}
              alt=""
              style={{
                width: "640px",
                height: "630px",
                objectFit: "contain",
                objectPosition: "center",
              }}
            />
          ) : (
            /* No cover: subtle gold radial glow */
            <div
              style={{
                width: "640px",
                height: "630px",
                background: "radial-gradient(ellipse at center, rgba(245,181,72,0.10) 0%, transparent 70%)",
              }}
            />
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

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

  const titleSize = title.length > 30 ? "64px" : title.length > 20 ? "80px" : "96px";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#0A0A12",
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}
      >
        {/* Full-bleed cover image */}
        {coverImage && (
          <img
            src={coverImage}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "1200px",
              height: "630px",
              objectFit: "cover",
              objectPosition: "center",
            }}
          />
        )}

        {/* Heavy dark gradient so text is always readable */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: coverImage
              ? "linear-gradient(160deg, rgba(10,10,18,0.82) 0%, rgba(10,10,18,0.55) 50%, rgba(10,10,18,0.88) 100%)"
              : "radial-gradient(ellipse at 70% 40%, rgba(245,181,72,0.08) 0%, transparent 60%)",
          }}
        />

        {/* Gold top bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
            background: "#F5B548",
          }}
        />

        {/* Content — full width overlay */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "44px 64px 52px",
            width: "100%",
          }}
        >
          {/* Top: brand */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              style={{
                fontSize: "18px",
                fontWeight: 800,
                letterSpacing: "0.28em",
                color: "#F5B548",
              }}
            >
              VLTD
            </span>
            <span style={{ fontSize: "13px", color: "rgba(245,181,72,0.55)", letterSpacing: "0.18em", fontWeight: 500 }}>
              PUBLIC EXHIBITION
            </span>
          </div>

          {/* Center: big title + description */}
          <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "780px" }}>
            <div
              style={{
                fontSize: titleSize,
                fontWeight: 800,
                color: "#FFFFFF",
                lineHeight: 1,
                letterSpacing: "-0.03em",
                textShadow: "0 2px 24px rgba(0,0,0,0.6)",
              }}
            >
              {title}
            </div>
            {description && (
              <div
                style={{
                  fontSize: "22px",
                  color: "rgba(255,255,255,0.72)",
                  lineHeight: 1.4,
                  fontWeight: 400,
                }}
              >
                {description.length > 90 ? description.slice(0, 87) + "…" : description}
              </div>
            )}
          </div>

          {/* Bottom: meta + CTA */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "17px", color: "rgba(245,181,72,0.9)", fontWeight: 600, letterSpacing: "0.02em" }}>
              {meta || "View the collection"}
            </span>
            <div
              style={{
                background: "#F5B548",
                borderRadius: "100px",
                padding: "12px 32px",
                fontSize: "16px",
                fontWeight: 700,
                color: "#0A0A12",
                letterSpacing: "0.04em",
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

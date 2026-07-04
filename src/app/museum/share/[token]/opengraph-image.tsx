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
  const fallback = { title: "VLTD Exhibition", description: null as string | null, coverImage: null as string | null, itemCount: null as number | null, collector: "" };
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
  const hasCover = !!coverImage;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          background: "#0B0B0B",
          position: "relative",
          overflow: "hidden",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }}
      >
        {/* Cover image — right half */}
        {hasCover && (
          <img
            src={coverImage!}
            alt=""
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: "600px",
              height: "630px",
              objectFit: "cover",
              objectPosition: "center",
            }}
          />
        )}

        {/* Gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: hasCover
              ? "linear-gradient(90deg, #0B0B0B 45%, rgba(11,11,11,0.7) 65%, rgba(11,11,11,0.15) 100%)"
              : "radial-gradient(ellipse at 80% 50%, rgba(245,181,72,0.10) 0%, transparent 65%)",
          }}
        />

        {/* Gold top accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: "linear-gradient(90deg, transparent, #F5B548 30%, #F5B548 70%, transparent)",
          }}
        />

        {/* Left content column */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "48px 52px",
            width: hasCover ? "580px" : "100%",
          }}
        >
          {/* Top: VLTD label */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "0.22em", color: "#F5B548" }}>
              VLTD
            </div>
            <div style={{ width: "1px", height: "14px", background: "rgba(245,181,72,0.4)" }} />
            <div style={{ fontSize: "13px", color: "rgba(245,181,72,0.6)", letterSpacing: "0.12em" }}>
              PUBLIC EXHIBITION
            </div>
          </div>

          {/* Middle: title + description */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div
              style={{
                fontSize: title.length > 40 ? "36px" : "52px",
                fontWeight: 800,
                color: "#F0EAD6",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                maxWidth: "480px",
              }}
            >
              {title}
            </div>
            {description && (
              <div
                style={{
                  fontSize: "16px",
                  color: "rgba(240,234,214,0.55)",
                  lineHeight: 1.5,
                  maxWidth: "440px",
                }}
              >
                {description.length > 100 ? description.slice(0, 97) + "..." : description}
              </div>
            )}
            {/* Meta row */}
            <div style={{ display: "flex", alignItems: "center", gap: "18px", marginTop: "4px" }}>
              {itemCount !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#F5B548" }} />
                  <span style={{ fontSize: "14px", color: "rgba(245,181,72,0.85)", fontWeight: 600 }}>
                    {itemCount} item{itemCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              {collector && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "rgba(160,149,107,0.6)" }} />
                  <span style={{ fontSize: "14px", color: "rgba(160,149,107,0.75)" }}>
                    {collector}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom: CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                background: "linear-gradient(135deg, #8B6914, #F5B548)",
                borderRadius: "100px",
                padding: "10px 24px",
                fontSize: "14px",
                fontWeight: 700,
                color: "#0B0B0B",
              }}
            >
              View Exhibition
            </div>
            <div style={{ fontSize: "13px", color: "rgba(160,149,107,0.6)" }}>vltd.app</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

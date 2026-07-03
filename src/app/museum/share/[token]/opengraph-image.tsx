// Path: src/app/museum/share/[token]/opengraph-image.tsx
// Dynamic OG image for public exhibit share pages.
// Resolves a public_token → gallery and renders the same branded card
// as /museum/[galleryId]/guest/opengraph-image.tsx

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VLTD Exhibition";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type GalleryRow = {
  id: string;
  title: string;
  description: string | null;
  cover_image: string | null;
  layout: { itemIds?: string[] } | null;
  profile_id: string;
};

type ProfileRow = {
  display_name: string | null;
  avatar_url: string | null;
};

async function fetchGalleryByToken(
  token: string
): Promise<{ gallery: GalleryRow; profile: ProfileRow | null }> {
  const fallback: GalleryRow = {
    id: "",
    title: "VLTD Exhibition",
    description: null,
    cover_image: null,
    layout: null,
    profile_id: "",
  };

  const url = `${SUPABASE_URL}/rest/v1/galleries?public_token=eq.${encodeURIComponent(token)}&visibility=eq.PUBLIC&state=eq.ACTIVE&select=id,title,description,cover_image,layout,profile_id&limit=1`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
    },
  });

  const rows: GalleryRow[] = await res.json().catch(() => []);
  const gallery = rows[0] ?? null;

  if (!gallery) return { gallery: fallback, profile: null };

  const profileUrl = `${SUPABASE_URL}/rest/v1/public_profiles?profile_id=eq.${gallery.profile_id}&select=display_name,avatar_url&limit=1`;
  const profileRes = await fetch(profileUrl, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
    },
  });
  const profiles: ProfileRow[] = await profileRes.json().catch(() => []);

  return { gallery, profile: profiles[0] ?? null };
}

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const { gallery, profile } = await fetchGalleryByToken(token);

  const itemCount = Array.isArray(gallery.layout?.itemIds)
    ? gallery.layout!.itemIds.length
    : null;
  const collectorName = profile?.display_name ?? "Collector";
  const hasCover = !!gallery.cover_image;

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
            src={gallery.cover_image!}
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
              : "radial-gradient(ellipse at 80% 50%, rgba(245,181,72,0.12) 0%, transparent 65%)",
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
            background:
              "linear-gradient(90deg, transparent, #F5B548 30%, #F5B548 70%, transparent)",
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
          {/* VLTD wordmark */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                fontSize: "16px",
                fontWeight: 700,
                letterSpacing: "0.22em",
                color: "#F5B548",
                opacity: 0.9,
              }}
            >
              VLTD
            </div>
            <div
              style={{
                width: "1px",
                height: "14px",
                background: "rgba(245,181,72,0.4)",
              }}
            />
            <div
              style={{
                fontSize: "13px",
                color: "rgba(245,181,72,0.6)",
                letterSpacing: "0.12em",
              }}
            >
              COLLECTOR VAULT
            </div>
          </div>

          {/* Gallery info */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                background: "rgba(245,181,72,0.14)",
                border: "1px solid rgba(245,181,72,0.32)",
                borderRadius: "100px",
                padding: "5px 14px",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.18em",
                color: "#F5B548",
                width: "fit-content",
              }}
            >
              PUBLIC EXHIBITION
            </div>

            <div
              style={{
                fontSize: gallery.title.length > 40 ? "36px" : "48px",
                fontWeight: 800,
                color: "#F0EAD6",
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                maxWidth: "480px",
              }}
            >
              {gallery.title}
            </div>

            {gallery.description && (
              <div
                style={{
                  fontSize: "16px",
                  color: "rgba(240,234,214,0.55)",
                  lineHeight: 1.5,
                  maxWidth: "440px",
                }}
              >
                {gallery.description.slice(0, 120)}
              </div>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "20px",
                marginTop: "4px",
              }}
            >
              {itemCount !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#F5B548",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "14px",
                      color: "rgba(245,181,72,0.8)",
                      fontWeight: 600,
                    }}
                  >
                    {itemCount} item{itemCount !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "rgba(160,149,107,0.6)",
                  }}
                />
                <span
                  style={{ fontSize: "14px", color: "rgba(160,149,107,0.7)" }}
                >
                  {collectorName}
                </span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                background: "linear-gradient(135deg, #8B6914, #F5B548)",
                borderRadius: "100px",
                padding: "10px 22px",
                fontSize: "14px",
                fontWeight: 700,
                color: "#0B0B0B",
              }}
            >
              View Exhibition
            </div>
            <div style={{ fontSize: "13px", color: "rgba(160,149,107,0.6)" }}>
              vltd.app
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}

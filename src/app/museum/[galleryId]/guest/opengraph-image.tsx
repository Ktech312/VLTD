// Path: src/app/museum/[galleryId]/guest/opengraph-image.tsx
// Dynamic OG image for public gallery guest pages.
// Fetches the gallery from Supabase (anon key, public rows only) and renders
// a branded 1200×630 card with cover image, title, item count and VLTD mark.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VLTD Gallery";
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
  alias_enabled: boolean | null;
  alias_name: string | null;
};

type ProfileRow = {
  display_name: string | null;
  avatar_url: string | null;
};

async function fetchGallery(galleryId: string): Promise<{ gallery: GalleryRow; profile: ProfileRow | null }> {
  const url = `${SUPABASE_URL}/rest/v1/galleries?id=eq.${galleryId}&visibility=eq.PUBLIC&state=eq.ACTIVE&select=id,title,description,cover_image,layout,profile_id,alias_enabled,alias_name&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
    },
  });
  const rows: GalleryRow[] = await res.json().catch(() => []);
  const gallery = rows[0] ?? null;

  if (!gallery) return { gallery: { id: galleryId, title: "VLTD Gallery", description: null, cover_image: null, layout: null, profile_id: "", alias_enabled: null, alias_name: null }, profile: null };

  // Aliased exhibition: use the made-up name, never fetch the real profile.
  const aliasName = gallery.alias_enabled ? (gallery.alias_name ?? "").trim() : "";
  if (aliasName) {
    return { gallery, profile: { display_name: aliasName, avatar_url: null } };
  }

  // Fetch collector profile
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

export default async function Image({ params }: { params: Promise<{ galleryId: string }> }) {
  const { galleryId } = await params;
  const { gallery, profile } = await fetchGallery(galleryId);

  const itemCount = Array.isArray(gallery.layout?.itemIds) ? gallery.layout!.itemIds.length : null;
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
        {/* Cover image — right half, fading left */}
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

        {/* Gradient overlay — always, covers the cover image fade */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: hasCover
              ? "linear-gradient(90deg, #0B0B0B 45%, rgba(11,11,11,0.7) 65%, rgba(11,11,11,0.15) 100%)"
              : "radial-gradient(ellipse at 80% 50%, rgba(203,208,213,0.12) 0%, transparent 65%)",
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
            background: "linear-gradient(90deg, transparent, #C8CDD2 30%, #C8CDD2 70%, transparent)",
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
          {/* Top: VLTD logo text */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                fontSize: "16px",
                fontWeight: 700,
                letterSpacing: "0.22em",
                color: "#C8CDD2",
                opacity: 0.9,
              }}
            >
              VLTD
            </div>
            <div
              style={{
                width: "1px",
                height: "14px",
                background: "rgba(203,208,213,0.4)",
              }}
            />
            <div style={{ fontSize: "13px", color: "rgba(203,208,213,0.6)", letterSpacing: "0.12em" }}>
              COLLECTOR VAULT
            </div>
          </div>

          {/* Middle: gallery info */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Category badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: "rgba(203,208,213,0.14)",
                border: "1px solid rgba(203,208,213,0.32)",
                borderRadius: "100px",
                padding: "5px 14px",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "0.18em",
                color: "#C8CDD2",
                width: "fit-content",
              }}
            >
              PUBLIC GALLERY
            </div>

            {/* Title */}
            <div
              style={{
                fontSize: gallery.title.length > 40 ? "36px" : "48px",
                fontWeight: 800,
                color: "#ECEDEF",
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                maxWidth: "480px",
              }}
            >
              {gallery.title}
            </div>

            {/* Description */}
            {gallery.description && (
              <div
                style={{
                  fontSize: "16px",
                  color: "rgba(240,234,214,0.55)",
                  lineHeight: 1.5,
                  maxWidth: "440px",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {gallery.description}
              </div>
            )}

            {/* Meta row */}
            <div style={{ display: "flex", alignItems: "center", gap: "20px", marginTop: "4px" }}>
              {itemCount !== null && (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#C8CDD2",
                    }}
                  />
                  <span style={{ fontSize: "14px", color: "rgba(203,208,213,0.8)", fontWeight: 600 }}>
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
                <span style={{ fontSize: "14px", color: "rgba(160,149,107,0.7)" }}>
                  {collectorName}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom: CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                background: "linear-gradient(135deg, #8C9298, #C8CDD2)",
                borderRadius: "100px",
                padding: "10px 22px",
                fontSize: "14px",
                fontWeight: 700,
                color: "#0B0B0B",
              }}
            >
              View Gallery
            </div>
            <div style={{ fontSize: "13px", color: "rgba(160,149,107,0.6)" }}>
              vltd.app
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}

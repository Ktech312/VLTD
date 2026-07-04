import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VLTD Collector Profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type ProfileRow = { id: string };
type PublicProfileRow = { display_name: string | null; bio: string | null; avatar_url: string | null };
type GalleryCountRow = { id: string };

async function fetchProfileData(username: string) {
  const fallback = { displayName: "", bio: null as string | null, galleryCount: 0, avatarUrl: null as string | null };
  if (!SUPABASE_URL || !SUPABASE_ANON) return fallback;
  const h = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };

  try {
    // Try to resolve username → profileId via profiles table (anon key)
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?username=eq.${encodeURIComponent(username.toLowerCase())}&select=id&limit=1`,
      { headers: h, cache: "no-store" }
    );
    const profiles: ProfileRow[] = await profileRes.json().catch(() => []);
    const profileId = profiles[0]?.id;
    if (!profileId) return fallback;

    // Fetch public profile + gallery count in parallel
    const [pubRes, galRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/public_profiles?profile_id=eq.${profileId}&select=display_name,bio,avatar_url&limit=1`, { headers: h, cache: "no-store" }),
      fetch(`${SUPABASE_URL}/rest/v1/galleries?profile_id=eq.${profileId}&visibility=eq.PUBLIC&select=id`, { headers: h, cache: "no-store" }),
    ]);

    const pubProfiles: PublicProfileRow[] = await pubRes.json().catch(() => []);
    const galleries: GalleryCountRow[] = await galRes.json().catch(() => []);

    const pub = pubProfiles[0];
    return {
      displayName: pub?.display_name ?? "",
      bio: pub?.bio ?? null,
      galleryCount: galleries.length,
      avatarUrl: pub?.avatar_url ?? null,
    };
  } catch {
    return fallback;
  }
}

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const { displayName, bio, galleryCount, avatarUrl } = await fetchProfileData(username);

  const name = displayName && displayName.toLowerCase() !== "collector" ? displayName : `@${username}`;
  const nameFontSize = name.length > 24 ? "52px" : name.length > 16 ? "64px" : "76px";

  return new ImageResponse(
    (
      <div style={{ width: "1200px", height: "630px", display: "flex", flexDirection: "row", background: "#0A0A12", fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "hidden" }}>

        {/* Gold left bar */}
        <div style={{ width: "4px", height: "630px", background: "#F5B548", flexShrink: 0 }} />

        {/* Left: profile info (620px) */}
        <div style={{ width: "620px", flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "52px 56px 52px 52px" }}>

          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "0.28em", color: "#F5B548" }}>VLTD</span>
            <div style={{ width: "1px", height: "16px", background: "rgba(245,181,72,0.3)", display: "flex" }} />
            <span style={{ fontSize: "14px", color: "rgba(245,181,72,0.5)", letterSpacing: "0.18em" }}>COLLECTOR PROFILE</span>
          </div>

          {/* Name + handle */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: nameFontSize, fontWeight: 800, color: "#F0EAD6", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
              {name}
            </div>
            {displayName && displayName.toLowerCase() !== "collector" && (
              <span style={{ fontSize: "20px", color: "rgba(245,181,72,0.6)", fontWeight: 500, letterSpacing: "0.05em" }}>
                @{username}
              </span>
            )}
            {bio && (
              <div style={{ fontSize: "18px", color: "rgba(240,234,214,0.5)", lineHeight: 1.5, marginTop: "4px" }}>
                {bio.length > 100 ? bio.slice(0, 97) + "…" : bio}
              </div>
            )}
          </div>

          {/* Stats + CTA */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {galleryCount > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#F5B548", display: "flex" }} />
                <span style={{ fontSize: "20px", color: "rgba(245,181,72,0.85)", fontWeight: 600 }}>
                  {galleryCount} public exhibition{galleryCount !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ background: "#F5B548", borderRadius: "100px", padding: "12px 28px", fontSize: "16px", fontWeight: 700, color: "#0A0A12" }}>
                View Collection
              </div>
              <span style={{ fontSize: "14px", color: "rgba(160,149,107,0.4)" }}>vltd.app</span>
            </div>
          </div>
        </div>

        {/* Right: decorative panel (576px) */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
          {/* Subtle radial glow */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, rgba(245,181,72,0.07) 0%, transparent 65%)", display: "flex" }} />

          {/* Avatar if available */}
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ width: "220px", height: "220px", borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(245,181,72,0.4)" }} />
          ) : (
            /* Concentric rings fallback */
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative", width: "280px", height: "280px" }}>
              <div style={{ position: "absolute", width: "280px", height: "280px", borderRadius: "50%", border: "1px solid rgba(245,181,72,0.08)", display: "flex" }} />
              <div style={{ position: "absolute", width: "210px", height: "210px", borderRadius: "50%", border: "1px solid rgba(245,181,72,0.14)", display: "flex" }} />
              <div style={{ position: "absolute", width: "140px", height: "140px", borderRadius: "50%", border: "1px solid rgba(245,181,72,0.24)", display: "flex" }} />
              <div style={{ position: "absolute", width: "80px", height: "80px", borderRadius: "50%", border: "1px solid rgba(245,181,72,0.4)", display: "flex" }} />
              <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(245,181,72,0.15)", border: "1px solid rgba(245,181,72,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#F5B548", display: "flex" }} />
              </div>
            </div>
          )}
        </div>

      </div>
    ),
    { width: 1200, height: 630 }
  );
}

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VLTD - Explore Exhibitions";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const UNIVERSES = [
  { label: "Comics",       emoji: "📚", color: "rgba(239,68,68,0.18)",   border: "rgba(239,68,68,0.4)" },
  { label: "Sports Cards", emoji: "🏆", color: "rgba(59,130,246,0.18)",  border: "rgba(59,130,246,0.4)" },
  { label: "TCG",          emoji: "🃏", color: "rgba(168,85,247,0.18)",  border: "rgba(168,85,247,0.4)" },
  { label: "Vinyl",        emoji: "🎵", color: "rgba(34,197,94,0.18)",   border: "rgba(34,197,94,0.4)" },
  { label: "Games",        emoji: "🕹", color: "rgba(245,158,11,0.18)",  border: "rgba(245,158,11,0.4)" },
  { label: "Memorabilia",  emoji: "⭐", color: "rgba(203,208,213,0.18)",  border: "rgba(203,208,213,0.4)" },
  { label: "Art",          emoji: "🖼", color: "rgba(20,184,166,0.18)",  border: "rgba(20,184,166,0.4)" },
  { label: "Watches",      emoji: "⌚", color: "rgba(156,163,175,0.18)", border: "rgba(156,163,175,0.4)" },
  { label: "Apparel",      emoji: "👟", color: "rgba(244,114,182,0.18)", border: "rgba(244,114,182,0.4)" },
  { label: "& More",       emoji: "✦",  color: "rgba(203,208,213,0.10)",  border: "rgba(203,208,213,0.25)" },
];

async function fetchStats(): Promise<{ galleryCount: number; collectorCount: number }> {
  const fallback = { galleryCount: 0, collectorCount: 0 };
  if (!SUPABASE_URL || !SUPABASE_KEY) return fallback;
  try {
    const h = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/galleries?visibility=eq.PUBLIC&state=eq.ACTIVE&select=id,profile_id`,
      { headers: h, cache: "no-store" }
    );
    if (!res.ok) return fallback;
    const rows: Array<{ id: string; profile_id: string }> = await res.json().catch(() => []);
    return {
      galleryCount: rows.length,
      collectorCount: new Set(rows.map((r) => r.profile_id)).size,
    };
  } catch {
    return fallback;
  }
}

export default async function Image() {
  const { galleryCount, collectorCount } = await fetchStats();
  const statLine = [
    galleryCount > 0 ? `${galleryCount} exhibitions` : null,
    collectorCount > 0 ? `${collectorCount} collectors` : null,
  ].filter(Boolean).join("  ·  ");

  return new ImageResponse(
    (
      <div style={{ width: "1200px", height: "630px", display: "flex", flexDirection: "row", background: "#0A0A12", fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "hidden" }}>

        {/* Gold left bar */}
        <div style={{ position: "absolute", left: 0, top: 0, width: "4px", height: "630px", background: "#C8CDD2", display: "flex" }} />

        {/* LEFT PANEL */}
        <div style={{ width: "560px", flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "52px 48px 52px 60px" }}>

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "24px", fontWeight: 800, letterSpacing: "0.28em", color: "#C8CDD2" }}>VLTD</span>
            <span style={{ fontSize: "13px", color: "rgba(203,208,213,0.5)", letterSpacing: "0.2em", fontWeight: 500 }}>COLLECTOR PLATFORM</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ fontSize: "72px", fontWeight: 900, color: "#ECEDEF", lineHeight: 0.95, letterSpacing: "-0.03em" }}>
              Explore<br />Exhibitions
            </div>
            <div style={{ fontSize: "19px", color: "rgba(240,234,214,0.52)", lineHeight: 1.5 }}>
              Browse public galleries from collectors across every universe.
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {statLine ? (
              <span style={{ fontSize: "18px", color: "rgba(203,208,213,0.8)", fontWeight: 600 }}>{statLine}</span>
            ) : null}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ background: "#C8CDD2", borderRadius: "100px", padding: "12px 28px", fontSize: "16px", fontWeight: 700, color: "#0A0A12", display: "flex" }}>
                Browse Exhibitions
              </div>
              <span style={{ fontSize: "14px", color: "rgba(160,149,107,0.45)" }}>vltd.app/discover</span>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: universe grid */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 44px 40px 24px", gap: "12px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.22em", color: "rgba(203,208,213,0.45)", marginBottom: "4px", display: "flex" }}>
            EVERY COLLECTING UNIVERSE
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {UNIVERSES.map((u) => (
              <div key={u.label} style={{ display: "flex", alignItems: "center", gap: "10px", background: u.color, border: `1px solid ${u.border}`, borderRadius: "14px", padding: "10px 16px", width: "calc(50% - 5px)" }}>
                <span style={{ fontSize: "22px", lineHeight: 1 }}>{u.emoji}</span>
                <span style={{ fontSize: "16px", fontWeight: 600, color: "rgba(240,234,214,0.88)" }}>{u.label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    ),
    { width: 1200, height: 630 }
  );
}

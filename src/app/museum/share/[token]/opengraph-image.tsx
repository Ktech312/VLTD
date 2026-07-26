import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VLTD Exhibition";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
// Service role key bypasses RLS — galleries table restricts anon reads
const SUPABASE_ANON =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type GalleryRow = {
  title: string;
  description: string | null;
  cover_image: string | null;
  layout: { itemIds?: string[] } | null;
  profile_id: string;
};
type ProfileRow = { display_name: string | null };
type ItemRow = { title: string };

async function fetchData(token: string) {
  const fallback = {
    title: "VLTD Exhibition", description: null as string | null,
    coverImage: null as string | null, itemCount: null as number | null,
    collector: "", items: [] as string[],
  };
  if (!SUPABASE_URL || !SUPABASE_ANON) return fallback;
  const h = { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` };
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/galleries?public_token=eq.${encodeURIComponent(token)}&select=title,description,cover_image,layout,profile_id&limit=1`,
      { headers: h, cache: "no-store" }
    );
    const rows: GalleryRow[] = await res.json().catch(() => []);
    const g = rows[0];
    if (!g) return fallback;

    const itemIds: string[] = Array.isArray(g.layout?.itemIds) ? g.layout!.itemIds : [];
    const itemCount = itemIds.length || null;
    const sampleIds = itemIds.slice(0, 8);

    // Fetch profile and items in parallel
    // vault_items RLS: anon key can read rows where is_public = true
    const [profileRes, itemsRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/public_profiles?profile_id=eq.${g.profile_id}&select=display_name&limit=1`, { headers: h, cache: "no-store" }),
      sampleIds.length > 0
        ? fetch(`${SUPABASE_URL}/rest/v1/vault_items?id=in.(${sampleIds.join(",")})&select=title&limit=8`, { headers: h, cache: "no-store" })
        : Promise.resolve(null),
    ]);

    const profiles: ProfileRow[] = await profileRes.json().catch(() => []);
    const rawName = profiles[0]?.display_name ?? "";
    // Filter out obvious placeholder names set during onboarding
    const PLACEHOLDERS = new Set(["collector", "user", "vltd user", "vltd collector", ""]);
    const collector = PLACEHOLDERS.has(rawName.trim().toLowerCase()) ? "" : rawName.trim();

    let items: string[] = [];
    if (itemsRes) {
      const itemRows: ItemRow[] = await itemsRes.json().catch(() => []);
      items = itemRows.map(r => r.title).filter(Boolean).slice(0, 7);
    }

    return { title: g.title, description: g.description ?? null, coverImage: g.cover_image ?? null, itemCount, collector, items };
  } catch {
    return fallback;
  }
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { title, description, coverImage, itemCount, collector, items } = await fetchData(token);

  const meta = [
    itemCount !== null ? `${itemCount} item${itemCount !== 1 ? "s" : ""}` : null,
    collector ? `Curated by ${collector}` : null,
  ].filter(Boolean).join("  ·  ");

  const titleSize = title.length > 28 ? "52px" : title.length > 18 ? "64px" : "76px";
  const showMore = (itemCount ?? 0) > items.length;

  return new ImageResponse(
    (
      <div style={{ width: "1200px", height: "630px", display: "flex", flexDirection: "row", background: "#0A0A12", fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: "hidden" }}>

        {/* ── LEFT: text (400px) ── */}
        <div style={{ width: "400px", flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "44px 40px 44px 52px", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width: "4px", height: "630px", background: "#C8CDD2" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "0.28em", color: "#C8CDD2" }}>VLTD</span>
            <span style={{ fontSize: "15px", color: "rgba(203,208,213,0.55)", letterSpacing: "0.2em", fontWeight: 500 }}>PUBLIC EXHIBITION</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ fontSize: titleSize, fontWeight: 800, color: "#ECEDEF", lineHeight: 1.05, letterSpacing: "-0.02em" }}>
              {title}
            </div>
            {description ? (
              <div style={{ fontSize: "17px", color: "rgba(240,234,214,0.5)", lineHeight: 1.45 }}>
                {description.length > 85 ? description.slice(0, 82) + "…" : description}
              </div>
            ) : (
              <div style={{ fontSize: "17px", color: "rgba(240,234,214,0.22)", lineHeight: 1.45, fontStyle: "italic" }}>
                A curated collection
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {meta ? <span style={{ fontSize: "19px", color: "rgba(203,208,213,0.85)", fontWeight: 600 }}>{meta}</span> : null}
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ background: "#C8CDD2", borderRadius: "100px", padding: "11px 26px", fontSize: "16px", fontWeight: 700, color: "#0A0A12" }}>
                View Exhibition
              </div>
              <span style={{ fontSize: "14px", color: "rgba(160,149,107,0.4)" }}>vltd.app</span>
            </div>
          </div>
        </div>

        {/* ── CENTER: cover image or geometric fallback (400px) ── */}
        <div style={{ width: "400px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#0A0A12", overflow: "hidden", position: "relative" }}>
          {coverImage ? (
            <img src={coverImage} alt="" style={{ width: "400px", height: "630px", objectFit: "contain", objectPosition: "center" }} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "400px", height: "630px" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", width: "260px", height: "260px" }}>
                <div style={{ position: "absolute", width: "240px", height: "240px", borderRadius: "50%", border: "1px solid rgba(203,208,213,0.15)", display: "flex" }} />
                <div style={{ position: "absolute", width: "180px", height: "180px", borderRadius: "50%", border: "1px solid rgba(203,208,213,0.25)", display: "flex" }} />
                <div style={{ position: "absolute", width: "120px", height: "120px", borderRadius: "50%", border: "1px solid rgba(203,208,213,0.4)", display: "flex" }} />
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(203,208,213,0.12)", border: "1px solid rgba(203,208,213,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#C8CDD2", display: "flex" }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: items list (400px) ── */}
        <div style={{ width: "400px", flexShrink: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "44px 36px 44px 72px", background: "#0A0A12" }}>
          <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.22em", color: "rgba(203,208,213,0.5)" }}>IN THIS EXHIBITION</span>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1, marginTop: "28px", marginBottom: "20px" }}>
            {items.length > 0 ? items.map((name, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#C8CDD2", marginTop: "9px", flexShrink: 0 }} />
                <span style={{ fontSize: "19px", color: "rgba(240,234,214,0.85)", fontWeight: 500, lineHeight: 1.3 }}>
                  {name.length > 28 ? name.slice(0, 25) + "…" : name}
                </span>
              </div>
            )) : (
              [1,2,3,4,5].map((_, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "rgba(203,208,213,0.3)", flexShrink: 0 }} />
                  <div style={{ height: "14px", width: `${120 - i * 15}px`, borderRadius: "4px", background: "rgba(240,234,214,0.08)", display: "flex" }} />
                </div>
              ))
            )}
          </div>

          {showMore && (
            <span style={{ fontSize: "17px", color: "rgba(203,208,213,0.65)", fontWeight: 600, fontStyle: "italic" }}>And many more…</span>
          )}
        </div>

      </div>
    ),
    { width: 1200, height: 630 }
  );
}

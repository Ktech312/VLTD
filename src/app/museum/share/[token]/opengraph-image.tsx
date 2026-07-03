import { ImageResponse } from "next/og";

// Switch to Node.js runtime — edge runtime has a 5s timeout which is too tight
// for two sequential Supabase fetch calls before Satori renders the image.
export const runtime = "nodejs";
export const alt = "VLTD Exhibition";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type Meta = { title: string; description: string; items: string; collector: string };

async function getMeta(token: string): Promise<Meta> {
  const fallback: Meta = { title: "VLTD Exhibition", description: "", items: "", collector: "" };
  if (!SB_URL || !SB_KEY) return fallback;

  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/galleries?public_token=eq.${token}&visibility=eq.PUBLIC&select=title,description,layout,profile_id&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    if (!r.ok) return fallback;

    const rows = (await r.json()) as Array<{
      title?: string;
      description?: string | null;
      layout?: { itemIds?: string[] } | null;
      profile_id?: string;
    }>;
    const g = rows[0];
    if (!g) return fallback;

    const title = String(g.title ?? "").slice(0, 80) || fallback.title;
    const description = String(g.description ?? "").slice(0, 120);
    const count = Array.isArray(g.layout?.itemIds) ? g.layout!.itemIds.length : 0;
    const items = count > 0 ? `${count} ${count === 1 ? "item" : "items"}` : "";

    let collector = "";
    if (g.profile_id) {
      const pr = await fetch(
        `${SB_URL}/rest/v1/public_profiles?profile_id=eq.${g.profile_id}&select=display_name&limit=1`,
        { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
      );
      if (pr.ok) {
        const profiles = (await pr.json()) as Array<{ display_name?: string | null }>;
        collector = String(profiles[0]?.display_name ?? "").slice(0, 40);
      }
    }

    return { title, description, items, collector };
  } catch {
    return fallback;
  }
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const meta = await getMeta(token).catch(() => ({
    title: "VLTD Exhibition", description: "", items: "", collector: "",
  }));

  const titleSize = meta.title.length > 35 ? "44px" : "58px";
  const metaParts: string[] = [];
  if (meta.items) metaParts.push(meta.items);
  if (meta.collector) metaParts.push(`Curated by ${meta.collector}`);
  const metaLine = metaParts.join("  ·  ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "52px 64px 48px",
          backgroundColor: "#0A0A12",
          fontFamily: "sans-serif",
        }}
      >
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "0.28em", color: "#F5B548" }}>
            VLTD
          </span>
          <span style={{ margin: "0 12px", color: "rgba(245,181,72,0.3)", fontSize: "16px" }}>|</span>
          <span style={{ fontSize: "12px", color: "rgba(245,181,72,0.5)", letterSpacing: "0.14em" }}>
            COLLECTOR VAULT
          </span>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div
            style={{
              display: "flex",
              width: "fit-content",
              padding: "5px 16px",
              borderRadius: "100px",
              border: "1px solid rgba(245,181,72,0.3)",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: "#F5B548",
            }}
          >
            PUBLIC EXHIBITION
          </div>

          <div
            style={{
              fontSize: titleSize,
              fontWeight: 800,
              color: "#F0EAD6",
              lineHeight: "1.05",
              maxWidth: "900px",
            }}
          >
            {meta.title}
          </div>

          {meta.description ? (
            <div
              style={{
                fontSize: "17px",
                color: "rgba(240,234,214,0.45)",
                lineHeight: "1.5",
                maxWidth: "700px",
              }}
            >
              {meta.description}
            </div>
          ) : null}
        </div>

        {/* Bottom row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {metaLine ? (
            <div style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "rgba(245,181,72,0.6)",
                  marginRight: "10px",
                }}
              />
              <span style={{ fontSize: "15px", color: "rgba(245,181,72,0.8)", fontWeight: 600 }}>
                {metaLine}
              </span>
            </div>
          ) : (
            <div />
          )}
          <div
            style={{
              padding: "10px 26px",
              borderRadius: "100px",
              background: "#F5B548",
              fontSize: "14px",
              fontWeight: 700,
              color: "#0A0A12",
            }}
          >
            View Exhibition
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

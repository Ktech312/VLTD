import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VLTD Exhibition";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image(props: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // searchParams may be undefined, a plain object, or a Promise depending on Next.js version
  let sp: Record<string, string | string[] | undefined> = {};
  try {
    sp = Object.assign({}, await Promise.resolve(props.searchParams));
  } catch { sp = {}; }

  const get = (k: string) => { const v = sp[k]; return typeof v === "string" ? v : (Array.isArray(v) ? v[0] : undefined); };

  const title  = (get("t") ?? "VLTD Exhibition").slice(0, 80);
  const desc   = (get("d") ?? "").slice(0, 120);
  const n      = get("n");
  const col    = get("c") ?? "";

  const items    = n ? `${n} ${n === "1" ? "item" : "items"}` : "";
  const titlePx  = title.length > 35 ? "44px" : "58px";
  const metaLine = [items, col ? `Curated by ${col}` : ""].filter(Boolean).join("  ·  ");

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
          <span style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "0.28em", color: "#F5B548" }}>VLTD</span>
          <span style={{ margin: "0 12px", color: "rgba(245,181,72,0.3)", fontSize: "16px" }}>|</span>
          <span style={{ fontSize: "12px", color: "rgba(245,181,72,0.5)", letterSpacing: "0.14em" }}>COLLECTOR VAULT</span>
        </div>

        {/* Title block */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              display: "inline-flex",
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
          <div style={{ fontSize: titlePx, fontWeight: 800, color: "#F0EAD6", lineHeight: 1.05 }}>
            {title}
          </div>
          {desc ? (
            <div style={{ fontSize: "17px", color: "rgba(240,234,214,0.45)", lineHeight: 1.5 }}>
              {desc}
            </div>
          ) : null}
        </div>

        {/* Bottom row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "15px", color: "rgba(245,181,72,0.8)", fontWeight: 600 }}>
            {metaLine || "vltd.app"}
          </span>
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

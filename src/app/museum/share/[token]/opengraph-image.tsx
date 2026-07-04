import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VLTD Exhibition";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image(props: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  // Safely read searchParams regardless of whether it is a Promise or plain object
  let raw: Record<string, string | string[] | undefined> = {};
  try { raw = Object.assign({}, await Promise.resolve(props.searchParams)); } catch { raw = {}; }
  const g = (k: string) => { const v = raw[k]; return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : ""; };

  const title = g("t") || "VLTD Exhibition";
  const items = g("n") ? `${g("n")} ${g("n") === "1" ? "item" : "items"}` : "";
  const col   = g("c") ? `Curated by ${g("c")}` : "";
  const sub   = [items, col].filter(Boolean).join("  ·  ");

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
          backgroundColor: "#0A0A12",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Gold left accent */}
        <div style={{ width: "5px", height: "630px", backgroundColor: "#F5B548", flexShrink: 0 }} />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "52px 60px",
            flex: 1,
          }}
        >
          {/* Top label */}
          <div style={{ display: "flex", marginBottom: "32px" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.25em", color: "#F5B548" }}>
              VLTD · PUBLIC EXHIBITION
            </span>
          </div>

          {/* Title */}
          <div style={{ display: "flex", flex: 1, alignItems: "flex-start" }}>
            <span
              style={{
                fontSize: title.length > 30 ? "52px" : "68px",
                fontWeight: 800,
                color: "#F0EAD6",
                lineHeight: 1,
              }}
            >
              {title}
            </span>
          </div>

          {/* Meta + CTA */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "32px" }}>
            <span style={{ fontSize: "16px", color: "rgba(245,181,72,0.75)", fontWeight: 500 }}>
              {sub || "vltd.app"}
            </span>
            <div
              style={{
                padding: "10px 28px",
                borderRadius: "100px",
                backgroundColor: "#F5B548",
                fontSize: "14px",
                fontWeight: 700,
                color: "#0A0A12",
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

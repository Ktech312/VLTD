import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VLTD Exhibition";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ t?: string; d?: string; n?: string; c?: string }>;
}) {
  const sp = await Promise.resolve(searchParams).catch(() => ({})) as {
    t?: string; d?: string; n?: string; c?: string;
  };

  const title = String(sp.t ?? "VLTD Exhibition").slice(0, 80);
  const description = String(sp.d ?? "").slice(0, 120);
  const itemsLabel = sp.n ? `${sp.n} ${sp.n === "1" ? "item" : "items"}` : "";
  const collector = String(sp.c ?? "");

  const titleSize = title.length > 35 ? "44px" : "58px";
  const metaParts: string[] = [];
  if (itemsLabel) metaParts.push(itemsLabel);
  if (collector) metaParts.push(`Curated by ${collector}`);
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
        {/* Wordmark row */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "0.28em", color: "#F5B548" }}>
            VLTD
          </span>
          <span style={{ margin: "0 12px", color: "rgba(245,181,72,0.3)", fontSize: "16px" }}>|</span>
          <span style={{ fontSize: "12px", color: "rgba(245,181,72,0.5)", letterSpacing: "0.14em" }}>
            COLLECTOR VAULT
          </span>
        </div>

        {/* Main block */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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
            {title}
          </div>

          {description ? (
            <div
              style={{
                fontSize: "17px",
                color: "rgba(240,234,214,0.45)",
                lineHeight: "1.5",
                maxWidth: "700px",
              }}
            >
              {description}
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
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: "15px", color: "rgba(245,181,72,0.8)", fontWeight: 600 }}>
                {metaLine}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: "15px", color: "rgba(245,181,72,0.4)" }}>vltd.app</span>
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

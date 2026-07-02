import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "Collectible";
  const grade = searchParams.get("grade") ?? "";
  const imageUrl = searchParams.get("imageUrl") ?? "";
  const description = searchParams.get("description") ?? "";
  const desc = description.length > 130 ? description.slice(0, 130) + "…" : description;

  const GOLD = "#F5B548";
  const BG = "#0d0d0d";

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: BG,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        {/* Left: photo in exact app gold frame */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 580, height: 630, paddingLeft: 48 }}>
          {/* Outer gold frame shell — exact app vault card colors */}
          <div
            style={{
              background: "#d9b277",
              border: "2px solid #7f633f",
              borderRadius: 18,
              padding: 10,
              display: "flex",
              boxShadow: "0 14px 30px rgba(63,35,10,0.6), 0 2px 6px rgba(63,35,10,0.4)",
            }}
          >
            {/* Inner cream mat */}
            <div
              style={{
                background: "#f4ead8",
                border: "1px solid #f0dfbf",
                borderRadius: 10,
                padding: 8,
                display: "flex",
              }}
            >
              {/* Image area — contain so portrait/landscape both fit, black fill for gaps */}
              <div
                style={{
                  width: 410,
                  height: 410,
                  borderRadius: 6,
                  overflow: "hidden",
                  background: "#000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={title}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <div style={{ fontSize: 60, display: "flex" }}>📦</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Vertical gold divider */}
        <div style={{ width: 1, height: 400, background: "rgba(245,181,72,0.18)", flexShrink: 0 }} />

        {/* Right: content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "52px 52px 52px 44px",
            height: "100%",
          }}
        >
          {/* Brand */}
          <div style={{ color: GOLD, fontSize: 15, fontWeight: 700, letterSpacing: "0.36em", display: "flex" }}>
            VLTD
          </div>

          {/* Title + grade + description */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {grade ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "rgba(245,181,72,0.14)",
                  color: GOLD,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  padding: "4px 14px",
                  borderRadius: 100,
                  border: "1px solid rgba(245,181,72,0.32)",
                  width: "fit-content",
                  marginBottom: 16,
                }}
              >
                {grade}
              </div>
            ) : null}

            <div
              style={{
                color: "#f0f0f0",
                fontSize: title.length > 24 ? 34 : title.length > 16 ? 40 : 48,
                fontWeight: 700,
                lineHeight: 1.2,
                display: "flex",
                marginBottom: 20,
              }}
            >
              {title}
            </div>

            {desc ? (
              <div style={{ color: "#777", fontSize: 15, lineHeight: 1.65, display: "flex" }}>
                {desc}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div style={{ color: "rgba(245,181,72,0.38)", fontSize: 12, letterSpacing: "0.1em", display: "flex" }}>
            vltd.vercel.app
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

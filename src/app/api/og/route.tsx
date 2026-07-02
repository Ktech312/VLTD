import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const GOLD = "#F5B548";
const BG = "#0d0d0d";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "Collectible";
  const grade = searchParams.get("grade") ?? "";
  const imageUrl = searchParams.get("imageUrl") ?? "";
  const description = searchParams.get("description") ?? "";
  const desc = description.length > 130 ? description.slice(0, 130) + "…" : description;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: BG,
          display: "flex",
          fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        {/* ── Left: photo inside gold picture frame ── */}
        {/* Outer gold border */}
        <div
          style={{
            width: 630,
            height: 630,
            background: GOLD,
            padding: 7,
            display: "flex",
            flexShrink: 0,
          }}
        >
          {/* Dark mat inside the frame */}
          <div
            style={{
              flex: 1,
              background: "#111",
              padding: 10,
              display: "flex",
            }}
          >
            {/* Inner thin gold line */}
            <div
              style={{
                flex: 1,
                border: "1px solid rgba(245,181,72,0.55)",
                display: "flex",
                overflow: "hidden",
              }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={title}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "#1a1a1a",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 80,
                  }}
                >
                  📦
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: content ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "48px 52px",
            borderLeft: "1px solid rgba(245,181,72,0.18)",
          }}
        >
          {/* Brand */}
          <div
            style={{
              color: GOLD,
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "0.36em",
              display: "flex",
            }}
          >
            VLTD
          </div>

          {/* Title block */}
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
              <div
                style={{
                  color: "#777",
                  fontSize: 15,
                  lineHeight: 1.65,
                  display: "flex",
                }}
              >
                {desc}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div
            style={{
              color: "rgba(245,181,72,0.38)",
              fontSize: 12,
              letterSpacing: "0.1em",
              display: "flex",
            }}
          >
            vltd.vercel.app
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

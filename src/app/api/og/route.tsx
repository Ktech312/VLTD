import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const GOLD = "#F5B548";
const BG = "#0d0d0d";
const SURFACE = "#161616";

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
        {/* Left: photo with gold frame */}
        <div
          style={{
            width: 630,
            height: 630,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: SURFACE,
            flexShrink: 0,
            position: "relative",
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              width={630}
              height={630}
              style={{ objectFit: "cover", width: "100%", height: "100%" }}
            />
          ) : (
            <div style={{ fontSize: 80, display: "flex" }}>📦</div>
          )}
          <div
            style={{
              position: "absolute",
              inset: 0,
              border: "5px solid #F5B548",
              boxSizing: "border-box",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 12,
              border: "1px solid rgba(245,181,72,0.35)",
              boxSizing: "border-box",
              display: "flex",
            }}
          />
        </div>

        {/* Right: content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "48px 52px",
            borderLeft: "1px solid rgba(245,181,72,0.2)",
          }}
        >
          <div
            style={{
              color: GOLD,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.36em",
              display: "flex",
            }}
          >
            VLTD
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {grade ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
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

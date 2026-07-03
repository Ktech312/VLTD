import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "Collectible";
  const grade = searchParams.get("grade") ?? "";
  const imageUrl = searchParams.get("imageUrl") ?? "";

  const titleFontSize = title.length > 36 ? 20 : title.length > 24 ? 24 : title.length > 16 ? 28 : 32;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#090c12",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Gold gradient border frame — matches PremiumDisplayCard ::before gradient + p-[5px] */}
        <div
          style={{
            width: 462,
            height: 616,
            background: "linear-gradient(135deg,#fff0a8 0%,#d99a2b 18%,#6f4514 37%,#f7cf72 54%,#3a250d 72%,#ffe7a0 100%)",
            borderRadius: 18,
            padding: "5px",
            display: "flex",
            boxShadow: "0 18px 38px rgba(0,0,0,0.52),0 0 0 1px rgba(255,234,174,0.32),0 0 28px rgba(245,181,72,0.22)",
          }}
        >
          {/* Inner dark card */}
          <div
            style={{
              flex: 1,
              background: "#0b1018",
              borderRadius: 13,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              position: "relative",
            }}
          >
            {/* Inner gold ring — matches after:ring-1 after:ring-[#ffe8a3]/35 */}
            <div
              style={{
                position: "absolute",
                top: 3, left: 3, right: 3, bottom: 3,
                borderRadius: 10,
                border: "1px solid rgba(255,232,163,0.35)",
                display: "flex",
                pointerEvents: "none",
                zIndex: 10,
              }}
            />

            {/* Corner bolt — top left */}
            <div
              style={{
                position: "absolute", top: 6, left: 6, zIndex: 20,
                width: 20, height: 20, borderRadius: "50%",
                background: "#131018",
                border: "1px solid rgba(255,217,120,0.8)",
                boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.55),0 0 12px rgba(245,181,72,0.35)",
                display: "flex",
              }}
            />

            {/* Corner bolt — top right */}
            <div
              style={{
                position: "absolute", top: 6, right: 6, zIndex: 20,
                width: 20, height: 20, borderRadius: "50%",
                background: "#131018",
                border: "1px solid rgba(255,217,120,0.8)",
                boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.55),0 0 12px rgba(245,181,72,0.35)",
                display: "flex",
              }}
            />

            {/* Top gold shimmer line — matches inset-x-7 top-3 */}
            <div
              style={{
                position: "absolute", top: 12, left: 28, right: 28, height: 1, zIndex: 10,
                background: "linear-gradient(90deg,transparent,#ffdf87,transparent)",
                display: "flex",
              }}
            />

            {/* Image area — top 68%, matches h-[68%] */}
            <div
              style={{
                height: "68%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                background: "radial-gradient(circle at 50% 0%,rgba(255,230,160,0.16),rgba(0,0,0,0.18) 45%,rgba(0,0,0,0.40))",
              }}
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={title}
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", objectPosition: "center" }}
                />
              ) : (
                <div style={{ fontSize: 60, display: "flex" }}>📦</div>
              )}
            </div>

            {/* Bottom label strip — matches h-[32%] + border-t + bg gradient */}
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                borderTop: "1px solid rgba(245,181,72,0.65)",
                background: "linear-gradient(180deg,rgba(22,20,27,0.99),rgba(8,8,12,0.99))",
                padding: "0 12px",
                position: "relative",
              }}
            >
              {/* Accent line inside strip — matches inset-x-2 top-1 */}
              <div
                style={{
                  position: "absolute", top: 4, left: 8, right: 8, height: 1,
                  background: "linear-gradient(90deg,transparent,rgba(255,234,174,0.85),transparent)",
                  display: "flex",
                }}
              />
              <div
                style={{
                  color: "#f5d16d",
                  fontSize: titleFontSize,
                  fontWeight: 600,
                  textAlign: "center",
                  display: "flex",
                  letterSpacing: "0.01em",
                  lineHeight: 1.2,
                }}
              >
                {title}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,0.62)",
                  fontSize: 13,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  display: "flex",
                }}
              >
                {grade || "Collection piece"}
              </div>
              <div
                style={{
                  color: "rgba(245,181,72,0.45)",
                  fontSize: 12,
                  letterSpacing: "0.22em",
                  fontWeight: 700,
                  display: "flex",
                  marginTop: 2,
                }}
              >
                VLTD
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

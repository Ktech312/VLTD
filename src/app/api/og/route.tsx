import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "Collectible";
  const grade = searchParams.get("grade") ?? "";
  const imageUrl = searchParams.get("imageUrl") ?? "";
  const description = searchParams.get("description") ?? "";
  const desc = description.length > 130 ? description.slice(0, 130) + "\u2026" : description;

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
        {/* Left: Exhibition-style premium display card */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 540, height: 630, paddingLeft: 52, paddingRight: 20 }}>
          {/* Gold gradient border — matches PremiumDisplayCard */}
          <div
            style={{
              width: 320,
              height: 468,
              background: "linear-gradient(135deg,#fff0a8 0%,#d99a2b 18%,#6f4514 37%,#f7cf72 54%,#3a250d 72%,#ffe7a0 100%)",
              borderRadius: 20,
              padding: "3px",
              display: "flex",
              boxShadow: "0 18px 38px rgba(0,0,0,0.52),0 0 0 1px rgba(255,234,174,0.32),0 0 22px rgba(245,181,72,0.24)",
            }}
          >
            {/* Inner dark card */}
            <div
              style={{
                flex: 1,
                background: "#0b1018",
                borderRadius: 17,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Corner bolts + top gold line */}
              <div style={{ display: "flex", alignItems: "center", padding: "8px 8px 0 8px", gap: 4 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#131018", border: "1px solid rgba(255,217,120,0.8)", boxShadow: "0 0 8px rgba(245,181,72,0.35)", flexShrink: 0, display: "flex" }} />
                <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,transparent,#ffdf87,transparent)", display: "flex" }} />
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#131018", border: "1px solid rgba(255,217,120,0.8)", boxShadow: "0 0 8px rgba(245,181,72,0.35)", flexShrink: 0, display: "flex" }} />
              </div>

              {/* Image area */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  padding: "10px 10px 6px",
                }}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={title}
                    style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
                  />
                ) : (
                  <div style={{ fontSize: 56, display: "flex" }}>\u{1F4E6}</div>
                )}
              </div>

              {/* Bottom label strip */}
              <div
                style={{
                  padding: "10px 14px 12px",
                  background: "linear-gradient(180deg,rgba(22,20,27,0.99),rgba(8,8,12,0.99))",
                  borderTop: "1px solid rgba(245,181,72,0.65)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(255,234,174,0.85),transparent)", width: "80%", display: "flex" }} />
                <div style={{ color: "#f5d16d", fontSize: 14, fontWeight: 700, textAlign: "center", letterSpacing: "0.01em", display: "flex", marginTop: 4 }}>
                  {title}
                </div>
                {grade ? (
                  <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", display: "flex" }}>
                    {grade}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Vertical gold divider */}
        <div style={{ width: 1, height: 400, background: "rgba(245,181,72,0.18)", flexShrink: 0, display: "flex" }} />

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

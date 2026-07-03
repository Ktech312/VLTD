import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "Collectible";
  const grade = searchParams.get("grade") ?? "";
  const imageUrl = searchParams.get("imageUrl") ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          // Gold gradient border — matches PremiumDisplayCard
          background: "linear-gradient(135deg,#fff0a8 0%,#d99a2b 18%,#6f4514 37%,#f7cf72 54%,#3a250d 72%,#ffe7a0 100%)",
          padding: "6px",
          display: "flex",
          boxShadow: "0 0 60px rgba(245,181,72,0.3)",
        }}
      >
        {/* Inner dark card */}
        <div
          style={{
            flex: 1,
            background: "#0b1018",
            borderRadius: 16,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Corner bolts + top gold line */}
          <div style={{ display: "flex", alignItems: "center", padding: "10px 14px 0", gap: 8 }}>
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#131018", border: "1.5px solid rgba(255,217,120,0.8)", boxShadow: "0 0 10px rgba(245,181,72,0.4)", display: "flex" }} />
            <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,transparent,#ffdf87 30%,#ffdf87 70%,transparent)", display: "flex" }} />
            <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#131018", border: "1.5px solid rgba(255,217,120,0.8)", boxShadow: "0 0 10px rgba(245,181,72,0.4)", display: "flex" }} />
          </div>

          {/* Image area — fills remaining space */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              padding: "14px 60px 8px",
              background: "radial-gradient(circle at 50% 0%,rgba(255,230,160,0.10),rgba(0,0,0,0.0) 55%)",
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={title}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            ) : (
              <div style={{ fontSize: 80, display: "flex" }}>📦</div>
            )}
          </div>

          {/* Bottom label strip */}
          <div
            style={{
              height: 110,
              background: "linear-gradient(180deg,rgba(22,20,27,0.99),rgba(8,8,12,0.99))",
              borderTop: "1px solid rgba(245,181,72,0.65)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "0 60px",
            }}
          >
            <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(255,234,174,0.85),transparent)", width: "50%", display: "flex", marginBottom: 4 }} />
            <div
              style={{
                color: "#f5d16d",
                fontSize: title.length > 36 ? 26 : title.length > 24 ? 32 : title.length > 16 ? 38 : 44,
                fontWeight: 700,
                textAlign: "center",
                display: "flex",
                letterSpacing: "0.01em",
                fontFamily: "Georgia, serif",
              }}
            >
              {title}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {grade ? (
                <div
                  style={{
                    color: "rgba(255,255,255,0.72)",
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    display: "flex",
                    background: "rgba(245,181,72,0.14)",
                    padding: "3px 14px",
                    borderRadius: 100,
                    border: "1px solid rgba(245,181,72,0.32)",
                  }}
                >
                  {grade}
                </div>
              ) : null}
              <div style={{ color: "rgba(245,181,72,0.45)", fontSize: 13, letterSpacing: "0.28em", fontWeight: 700, display: "flex" }}>
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

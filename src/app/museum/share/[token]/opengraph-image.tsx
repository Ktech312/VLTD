import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VLTD Exhibition";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0B0B0B",
          color: "#F5B548",
          fontSize: "48px",
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        VLTD · {token.slice(0, 12)}
      </div>
    ),
    { width: 1200, height: 630 }
  );
}

import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CSSProperties, ReactNode } from "react";

const colors = {
  ink: "#121212",
  paper: "#f8f5ef",
  cream: "#fffaf0",
  moss: "#46624b",
  mint: "#d8f2c8",
  gold: "#d6a850",
  red: "#c55f45",
  blue: "#425b75",
  soft: "rgba(18, 18, 18, 0.09)",
};

const ease = Easing.bezier(0.16, 1, 0.3, 1);

function clampProgress(frame: number, start: number, end: number) {
  return interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
}

function Scene({
  children,
  background = colors.paper,
}: {
  children: ReactNode;
  background?: string;
}) {
  return (
    <AbsoluteFill style={{ background, overflow: "hidden", fontFamily: "Inter, Arial, sans-serif" }}>
      <div style={noiseStyle} />
      {children}
    </AbsoluteFill>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: compact ? 14 : 20 }}>
      <Img
        src={staticFile("brand/vltd-icon.png")}
        style={{
          width: compact ? 68 : 104,
          height: compact ? 68 : 104,
          objectFit: "contain",
          filter: "drop-shadow(0 18px 26px rgba(0,0,0,0.16))",
        }}
      />
      <div>
        <div style={{ fontSize: compact ? 34 : 54, fontWeight: 800, letterSpacing: 0, color: colors.ink }}>
          VLTD
        </div>
        <div style={{ fontSize: compact ? 15 : 23, color: "rgba(18,18,18,0.62)", fontWeight: 700 }}>
          Collect. Curate. Understand.
        </div>
      </div>
    </div>
  );
}

function PhoneShell({
  children,
  style,
  tone = "light",
}: {
  children: ReactNode;
  style?: CSSProperties;
  tone?: "light" | "dark";
}) {
  return (
    <div
      style={{
        width: 650,
        height: 1280,
        borderRadius: 66,
        padding: 22,
        background: tone === "dark" ? "#171514" : "#ffffff",
        boxShadow: "0 46px 110px rgba(33, 28, 20, 0.28)",
        border: "2px solid rgba(18,18,18,0.08)",
        ...style,
      }}
    >
      <div
        style={{
          height: "100%",
          overflow: "hidden",
          borderRadius: 48,
          background: tone === "dark" ? "#201d1a" : "#fbf8f2",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function Pill({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <div
      style={{
        height: 52,
        padding: "0 24px",
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        fontSize: 21,
        fontWeight: 800,
        color: active ? colors.paper : "rgba(18,18,18,0.72)",
        background: active ? colors.ink : "rgba(18,18,18,0.06)",
      }}
    >
      {children}
    </div>
  );
}

function ItemCard({
  title,
  subtitle,
  color,
  value,
  rotate = 0,
}: {
  title: string;
  subtitle: string;
  color: string;
  value: string;
  rotate?: number;
}) {
  return (
    <div
      style={{
        width: 210,
        height: 300,
        borderRadius: 24,
        background: "#fff",
        padding: 14,
        boxShadow: "0 20px 45px rgba(0,0,0,0.15)",
        transform: `rotate(${rotate}deg)`,
      }}
    >
      <div
        style={{
          height: 172,
          borderRadius: 18,
          background: `linear-gradient(145deg, ${color}, #111)`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 18, border: "2px solid rgba(255,255,255,0.34)", borderRadius: 12 }} />
        <div style={{ position: "absolute", left: 24, bottom: 24, color: "#fff", fontSize: 48, fontWeight: 900 }}>
          {title.slice(0, 1)}
        </div>
      </div>
      <div style={{ marginTop: 16, color: colors.ink, fontSize: 22, fontWeight: 900, lineHeight: 1.04 }}>{title}</div>
      <div style={{ marginTop: 6, color: "rgba(18,18,18,0.58)", fontSize: 16, fontWeight: 700 }}>{subtitle}</div>
      <div style={{ marginTop: 12, color: colors.moss, fontSize: 22, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function HeaderCopy({
  eyebrow,
  title,
  body,
  light = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  light?: boolean;
}) {
  return (
    <div style={{ color: light ? colors.paper : colors.ink }}>
      <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 0, color: light ? colors.gold : colors.moss }}>
        {eyebrow}
      </div>
      <div style={{ marginTop: 22, fontSize: 82, lineHeight: 0.95, fontWeight: 950, letterSpacing: 0, maxWidth: 760 }}>
        {title}
      </div>
      <div style={{ marginTop: 28, fontSize: 31, lineHeight: 1.26, fontWeight: 650, maxWidth: 710, opacity: 0.76 }}>
        {body}
      </div>
    </div>
  );
}

function IntroScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 18, stiffness: 95 } });
  const cardA = clampProgress(frame, 18, 64);
  const cardB = clampProgress(frame, 28, 76);
  const cardC = clampProgress(frame, 38, 88);

  return (
    <Scene background={colors.cream}>
      <div style={{ position: "absolute", left: 72, top: 86, transform: `scale(${0.88 + logo * 0.12})`, transformOrigin: "left top" }}>
        <BrandMark />
      </div>
      <div style={{ position: "absolute", left: 78, top: 520 }}>
        <HeaderCopy
          eyebrow="THE COLLECTORS APP"
          title="Your vault, ready for launch."
          body="Add items fast, turn collections into galleries, and see what your portfolio is doing."
        />
      </div>
      <div
        style={{
          position: "absolute",
          right: -8,
          bottom: 136,
          width: 860,
          height: 620,
          borderRadius: 56,
          background: "#efe4d3",
          transform: "rotate(-7deg)",
        }}
      />
      <div style={{ position: "absolute", right: 110, bottom: 375, opacity: cardA, transform: `translateY(${(1 - cardA) * 80}px)` }}>
        <ItemCard title="Spider-Man" subtitle="CGC 9.6" color={colors.red} value="$285" rotate={-9} />
      </div>
      <div style={{ position: "absolute", right: 348, bottom: 292, opacity: cardB, transform: `translateY(${(1 - cardB) * 80}px)` }}>
        <ItemCard title="Jordan" subtitle="Fleer Rookie" color={colors.blue} value="$1,125" rotate={6} />
      </div>
      <div style={{ position: "absolute", right: 64, bottom: 140, opacity: cardC, transform: `translateY(${(1 - cardC) * 80}px)` }}>
        <ItemCard title="Charizard" subtitle="Base Set" color={colors.gold} value="$610" rotate={8} />
      </div>
    </Scene>
  );
}

function AddFlowScene() {
  const frame = useCurrentFrame();
  const scan = clampProgress(frame, 48, 116);
  const fields = clampProgress(frame, 112, 170);
  const saved = clampProgress(frame, 182, 226);

  return (
    <Scene>
      <div style={{ position: "absolute", left: 70, top: 92 }}>
        <BrandMark compact />
      </div>
      <div style={{ position: "absolute", left: 74, top: 250 }}>
        <HeaderCopy
          eyebrow="ADD IN SECONDS"
          title="Scan it. Review it. Vault it."
          body="Camera capture, barcode lookup, AI hints, pricing, and the details you care about in one focused flow."
        />
      </div>
      <PhoneShell style={{ position: "absolute", left: 215, bottom: -100, transform: "rotate(2deg)" }}>
        <div style={{ padding: 34 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 31, fontWeight: 950, color: colors.ink }}>Add item</div>
            <Pill active>AI scan</Pill>
          </div>
          <div
            style={{
              marginTop: 34,
              height: 390,
              borderRadius: 34,
              background: "#14110f",
              overflow: "hidden",
              position: "relative",
              boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.08)",
            }}
          >
            <div style={{ position: "absolute", inset: 42, border: "4px solid rgba(216,242,200,0.86)", borderRadius: 24 }} />
            <div
              style={{
                position: "absolute",
                left: 42,
                right: 42,
                top: 70 + scan * 210,
                height: 5,
                borderRadius: 999,
                background: colors.mint,
                boxShadow: "0 0 32px rgba(216,242,200,0.9)",
              }}
            />
            <div style={{ position: "absolute", left: 165, top: 96 }}>
              <ItemCard title="Gengar" subtitle="Fossil #5" color="#684a87" value="" rotate={0} />
            </div>
          </div>
          <div style={{ marginTop: 32, display: "grid", gap: 16 }}>
            {[
              ["Title", "Gengar"],
              ["Set", "Fossil"],
              ["Grade", "PSA 8"],
              ["Market value", "$68"],
            ].map(([label, value], index) => {
              const p = clampProgress(frame, 112 + index * 12, 150 + index * 12) * fields;
              return (
                <div
                  key={label}
                  style={{
                    opacity: p,
                    transform: `translateX(${(1 - p) * 42}px)`,
                    height: 72,
                    borderRadius: 22,
                    background: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 24px",
                    boxShadow: "0 8px 20px rgba(0,0,0,0.05)",
                  }}
                >
                  <span style={{ color: "rgba(18,18,18,0.5)", fontSize: 20, fontWeight: 800 }}>{label}</span>
                  <span style={{ color: colors.ink, fontSize: 24, fontWeight: 950 }}>{value}</span>
                </div>
              );
            })}
          </div>
          <div
            style={{
              marginTop: 30,
              height: 76,
              borderRadius: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: saved > 0.5 ? colors.moss : colors.ink,
              color: colors.paper,
              fontSize: 25,
              fontWeight: 950,
            }}
          >
            {saved > 0.5 ? "Saved to Vault" : "Add to Vault"}
          </div>
        </div>
      </PhoneShell>
    </Scene>
  );
}

function GalleryScene() {
  const frame = useCurrentFrame();
  const pan = interpolate(frame, [0, 260], [0, -135], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const glow = clampProgress(frame, 70, 150);

  return (
    <Scene background="#181613">
      <Img src={staticFile("themes/walnut-bg.png")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.72 }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.22), rgba(0,0,0,0.58))" }} />
      <div style={{ position: "absolute", left: 76, top: 96 }}>
        <BrandMark compact />
      </div>
      <div style={{ position: "absolute", left: 78, top: 270 }}>
        <HeaderCopy
          light
          eyebrow="GALLERIES"
          title="Give every collection a room."
          body="Curated shelves, public or invite-only sharing, and presentation tools built for collectors."
        />
      </div>
      <div style={{ position: "absolute", left: 72, right: 72, bottom: 146, height: 775, transform: `translateY(${pan}px)` }}>
        {[0, 1, 2].map((row) => (
          <div key={row} style={{ position: "relative", height: 242, marginBottom: 38 }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 24,
                height: 24,
                borderRadius: 999,
                background: "linear-gradient(180deg, #cda06e, #6f4728)",
                boxShadow: "0 26px 60px rgba(0,0,0,0.42)",
              }}
            />
            {[0, 1, 2, 3].map((col) => {
              const names = ["ASM #300", "Jordan", "Charizard", "Mox", "TMNT #1", "Kobe", "Lugia", "Sketch", "Spawn", "Ohtani", "Venusaur", "Print"];
              const palette = [colors.red, colors.blue, colors.gold, colors.moss];
              const p = clampProgress(frame, 32 + row * 16 + col * 8, 88 + row * 16 + col * 8);
              return (
                <div
                  key={col}
                  style={{
                    position: "absolute",
                    left: 20 + col * 230,
                    bottom: 45,
                    opacity: p,
                    transform: `translateY(${(1 - p) * 72}px) rotate(${[-4, 3, -2, 4][col]}deg)`,
                  }}
                >
                  <ItemCard title={names[row * 4 + col]} subtitle="Curated" color={palette[col]} value="$" rotate={0} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          right: 78,
          bottom: 106,
          width: 450,
          borderRadius: 28,
          padding: 28,
          background: `rgba(255,250,240,${0.9 * glow})`,
          color: colors.ink,
          boxShadow: "0 22px 60px rgba(0,0,0,0.28)",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 900, color: colors.moss }}>Exhibition Grade</div>
        <div style={{ marginTop: 8, fontSize: 38, fontWeight: 950 }}>Pop Culture Vault</div>
        <div style={{ marginTop: 10, fontSize: 22, fontWeight: 750, opacity: 0.68 }}>18 items • $8.4k value • Public</div>
      </div>
    </Scene>
  );
}

function Bars({ frame }: { frame: number }) {
  const data = [
    ["Comics", 0.94, colors.red],
    ["Sports", 0.72, colors.blue],
    ["TCG", 0.58, colors.gold],
    ["Art", 0.42, colors.moss],
  ] as const;

  return (
    <div style={{ display: "grid", gap: 26 }}>
      {data.map(([label, value, color], index) => {
        const p = clampProgress(frame, 42 + index * 10, 110 + index * 10);
        return (
          <div key={label}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, fontWeight: 900, color: colors.ink }}>
              <span>{label}</span>
              <span>${Math.round(value * 8400).toLocaleString()}</span>
            </div>
            <div style={{ height: 20, marginTop: 10, borderRadius: 999, background: "rgba(18,18,18,0.08)", overflow: "hidden" }}>
              <div style={{ width: `${value * p * 100}%`, height: "100%", borderRadius: 999, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PortfolioScene() {
  const frame = useCurrentFrame();
  const count = Math.round(interpolate(frame, [30, 138], [0, 18742], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease }));
  const gain = Math.round(interpolate(frame, [74, 162], [0, 3910], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease }));

  return (
    <Scene background="#f4efe6">
      <div style={{ position: "absolute", left: 70, top: 92 }}>
        <BrandMark compact />
      </div>
      <div style={{ position: "absolute", left: 74, top: 242 }}>
        <HeaderCopy
          eyebrow="PORTFOLIO"
          title="Know what your collection is becoming."
          body="Track value, gain, top universes, and the items moving your collection forward."
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 82,
          right: 82,
          bottom: 130,
          height: 910,
          borderRadius: 42,
          background: "#fff",
          padding: 42,
          boxShadow: "0 42px 100px rgba(33,28,20,0.18)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "rgba(18,18,18,0.48)" }}>Total value</div>
            <div style={{ marginTop: 12, fontSize: 74, fontWeight: 950, color: colors.ink }}>${count.toLocaleString()}</div>
          </div>
          <div style={{ borderRadius: 24, padding: "18px 22px", background: colors.mint, color: colors.moss, fontSize: 28, fontWeight: 950 }}>
            +${gain.toLocaleString()}
          </div>
        </div>
        <div style={{ marginTop: 48 }}>
          <Bars frame={frame} />
        </div>
        <div style={{ marginTop: 58, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
          {[
            ["Best mover", "Spider-Man #300", "+7.5%"],
            ["Strongest room", "Pop Culture Vault", "92 score"],
            ["Insurance view", "$18.7k", "Ready"],
            ["Next action", "List 3 duplicates", "Suggested"],
          ].map(([label, value, metric], index) => {
            const p = clampProgress(frame, 120 + index * 10, 168 + index * 10);
            return (
              <div
                key={label}
                style={{
                  opacity: p,
                  transform: `translateY(${(1 - p) * 34}px)`,
                  minHeight: 150,
                  borderRadius: 28,
                  background: "#faf7f0",
                  padding: 24,
                }}
              >
                <div style={{ fontSize: 19, fontWeight: 900, color: "rgba(18,18,18,0.45)" }}>{label}</div>
                <div style={{ marginTop: 12, fontSize: 30, lineHeight: 1.05, fontWeight: 950, color: colors.ink }}>{value}</div>
                <div style={{ marginTop: 12, fontSize: 22, fontWeight: 900, color: colors.moss }}>{metric}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Scene>
  );
}

function FinalScene() {
  const frame = useCurrentFrame();
  const p = clampProgress(frame, 18, 72);

  return (
    <Scene background={colors.ink}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 28%, rgba(216,168,80,0.22), transparent 48%)" }} />
      <div
        style={{
          position: "absolute",
          left: 96,
          right: 96,
          top: 360,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          color: colors.paper,
          opacity: p,
          transform: `translateY(${(1 - p) * 42}px)`,
        }}
      >
        <Img src={staticFile("brand/vltd-logo-primary.png")} style={{ width: 320, height: 320, objectFit: "contain" }} />
        <div style={{ marginTop: 56, fontSize: 92, lineHeight: 0.94, fontWeight: 950, letterSpacing: 0 }}>
          Build the vault your collection deserves.
        </div>
        <div style={{ marginTop: 34, fontSize: 32, lineHeight: 1.24, fontWeight: 700, opacity: 0.72 }}>
          Fast capture. Beautiful galleries. Portfolio intelligence.
        </div>
        <div
          style={{
            marginTop: 74,
            height: 82,
            padding: "0 38px",
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: colors.paper,
            color: colors.ink,
            fontSize: 28,
            fontWeight: 950,
          }}
        >
          Launch VLTD
        </div>
      </div>
    </Scene>
  );
}

export function VltdLaunchVideo() {
  return (
    <AbsoluteFill style={{ background: colors.paper }}>
      <Sequence from={0} durationInFrames={190}>
        <IntroScene />
      </Sequence>
      <Sequence from={190} durationInFrames={260}>
        <AddFlowScene />
      </Sequence>
      <Sequence from={450} durationInFrames={250}>
        <GalleryScene />
      </Sequence>
      <Sequence from={700} durationInFrames={190}>
        <PortfolioScene />
      </Sequence>
      <Sequence from={890} durationInFrames={70}>
        <FinalScene />
      </Sequence>
    </AbsoluteFill>
  );
}

const noiseStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  opacity: 0.28,
  backgroundImage:
    "linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(180deg, rgba(18,18,18,0.045) 1px, transparent 1px)",
  backgroundSize: "46px 46px",
};

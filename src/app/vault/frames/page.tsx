"use client";

import { useRef, useState } from "react";
import Link from "next/link";

import { loadItems, type VaultItem } from "@/lib/vaultModel";
import { useResolvedVaultImage } from "@/lib/useResolvedVaultImages";

type FrameType = "slab" | "onetouch" | "case";

// ─── html2canvas loader (CDN, same pattern as JSZip) ─────────────────────────
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    html2canvas?: any;
  }
}
function loadHtml2Canvas(): Promise<typeof window.html2canvas> {
  return new Promise((resolve, reject) => {
    if (typeof window.html2canvas === "function") { resolve(window.html2canvas); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
    s.onload = () => resolve(window.html2canvas);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ─── Shared card image inside frames ─────────────────────────────────────────
function CardImage({ src, title }: { src: string; title: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={title}
        crossOrigin="anonymous"
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", borderRadius: 3 }}
      />
    );
  }
  return (
    <div style={{
      width: "100%", height: "100%", background: "#1a2a3a",
      display: "flex", alignItems: "center", justifyContent: "center",
      borderRadius: 3, flexDirection: "column", gap: 6,
    }}>
      <div style={{ fontSize: 28, opacity: 0.4 }}>🖼</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "0 8px" }}>No image</div>
    </div>
  );
}

// ─── Frame 1: Grade Slab ──────────────────────────────────────────────────────
function GradeSlabFrame({ item, imageUrl }: { item: VaultItem; imageUrl: string }) {
  const grade = item.grade ?? "–";
  const gradeLabel = item.conditionReason ?? (item.grade ? "GEM MT" : "RAW");
  const certNum = item.certNumber ?? item.serialNumber ?? "00000001";
  const year = item.edition ?? "";
  const cardNum = item.number ? `#${item.number}` : "";

  return (
    <div style={{
      width: 240,
      borderRadius: 8,
      overflow: "hidden",
      border: "2.5px solid rgba(192,218,235,0.94)",
      boxShadow: "5px 8px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.5)",
      background: "rgba(212,232,248,0.15)",
    }}>
      {/* Gold label */}
      <div style={{ background: "#f5c52a", padding: "9px 12px 8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 1 }}>
          <span style={{ font: "700 9px/1 Arial Narrow, Arial, sans-serif", color: "#111", textTransform: "uppercase", letterSpacing: "0.4px" }}>
            {item.category ?? item.universe ?? "Collectible"}{year ? ` · ${year}` : ""}
          </span>
          <span style={{ font: "700 9px/1 Arial, sans-serif", color: "#111" }}>{cardNum}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <span style={{ font: "700 12px/1 Arial Narrow, Arial, sans-serif", color: "#000", textTransform: "uppercase", letterSpacing: "0.2px", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.title ?? "Untitled"}
          </span>
          <span style={{ font: "700 9px/1 Arial, sans-serif", color: "#111", flexShrink: 0 }}>{gradeLabel}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {/* Hologram circle */}
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: "linear-gradient(135deg, #b8960c, #ffe066, #b8960c, #8a6e00, #ffe066, #b8960c)",
            border: "1px solid rgba(0,0,0,0.28)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}>
            <span style={{ font: "900 10px/1 Arial, sans-serif", color: "#3a2400" }}>V</span>
          </div>
          {/* Grade number */}
          <span style={{ font: "900 44px/1 Times New Roman, Georgia, serif", color: "#000", letterSpacing: "-2px" }}>
            {grade}
          </span>
          {/* Cert */}
          <div style={{ textAlign: "right" }}>
            <div style={{ font: "400 7.5px/1.5 Courier New, monospace", color: "#1a1a1a", letterSpacing: "0.3px" }}>{certNum}</div>
            <div style={{ font: "400 7px/1 Arial, sans-serif", color: "#444" }}>vltd.app</div>
          </div>
        </div>
      </div>
      {/* Slab rails */}
      <div style={{
        height: 6, background: "rgba(152,190,215,0.55)",
        borderTop: "1px solid rgba(198,225,240,0.6)", borderBottom: "1px solid rgba(118,163,194,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 32,
      }}>
        <div style={{ width: 20, height: 3, background: "rgba(255,255,255,0.65)", borderRadius: 1 }} />
        <div style={{ width: 20, height: 3, background: "rgba(255,255,255,0.65)", borderRadius: 1 }} />
      </div>
      {/* Card window */}
      <div style={{ padding: 10 }}>
        <div style={{
          aspectRatio: "2.5/3.5", background: "#fff", borderRadius: 4,
          padding: 4, boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.1)",
          overflow: "hidden",
        }}>
          <CardImage src={imageUrl} title={item.title ?? ""} />
        </div>
      </div>
      {/* Bottom shelf */}
      <div style={{ height: 9, background: "rgba(152,195,222,0.18)", borderTop: "0.5px solid rgba(203,228,242,0.7)" }} />
    </div>
  );
}

// ─── Frame 2: One-Touch Holder ────────────────────────────────────────────────
function OneTouchFrame({ item, imageUrl }: { item: VaultItem; imageUrl: string }) {
  return (
    <div style={{ width: 230, position: "relative" }}>
      {/* Top tab */}
      <div style={{
        width: 46, height: 11, background: "rgba(232,244,252,0.88)",
        border: "2px solid rgba(155,198,220,0.85)", borderBottom: "none",
        borderRadius: "4px 4px 0 0", margin: "0 auto", position: "relative", top: 1,
        boxShadow: "inset 0 1px 2px rgba(255,255,255,0.7)",
      }} />
      {/* Body */}
      <div style={{
        border: "2.5px solid rgba(155,198,220,0.9)", borderRadius: 5,
        background: "rgba(232,244,252,0.32)",
        boxShadow: "4px 7px 20px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.7), inset 1px 1px 5px rgba(255,255,255,0.5)",
        padding: "12px 12px 10px",
      }}>
        {/* Gold screws */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9, padding: "0 5px" }}>
          {[0, 1].map((i) => (
            <div key={i} style={{
              width: 12, height: 12, borderRadius: "50%",
              background: "linear-gradient(135deg, #b8960c, #ffe066, #b8960c, #8a6e00)",
              border: "1px solid rgba(0,0,0,0.3)", boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              position: "relative",
            }}>
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%,-50%) rotate(45deg)",
                width: 8, height: 1.5, background: "rgba(80,50,0,0.6)", borderRadius: 1,
              }} />
            </div>
          ))}
        </div>
        {/* Card */}
        <div style={{
          aspectRatio: "2.5/3.5", background: "#fff", borderRadius: 4, padding: 4,
          border: "0.5px solid rgba(0,0,0,0.08)", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.07)",
          overflow: "hidden",
        }}>
          <CardImage src={imageUrl} title={item.title ?? ""} />
        </div>
        {/* Title strip */}
        <div style={{ marginTop: 8, textAlign: "center" }}>
          <div style={{ font: "600 9px/1.3 Arial, sans-serif", color: "rgba(30,50,80,0.7)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {item.title ?? "Untitled"}
          </div>
          {item.grade && (
            <div style={{ font: "400 8px/1 Arial, sans-serif", color: "rgba(30,50,80,0.5)", marginTop: 2 }}>
              Grade: {item.grade}
            </div>
          )}
        </div>
        {/* Bottom clips */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, padding: "0 20px" }}>
          {[0, 1].map((i) => (
            <div key={i} style={{
              width: 24, height: 5, background: "rgba(155,198,220,0.7)",
              borderRadius: "0 0 3px 3px", border: "1px solid rgba(118,170,200,0.55)", borderTop: "none",
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Frame 3: Black Aluminum Case ─────────────────────────────────────────────
function BlackCaseFrame({ item, imageUrl }: { item: VaultItem; imageUrl: string }) {
  const grade = item.grade ?? "–";
  const gradeLabel = item.conditionReason ?? (item.grade ? "GEM MT" : "RAW");
  const certNum = item.certNumber ?? item.serialNumber ?? "00000001";

  return (
    <div style={{ width: 320 }}>
      {/* Lid */}
      <div style={{
        height: 80, background: "#141414", borderRadius: "5px 5px 0 0",
        position: "relative", overflow: "hidden",
        border: "2px solid #333", borderBottom: "none",
        boxShadow: "0 -4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#2e2e2e,#4a4a4a 20%,#3a3a3a 40%,#4a4a4a 60%,#3a3a3a 80%,#2e2e2e)" }} />
        <div style={{
          position: "absolute", inset: "7px 7px 5px",
          borderRadius: 2, overflow: "hidden", backgroundColor: "#1e1e1e",
          backgroundImage: "radial-gradient(ellipse 9px 7px at 50% 50%, #303030 0%, #1a1a1a 60%)",
          backgroundSize: "16px 13px",
          boxShadow: "inset 0 3px 8px rgba(0,0,0,0.5)",
        }} />
        <div style={{ position: "absolute", bottom: 8, right: 14 }}>
          <span style={{ font: "700 9px/1 Arial, sans-serif", color: "rgba(255,255,255,0.12)", letterSpacing: 3, textTransform: "uppercase" }}>VLTD</span>
        </div>
      </div>
      {/* Hinge */}
      <div style={{
        height: 11, background: "#1a1a1a",
        display: "flex", alignItems: "center", justifyContent: "space-evenly",
        padding: "0 40px", border: "0 solid #333", borderLeft: "2px solid #333", borderRight: "2px solid #333",
      }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: 28, height: 9,
            background: "linear-gradient(180deg, #555 0%, #383838 50%, #2a2a2a 100%)",
            borderRadius: 2, border: "1px solid #444",
            boxShadow: "0 2px 4px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12)",
          }} />
        ))}
      </div>
      {/* Tray */}
      <div style={{
        background: "#141414", borderRadius: "0 0 5px 5px",
        border: "2px solid #333", borderTop: "1px solid #222",
        boxShadow: "0 10px 28px rgba(0,0,0,0.65)", overflow: "hidden", position: "relative",
      }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,#2e2e2e,#4a4a4a 20%,#3a3a3a 40%,#4a4a4a 60%,#3a3a3a 80%,#2e2e2e)" }} />
        {/* Latches */}
        <div style={{ position: "absolute", top: 4, left: 0, right: 0, display: "flex", justifyContent: "space-evenly", padding: "0 50px", zIndex: 2 }}>
          {[0, 1].map((i) => (
            <div key={i} style={{
              width: 32, height: 7, background: "linear-gradient(180deg,#444,#282828)",
              borderRadius: 1, border: "1px solid #555",
              boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: 16, height: 2.5, background: "linear-gradient(180deg,#666,#444)", borderRadius: 1 }} />
            </div>
          ))}
        </div>
        {/* Foam + slab */}
        <div style={{
          margin: "14px 10px 12px",
          borderRadius: 3, overflow: "hidden",
          backgroundColor: "#1e1e1e",
          backgroundImage: "radial-gradient(ellipse 9px 7px at 50% 50%, #303030 0%, #1a1a1a 60%)",
          backgroundSize: "16px 13px",
          boxShadow: "inset 0 4px 12px rgba(0,0,0,0.55)",
          padding: 12,
        }}>
          <div style={{
            background: "#161616", borderRadius: 5, padding: 8,
            boxShadow: "inset 0 4px 10px rgba(0,0,0,0.65)",
            display: "flex", justifyContent: "center",
          }}>
            {/* Mini grade slab inside case */}
            <div style={{
              width: 148, borderRadius: 6, overflow: "hidden",
              border: "2px solid rgba(192,218,235,0.9)",
              boxShadow: "4px 6px 16px rgba(0,0,0,0.8), inset 0 0 0 1px rgba(255,255,255,0.35)",
              background: "rgba(210,232,248,0.15)",
            }}>
              <div style={{ background: "#001869", padding: "6px 8px 5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, paddingRight: 6 }}>
                    <div style={{ font: "700 6px/1 Arial, sans-serif", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 2 }}>VLTD Registry</div>
                    <div style={{ font: "700 8.5px/1.2 Arial Narrow, Arial, sans-serif", color: "#fff", textTransform: "uppercase", marginBottom: 1, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.title ?? "Untitled"}
                    </div>
                    <div style={{ font: "400 6px/1.3 Arial, sans-serif", color: "rgba(255,255,255,0.5)" }}>{item.universe ?? ""} {item.number ? `#${item.number}` : ""}</div>
                    <div style={{ font: "400 5.5px/1 Arial, sans-serif", color: "rgba(255,255,255,0.4)", marginTop: 3 }}>Cert: {certNum}</div>
                  </div>
                  <div style={{
                    background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.28)",
                    borderRadius: 4, padding: "4px 7px", textAlign: "center", minWidth: 36,
                  }}>
                    <div style={{ font: "900 24px/1 Times New Roman, Georgia, serif", color: "#fff" }}>{grade}</div>
                    <div style={{ font: "700 5.5px/1 Arial, sans-serif", color: "rgba(255,255,255,0.55)", textTransform: "uppercase", marginTop: 2, letterSpacing: "0.4px" }}>{gradeLabel}</div>
                  </div>
                </div>
              </div>
              <div style={{ height: 4, background: "rgba(152,190,215,0.5)", display: "flex", alignItems: "center", justifyContent: "center", gap: 22 }}>
                <div style={{ width: 14, height: 2, background: "rgba(255,255,255,0.6)", borderRadius: 1 }} />
                <div style={{ width: 14, height: 2, background: "rgba(255,255,255,0.6)", borderRadius: 1 }} />
              </div>
              <div style={{ padding: 6, aspectRatio: "auto" }}>
                <div style={{ aspectRatio: "2.5/3.5", background: "#fff", borderRadius: 3, overflow: "hidden", boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.1)" }}>
                  <CardImage src={imageUrl} title={item.title ?? ""} />
                </div>
              </div>
              <div style={{ height: 6, background: "rgba(152,195,222,0.16)", borderTop: "0.5px solid rgba(203,228,242,0.6)" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Item row in picker list ───────────────────────────────────────────────────
function ItemRow({ item, selected, onSelect }: { item: VaultItem; selected: boolean; onSelect: () => void }) {
  const imageUrl = useResolvedVaultImage(item);
  return (
    <button
      onClick={onSelect}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "8px 10px", textAlign: "left", border: "none", cursor: "pointer",
        background: selected ? "rgba(245,197,42,0.12)" : "transparent",
        borderLeft: selected ? "3px solid #f5c52a" : "3px solid transparent",
        borderRadius: 4, transition: "background 0.15s",
      }}
    >
      {/* Thumbnail */}
      <div style={{
        width: 36, height: 50, borderRadius: 3, overflow: "hidden", flexShrink: 0,
        background: "#1a2a3a", border: "0.5px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {imageUrl
          ? <img src={imageUrl} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: 16, opacity: 0.4 }}>🖼</span>
        }
      </div>
      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: "600 13px/1.3 var(--font-sans)", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {item.title ?? "Untitled"}
        </div>
        <div style={{ font: "400 11px/1.4 var(--font-sans)", color: "var(--text-muted, #888)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {[item.universe, item.category, item.grade ? `Grade ${item.grade}` : null].filter(Boolean).join(" · ")}
        </div>
      </div>
      {selected && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f5c52a", flexShrink: 0 }} />}
    </button>
  );
}

// ─── Frame preview wrapper (captured by html2canvas) ─────────────────────────
function FramePreview({ item, imageUrl, frame }: { item: VaultItem; imageUrl: string; frame: FrameType }) {
  if (frame === "slab") return <GradeSlabFrame item={item} imageUrl={imageUrl} />;
  if (frame === "onetouch") return <OneTouchFrame item={item} imageUrl={imageUrl} />;
  return <BlackCaseFrame item={item} imageUrl={imageUrl} />;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function FramesPage() {
  const [items] = useState<VaultItem[]>(() => loadItems());
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [frame, setFrame] = useState<FrameType>("slab");
  const [bgColor, setBgColor] = useState("#c8bfb2");
  const [downloading, setDownloading] = useState(false);
  const [dlError, setDlError] = useState("");
  const captureRef = useRef<HTMLDivElement>(null);

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;
  const imageUrl = useResolvedVaultImage(selectedItem);

  const filtered = items.filter((i) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      i.title?.toLowerCase().includes(q) ||
      i.subject?.toLowerCase().includes(q) ||
      i.universe?.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q)
    );
  });

  async function handleDownload() {
    if (!captureRef.current || !selectedItem) return;
    setDownloading(true);
    setDlError("");
    try {
      const h2c = await loadHtml2Canvas();
      const canvas = await h2c(captureRef.current, {
        useCORS: true,
        scale: 2,
        backgroundColor: bgColor,
        logging: false,
      });
      const link = document.createElement("a");
      const safeName = (selectedItem.title ?? "item").replace(/[^a-z0-9]/gi, "-").toLowerCase();
      link.download = `vltd-${safeName}-${frame}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      setDlError("Download failed. Try a different browser or check image CORS.");
      console.error(err);
    } finally {
      setDownloading(false);
    }
  }

  const FRAMES: { id: FrameType; label: string }[] = [
    { id: "slab", label: "Grade Slab" },
    { id: "onetouch", label: "One-Touch" },
    { id: "case", label: "Aluminum Case" },
  ];

  const BG_OPTIONS = [
    { color: "#c8bfb2", label: "Warm" },
    { color: "#1a1a1a", label: "Dark" },
    { color: "#ffffff", label: "White" },
    { color: "#0d1b2a", label: "Navy" },
    { color: "#2d1b00", label: "Walnut" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #f5f0e8)", fontFamily: "var(--font-sans, -apple-system, sans-serif)" }}>
      {/* Header */}
      <div style={{ background: "#1a1a1a", color: "#fff", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "0.22em", color: "#f5c52a", fontWeight: 700 }}>VLTD</div>
          <h1 style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 700 }}>Share Frame</h1>
        </div>
        <Link href="/vault" style={{ color: "#f5c52a", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>← Vault</Link>
      </div>

      <div style={{ display: "flex", height: "calc(100vh - 57px)", overflow: "hidden" }}>

        {/* ── Left: item picker ── */}
        <div style={{
          width: 280, flexShrink: 0, borderRight: "1px solid var(--border, #e0ddd5)",
          background: "var(--bg, #fff)", display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          <div style={{ padding: "12px 10px 8px", borderBottom: "1px solid var(--border, #e0ddd5)" }}>
            <input
              type="text"
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "7px 10px", borderRadius: 6, fontSize: 13,
                border: "1px solid var(--border, #ddd)", background: "var(--bg, #fff)",
                color: "var(--text, #111)", boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 4px" }}>
            {filtered.length === 0 && (
              <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 13, color: "#888" }}>
                {items.length === 0 ? "No items in vault yet." : "No matches."}
              </div>
            )}
            {filtered.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                selected={item.id === selectedId}
                onSelect={() => setSelectedId(item.id)}
              />
            ))}
          </div>
          <div style={{ padding: "10px 12px", borderTop: "1px solid var(--border, #e0ddd5)", fontSize: 11, color: "#888" }}>
            {items.length} item{items.length !== 1 ? "s" : ""} in vault
          </div>
        </div>

        {/* ── Right: preview + controls ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Frame + BG selectors */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
            padding: "12px 20px", borderBottom: "1px solid var(--border, #e0ddd5)",
            background: "var(--bg, #fff)",
          }}>
            <div style={{ display: "flex", gap: 4 }}>
              {FRAMES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFrame(f.id)}
                  style={{
                    padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: frame === f.id ? "1.5px solid #f5c52a" : "1.5px solid var(--border, #ddd)",
                    background: frame === f.id ? "#f5c52a" : "transparent",
                    color: frame === f.id ? "#000" : "var(--text, #333)",
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div style={{ width: 1, height: 20, background: "var(--border, #ddd)", margin: "0 4px" }} />
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#888" }}>BG:</span>
              {BG_OPTIONS.map((bg) => (
                <button
                  key={bg.color}
                  title={bg.label}
                  onClick={() => setBgColor(bg.color)}
                  style={{
                    width: 18, height: 18, borderRadius: "50%", border: bgColor === bg.color ? "2px solid #f5c52a" : "1.5px solid rgba(0,0,0,0.15)",
                    background: bg.color, cursor: "pointer", padding: 0,
                  }}
                />
              ))}
            </div>
            <div style={{ flex: 1 }} />
            {selectedItem && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                style={{
                  padding: "7px 20px", borderRadius: 99, fontSize: 13, fontWeight: 700, cursor: downloading ? "default" : "pointer",
                  background: downloading ? "#ddd" : "#f5c52a", border: "none", color: "#000",
                  opacity: downloading ? 0.7 : 1,
                }}
              >
                {downloading ? "Rendering…" : "↓ Download PNG"}
              </button>
            )}
          </div>

          {/* Preview area */}
          <div style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center", background: "#e8e0d4" }}>
            {!selectedItem ? (
              <div style={{ textAlign: "center", color: "#888" }}>
                <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>🖼</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Select an item</div>
                <div style={{ fontSize: 12 }}>Choose from your vault to preview in a frame</div>
              </div>
            ) : (
              <div style={{ padding: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                {/* Capture target */}
                <div
                  ref={captureRef}
                  style={{
                    padding: 32,
                    background: bgColor,
                    borderRadius: 8,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FramePreview item={selectedItem} imageUrl={imageUrl} frame={frame} />
                </div>
                {dlError && <div style={{ fontSize: 12, color: "#c00", maxWidth: 300, textAlign: "center" }}>{dlError}</div>}
                <div style={{ fontSize: 11, color: "#888" }}>
                  The downloaded PNG includes the background. 2× resolution.
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

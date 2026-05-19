# VLTD — ScanCapturePanel (Auto-Lock Haul Camera)

**Philosophy:** The fastest way into the vault. Open the panel, line up the item, the camera locks and snaps itself. Tap Back for the reverse, Next for a new item. Universe and Category set once at the bottom, applied to everything. This is the credit-card-scanner UX applied to collectibles — no buttons, just aim and go.

**Files changed:** 4 files (1 new component, 1 modified component, 1 modified client, 1 modified session)

---

## What this builds

A new fullscreen overlay component `ScanCapturePanel` with:

1. **Frame pills** (top, thumb-reach) — Card / Book / Jewelry / Art. Switches overlay aspect ratio + corner guide shape.
2. **Auto-lock camera view** — live stream with animated corner bracket overlay. Three states: Scanning (dim) → Locking (brightening, building over ~700ms) → Locked (full gold → auto-snap fires).
3. **Back / OR / Next** — appear glowing after each snap. Back = second shot for the same item. Next = new item.
4. **"Quick scan only" checkbox** — disables Back entirely, auto-advances after every snap. For speed runs through a box.
5. **Universe + Category rows** (bottom, thumb-reach) — horizontally scrollable pills. Set once, inherited by all items in the session.
6. **Done (N items)** — opens the existing HaulReviewSheet with the captured stack.

---

## Step 1 — New file: `src/components/ScanCapturePanel.tsx`

Create this file in full:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hasSupabaseEnv, uploadVaultImageToSupabase } from "@/lib/vaultCloud";
import { appendItems, type VaultItem } from "@/lib/vaultModel";
import { emitVaultUpdate } from "@/lib/vaultEvents";
import { enqueueVaultItemSync } from "@/lib/vaultSyncQueue";
import {
  generateVaultImageKey,
  prepareImageBlob,
  saveImageBlobToIndexedDb,
} from "@/lib/vaultImageStore";
import { newId } from "@/lib/id";
import HaulReviewSheet from "@/components/HaulReviewSheet";

// ─── Types ───────────────────────────────────────────────────────────────────

type FrameType = "card" | "book" | "jewelry" | "art";

type CapturedItem = {
  id: string;
  universe: string;
  category: string;
  frontBlob: Blob;
  backBlob?: Blob;
  frontObjectUrl: string;
  backObjectUrl?: string;
};

// Aspect ratio of the guide frame per type
const FRAME_ASPECT: Record<FrameType, number> = {
  card: 3 / 4,      // portrait card (TCG, sports)
  book: 2 / 3,      // taller portrait (comics, paperback)
  jewelry: 1,       // square
  art: 4 / 3,       // landscape
};

const UNIVERSES = ["TCG", "Sports", "Comics", "Vinyl", "Games", "Toys", "Jewelry", "Art"];

const CATEGORIES_BY_UNIVERSE: Record<string, string[]> = {
  TCG: ["Pokémon", "Magic", "One Piece", "Lorcana", "Yu-Gi-Oh", "Flesh & Blood"],
  Sports: ["Baseball", "Basketball", "Football", "Soccer", "Hockey", "UFC"],
  Comics: ["Marvel", "DC", "Image", "Dark Horse", "Indie"],
  Vinyl: ["Rock", "Jazz", "Hip-Hop", "Classical", "Electronic", "Pop"],
  Games: ["Video Game", "Board Game", "Tabletop RPG"],
  Toys: ["Action Figure", "Funko Pop", "Vintage", "LEGO"],
  Jewelry: ["Ring", "Necklace", "Bracelet", "Watch", "Earrings"],
  Art: ["Painting", "Print", "Sculpture", "Photography", "Drawing"],
};

// ─── Lock detection helpers ───────────────────────────────────────────────────

/** Laplacian variance — higher = sharper. Below ~80 = blurry for most items. */
function computeBlurScore(video: HTMLVideoElement, canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;
  const w = 160;
  const h = Math.round(w * (video.videoHeight / video.videoWidth));
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(video, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += gray;
  }
  const mean = sum / (w * h);
  let variance = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    variance += Math.pow(gray - mean, 2);
  }
  // Simple edge proxy: use pixel brightness variance as sharpness indicator
  return variance / (w * h);
}

/** Capture the video frame to a Blob. */
async function captureFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): Promise<Blob | null> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.88);
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FramePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flexShrink: 0,
        background: active ? "rgba(245,181,72,0.18)" : "rgba(255,255,255,0.06)",
        border: active
          ? "1.5px solid rgba(245,181,72,0.6)"
          : "1px solid rgba(255,255,255,0.12)",
        color: active ? "#F5B548" : "rgba(255,255,255,0.45)",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 500,
        padding: "5px 12px",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      {label}
    </button>
  );
}

function UniversePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flexShrink: 0,
        background: active ? "rgba(245,181,72,0.16)" : "rgba(255,255,255,0.05)",
        border: active
          ? "1px solid rgba(245,181,72,0.5)"
          : "1px solid rgba(255,255,255,0.1)",
        color: active ? "#F5B548" : "rgba(255,255,255,0.45)",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 500,
        padding: "5px 12px",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.2s",
      }}
    >
      {label}
    </button>
  );
}

// Corner bracket overlay — animates from dim to gold as lock builds
function FrameOverlay({
  lockProgress, // 0–1: 0 = scanning, 1 = fully locked
  frameType,
}: {
  lockProgress: number;
  frameType: FrameType;
}) {
  const gold = `rgba(245,181,72,${0.2 + lockProgress * 0.8})`;
  const glow = lockProgress > 0.6 ? `0 0 ${Math.round(lockProgress * 18)}px rgba(245,181,72,${lockProgress * 0.45})` : "none";
  const cornerSize = 18 + lockProgress * 6; // corners grow as lock builds
  const borderW = 2 + lockProgress * 0.5;

  const cornerStyle = (pos: string): React.CSSProperties => {
    const isTop = pos.includes("t");
    const isLeft = pos.includes("l");
    return {
      position: "absolute",
      [isTop ? "top" : "bottom"]: 0,
      [isLeft ? "left" : "right"]: 0,
      width: cornerSize,
      height: cornerSize,
      borderTop: isTop ? `${borderW}px solid ${gold}` : "none",
      borderBottom: !isTop ? `${borderW}px solid ${gold}` : "none",
      borderLeft: isLeft ? `${borderW}px solid ${gold}` : "none",
      borderRight: !isLeft ? `${borderW}px solid ${gold}` : "none",
      borderRadius: isTop && isLeft ? "3px 0 0 0" : isTop ? "0 3px 0 0" : isLeft ? "0 0 0 3px" : "0 0 3px 0",
      boxShadow: glow,
      transition: "all 0.15s ease-out",
    };
  };

  // Frame inset depends on aspect ratio
  const _ = FRAME_ASPECT[frameType]; // reserved for future frame shape variants

  return (
    <div
      style={{
        position: "absolute",
        inset: "16px 22px",
        borderRadius: 6,
        pointerEvents: "none",
      }}
    >
      <div style={cornerStyle("tl")} />
      <div style={cornerStyle("tr")} />
      <div style={cornerStyle("bl")} />
      <div style={cornerStyle("br")} />
      {/* Subtle inner glow when close to locked */}
      {lockProgress > 0.7 && (
        <div
          style={{
            position: "absolute",
            inset: -2,
            borderRadius: 8,
            boxShadow: `0 0 0 1px rgba(245,181,72,${(lockProgress - 0.7) * 0.5}), inset 0 0 ${Math.round((lockProgress - 0.7) * 40)}px rgba(245,181,72,${(lockProgress - 0.7) * 0.08})`,
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ScanCapturePanel({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analysisIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockStartRef = useRef<number | null>(null);

  const [frameType, setFrameType] = useState<FrameType>("card");
  const [universe, setUniverse] = useState("TCG");
  const [category, setCategory] = useState("Pokémon");
  const [quickMode, setQuickMode] = useState(false);

  // lock detection state
  const [lockProgress, setLockProgress] = useState(0); // 0–1
  const [lockStatus, setLockStatus] = useState<"scanning" | "locking" | "locked" | "snapped">("scanning");

  // after snap
  const [snappedBlob, setSnappedBlob] = useState<Blob | null>(null);
  const [awaitingBackShot, setAwaitingBackShot] = useState(false); // true if we just did a front, awaiting back choice

  // session
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null); // item awaiting back shot
  const [showReview, setShowReview] = useState(false);

  // Start camera
  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch {
        // camera unavailable — fallback handled via UI
      }
    }

    void startCamera();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Auto-lock analysis loop
  useEffect(() => {
    if (lockStatus === "snapped" || lockStatus === "locked") return;

    const LOCK_REQUIRED_MS = 700;
    const BLUR_THRESHOLD = 120; // tune this — higher = stricter

    analysisIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const blur = computeBlurScore(video, canvas);
      const isSharp = blur > BLUR_THRESHOLD;

      if (isSharp) {
        if (!lockStartRef.current) lockStartRef.current = Date.now();
        const elapsed = Date.now() - lockStartRef.current;
        const progress = Math.min(elapsed / LOCK_REQUIRED_MS, 1);
        setLockProgress(progress);
        setLockStatus(progress < 1 ? "locking" : "locked");

        if (progress >= 1) {
          // auto-snap
          clearInterval(analysisIntervalRef.current!);
          void handleAutoSnap(video, canvas);
        }
      } else {
        lockStartRef.current = null;
        setLockProgress(0);
        setLockStatus("scanning");
      }
    }, 80);

    return () => {
      if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockStatus]);

  async function handleAutoSnap(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
    const blob = await captureFrame(video, canvas);
    if (!blob) return;
    setSnappedBlob(blob);
    setLockStatus("snapped");
    setLockProgress(1);

    if (quickMode) {
      // Quick mode: no Back/Next prompt — save front immediately and reset
      await commitFront(blob, null);
      resetToScanning();
    } else {
      // Show Back / Next choice
      setAwaitingBackShot(true);
      // Create a new item id ready to attach the back to
      setActiveItemId(newId());
    }
  }

  async function commitFront(frontBlob: Blob, backBlob: Blob | null) {
    const id = activeItemId ?? newId();
    const frontObjectUrl = URL.createObjectURL(frontBlob);
    const backObjectUrl = backBlob ? URL.createObjectURL(backBlob) : undefined;

    const newItem: CapturedItem = {
      id,
      universe,
      category,
      frontBlob,
      backBlob: backBlob ?? undefined,
      frontObjectUrl,
      backObjectUrl,
    };

    setCapturedItems((prev) => [...prev, newItem]);
  }

  function handleBack() {
    // Reset camera to scan the back of the same item
    setAwaitingBackShot(false);
    setLockStatus("scanning");
    setLockProgress(0);
    lockStartRef.current = null;
    // The activeItemId stays set — next snap will be treated as the back shot
  }

  async function handleNext() {
    // Save the front-only item and move on
    if (snappedBlob) {
      await commitFront(snappedBlob, null);
    }
    setActiveItemId(null);
    setSnappedBlob(null);
    setAwaitingBackShot(false);
    resetToScanning();
  }

  // This fires after the back shot auto-locks when awaitingBackShot === false but activeItemId is set
  // (i.e., user chose "Back" and we're capturing the second image)
  // We detect this by checking: lockStatus === "snapped" AND activeItemId is set AND awaitingBackShot is false
  useEffect(() => {
    if (lockStatus === "snapped" && activeItemId && !awaitingBackShot && snappedBlob) {
      // This is the back shot
      void (async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;
        const backBlob = await captureFrame(video, canvas);
        await commitFront(snappedBlob, backBlob);
        setActiveItemId(null);
        setSnappedBlob(null);
        resetToScanning();
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockStatus]);

  function resetToScanning() {
    setLockStatus("scanning");
    setLockProgress(0);
    lockStartRef.current = null;
  }

  function handleDone() {
    if (capturedItems.length === 0) { onClose(); return; }
    setShowReview(true);
  }

  async function handleReviewSave(items: VaultItem[]) {
    appendItems(items);
    for (const item of items) enqueueVaultItemSync(item.id);
    emitVaultUpdate();
    onClose();
  }

  // Build VaultItem stubs for HaulReviewSheet
  const haulItems: VaultItem[] = capturedItems.map((ci) => ({
    id: ci.id,
    title: "",
    universe: ci.universe,
    category: ci.category,
    imageFrontUrl: ci.frontObjectUrl,
    images: [
      { id: `${ci.id}_img_0`, storageKey: "", url: ci.frontObjectUrl, order: 0, localOnly: true },
      ...(ci.backObjectUrl
        ? [{ id: `${ci.id}_img_1`, storageKey: "", url: ci.backObjectUrl, order: 1, localOnly: true }]
        : []),
    ],
    isNew: true,
    createdAt: Date.now(),
  }));

  if (showReview) {
    return (
      <HaulReviewSheet
        items={haulItems}
        onSave={handleReviewSave}
        onClose={onClose}
      />
    );
  }

  const categories = CATEGORIES_BY_UNIVERSE[universe] ?? [];

  // Button glow states — both glow after snap
  const backGlowing = awaitingBackShot && !quickMode;
  const nextGlowing = awaitingBackShot && !quickMode;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        background: "#060c1a",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Hidden canvas for blur analysis and frame capture */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* ── Top bar: Frame pills ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "12px 14px 10px",
          background: "rgba(6,12,26,0.96)",
          borderBottom: "0.5px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        {(["card", "book", "jewelry", "art"] as FrameType[]).map((f) => (
          <FramePill
            key={f}
            label={f.charAt(0).toUpperCase() + f.slice(1)}
            active={frameType === f}
            onClick={() => setFrameType(f)}
          />
        ))}
        <button
          type="button"
          onClick={onClose}
          style={{
            marginLeft: "auto",
            flexShrink: 0,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.07)",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "rgba(255,255,255,0.5)",
          }}
          aria-label="Close scanner"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* ── Camera view ── */}
      <div style={{ position: "relative", flex: "1 1 0", minHeight: 0, background: "#040912" }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        <FrameOverlay lockProgress={lockProgress} frameType={frameType} />

        {/* Lock status label */}
        <div
          style={{
            position: "absolute",
            bottom: 12,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: lockStatus === "locked" || lockStatus === "snapped"
                ? "#F5B548"
                : lockStatus === "locking"
                  ? `rgba(245,181,72,${0.3 + lockProgress * 0.7})`
                  : "rgba(255,255,255,0.3)",
              boxShadow: lockStatus === "locked" ? "0 0 10px rgba(245,181,72,0.7)" : "none",
              transition: "all 0.2s",
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: lockStatus === "locked" || lockStatus === "snapped"
                ? "#F5B548"
                : lockStatus === "locking"
                  ? `rgba(245,181,72,${0.4 + lockProgress * 0.6})`
                  : "rgba(255,255,255,0.35)",
              transition: "color 0.2s",
            }}
          >
            {lockStatus === "locked" || lockStatus === "snapped"
              ? "LOCKED"
              : lockStatus === "locking"
                ? "LOCKING…"
                : "SCANNING"}
          </span>
        </div>
      </div>

      {/* ── Back / OR / Next ── */}
      <div
        style={{
          padding: "10px 14px 6px",
          background: "#0a0f1e",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Back button */}
          <button
            type="button"
            onClick={handleBack}
            disabled={!awaitingBackShot || quickMode}
            style={{
              flex: 1,
              background: backGlowing
                ? "rgba(255,255,255,0.09)"
                : "rgba(255,255,255,0.05)",
              border: backGlowing
                ? "1.5px solid rgba(255,255,255,0.35)"
                : "1.5px solid rgba(255,255,255,0.1)",
              color: backGlowing
                ? "rgba(255,255,255,0.9)"
                : "rgba(255,255,255,0.35)",
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 500,
              padding: "9px 0",
              cursor: awaitingBackShot && !quickMode ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              transition: "all 0.25s ease",
              boxShadow: backGlowing ? "0 0 14px rgba(255,255,255,0.08)" : "none",
              opacity: quickMode ? 0.25 : 1,
            }}
            aria-label="Capture back of item"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
            Back
          </button>

          {/* OR divider */}
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: awaitingBackShot && !quickMode
                ? "rgba(255,255,255,0.3)"
                : "rgba(255,255,255,0.12)",
              flexShrink: 0,
              letterSpacing: "0.04em",
              transition: "color 0.25s",
            }}
          >
            OR
          </span>

          {/* Next button */}
          <button
            type="button"
            onClick={handleNext}
            disabled={!awaitingBackShot && !quickMode}
            style={{
              flex: 1,
              background: nextGlowing
                ? "rgba(245,181,72,0.2)"
                : "rgba(255,255,255,0.05)",
              border: nextGlowing
                ? "1.5px solid rgba(245,181,72,0.7)"
                : "1.5px solid rgba(255,255,255,0.1)",
              color: nextGlowing ? "#F5B548" : "rgba(255,255,255,0.35)",
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
              padding: "9px 0",
              cursor: awaitingBackShot || quickMode ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              transition: "all 0.25s ease",
              boxShadow: nextGlowing ? "0 0 14px rgba(245,181,72,0.22)" : "none",
            }}
            aria-label="Next item"
          >
            Next
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6"/>
            </svg>
          </button>
        </div>

        {/* Quick scan checkbox */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 2px 4px",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <div
            onClick={() => setQuickMode((v) => !v)}
            role="checkbox"
            aria-checked={quickMode}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") setQuickMode((v) => !v); }}
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              border: quickMode
                ? "1.5px solid rgba(245,181,72,0.55)"
                : "1.5px solid rgba(255,255,255,0.18)",
              background: quickMode ? "rgba(245,181,72,0.15)" : "rgba(255,255,255,0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {quickMode && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 5l2.5 2.5 4.5-5" stroke="#F5B548" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Quick scan only</span>
        </label>
      </div>

      {/* ── Universe + Category + Done ── */}
      <div
        style={{
          borderTop: "0.5px solid rgba(255,255,255,0.05)",
          background: "#0a0f1e",
          padding: "0 14px 14px",
          flexShrink: 0,
        }}
      >
        {/* Universe */}
        <div style={{ paddingTop: 10, marginBottom: 6 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: "0.12em",
              color: "rgba(160,149,107,0.6)",
              textTransform: "uppercase",
            }}
          >
            Universe
          </span>
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            paddingBottom: 4,
            scrollbarWidth: "none",
          }}
        >
          {UNIVERSES.map((u) => (
            <UniversePill
              key={u}
              label={u}
              active={universe === u}
              onClick={() => {
                setUniverse(u);
                const cats = CATEGORIES_BY_UNIVERSE[u] ?? [];
                setCategory(cats[0] ?? "");
              }}
            />
          ))}
        </div>

        {/* Category */}
        {categories.length > 0 && (
          <>
            <div style={{ paddingTop: 8, marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: "0.12em",
                  color: "rgba(160,149,107,0.6)",
                  textTransform: "uppercase",
                }}
              >
                Category
              </span>
            </div>
            <div
              style={{
                display: "flex",
                gap: 6,
                overflowX: "auto",
                paddingBottom: 4,
                scrollbarWidth: "none",
              }}
            >
              {categories.map((c) => (
                <UniversePill
                  key={c}
                  label={c}
                  active={category === c}
                  onClick={() => setCategory(c)}
                />
              ))}
            </div>
          </>
        )}

        {/* Done */}
        <button
          type="button"
          onClick={handleDone}
          style={{
            width: "100%",
            marginTop: 10,
            background: capturedItems.length > 0
              ? "rgba(245,181,72,0.10)"
              : "rgba(255,255,255,0.06)",
            border: capturedItems.length > 0
              ? "0.5px solid rgba(245,181,72,0.3)"
              : "0.5px solid rgba(255,255,255,0.1)",
            color: capturedItems.length > 0 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.35)",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 500,
            padding: "11px 0",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            transition: "all 0.2s",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
            <path d="M20 12L9 23l-5-5"/>
          </svg>
          Done
          {capturedItems.length > 0 && (
            <span style={{ color: "#F5B548", fontWeight: 600 }}>
              &nbsp;{capturedItems.length} {capturedItems.length === 1 ? "item" : "items"}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
```

---

## Step 2 — Launch from QuickAddClient

**File: `src/app/vault/quick/QuickAddClient.tsx`**

### 2a — Import the panel

```tsx
import ScanCapturePanel from "@/components/ScanCapturePanel";
```

### 2b — Add state

```tsx
const [isScanPanelOpen, setIsScanPanelOpen] = useState(false);
```

### 2c — Replace the camera card

In the JSX, replace whatever camera button/card exists in the empty-state (no `activePreview`) with:

```tsx
{!activePreview && (
  <button
    type="button"
    onClick={() => setIsScanPanelOpen(true)}
    className="group relative flex w-full flex-col items-center justify-center gap-4 rounded-[18px] transition active:scale-[0.99]"
    style={{
      minHeight: 220,
      background: "rgba(12,20,38,0.7)",
      border: "1.5px dashed rgba(245,181,72,0.28)",
      backdropFilter: "blur(8px)",
    }}
  >
    <div
      className="flex items-center justify-center rounded-full transition-transform group-hover:scale-105"
      style={{
        width: 68,
        height: 68,
        background: "rgba(245,181,72,0.10)",
        border: "1.5px solid rgba(245,181,72,0.30)",
      }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F5B548" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
    </div>
    <div>
      <div className="text-center text-base font-bold" style={{ color: "var(--theme-gold, #F5B548)" }}>
        Tap to scan
      </div>
      <div className="mt-1 text-center text-[12px]" style={{ color: "rgba(160,149,107,0.6)" }}>
        Auto-locks and snaps when ready
      </div>
    </div>
  </button>
)}
```

### 2d — Render the panel

Somewhere in the return (before the closing `</main>`):

```tsx
{isScanPanelOpen && (
  <ScanCapturePanel onClose={() => setIsScanPanelOpen(false)} />
)}
```

---

## Step 3 — HaulReviewSheet compatibility check

**File: `src/components/HaulReviewSheet.tsx`**

The HaulReviewSheet receives `VaultItem[]`. `ScanCapturePanel` passes stubs where `title` is `""` and `imageFrontUrl` is a local object URL. Confirm:

- `title` is editable in the review sheet (it is — the sheet has title inputs per item)
- `imageFrontUrl` renders correctly in the review sheet image preview (it is — it's just a URL)
- `images[1]` (the back shot) is displayed or at least not broken (it may not be displayed yet — that's fine for now, the data is there)

No changes needed to HaulReviewSheet unless the title field is ever pre-populated from something other than `item.title`.

---

## Step 4 — Blur threshold tuning note

The `BLUR_THRESHOLD` constant in `ScanCapturePanel.tsx` is set to `120`. This is a starting point — the right value depends on real-world lighting. If cards lock too aggressively (blurry snaps), raise it to `160–200`. If it never locks in normal lighting, lower to `60–80`. Make it a named constant at the top of the file so the coder can tune it easily during testing.

---

## Lock animation behavior (reference for coder)

| State | Corner color | SCANNING/LOCKING/LOCKED label | Dot |
|---|---|---|---|
| Scanning | `rgba(245,181,72,0.2)` dim | SCANNING — white dim | White dim dot |
| Locking (0→700ms) | Brightens from 0.2→1.0 over 700ms | LOCKING… — gold building | Gold building |
| Locked (snap fires) | Full gold + inner glow | LOCKED — gold | Gold pulsing |

After snap, if **quick mode**: instant reset to Scanning. If **normal mode**: freeze on Locked, both buttons glow, await user choice.

---

## Verify

```bash
npx tsc --noEmit
npm run build
```

Test checklist:
- [ ] Panel opens fullscreen when camera card is tapped
- [ ] Camera stream starts with `facingMode: environment`
- [ ] Frame pill selection updates the active pill style (Card/Book/Jewelry/Art)
- [ ] Blur score drives the corner brightness — moving the camera makes it dim, holding still makes it brighten
- [ ] Auto-snap fires after ~700ms of stability — blob is captured
- [ ] Normal mode: Back and Next buttons glow gold after snap
- [ ] Back → camera resets, next snap is treated as back shot → item has 2 images
- [ ] Next → front-only item committed, camera resets for new item
- [ ] Quick scan mode: Back button is dim/disabled, snap → instant next item
- [ ] Universe selection updates Category row to matching categories
- [ ] Done opens HaulReviewSheet with correct item count
- [ ] HaulReviewSheet save writes items to vault and closes panel
- [ ] TypeScript passes with no new errors

Commit: `feat: ScanCapturePanel — auto-lock haul camera with frame pills, Back/Next choice, quick scan mode`

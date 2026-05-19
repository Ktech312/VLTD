"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import HaulReviewSheet from "@/components/HaulReviewSheet";
import { newId } from "@/lib/id";
import { emitVaultUpdate } from "@/lib/vaultEvents";
import { appendItems, type VaultImage, type VaultItem } from "@/lib/vaultModel";
import { enqueueVaultItemSync, processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import {
  generateVaultImageKey,
  prepareImageBlob,
  saveImageBlobToIndexedDb,
} from "@/lib/vaultImageStore";
import { createHaulSession, haulItemFromVaultItem, saveHaulSession, type HaulSession } from "@/lib/haulSession";
import { getCategories, UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";

type FrameType = "card" | "book" | "jewelry" | "art";
type LockStatus = "scanning" | "locking" | "locked" | "snapped";

type CapturedItem = {
  id: string;
  universe: UniverseKey;
  categoryLabel: string;
  frontBlob: Blob;
  backBlob?: Blob;
  frontObjectUrl: string;
  backObjectUrl?: string;
};

const BLUR_THRESHOLD = 80; // Laplacian variance threshold; 120 was too strict for dark/simple backgrounds common in collectible photography
const LOCK_REQUIRED_MS = 700;

const FRAME_ASPECT: Record<FrameType, number> = {
  card: 3 / 4,
  book: 2 / 3,
  jewelry: 1,
  art: 4 / 3,
};

const FRAME_LABELS: Record<FrameType, string> = {
  card: "Card",
  book: "Book",
  jewelry: "Jewelry",
  art: "Art",
};

const UNIVERSES: UniverseKey[] = [
  "TCG",
  "SPORTS",
  "POP_CULTURE",
  "MUSIC",
  "GAMES",
  "JEWELRY_APPAREL",
  "MISC",
];

function categoryCode(label: string) {
  return (
    label
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "COLLECTORS_CHOICE"
  );
}

function computeBlurScore(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !video.videoWidth || !video.videoHeight) return 0;

  const width = 160;
  const height = Math.max(90, Math.round(width * (video.videoHeight / video.videoWidth)));
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(video, 0, 0, width, height);

  const { data } = ctx.getImageData(0, 0, width, height);
  const gray = new Float32Array(width * height);

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const idx = y * width + x;
      const lap =
        -gray[idx - width - 1] -
        gray[idx - width] -
        gray[idx - width + 1] -
        gray[idx - 1] +
        8 * gray[idx] -
        gray[idx + 1] -
        gray[idx + width - 1] -
        gray[idx + width] -
        gray[idx + width + 1];
      sum += lap;
      sumSq += lap * lap;
      count += 1;
    }
  }

  const mean = count > 0 ? sum / count : 0;
  const variance = count > 0 ? sumSq / count - mean * mean : 0;
  return Math.sqrt(Math.max(variance, 0));
}

async function captureFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !video.videoWidth || !video.videoHeight) return null;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.88);
  });
}

function Pill({
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
      className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition"
      style={{
        background: active ? "rgba(245,181,72,0.18)" : "rgba(255,255,255,0.06)",
        border: active ? "1px solid rgba(245,181,72,0.58)" : "1px solid rgba(255,255,255,0.12)",
        color: active ? "#F5B548" : "rgba(255,255,255,0.52)",
      }}
    >
      {label}
    </button>
  );
}

function FrameOverlay({
  frameType,
  lockProgress,
}: {
  frameType: FrameType;
  lockProgress: number;
}) {
  const aspect = FRAME_ASPECT[frameType];
  const color = `rgba(245,181,72,${0.2 + lockProgress * 0.8})`;
  const size = 18 + lockProgress * 8;
  const borderWidth = 2 + lockProgress;
  const glow =
    lockProgress > 0.55
      ? `0 0 ${Math.round(lockProgress * 20)}px rgba(245,181,72,${lockProgress * 0.42})`
      : "none";

  function cornerStyle(position: "tl" | "tr" | "bl" | "br"): CSSProperties {
    const top = position.includes("t");
    const left = position.includes("l");
    return {
      position: "absolute",
      [top ? "top" : "bottom"]: 0,
      [left ? "left" : "right"]: 0,
      width: size,
      height: size,
      borderTop: top ? `${borderWidth}px solid ${color}` : undefined,
      borderBottom: !top ? `${borderWidth}px solid ${color}` : undefined,
      borderLeft: left ? `${borderWidth}px solid ${color}` : undefined,
      borderRight: !left ? `${borderWidth}px solid ${color}` : undefined,
      borderRadius: top && left ? "4px 0 0 0" : top ? "0 4px 0 0" : left ? "0 0 0 4px" : "0 0 4px 0",
      boxShadow: glow,
      transition: "all 140ms ease-out",
    };
  }

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div
        className="relative"
        style={{
          width: aspect >= 1 ? "78vw" : `min(${Math.round(aspect * 76)}vh, 78vw)`,
          maxWidth: "84vw",
          height: aspect >= 1 ? `min(${Math.round(78 / aspect)}vw, 62vh)` : "76vh",
          maxHeight: "78%",
        }}
      >
        <div style={cornerStyle("tl")} />
        <div style={cornerStyle("tr")} />
        <div style={cornerStyle("bl")} />
        <div style={cornerStyle("br")} />
        {lockProgress > 0.7 ? (
          <div
            className="absolute -inset-1 rounded-lg"
            style={{
              boxShadow: `0 0 0 1px rgba(245,181,72,${(lockProgress - 0.7) * 0.5}), inset 0 0 28px rgba(245,181,72,${(lockProgress - 0.7) * 0.12})`,
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

export default function ScanCapturePanel({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lockStartRef = useRef<number | null>(null);
  const frontBlobRef = useRef<Blob | null>(null);

  const [frameType, setFrameType] = useState<FrameType>("card");
  const [universe, setUniverse] = useState<UniverseKey>("TCG");
  const [categoryLabel, setCategoryLabel] = useState(getCategories("TCG")[0] ?? "Pokemon");
  const [quickMode, setQuickMode] = useState(false);
  const [lockProgress, setLockProgress] = useState(0);
  const [lockStatus, setLockStatus] = useState<LockStatus>("scanning");
  const [awaitingChoice, setAwaitingChoice] = useState(false);
  const [capturingBack, setCapturingBack] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>([]);
  const [reviewSession, setReviewSession] = useState<HaulSession | null>(null);

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        // { video: true } grabs the first available camera immediately.
        // Specifying facingMode forces Chrome to probe all input sources for
        // facing-mode metadata before settling — that's the 20-second stall on
        // desktop. Mobile browsers default to the rear camera regardless.
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        setLockStatus("scanning");
      }
    }

    void startCamera();

    return () => {
      active = false;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (awaitingChoice || lockStatus === "snapped") return;

    const timer = window.setInterval(() => {
      const video = videoRef.current;
      const canvas = analysisCanvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const score = computeBlurScore(video, canvas);
      if (score > BLUR_THRESHOLD) {
        if (!lockStartRef.current) lockStartRef.current = Date.now();
        const progress = Math.min((Date.now() - lockStartRef.current) / LOCK_REQUIRED_MS, 1);
        setLockProgress(progress);
        setLockStatus(progress >= 1 ? "locked" : "locking");
        if (progress >= 1) {
          window.clearInterval(timer);
          void handleAutoSnap();
        }
      } else {
        lockStartRef.current = null;
        setLockProgress(0);
        setLockStatus("scanning");
      }
    }, 80);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingChoice, lockStatus, capturingBack, quickMode, activeItemId]);

  useEffect(() => {
    return () => {
      capturedItems.forEach((item) => {
        URL.revokeObjectURL(item.frontObjectUrl);
        if (item.backObjectUrl) URL.revokeObjectURL(item.backObjectUrl);
      });
    };
  }, [capturedItems]);

  function resetScanner() {
    lockStartRef.current = null;
    setLockProgress(0);
    setLockStatus("scanning");
    setAwaitingChoice(false);
  }

  function addCapturedItem(frontBlob: Blob, backBlob?: Blob | null) {
    const id = activeItemId ?? newId();
    const item: CapturedItem = {
      id,
      universe,
      categoryLabel,
      frontBlob,
      backBlob: backBlob ?? undefined,
      frontObjectUrl: URL.createObjectURL(frontBlob),
      backObjectUrl: backBlob ? URL.createObjectURL(backBlob) : undefined,
    };
    setCapturedItems((prev) => [...prev, item]);
    setActiveItemId(null);
    frontBlobRef.current = null;
  }

  async function handleAutoSnap() {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return;

    const blob = await captureFrame(video, canvas);
    if (!blob) {
      resetScanner();
      return;
    }

    setLockStatus("snapped");
    setLockProgress(1);

    if (capturingBack && frontBlobRef.current) {
      addCapturedItem(frontBlobRef.current, blob);
      setCapturingBack(false);
      resetScanner();
      return;
    }

    if (quickMode) {
      addCapturedItem(blob, null);
      resetScanner();
      return;
    }

    frontBlobRef.current = blob;
    setActiveItemId(newId());
    setAwaitingChoice(true);
  }

  function handleBack() {
    if (!frontBlobRef.current) return;
    setCapturingBack(true);
    resetScanner();
  }

  function handleNext() {
    if (frontBlobRef.current) {
      addCapturedItem(frontBlobRef.current, null);
    }
    setCapturingBack(false);
    resetScanner();
  }

  async function capturedItemToVaultItem(item: CapturedItem, index: number): Promise<VaultItem> {
    const images: VaultImage[] = [];

    const frontBlob = await prepareImageBlob(item.frontBlob as File).catch(() => item.frontBlob);
    const frontKey = generateVaultImageKey(item.id, 0);
    await saveImageBlobToIndexedDb(frontBlob, frontKey);
    images.push({
      id: `${item.id}_img_0`,
      storageKey: frontKey,
      url: item.frontObjectUrl,
      order: 0,
      role: "primary",
    });

    if (item.backBlob) {
      const backBlob = await prepareImageBlob(item.backBlob as File).catch(() => item.backBlob as Blob);
      const backKey = generateVaultImageKey(item.id, 1);
      await saveImageBlobToIndexedDb(backBlob, backKey);
      images.push({
        id: `${item.id}_img_1`,
        storageKey: backKey,
        url: item.backObjectUrl,
        order: 1,
        role: "detail",
      });
    }

    return {
      id: item.id,
      title: `Untitled scan ${index + 1}`,
      universe: item.universe,
      category: categoryCode(item.categoryLabel),
      categoryLabel: item.categoryLabel,
      primaryImageKey: frontKey,
      imageFrontUrl: item.frontObjectUrl,
      imageFrontStoragePath: frontKey,
      images,
      createdAt: Date.now() + index,
      isNew: true,
      isPublic: false,
    };
  }

  async function handleDone() {
    if (capturedItems.length === 0) {
      onClose();
      return;
    }

    const items = await Promise.all(capturedItems.map(capturedItemToVaultItem));
    appendItems(items);
    items.forEach((item) => enqueueVaultItemSync(item.id));
    emitVaultUpdate();
    void processVaultSyncQueue();

    const session = createHaulSession();
    const nextSession: HaulSession = {
      ...session,
      items: items.map((item) => haulItemFromVaultItem(item)),
    };
    saveHaulSession(nextSession);
    setReviewSession(nextSession);
  }

  if (reviewSession) {
    return (
      <HaulReviewSheet
        session={reviewSession}
        onClose={() => setReviewSession(null)}
        onFinish={onClose}
      />
    );
  }

  const categories = getCategories(universe);

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 backdrop-blur-sm">
    <div className="flex w-full max-w-[540px] flex-col overflow-hidden rounded-t-[20px] bg-[#060c1a] text-white" style={{ maxHeight: "88dvh" }}>
      <canvas ref={analysisCanvasRef} className="hidden" />
      <canvas ref={captureCanvasRef} className="hidden" />

      <div className="flex shrink-0 items-center gap-1.5 border-b border-white/5 bg-[#060c1a]/95 px-3 py-3">
        {(Object.keys(FRAME_LABELS) as FrameType[]).map((key) => (
          <Pill
            key={key}
            label={FRAME_LABELS[key]}
            active={frameType === key}
            onClick={() => setFrameType(key)}
          />
        ))}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/60"
          aria-label="Close scanner"
        >
          x
        </button>
      </div>

      {/* Inline style caps height reliably — Tailwind JIT can silently drop
          CSS min() inside arbitrary-value brackets on some builds. */}
      <div
        className="relative w-full shrink-0 bg-[#040912]"
        style={{ height: "min(36dvh, 320px)", overflow: "hidden" }}
      >
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <FrameOverlay frameType={frameType} lockProgress={lockProgress} />

        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/38 px-3 py-1.5 ring-1 ring-white/10 backdrop-blur">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background:
                lockStatus === "snapped" || lockStatus === "locked"
                  ? "#F5B548"
                  : lockStatus === "locking"
                    ? `rgba(245,181,72,${0.35 + lockProgress * 0.65})`
                    : "rgba(255,255,255,0.35)",
              boxShadow: lockStatus === "locked" || lockStatus === "snapped" ? "0 0 12px rgba(245,181,72,0.7)" : "none",
            }}
          />
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/58">
            {lockStatus === "snapped" || lockStatus === "locked"
              ? "Locked"
              : lockStatus === "locking"
                ? "Locking..."
                : capturingBack
                  ? "Back shot"
                  : "Scanning"}
          </span>
        </div>
      </div>

      <div className="shrink-0 bg-[#0a0f1e] px-3 pb-2 pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBack}
            disabled={!awaitingChoice || quickMode}
            className="flex h-10 flex-1 items-center justify-center rounded-xl text-xs font-semibold ring-1 transition disabled:opacity-25"
            style={{
              background: awaitingChoice && !quickMode ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.05)",
              borderColor: awaitingChoice && !quickMode ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.1)",
              color: awaitingChoice && !quickMode ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)",
            }}
          >
            Back
          </button>
          <span className="text-[10px] font-bold text-white/24">OR</span>
          <button
            type="button"
            onClick={handleNext}
            disabled={!awaitingChoice}
            className="flex h-10 flex-1 items-center justify-center rounded-xl text-xs font-bold ring-1 transition disabled:opacity-30"
            style={{
              background: awaitingChoice ? "rgba(245,181,72,0.2)" : "rgba(255,255,255,0.05)",
              borderColor: awaitingChoice ? "rgba(245,181,72,0.65)" : "rgba(255,255,255,0.1)",
              color: awaitingChoice ? "#F5B548" : "rgba(255,255,255,0.45)",
              boxShadow: awaitingChoice ? "0 0 16px rgba(245,181,72,0.2)" : "none",
            }}
          >
            Next
          </button>
        </div>

        <label className="mt-2 flex cursor-pointer items-center gap-2 px-1 py-1 text-xs text-white/48">
          <input
            type="checkbox"
            checked={quickMode}
            onChange={(event) => setQuickMode(event.target.checked)}
            className="h-4 w-4 rounded accent-[color:var(--theme-gold)]"
          />
          Quick scan only
        </label>
      </div>

      <div className="shrink-0 border-t border-white/5 bg-[#0a0f1e] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/36">Universe</div>
        <div className="flex gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none]">
          {UNIVERSES.map((key) => (
            <Pill
              key={key}
              label={UNIVERSE_LABEL[key]}
              active={universe === key}
              onClick={() => {
                setUniverse(key);
                setCategoryLabel(getCategories(key)[0] ?? "Collectors Choice");
              }}
            />
          ))}
        </div>

        {categories.length ? (
          <>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/36">Category</div>
            <div className="flex gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none]">
              {categories.map((category) => (
                <Pill
                  key={category}
                  label={category}
                  active={categoryLabel === category}
                  onClick={() => setCategoryLabel(category)}
                />
              ))}
            </div>
          </>
        ) : null}

        <button
          type="button"
          onClick={() => void handleDone()}
          className="mt-1 flex h-11 w-full items-center justify-center rounded-xl text-sm font-bold ring-1 transition"
          style={{
            background: capturedItems.length ? "rgba(245,181,72,0.12)" : "rgba(255,255,255,0.06)",
            borderColor: capturedItems.length ? "rgba(245,181,72,0.34)" : "rgba(255,255,255,0.1)",
            color: capturedItems.length ? "rgba(255,255,255,0.86)" : "rgba(255,255,255,0.42)",
          }}
        >
          Done {capturedItems.length ? `(${capturedItems.length})` : ""}
        </button>
      </div>
    </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import ScanReviewSheet, { type StagedItem } from "@/components/ScanReviewSheet";
import { newId } from "@/lib/id";
import { emitVaultUpdate } from "@/lib/vaultEvents";
import { appendItems, type VaultImage, type VaultItem } from "@/lib/vaultModel";
import { enqueueVaultItemSync, processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import {
  generateVaultImageKey,
  prepareImageBlob,
  saveImageBlobToIndexedDb,
} from "@/lib/vaultImageStore";
import { getCategories, UNIVERSE_KEYS, UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";

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

const BLUR_THRESHOLD = 80;
const LOCK_REQUIRED_MS = 700;
const BULK_COOLDOWN_MS = 2200;

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

// Scan universes derived from taxonomy (BUILT_BOTANY excluded — scan AI not tuned for it)
const UNIVERSES = UNIVERSE_KEYS.filter((k) => k !== "BUILT_BOTANY");

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
  let sum = 0, sumSq = 0, count = 0;
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const idx = y * width + x;
      const lap =
        -gray[idx - width - 1] - gray[idx - width] - gray[idx - width + 1] -
        gray[idx - 1] + 8 * gray[idx] - gray[idx + 1] -
        gray[idx + width - 1] - gray[idx + width] - gray[idx + width + 1];
      sum += lap; sumSq += lap * lap; count += 1;
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

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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

function FrameOverlay({ frameType, lockProgress }: { frameType: FrameType; lockProgress: number }) {
  const aspect = FRAME_ASPECT[frameType];
  const isPortrait = aspect < 1;
  const color = `rgba(245,181,72,${0.2 + lockProgress * 0.8})`;
  const size = 18 + lockProgress * 8;
  const borderWidth = 2 + lockProgress;
  const glow = lockProgress > 0.55 ? `0 0 ${Math.round(lockProgress * 20)}px rgba(245,181,72,${lockProgress * 0.42})` : "none";

  function cornerStyle(position: "tl" | "tr" | "bl" | "br"): CSSProperties {
    const top = position.includes("t");
    const left = position.includes("l");
    return {
      position: "absolute",
      [top ? "top" : "bottom"]: 0,
      [left ? "left" : "right"]: 0,
      width: size, height: size,
      borderTop: top ? `${borderWidth}px solid ${color}` : undefined,
      borderBottom: !top ? `${borderWidth}px solid ${color}` : undefined,
      borderLeft: left ? `${borderWidth}px solid ${color}` : undefined,
      borderRight: !left ? `${borderWidth}px solid ${color}` : undefined,
      borderRadius: top && left ? "4px 0 0 0" : top ? "0 4px 0 0" : left ? "0 0 0 4px" : "0 0 4px 0",
      boxShadow: glow,
      transition: "all 140ms ease-out",
    };
  }

  const frameStyle: CSSProperties = isPortrait
    ? { aspectRatio: String(aspect), height: "82%", maxHeight: "88%", maxWidth: "88%", width: "auto" }
    : { aspectRatio: String(aspect), width: "82%", maxWidth: "88%", maxHeight: "88%", height: "auto" };

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="relative" style={frameStyle}>
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
  const cooldownUntilRef = useRef<number>(0);
  const captureCountRef = useRef<number>(0);

  const [frameType, setFrameType] = useState<FrameType>("card");
  const [universe, setUniverse] = useState<UniverseKey>("TCG");
  const [categoryLabel, setCategoryLabel] = useState(getCategories("TCG")[0] ?? "Pokemon");
  const [quickMode, setQuickMode] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkPaused, setBulkPaused] = useState(false);
  const [bulkConfirmCount, setBulkConfirmCount] = useState<number | null>(null);
  const [showBulkInfo, setShowBulkInfo] = useState(false);
  const [flashVisible, setFlashVisible] = useState(false);
  const [lockProgress, setLockProgress] = useState(0);
  const [lockStatus, setLockStatus] = useState<LockStatus>("scanning");
  const [awaitingChoice, setAwaitingChoice] = useState(false);
  const [capturingBack, setCapturingBack] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>([]);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch { setLockStatus("scanning"); }
    }
    void startCamera();
    return () => { active = false; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  useEffect(() => {
    if (awaitingChoice || lockStatus === "snapped" || bulkPaused) return;
    const timer = window.setInterval(() => {
      const video = videoRef.current;
      const canvas = analysisCanvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      if (Date.now() < cooldownUntilRef.current) return;
      const score = computeBlurScore(video, canvas);
      if (score > BLUR_THRESHOLD) {
        if (!lockStartRef.current) lockStartRef.current = Date.now();
        const progress = Math.min((Date.now() - lockStartRef.current) / LOCK_REQUIRED_MS, 1);
        setLockProgress(progress);
        setLockStatus(progress >= 1 ? "locked" : "locking");
        if (progress >= 1) { window.clearInterval(timer); void handleAutoSnap(); }
      } else {
        lockStartRef.current = null;
        setLockProgress(0);
        setLockStatus("scanning");
      }
    }, 80);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingChoice, lockStatus, capturingBack, quickMode, bulkMode, bulkPaused, activeItemId]);

  useEffect(() => {
    return () => {
      capturedItems.forEach((item) => {
        URL.revokeObjectURL(item.frontObjectUrl);
        if (item.backObjectUrl) URL.revokeObjectURL(item.backObjectUrl);
      });
    };
  }, [capturedItems]);

  function triggerFlash() {
    setFlashVisible(true);
    window.setTimeout(() => setFlashVisible(false), 350);
  }

  function resetScanner() {
    lockStartRef.current = null;
    setLockProgress(0);
    setLockStatus("scanning");
    setAwaitingChoice(false);
  }

  function addCapturedItem(frontBlob: Blob, backBlob?: Blob | null) {
    const id = activeItemId ?? newId();
    const item: CapturedItem = {
      id, universe, categoryLabel, frontBlob,
      backBlob: backBlob ?? undefined,
      frontObjectUrl: URL.createObjectURL(frontBlob),
      backObjectUrl: backBlob ? URL.createObjectURL(backBlob) : undefined,
    };
    captureCountRef.current += 1;
    setCapturedItems((prev) => [...prev, item]);
    setActiveItemId(null);
    frontBlobRef.current = null;
  }

  async function handleAutoSnap() {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas) return;
    const blob = await captureFrame(video, canvas);
    if (!blob) { resetScanner(); return; }

    triggerFlash();
    setLockStatus("snapped");
    setLockProgress(1);

    if (capturingBack && frontBlobRef.current) {
      addCapturedItem(frontBlobRef.current, blob);
      setCapturingBack(false);
      cooldownUntilRef.current = Date.now() + 1500;
      resetScanner();
      return;
    }

    if (quickMode || bulkMode) {
      addCapturedItem(blob, null);
      const count = captureCountRef.current;
      cooldownUntilRef.current = Date.now() + BULK_COOLDOWN_MS;
      setBulkConfirmCount(count);
      window.setTimeout(() => setBulkConfirmCount(null), BULK_COOLDOWN_MS - 300);
      resetScanner();
      return;
    }

    frontBlobRef.current = blob;
    setActiveItemId(newId());
    setAwaitingChoice(true);
  }

  function handleFrontSave() {
    if (frontBlobRef.current) addCapturedItem(frontBlobRef.current, null);
    cooldownUntilRef.current = Date.now() + 1500;
    setCapturingBack(false);
    resetScanner();
  }

  function handleBackSave() {
    if (!frontBlobRef.current) return;
    setCapturingBack(true);
    resetScanner();
  }

  function handleNextCard() {
    frontBlobRef.current = null;
    setActiveItemId(null);
    setCapturingBack(false);
    cooldownUntilRef.current = Date.now() + 1500;
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
      localOnly: true,
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
        localOnly: true,
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

  function handleDone() {
    if (capturedItems.length === 0) { onClose(); return; }
    setShowReview(true);
  }

  async function handleFinishReview(approvedIds: string[]) {
    const approved = capturedItems.filter((item) => approvedIds.includes(item.id));
    if (approved.length === 0) { onClose(); return; }
    const items = await Promise.all(approved.map((item, i) => capturedItemToVaultItem(item, i)));
    appendItems(items);
    items.forEach((item) => enqueueVaultItemSync(item.id));
    emitVaultUpdate();
    void processVaultSyncQueue();
    onClose();
  }

  if (showReview) {
    const staged: StagedItem[] = capturedItems.map((item) => ({
      id: item.id,
      frontObjectUrl: item.frontObjectUrl,
      backObjectUrl: item.backObjectUrl,
      categoryLabel: item.categoryLabel,
      universe: item.universe,
    }));
    return (
      <ScanReviewSheet
        items={staged}
        onClose={() => setShowReview(false)}
        onFinish={(approvedIds) => { void handleFinishReview(approvedIds); }}
      />
    );
  }

  const categories = getCategories(universe);
  const effectiveQuickMode = quickMode || bulkMode;

  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex w-full max-w-[540px] flex-col overflow-hidden rounded-t-[20px] bg-[#060c1a] text-white" style={{ maxHeight: "88dvh" }}>
        <canvas ref={analysisCanvasRef} className="hidden" />
        <canvas ref={captureCanvasRef} className="hidden" />

        {/* Header */}
        <div className="flex shrink-0 items-center gap-1.5 border-b border-white/5 bg-[#060c1a]/95 px-3 py-2.5">
          {(Object.keys(FRAME_LABELS) as FrameType[]).map((key) => (
            <Pill key={key} label={FRAME_LABELS[key]} active={frameType === key} onClick={() => setFrameType(key)} />
          ))}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/60"
            aria-label="Close scanner"
          >
            &#x2715;
          </button>
        </div>

        {/* Camera viewport */}
        <div className="relative w-full shrink-0 bg-[#040912]" style={{ height: "min(36dvh, 320px)", overflow: "hidden" }}>
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          <FrameOverlay frameType={frameType} lockProgress={lockProgress} />

          {/* Capture flash */}
          {flashVisible ? (
            <div className="pointer-events-none absolute inset-0" style={{ background: "rgba(255,255,255,0.45)" }} />
          ) : null}

          {/* Bulk capture confirmation banner */}
          {bulkConfirmCount !== null ? (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex items-center justify-center px-4">
              <div
                className="flex items-center gap-2 rounded-full px-4 py-2 backdrop-blur-sm"
                style={{ background: "rgba(0,0,0,0.75)", border: "1px solid rgba(74,222,128,0.4)" }}
              >
                <span className="text-sm font-bold" style={{ color: "#4ade80" }}>&#x2713;</span>
                <span className="text-xs font-semibold text-white">
                  Item {bulkConfirmCount} captured &mdash; move to next
                </span>
              </div>
            </div>
          ) : null}

          {/* Bulk paused banner */}
          {bulkMode && bulkPaused ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className="rounded-2xl px-5 py-3 text-center backdrop-blur-sm"
                style={{ background: "rgba(0,0,0,0.72)", border: "1px solid rgba(245,181,72,0.3)" }}
              >
                <div className="text-base font-bold text-[#F5B548]">Paused</div>
                <div className="mt-0.5 text-xs text-white/60">{capturedItems.length} captured so far</div>
              </div>
            </div>
          ) : null}

          {/* Lock status bar */}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/38 px-3 py-1.5 ring-1 ring-white/10 backdrop-blur">
            <span
              className="h-2 w-2 rounded-full transition-all"
              style={{
                background: lockStatus === "snapped" || lockStatus === "locked"
                  ? "#F5B548"
                  : lockStatus === "locking"
                    ? `rgba(245,181,72,${0.35 + lockProgress * 0.65})`
                    : "rgba(255,255,255,0.35)",
                boxShadow: lockStatus === "locked" || lockStatus === "snapped" ? "0 0 12px rgba(245,181,72,0.7)" : "none",
              }}
            />
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/58">
              {lockStatus === "snapped" || lockStatus === "locked" ? "Locked"
                : lockStatus === "locking" ? "Locking..."
                : capturingBack ? "Back shot"
                : bulkPaused ? "Paused"
                : "Scanning"}
            </span>
            {capturedItems.length > 0 ? (
              <span className="ml-1 rounded-full bg-[#F5B548]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#F5B548]">
                {capturedItems.length}
              </span>
            ) : null}
          </div>
        </div>

        {/* Action controls */}
        <div className="shrink-0 bg-[#0a0f1e] px-3 pb-2 pt-2.5">
          {/* 3 compact action pills */}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleFrontSave}
              disabled={!awaitingChoice || effectiveQuickMode}
              className="rounded-full px-4 py-2 text-xs font-semibold ring-1 transition disabled:opacity-25"
              style={{
                background: awaitingChoice && !effectiveQuickMode ? "rgba(245,181,72,0.14)" : "rgba(255,255,255,0.05)",
                borderColor: awaitingChoice && !effectiveQuickMode ? "rgba(245,181,72,0.55)" : "rgba(255,255,255,0.1)",
                color: awaitingChoice && !effectiveQuickMode ? "#F5B548" : "rgba(255,255,255,0.4)",
              }}
            >
              Front Save
            </button>
            <button
              type="button"
              onClick={handleBackSave}
              disabled={!awaitingChoice || effectiveQuickMode}
              className="rounded-full px-4 py-2 text-xs font-semibold ring-1 transition disabled:opacity-25"
              style={{
                background: awaitingChoice && !effectiveQuickMode ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.05)",
                borderColor: awaitingChoice && !effectiveQuickMode ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.1)",
                color: awaitingChoice && !effectiveQuickMode ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)",
              }}
            >
              Back Save
            </button>
            <button
              type="button"
              onClick={handleNextCard}
              disabled={!awaitingChoice}
              className="rounded-full px-4 py-2 text-xs font-semibold ring-1 transition disabled:opacity-25"
              style={{
                background: awaitingChoice ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)",
                borderColor: awaitingChoice ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.08)",
                color: awaitingChoice ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)",
              }}
            >
              Next Card
            </button>
          </div>

          {/* Quick scan + Bulk scan row */}
          <div className="mt-2 flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-white/50">
              <input
                type="checkbox"
                checked={effectiveQuickMode}
                onChange={(e) => { setQuickMode(e.target.checked); if (!e.target.checked) setBulkMode(false); }}
                className="h-3.5 w-3.5 rounded accent-[color:var(--theme-gold)]"
              />
              Quick scan only
            </label>

            <div className="relative ml-auto flex items-center gap-1.5">
              {showBulkInfo ? (
                <div
                  className="absolute bottom-full right-0 mb-2 w-56 rounded-[14px] bg-[#0d1525] p-3 text-[11px] text-white/70 ring-1 ring-white/10 shadow-xl"
                  onClick={() => setShowBulkInfo(false)}
                >
                  <div className="mb-1 font-semibold text-white/90">Bulk Scan</div>
                  Scans automatically. After each capture you have {Math.round(BULK_COOLDOWN_MS / 1000)} seconds to move to the next item before it snaps again. Use Pause to take a break.
                </div>
              ) : null}

              <button
                onClick={() => setShowBulkInfo((v) => !v)}
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white/40 ring-1 ring-white/15 transition hover:ring-white/30"
                aria-label="Bulk scan info"
              >
                i
              </button>

              {/* Pause button — only shown when bulk is active */}
              {bulkMode ? (
                <button
                  type="button"
                  onClick={() => setBulkPaused((v) => !v)}
                  className="rounded-full px-3 py-1 text-[11px] font-semibold ring-1 transition"
                  style={{
                    background: bulkPaused ? "rgba(245,181,72,0.16)" : "rgba(239,68,68,0.14)",
                    borderColor: bulkPaused ? "rgba(245,181,72,0.5)" : "rgba(239,68,68,0.4)",
                    color: bulkPaused ? "#F5B548" : "#f87171",
                  }}
                >
                  {bulkPaused ? "&#x25B6; Resume" : "&#x23F8; Pause"}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => { setBulkMode((v) => !v); if (!bulkMode) { setQuickMode(true); setBulkPaused(false); } else { setBulkPaused(false); } }}
                className="rounded-full px-3 py-1 text-[11px] font-semibold ring-1 transition"
                style={{
                  background: bulkMode ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.06)",
                  borderColor: bulkMode ? "rgba(34,197,94,0.55)" : "rgba(255,255,255,0.14)",
                  color: bulkMode ? "#4ade80" : "rgba(255,255,255,0.55)",
                  boxShadow: bulkMode ? "0 0 14px rgba(34,197,94,0.22)" : "none",
                }}
              >
                {bulkMode ? "Bulk Active" : "Start Bulk Scan"}
              </button>
            </div>
          </div>
        </div>

        {/* Universe / Category / Done */}
        <div className="shrink-0 border-t border-white/5 bg-[#0a0f1e] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/36">Universe</div>
          <div className="flex gap-1.5 overflow-x-auto pb-1.5 [scrollbar-width:none]">
            {UNIVERSES.map((key) => (
              <Pill
                key={key}
                label={UNIVERSE_LABEL[key]}
                active={universe === key}
                onClick={() => { setUniverse(key); setCategoryLabel(getCategories(key)[0] ?? "Collectors Choice"); }}
              />
            ))}
          </div>

          {categories.length ? (
            <>
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/36">Category</div>
              <div className="flex gap-1.5 overflow-x-auto pb-1.5 [scrollbar-width:none]">
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
            onClick={handleDone}
            className="mt-1 flex h-10 w-full items-center justify-center rounded-xl text-sm font-bold ring-1 transition"
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

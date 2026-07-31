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

type CapturedItem = {
  id: string;
  universe: UniverseKey;
  categoryLabel: string;
  frontBlob: Blob;
  frontObjectUrl: string;
};

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

// Scan universes derived from taxonomy (BUILT_BOTANY excluded — scan AI not tuned for it).
const UNIVERSES = UNIVERSE_KEYS.filter((k) => k !== "BUILT_BOTANY");

function categoryCode(label: string) {
  return (
    label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") ||
    "COLLECTORS_CHOICE"
  );
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

// ── Dropdown pill — title stays constant; the pick is highlighted in the menu ──
function DropdownPill({
  title,
  value,
  options,
  onSelect,
}: {
  title: string;
  value: string;
  options: { value: string; label: string }[];
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-semibold ring-1 transition"
        style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.85)" }}
      >
        {title}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-[1]" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full z-[2] mt-1 max-h-[52vh] w-[190px] overflow-y-auto rounded-[10px] p-1 ring-1"
            style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "0 12px 34px rgba(0,0,0,0.55)" }}
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs text-white/40">None available</div>
            ) : (
              options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onSelect(opt.value); setOpen(false); }}
                  className="block w-full truncate rounded-[7px] px-3 py-1.5 text-left text-xs font-semibold transition"
                  style={value === opt.value
                    ? { background: "rgba(96,165,250,0.18)", color: "#93c5fd" }
                    : { color: "rgba(255,255,255,0.72)" }}
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

// ── Frame overlay — light-blue corners, brighter while capturing ──
function FrameOverlay({ frameType, capturing }: { frameType: FrameType; capturing: boolean }) {
  const aspect = FRAME_ASPECT[frameType];
  const isPortrait = aspect < 1;
  const color = capturing ? "rgba(96,175,255,1)" : "rgba(74,155,255,0.98)";
  const size = capturing ? 30 : 26;
  const borderWidth = capturing ? 4 : 3.5;
  const glow = capturing ? "0 0 18px rgba(74,155,255,0.8)" : "0 0 12px rgba(74,155,255,0.5)";

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
      transition: "all 120ms ease-out",
    };
  }

  const frameStyle: CSSProperties = isPortrait
    ? { aspectRatio: String(aspect), height: "82%", maxHeight: "92%", maxWidth: "92%", width: "auto" }
    : { aspectRatio: String(aspect), width: "82%", maxWidth: "92%", maxHeight: "92%", height: "auto" };

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="relative" style={{ ...frameStyle, filter: "drop-shadow(0 0 2.5px rgba(0,0,0,0.8))" }}>
        <div style={cornerStyle("tl")} />
        <div style={cornerStyle("tr")} />
        <div style={cornerStyle("bl")} />
        <div style={cornerStyle("br")} />
      </div>
    </div>
  );
}

export default function ScanCapturePanel({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [frameType, setFrameType] = useState<FrameType>("card");
  const [universe, setUniverse] = useState<UniverseKey>("TCG");
  const [categoryLabel, setCategoryLabel] = useState(getCategories("TCG")[0] ?? "Pokemon");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [flashVisible, setFlashVisible] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>([]);
  const [showReview, setShowReview] = useState(false);
  // Removals live here (not in the review sheet) so they persist when it's closed/reopened.
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  // Start / restart the camera (rear by default; a chosen deviceId when picked).
  useEffect(() => {
    let active = true;
    async function start() {
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        const constraints: MediaStreamConstraints = selectedDeviceId
          ? { video: { deviceId: { exact: selectedDeviceId } }, audio: false }
          : { video: { facingMode: { ideal: "environment" } }, audio: false };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        // Camera labels are only available after permission is granted.
        const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
        if (active) setDevices(list);
      } catch {
        /* camera unavailable — user can still Finish/close */
      }
    }
    void start();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [selectedDeviceId]);

  // Revoke object URLs on unmount.
  const capturedItemsRef = useRef(capturedItems);
  capturedItemsRef.current = capturedItems;
  useEffect(() => {
    return () => {
      capturedItemsRef.current.forEach((item) => URL.revokeObjectURL(item.frontObjectUrl));
    };
  }, []);

  async function handleCapture() {
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    setCapturing(true);
    const blob = await captureFrame(video, canvas);
    if (blob) {
      const item: CapturedItem = {
        id: newId(),
        universe,
        categoryLabel,
        frontBlob: blob,
        frontObjectUrl: URL.createObjectURL(blob),
      };
      setCapturedItems((prev) => [...prev, item]);
      // Soft ghost-green "got it" flash.
      setFlashVisible(true);
      window.setTimeout(() => setFlashVisible(false), 220);
    }
    window.setTimeout(() => setCapturing(false), 160);
  }

  async function capturedItemToVaultItem(item: CapturedItem, index: number): Promise<VaultItem> {
    const frontBlob = await prepareImageBlob(item.frontBlob as File).catch(() => item.frontBlob);
    const frontKey = generateVaultImageKey(item.id, 0);
    await saveImageBlobToIndexedDb(frontBlob, frontKey);
    const images: VaultImage[] = [
      {
        id: `${item.id}_img_0`,
        storageKey: frontKey,
        url: item.frontObjectUrl,
        order: 0,
        localOnly: true,
        role: "primary",
      },
    ];
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

  function handleFinished() {
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

  const lastThumb = capturedItems.length ? capturedItems[capturedItems.length - 1].frontObjectUrl : null;
  const cameraOptions = devices.map((d, i) => ({ value: d.deviceId, label: d.label || `Camera ${i + 1}` }));
  const staged: StagedItem[] = capturedItems.map((item) => ({
    id: item.id,
    frontObjectUrl: item.frontObjectUrl,
    backObjectUrl: undefined,
    categoryLabel: item.categoryLabel,
    universe: item.universe,
  }));

  return (
    <>
    <div className="fixed inset-0 z-[100000] flex items-start justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex w-full max-w-[540px] flex-col overflow-hidden bg-[color:var(--bg)] text-[color:var(--fg)]" style={{ height: "calc(100dvh - var(--bottomnav-h, 86px))" }}>
        <canvas ref={captureCanvasRef} className="hidden" />

        {/* Header — Universe · Frame · Camera dropdown pills + Finished + close */}
        <div className="flex shrink-0 items-center gap-1.5 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5">
          <DropdownPill
            title="Universe"
            value={universe}
            options={UNIVERSES.map((k) => ({ value: k, label: UNIVERSE_LABEL[k] }))}
            onSelect={(v) => {
              setUniverse(v as UniverseKey);
              setCategoryLabel(getCategories(v as UniverseKey)[0] ?? "Collectors Choice");
            }}
          />
          <DropdownPill
            title="Frame"
            value={frameType}
            options={(Object.keys(FRAME_LABELS) as FrameType[]).map((k) => ({ value: k, label: FRAME_LABELS[k] }))}
            onSelect={(v) => setFrameType(v as FrameType)}
          />
          <DropdownPill
            title="Camera"
            value={selectedDeviceId}
            options={cameraOptions}
            onSelect={(v) => setSelectedDeviceId(v)}
          />
          <button
            type="button"
            onClick={handleFinished}
            className="ml-auto shrink-0 rounded-md px-3.5 py-1.5 text-xs font-bold transition active:scale-95"
            style={{
              background: "linear-gradient(145deg, #EDEFF1 0%, #C8CDD2 30%, #A8AEB4 60%, #8C9298 100%)",
              color: "#171717",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 6px rgba(0,0,0,0.35)",
              opacity: capturedItems.length ? 1 : 0.55,
            }}
          >
            Finished{capturedItems.length ? ` (${capturedItems.length})` : ""}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-white/60"
            aria-label="Close scanner"
          >
            &#x2715;
          </button>
        </div>

        {/* Camera viewport */}
        <div className="relative w-full flex-1 bg-[color:var(--bg)]" style={{ overflow: "hidden" }}>
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          <FrameOverlay frameType={frameType} capturing={capturing} />

          {/* Ghost counter — top-left */}
          <div
            className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full text-sm font-black backdrop-blur"
            style={{ background: "rgba(0,0,0,0.42)", color: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.25)" }}
          >
            {capturedItems.length}
          </div>

          {/* Ghost-green capture flash */}
          {flashVisible ? (
            <div className="pointer-events-none absolute inset-0" style={{ background: "rgba(74,222,128,0.32)" }} />
          ) : null}
        </div>

        {/* Bottom bar — shutter + last-shot thumbnail */}
        <div className="shrink-0 bg-[color:var(--surface)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="relative flex items-center justify-center">
            <button
              type="button"
              onClick={() => void handleCapture()}
              aria-label="Take picture"
              className="flex items-center justify-center rounded-full transition-transform active:scale-95"
              style={{
                width: 68,
                height: 68,
                background: "linear-gradient(145deg, #EDEFF1 0%, #C8CDD2 30%, #A8AEB4 60%, #8C9298 100%)",
                boxShadow: "0 0 0 3px #0B0B0B, 0 0 0 4px rgba(203,208,213,0.30), 0 8px 24px rgba(0,0,0,0.5)",
              }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="#1A0F00" strokeWidth="1.6" strokeLinejoin="round" fill="rgba(26,15,0,0.12)" />
                <circle cx="12" cy="13" r="4" stroke="#1A0F00" strokeWidth="1.6" />
              </svg>
            </button>

            {/* Last shot — tap to review captures (retake decisions) */}
            <button
              type="button"
              onClick={() => { if (capturedItems.length) setShowReview(true); }}
              disabled={!capturedItems.length}
              aria-label="Review captured items"
              className="absolute left-2 flex flex-col items-center gap-0.5 transition active:scale-95 disabled:opacity-50"
            >
              <div className="h-12 w-12 overflow-hidden rounded-[10px] ring-1 ring-white/25" style={{ background: "rgba(255,255,255,0.05)" }}>
                {lastThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={lastThumb} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <span className="text-[9px] font-semibold text-white/55">{capturedItems.length ? "Review" : "Last"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    {showReview ? (
      <ScanReviewSheet
        items={staged}
        removed={removed}
        onRemove={(id) => setRemoved((p) => new Set([...p, id]))}
        onUndo={(id) => setRemoved((p) => { const n = new Set(p); n.delete(id); return n; })}
        onClose={() => setShowReview(false)}
        onFinish={(approvedIds) => { void handleFinishReview(approvedIds); }}
      />
    ) : null}
    </>
  );
}

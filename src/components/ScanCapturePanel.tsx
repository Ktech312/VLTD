"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { DropdownPill } from "@/components/ui/DropdownPill";
import { Glyph } from "@/components/ui/Glyph";
import ScanReviewSheet, { type StagedItem } from "@/components/ScanReviewSheet";
import ScanVerifySheet, { type ScanDraft } from "@/components/ScanVerifySheet";
import { startOnDemandScan } from "@/lib/scanners/onDemandBarcodeScan";
import { warmupZXingWasm } from "@/lib/scanners/zxingWasmSetup";
import { lookupByBarcodeOnly, type BarcodeLookupResult } from "@/lib/scanners/barcodeLookup";
import type { LiveBarcodeResult } from "@/lib/scanners/liveBarcodeReader";
import { newId } from "@/lib/id";
import { emitVaultUpdate } from "@/lib/vaultEvents";
import { appendItems, type VaultImage, type VaultItem } from "@/lib/vaultModel";
import { enqueueVaultItemSync, processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import {
  generateVaultImageKey,
  prepareImageBlob,
  saveImageBlobToIndexedDb,
} from "@/lib/vaultImageStore";
import { analyzeImageWithVision, type VisionAnalysisResult } from "@/lib/ai/openaiVision";
import { matchVisionCategory, matchVisionSubcategory, matchVisionUniverse } from "@/lib/visionTaxonomy";
import { getStoredActiveProfileId } from "@/lib/auth";
import { getBulkScanStatus, consumeBulkScans } from "@/lib/bulkScanQuota";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useCameraZoom } from "@/hooks/useCameraZoom";
import {
  getCategories,
  getDefaultCategory,
  isUniverseKey,
  UNIVERSE_KEYS,
  UNIVERSE_LABEL,
  type UniverseKey,
} from "@/lib/taxonomy";

type FrameType = "card" | "book" | "jewelry" | "art";

type CapturedItem = {
  id: string;
  universe: UniverseKey;
  categoryLabel: string;
  frontBlob: Blob;
  frontObjectUrl: string;
  skipAi?: boolean;
  /** Free barcode-only lookup (comic/vinyl/UPC/book), attached the instant a
   *  scan reads a code -- before this shot is even taken. "looking" means
   *  the lookup for the barcode this item was captured under is still in
   *  flight; it resolves to "found"/barcodeMatch or "none" shortly after. */
  barcodeLookupState?: "looking" | "found" | "none";
  barcodeMatch?: BarcodeLookupResult | null;
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

// Remembers the last Universe picked here (mirrors CAMERA_PREF_KEY below). A
// hardcoded default was a real footgun: leaving it on a stale Universe from a
// prior session silently mis-hints the AI ("the collector says this is X") and
// nothing catches the mismatch when the AI just goes along with a wrong hint.
const SCAN_UNIVERSE_PREF_KEY = "vltd_scan_universe_v1";

function readStoredScanUniverse(): UniverseKey | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(SCAN_UNIVERSE_PREF_KEY);
  return stored && isUniverseKey(stored) && (UNIVERSES as string[]).includes(stored)
    ? (stored as UniverseKey)
    : null;
}

// Guard the AI call so a stalled network can't freeze the scanning overlay forever;
// a timeout just leaves that item blank for manual entry.
const AI_SCAN_TIMEOUT_MS = 60000;
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("AI scan timed out")), ms)),
  ]);
}

function categoryCode(label: string) {
  return (
    label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") ||
    "COLLECTORS_CHOICE"
  );
}

// Parse a money string that may include $ / commas (curator-typed or AI value).
function parseValue(input: string): number | undefined {
  const cleaned = input.replace(/[^0-9.]/g, "").trim();
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : undefined;
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
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopBarcodeScanRef = useRef<(() => void) | null>(null);
  const [liveBarcode, setLiveBarcode] = useState<LiveBarcodeResult | null>(null);
  // Free barcode-only lookup, kicked off the instant a scan reads a code --
  // before the shot is even taken. Consumed by the NEXT handleCapture() (the
  // natural "scan then shoot" order) and cleared either way so a stale
  // lookup never attaches itself to an unrelated later capture.
  const pendingBarcodeLookupRef = useRef<Promise<BarcodeLookupResult | null> | null>(null);
  // On-demand scan session — off by default, only runs for a bounded burst
  // after a tap on the Scan button (see onDemandBarcodeScan.ts for why).
  const [scanState, setScanState] = useState<"idle" | "scanning" | "timeout">("idle");
  // Start fetching/compiling the scan decoder's wasm binary as soon as this
  // panel mounts, not on the first Scan tap -- so tapping Scan later doesn't
  // eat a cold-load delay on top of the burst itself.
  useEffect(() => { warmupZXingWasm(); }, []);
  // On-screen diagnostic (engine + attempt count + elapsed) -- so a real-
  // device report of "nothing happened" can be told apart from "it ran the
  // whole burst and genuinely found nothing," without needing devtools on a
  // phone. Kept after the burst ends so the timeout message can show it.
  const [scanDiagnostic, setScanDiagnostic] = useState<{ engine: string; attempts: number; elapsedMs: number } | null>(null);

  const [frameType, setFrameType] = useState<FrameType>("card");
  const [universe, setUniverse] = useState<UniverseKey>(() => readStoredScanUniverse() ?? "TCG");
  const [categoryLabel, setCategoryLabel] = useState(() => getCategories(readStoredScanUniverse() ?? "TCG")[0] ?? "Pokemon");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [flashVisible, setFlashVisible] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [capturedItems, setCapturedItems] = useState<CapturedItem[]>([]);
  const [showReview, setShowReview] = useState(false);
  // Removals live here (not in the review sheet) so they persist when it's closed/reopened.
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  // ── Finish → metered AI fill → verify page → save ──
  const [flowPhase, setFlowPhase] = useState<"capture" | "scanning" | "verify">("capture");
  const [drafts, setDrafts] = useState<ScanDraft[]>([]);
  const [profileId, setProfileId] = useState("");
  const [scanRemaining, setScanRemaining] = useState<number | null>(null);
  const [scanLimit, setScanLimit] = useState<number | null>(null);
  const [scanDone, setScanDone] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState("");
  // Only signed-in curators are metered; anonymous/local use isn't charged.
  const metered = Boolean(profileId);

  // Warn before leaving (bottom nav, back button, refresh) once there's work at
  // risk — captured photos or drafts that haven't been saved to the Vault yet.
  const hasWorkInProgress = capturedItems.length > 0 || drafts.length > 0;
  useUnsavedChangesGuard(
    hasWorkInProgress,
    "Leave Quick Add? Your captured items haven't been saved to your Vault yet."
  );

  // Load the curator's remaining AI scans (per-plan quota) for the ticker + gating.
  useEffect(() => {
    const pid = getStoredActiveProfileId();
    setProfileId(pid);
    if (!pid) return;
    void (async () => {
      const s = await getBulkScanStatus(pid);
      if (s) {
        setScanRemaining(s.remaining);
        setScanLimit(s.scanLimit);
      }
    })();
  }, []);

  // Live zoom on the camera view itself (before capture) -- feature-detected,
  // only real on hardware/browsers that expose it (see the hook's own notes).
  const cameraZoom = useCameraZoom();
  const attachZoom = cameraZoom.attach;
  const resetZoom = cameraZoom.reset;

  // Start / restart the camera (rear by default; a chosen deviceId when picked).
  useEffect(() => {
    let active = true;
    async function start() {
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        // width ideal:1280 matches CameraCapturePanel.tsx's own already-
        // settled figure (see that file's comment -- two earlier rounds of
        // pushing higher didn't measurably help sharpness and made capture
        // slower) rather than leaving this panel with no constraint at all.
        const constraints: MediaStreamConstraints = selectedDeviceId
          ? { video: { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 } }, audio: false }
          : { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        attachZoom(stream.getVideoTracks()[0] ?? null);
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
      stopBarcodeScanRef.current?.();
      stopBarcodeScanRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      resetZoom();
    };
  }, [selectedDeviceId, attachZoom, resetZoom]);

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
      const id = newId();
      // Inherit whatever scan happened just before this shot (the natural
      // "aim, scan, shoot" order) -- then clear it so a later, unrelated
      // capture never accidentally inherits a stale result.
      const pendingLookup = pendingBarcodeLookupRef.current;
      pendingBarcodeLookupRef.current = null;
      const item: CapturedItem = {
        id,
        universe,
        categoryLabel,
        frontBlob: blob,
        frontObjectUrl: URL.createObjectURL(blob),
        barcodeLookupState: pendingLookup ? "looking" : undefined,
      };
      setCapturedItems((prev) => [...prev, item]);
      // Soft ghost-green "got it" flash.
      setFlashVisible(true);
      window.setTimeout(() => setFlashVisible(false), 220);
      // Next item starts fresh — don't keep showing this one's code.
      setLiveBarcode(null);

      if (pendingLookup) {
        void pendingLookup.then((match) => {
          setCapturedItems((prev) =>
            prev.map((c) =>
              c.id === id ? { ...c, barcodeLookupState: match ? "found" : "none", barcodeMatch: match } : c
            )
          );
        });
      }
    }
    window.setTimeout(() => setCapturing(false), 160);
  }

  // Barcode/QR scanning is on-demand only (tap the Scan button), never
  // running the whole time the camera is open — see onDemandBarcodeScan.ts
  // for why (the old always-on JS loop overheated the phone and never
  // reliably read a code). Where the browser supports it (Chrome/Android),
  // the native BarcodeDetector API does the work instead, at near-zero cost.
  function toggleScan() {
    if (scanState === "scanning") {
      stopBarcodeScanRef.current?.();
      stopBarcodeScanRef.current = null;
      setScanState("idle");
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    setScanState("scanning");
    setScanDiagnostic(null);
    stopBarcodeScanRef.current = startOnDemandScan(video, {
      durationMs: 8000,
      onResult: (result) => {
        setLiveBarcode(result);
        setScanState("idle");
        stopBarcodeScanRef.current = null;
        try { navigator.vibrate?.(60); } catch { /* ignore */ }
        // Kick off the free lookup right away -- don't wait for the shutter.
        // Whichever item gets captured next inherits this result (see
        // handleCapture); a fresh scan overwrites this ref before that.
        pendingBarcodeLookupRef.current = lookupByBarcodeOnly(result).catch(() => null);
      },
      onDiagnostic: (d) => setScanDiagnostic(d),
      onTimeout: () => {
        stopBarcodeScanRef.current = null;
        setScanState("timeout");
      },
    });
  }

  // "No code found" deliberately stays on screen until the next Scan tap
  // (which resets it) -- an earlier 2.5s auto-clear made the message
  // disappear before it could even be read on a phone, let alone
  // screenshotted. No timer needed: tapping Scan again already sets
  // scanState back to "scanning" itself.

  async function draftToVaultItem(draft: ScanDraft, index: number): Promise<VaultItem> {
    const source = capturedItems.find((c) => c.id === draft.id);
    const rawBlob = source?.frontBlob ?? new Blob();
    const frontBlob = await prepareImageBlob(rawBlob as File).catch(() => rawBlob);
    const frontKey = generateVaultImageKey(draft.id, 0);
    await saveImageBlobToIndexedDb(frontBlob, frontKey);
    const images: VaultImage[] = [
      {
        id: `${draft.id}_img_0`,
        storageKey: frontKey,
        url: draft.frontObjectUrl,
        order: 0,
        localOnly: true,
        role: "primary",
      },
    ];
    const categoryLabel = draft.categoryLabel || source?.categoryLabel || "";
    const v = draft.vision;
    return {
      id: draft.id,
      title: draft.title.trim() || "Untitled Item",
      universe: draft.universe,
      category: categoryLabel ? categoryCode(categoryLabel) : undefined,
      categoryLabel: categoryLabel || undefined,
      subcategoryLabel: draft.subcategoryLabel || undefined,
      purchasePrice: parseValue(draft.purchasePrice),
      currentValue: parseValue(draft.currentValue),
      status: "COLLECTION",
      // AI-detected details, carried through so the item page is populated like a normal scan.
      subtitle: v?.subtitle || undefined,
      number: v?.number || undefined,
      year: v?.year || undefined,
      grade: v?.grade || undefined,
      condition: v?.condition || undefined,
      conditionReason: v?.conditionReason || undefined,
      certNumber: v?.certNumber || undefined,
      notes: v?.description || undefined,
      primaryImageKey: frontKey,
      imageFrontUrl: draft.frontObjectUrl,
      imageFrontStoragePath: frontKey,
      images,
      createdAt: Date.now() + index,
      isNew: true,
      isPublic: false,
      conditionSource: draft.scanned ? "ai" : undefined,
    };
  }

  // Fully release the camera. Called once the batch is committed to scanning —
  // there's no path back to the live camera after that, so it shouldn't keep running.
  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    cameraZoom.reset();
  }

  function handleFinished() {
    if (capturedItems.length === 0) { onClose(); return; }
    setShowReview(true);
  }

  // Map an AI result onto a draft. The curator's chosen Universe wins; category/
  // subcategory are matched within it (and, like the normal Add flow, the game/type
  // the AI reports as "category" is matched into the Subcategory — e.g. TCG has one
  // category, and Pokemon/Magic/etc. are subcategories). If AI clearly detects a
  // different Universe, we flag it instead of silently discarding the mismatch.
  function visionToDraftPatch(
    vision: VisionAnalysisResult,
    u: UniverseKey,
    existingCategory: string
  ): Partial<ScanDraft> {
    const validCats = getCategories(u);
    const aiCategoryText = vision.categoryLabel || vision.category || "";

    // Category: valid AI match → keep curator's current pick → the universe default.
    let categoryLabel = matchVisionCategory(u, aiCategoryText);
    if (!categoryLabel) categoryLabel = validCats.includes(existingCategory) ? existingCategory : "";
    if (!categoryLabel) categoryLabel = getDefaultCategory(u);

    // Subcategory: try the AI subcategory, then fall back to the AI category/title
    // text (that's where the specific game/type usually lands).
    const subcategoryLabel =
      matchVisionSubcategory(u, categoryLabel, vision.subcategoryLabel || "") ||
      matchVisionSubcategory(u, categoryLabel, aiCategoryText) ||
      matchVisionSubcategory(u, categoryLabel, vision.title || "");

    const detected = matchVisionUniverse(vision.universe);
    const aiUniverse = detected && detected !== u ? detected : undefined;

    return {
      title: vision.title || "",
      categoryLabel,
      subcategoryLabel,
      currentValue: vision.estimatedValue ? String(vision.estimatedValue) : "",
      scanned: true,
      confidence: vision.confidence ?? 0,
      aiUniverse,
      vision,
    };
  }

  // Synthesizes a VisionAnalysisResult-shaped object from a free barcode
  // lookup so it can flow through the exact same visionToDraftPatch()
  // taxonomy-matching logic the AI path uses -- one merge path, not two
  // subtly different ones. confidence 0.9 marks it as a confirmed database
  // match, not a guess.
  function barcodeMatchToVision(match: BarcodeLookupResult): VisionAnalysisResult {
    return {
      title: match.fields.title || "",
      subtitle: match.fields.subtitle || "",
      category: match.fields.category || "",
      universe: match.fields.universe || "",
      year: match.fields.comicCoverDate || "",
      brand: match.fields.comicPublisher || match.fields.vinylLabel || "",
      grade: "",
      certNumber: "",
      condition: "",
      conditionReason: "",
      conditionConfidence: 0,
      description: match.fields.notes || match.summary || "",
      confidence: 0.9,
      barcode: "",
      number: match.fields.number || "",
      categoryLabel: match.fields.categoryLabel || "",
      subcategoryLabel: match.fields.subcategoryLabel || "",
    };
  }

  // Finish/Add commits the batch: build a draft per kept capture, AI-scan them all
  // (metered), then verify. Once this runs the group is locked — no going back to
  // the camera to append; the curator starts a new group instead.
  async function handleFinishReview(approvedIds: string[]) {
    const approvedSet = new Set(approvedIds);
    const initial: ScanDraft[] = capturedItems
      .filter((item) => approvedSet.has(item.id))
      .map((item) => {
        const base: ScanDraft = {
          id: item.id,
          frontObjectUrl: item.frontObjectUrl,
          title: "",
          universe: item.universe,
          categoryLabel: item.categoryLabel || "",
          subcategoryLabel: "",
          purchasePrice: "",
          currentValue: "",
          scanned: false,
          confidence: 0,
        };
        // A confirmed barcode match (comic/vinyl/UPC/book) already answered
        // what AI vision would have guessed at -- pre-fill from it and skip
        // the metered AI call for this item entirely (see runAiScan below).
        // Free, already-fetched, more precise data wins over spending a scan.
        if (item.barcodeLookupState === "found" && item.barcodeMatch) {
          return { ...base, ...visionToDraftPatch(barcodeMatchToVision(item.barcodeMatch), item.universe, item.categoryLabel) };
        }
        return base;
      });

    if (initial.length === 0) { onClose(); return; }

    // Committed to this batch — release the camera (no return to live view after this).
    stopCamera();
    setDrafts(initial);
    setShowReview(false);
    setVerifyStatus("");
    setFlowPhase("scanning");
    await runAiScan(initial);
    setFlowPhase("verify");
  }

  async function runAiScan(list: ScanDraft[]) {
    setScanTotal(list.length);
    setScanDone(0);
    let localRemaining: number | null = scanRemaining;

    for (let i = 0; i < list.length; i += 1) {
      setScanDone(i);
      const draft = list[i];
      const source = capturedItems.find((c) => c.id === draft.id);
      if (!source) continue;

      // Curator already knows AI won't get this one — skip the call entirely,
      // no scan spent, leave it blank for manual entry.
      if (source.skipAi) continue;

      // Already confidently identified via a free barcode lookup (comic/
      // vinyl/UPC/book) when this item was captured -- no need to also
      // spend a metered AI scan confirming what a real database already
      // answered. draft.scanned is set by handleFinishReview's barcode
      // pre-fill above, distinct from source.skipAi (curator's own choice).
      if (draft.scanned) continue;

      // Only stop early when we KNOW the cycle is spent; if the quota hasn't
      // loaded yet (null), let the server's atomic consume decide.
      if (metered && localRemaining !== null && localRemaining <= 0) {
        setVerifyStatus("You've used all your AI scans for this cycle — fill the rest in by hand.");
        break;
      }

      try {
        const file = new File([source.frontBlob], `${draft.id}.jpg`, { type: "image/jpeg" });
        // Pass the Universe as a soft HINT, not the formal `universe` param: the API
      // treats `universe` as "pre-classified" and then refuses to return category/
      // subcategory. As a hint, the AI still returns the full classification (incl.
      // subcategory), which we then match within the curator's chosen Universe.
      const vision = await withTimeout(
        analyzeImageWithVision(file, {
          hints: `The collector has "${UNIVERSE_LABEL[draft.universe]}" selected for this batch, but batches can contain mixed items -- trust what you actually see in the photo over that selection. If the item clearly is NOT ${UNIVERSE_LABEL[draft.universe]} (e.g. it's a comic book, a different card game, etc.), report the universe you actually observe instead of forcing it into ${UNIVERSE_LABEL[draft.universe]}. Identify the specific game/set/franchise and include category and subcategory.`,
        }),
        AI_SCAN_TIMEOUT_MS
      );

        // Only charge the quota when a scan actually produced a result.
        if (metered) {
          const res = await consumeBulkScans(profileId, 1);
          if (res) {
            localRemaining = res.remaining;
            setScanRemaining(res.remaining);
            if (res.granted === 0) {
              setVerifyStatus("You've used all your AI scans for this cycle — fill the rest in by hand.");
              break;
            }
          }
        }

        const patch = visionToDraftPatch(vision, draft.universe, draft.categoryLabel);
        setDrafts((prev) => prev.map((d) => (d.id === draft.id ? { ...d, ...patch } : d)));
      } catch {
        // Leave this draft blank for manual entry.
      }
    }

    setScanDone(list.length);
  }

  async function rescanOne(id: string) {
    if (scanningId) return;
    const draft = drafts.find((d) => d.id === id);
    const source = capturedItems.find((c) => c.id === id);
    if (!draft || !source) return;
    if (metered && scanRemaining !== null && scanRemaining <= 0) {
      setVerifyStatus("No AI scans left this cycle — fill this one in by hand.");
      return;
    }
    setScanningId(id);
    setVerifyStatus("");
    try {
      const file = new File([source.frontBlob], `${id}.jpg`, { type: "image/jpeg" });
      // Pass the Universe as a soft HINT, not the formal `universe` param: the API
      // treats `universe` as "pre-classified" and then refuses to return category/
      // subcategory. As a hint, the AI still returns the full classification (incl.
      // subcategory), which we then match within the curator's chosen Universe.
      const vision = await withTimeout(
        analyzeImageWithVision(file, {
          hints: `The collector has "${UNIVERSE_LABEL[draft.universe]}" selected for this batch, but batches can contain mixed items -- trust what you actually see in the photo over that selection. If the item clearly is NOT ${UNIVERSE_LABEL[draft.universe]} (e.g. it's a comic book, a different card game, etc.), report the universe you actually observe instead of forcing it into ${UNIVERSE_LABEL[draft.universe]}. Identify the specific game/set/franchise and include category and subcategory.`,
        }),
        AI_SCAN_TIMEOUT_MS
      );
      let charged = true;
      if (metered) {
        const res = await consumeBulkScans(profileId, 1);
        if (res) {
          setScanRemaining(res.remaining);
          if (res.granted === 0) {
            setVerifyStatus("No AI scans left this cycle — fill this one in by hand.");
            charged = false;
          }
        }
      }
      if (charged) {
        const patch = visionToDraftPatch(vision, draft.universe, draft.categoryLabel);
        setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
      }
    } catch {
      setVerifyStatus("Couldn't identify that one — try again or fill it in by hand.");
    }
    setScanningId(null);
  }

  async function handleSaveVerified() {
    if (drafts.length === 0) { onClose(); return; }
    setCommitting(true);
    try {
      const items = await Promise.all(drafts.map((d, i) => draftToVaultItem(d, i)));
      appendItems(items);
      items.forEach((item) => enqueueVaultItemSync(item.id));
      emitVaultUpdate();
      void processVaultSyncQueue();
      // Land in the Vault so the curator sees what they just added (not the old
      // Quick Add form that hosts this scanner).
      router.push("/vault");
    } catch {
      setVerifyStatus("Something went wrong saving. Please try again.");
      setCommitting(false);
    }
  }

  // Kept = captured minus removals. This is what actually gets vaulted, so it drives every count.
  const keptItems = capturedItems.filter((item) => !removed.has(item.id));
  const keptCount = keptItems.length;
  const lastThumb = keptItems.length ? keptItems[keptItems.length - 1].frontObjectUrl : null;
  const cameraOptions = devices.map((d, i) => ({ value: d.deviceId, label: d.label || `Camera ${i + 1}` }));
  const staged: StagedItem[] = capturedItems.map((item) => ({
    id: item.id,
    frontObjectUrl: item.frontObjectUrl,
    backObjectUrl: undefined,
    categoryLabel: item.categoryLabel,
    universe: item.universe,
    skipAi: item.skipAi,
    barcodeLookupState: item.barcodeLookupState,
    barcodeSummary: item.barcodeMatch?.summary,
  }));

  function handlePatchStaged(id: string, patch: { universe?: UniverseKey; categoryLabel?: string; skipAi?: boolean }) {
    setCapturedItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return (
    <>
    <div className="fixed inset-0 z-[100000] flex items-start justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex w-full max-w-[540px] flex-col overflow-hidden bg-[color:var(--bg)] text-[color:var(--fg)]" style={{ height: "calc(100dvh - var(--bottomnav-h, 86px))" }}>
        <canvas ref={captureCanvasRef} className="hidden" />

        {/* Header — Universe · Category · Frame · Camera dropdown pills + Finished + close */}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5">
          <DropdownPill
            title="Universe"
            value={universe}
            options={UNIVERSES.map((k) => ({ value: k, label: UNIVERSE_LABEL[k] }))}
            onSelect={(v) => {
              setUniverse(v as UniverseKey);
              setCategoryLabel(getCategories(v as UniverseKey)[0] ?? "Collectors Choice");
              if (typeof window !== "undefined") {
                window.localStorage.setItem(SCAN_UNIVERSE_PREF_KEY, v as string);
              }
            }}
          />
          <DropdownPill
            title="Category"
            value={categoryLabel}
            options={getCategories(universe).map((c) => ({ value: c, label: c }))}
            onSelect={(v) => setCategoryLabel(v)}
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
            onClick={toggleScan}
            title={scanState === "scanning" ? "Cancel scan" : "Scan a barcode or QR code"}
            aria-label={scanState === "scanning" ? "Cancel scan" : "Scan a barcode or QR code"}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] ring-1 transition"
            style={
              scanState === "scanning"
                ? { background: "rgba(74,155,255,0.16)", borderColor: "rgba(74,155,255,0.5)", color: "#4A9BFF" }
                : { background: "var(--pill)", borderColor: "var(--border)", color: "var(--muted)" }
            }
          >
            <Glyph name="scan" size={16} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            onClick={handleFinished}
            className="ml-auto shrink-0 rounded-md px-3.5 py-1.5 text-xs font-bold transition active:scale-95"
            style={{
              background: "linear-gradient(145deg, #EDEFF1 0%, #C8CDD2 30%, #A8AEB4 60%, #8C9298 100%)",
              color: "#171717",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 6px rgba(0,0,0,0.35)",
              opacity: keptCount ? 1 : 0.55,
            }}
          >
            Finished{keptCount ? ` (${keptCount})` : ""}
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
        <div
          className="relative w-full flex-1 bg-[color:var(--bg)]"
          style={{ overflow: "hidden", touchAction: cameraZoom.supported ? "none" : undefined }}
          onTouchStart={cameraZoom.handlePinchStart}
          onTouchMove={cameraZoom.handlePinchMove}
          onTouchEnd={cameraZoom.handlePinchEnd}
        >
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          <FrameOverlay frameType={frameType} capturing={capturing} />

          {/* Live zoom slider -- only rendered where the hardware/browser
              actually supports it (see useCameraZoom's notes); pinch also
              works anywhere on this viewport when supported. */}
          {cameraZoom.supported ? (
            <div className="absolute bottom-3 right-3 flex h-32 w-9 flex-col items-center gap-1 rounded-full px-1.5 py-2 backdrop-blur" style={{ background: "rgba(0,0,0,0.42)", border: "1px solid rgba(255,255,255,0.25)" }}>
              <span className="text-[9px] font-bold text-white/70">{cameraZoom.zoom.toFixed(1)}x</span>
              <input
                type="range"
                min={cameraZoom.min}
                max={cameraZoom.max}
                step={cameraZoom.step}
                value={cameraZoom.zoom}
                onChange={(e) => cameraZoom.setZoom(Number(e.target.value))}
                className="h-full w-6 flex-1"
                style={{ writingMode: "vertical-lr", direction: "rtl", accentColor: "#4A9BFF" }}
                aria-label="Camera zoom"
              />
            </div>
          ) : null}

          {/* Ghost counter — top-left */}
          <div
            className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full text-sm font-black backdrop-blur"
            style={{ background: "rgba(0,0,0,0.42)", color: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.25)" }}
          >
            {keptCount}
          </div>

          {/* Scan-in-progress banner — deliberately big/hard to miss (an
              earlier small pill version drew a report of "I don't see it
              even flicker"), full-width across the top with a live attempt
              counter so it's obvious a burst is actually running. */}
          {scanState === "scanning" ? (
            <div
              className="pointer-events-none absolute inset-x-0 top-[52px] flex items-center justify-center gap-2 px-3 py-2.5"
              style={{ background: "rgba(74,155,255,0.92)" }}
            >
              <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-white" />
              <span className="text-[12px] font-bold text-white">
                Scanning… point at a QR or barcode
                {scanDiagnostic ? ` (${scanDiagnostic.attempts} tries, ${(scanDiagnostic.elapsedMs / 1000).toFixed(1)}s)` : ""}
              </span>
            </div>
          ) : null}

          {scanState === "timeout" ? (
            <div
              className="pointer-events-none absolute inset-x-0 top-[52px] flex items-center justify-center gap-2 px-3 py-2.5"
              style={{ background: "rgba(0,0,0,0.85)" }}
            >
              <span className="text-[12px] font-bold text-white/85">
                No code found — try again
                {scanDiagnostic ? ` (${scanDiagnostic.engine}, ${scanDiagnostic.attempts} tries in ${(scanDiagnostic.elapsedMs / 1000).toFixed(1)}s)` : ""}
              </span>
            </div>
          ) : null}

          {/* Live barcode/QR badge — top-right, mirrors the regular Add camera */}
          {liveBarcode ? (
            <div
              className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5 rounded-full px-3 py-1.5 backdrop-blur"
              style={{ background: "rgba(0,0,0,0.72)", border: "1px solid rgba(74,222,128,0.5)" }}
            >
              <span className="text-sm font-bold" style={{ color: "#4ade80" }}>&#x2713;</span>
              <span className="text-[11px] font-semibold text-white">
                {liveBarcode.format === "QR" ? "QR code" : "Barcode"} read
                {liveBarcode.digits ? `: ${liveBarcode.digits}` : ""}
              </span>
            </div>
          ) : null}

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
        onPatch={handlePatchStaged}
      />
    ) : null}

    {flowPhase === "scanning" ? (
      <div className="fixed inset-0 z-[100000] flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center backdrop-blur-sm">
        <span
          className="h-9 w-9 animate-spin rounded-full border-[3px]"
          style={{ borderColor: "rgba(203,208,213,0.25)", borderTopColor: "#C8CDD2" }}
        />
        <div className="text-base font-black text-white">
          Identifying {Math.min(scanDone + 1, scanTotal)} of {scanTotal}…
        </div>
        <div className="text-xs text-white/60">AI is filling in your items.</div>
        {metered && scanRemaining !== null ? (
          <div className="text-xs text-white/50">{scanRemaining} AI scans left this cycle</div>
        ) : null}
        <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${scanTotal ? (scanDone / scanTotal) * 100 : 0}%`, background: "var(--theme-gold, #C8CDD2)" }}
          />
        </div>
      </div>
    ) : null}

    {flowPhase === "verify" ? (
      <ScanVerifySheet
        drafts={drafts}
        scanningId={scanningId}
        committing={committing}
        remaining={scanRemaining}
        scanLimit={scanLimit}
        metered={metered}
        status={verifyStatus}
        onPatch={(id, patch) => setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))}
        onRemove={(id) => setDrafts((prev) => prev.filter((d) => d.id !== id))}
        onRescan={(id) => void rescanOne(id)}
        onSave={() => void handleSaveVerified()}
        onClose={onClose}
      />
    ) : null}
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import ScanCropEditor from "@/components/ScanCropEditor";
import { DropdownPill } from "@/components/ui/DropdownPill";
import { Glyph } from "@/components/ui/Glyph";
import { PillButton } from "@/components/ui/PillButton";
import type { BarcodeScanResult } from "@/lib/scanners/barcodeScanner";
import { startOnDemandScan } from "@/lib/scanners/onDemandBarcodeScan";
import { warmupZXingWasm } from "@/lib/scanners/zxingWasmSetup";
import { lookupByBarcodeOnly, guessWhyNoBarcodeMatch, type BarcodeLookupResult, type UnmatchedBarcodeGuess } from "@/lib/scanners/barcodeLookup";
import {
  getUniverses,
  getCategories,
  getSubcategories,
  UNIVERSE_LABEL,
  type UniverseKey,
} from "@/lib/taxonomy";
import {
  buildCaptureFilterCss,
  CAPTURE_FILTER_PRESETS,
  DEFAULT_CAPTURE_ADJUSTMENTS,
  isOriginalCaptureTreatment,
  type CaptureAdjustments,
} from "@/components/capture/captureFilters";
import {
  getCaptureFrame,
  type CaptureFrame,
} from "@/components/capture/captureFrames";
import {
  applyCssFilterToFile,
  assessCanvasBlur,
  CAPTURE_BACKGROUNDS,
  compositeBackgroundToFile,
  removeBackgroundFromFile,
  type BlurAssessment,
} from "@/components/capture/captureUtils";
import { cropImageFile, computeSubjectCrop, type ScanCropRect } from "@/lib/scanners/cropImageFile";

type CameraPermissionState = "granted" | "prompt" | "denied" | "unknown";
type DetectionState = "idle" | "loading" | "ready" | "unavailable";
type DetectionBox = { x: number; y: number; width: number; height: number };

const DEFAULT_CROP: ScanCropRect = { left: 0, top: 0, right: 0, bottom: 0 };
const BULK_UNIVERSES = getUniverses();
const CAMERA_PREF_KEY = "vltd_camera_device_id";
// Some phones stream well past 3000px on the long edge. The filter/crop/
// upload pipeline doesn't need more than this for a sharp vault photo, and
// capping it keeps captures fast on high-res devices.
const MAX_CAPTURE_LONG_EDGE = 2200;
// One practical, one-tap fix for a dim shot -- replaced the 7-preset Filter
// dropdown (all subtle ~10% color tweaks that looked identical on a phone
// screen). This is meaningfully brighter, not another subtle variant.
const BRIGHTEN_ADJUSTMENTS: CaptureAdjustments = { ...DEFAULT_CAPTURE_ADJUSTMENTS, brightness: 132, contrast: 110 };
function isBrightenActive(adjustments: CaptureAdjustments) {
  return adjustments.brightness === BRIGHTEN_ADJUSTMENTS.brightness && adjustments.contrast === BRIGHTEN_ADJUSTMENTS.contrast;
}
// Live object-detection (TF.js + coco-ssd) ran every ~900ms just to draw a
// cosmetic guide box — heavy and not wired to anything. Off for speed; the
// fixed frame guide stays. Flip to true to re-enable (consider throttling).
const ENABLE_OBJECT_DETECTION = false;

const FRAME_PRESETS: Array<{ id: string; label: string; frame: CaptureFrame }> = [
  {
    id: "card",
    label: "Card",
    frame: { label: "Card frame", aspectRatio: "2.5 / 3.5", inset: "10%", radius: "14px" },
  },
  {
    id: "book",
    label: "Book",
    frame: { label: "Book frame", aspectRatio: "2 / 3", inset: "7%", radius: "16px" },
  },
  {
    id: "jewelry",
    label: "Jewelry",
    frame: { label: "Jewelry frame", aspectRatio: "1 / 1", inset: "12%", radius: "999px" },
  },
  {
    id: "art",
    label: "Art",
    frame: { label: "Art frame", aspectRatio: "4 / 5", inset: "8%", radius: "14px" },
  },
];

function isDefaultCrop(crop: ScanCropRect) {
  return crop.left === 0 && crop.top === 0 && crop.right === 0 && crop.bottom === 0;
}

export default function CameraCapturePanel({
  title,
  description,
  universe,
  onCapture,
  onBulkCapture,
  onClose,
  onUseFileInstead,
  onLiveBarcodeScan,
  variant = "modal",
  initialBulkMode = false,
  bulkToggle = true,
  bulkTaxonomy = true,
  capturedCount = 0,
  lastCapturedUrl,
}: {
  title: string;
  description: string;
  universe?: string | null;
  onCapture: (file: File, barcode?: BarcodeScanResult) => void;
  onBulkCapture?: (file: File, category: string, subcategory: string) => void;
  onClose: () => void;
  onUseFileInstead: () => void;
  /** Fires once the free barcode-only lookup (see barcodeLookup.ts) settles
   *  for a scanned code -- this component runs the lookup itself (and shows
   *  the result right here in the camera view, since that's where the
   *  curator is actually looking while scanning) and hands the resolved
   *  match to the parent so it can merge fields into its own form. `match`
   *  is null when nothing was found. Optional -- callers that don't care
   *  about live enrichment (e.g. a bulk-photo-only flow) can just omit it. */
  onLiveBarcodeScan?: (result: BarcodeScanResult, match: BarcodeLookupResult | null) => void;
  /** Photos already attached to the item being built (not this component's own
   *  state — the parent owns that list). Shown as a small count badge, same
   *  spot as Quick Add's ghost counter, so multi-photo capture gives the same
   *  "got it, keep going" feedback here too. */
  capturedCount?: number;
  /** Object URL of the most recently captured photo. Rendered as a small
   *  tappable thumbnail next to the shutter, same spot as Quick Add's "Last"
   *  thumbnail — tapping it closes back to the page so everything captured
   *  so far (the full thumbnail rail) is visible again. */
  lastCapturedUrl?: string;
  /** "modal" (default) is the full-screen overlay; "inline" embeds the camera
   *  directly in the page as a normal block (used by the Add screen). */
  variant?: "modal" | "inline";
  /** Start locked in rapid bulk-capture mode (used by /vault/bulk). */
  initialBulkMode?: boolean;
  /** Show the "Bulk Add" on/off toggle. Off = the mode is fixed by the parent. */
  bulkToggle?: boolean;
  /** Show the in-panel Universe/Category/Subcategory selectors in bulk mode.
   *  Off when the parent (e.g. the bulk page) already owns the batch Universe. */
  bulkTaxonomy?: boolean;
}) {
  const isInline = variant === "inline";
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const selectedDeviceIdRef = useRef("");
  const preferredDeviceIdRef = useRef("");
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  // Once known, shapes the video box to match the camera's real aspect ratio
  // instead of an arbitrary flex-sized rectangle -- object-contain then shows
  // ~zero letterbox bars because the box already matches the footage, with
  // none of the preview-vs-capture mismatch risk object-cover has (capture
  // always grabs the full native frame regardless of display -- see the
  // computeGuideCrop comment below).
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [permissionState, setPermissionState] = useState<CameraPermissionState>("unknown");
  const [hostLabel, setHostLabel] = useState("");
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState("");
  const [captureCrop, setCaptureCrop] = useState<ScanCropRect>(DEFAULT_CROP);
  const [isApplyingCrop, setIsApplyingCrop] = useState(false);
  const [selectedFilterId, setSelectedFilterId] = useState("original");
  const [adjustments, setAdjustments] = useState<CaptureAdjustments>(DEFAULT_CAPTURE_ADJUSTMENTS);
  const [blurAssessment, setBlurAssessment] = useState<BlurAssessment | null>(null);
  // Temporary, visible-on-screen timing readout for the still-open "capture
  // takes ~10s" report -- shows exactly which step is slow instead of
  // guessing again. Remove once that's diagnosed and fixed for real.
  const [captureTiming, setCaptureTiming] = useState("");
  const [detectionState, setDetectionState] = useState<DetectionState>("idle");
  const [detectionBox, setDetectionBox] = useState<DetectionBox | null>(null);
  const [liveBarcode, setLiveBarcode] = useState<BarcodeScanResult | null>(null);
  const liveBarcodeRef = useRef<BarcodeScanResult | null>(null);
  // On-demand scan session — off by default; only runs for a bounded burst
  // after a tap on the Scan button, never for the whole time the camera is
  // open (see onDemandBarcodeScan.ts for why).
  const [scanState, setScanState] = useState<"idle" | "scanning" | "timeout">("idle");
  const scanStopRef = useRef<(() => void) | null>(null);
  // Free barcode-only lookup result -- shown right here in the camera view
  // (not on whatever page is behind this full-screen modal, which the
  // curator can't see until they close the camera) the instant a scan
  // resolves. See barcodeLookup.ts / onLiveBarcodeScan.
  const [barcodeLookupState, setBarcodeLookupState] = useState<"idle" | "looking" | "found" | "none">("idle");
  const [barcodeLookupResult, setBarcodeLookupResult] = useState<BarcodeLookupResult | null>(null);
  // When nothing matched, is there still something useful to say about why
  // (e.g. "this looks like a CGC certificate code") instead of a flat "no
  // match" that reads like the feature failed? See barcodeLookup.ts.
  const [barcodeLookupGuess, setBarcodeLookupGuess] = useState<UnmatchedBarcodeGuess | null>(null);
  // Start fetching/compiling the scan decoder's wasm binary as soon as this
  // panel mounts, not on the first Scan tap -- so tapping Scan later doesn't
  // eat a cold-load delay on top of the burst itself.
  useEffect(() => { warmupZXingWasm(); }, []);
  // On-screen diagnostic (engine + attempt count + elapsed) -- so a real-
  // device report of "nothing happened" can be told apart from "it ran the
  // whole burst and genuinely found nothing," without needing devtools on a
  // phone. Kept after the burst ends so the timeout message can show it.
  const [scanDiagnostic, setScanDiagnostic] = useState<{ engine: string; attempts: number; elapsedMs: number } | null>(null);
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [backgroundError, setBackgroundError] = useState("");
  const [isBackgroundRemoved, setIsBackgroundRemoved] = useState(false);
  const [selectedBackgroundId, setSelectedBackgroundId] = useState("transparent");
  const [selectedFrameId, setSelectedFrameId] = useState("auto");
  const [showFineTune, setShowFineTune] = useState(false);
  // ── Bulk Add mode ──
  const [bulkMode, setBulkMode] = useState(Boolean(initialBulkMode));
  const [bulkUniverse, setBulkUniverse] = useState<UniverseKey>("MISC");
  const [bulkCategory, setBulkCategory] = useState(() => getCategories("MISC")[0] ?? "");
  const [bulkSubcategory, setBulkSubcategory] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkSavedCount, setBulkSavedCount] = useState(0);

  const bulkCategoryOptions = getCategories(bulkUniverse);
  const bulkSubcategoryOptions = getSubcategories(bulkUniverse, bulkCategory);

  const activeFilter =
    CAPTURE_FILTER_PRESETS.find((preset) => preset.id === selectedFilterId) ??
    CAPTURE_FILTER_PRESETS[0];
  const imageFilter = buildCaptureFilterCss(activeFilter, adjustments);
  const selectedFramePreset = FRAME_PRESETS.find((preset) => preset.id === selectedFrameId);
  const frame = selectedFramePreset?.frame ?? getCaptureFrame(universe);
  const selectedBackground =
    CAPTURE_BACKGROUNDS.find((background) => background.id === selectedBackgroundId) ??
    CAPTURE_BACKGROUNDS[0];


  useEffect(() => {
    selectedDeviceIdRef.current = selectedDeviceId;
  }, [selectedDeviceId]);

  function stopCameraStream() {
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  useEffect(() => {
    let isActive = true;
    let permissionStatus: PermissionStatus | null = null;

    // Restore the last camera the user picked so it stops resetting every shot.
    if (typeof window !== "undefined") {
      const savedId = window.localStorage.getItem(CAMERA_PREF_KEY);
      if (savedId) {
        preferredDeviceIdRef.current = savedId;
        selectedDeviceIdRef.current = savedId;
      }
    }

    async function refreshVideoDevices() {
      if (!navigator.mediaDevices?.enumerateDevices) return;

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!isActive) return;

        // Photographing a collectible always wants a rear camera -- a front/
        // selfie camera is never useful here and just clutters the picker.
        // Device labels reliably say "facing front"/"facing back" on phones
        // that expose multiple rear cameras (see EK's screenshot).
        const cameras = devices
          .filter((device) => device.kind === "videoinput")
          .filter((device) => !/front/i.test(device.label));
        setVideoDevices(cameras);

        const currentDeviceId = selectedDeviceIdRef.current;
        if (currentDeviceId && cameras.some((camera) => camera.deviceId === currentDeviceId)) {
          return;
        }

        // Prefer the saved camera; fall back to the first available.
        const savedId = typeof window !== "undefined" ? window.localStorage.getItem(CAMERA_PREF_KEY) : null;
        const nextId = savedId && cameras.some((c) => c.deviceId === savedId)
          ? savedId
          : cameras[0]?.deviceId ?? "";
        if (nextId) {
          preferredDeviceIdRef.current = nextId;
          selectedDeviceIdRef.current = nextId;
        }
        setSelectedDeviceId(nextId);
      } catch {
        if (isActive) {
          setVideoDevices([]);
        }
      }
    }

    async function readPermissionState() {
      if (typeof window !== "undefined") {
        setHostLabel(window.location.host || window.location.hostname || "this site");
      }

      if (!navigator.permissions?.query) {
        setPermissionState("unknown");
        return;
      }

      try {
        permissionStatus = await navigator.permissions.query({
          name: "camera" as PermissionName,
        });

        if (!isActive) return;

        const applyState = () => {
          const next = permissionStatus?.state;
          if (next === "granted" || next === "prompt" || next === "denied") {
            setPermissionState(next);
            return;
          }
          setPermissionState("unknown");
        };

        applyState();
        permissionStatus.onchange = applyState;
      } catch {
        if (isActive) {
          setPermissionState("unknown");
        }
      }
    }

    async function startCamera() {
      if (capturedFile) {
        return;
      }

      stopCameraStream();
      setCameraError("");
      setCameraReady(false);
      setVideoAspectRatio(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Live camera is not available in this browser. Use the file picker instead.");
        return;
      }

      try {
        let stream: MediaStream;
        const preferredDeviceId = preferredDeviceIdRef.current;
        // Every constraint here is `ideal`/soft, deliberately -- an `exact`
        // constraint (e.g. a remembered deviceId that's since gone stale)
        // can force the browser to try and fail before falling back, and on
        // some phones that failure isn't fast. A single all-ideal request
        // negotiates once and can't reject for being unsatisfiable.
        //
        // Only `width` is set, not an explicit width+height pair -- forcing
        // an exact landscape pair (e.g. 3840x2160) can bias the browser
        // toward a landscape-shaped stream even when the phone is held in
        // portrait, which showed up as a squeezed/wrong-aspect preview.
        // Leaving height unconstrained lets the browser pick whatever
        // height matches the device's own natural (portrait) orientation.
        // Kept modest (not pushing toward 4K) after two rounds of raising it
        // didn't measurably improve sharpness and coincided with the
        // preview looking worse and capture staying slow -- web camera
        // capture has a real ceiling below what a native camera app can do
        // (no HDR/multi-frame fusion), so further tuning this number isn't
        // the lever to keep pulling.
        const requestedDevice = preferredDeviceId
          ? { deviceId: { ideal: preferredDeviceId }, width: { ideal: 1280 } }
          : { facingMode: { ideal: "environment" }, width: { ideal: 1280 } };

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: requestedDevice,
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        if (!isActive) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        void refreshVideoDevices();

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      } catch (error) {
        if (!isActive) return;
        const message = error instanceof Error ? error.message : "Camera access failed.";
        const currentSecureContext =
          typeof window === "undefined" ? true : window.isSecureContext;
        const currentPermissionState = permissionStatus?.state;

        if (!currentSecureContext) {
          setCameraError("Camera access requires HTTPS or localhost for this site.");
        } else if (currentPermissionState === "denied") {
          setCameraError("Camera access is blocked for this site.");
        } else if (/NotAllowedError|Permission/i.test(message)) {
          setCameraError("Camera permission was denied for this site.");
        } else if (/NotReadableError|TrackStartError|Could not start video source/i.test(message)) {
          setCameraError("The camera is busy in another app or browser tab.");
        } else if (/NotFoundError|DevicesNotFoundError/i.test(message)) {
          setCameraError("No camera was found on this device.");
        } else {
          setCameraError(message || "Camera access failed. Use the file picker instead.");
        }
      }
    }

    void refreshVideoDevices();
    void startCamera();
    void readPermissionState();

    return () => {
      isActive = false;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
      stopCameraStream();
    };
  }, [capturedFile, retryCount]);

  useEffect(() => {
    if (!ENABLE_OBJECT_DETECTION || capturedFile || cameraError || !cameraReady) {
      setDetectionBox(null);
      return;
    }

    let isActive = true;
    let detectionTimer: number | null = null;
    let model: {
      detect: (input: HTMLVideoElement) => Promise<Array<{ bbox: [number, number, number, number] }>>;
    } | null = null;

    async function loadDetector() {
      setDetectionState("loading");
      try {
        const tf = await import("@tensorflow/tfjs");
        const cocoSsd = await import("@tensorflow-models/coco-ssd");
        await tf.ready();
        model = await cocoSsd.load();
        if (!isActive) return;
        setDetectionState("ready");
        void detectNextFrame();
      } catch {
        if (isActive) {
          setDetectionState("unavailable");
          setDetectionBox(null);
        }
      }
    }

    async function detectNextFrame() {
      const video = videoRef.current;
      if (!isActive || !model || !video || !video.videoWidth || !video.videoHeight) {
        if (isActive) {
          detectionTimer = window.setTimeout(() => void detectNextFrame(), 900);
        }
        return;
      }

      try {
        const predictions = await model.detect(video);
        const primary = predictions[0];
        if (primary) {
          const [x, y, width, height] = primary.bbox;
          setDetectionBox({
            x: (x / video.videoWidth) * 100,
            y: (y / video.videoHeight) * 100,
            width: (width / video.videoWidth) * 100,
            height: (height / video.videoHeight) * 100,
          });
        } else {
          setDetectionBox(null);
        }
      } catch {
        setDetectionBox(null);
      }

      if (isActive) {
        detectionTimer = window.setTimeout(() => void detectNextFrame(), 900);
      }
    }

    const loadTimer = window.setTimeout(() => void loadDetector(), 1400);

    return () => {
      isActive = false;
      window.clearTimeout(loadTimer);
      if (detectionTimer) {
        window.clearTimeout(detectionTimer);
      }
    };
  }, [cameraError, capturedFile, cameraReady, retryCount]);

  useEffect(() => {
    return () => {
      if (capturedPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(capturedPreviewUrl);
      }
    };
  }, [capturedPreviewUrl]);

  // Barcode/QR scanning is on-demand only (tap the Scan button), never
  // running automatically just because the camera is open. Two real bugs in
  // the old always-on version: it never reliably read a code on a real
  // device, and it pinned the CPU the whole time the camera stayed open,
  // overheating the phone. Bounding it to a short, deliberately-triggered
  // burst (see onDemandBarcodeScan.ts) is what actually fixes the heat --
  // and where the browser supports it (Chrome/Android), the native
  // BarcodeDetector API does the work instead of a JS loop, at near-zero cost.
  function toggleScan() {
    if (scanState === "scanning") {
      scanStopRef.current?.();
      scanStopRef.current = null;
      setScanState("idle");
      return;
    }
    const video = videoRef.current;
    if (!video || capturedFile || cameraError || !cameraReady) return;
    setScanState("scanning");
    setScanDiagnostic(null);
    scanStopRef.current = startOnDemandScan(video, {
      durationMs: 8000,
      onResult: (result) => {
        liveBarcodeRef.current = result;
        setLiveBarcode(result);
        setScanState("idle");
        scanStopRef.current = null;
        try { navigator.vibrate?.(60); } catch { /* ignore */ }

        // Free lookup, shown right here (not on the page behind this modal)
        // -- fires the moment the code's read, no shutter press needed.
        setBarcodeLookupState("looking");
        setBarcodeLookupResult(null);
        setBarcodeLookupGuess(null);
        void lookupByBarcodeOnly(result).then((match) => {
          setBarcodeLookupState(match ? "found" : "none");
          setBarcodeLookupResult(match);
          if (!match) setBarcodeLookupGuess(guessWhyNoBarcodeMatch(result));
          onLiveBarcodeScan?.(result, match);
        });
      },
      onTimeout: () => {
        scanStopRef.current = null;
        setScanState("timeout");
      },
      onDiagnostic: (d) => setScanDiagnostic(d),
    });
  }

  // Stop any in-flight scan session on unmount or when leaving the live view.
  useEffect(() => {
    return () => {
      scanStopRef.current?.();
      scanStopRef.current = null;
    };
  }, [capturedFile, cameraError]);

  // "No code found" deliberately stays on screen until the next Scan tap
  // (which resets it) -- an earlier 2.5s auto-clear made the message
  // disappear before EK could even read it on a phone, let alone
  // screenshot it. No timer needed: tapping Scan again already sets
  // scanState back to "scanning" itself.

  const permissionLabel =
    permissionState === "granted"
      ? "Allowed"
      : permissionState === "prompt"
        ? "Ask"
        : permissionState === "denied"
          ? "Blocked"
          : "Unknown";

  /** Compute a ScanCropRect that matches the guide overlay position in the live camera view.
   *  Uses the video container's rendered size + the video's native dimensions to
   *  account for object-contain letterboxing/pillarboxing.
   *
   *  Must stay object-contain, matching the <video>'s object-fit below: a
   *  capture always grabs the camera's full native frame regardless of how
   *  it's displayed, so object-cover here would crop the on-screen preview
   *  tighter than what's actually captured — the preview and the photo you
   *  get would stop matching (confirmed: this caused exactly that mismatch
   *  when tried).
   */
  function computeGuideCrop(): ScanCropRect {
    const video = videoRef.current;
    const container = videoContainerRef.current;
    if (!video || !container) return DEFAULT_CROP;

    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    const videoW = video.videoWidth;
    const videoH = video.videoHeight;
    if (!containerW || !containerH || !videoW || !videoH) return DEFAULT_CROP;

    // Determine rendered video size + offset within the container (object-contain)
    const containerAR = containerW / containerH;
    const videoAR = videoW / videoH;
    let renderedW: number, renderedH: number, offsetX: number, offsetY: number;
    if (videoAR > containerAR) {
      renderedW = containerW;
      renderedH = containerW / videoAR;
      offsetX = 0;
      offsetY = (containerH - renderedH) / 2;
    } else {
      renderedH = containerH;
      renderedW = containerH * videoAR;
      offsetX = (containerW - renderedW) / 2;
      offsetY = 0;
    }
    if (renderedW <= 0 || renderedH <= 0) return DEFAULT_CROP;

    // Guide overlay geometry (matches the CSS in the JSX)
    const insetFraction = parseFloat(frame.inset) / 100;
    const [arWStr, arHStr] = frame.aspectRatio.split("/").map((s) => parseFloat(s.trim()));
    const guideAR = arWStr / arHStr;
    const maxFraction = 0.82;

    let guideH = containerH * (1 - insetFraction);
    let guideW = guideH * guideAR;
    if (guideH > containerH * maxFraction) { guideH = containerH * maxFraction; guideW = guideH * guideAR; }
    if (guideW > containerW * maxFraction) { guideW = containerW * maxFraction; guideH = guideW / guideAR; }

    // Guide is centered in the container
    const gLeft = (containerW - guideW) / 2;
    const gTop = (containerH - guideH) / 2;
    const gRight = gLeft + guideW;
    const gBottom = gTop + guideH;

    // Map to [0,1] fractions of the native video frame
    const vLeft = Math.max(0, (gLeft - offsetX) / renderedW);
    const vTop = Math.max(0, (gTop - offsetY) / renderedH);
    const vRight = Math.min(1, (gRight - offsetX) / renderedW);
    const vBottom = Math.min(1, (gBottom - offsetY) / renderedH);

    return {
      left: vLeft,
      top: vTop,
      right: 1 - vRight,
      bottom: 1 - vBottom,
    };
  }

  async function handleCapture() {
    const video = videoRef.current;
    if (!video) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      setCameraError("The camera is not ready yet.");
      return;
    }

    setIsCapturing(true);
    // Real timing instead of another guess -- EK reported the delay is
    // between the shutter tap and the photo appearing, which is this whole
    // function. Logging each step (and showing it on-screen) tells us
    // exactly which one is slow instead of speculating about camera
    // startup/negotiation, which was wrong twice already.
    const t0 = performance.now();

    try {
      const longEdge = Math.max(width, height);
      const outputScale = longEdge > MAX_CAPTURE_LONG_EDGE ? MAX_CAPTURE_LONG_EDGE / longEdge : 1;
      const outputWidth = Math.round(width * outputScale);
      const outputHeight = Math.round(height * outputScale);

      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is not available.");

      ctx.drawImage(video, 0, 0, width, height, 0, 0, outputWidth, outputHeight);
      const tDraw = performance.now();
      setBlurAssessment(assessCanvasBlur(canvas));
      const tBlur = performance.now();

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.9);
      });
      const tBlob = performance.now();

      if (!blob) {
        throw new Error("Failed to capture photo.");
      }

      const file = new File([blob], `camera-capture-${Date.now()}.jpg`, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });

      if (capturedPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(capturedPreviewUrl);
      }

      setCapturedFile(file);
      setCapturedPreviewUrl(URL.createObjectURL(file));
      setCaptureCrop(computeGuideCrop());
      setSelectedFilterId("original");
      setAdjustments(DEFAULT_CAPTURE_ADJUSTMENTS);
      setBackgroundError("");
      setIsBackgroundRemoved(false);
      setSelectedBackgroundId("transparent");
      stopCameraStream();

      const ms = (n: number) => Math.round(n);
      setCaptureTiming(
        `${outputWidth}x${outputHeight}px · draw ${ms(tDraw - t0)}ms · blur-check ${ms(tBlur - tDraw)}ms · encode ${ms(tBlob - tBlur)}ms · total ${ms(performance.now() - t0)}ms`
      );
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Failed to capture photo.");
    } finally {
      setIsCapturing(false);
    }
  }

  async function handleUseCapturedPhoto(cropOverride?: ScanCropRect) {
    if (!capturedFile) return;

    const cropToApply = cropOverride ?? captureCrop;
    setIsApplyingCrop(true);

    try {
      const croppedFile = isDefaultCrop(cropToApply)
        ? capturedFile
        : await cropImageFile(capturedFile, cropToApply);

      const finalFile = isOriginalCaptureTreatment(activeFilter, adjustments)
        ? croppedFile
        : await applyCssFilterToFile(croppedFile, imageFilter);

      const finishedFile = isBackgroundRemoved
        ? await compositeBackgroundToFile(finalFile, selectedBackground)
        : finalFile;

      if (bulkMode && onBulkCapture) {
        // Bulk mode: quick-save without AI review, then reset camera
        setBulkSaving(true);
        try {
          onBulkCapture(
            finishedFile,
            bulkTaxonomy ? bulkCategory : "",
            bulkTaxonomy ? bulkSubcategory : ""
          );
          setBulkSavedCount((n) => n + 1);
          // Reset for next shot
          handleRetakePhoto();
        } finally {
          setBulkSaving(false);
        }
      } else {
        onCapture(finishedFile, liveBarcodeRef.current ?? undefined);
      }
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Failed to crop photo.");
    } finally {
      setIsApplyingCrop(false);
    }
  }

  function handleRetakePhoto() {
    if (capturedPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(capturedPreviewUrl);
    }

    setCapturedFile(null);
    setCapturedPreviewUrl("");
    setCaptureCrop(DEFAULT_CROP);
    setCameraError("");
    setCameraReady(false);
    setBlurAssessment(null);
    setCaptureTiming("");
    liveBarcodeRef.current = null;
    setLiveBarcode(null);
    setBarcodeLookupState("idle");
    setBarcodeLookupResult(null);
    setBarcodeLookupGuess(null);
    scanStopRef.current?.();
    scanStopRef.current = null;
    setScanState("idle");
    setSelectedFilterId("original");
    setAdjustments(DEFAULT_CAPTURE_ADJUSTMENTS);
    setBackgroundError("");
    setIsBackgroundRemoved(false);
    setSelectedBackgroundId("transparent");
    setRetryCount((count) => count + 1);
  }

  function updateAdjustment(key: keyof CaptureAdjustments, value: number) {
    setAdjustments((current) => ({ ...current, [key]: value }));
  }

  async function handleRemoveBackground() {
    if (!capturedFile) return;

    setIsRemovingBackground(true);
    setBackgroundError("");

    try {
      const nextFile = await removeBackgroundFromFile(capturedFile);
      if (capturedPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(capturedPreviewUrl);
      }
      setCapturedFile(nextFile);
      setCapturedPreviewUrl(URL.createObjectURL(nextFile));
      // Fit the crop around the now-isolated item instead of resetting to the
      // full frame. Still fully adjustable afterward.
      setCaptureCrop(await computeSubjectCrop(nextFile));
      setIsBackgroundRemoved(true);
      setSelectedBackgroundId("vault");
    } catch {
      setBackgroundError("Background removal could not finish in this browser. The photo is still usable.");
    } finally {
      setIsRemovingBackground(false);
    }
  }

  return (
    <div
      className={
        isInline
          ? "fixed inset-0 z-[10000] flex flex-col bg-[color:var(--bg)] sm:relative sm:inset-auto sm:z-auto sm:block sm:h-auto sm:w-full sm:bg-transparent"
          // Matches Quick Add's own outer wrapper exactly: fixed, centered,
          // no padding around the panel.
          : "fixed inset-0 z-[10000] flex items-start justify-center bg-black/75 backdrop-blur-sm"
      }
      role={isInline ? undefined : "dialog"}
      aria-modal={isInline ? undefined : "true"}
      aria-label={title}
      data-no-pull-refresh={isInline || undefined}
    >
      <div
        className={
          isInline
            ? "flex w-full flex-col rounded-[12px] bg-[color:var(--surface)] p-2.5 ring-1 ring-[color:var(--border)]"
            // Matches Quick Add's inner panel: no padding, no rounded corners,
            // no border — header/video/footer each own their own edge instead
            // of everything floating inside a padded card.
            : "flex h-[calc(100dvh-1rem)] w-full max-w-[520px] flex-col overflow-hidden bg-[color:var(--bg)] sm:h-[calc(100dvh-80px)] sm:max-w-[900px]"
        }
      >
        {capturedFile && !isInline ? (
          <div className="flex justify-end p-2">
            <PillButton onClick={onClose}>Close</PillButton>
          </div>
        ) : null}
        {capturedFile && isInline ? (
          <div className="flex justify-end">
            <PillButton onClick={onClose}>Close</PillButton>
          </div>
        ) : null}

        {capturedFile && capturedPreviewUrl ? (
          <div className={isInline ? "mt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]" : "flex-1 overflow-y-auto p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"}>
            {/* Blur badge — only shown when the shot is soft */}
            {blurAssessment?.isBlurry ? (
              <div className="mb-1.5 flex items-center gap-2 rounded-[10px] bg-red-500/10 px-3 py-1.5 ring-1 ring-red-500/20">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-300"><Glyph name="warning" size={11} /> Soft image</span>
                <span className="text-[11px] text-[color:var(--muted)]">Retake for sharper label detail.</span>
              </div>
            ) : null}
            {/* Temporary timing readout — see the captureTiming state comment. */}
            {captureTiming ? (
              <div className="mb-1.5 rounded-[10px] bg-[color:var(--pill)] px-3 py-1.5 text-[10px] font-semibold text-[color:var(--muted2)] ring-1 ring-[color:var(--border)]">
                {captureTiming}
              </div>
            ) : null}

            {/* Brighten / remove-background — kept as their own small row
                above the crop editor, not overlaid on the photo itself: when
                a photo nearly fills its box there's no letterbox space left
                to safely put controls without them sitting on top of (and
                blocking) the crop handles. */}
            <div className="mb-1.5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdjustments(isBrightenActive(adjustments) ? DEFAULT_CAPTURE_ADJUSTMENTS : BRIGHTEN_ADJUSTMENTS)}
                aria-pressed={isBrightenActive(adjustments)}
                title="Brighten a dim photo"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 transition"
                style={{
                  background: isBrightenActive(adjustments) ? "var(--theme-gold-subtle, rgba(203,208,213,0.14))" : "var(--pill)",
                  borderColor: "var(--theme-gold-border, rgba(203,208,213,0.35))",
                  color: "var(--theme-gold, #C8CDD2)",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => void handleRemoveBackground()}
                disabled={isRemovingBackground || !capturedFile}
                aria-label={isBackgroundRemoved ? "Remove background again" : "Remove background"}
                title="Remove background"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full ring-1 transition disabled:opacity-45"
                style={{
                  background: isBackgroundRemoved ? "var(--theme-gold-subtle, rgba(203,208,213,0.14))" : "var(--pill)",
                  borderColor: "var(--theme-gold-border, rgba(203,208,213,0.35))",
                  color: "var(--theme-gold, #C8CDD2)",
                }}
              >
                {isRemovingBackground ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
                    <path d="M22 21H7" />
                    <path d="m5 11 9 9" />
                  </svg>
                )}
              </button>
            </div>
            <ScanCropEditor
              imageUrl={capturedPreviewUrl}
              crop={captureCrop}
              onChange={setCaptureCrop}
              title="ADJUST PHOTO"
              description="Move or resize the crop box here before this photo is added to the item."
              applyLabel="Save"
              onApply={() => void handleUseCapturedPhoto()}
              onReset={() => setCaptureCrop(DEFAULT_CROP)}
              onCancel={handleRetakePhoto}
              imageFilter={imageFilter}
              isApplying={isApplyingCrop}
              compact
              compactViewport="tall"
              hideActionButtons
              hideZoomRow
            />

            {/* Retake/Save/Fine Tune — a plain row below the viewport, not
                overlaid on the photo. Same reasoning as the brighten/remove-
                background row above: when the crop box's edges sit close to
                the viewport's own edges (little to no letterbox space), an
                overlay here would sit on top of — and block — the bottom
                crop handles. */}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <PillButton onClick={handleRetakePhoto} disabled={isApplyingCrop}>
                ↩ Retake
              </PillButton>
              <PillButton
                onClick={() => void handleUseCapturedPhoto()}
                disabled={isApplyingCrop}
                style={{ background: "var(--pill-active-bg)", color: "var(--fg)" }}
              >
                {isApplyingCrop ? "Saving..." : "Save"}
              </PillButton>
              <PillButton onClick={() => setShowFineTune((value) => !value)}>
                {showFineTune ? "Hide Fine Tune" : "Fine Tune"}
              </PillButton>
            </div>

            {showFineTune ? (
              <div className="mt-2 rounded-[18px] bg-[color:var(--surface)] p-2 ring-1 ring-[color:var(--border)]">
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setAdjustments(DEFAULT_CAPTURE_ADJUSTMENTS)}
                    className="rounded-[7px] bg-[color:var(--pill)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] ring-1 ring-[color:var(--border)]"
                  >
                    Reset
                  </button>
                </div>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                  {[
                    { key: "brightness", label: "Brightness", min: 70, max: 130 },
                    { key: "contrast", label: "Contrast", min: 70, max: 140 },
                    { key: "saturation", label: "Saturation", min: 60, max: 150 },
                    { key: "warmth", label: "Warmth", min: -40, max: 40 },
                    { key: "sharpness", label: "Sharpness", min: 0, max: 30 },
                  ].map((control) => (
                    <label key={control.key} className="rounded-xl bg-[color:var(--pill)] px-2.5 py-1.5 ring-1 ring-[color:var(--border)]">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)]">
                          {control.label}
                        </span>
                        <span className="text-[11px] font-semibold text-[color:var(--fg)]">
                          {adjustments[control.key as keyof CaptureAdjustments]}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={control.min}
                        max={control.max}
                        value={adjustments[control.key as keyof CaptureAdjustments]}
                        onChange={(event) =>
                          updateAdjustment(
                            control.key as keyof CaptureAdjustments,
                            Number(event.target.value)
                          )
                        }
                        className="mt-1 w-full accent-[color:var(--theme-gold)]"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={isBackgroundRemoved || backgroundError ? "mt-2 rounded-2xl bg-[color:var(--pill)] p-2 ring-1 ring-[color:var(--border)]" : "hidden"}>
              {backgroundError ? (
                <div className="rounded-xl bg-red-500/10 px-3 py-2 text-[11px] text-red-200 ring-1 ring-red-500/20">
                  {backgroundError}
                </div>
              ) : null}

              {isBackgroundRemoved ? (
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  <span className="shrink-0 self-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)]">Backdrop</span>
                  {CAPTURE_BACKGROUNDS.map((background) => (
                    <button
                      key={background.id}
                      type="button"
                      onClick={() => setSelectedBackgroundId(background.id)}
                      className="shrink-0 rounded-xl px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] ring-1"
                      style={{
                        background: selectedBackgroundId === background.id
                          ? "var(--theme-gold-subtle, rgba(203,208,213,0.12))"
                          : "var(--surface)",
                        borderColor: selectedBackgroundId === background.id
                          ? "var(--theme-gold-border, rgba(203,208,213,0.38))"
                          : "var(--border)",
                        color: selectedBackgroundId === background.id
                          ? "var(--theme-gold, #C8CDD2)"
                          : "var(--muted)",
                      }}
                    >
                      <span
                        className="mb-1 block h-8 w-12 rounded-lg ring-1 ring-white/10"
                        style={{ background: background.swatch }}
                      />
                      {background.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            {/* Header row — one row, matching Quick Add's own header exactly:
                Upload · Quick Add toggle · camera picker · Close, flush
                against a border-bottom (not floating inside padding). No
                separate title bar above this taking a second row. */}
            <div className={isInline ? "mt-1 flex shrink-0 items-center gap-1.5" : "flex shrink-0 items-center gap-1.5 border-b border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5"}>
              <button
                type="button"
                onClick={onUseFileInstead}
                title="Upload from file"
                aria-label="Upload from file"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] ring-1 ring-[color:var(--border)] transition hover:text-[color:var(--fg)]"
                style={{ background: "var(--pill)", color: "var(--muted)" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </button>

              {!cameraError && cameraReady && !capturedFile ? (
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
              ) : null}

              {bulkToggle ? (
                <button
                  type="button"
                  onClick={() => setBulkMode((v) => !v)}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 text-xs font-semibold ring-1 transition"
                  style={bulkMode
                    ? { background: "rgba(203,208,213,0.12)", borderColor: "rgba(203,208,213,0.35)", color: "#C8CDD2" }
                    : { background: "var(--pill)", borderColor: "var(--border)", color: "var(--muted2)" }
                  }
                >
                  <span className="inline-block h-2 w-2 rounded-full transition-colors" style={{ background: bulkMode ? "#C8CDD2" : "var(--muted2)" }} />
                  Quick Add
                </button>
              ) : null}

              {!isInline ? (
                <DropdownPill
                  title="Frame"
                  value={selectedFrameId}
                  options={FRAME_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
                  onSelect={(id) => setSelectedFrameId(id)}
                />
              ) : null}

              {videoDevices.length >= 1 ? (
                isInline ? (
                  <select
                    value={selectedDeviceId}
                    onChange={(event) => {
                      const nextDeviceId = event.target.value;
                      selectedDeviceIdRef.current = nextDeviceId;
                      preferredDeviceIdRef.current = nextDeviceId;
                      if (typeof window !== "undefined") window.localStorage.setItem(CAMERA_PREF_KEY, nextDeviceId);
                      setSelectedDeviceId(nextDeviceId);
                      setRetryCount((count) => count + 1);
                    }}
                    className="h-8 min-w-0 flex-1 truncate rounded-[10px] bg-[color:var(--pill)] px-2 text-[11px] text-[color:var(--fg)] ring-1 ring-[color:var(--border)] focus:outline-none"
                    aria-label="Select camera"
                  >
                    {videoDevices.map((device, index) => (
                      <option key={device.deviceId || index} value={device.deviceId}>
                        {device.label || `Camera ${index + 1}`}
                      </option>
                    ))}
                  </select>
                ) : (
                  // Literal same dropdown Quick Add uses for its own Camera pill.
                  <DropdownPill
                    title="Camera"
                    value={selectedDeviceId}
                    options={videoDevices.map((device, index) => ({
                      value: device.deviceId,
                      label: device.label || `Camera ${index + 1}`,
                    }))}
                    onSelect={(nextDeviceId) => {
                      selectedDeviceIdRef.current = nextDeviceId;
                      preferredDeviceIdRef.current = nextDeviceId;
                      if (typeof window !== "undefined") window.localStorage.setItem(CAMERA_PREF_KEY, nextDeviceId);
                      setSelectedDeviceId(nextDeviceId);
                      setRetryCount((count) => count + 1);
                    }}
                  />
                )
              ) : null}

              {!isInline ? <div className="flex-1" /> : null}

              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--muted)] ring-1 ring-[color:var(--border)] transition hover:text-[color:var(--fg)]"
                style={{ background: "var(--pill)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className={
              isInline
                ? "mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-[color:var(--surface)] p-1.5 ring-1 ring-[color:var(--border)] sm:h-[min(56dvh,560px)] sm:flex-none"
                // Edge-to-edge, no card around the video -- matches Quick Add.
                // items-center/justify-center so the aspect-locked box below
                // (once the camera's real ratio is known) sits centered
                // instead of stretched into an arbitrary rectangle.
                : "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black"
            }>
              <div
                  ref={videoContainerRef}
                  className={isInline ? "relative flex h-full items-center justify-center overflow-hidden rounded-[12px] bg-[color:var(--surface)]" : "relative flex items-center justify-center overflow-hidden bg-black"}
                  style={
                    isInline || !videoAspectRatio
                      ? { minHeight: "260px", height: "100%", width: "100%" }
                      : { minHeight: "260px", height: "100%", width: "auto", maxWidth: "100%", aspectRatio: String(videoAspectRatio) }
                  }
                >
                {cameraError ? (
                  <div className="max-w-lg px-5 text-center text-sm text-red-200">
                    <div>{cameraError}</div>
                    <div className="mt-3 text-xs text-[color:var(--muted)]">
                      Permission: {permissionLabel}. Site: {hostLabel || "Unknown"}.
                    </div>
                  </div>
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    onCanPlay={(event) => {
                      setCameraReady(true);
                      const el = event.currentTarget;
                      if (el.videoWidth && el.videoHeight) {
                        setVideoAspectRatio(el.videoWidth / el.videoHeight);
                      }
                    }}
                    className="h-full w-full object-contain"
                  />
                )}

                {!cameraError ? (
                  isInline ? (
                    <div
                      className="pointer-events-none absolute left-1/2 top-1/2 max-h-[82%] max-w-[82%] -translate-x-1/2 -translate-y-1/2 ring-2 ring-[color:var(--theme-gold)] shadow-[0_0_0_9999px_rgba(0,0,0,0.18)]"
                      style={{
                        aspectRatio: frame.aspectRatio,
                        borderRadius: frame.radius,
                        height: `calc(100% - ${frame.inset})`,
                        width: "auto",
                      }}
                    />
                  ) : (
                    // Corner-bracket guide -- matches Quick Add's FrameOverlay
                    // exactly (same color/size/glow), instead of a full ring.
                    <div
                      className="pointer-events-none absolute left-1/2 top-1/2 max-h-[82%] max-w-[82%] -translate-x-1/2 -translate-y-1/2"
                      style={{
                        aspectRatio: frame.aspectRatio,
                        height: `calc(100% - ${frame.inset})`,
                        width: "auto",
                        filter: "drop-shadow(0 0 2.5px rgba(0,0,0,0.8))",
                      }}
                    >
                      {(["tl", "tr", "bl", "br"] as const).map((corner) => {
                        const top = corner.includes("t");
                        const left = corner.includes("l");
                        return (
                          <div
                            key={corner}
                            className="absolute h-7 w-7"
                            style={{
                              [top ? "top" : "bottom"]: 0,
                              [left ? "left" : "right"]: 0,
                              borderTop: top ? "3px solid rgba(74,155,255,0.98)" : undefined,
                              borderBottom: !top ? "3px solid rgba(74,155,255,0.98)" : undefined,
                              borderLeft: left ? "3px solid rgba(74,155,255,0.98)" : undefined,
                              borderRight: !left ? "3px solid rgba(74,155,255,0.98)" : undefined,
                              borderRadius: top && left ? "4px 0 0 0" : top ? "0 4px 0 0" : left ? "0 0 0 4px" : "0 0 4px 0",
                              boxShadow: "0 0 12px rgba(74,155,255,0.5)",
                            }}
                          />
                        );
                      })}
                    </div>
                  )
                ) : null}

                {/* Scan-in-progress banner — deliberately big/hard to miss (an
                    earlier small pill version drew a report of "I don't see
                    it even flicker"), full-width across the top with a live
                    attempt counter so it's obvious a burst is actually
                    running (see toggleScan/onDemandBarcodeScan.ts). */}
                {!cameraError && scanState === "scanning" ? (
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

                {!cameraError && scanState === "timeout" ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-[52px] flex items-center justify-center gap-2 px-3 py-2.5"
                    style={{ background: "rgba(0,0,0,0.85)" }}
                  >
                    <span className="text-[12px] font-bold text-white/85">
                      No code found — tap Scan to try again
                      {scanDiagnostic ? ` (${scanDiagnostic.engine}, ${scanDiagnostic.attempts} tries in ${(scanDiagnostic.elapsedMs / 1000).toFixed(1)}s)` : ""}
                    </span>
                  </div>
                ) : null}

                {/* Live barcode badge — shows the moment a code is read off the feed */}
                {!cameraError && liveBarcode ? (
                  <div
                    className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur"
                    style={{ background: "rgba(0,0,0,0.72)", border: "1px solid rgba(74,222,128,0.5)" }}
                  >
                    <span className="text-sm font-bold" style={{ color: "#4ade80" }}>&#x2713;</span>
                    <span className="text-[11px] font-semibold text-white">
                      {liveBarcode.format === "QR" ? "QR code" : "Barcode"} read
                      {liveBarcode.digits ? `: ${liveBarcode.digits}` : ""}
                    </span>
                  </div>
                ) : null}

                {/* What the scan actually DID -- shown right here in the camera
                    view, not on the page behind this full-screen modal (which
                    isn't visible until the modal closes). Free lookup only;
                    see barcodeLookup.ts / onLiveBarcodeScan. */}
                {!cameraError && barcodeLookupState !== "idle" ? (
                  <div
                    className="pointer-events-none absolute left-1/2 top-14 flex max-w-[88%] items-start gap-2 -translate-x-1/2 rounded-2xl px-3 py-2 backdrop-blur"
                    style={{
                      background: barcodeLookupState === "found" ? "rgba(2,20,10,0.85)" : "rgba(0,0,0,0.72)",
                      border: barcodeLookupState === "found" ? "1px solid rgba(74,222,128,0.5)" : "1px solid rgba(255,255,255,0.16)",
                    }}
                  >
                    {barcodeLookupResult?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={barcodeLookupResult.imageUrl} alt="" className="h-11 w-8 shrink-0 rounded object-cover ring-1 ring-white/15" />
                    ) : null}
                    <span className="text-[11px] font-semibold leading-4 text-white">
                      {barcodeLookupState === "looking" ? (
                        "Looking up this code…"
                      ) : barcodeLookupState === "found" && barcodeLookupResult ? (
                        <>
                          <span style={{ color: "#4ade80" }}>Found:</span> {barcodeLookupResult.summary} — filled in what it could.
                        </>
                      ) : barcodeLookupGuess?.confident ? (
                        <>This looks like a <b>{barcodeLookupGuess.label}</b> certificate code — that lookup isn&apos;t built yet.</>
                      ) : barcodeLookupGuess ? (
                        <>This might be {barcodeLookupGuess.label} rather than a retail barcode — that kind of lookup isn&apos;t built for CGC yet, and PSA&apos;s is currently paused.</>
                      ) : (
                        "No match found for this code — take a photo and Identify, or fill in by hand."
                      )}
                    </span>
                  </div>
                ) : null}

                {!cameraError && detectionBox ? (
                  <div
                    className="pointer-events-none absolute rounded-md border border-cyan-300/70 shadow-[0_0_18px_rgba(34,211,238,0.18)]"
                    style={{
                      left: `${detectionBox.x}%`,
                      top: `${detectionBox.y}%`,
                      width: `${detectionBox.width}%`,
                      height: `${detectionBox.height}%`,
                    }}
                  />
                ) : null}

                {!cameraError && capturedCount > 0 ? (
                  <div
                    className="pointer-events-none absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full text-sm font-black backdrop-blur"
                    style={{ background: "rgba(0,0,0,0.42)", color: "rgba(255,255,255,0.9)", border: "1px solid rgba(255,255,255,0.25)" }}
                  >
                    {capturedCount}
                  </div>
                ) : null}

                {!cameraError && detectionState !== "idle" ? (
                  <div className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55 ring-1 ring-white/10">
                    {detectionState === "loading"
                      ? "Loading guide"
                      : detectionState === "ready"
                        ? detectionBox
                          ? "Object guide"
                          : "Guide ready"
                        : "Guide unavailable"}
                  </div>
                ) : null}
              </div>
            </div>

          <div className={isInline ? "" : "shrink-0 border-t border-[color:var(--border)] bg-[color:var(--surface)] px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"}>
            {/* ── Bulk Mode controls (shown above shutter when bulk on) ── */}
            {bulkMode && (
              <div className="mt-2 rounded-[14px] bg-[color:var(--pill)] px-3 py-2 ring-1 ring-[color:var(--theme-gold-border,rgba(203,208,213,0.25))]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em]"
                    style={{ background: "rgba(203,208,213,0.14)", color: "#C8CDD2" }}>
                    Quick Add
                  </span>
                  {bulkSavedCount > 0 && (
                    <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                      {bulkSavedCount} added
                    </span>
                  )}
                </div>
                {bulkTaxonomy && (
                <div className="grid gap-2 grid-cols-3">
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)] mb-0.5">Universe</div>
                    <select
                      className="w-full rounded-lg bg-[color:var(--surface)] px-2 py-1 text-[11px] text-[color:var(--fg)] ring-1 ring-[color:var(--border)] focus:outline-none"
                      value={bulkUniverse}
                      onChange={(e) => {
                        const u = e.target.value as UniverseKey;
                        const cats = getCategories(u);
                        setBulkUniverse(u);
                        setBulkCategory(cats[0] ?? "");
                        setBulkSubcategory("");
                      }}
                    >
                      {BULK_UNIVERSES.map((u) => (
                        <option key={u} value={u}>{UNIVERSE_LABEL[u]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)] mb-0.5">Category</div>
                    <select
                      className="w-full rounded-lg bg-[color:var(--surface)] px-2 py-1 text-[11px] text-[color:var(--fg)] ring-1 ring-[color:var(--border)] focus:outline-none"
                      value={bulkCategory}
                      onChange={(e) => {
                        const cat = e.target.value;
                        const subs = getSubcategories(bulkUniverse, cat);
                        setBulkCategory(cat);
                        setBulkSubcategory(subs[0] ?? "");
                      }}
                    >
                      {bulkCategoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)] mb-0.5">Subcategory</div>
                    <select
                      className="w-full rounded-lg bg-[color:var(--surface)] px-2 py-1 text-[11px] text-[color:var(--fg)] ring-1 ring-[color:var(--border)] focus:outline-none"
                      value={bulkSubcategory}
                      onChange={(e) => setBulkSubcategory(e.target.value)}
                    >
                      <option value="">Any</option>
                      {bulkSubcategoryOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                )}
              </div>
            )}

            {/* Shutter row — same layout as Quick Add: centered shutter, last-shot
                thumbnail on the left. Tapping the thumbnail closes back to the
                page so the full thumbnail rail (and everything taken so far)
                is visible again — nothing captured is ever hidden. */}
            <div className="relative mt-3 mb-1 flex items-center justify-center">
              <button
                type="button"
                onClick={() => void handleCapture()}
                disabled={Boolean(cameraError) || !cameraReady || isCapturing}
                aria-label="Capture photo"
                className="flex items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-40"
                style={{
                  width: 68,
                  height: 68,
                  background: "linear-gradient(145deg, #EDEFF1 0%, #C8CDD2 30%, #A8AEB4 60%, #8C9298 100%)",
                  boxShadow: [
                    "0 0 0 3px #0B0B0B",
                    "0 0 0 4px rgba(203,208,213,0.30)",
                    "0 8px 24px rgba(203,208,213,0.50)",
                    "inset 0 1px 0 rgba(255,255,255,0.38)",
                    "inset 0 -2px 4px rgba(0,0,0,0.28)",
                  ].join(", "),
                }}
              >
                {isCapturing || (!cameraReady && !cameraError) ? (
                  <div className="h-5 w-5 rounded-full border-[2.5px] border-[#1A0F00]/30 border-t-[#1A0F00] animate-spin" />
                ) : (
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
                      stroke="#1A0F00"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                      fill="rgba(26,15,0,0.12)"
                    />
                    <circle cx="12" cy="13" r="4" stroke="#1A0F00" strokeWidth="1.6" />
                  </svg>
                )}
              </button>

              {lastCapturedUrl ? (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Review captured photos"
                  className="absolute left-2 flex flex-col items-center gap-0.5 transition active:scale-95"
                >
                  <div className="h-12 w-12 overflow-hidden rounded-[10px] ring-1 ring-[color:var(--border)]" style={{ background: "var(--pill)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={lastCapturedUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                  <span className="text-[9px] font-semibold text-[color:var(--muted2)]">Review</span>
                </button>
              ) : null}
            </div>

            {bulkSaving && (
              <div className="mt-2 text-center text-[10px] text-[color:var(--muted)]">Saving…</div>
            )}
          </div>
          </>
        )}
      </div>
    </div>
  );
}

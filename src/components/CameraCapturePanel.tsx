"use client";

import { useEffect, useRef, useState } from "react";
import ScanCropEditor from "@/components/ScanCropEditor";
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
import { cropImageFile, type ScanCropRect } from "@/lib/scanners/cropImageFile";

type CameraPermissionState = "granted" | "prompt" | "denied" | "unknown";
type DetectionState = "idle" | "loading" | "ready" | "unavailable";
type DetectionBox = { x: number; y: number; width: number; height: number };

const DEFAULT_CROP: ScanCropRect = { left: 0, top: 0, right: 0, bottom: 0 };
const BULK_UNIVERSES = getUniverses();

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
}: {
  title: string;
  description: string;
  universe?: string | null;
  onCapture: (file: File) => void;
  onBulkCapture?: (file: File, category: string, subcategory: string) => void;
  onClose: () => void;
  onUseFileInstead: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const selectedDeviceIdRef = useRef("");
  const preferredDeviceIdRef = useRef("");
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
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
  const [detectionState, setDetectionState] = useState<DetectionState>("idle");
  const [detectionBox, setDetectionBox] = useState<DetectionBox | null>(null);
  const [isRemovingBackground, setIsRemovingBackground] = useState(false);
  const [backgroundError, setBackgroundError] = useState("");
  const [isBackgroundRemoved, setIsBackgroundRemoved] = useState(false);
  const [selectedBackgroundId, setSelectedBackgroundId] = useState("transparent");
  const [selectedFrameId, setSelectedFrameId] = useState("auto");
  const [showFineTune, setShowFineTune] = useState(false);
  // ── Bulk Add mode ──
  const [bulkMode, setBulkMode] = useState(false);
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

    async function refreshVideoDevices() {
      if (!navigator.mediaDevices?.enumerateDevices) return;

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!isActive) return;

        const cameras = devices.filter((device) => device.kind === "videoinput");
        setVideoDevices(cameras);

        const currentDeviceId = selectedDeviceIdRef.current;
        if (currentDeviceId && cameras.some((camera) => camera.deviceId === currentDeviceId)) {
          return;
        }

        setSelectedDeviceId(cameras[0]?.deviceId ?? "");
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

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Live camera is not available in this browser. Use the file picker instead.");
        return;
      }

      try {
        let stream: MediaStream;
        const preferredDeviceId = preferredDeviceIdRef.current;
        const requestedDevice = preferredDeviceId
          ? { deviceId: { exact: preferredDeviceId } }
          : true;

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
    if (capturedFile || cameraError || !cameraReady) {
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

    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas is not available.");

      ctx.drawImage(video, 0, 0, width, height);
      setBlurAssessment(assessCanvasBlur(canvas));

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.9);
      });

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
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Failed to capture photo.");
    } finally {
      setIsCapturing(false);
    }
  }

  async function handleUseCapturedPhoto() {
    if (!capturedFile) return;

    setIsApplyingCrop(true);

    try {
      const croppedFile = isDefaultCrop(captureCrop)
        ? capturedFile
        : await cropImageFile(capturedFile, captureCrop);

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
          onBulkCapture(finishedFile, bulkCategory, bulkSubcategory);
          setBulkSavedCount((n) => n + 1);
          // Reset for next shot
          handleRetakePhoto();
        } finally {
          setBulkSaving(false);
        }
      } else {
        onCapture(finishedFile);
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
      setCaptureCrop(DEFAULT_CROP);
      setIsBackgroundRemoved(true);
      setSelectedBackgroundId("vault");
    } catch {
      setBackgroundError("Background removal could not finish in this browser. The photo is still usable.");
    } finally {
      setIsRemovingBackground(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center bg-black/75 p-2 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex h-[calc(100dvh-1rem)] w-full max-w-[520px] flex-col overflow-y-auto overscroll-contain rounded-[18px] bg-[color:var(--surface)] p-2.5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:h-auto sm:max-h-[calc(100dvh-80px)] sm:absolute sm:top-[68px] sm:left-1/2 sm:-translate-x-1/2 sm:w-[calc(100%-24px)] sm:rounded-[18px]">
        {capturedFile ? (
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className="rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-sm ring-1 ring-[color:var(--border)]">Close</button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">LIVE CAMERA</div>
              <div className="mt-1 text-sm font-semibold text-[color:var(--fg)]">{title}</div>
              {description ? (
                <div className="mt-0.5 text-xs leading-5 text-[color:var(--muted)]">
                  {description}
                </div>
              ) : null}
            </div>
            <button type="button" onClick={onClose} className="rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-sm ring-1 ring-[color:var(--border)]">Close</button>
          </div>
        )}

        {capturedFile && capturedPreviewUrl ? (
          <div className="mt-1.5 pb-3">
            {/* Blur badge — only shown when the shot is soft */}
            {blurAssessment?.isBlurry ? (
              <div className="mb-1.5 flex items-center gap-2 rounded-[10px] bg-red-500/10 px-3 py-1.5 ring-1 ring-red-500/20">
                <span className="text-[11px] font-semibold text-red-300">⚠ Soft image</span>
                <span className="text-[11px] text-[color:var(--muted)]">Retake for sharper label detail.</span>
              </div>
            ) : null}
            <div className="mb-1.5 flex items-center gap-1.5 overflow-x-auto py-1 pl-1 [scrollbar-width:none]">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)]">
                Frame
              </span>
              <button
                type="button"
                onClick={() => setSelectedFrameId("auto")}
                className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition"
                style={
                  selectedFrameId === "auto"
                    ? { background: "var(--theme-gold-subtle, rgba(245,181,72,0.12))", borderColor: "var(--theme-gold-border, rgba(245,181,72,0.38))", color: "var(--theme-gold, #F5B548)" }
                    : { background: "var(--pill)", borderColor: "var(--border)", color: "var(--muted)" }
                }
              >
                Auto
              </button>
              {FRAME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedFrameId(preset.id)}
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition"
                  style={
                    selectedFrameId === preset.id
                      ? { background: "var(--theme-gold-subtle, rgba(245,181,72,0.12))", borderColor: "var(--theme-gold-border, rgba(245,181,72,0.38))", color: "var(--theme-gold, #F5B548)" }
                      : { background: "var(--pill)", borderColor: "var(--border)", color: "var(--muted)" }
                  }
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {/* Filter strip — moved above the image */}
            <div className="mb-1.5 flex items-center gap-1.5 overflow-x-auto py-1 pl-1 [scrollbar-width:none]">
              {CAPTURE_FILTER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedFilterId(preset.id)}
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition"
                  style={
                    selectedFilterId === preset.id
                      ? { background: "var(--theme-gold-subtle, rgba(245,181,72,0.12))", borderColor: "var(--theme-gold-border, rgba(245,181,72,0.38))", color: "var(--theme-gold, #F5B548)" }
                      : { background: "var(--pill)", borderColor: "var(--border)", color: "var(--muted)" }
                  }
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setSelectedFilterId("original"); setAdjustments(DEFAULT_CAPTURE_ADJUSTMENTS); }}
                className="ml-auto shrink-0 rounded-full bg-[color:var(--pill)] px-2.5 py-1 text-[11px] ring-1 ring-[color:var(--border)]"
              >
                Reset
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
              hideActionButtons
            />

            <div className="mt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleRetakePhoto}
                disabled={isApplyingCrop}
                className="rounded-full px-5 py-2.5 text-sm font-semibold ring-1 ring-[color:var(--border)] disabled:opacity-40"
                style={{ background: "var(--pill)", color: "var(--muted)" }}
              >
                ↩ Retake
              </button>
              <button
                type="button"
                onClick={() => void handleUseCapturedPhoto()}
                disabled={isApplyingCrop}
                className="rounded-full px-8 py-2.5 text-sm font-bold disabled:opacity-40"
                style={{ background: "var(--pill-active-bg)", color: "var(--fg)" }}
              >
                {isApplyingCrop ? "Saving..." : "Save"}
              </button>
            </div>

            <div className="mt-2 rounded-[18px] bg-[color:var(--surface)] p-2 ring-1 ring-[color:var(--border)]">
              <button
                type="button"
                onClick={() => setShowFineTune((value) => !value)}
                className="rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] ring-1 ring-[color:var(--border)]"
              >
                {showFineTune ? "Hide Fine Tune" : "Show Fine Tune"}
              </button>

              {showFineTune ? (
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
              ) : null}

              <div className="mt-2 rounded-2xl bg-[color:var(--pill)] p-2 ring-1 ring-[color:var(--border)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted2)]">
                      Background
                    </div>
                    <div className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                      Browser-only removal; no upload needed.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRemoveBackground()}
                    disabled={isRemovingBackground || !capturedFile}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold ring-1 disabled:opacity-45"
                    style={{
                      background: isBackgroundRemoved
                        ? "var(--theme-gold-subtle, rgba(245,181,72,0.12))"
                        : "var(--surface)",
                      borderColor: "var(--theme-gold-border, rgba(245,181,72,0.32))",
                      color: "var(--theme-gold, #F5B548)",
                    }}
                  >
                    {isRemovingBackground
                      ? "Removing..."
                      : isBackgroundRemoved
                        ? "Remove Again"
                        : "Remove BG"}
                  </button>
                </div>

                {backgroundError ? (
                  <div className="mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-[11px] text-red-200 ring-1 ring-red-500/20">
                    {backgroundError}
                  </div>
                ) : null}

                {isBackgroundRemoved ? (
                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                    {CAPTURE_BACKGROUNDS.map((background) => (
                      <button
                        key={background.id}
                        type="button"
                        onClick={() => setSelectedBackgroundId(background.id)}
                        className="shrink-0 rounded-xl px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] ring-1"
                        style={{
                          background: selectedBackgroundId === background.id
                            ? "var(--theme-gold-subtle, rgba(245,181,72,0.12))"
                            : "var(--surface)",
                          borderColor: selectedBackgroundId === background.id
                            ? "var(--theme-gold-border, rgba(245,181,72,0.38))"
                            : "var(--border)",
                          color: selectedBackgroundId === background.id
                            ? "var(--theme-gold, #F5B548)"
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
          </div>
        ) : (
          <>
            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto py-1 [scrollbar-width:none]">
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted2)]">
                Frame
              </span>
              <button
                type="button"
                onClick={() => setSelectedFrameId("auto")}
                className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition"
                style={
                  selectedFrameId === "auto"
                    ? { background: "var(--theme-gold-subtle, rgba(245,181,72,0.12))", borderColor: "var(--theme-gold-border, rgba(245,181,72,0.38))", color: "var(--theme-gold, #F5B548)" }
                    : { background: "var(--pill)", borderColor: "var(--border)", color: "var(--muted)" }
                }
              >
                Auto
              </button>
              {FRAME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedFrameId(preset.id)}
                  className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition"
                  style={
                    selectedFrameId === preset.id
                      ? { background: "var(--theme-gold-subtle, rgba(245,181,72,0.12))", borderColor: "var(--theme-gold-border, rgba(245,181,72,0.38))", color: "var(--theme-gold, #F5B548)" }
                      : { background: "var(--pill)", borderColor: "var(--border)", color: "var(--muted)" }
                  }
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="mt-2 overflow-hidden rounded-[16px] bg-[color:var(--surface)] p-1.5 ring-1 ring-[color:var(--border)]">
              <div
                  ref={videoContainerRef}
                  className="relative flex items-center justify-center overflow-hidden rounded-[12px] bg-[color:var(--surface)]"
                  style={{ height: "min(42dvh, 360px)", minHeight: "200px" }}
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
                    onCanPlay={() => setCameraReady(true)}
                    className="h-full w-full object-contain"
                  />
                )}

                {!cameraError ? (
                  <div
                    className="pointer-events-none absolute left-1/2 top-1/2 max-h-[82%] max-w-[82%] -translate-x-1/2 -translate-y-1/2 ring-2 ring-[color:var(--theme-gold)] shadow-[0_0_0_9999px_rgba(0,0,0,0.18)]"
                    style={{
                      aspectRatio: frame.aspectRatio,
                      borderRadius: frame.radius,
                      height: `calc(100% - ${frame.inset})`,
                      width: "auto",
                    }}
                  >
                    <div
                      className="absolute left-1/2 top-2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ring-1"
                      style={{
                        background: "rgba(0,0,0,0.48)",
                        borderColor: "var(--theme-gold-border, rgba(245,181,72,0.35))",
                        color: "var(--theme-gold, #F5B548)",
                      }}
                    >
                      {selectedFrameId === "auto" ? frame.label : selectedFramePreset?.label}
                    </div>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-semibold text-white/70 ring-1 ring-white/10">
                      Fill the guide, then tap capture
                    </div>
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

            {videoDevices.length >= 1 ? (
              <select
                value={selectedDeviceId}
                onChange={(event) => {
                  const nextDeviceId = event.target.value;
                  selectedDeviceIdRef.current = nextDeviceId;
                  preferredDeviceIdRef.current = nextDeviceId;
                  setSelectedDeviceId(nextDeviceId);
                  setRetryCount((count) => count + 1);
                }}
                className="mt-2 w-full h-8 rounded-xl bg-[color:var(--pill)] px-3 text-xs text-[color:var(--fg)] ring-1 ring-[color:var(--border)] focus:outline-none"
                aria-label="Select camera"
              >
                {videoDevices.map((device, index) => (
                  <option key={device.deviceId || index} value={device.deviceId}>
                    {device.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>
            ) : null}

            {/* ── Bulk Mode controls (shown above shutter when bulk on) ── */}
            {bulkMode && (
              <div className="mt-2 rounded-[14px] bg-[color:var(--pill)] px-3 py-2 ring-1 ring-[color:var(--theme-gold-border,rgba(245,181,72,0.25))]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em]"
                    style={{ background: "rgba(245,181,72,0.14)", color: "#F5B548" }}>
                    ⚡ Bulk Mode
                  </span>
                  {bulkSavedCount > 0 && (
                    <span className="text-[11px] font-semibold text-[color:var(--muted)]">
                      {bulkSavedCount} saved
                    </span>
                  )}
                </div>
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
              </div>
            )}

            {/* Single camera button row */}
            <div className="mt-3 mb-1 flex items-center justify-center gap-8">
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="text-xs font-medium text-[color:var(--muted)] transition hover:text-[color:var(--fg)]"
              >
                Retry
              </button>

              <button
                type="button"
                onClick={() => void handleCapture()}
                disabled={Boolean(cameraError) || !cameraReady || isCapturing}
                aria-label="Capture photo"
                className="flex items-center justify-center rounded-full transition-transform active:scale-95 disabled:opacity-40"
                style={{
                  width: 68,
                  height: 68,
                  background: "linear-gradient(145deg, #FFE08A 0%, #F5B548 30%, #C8941F 60%, #8B6914 100%)",
                  boxShadow: [
                    "0 0 0 3px #0B0B0B",
                    "0 0 0 4px rgba(245,181,72,0.30)",
                    "0 8px 24px rgba(245,181,72,0.50)",
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

              <button
                type="button"
                onClick={onUseFileInstead}
                className="text-xs font-medium text-[color:var(--muted)] transition hover:text-[color:var(--fg)]"
              >
                File
              </button>
            </div>

            {/* ── Bulk Add toggle — sleeper feature ── */}
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setBulkMode((v) => !v)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold ring-1 transition"
                style={bulkMode
                  ? { background: "rgba(245,181,72,0.12)", borderColor: "rgba(245,181,72,0.35)", color: "#F5B548" }
                  : { background: "var(--pill)", borderColor: "var(--border)", color: "var(--muted2)" }
                }
              >
                <span
                  className="inline-block h-2 w-2 rounded-full transition-colors"
                  style={{ background: bulkMode ? "#F5B548" : "var(--muted2)" }}
                />
                Bulk Add
              </button>
              {bulkSaving && (
                <span className="text-[10px] text-[color:var(--muted)]">Saving…</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

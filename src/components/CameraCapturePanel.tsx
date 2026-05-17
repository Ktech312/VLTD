"use client";

import { useEffect, useRef, useState } from "react";

import ScanCropEditor from "@/components/ScanCropEditor";
import {
  buildCaptureFilterCss,
  CAPTURE_FILTER_PRESETS,
  DEFAULT_CAPTURE_ADJUSTMENTS,
  isOriginalCaptureTreatment,
  type CaptureAdjustments,
} from "@/components/capture/captureFilters";
import {
  getCaptureFrame,
  getCaptureUniverseLabel,
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
  onClose,
  onUseFileInstead,
}: {
  title: string;
  description: string;
  universe?: string | null;
  onCapture: (file: File) => void;
  onClose: () => void;
  onUseFileInstead: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const selectedDeviceIdRef = useRef("");
  const preferredDeviceIdRef = useRef("");
  const [cameraError, setCameraError] = useState("");
  const [isStarting, setIsStarting] = useState(true);
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
  const [selectedFrameId, setSelectedFrameId] = useState("");
  const [showFineTune, setShowFineTune] = useState(false);

  const activeFilter =
    CAPTURE_FILTER_PRESETS.find((preset) => preset.id === selectedFilterId) ??
    CAPTURE_FILTER_PRESETS[0];
  const imageFilter = buildCaptureFilterCss(activeFilter, adjustments);
  const selectedFramePreset = FRAME_PRESETS.find((preset) => preset.id === selectedFrameId);
  const frame = selectedFramePreset?.frame ?? getCaptureFrame(universe);
  const universeLabel = getCaptureUniverseLabel(universe);
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
        setIsStarting(false);
        return;
      }

      stopCameraStream();
      setCameraError("");
      setIsStarting(true);

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Live camera is not available in this browser. Use the file picker instead.");
        setIsStarting(false);
        return;
      }

      try {
        let stream: MediaStream;
        const preferredDeviceId = preferredDeviceIdRef.current;
        const requestedDevice = preferredDeviceId
          ? {
              deviceId: { exact: preferredDeviceId },
            }
          : {
              facingMode: { ideal: "environment" },
            };

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
          await videoRef.current.play().catch(() => undefined);
        }
      } catch (error) {
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
      } finally {
        if (isActive) {
          setIsStarting(false);
        }
      }
    }

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
    if (capturedFile || cameraError || isStarting) {
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
  }, [cameraError, capturedFile, isStarting, retryCount]);

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
      setCaptureCrop(DEFAULT_CROP);
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

      onCapture(finishedFile);
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
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-2 backdrop-blur-sm sm:items-center sm:p-3" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-y-auto overscroll-contain rounded-t-[18px] bg-[color:var(--surface)] p-2.5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:max-h-[calc(100dvh-1.5rem)] sm:rounded-[18px]">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              {capturedFile ? "ADJUST PHOTO" : "LIVE CAMERA"}
            </div>
            <h2 className="mt-0.5 text-base font-semibold text-[color:var(--fg)]">{capturedFile ? "Adjust Photo" : title}</h2>
            <div className="mt-0.5 max-w-xl text-xs leading-snug text-[color:var(--muted)]">{description}</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-sm ring-1 ring-[color:var(--border)]"
          >
            Close
          </button>
        </div>

        {capturedFile && capturedPreviewUrl ? (
          <div className="mt-2">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {FRAME_PRESETS.map((preset) => {
                const isSelected = selectedFrameId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedFrameId(preset.id)}
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition"
                    style={
                      isSelected
                        ? {
                            background: "var(--theme-gold-subtle, rgba(245,181,72,0.12))",
                            borderColor: "var(--theme-gold-border, rgba(245,181,72,0.38))",
                            color: "var(--theme-gold, #F5B548)",
                          }
                        : {
                            background: "var(--pill)",
                            borderColor: "var(--border)",
                            color: "var(--muted)",
                          }
                    }
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {blurAssessment?.isBlurry ? (
              <div className="mb-2 rounded-2xl bg-[color:var(--pill)] px-3 py-2 text-xs ring-1 ring-[color:var(--theme-gold-border,rgba(245,181,72,0.32))]">
                <div className="font-semibold text-[color:var(--theme-gold,#F5B548)]">
                  Soft focus detected
                </div>
                <div className="mt-0.5 text-[color:var(--muted)]">
                  Retake if this is for identification or insurance. Score: {blurAssessment.score.toFixed(1)}.
                </div>
              </div>
            ) : null}

            <ScanCropEditor
              imageUrl={capturedPreviewUrl}
              crop={captureCrop}
              onChange={setCaptureCrop}
              title="ADJUST PHOTO"
              description="Move or resize the crop box here before this photo is added to the item."
              applyLabel="Use Photo"
              onApply={() => void handleUseCapturedPhoto()}
              onReset={() => setCaptureCrop(DEFAULT_CROP)}
              onCancel={handleRetakePhoto}
              imageFilter={imageFilter}
              isApplying={isApplyingCrop}
              compact
              compactViewport="short"
            />

            <div className="mt-2 rounded-[18px] bg-[color:var(--surface)] p-2 ring-1 ring-[color:var(--border)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[10px] tracking-[0.2em] text-[color:var(--muted2)]">
                    CAPTURE STUDIO
                  </div>
                  <div className="mt-0.5 text-[11px] text-[color:var(--muted)]">
                    Filters and adjustments are applied when you use the photo.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFilterId("original");
                    setAdjustments(DEFAULT_CAPTURE_ADJUSTMENTS);
                  }}
                  className="rounded-full bg-[color:var(--pill)] px-3 py-1 text-xs ring-1 ring-[color:var(--border)]"
                >
                  Reset
                </button>
              </div>

              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                {CAPTURE_FILTER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setSelectedFilterId(preset.id)}
                    className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 transition"
                    style={
                      selectedFilterId === preset.id
                        ? {
                            background: "var(--theme-gold-subtle, rgba(245,181,72,0.12))",
                            borderColor: "var(--theme-gold-border, rgba(245,181,72,0.38))",
                            color: "var(--theme-gold, #F5B548)",
                          }
                        : {
                            background: "var(--pill)",
                            borderColor: "var(--border)",
                            color: "var(--muted)",
                          }
                    }
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowFineTune((value) => !value)}
                className="mt-2 rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted)] ring-1 ring-[color:var(--border)]"
              >
                Fine Tune {showFineTune ? "▴" : "▾"}
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
            <div className="mt-2 overflow-hidden rounded-[16px] bg-[color:var(--surface)] p-1.5 ring-1 ring-[color:var(--border)]">
              <div className="relative flex h-[min(36dvh,320px)] min-h-[190px] items-center justify-center overflow-hidden rounded-[12px] bg-[color:var(--surface)]">
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
                    className="h-full w-full object-contain"
                  />
                )}

                {!cameraError ? (
                  <div
                    className="pointer-events-none absolute left-1/2 top-1/2 flex max-h-[82%] max-w-[82%] -translate-x-1/2 -translate-y-1/2 items-start justify-center ring-2 ring-[color:var(--theme-gold)] shadow-[0_0_0_9999px_rgba(0,0,0,0.18)]"
                    style={{
                      aspectRatio: frame.aspectRatio,
                      borderRadius: frame.radius,
                      height: `calc(100% - ${frame.inset})`,
                      width: "auto",
                    }}
                  >
                    <div
                      className="mt-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ring-1"
                      style={{
                        background: "rgba(0,0,0,0.48)",
                        borderColor: "var(--theme-gold-border, rgba(245,181,72,0.35))",
                        color: "var(--theme-gold, #F5B548)",
                      }}
                    >
                      {universeLabel} · {frame.label}
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

            {videoDevices.length > 1 ? (
              <select
                value={selectedDeviceId}
                onChange={(event) => {
                  const nextDeviceId = event.target.value;
                  selectedDeviceIdRef.current = nextDeviceId;
                  preferredDeviceIdRef.current = nextDeviceId;
                  setSelectedDeviceId(nextDeviceId);
                  setRetryCount((count) => count + 1);
                }}
                className="mt-2 h-8 rounded-xl bg-[color:var(--pill)] px-3 text-xs text-[color:var(--fg)] ring-1 ring-[color:var(--border)] focus:outline-none"
                aria-label="Select camera"
              >
                {videoDevices.map((device, index) => (
                  <option key={device.deviceId || index} value={device.deviceId}>
                    {device.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>
            ) : null}

            <div className="mt-2 grid gap-2">
              <button
                type="button"
                onClick={() => void handleCapture()}
                disabled={Boolean(cameraError) || isStarting || isCapturing}
                className="vltd-primary-button min-h-11 rounded-xl px-3 py-2 text-sm font-black transition disabled:opacity-40"
              >
                {isStarting ? "Starting Camera..." : isCapturing ? "Capturing..." : "Capture Photo"}
              </button>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setRetryCount((count) => count + 1)}
                  className="min-h-10 rounded-xl bg-[color:var(--pill)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)]"
                >
                  Retry Camera
                </button>
                <button
                  type="button"
                  onClick={onUseFileInstead}
                  className="min-h-10 rounded-xl bg-[color:var(--pill)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)]"
                >
                  Choose File
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

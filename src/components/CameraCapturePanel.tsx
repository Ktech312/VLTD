"use client";

import { useEffect, useRef, useState } from "react";

import ScanCropEditor from "@/components/ScanCropEditor";
import { cropImageFile, type ScanCropRect } from "@/lib/scanners/cropImageFile";

type CameraPermissionState = "granted" | "prompt" | "denied" | "unknown";

const DEFAULT_CROP: ScanCropRect = { left: 0, top: 0, right: 0, bottom: 0 };

function isDefaultCrop(crop: ScanCropRect) {
  return crop.left === 0 && crop.top === 0 && crop.right === 0 && crop.bottom === 0;
}

export default function CameraCapturePanel({
  title,
  onCapture,
  onClose,
  onUseFileInstead,
}: {
  title: string;
  description: string;
  onCapture: (file: File) => void;
  onClose: () => void;
  onUseFileInstead: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
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

        if (selectedDeviceId && cameras.some((camera) => camera.deviceId === selectedDeviceId)) {
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
        const requestedDevice = selectedDeviceId
          ? {
              deviceId: { exact: selectedDeviceId },
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

    void readPermissionState();
    void startCamera();

    return () => {
      isActive = false;
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
      stopCameraStream();
    };
  }, [capturedFile, retryCount, selectedDeviceId]);

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
      const finalFile = isDefaultCrop(captureCrop)
        ? capturedFile
        : await cropImageFile(capturedFile, captureCrop);

      onCapture(finalFile);
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
    setRetryCount((count) => count + 1);
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/75 p-2 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="mx-auto flex max-h-[calc(100dvh-1rem)] max-w-3xl flex-col overflow-hidden rounded-[22px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:max-h-[calc(100dvh-2rem)] sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              {capturedFile ? "ADJUST PHOTO" : "LIVE CAMERA"}
            </div>
            <h2 className="mt-1 text-lg font-semibold text-[color:var(--fg)]">{capturedFile ? "Adjust Photo" : title}</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[color:var(--pill)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)]"
          >
            Close
          </button>
        </div>

        {capturedFile && capturedPreviewUrl ? (
          <div className="mt-3 min-h-0 overflow-hidden">
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
              isApplying={isApplyingCrop}
              compact
            />
          </div>
        ) : (
          <>
            <div className="mt-3 overflow-hidden rounded-[18px] bg-black/30 p-2 ring-1 ring-[color:var(--border)]">
              <div className="flex h-[58dvh] min-h-[260px] max-h-[560px] items-center justify-center overflow-hidden rounded-[14px] bg-black/30">
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
              </div>
            </div>

            {videoDevices.length > 1 ? (
              <select
                value={selectedDeviceId}
                onChange={(event) => setSelectedDeviceId(event.target.value)}
                className="mt-2 h-9 rounded-xl bg-[color:var(--pill)] px-3 text-xs text-[color:var(--fg)] ring-1 ring-[color:var(--border)] focus:outline-none"
                aria-label="Select camera"
              >
                {videoDevices.map((device, index) => (
                  <option key={device.deviceId || index} value={device.deviceId}>
                    {device.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>
            ) : null}

            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => void handleCapture()}
                disabled={Boolean(cameraError) || isStarting || isCapturing}
                className="min-h-12 rounded-2xl bg-[color:var(--pill-active-bg)] px-4 py-3 text-sm font-medium text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-bg)] disabled:opacity-40"
              >
                {isStarting ? "Starting Camera..." : isCapturing ? "Capturing..." : "Capture Photo"}
              </button>
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="min-h-12 rounded-2xl bg-[color:var(--pill)] px-4 py-3 text-sm ring-1 ring-[color:var(--border)]"
              >
                Retry Camera
              </button>
              <button
                type="button"
                onClick={onUseFileInstead}
                className="min-h-12 rounded-2xl bg-[color:var(--pill)] px-4 py-3 text-sm ring-1 ring-[color:var(--border)]"
              >
                Choose File Instead
              </button>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-1">
              <button
                type="button"
                onClick={onClose}
                className="min-h-12 rounded-2xl bg-[color:var(--pill)] px-4 py-3 text-sm ring-1 ring-[color:var(--border)]"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

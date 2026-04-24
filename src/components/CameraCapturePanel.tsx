"use client";

import { useEffect, useRef, useState } from "react";

type CameraPermissionState = "granted" | "prompt" | "denied" | "unknown";

export default function CameraCapturePanel({
  title,
  description,
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
  const [isSecureContextValue, setIsSecureContextValue] = useState(true);
  const [hostLabel, setHostLabel] = useState("");
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

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
        setIsSecureContextValue(window.isSecureContext);
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

    function stopStream() {
      const stream = streamRef.current;
      streamRef.current = null;
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }

    async function startCamera() {
      stopStream();
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
      stopStream();
    };
  }, [retryCount, selectedDeviceId]);

  const helpItems = [
    `Camera permission is per site. Even if camera works in other apps, you still need to allow it for ${hostLabel || "this site"}.`,
    "Click the lock or camera icon in the address bar, open site settings, and set Camera to Allow for this site.",
    "Reload the page after changing the permission.",
    "If another app, browser tab, Zoom, Teams, or OBS is using the camera, close it and try again.",
    "If this page is not on HTTPS or localhost, the browser may refuse camera access entirely.",
  ];

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

      onCapture(
        new File([blob], `camera-capture-${Date.now()}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        })
      );
    } catch (error) {
      setCameraError(error instanceof Error ? error.message : "Failed to capture photo.");
    } finally {
      setIsCapturing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/75 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="mx-auto flex h-full max-w-3xl flex-col rounded-[24px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">LIVE CAMERA</div>
            <h2 className="mt-1 text-xl font-semibold text-[color:var(--fg)]">{title}</h2>
            <div className="mt-1 text-sm text-[color:var(--muted)]">{description}</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[color:var(--pill)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)]"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-hidden rounded-[20px] bg-black/30 p-2 ring-1 ring-[color:var(--border)]">
          <div className="flex h-full min-h-[280px] items-center justify-center overflow-hidden rounded-[16px] bg-black/30">
            {cameraError ? (
              <div className="max-w-lg px-5 text-center text-sm text-red-200">{cameraError}</div>
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

        <div className="mt-4 rounded-[18px] bg-black/10 p-3 ring-1 ring-white/8">
          <div className="text-[11px] tracking-[0.16em] text-[color:var(--muted2)]">CAMERA HELP</div>
          <div className="mt-2 grid gap-2 text-xs text-[color:var(--muted)] sm:grid-cols-3">
            <div className="rounded-xl bg-[color:var(--pill)] px-3 py-2 ring-1 ring-[color:var(--border)]">
              Permission: <span className="font-medium text-[color:var(--fg)]">{permissionLabel}</span>
            </div>
            <div className="rounded-xl bg-[color:var(--pill)] px-3 py-2 ring-1 ring-[color:var(--border)]">
              Secure context: <span className="font-medium text-[color:var(--fg)]">{isSecureContextValue ? "Yes" : "No"}</span>
            </div>
            <div className="rounded-xl bg-[color:var(--pill)] px-3 py-2 ring-1 ring-[color:var(--border)]">
              Site: <span className="font-medium text-[color:var(--fg)]">{hostLabel || "Unknown"}</span>
            </div>
          </div>

          <div className="mt-3 text-xs text-[color:var(--muted)]">
            {permissionState === "denied"
              ? "This usually means the browser blocked camera access for this site specifically."
              : "If camera works in other browser apps but not here, the most common cause is site-specific permission settings."}
          </div>

          {videoDevices.length > 1 ? (
            <label className="mt-3 grid gap-1.5 text-xs text-[color:var(--muted)]">
              <span className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--muted2)]">
                Select Camera
              </span>
              <select
                value={selectedDeviceId}
                onChange={(event) => setSelectedDeviceId(event.target.value)}
                className="h-10 rounded-xl bg-[color:var(--pill)] px-3 text-sm text-[color:var(--fg)] ring-1 ring-[color:var(--border)] focus:outline-none"
              >
                {videoDevices.map((device, index) => (
                  <option key={device.deviceId || index} value={device.deviceId}>
                    {device.label || `Camera ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-[color:var(--muted)]">
            {helpItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
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
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    let isActive = true;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Live camera is not available in this browser. Use the file picker instead.");
        setIsStarting(false);
        return;
      }

      try {
        let stream: MediaStream;

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: "environment" },
            },
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

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch (error) {
        setCameraError(
          error instanceof Error
            ? error.message
            : "Camera access failed. Use the file picker instead."
        );
      } finally {
        if (isActive) {
          setIsStarting(false);
        }
      }
    }

    void startCamera();

    return () => {
      isActive = false;
      const stream = streamRef.current;
      streamRef.current = null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

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
              <div className="max-w-md px-5 text-center text-sm text-red-200">{cameraError}</div>
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
            onClick={onUseFileInstead}
            className="min-h-12 rounded-2xl bg-[color:var(--pill)] px-4 py-3 text-sm ring-1 ring-[color:var(--border)]"
          >
            Choose File Instead
          </button>
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

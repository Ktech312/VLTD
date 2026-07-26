"use client";

import { useRef, useState } from "react";

function CameraIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

type CaptureCameraProps = {
  onCapture?: (file: File) => void;
  onOpenCamera?: () => void;
};

export default function CaptureCamera({ onCapture, onOpenCamera }: CaptureCameraProps = {}) {
  // Separate refs: one for camera-only, one for file picker
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");

  function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    onCapture?.(file);
  }

  return (
    <div className="rounded-[30px] border border-[color:var(--border)] bg-vault-card p-4 shadow-[0_18px_56px_rgba(0,0,0,0.24)]">
      {/* Camera-only input — triggers native camera on iOS & Android */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {/* File picker input — no capture attribute so it shows gallery/files */}
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {/* Camera hero button */}
      <button
        type="button"
        onClick={() => {
          if (onOpenCamera) {
            onOpenCamera();
            return;
          }
          cameraRef.current?.click();
        }}
        className="group relative flex min-h-[260px] w-full flex-col items-center justify-center overflow-hidden rounded-[24px] border border-dashed px-5 text-center transition hover:-translate-y-0.5"
        style={{
          borderColor: "var(--theme-gold-border, rgba(203,208,213,0.35))",
          background: "radial-gradient(circle at 50% 0%, var(--theme-gold-subtle, rgba(203,208,213,0.08)), rgba(5,11,21,0.62) 100%)",
        }}
      >
        <div
          className="absolute inset-x-8 top-8 h-24 rounded-full blur-3xl transition"
          style={{ background: "var(--theme-gold-subtle, rgba(203,208,213,0.10))" }}
        />
        <div
          className="relative grid h-20 w-20 place-items-center rounded-[24px]"
          style={{
            border: "1px solid var(--theme-gold-border, rgba(203,208,213,0.25))",
            background: "var(--theme-gold-subtle, rgba(203,208,213,0.08))",
            boxShadow: "0 18px 42px rgba(203,208,213,0.10)",
            color: "var(--theme-gold, #C8CDD2)",
          }}
        >
          <CameraIcon />
        </div>
        <div className="relative mt-4 text-xl font-black tracking-[-0.03em] text-text-primary">
          Open Camera
        </div>
        <div className="relative mt-1 max-w-[220px] text-xs leading-5 text-[color:var(--muted)]">
          Tap to capture with your camera
        </div>
        <div
          className="relative mt-4 inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-black text-[#0B0B0B]"
          style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)" }}
        >
          Open Camera
        </div>
      </button>

      {/* Upload fallback row */}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => uploadRef.current?.click()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[color:var(--border)] bg-vault-card px-4 py-3 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
        >
          <UploadIcon />
          Upload from library
        </button>
        <div className="rounded-2xl border border-[color:var(--border)] bg-vault-card px-3 py-3 text-xs text-[color:var(--muted)]">
          {fileName ? (
            <span className="font-semibold text-text-primary">{fileName.slice(0, 18)}{fileName.length > 18 ? "…" : ""}</span>
          ) : (
            "No photo yet"
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { scanBarcodeFromVideoFrame, type BarcodeScanResult } from "@/lib/scanners/barcodeScanner";

/** Dedicated live-barcode-scan camera.
 *  Scans every 350ms automatically (like a native phone scanner).
 *  Falls back to a manual barcode button at top-right if needed.
 */
export default function BarcodeScanCamera({
  onScan,
  onClose,
}: {
  onScan: (result: BarcodeScanResult) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const hasScannedRef = useRef(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [scanned, setScanned] = useState(false);
  const [scannedCode, setScannedCode] = useState("");
  const [manualFeedback, setManualFeedback] = useState<"" | "none" | "ok">("");

  // Start the camera stream
  useEffect(() => {
    let active = true;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera not available in this browser.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      } catch {
        if (active) setCameraError("Camera access was denied or is unavailable.");
      }
    }

    void start();

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const fireSuccess = useCallback(
    (result: BarcodeScanResult) => {
      if (hasScannedRef.current) return;
      hasScannedRef.current = true;
      setScanned(true);
      // A letters-only QR payload (e.g. a shortlink) has no digits -- show the
      // raw decoded text instead of leaving the success badge blank.
      setScannedCode(result.digits || result.rawValue);
      // Haptic feedback if available
      try { navigator.vibrate?.(80); } catch { /* ignore */ }
      // Brief success flash, then hand off
      setTimeout(() => onScan(result), 600);
    },
    [onScan]
  );

  // Continuous auto-scan loop
  useEffect(() => {
    if (!cameraReady || scanned) return;

    intervalRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || hasScannedRef.current) return;
      const result = scanBarcodeFromVideoFrame(video);
      if (result) fireSuccess(result);
    }, 350);

    return () => {
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  }, [cameraReady, scanned, fireSuccess]);

  // Manual scan button handler
  function handleManualScan() {
    const video = videoRef.current;
    if (!video) return;
    const result = scanBarcodeFromVideoFrame(video);
    if (result) {
      fireSuccess(result);
    } else {
      setManualFeedback("none");
      setTimeout(() => setManualFeedback(""), 1500);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      aria-label="Barcode Scanner"
    >
      {/* Video */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        onCanPlay={() => setCameraReady(true)}
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Dark overlay with scanning window cut-out */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        {/* Top dark band */}
        <div className="w-full flex-1 bg-black/60" />
        {/* Middle row: dark | clear window | dark */}
        <div className="flex w-full" style={{ height: 220 }}>
          <div className="flex-1 bg-black/60" />
          {/* Scan window */}
          <div
            className="relative"
            style={{ width: 280, height: 220 }}
          >
            {/* Corner marks */}
            {[
              "top-0 left-0 border-t-2 border-l-2 rounded-tl-lg",
              "top-0 right-0 border-t-2 border-r-2 rounded-tr-lg",
              "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg",
              "bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg",
            ].map((cls, i) => (
              <div
                key={i}
                className={`absolute w-8 h-8 border-[#C8CDD2] ${cls}`}
              />
            ))}
            {/* Animated sweep line */}
            {!scanned && (
              <div
                className="absolute left-2 right-2 h-0.5 bg-[#C8CDD2]/70"
                style={{ animation: "barcode-sweep 1.8s ease-in-out infinite" }}
              />
            )}
            {/* Success state */}
            {scanned && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#C8CDD2]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-[#C8CDD2]">
                  {scannedCode}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1 bg-black/60" />
        </div>
        {/* Bottom dark band */}
        <div className="w-full flex-1 bg-black/60" />
      </div>

      {/* Sweep line CSS animation */}
      <style>{`
        @keyframes barcode-sweep {
          0%   { top: 8px;   opacity: 1; }
          48%  { top: calc(100% - 10px); opacity: 1; }
          50%  { opacity: 0; }
          52%  { top: 8px;   opacity: 0; }
          54%  { opacity: 1; }
          100% { top: 8px;   opacity: 1; }
        }
      `}</style>

      {/* UI overlay */}
      <div className="relative z-10 flex flex-col h-full pointer-events-none">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-safe pt-4 pointer-events-auto">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-black/50 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm"
          >
            Cancel
          </button>

          {/* Manual scan button — fallback if auto doesn't fire */}
          <button
            type="button"
            onClick={handleManualScan}
            disabled={!cameraReady || scanned}
            className="flex flex-col items-center gap-0.5 rounded-2xl bg-black/50 px-3 py-2 ring-1 ring-white/20 backdrop-blur-sm disabled:opacity-40"
            title="Tap to scan now"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={manualFeedback === "none" ? "#ef4444" : "#C8CDD2"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="1" width="4" height="22" rx="1" />
              <rect x="7" y="1" width="1" height="22" rx="0.5" />
              <rect x="10" y="1" width="3" height="22" rx="0.5" />
              <rect x="15" y="1" width="2" height="22" rx="0.5" />
              <rect x="19" y="1" width="1" height="22" rx="0.5" />
              <rect x="22" y="1" width="1" height="22" rx="0.5" />
            </svg>
            <span className="text-[9px] font-semibold text-white/80">
              {manualFeedback === "none" ? "Not found" : "Scan"}
            </span>
          </button>
        </div>

        {/* Centre hint */}
        <div className="flex flex-1 flex-col items-center justify-end pb-16">
          <div className="rounded-full bg-black/55 px-4 py-2 text-center text-sm font-medium text-white/80 backdrop-blur-sm pointer-events-none">
            {cameraError
              ? cameraError
              : scanned
              ? "Looking up product…"
              : "Point at a barcode — scanning automatically"}
          </div>
        </div>
      </div>
    </div>
  );
}

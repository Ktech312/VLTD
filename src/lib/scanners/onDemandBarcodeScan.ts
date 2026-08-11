import type { LiveBarcodeResult } from "./liveBarcodeReader";
import { normalizeFormatName, scanBarcodeFromVideoFrame, type BarcodeScanResult } from "./barcodeScanner";

/** On-demand (tap-to-scan) barcode/QR reading, replacing the old always-on
 *  live scanner that ran the whole time a camera was open.
 *
 *  Two real problems with the old approach (see liveBarcodeReader.ts's own
 *  history + HANDOFF.md): it was a plain JavaScript decode loop running
 *  continuously for as long as the camera stayed open, which (a) never
 *  reliably read a code on EK's phone and (b) pinned the CPU hard enough to
 *  overheat the device. EK's own steer: a normal camera app scans without
 *  heating up because it hands the work to the OS, not a JS loop.
 *
 *  This module fixes both axes:
 *  1. Where the browser supports it (`window.BarcodeDetector` — Chrome/Edge/
 *     Android Chrome, backed by the OS's own recognizer, not JS), use that.
 *     Near-zero CPU cost since the browser does the work.
 *  2. Where it isn't supported (Safari on iOS has no such API and Apple has
 *     given no sign of adding it), fall back to the existing ZXing JS loop --
 *     but only for a short, deliberately-triggered window (a few seconds
 *     after a tap), not for the entire time the camera is open. Bounding the
 *     runtime is what actually fixes the heat/battery complaint on Safari,
 *     since the JS loop's total run time drops from "however long you spend
 *     framing a photo" to one short burst.
 *
 *  Callers should only start a session when the user deliberately asks for
 *  one (a tap), and let it stop itself after `durationMs` if nothing is
 *  found -- never wire this to run automatically just because a camera is
 *  open. That on-demand behavior, not the detector choice, is the other half
 *  of the fix.
 */

export type OnDemandScanEngine = "native" | "js-fallback";

export type OnDemandScanDiagnostic = {
  engine: OnDemandScanEngine;
  attempts: number;
  elapsedMs: number;
};

export type OnDemandScanOptions = {
  /** How long a single burst runs before giving up and reporting a timeout.
   *  Short on purpose -- this is a deliberate "point and hold" action, not a
   *  standing background scan. */
  durationMs?: number;
  onResult: (result: LiveBarcodeResult) => void;
  onTimeout?: () => void;
  /** Fires once, synchronously, so the UI can say which engine is running
   *  (useful for diagnosing a real-device report of "still slow/hot"). */
  onEngine?: (engine: OnDemandScanEngine) => void;
  /** Fires a few times/sec with a live attempt count + elapsed time, so a
   *  real-device report of "nothing happened" can be told apart from "it
   *  ran the whole burst and genuinely found nothing" -- on-screen, not just
   *  console, since EK doesn't have devtools open on a phone. */
  onDiagnostic?: (d: OnDemandScanDiagnostic) => void;
};

const NATIVE_FORMATS = [
  "qr_code",
  "upc_a",
  "upc_e",
  "ean_13",
  "ean_8",
  "code_128",
  "code_39",
  "data_matrix",
];

export function isNativeBarcodeDetectorSupported(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}

function toBarcodeScanResult(rawValue: string, format: string): BarcodeScanResult {
  return {
    rawValue,
    digits: rawValue.replace(/\D/g, ""),
    format: normalizeFormatName(format.toUpperCase()),
    region: "live",
  };
}

/** Runs the native BarcodeDetector against a live <video> on a
 *  requestAnimationFrame loop, throttled to a few checks/sec -- the browser's
 *  own detector is cheap, but there's no reason to call it 60x/sec either. */
function startNativeScan(
  video: HTMLVideoElement,
  onResult: (result: LiveBarcodeResult) => void,
  minIntervalMs: number,
  onDiagnostic?: (d: { attempts: number; elapsedMs: number; lastError: string }) => void
): () => void {
  let stopped = false;
  let rafId: number | null = null;
  let lastCheck = 0;
  let attempts = 0;
  let lastError = "";
  const startedAt = typeof performance !== "undefined" ? performance.now() : 0;
  // BarcodeDetector is a real browser global once feature-detected by the
  // caller; TS's DOM lib doesn't ship types for it yet on every target.
  const DetectorCtor = (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string; format: string }>> } }).BarcodeDetector;
  const detector = new DetectorCtor({ formats: NATIVE_FORMATS });

  async function tick(now: number) {
    if (stopped) return;
    if (now - lastCheck < minIntervalMs) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    lastCheck = now;
    try {
      const codes = await detector.detect(video);
      if (stopped) return;
      attempts += 1;
      if (codes && codes.length > 0) {
        const first = codes[0];
        if (first.rawValue) {
          onResult(toBarcodeScanResult(first.rawValue, first.format || "unknown"));
          return; // caller's onResult is expected to stop() the session
        }
      }
    } catch (e) {
      // detect() can throw if the video frame isn't ready yet -- ignore and
      // retry next tick rather than tearing down the whole session over it.
      attempts += 1;
      lastError = (e as { name?: string })?.name || "err";
    }
    onDiagnostic?.({ attempts, elapsedMs: (typeof performance !== "undefined" ? performance.now() : 0) - startedAt, lastError });
    if (!stopped) rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  return () => {
    stopped = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
  };
}

/** Runs the region-cropping decoder (`scanBarcodeFromVideoFrame` --
 *  barcodeScanner.ts) against a live <video> on a requestAnimationFrame loop.
 *  Used as the Safari/no-native-detector fallback INSTEAD of ZXing's own
 *  whole-frame `decodeContinuously`: a real-device test (2026-08-10, a
 *  graded slab's QR at normal scanning distance) showed 9 genuine decode
 *  attempts over 6.7s against the raw video frame, on a code that was
 *  clearly legible on screen, and none of them hit. That's the same
 *  "code is small relative to the whole frame" problem the OLD hand-rolled
 *  scanner's region-cropping + upscaling existed to solve in the first
 *  place (see barcodeScanner.ts's own history) -- decoding the raw frame
 *  loses exactly the resolution a small code needs. That old approach's
 *  real problem was never the cropping/upscaling itself, it was that it ran
 *  continuously for as long as the camera stayed open; bounding it to one
 *  on-demand burst here keeps the accuracy win without the heat cost. */
function startRegionScan(
  video: HTMLVideoElement,
  onResult: (result: LiveBarcodeResult) => void,
  minIntervalMs: number,
  onDiagnostic?: (d: { attempts: number; elapsedMs: number }) => void
): () => void {
  let stopped = false;
  let rafId: number | null = null;
  let lastCheck = 0;
  let attempts = 0;
  const startedAt = typeof performance !== "undefined" ? performance.now() : 0;

  function tick(now: number) {
    if (stopped) return;
    if (now - lastCheck < minIntervalMs) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    lastCheck = now;
    attempts += 1;
    const result = scanBarcodeFromVideoFrame(video);
    onDiagnostic?.({ attempts, elapsedMs: (typeof performance !== "undefined" ? performance.now() : 0) - startedAt });
    if (result) {
      onResult(result);
      return; // caller's onResult is expected to stop() the session
    }
    if (!stopped) rafId = requestAnimationFrame(tick);
  }

  rafId = requestAnimationFrame(tick);

  return () => {
    stopped = true;
    if (rafId !== null) cancelAnimationFrame(rafId);
  };
}

/** Starts one bounded scan session against an already-playing <video>.
 *  Returns a stop function -- call it on unmount, on finding a result, or
 *  when the caller wants to cancel early. Safe to call more than once. */
export function startOnDemandScan(
  video: HTMLVideoElement,
  opts: OnDemandScanOptions
): () => void {
  const { durationMs = 8000, onResult, onTimeout, onEngine, onDiagnostic } = opts;
  let stopped = false;
  let innerStop: (() => void) | null = null;

  function finish(fn?: () => void) {
    if (stopped) return;
    stopped = true;
    if (timeoutId) clearTimeout(timeoutId);
    innerStop?.();
    fn?.();
  }

  const timeoutId = setTimeout(() => finish(onTimeout), durationMs);

  if (isNativeBarcodeDetectorSupported()) {
    onEngine?.("native");
    innerStop = startNativeScan(
      video,
      (result) => finish(() => onResult(result)),
      180,
      onDiagnostic ? (d) => onDiagnostic({ engine: "native", attempts: d.attempts, elapsedMs: d.elapsedMs }) : undefined
    );
  } else {
    onEngine?.("js-fallback");
    innerStop = startRegionScan(
      video,
      (result) => finish(() => onResult(result)),
      120,
      onDiagnostic ? (d) => onDiagnostic({ engine: "js-fallback", attempts: d.attempts, elapsedMs: d.elapsedMs }) : undefined
    );
  }

  return () => finish();
}

import { startLiveBarcodeScan, type LiveBarcodeResult } from "./liveBarcodeReader";
import { normalizeFormatName, type BarcodeScanResult } from "./barcodeScanner";

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
  minIntervalMs: number
): () => void {
  let stopped = false;
  let rafId: number | null = null;
  let lastCheck = 0;
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
      if (codes && codes.length > 0) {
        const first = codes[0];
        if (first.rawValue) {
          onResult(toBarcodeScanResult(first.rawValue, first.format || "unknown"));
          return; // caller's onResult is expected to stop() the session
        }
      }
    } catch {
      // detect() can throw if the video frame isn't ready yet -- ignore and
      // retry next tick rather than tearing down the whole session over it.
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
  const { durationMs = 8000, onResult, onTimeout, onEngine } = opts;
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
    innerStop = startNativeScan(video, (result) => finish(() => onResult(result)), 180);
  } else {
    onEngine?.("js-fallback");
    innerStop = startLiveBarcodeScan(video, (result) => finish(() => onResult(result)), {
      timeBetweenScansMillis: 350,
    });
  }

  return () => finish();
}

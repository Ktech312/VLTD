import { readBarcodes, type ReadInputBarcodeFormat } from "zxing-wasm/reader";
import { warmupZXingWasm } from "./zxingWasmSetup";
import { normalizeFormatName, scanBarcodeFromVideoFrame, type BarcodeScanResult } from "./barcodeScanner";
import type { LiveBarcodeResult } from "./liveBarcodeReader";

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
 *  1. Where the browser supports it (`window.BarcodeDetector` — Android
 *     Chrome, macOS Chrome/Safari; confirmed live 2026-08-10 that Windows
 *     Chrome and iOS Safari do NOT), use that. The OS does the decoding,
 *     near-zero CPU cost.
 *  2. Everywhere else (this covers EK's iPhone), decode via `zxing-wasm` --
 *     a WebAssembly build of the actively-maintained zxing-cpp engine, not
 *     the old `@zxing/library` JS port (which is unmaintained and, per a
 *     real device test the same day, couldn't resolve a barcode that was
 *     clearly legible on screen even after several rounds of tuning). Runs
 *     against a few cropped/upscaled regions per tick (full frame, center,
 *     top band, bottom band -- covers both a graded slab's label position
 *     and a retail box's UPC position) rather than one whole-frame decode.
 *  3. If zxing-wasm itself fails to load for any reason (e.g. the
 *     self-hosted .wasm asset doesn't serve correctly in some environment
 *     this wasn't tested against), each tick falls back to the older,
 *     already-proven `scanBarcodeFromVideoFrame` JS decoder rather than
 *     the feature going dark -- worse accuracy, but still working.
 *
 *  Either engine now runs for one bounded ~8s burst triggered by a tap, not
 *  for the whole time the camera is open -- that bound is what actually
 *  fixes the heat complaint on Safari, independent of which decoder runs.
 *
 *  Callers should only start a session when the user deliberately asks for
 *  one (a tap), and let it stop itself after `durationMs` if nothing is
 *  found -- never wire this to run automatically just because a camera is
 *  open. That on-demand behavior, not the detector choice, is the other half
 *  of the fix.
 */

export type OnDemandScanEngine = "native" | "wasm" | "js-fallback";

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

// zxing-wasm's canonical format names (PascalCase, no underscores) -- a
// different naming convention than the native BarcodeDetector's snake_case,
// see normalizeWasmFormat() below.
const WASM_FORMATS: ReadInputBarcodeFormat[] = ["QRCode", "MicroQRCode", "RMQRCode", "Code128", "Code39", "EAN13", "EAN8", "UPCA", "UPCE", "DataMatrix"];

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

/** zxing-wasm returns canonical format names like "QRCode"/"EAN13"/"UPCA" --
 *  no underscores, unlike either the native detector's "qr_code" or the old
 *  @zxing/library's "QR_CODE". normalizeFormatName() (barcodeScanner.ts)
 *  matches on underscored substrings, so it would silently mis-map every one
 *  of these to "UNKNOWN" -- which matters beyond cosmetics: vault/add's PSA
 *  auto-fire gate specifically excludes UPC/EAN *formats* from ever
 *  reaching a PSA lookup, and "UNKNOWN" would defeat that exclusion for
 *  every code read through this engine. */
function normalizeWasmFormat(format: string): BarcodeScanResult["format"] {
  const f = format || "";
  if (f.includes("QR")) return "QR";
  if (f === "UPCA") return "UPC_A";
  if (f === "UPCE") return "UPC_E";
  if (f === "EAN13") return "EAN_13";
  if (f === "EAN8") return "EAN_8";
  if (f === "Code128") return "CODE_128";
  if (f.startsWith("Code39")) return "CODE_39";
  return "UNKNOWN";
}

function toWasmBarcodeScanResult(rawValue: string, format: string): BarcodeScanResult {
  return {
    rawValue,
    digits: rawValue.replace(/\D/g, ""),
    format: normalizeWasmFormat(format),
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

type CropRegion = { x: number; y: number; w: number; h: number; scale: number };

/** Full frame first (catches most reasonably-sized codes fast), then three
 *  targeted crops upscaled for detail: center (how most people frame a
 *  shot), top band (graded-slab cert labels sit at the top of the holder),
 *  bottom band (retail UPCs sit at the bottom of a box). Four attempts/tick
 *  is only affordable because zxing-wasm decodes fast; the old JS engine
 *  could only manage two regions/tick without lagging. */
function wasmCropRegions(width: number, height: number): CropRegion[] {
  return [
    { x: 0, y: 0, w: width, h: height, scale: 1 },
    { x: Math.floor(width * 0.15), y: Math.floor(height * 0.15), w: Math.floor(width * 0.7), h: Math.floor(height * 0.7), scale: 1.6 },
    { x: 0, y: 0, w: width, h: Math.floor(height * 0.4), scale: 1.8 },
    { x: 0, y: Math.floor(height * 0.6), w: width, h: Math.floor(height * 0.4), scale: 1.8 },
  ];
}

function cropVideoToImageData(video: HTMLVideoElement, region: CropRegion): ImageData | null {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(region.w * region.scale));
  canvas.height = Math.max(1, Math.round(region.h * region.scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, region.x, region.y, region.w, region.h, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** zxing-wasm-backed region scan, with a same-tick fallback to the older,
 *  already-proven `scanBarcodeFromVideoFrame` JS decoder if wasm throws
 *  (e.g. the self-hosted .wasm binary somehow fails to load) -- once that
 *  happens the tick loop stops retrying wasm for the rest of this session
 *  (no point re-failing the same way every tick) and just uses the JS path,
 *  so a wasm-loading problem degrades the feature instead of killing it. */
function startWasmRegionScan(
  video: HTMLVideoElement,
  onResult: (result: LiveBarcodeResult) => void,
  minIntervalMs: number,
  onDiagnostic?: (d: { attempts: number; elapsedMs: number; engine: "wasm" | "js-fallback" }) => void
): () => void {
  let stopped = false;
  let rafId: number | null = null;
  let lastCheck = 0;
  let attempts = 0;
  let wasmBroken = false;
  const startedAt = typeof performance !== "undefined" ? performance.now() : 0;

  async function tick(now: number) {
    if (stopped) return;
    if (now - lastCheck < minIntervalMs) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    lastCheck = now;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    attempts += 1;

    if (!wasmBroken) {
      try {
        for (const region of wasmCropRegions(width, height)) {
          if (region.w < 20 || region.h < 20) continue;
          const imageData = cropVideoToImageData(video, region);
          if (!imageData) continue;
          const results = await readBarcodes(imageData, { formats: WASM_FORMATS, maxNumberOfSymbols: 1 });
          if (stopped) return;
          if (results.length > 0 && results[0].text) {
            onResult(toWasmBarcodeScanResult(results[0].text, results[0].format));
            return; // caller's onResult is expected to stop() the session
          }
        }
        onDiagnostic?.({ attempts, elapsedMs: (typeof performance !== "undefined" ? performance.now() : 0) - startedAt, engine: "wasm" });
        if (!stopped) rafId = requestAnimationFrame(tick);
        return;
      } catch {
        // wasm module failed to load/decode -- fall through to the JS
        // decoder below for this tick, and skip wasm on every future tick.
        wasmBroken = true;
      }
    }

    const result = scanBarcodeFromVideoFrame(video);
    onDiagnostic?.({ attempts, elapsedMs: (typeof performance !== "undefined" ? performance.now() : 0) - startedAt, engine: "js-fallback" });
    if (result) {
      onResult(result);
      return;
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
    warmupZXingWasm();
    onEngine?.("wasm");
    innerStop = startWasmRegionScan(
      video,
      (result) => finish(() => onResult(result)),
      120,
      onDiagnostic ? (d) => onDiagnostic({ engine: d.engine, attempts: d.attempts, elapsedMs: d.elapsedMs }) : undefined
    );
  }

  return () => finish();
}

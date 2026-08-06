import {
  BarcodeFormat,
  DecodeHintType,
  NotFoundException,
} from "@zxing/library";
import { BrowserMultiFormatReader } from "@zxing/library/esm/browser/BrowserMultiFormatReader";
import { normalizeFormatName, type BarcodeScanResult } from "./barcodeScanner";

/** Live-video barcode/QR scanning, take 2.
 *
 *  The previous approach (see git history of barcodeScanner.ts) hand-rolled
 *  its own loop: crop 10 different regions of the video frame to a canvas,
 *  try 3 contrast variants on each, on a setInterval tick. That went through
 *  three rounds of tuning (bottom-only regions -> added top regions -> a
 *  round-robin throttle to fix CPU usage) and still didn't reliably fire on
 *  a real device even after fixing a real digits-only gate bug in that path.
 *
 *  This uses ZXing's OWN supported continuous-video-decode loop instead
 *  (`BrowserMultiFormatReader.decodeContinuously`) -- it decodes the WHOLE
 *  frame each attempt (via the library's own internal canvas), with its own
 *  internal pacing, instead of our home-grown region system. This is the
 *  standard/documented way this library expects live video to be scanned;
 *  worth trying before tuning our bespoke approach a fourth time.
 *
 *  Deliberately uses the LOW-level `decodeContinuously()` rather than the
 *  higher-level `decodeFromVideoElementContinuously()` wrapper: that wrapper
 *  waits for the video's `playing` event before starting, which never fires
 *  for a video that was ALREADY playing before this reader attaches (our
 *  camera panels start the stream themselves, well before this runs) --
 *  that would silently hang forever. `decodeContinuously()` has no such
 *  wait; it starts immediately, which is what we want since the caller
 *  already knows the video is playing (gated on `cameraReady`).
 */

export type LiveBarcodeResult = BarcodeScanResult;

function digitsOnly(value: string) {
  return String(value ?? "").replace(/\D/g, "");
}

function buildHints() {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.QR_CODE,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.DATA_MATRIX,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return hints;
}

/** Starts continuous scanning against an already-playing <video> element.
 *  Calls `onResult` on every successful decode (caller decides whether to
 *  stop after the first hit). Returns a stop function -- call it on
 *  unmount/cleanup. Safe to call `stop()` more than once. */
export function startLiveBarcodeScan(
  video: HTMLVideoElement,
  onResult: (result: LiveBarcodeResult) => void,
  timeBetweenScansMillis = 300
): () => void {
  const reader = new BrowserMultiFormatReader(buildHints(), timeBetweenScansMillis);
  let stopped = false;

  try {
    reader.decodeContinuously(video, (result, error) => {
      if (stopped || !result) return;
      // NotFoundException etc. come through as `error` with `result` null --
      // already filtered by the `!result` check above, nothing to log here;
      // it just means this particular frame had nothing decodable in it.
      void error;

      const rawValue = String(result.getText?.() ?? "");
      if (!rawValue) return;

      onResult({
        rawValue,
        digits: digitsOnly(rawValue),
        format: normalizeFormatName(result.getBarcodeFormat?.()),
        region: "live",
      });
    });
  } catch {
    // Shouldn't happen (decodeContinuously doesn't throw synchronously for a
    // valid video element), but don't take the camera down over a scanner
    // failing to start.
  }

  return () => {
    if (stopped) return;
    stopped = true;
    try {
      reader.stopContinuousDecode();
    } catch {
      // already stopped / reader in a bad state -- nothing more to do
    }
  };
}

/** One-shot version for a manual "scan now" button. */
export function decodeBarcodeOnceFromVideo(video: HTMLVideoElement): LiveBarcodeResult | null {
  const reader = new BrowserMultiFormatReader(buildHints());
  try {
    const result = reader.decode(video);
    const rawValue = String(result.getText?.() ?? "");
    if (!rawValue) return null;
    return {
      rawValue,
      digits: digitsOnly(rawValue),
      format: normalizeFormatName(result.getBarcodeFormat?.()),
      region: "live",
    };
  } catch (error) {
    if (error instanceof NotFoundException) return null;
    return null;
  }
}

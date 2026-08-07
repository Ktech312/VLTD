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

/** On-screen diagnostic so a real-device failure can be read out without a
 *  console. Reports whether we're still waiting for the video, or actively
 *  decoding, plus the true video size, how many decode attempts have run, and
 *  the last error kind (NotFound = normal "no code in frame this time"). */
export type ScanDiagnostic = {
  phase: "waiting" | "decoding";
  videoW: number;
  videoH: number;
  readyState: number;
  attempts: number;
  lastError: string;
};

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
  opts: { timeBetweenScansMillis?: number; onDiagnostic?: (d: ScanDiagnostic) => void } = {}
): () => void {
  const { timeBetweenScansMillis = 300, onDiagnostic } = opts;
  const reader = new BrowserMultiFormatReader(buildHints(), timeBetweenScansMillis);
  let stopped = false;
  let started = false;
  let waitTimer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  let lastError = "";

  function emit(phase: ScanDiagnostic["phase"]) {
    if (!onDiagnostic || stopped) return;
    onDiagnostic({
      phase,
      videoW: video.videoWidth,
      videoH: video.videoHeight,
      readyState: video.readyState,
      attempts,
      lastError,
    });
  }

  function beginDecoding() {
    if (stopped || started) return;
    started = true;
    try {
      reader.decodeContinuously(video, (result, error) => {
        if (stopped) return;
        attempts += 1;
        if (error) {
          lastError = (error as { name?: string })?.name || error.constructor?.name || "err";
        }
        // Report roughly a few times/sec so a stuck state is visible on screen.
        if (attempts % 3 === 0) emit("decoding");

        if (!result) return;
        // NotFoundException etc. come through as `error` with `result` null --
        // already handled above; it just means this frame had nothing decodable.
        const rawValue = String(result.getText?.() ?? "");
        if (!rawValue) return;

        onResult({
          rawValue,
          digits: digitsOnly(rawValue),
          format: normalizeFormatName(result.getBarcodeFormat?.()),
          region: "live",
        });
      });
    } catch (e) {
      lastError = "start:" + ((e as { name?: string })?.name || "err");
      emit("decoding");
    }
  }

  // CRITICAL: ZXing sizes its capture canvas from `video.videoWidth/Height` on
  // the FIRST decode and caches it permanently. On mobile (esp. iOS) the
  // `canplay` event can fire while videoWidth is still 0, which would cache a
  // 0x0 canvas forever -> every frame decodes a blank image -> nothing ever
  // scans. So wait until the video actually has real pixels before starting.
  function waitForVideoReady() {
    if (stopped || started) return;
    emit("waiting");
    if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
      beginDecoding();
      return;
    }
    waitTimer = setTimeout(waitForVideoReady, 250);
  }
  waitForVideoReady();

  return () => {
    if (stopped) return;
    stopped = true;
    if (waitTimer) clearTimeout(waitTimer);
    try {
      reader.stopContinuousDecode();
    } catch {
      // already stopped / never started -- nothing more to do
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

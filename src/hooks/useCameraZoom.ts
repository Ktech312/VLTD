"use client";

import { useCallback, useRef, useState } from "react";
import type { TouchEvent as ReactTouchEvent, WheelEvent as ReactWheelEvent } from "react";

/** `zoom` is a real MediaStreamTrack capability/constraint on supporting
 *  hardware, but it isn't in TypeScript's DOM lib (it's a capture-extensions
 *  addition browsers opt into individually, not part of the base
 *  getUserMedia spec) -- these three types just widen the stock DOM types
 *  enough to read/write it without `any`. */
type ZoomCapability = { min: number; max: number; step: number };
type CapabilitiesWithZoom = MediaTrackCapabilities & { zoom?: ZoomCapability };
type SettingsWithZoom = MediaTrackSettings & { zoom?: number };
type ConstraintSetWithZoom = MediaTrackConstraintSet & { zoom?: number };

const DIGITAL_MIN = 1;
const DIGITAL_MAX = 3;
const DIGITAL_STEP = 0.1;

export type CameraCaptureCrop = { sx: number; sy: number; sw: number; sh: number };

/** Live pinch/scroll/slider zoom for a `getUserMedia` video feed, applied
 *  BEFORE capture (the after-capture crop step already has its own
 *  pinch-zoom, unrelated to this).
 *
 *  Two layers, best available wins:
 *  1. HARDWARE zoom (`track.getCapabilities().zoom`) -- real optical/driver
 *     zoom, when the browser+hardware actually expose it. Per current
 *     browser-support data this is mainly Android Chrome on supporting
 *     hardware; effectively never present on a desktop webcam or iOS
 *     Safari -- confirmed 2026-08-11 when a desktop test showed no zoom
 *     control at all under the hardware-only first version of this hook.
 *  2. DIGITAL fallback -- always available everywhere (desktop mouse
 *     scroll, touch pinch), CSS-scales the live preview and crops the
 *     captured frame to match at capture time via `getCaptureCrop()`. This
 *     is a real crop+upscale, same tradeoff as "digital zoom" on any
 *     camera app (some quality loss vs. optical), but it means SOME zoom
 *     control exists on every platform instead of only the one browser/
 *     hardware combo that happens to expose the real capability.
 *
 *  Call `attach(track)` right after a stream's video track is ready
 *  (mirrors how both camera panels already attach `srcObject`), and
 *  `reset()` when the stream stops. Call `getCaptureCrop(video)` at the
 *  moment of capture and use the returned rect as the `drawImage` source
 *  rect -- this is what keeps the captured photo matching what the digital
 *  zoom preview actually showed, instead of a zoomed-looking preview that
 *  silently captures the full unzoomed frame.
 *
 *  Optional lens-switching hooks (2026-08-11): on a phone that exposes a
 *  separate ultra-wide camera as its own device (see
 *  `src/lib/scanners/cameraLenses.ts` -- NOT all phones do, some fuse
 *  every lens into one device already, in which case hardware zoom above
 *  already covers this for free with nothing to wire here), a caller can
 *  pass `onZoomPastFloor` to hear when the user keeps trying to zoom out
 *  past this camera's own floor -- the natural moment to switch to a wider
 *  physical lens instead of just clamping. `isAtWideLens`/`onExitWideLens`
 *  are the reverse: once switched to the wide lens, any zoom-IN gesture
 *  should hand back to the main camera rather than trying to zoom further
 *  on a lens this hook has no more room to zoom into. */
export function useCameraZoom(options: {
  onZoomPastFloor?: () => void;
  isAtWideLens?: boolean;
  onExitWideLens?: () => void;
} = {}) {
  const { onZoomPastFloor, isAtWideLens, onExitWideLens } = options;
  const [hardwareSupported, setHardwareSupported] = useState(false);
  const [hwZoom, setHwZoomState] = useState(1);
  const [hwMin, setHwMin] = useState(1);
  const [hwMax, setHwMax] = useState(1);
  const [hwStep, setHwStep] = useState(0.1);
  const trackRef = useRef<MediaStreamTrack | null>(null);

  const [digitalZoom, setDigitalZoomState] = useState(1);

  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef(1);

  const mode: "hardware" | "digital" = hardwareSupported ? "hardware" : "digital";
  const zoom = hardwareSupported ? hwZoom : digitalZoom;
  const min = hardwareSupported ? hwMin : DIGITAL_MIN;
  const max = hardwareSupported ? hwMax : DIGITAL_MAX;
  const step = hardwareSupported ? hwStep : DIGITAL_STEP;

  const attach = useCallback((track: MediaStreamTrack | null) => {
    trackRef.current = track;
    setDigitalZoomState(1);

    if (!track || typeof track.getCapabilities !== "function") {
      setHardwareSupported(false);
      return;
    }
    const caps = track.getCapabilities() as CapabilitiesWithZoom;
    if (!caps.zoom || caps.zoom.max <= caps.zoom.min) {
      setHardwareSupported(false);
      return;
    }
    setHardwareSupported(true);
    setHwMin(caps.zoom.min);
    setHwMax(caps.zoom.max);
    setHwStep(caps.zoom.step || 0.1);
    const settings = track.getSettings() as SettingsWithZoom;
    setHwZoomState(settings.zoom ?? caps.zoom.min);
  }, []);

  const reset = useCallback(() => {
    trackRef.current = null;
    setHardwareSupported(false);
    setHwZoomState(1);
    setDigitalZoomState(1);
  }, []);

  const setZoom = useCallback(
    (value: number) => {
      if (hardwareSupported) {
        const track = trackRef.current;
        const clamped = Math.min(hwMax, Math.max(hwMin, value));
        setHwZoomState(clamped);
        if (track) {
          track.applyConstraints({ advanced: [{ zoom: clamped } as ConstraintSetWithZoom] }).catch(() => undefined);
        }
      } else {
        setDigitalZoomState(Math.min(DIGITAL_MAX, Math.max(DIGITAL_MIN, value)));
      }
    },
    [hardwareSupported, hwMin, hwMax]
  );

  /** The `drawImage` source rect to use at capture time so a digitally-
   *  zoomed preview captures what it visually showed. Hardware zoom needs
   *  no adjustment here -- the video frame itself is already optically
   *  zoomed by the driver, so the full frame is correct as-is. */
  const getCaptureCrop = useCallback(
    (video: HTMLVideoElement): CameraCaptureCrop => {
      const vw = video.videoWidth || 0;
      const vh = video.videoHeight || 0;
      if (mode === "digital" && digitalZoom > 1 && vw && vh) {
        const sw = vw / digitalZoom;
        const sh = vh / digitalZoom;
        return { sx: (vw - sw) / 2, sy: (vh - sh) / 2, sw, sh };
      }
      return { sx: 0, sy: 0, sw: vw, sh: vh };
    },
    [mode, digitalZoom]
  );

  const touchDistance = (touches: ReactTouchEvent["touches"]) => {
    const a = touches[0];
    const b = touches[1];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };

  const handlePinchStart = useCallback(
    (e: ReactTouchEvent) => {
      if (e.touches.length !== 2) return;
      pinchStartDistRef.current = touchDistance(e.touches);
      pinchStartZoomRef.current = zoom;
    },
    [zoom]
  );

  const handlePinchMove = useCallback(
    (e: ReactTouchEvent) => {
      if (e.touches.length !== 2 || pinchStartDistRef.current == null) return;
      e.preventDefault();
      const ratio = touchDistance(e.touches) / pinchStartDistRef.current;

      if (isAtWideLens && ratio > 1.05) {
        onExitWideLens?.();
        return;
      }
      if (ratio < 0.95 && zoom <= min + 1e-6) {
        onZoomPastFloor?.();
        return;
      }
      setZoom(pinchStartZoomRef.current * ratio);
    },
    [setZoom, zoom, min, isAtWideLens, onExitWideLens, onZoomPastFloor]
  );

  const handlePinchEnd = useCallback(() => {
    pinchStartDistRef.current = null;
  }, []);

  /** Desktop mouse-wheel zoom -- the digital fallback's main input, since
   *  pinch isn't available with a mouse and hardware zoom essentially never
   *  exists on a desktop webcam. Also works as a secondary input when
   *  hardware zoom IS supported (harmless, some external webcams do expose
   *  driver zoom this way too). */
  const handleWheel = useCallback(
    (e: ReactWheelEvent) => {
      e.preventDefault();
      const range = max - min || 1;
      const delta = (-e.deltaY / 300) * range;

      if (isAtWideLens && delta > 0) {
        onExitWideLens?.();
        return;
      }
      if (delta < 0 && zoom <= min + 1e-6) {
        onZoomPastFloor?.();
        return;
      }
      setZoom(zoom + delta);
    },
    [zoom, min, max, setZoom, isAtWideLens, onExitWideLens, onZoomPastFloor]
  );

  return {
    mode,
    hardwareSupported,
    zoom,
    min,
    max,
    step,
    setZoom,
    attach,
    reset,
    getCaptureCrop,
    handlePinchStart,
    handlePinchMove,
    handlePinchEnd,
    handleWheel,
  };
}

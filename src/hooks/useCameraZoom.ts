"use client";

import { useCallback, useRef, useState } from "react";
import type { TouchEvent as ReactTouchEvent } from "react";

/** `zoom` is a real MediaStreamTrack capability/constraint on supporting
 *  hardware, but it isn't in TypeScript's DOM lib (it's a capture-extensions
 *  addition browsers opt into individually, not part of the base
 *  getUserMedia spec) -- these three types just widen the stock DOM types
 *  enough to read/write it without `any`. */
type ZoomCapability = { min: number; max: number; step: number };
type CapabilitiesWithZoom = MediaTrackCapabilities & { zoom?: ZoomCapability };
type SettingsWithZoom = MediaTrackSettings & { zoom?: number };
type ConstraintSetWithZoom = MediaTrackConstraintSet & { zoom?: number };

/** Live pinch-to-zoom / slider zoom for a `getUserMedia` video feed, applied
 *  BEFORE capture (the after-capture crop step already has its own
 *  pinch-zoom, unrelated to this).
 *
 *  Feature-detected, not assumed: `track.getCapabilities().zoom` only
 *  exists on hardware/browser combinations that actually support optical or
 *  driver-level zoom over the web camera API -- per current browser-support
 *  data this is Android Chrome (and some other Chromium browsers) on
 *  supporting hardware. iOS Safari and most desktop browsers/webcams expose
 *  no `zoom` capability at all, and there is no software way to fake real
 *  optical/driver zoom from JS -- `supported` stays false there, and callers
 *  should render nothing rather than a control that silently does nothing.
 *
 *  Call `attach(track)` right after a stream's video track is ready
 *  (mirrors how both camera panels already attach `srcObject`), and
 *  `reset()` when the stream stops -- this hook doesn't own the stream
 *  lifecycle, it just reads/drives whatever track it's given. */
export function useCameraZoom() {
  const [supported, setSupported] = useState(false);
  const [zoom, setZoomState] = useState(1);
  const [min, setMin] = useState(1);
  const [max, setMax] = useState(1);
  const [step, setStep] = useState(0.1);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef(1);

  const attach = useCallback((track: MediaStreamTrack | null) => {
    trackRef.current = track;
    if (!track || typeof track.getCapabilities !== "function") {
      setSupported(false);
      return;
    }
    const caps = track.getCapabilities() as CapabilitiesWithZoom;
    if (!caps.zoom || caps.zoom.max <= caps.zoom.min) {
      setSupported(false);
      return;
    }
    setSupported(true);
    setMin(caps.zoom.min);
    setMax(caps.zoom.max);
    setStep(caps.zoom.step || 0.1);
    const settings = track.getSettings() as SettingsWithZoom;
    setZoomState(settings.zoom ?? caps.zoom.min);
  }, []);

  const reset = useCallback(() => {
    trackRef.current = null;
    setSupported(false);
    setZoomState(1);
  }, []);

  const applyZoom = useCallback(
    (value: number) => {
      const track = trackRef.current;
      if (!track) return;
      const clamped = Math.min(max, Math.max(min, value));
      setZoomState(clamped);
      track.applyConstraints({ advanced: [{ zoom: clamped } as ConstraintSetWithZoom] }).catch(() => undefined);
    },
    [min, max]
  );

  const touchDistance = (touches: ReactTouchEvent["touches"]) => {
    const a = touches[0];
    const b = touches[1];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  };

  const handlePinchStart = useCallback(
    (e: ReactTouchEvent) => {
      if (!supported || e.touches.length !== 2) return;
      pinchStartDistRef.current = touchDistance(e.touches);
      pinchStartZoomRef.current = zoom;
    },
    [supported, zoom]
  );

  const handlePinchMove = useCallback(
    (e: ReactTouchEvent) => {
      if (!supported || e.touches.length !== 2 || pinchStartDistRef.current == null) return;
      e.preventDefault();
      const ratio = touchDistance(e.touches) / pinchStartDistRef.current;
      applyZoom(pinchStartZoomRef.current * ratio);
    },
    [supported, applyZoom]
  );

  const handlePinchEnd = useCallback(() => {
    pinchStartDistRef.current = null;
  }, []);

  return {
    supported,
    zoom,
    min,
    max,
    step,
    setZoom: applyZoom,
    attach,
    reset,
    handlePinchStart,
    handlePinchMove,
    handlePinchEnd,
  };
}

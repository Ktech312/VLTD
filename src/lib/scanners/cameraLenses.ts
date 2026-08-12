/** Best-effort classification of a phone's REAR camera lenses from
 *  `enumerateDevices()` labels.
 *
 *  There is no standard Web API to identify which physical lens a camera
 *  device represents (focal length, field of view, etc. aren't exposed to
 *  the browser) -- this is pure label-text heuristics, same spirit as the
 *  existing "front"/"back" filtering both camera panels already do.
 *  Device labels vary a lot by OEM/Android build, so this is confirmed
 *  correct IN CODE, NOT confirmed against real multi-lens hardware yet.
 *
 *  Two real, different situations this has to handle:
 *  1. Many phones (especially ones with camera-HAL-level "logical multi-
 *     camera" fusion) expose their wide/ultra-wide/telephoto lenses as ONE
 *     back-facing device -- `enumerateDevices()` only ever shows one entry,
 *     and switching between physical lenses already happens automatically,
 *     transparently, inside that single device's own `zoom` capability
 *     range (see useCameraZoom's hardware-zoom path). Nothing to do here;
 *     `ultraWideId` correctly comes back null and no lens-switching logic
 *     needs to run at all.
 *  2. Some phones expose each physical rear lens as a SEPARATE device.
 *     That's what this function is for -- picking the ultra-wide one out
 *     of the list by label text, so the camera panels can switch to it
 *     when the user zooms out past what the main lens can do.
 *
 *  iOS Safari never exposes multiple rear lenses either way -- `ultraWideId`
 *  is always null there, same as case 1 above (nothing to switch to).
 */

export type ClassifiedBackCameras = {
  mainId: string | null;
  ultraWideId: string | null;
};

const ULTRA_WIDE_PATTERN = /ultra[\s-]?wide|wide[\s-]?angle|\b0\.5x\b|\bultrawide\b/i;
const TELEPHOTO_PATTERN = /tele(photo)?|periscope|\b2x\b|\b3x\b/i;
const FRONT_PATTERN = /front/i;

export function classifyBackCameras(devices: MediaDeviceInfo[]): ClassifiedBackCameras {
  const backCameras = devices.filter(
    (d) => d.kind === "videoinput" && !FRONT_PATTERN.test(d.label)
  );

  const ultraWide = backCameras.find((d) => ULTRA_WIDE_PATTERN.test(d.label)) ?? null;
  // "Main" is whichever back camera looks neither ultra-wide nor telephoto
  // -- falls back to the first back camera if labels don't distinguish
  // anything (the common case: one fused logical camera, see case 1 above).
  const main =
    backCameras.find((d) => !ULTRA_WIDE_PATTERN.test(d.label) && !TELEPHOTO_PATTERN.test(d.label)) ??
    backCameras[0] ??
    null;

  return {
    mainId: main?.deviceId ?? null,
    ultraWideId: ultraWide && ultraWide.deviceId !== main?.deviceId ? ultraWide.deviceId : null,
  };
}

/** The curator's manually-chosen default camera, shared across every camera
 *  screen (regular Add, Quick Add) so a choice made on one carries to the
 *  other -- and so a future Settings-page camera picker (EK's idea, not
 *  built yet: a dedicated spot to test each camera and set a default) has
 *  ONE place to read/write instead of each screen keeping its own copy.
 *  Same localStorage key `CameraCapturePanel.tsx` already used, so existing
 *  users' saved choice carries over with no migration.
 *
 *  Deliberately NOT written by the automatic ultra-wide lens-switch
 *  (cameraLenses.ts) -- that's an ephemeral zoom-triggered hop between two
 *  physical lenses on the SAME phone, not a real preference change. Only a
 *  manual pick from a Camera dropdown should update this. */

const CAMERA_PREF_KEY = "vltd_camera_device_id";

export function getPreferredCameraId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(CAMERA_PREF_KEY) || "";
  } catch {
    return "";
  }
}

export function setPreferredCameraId(deviceId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CAMERA_PREF_KEY, deviceId);
  } catch {
    // ignore
  }
}

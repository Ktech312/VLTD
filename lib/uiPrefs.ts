// src/lib/uiPrefs.ts
export type UiVibe = "classic" | "terminal";

const LS_UI_VIBE = "vltd_ui_vibe";
const EVT = "vltd:ui_vibe";

export function getUiVibeSafe(): UiVibe {
  if (typeof window === "undefined") return "classic";
  const v = window.localStorage.getItem(LS_UI_VIBE);
  return v === "terminal" ? "terminal" : "classic";
}

export function setUiVibe(next: UiVibe) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_UI_VIBE, next);
  window.dispatchEvent(new Event(EVT));
}

export function onUiVibeChange(cb: (v: UiVibe) => void) {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb(getUiVibeSafe());
  window.addEventListener(EVT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVT, handler);
    window.removeEventListener("storage", handler);
  };
}
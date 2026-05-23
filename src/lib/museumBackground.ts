// Path: src/lib/museumBackground.ts

export type MuseumBackgroundMode = "cover" | "contain";

export const MUSEUM_BG_EVENT = "vltd:museum-wall";

const LS_MUSEUM_BG_IMAGE = "vltd_museum_wall_image";
const LS_MUSEUM_BG_MODE = "vltd_museum_wall_mode";

type MuseumBackgroundState = {
  image?: string;
  mode: MuseumBackgroundMode;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeMuseumBackgroundMode(value: string | null | undefined): MuseumBackgroundMode {
  return value === "contain" ? "contain" : "cover";
}

function emitMuseumBackgroundChange() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(MUSEUM_BG_EVENT));
}

export function getMuseumBackground(): MuseumBackgroundState {
  if (!isBrowser()) {
    return { image: undefined, mode: "cover" };
  }

  const rawImage = window.localStorage.getItem(LS_MUSEUM_BG_IMAGE);
  const rawMode = window.localStorage.getItem(LS_MUSEUM_BG_MODE);

  const image = rawImage && rawImage.trim().length > 0 ? rawImage : undefined;
  const mode = normalizeMuseumBackgroundMode(rawMode);

  return { image, mode };
}

export function getMuseumBackgroundImage(): string | undefined {
  return getMuseumBackground().image;
}

export function getMuseumBackgroundMode(): MuseumBackgroundMode {
  return getMuseumBackground().mode;
}

export function hasMuseumBackground(): boolean {
  return !!getMuseumBackground().image;
}

export function saveMuseumBackgroundImage(image: string) {
  if (!isBrowser()) return;

  const nextImage = String(image ?? "").trim();

  if (!nextImage) {
    window.localStorage.removeItem(LS_MUSEUM_BG_IMAGE);
    emitMuseumBackgroundChange();
    return;
  }

  window.localStorage.setItem(LS_MUSEUM_BG_IMAGE, nextImage);

  const currentMode = normalizeMuseumBackgroundMode(window.localStorage.getItem(LS_MUSEUM_BG_MODE));
  window.localStorage.setItem(LS_MUSEUM_BG_MODE, currentMode);

  emitMuseumBackgroundChange();
}

export function saveMuseumBackgroundMode(mode: MuseumBackgroundMode) {
  if (!isBrowser()) return;

  const nextMode = normalizeMuseumBackgroundMode(mode);
  window.localStorage.setItem(LS_MUSEUM_BG_MODE, nextMode);

  emitMuseumBackgroundChange();
}

export function saveMuseumBackground(next: MuseumBackgroundState) {
  if (!isBrowser()) return;

  const image = String(next.image ?? "").trim();
  const mode = normalizeMuseumBackgroundMode(next.mode);

  if (image) {
    window.localStorage.setItem(LS_MUSEUM_BG_IMAGE, image);
  } else {
    window.localStorage.removeItem(LS_MUSEUM_BG_IMAGE);
  }

  window.localStorage.setItem(LS_MUSEUM_BG_MODE, mode);

  emitMuseumBackgroundChange();
}

export function clearMuseumBackground() {
  if (!isBrowser()) return;

  window.localStorage.removeItem(LS_MUSEUM_BG_IMAGE);
  window.localStorage.removeItem(LS_MUSEUM_BG_MODE);

  emitMuseumBackgroundChange();
}

export function resetMuseumBackgroundMode() {
  if (!isBrowser()) return;

  window.localStorage.removeItem(LS_MUSEUM_BG_MODE);

  emitMuseumBackgroundChange();
}
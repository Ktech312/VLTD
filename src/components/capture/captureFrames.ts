import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";

export type CaptureFrame = {
  label: string;
  aspectRatio: string;
  inset: string;
  radius: string;
};

const FRAMES: Record<UniverseKey, CaptureFrame> = {
  POP_CULTURE: {
    label: "Comic / figure frame",
    aspectRatio: "2 / 3",
    inset: "7%",
    radius: "16px",
  },
  SPORTS: {
    label: "Card frame",
    aspectRatio: "2.5 / 3.5",
    inset: "10%",
    radius: "14px",
  },
  TCG: {
    label: "TCG frame",
    aspectRatio: "2.5 / 3.5",
    inset: "10%",
    radius: "14px",
  },
  MUSIC: {
    label: "Record frame",
    aspectRatio: "1 / 1",
    inset: "10%",
    radius: "18px",
  },
  JEWELRY_APPAREL: {
    label: "Object frame",
    aspectRatio: "1 / 1",
    inset: "12%",
    radius: "999px",
  },
  GAMES: {
    label: "Case frame",
    aspectRatio: "3 / 4",
    inset: "8%",
    radius: "16px",
  },
  BUILT_BOTANY: {
    label: "Nature frame",
    aspectRatio: "4 / 5",
    inset: "9%",
    radius: "18px",
  },
  MISC: {
    label: "Collector frame",
    aspectRatio: "4 / 5",
    inset: "9%",
    radius: "16px",
  },
};

function isUniverseKey(value: unknown): value is UniverseKey {
  return (
    value === "POP_CULTURE" ||
    value === "SPORTS" ||
    value === "TCG" ||
    value === "MUSIC" ||
    value === "JEWELRY_APPAREL" ||
    value === "GAMES" ||
    value === "BUILT_BOTANY" ||
    value === "MISC"
  );
}

export function getCaptureFrame(universe: unknown): CaptureFrame {
  const key = String(universe ?? "").trim().toUpperCase();
  return FRAMES[isUniverseKey(key) ? key : "MISC"];
}

export function getCaptureUniverseLabel(universe: unknown) {
  const key = String(universe ?? "").trim().toUpperCase();
  return isUniverseKey(key) ? UNIVERSE_LABEL[key] : UNIVERSE_LABEL.MISC;
}

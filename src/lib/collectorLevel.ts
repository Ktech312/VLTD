/* Collector Level — derived from the curator's real activity (items + exhibits
   + followers). Used by the top-nav badge and anywhere we show a level. */

import { loadItems } from "./vaultModel";
import { loadGalleries } from "./galleryModel";

export type CollectorLevelInfo = {
  level: number;
  points: number;
  title: string;
  /** Points at the start of the current level. */
  currentLevelAt: number;
  /** Points needed to reach the next level. */
  nextLevelAt: number;
  /** 0..1 progress toward the next level. */
  progress: number;
};

/* Points weighting — an exhibit is more effort than a single item. */
export const LEVEL_POINTS = {
  perItem: 10,
  perExhibit: 40,
  perFollower: 5,
} as const;

/* Level curve: threshold(L) = K * L^2, so each level costs progressively more. */
const K = 50;

const TITLES: ReadonlyArray<{ min: number; title: string }> = [
  { min: 40, title: "Vault Master" },
  { min: 25, title: "Connoisseur" },
  { min: 15, title: "Archivist" },
  { min: 8, title: "Curator" },
  { min: 3, title: "Collector" },
  { min: 1, title: "Novice" },
];

export function collectorLevelTitle(level: number): string {
  for (const t of TITLES) if (level >= t.min) return t.title;
  return "Novice";
}

export function computeCollectorLevel(input: {
  items?: number;
  exhibits?: number;
  followers?: number;
}): CollectorLevelInfo {
  const items = Math.max(0, Math.floor(input.items ?? 0));
  const exhibits = Math.max(0, Math.floor(input.exhibits ?? 0));
  const followers = Math.max(0, Math.floor(input.followers ?? 0));

  const points =
    items * LEVEL_POINTS.perItem +
    exhibits * LEVEL_POINTS.perExhibit +
    followers * LEVEL_POINTS.perFollower;

  const level = Math.max(1, Math.floor(Math.sqrt(points / K)) + 1);
  const currentLevelAt = K * (level - 1) * (level - 1);
  const nextLevelAt = K * level * level;
  const span = nextLevelAt - currentLevelAt;
  const progress = span > 0 ? Math.min(1, Math.max(0, (points - currentLevelAt) / span)) : 0;

  return { level, points, title: collectorLevelTitle(level), currentLevelAt, nextLevelAt, progress };
}

/* Compute the signed-in curator's level from their locally-synced vault +
   exhibits. Safe on the client; returns level 1 if nothing is loaded yet. */
export function loadMyCollectorLevel(followers = 0): CollectorLevelInfo {
  let items = 0;
  let exhibits = 0;
  try {
    items = loadItems().length;
  } catch {
    /* noop */
  }
  try {
    exhibits = loadGalleries().length;
  } catch {
    /* noop */
  }
  return computeCollectorLevel({ items, exhibits, followers });
}

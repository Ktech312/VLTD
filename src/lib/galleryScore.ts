import type { Gallery } from "@/lib/galleryModel";
import type { VaultItem } from "@/lib/vaultModel";

import { getGallerySections } from "@/lib/galleryModel";

export type GalleryScoreBand = "Basic" | "Curated" | "Exhibition Grade";

export type GalleryScoreSignals = {
  items: number;
  sections: number;
  featuredWorks: number;
  notes: number;
  hasCover: boolean;
  hasDescription: boolean;
  hasPublicShare: boolean;
  hasInviteAccess: boolean;
  views: number;
};

export type GalleryScoreResult = {
  score: number;
  band: GalleryScoreBand;
  signals: GalleryScoreSignals;
};

function safeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function safeString(value: unknown) {
  return String(value ?? "").trim();
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getSignalScore(signals: GalleryScoreSignals) {
  let score = 0;

  // Item count
  score += Math.min(signals.items * 4, 28);

  // Section structure
  score += Math.min(signals.sections * 10, 20);

  // Featured works
  score += Math.min(signals.featuredWorks * 6, 18);

  // Notes / curation
  score += Math.min(signals.notes * 4, 16);

  // Presentation completeness
  if (signals.hasCover) score += 6;
  if (signals.hasDescription) score += 4;

  // Sharing readiness
  if (signals.hasPublicShare) score += 4;
  if (signals.hasInviteAccess) score += 2;

  // Engagement
  if (signals.views >= 1) score += 1;
  if (signals.views >= 5) score += 1;

  return clamp(score);
}

function getBand(score: number): GalleryScoreBand {
  if (score >= 80) return "Exhibition Grade";
  if (score >= 50) return "Curated";
  return "Basic";
}

export function getGalleryScore(
  gallery: Gallery,
  _items: VaultItem[]
): GalleryScoreResult {

  const sections = getGallerySections(gallery);

  const featuredWorks = sections.filter(
    (section: any) => !!section?.featuredItemId
  ).length;

  const notes = Array.isArray(gallery.itemNotes)
    ? gallery.itemNotes.filter((note: any) => safeString(note?.note)).length
    : 0;

  const inviteTokens = Array.isArray(gallery.share?.inviteTokens)
    ? gallery.share!.inviteTokens.filter((token: any) => {
        if (!safeString(token?.token)) return false;
        if (token?.disabled) return false;
        return true;
      })
    : [];

  const signals: GalleryScoreSignals = {
    items: Array.isArray(gallery.itemIds) ? gallery.itemIds.length : 0,
    sections: sections.length,
    featuredWorks,
    notes,
    hasCover: !!safeString(gallery.coverImage),
    hasDescription: !!safeString(gallery.description),
    hasPublicShare: !!safeString(gallery.share?.publicToken),
    hasInviteAccess: inviteTokens.length > 0,
    views: safeNumber(gallery.analytics?.views),
  };

  const score = getSignalScore(signals);

  return {
    score,
    band: getBand(score),
    signals,
  };
}
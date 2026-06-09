/**
 * generateItemCopy — smart-template copy generation for vault items.
 *
 * Produces human-quality draft text from existing item fields.
 * No API call required — swappable to a real LLM by replacing the
 * `generate*` functions with async API calls in the future.
 *
 * Modes:
 *   description — collector-to-collector, factual, saves to item.notes
 *   listing     — buyer-facing, value-proposition, FOR_SALE context
 *   social      — short enthusiast caption for Instagram/Twitter
 */

import { UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";
import type { VaultItem } from "@/lib/vaultModel";

export type CopyMode = "description" | "listing" | "social";

export type GeneratedCopy = {
  text: string;
  /** 0–100 confidence based on how many fields contributed */
  confidence: number;
  mode: CopyMode;
};

// ─── field helpers ─────────────────────────────────────────────────────────────

function universeLabel(item: VaultItem): string {
  return item.universe
    ? (UNIVERSE_LABEL[item.universe as UniverseKey] ?? item.universe)
    : "";
}

function gradeOrCondition(item: VaultItem): string {
  if (item.grade) return item.grade;
  if (item.condition) return item.condition;
  return "";
}

function subjectOrTitle(item: VaultItem): string {
  return (item.subject?.trim() || item.title?.trim() || "this item");
}

// Count how many "quality signal" fields are present (0–8 scale)
function fieldScore(item: VaultItem): number {
  const checks = [
    !!item.title?.trim(),
    !!item.subject?.trim(),
    !!item.universe,
    !!(item.grade || item.condition),
    !!item.certNumber?.trim(),
    !!(item.askingPrice && item.askingPrice > 0),
    !!(item.notes?.trim()),
    !!(item.images?.length),
  ];
  return checks.filter(Boolean).length;
}

function toConfidence(filledFields: number, totalFields: number): number {
  return Math.round((filledFields / totalFields) * 100);
}

// ─── description mode ──────────────────────────────────────────────────────────

function generateDescription(item: VaultItem): GeneratedCopy {
  const subject = subjectOrTitle(item);
  const universe = universeLabel(item);
  const grade = gradeOrCondition(item);
  const cert = item.certNumber?.trim();

  const parts: string[] = [];
  const filledFields: string[] = [];

  // Opening sentence: grade + subject + universe
  if (grade && universe) {
    parts.push(`${grade} graded ${subject} from ${universe}.`);
    filledFields.push("grade", "subject", "universe");
  } else if (grade) {
    parts.push(`${grade} graded ${subject}.`);
    filledFields.push("grade", "subject");
  } else if (universe) {
    parts.push(`${subject} from ${universe}.`);
    filledFields.push("subject", "universe");
  } else {
    parts.push(`${subject}.`);
    filledFields.push("subject");
  }

  // Cert sentence
  if (cert) {
    parts.push(`Certified and verified — cert #${cert}.`);
    filledFields.push("certNumber");
  }

  // Condition note if no grade
  if (!item.grade && item.condition) {
    parts.push(`Condition: ${item.condition}.`);
  }

  // Acquisition note if no cert
  if (!cert) {
    parts.push(`Part of a personally curated collection.`);
  }

  const usedFields = new Set(filledFields).size;
  const confidence = toConfidence(
    fieldScore(item),
    6 // title/subject/universe/grade/cert/notes
  );

  return {
    text: parts.join(" "),
    confidence: Math.min(confidence, 92), // cap at 92 — template is never 100%
    mode: "description",
  };
}

// ─── listing mode ──────────────────────────────────────────────────────────────

function generateListing(item: VaultItem): GeneratedCopy {
  const subject = subjectOrTitle(item);
  const universe = universeLabel(item);
  const grade = gradeOrCondition(item);
  const cert = item.certNumber?.trim();
  const price = item.askingPrice && item.askingPrice > 0
    ? `$${item.askingPrice.toLocaleString()}`
    : null;

  const parts: string[] = [];

  // Headline
  if (grade) {
    parts.push(`${grade} ${subject}${universe ? ` (${universe})` : ""} — now available.`);
  } else {
    parts.push(`${subject}${universe ? ` (${universe})` : ""} — now available.`);
  }

  // Condition / cert trust signal
  if (cert) {
    parts.push(`Authenticated and graded — cert #${cert}.`);
  } else if (item.condition) {
    parts.push(`Condition: ${item.condition}.`);
  }

  // Price sentence
  if (price) {
    parts.push(`Asking ${price}. Serious inquiries only.`);
  } else {
    parts.push(`Price available upon request.`);
  }

  // Existing notes as closing detail
  if (item.notes?.trim() && item.notes.trim().length > 10) {
    parts.push(item.notes.trim());
  }

  const confidence = toConfidence(fieldScore(item), 8);

  return {
    text: parts.join(" "),
    confidence: Math.min(confidence, 92),
    mode: "listing",
  };
}

// ─── social mode ───────────────────────────────────────────────────────────────

function generateSocial(item: VaultItem): GeneratedCopy {
  const subject = subjectOrTitle(item);
  const universe = universeLabel(item);
  const grade = gradeOrCondition(item);
  const price = item.askingPrice && item.askingPrice > 0
    ? `$${item.askingPrice.toLocaleString()}`
    : null;

  const lines: string[] = [];

  // First line: grade + subject
  if (grade) {
    lines.push(`${grade} ${subject} 🔥`);
  } else {
    lines.push(`${subject} just added to the vault ✨`);
  }

  // Universe / category context
  if (universe) {
    lines.push(`${universe} collection`);
  }

  // Price if for sale
  if (price && item.status === "FOR_SALE") {
    lines.push(`For sale: ${price}`);
  }

  // Hashtags based on universe
  const tags: string[] = ["#collector", "#vltd"];
  if (item.universe) tags.push(`#${item.universe.toLowerCase().replace(/\s+/g, "")}`);
  if (item.subject) {
    const slug = item.subject.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (slug) tags.push(`#${slug}`);
  }
  lines.push(tags.join(" "));

  const confidence = toConfidence(fieldScore(item), 5);

  return {
    text: lines.join("\n"),
    confidence: Math.min(confidence, 88),
    mode: "social",
  };
}

// ─── public API ───────────────────────────────────────────────────────────────

export function generateItemCopy(item: VaultItem, mode: CopyMode): GeneratedCopy {
  switch (mode) {
    case "description": return generateDescription(item);
    case "listing":     return generateListing(item);
    case "social":      return generateSocial(item);
  }
}

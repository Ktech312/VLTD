/**
 * generateItemCopy — smart-template copy generation for vault items.
 *
 * Produces human-quality draft text from existing item fields.
 * No API call required — swappable to a real LLM by replacing the
 * `generate*` functions with async API calls in the future.
 *
 * Modes:
 *   description — short, factual, saves to item.description (the public text shown when shared)
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

// Words that describe the product line rather than the item itself. They are
// dropped when working out the item's own name ("Bandai Boa Hancock ST06-006
// 6000 One Piece CCG Character Card English" -> "Boa Hancock").
const BRAND_NOISE =
  /\b(bandai|konami|wizards of the coast|upper deck|topps|panini|fleer|ccg|tcg|character card|trading card|card)\b/gi;
const LANGUAGE = /\b(english|japanese|korean|chinese|french|german|spanish|italian)\b/i;
const SET_CODE = /\b[A-Z]{1,4}\d{1,3}[-/]\d{2,4}[A-Z]?\b/g;
// A few illustrators whose name shows up in listing titles.
const KNOWN_ARTISTS = [
  "Peach Momoko",
  "J. Scott Campbell",
  "Alex Ross",
  "Jenny Frison",
  "Inhyuk Lee",
  "Skottie Young",
  "Artgerm",
];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findArtist(item: VaultItem): string {
  const haystack = [item.title, item.subject, item.notes].filter(Boolean).join(" \n ");
  const by = haystack.match(/\b(?:art|artwork|illustrat\w*)\s+by\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,2})/);
  if (by) return by[1].trim();
  const known = KNOWN_ARTISTS.find((name) => new RegExp(escapeRegExp(name), "i").test(haystack));
  return known ?? "";
}

function findLanguage(item: VaultItem): string {
  const fromField = item.tcgLanguage?.trim();
  if (fromField) return fromField;
  const match = (item.title ?? "").match(LANGUAGE);
  return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase() : "";
}

/** The item's own name with product-line wording, codes and language removed. */
function cleanName(item: VaultItem, franchise: string, artist = "", grade = ""): string {
  let name = item.subject?.trim() || item.title?.trim() || "";
  if (!item.subject?.trim()) {
    if (franchise) name = name.replace(new RegExp("\\b" + escapeRegExp(franchise) + "\\b", "ig"), " ");
    name = name.replace(BRAND_NOISE, " ").replace(LANGUAGE, " ").replace(SET_CODE, " ");
    if (artist) name = name.replace(new RegExp(escapeRegExp(artist), "ig"), " ");
    if (grade) name = name.replace(new RegExp("\\(?\\s*" + escapeRegExp(grade) + "\\s*\\)?", "ig"), " ");
    if (item.universe === "TCG") {
      // trading-card power / cost numbers like "6000" (but keep years)
      name = name.replace(/\b(?!(?:19|20)\d{2}\b)\d{3,5}\b/g, " ");
    }
    name = name.replace(/\s{2,}/g, " ").replace(/^[\s,.\-–—]+|[\s,.\-–—]+$/g, "").trim();
  }
  return name || item.title?.trim() || "this item";
}

/** Which line / series / publisher this belongs to, in plain words. */
function findFranchise(item: VaultItem): string {
  const sub = item.subcategoryLabel?.trim();
  if (item.universe === "TCG" && sub && !/^(other|sealed|accessor)/i.test(sub)) return sub;
  if (item.comicPublisher?.trim()) return item.comicPublisher.trim();
  return "";
}

// Short and factual, in the form a collector would write it:
//   "One Piece, Boa Hancock (English), Art by Peach Momoko"
// Only facts we actually have; no filler.
function generateDescription(item: VaultItem): GeneratedCopy {
  const franchise = findFranchise(item);
  const artist = findArtist(item);
  const grade = item.grade?.trim() || "";
  const name = cleanName(item, franchise, artist, grade);
  const language = findLanguage(item);
  const condition = !grade ? item.condition?.trim() || "" : "";
  const cert = item.certNumber?.trim();

  const parts: string[] = [];
  const nameAlreadyHasFranchise = franchise && name.toLowerCase().includes(franchise.toLowerCase());
  if (franchise && !nameAlreadyHasFranchise) parts.push(franchise);
  parts.push(language ? `${name} (${language})` : name);
  const extra = [item.tcgParallelType?.trim(), item.variant?.trim(), item.edition?.trim()].filter(Boolean);
  parts.push(...(extra as string[]));
  if (artist) parts.push(`Art by ${artist}`);
  if (grade) parts.push(cert ? `${grade} (cert #${cert})` : grade);
  else if (condition) parts.push(condition);
  else if (cert) parts.push(`cert #${cert}`);

  const confidence = toConfidence(fieldScore(item), 6);
  return {
    text: parts.filter(Boolean).join(", "),
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

/**
 * src/lib/personalization.ts
 *
 * Lightweight, client-side personalization engine.
 *
 * HOW IT WORKS
 * ────────────
 * 1. buildUserPreferences()
 *    Reads the user's vault items + watchlist and produces a weighted map of
 *    universe keys → affinity score (0–1). Items in the vault count as mild
 *    interest; items saved via The Flip count as strong interest (3× weight).
 *
 * 2. sortByPersonalization()
 *    Re-ranks any array of galleries by multiplying each gallery's natural
 *    position score by its universe affinity. Galleries from universes the
 *    user actively collects surface to the top; everything else retains its
 *    original relative order.
 *
 * SIGNAL WEIGHTS
 * ─────────────
 *  Vault item in universe          → +1 pt per item (capped per universe)
 *  Watchlist save from universe    → +3 pts per save (strong intent signal)
 *  Recency bonus (vault < 30 days) → ×1.25 multiplier on that item's pts
 *
 * The result is normalised to [0, 1] so it's portable across score systems.
 *
 * No server calls — everything reads from localStorage. Falls back gracefully
 * if vault or watchlist are empty (hasPreferences = false → caller skips sort).
 */

import type { VaultItem } from "@/lib/vaultModel";
import type { WatchlistItem } from "@/lib/watchlistModel";
import type { UniverseKey } from "@/lib/taxonomy";
import { isUniverseKey } from "@/lib/taxonomy";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UniverseAffinityMap = Map<UniverseKey, number>;

export type UserPreferences = {
  /** Normalised affinity scores per universe key (values 0–1). */
  affinityMap: UniverseAffinityMap;
  /**
   * True when the user has enough signal to meaningfully personalise.
   * False means the caller should skip reordering (fresh/empty account).
   */
  hasPreferences: boolean;
  /** Total signal points before normalisation (diagnostic). */
  totalSignal: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

/** Vault item contribution per universe — soft-capped so one huge collection
 *  doesn't completely drown out secondary interests. */
const VAULT_ITEM_WEIGHT = 1;
const VAULT_ITEM_CAP_PER_UNIVERSE = 50; // beyond 50 items, diminishing returns
const VAULT_RECENCY_MULTIPLIER = 1.25;  // items added in last 30 days
const VAULT_RECENCY_DAYS = 30;

/** Watchlist save = strong intent: user explicitly liked this item via The Flip */
const WATCHLIST_WEIGHT = 3;

/** Minimum total signal before we consider the preferences meaningful */
const MIN_SIGNAL_THRESHOLD = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msAgo(ms: number) {
  return Date.now() - ms;
}

function coerceToUniverseKey(raw: unknown): UniverseKey | null {
  if (typeof raw !== "string") return null;
  const up = raw.toUpperCase() as UniverseKey;
  return isUniverseKey(up) ? up : null;
}

// ─── Core: build preference profile ──────────────────────────────────────────

/**
 * Builds a UserPreferences object from the user's current vault + watchlist.
 * Pure function — no side effects, safe to call on every page load.
 */
export function buildUserPreferences(
  vaultItems: VaultItem[],
  watchlistItems: WatchlistItem[],
): UserPreferences {
  const raw = new Map<UniverseKey, number>();

  // ── Signal 1: vault items ──────────────────────────────────────────────────
  // Count items per universe, respect the per-universe cap, apply recency boost
  const vaultCountPerUniverse = new Map<UniverseKey, number>();

  for (const item of vaultItems) {
    const key = coerceToUniverseKey(item.universe);
    if (!key) continue;

    const currentCount = vaultCountPerUniverse.get(key) ?? 0;
    if (currentCount >= VAULT_ITEM_CAP_PER_UNIVERSE) continue;
    vaultCountPerUniverse.set(key, currentCount + 1);

    let pts = VAULT_ITEM_WEIGHT;

    // Recency bonus: items added in the last N days (createdAt is unix ms)
    const addedAt = typeof item.createdAt === "number" ? item.createdAt : 0;

    if (addedAt && msAgo(addedAt) < VAULT_RECENCY_DAYS * 86_400_000) {
      pts *= VAULT_RECENCY_MULTIPLIER;
    }

    raw.set(key, (raw.get(key) ?? 0) + pts);
  }

  // ── Signal 2: watchlist saves (The Flip) ──────────────────────────────────
  // Each save is a strong explicit intent signal
  for (const saved of watchlistItems) {
    // WatchlistItem doesn't store universe directly — infer from title hints
    // or fall back to a lightweight heuristic based on grade format
    const key = inferUniverseFromWatchlistItem(saved);
    if (!key) continue;
    raw.set(key, (raw.get(key) ?? 0) + WATCHLIST_WEIGHT);
  }

  // ── Normalise to [0, 1] ───────────────────────────────────────────────────
  const totalSignal = Array.from(raw.values()).reduce((s, v) => s + v, 0);

  const affinityMap: UniverseAffinityMap = new Map();
  if (totalSignal > 0) {
    for (const [key, pts] of raw.entries()) {
      affinityMap.set(key, pts / totalSignal);
    }
  }

  return {
    affinityMap,
    hasPreferences: totalSignal >= MIN_SIGNAL_THRESHOLD,
    totalSignal,
  };
}

/**
 * Best-effort universe inference from a WatchlistItem.
 * WatchlistItem has title, subtitle, grade fields — use keyword matching
 * similar to inferUniverseKey in discover/page.tsx.
 */
function inferUniverseFromWatchlistItem(item: WatchlistItem): UniverseKey | null {
  const text = [item.title, item.subtitle].filter(Boolean).join(" ").toLowerCase();

  if (/pokemon|magic|yugioh|tcg|trading card|slab|foil|booster/.test(text)) return "TCG";
  if (/sports|rookie|autograph|jersey|memorabilia|baseball|basketball|football|soccer|hockey/.test(text)) return "SPORTS";
  if (/vinyl|album|music|record|instrument|guitar|piano|jazz/.test(text)) return "MUSIC";
  if (/watch|jewelry|apparel|streetwear|luxury|handbag/.test(text)) return "JEWELRY_APPAREL";
  if (/game|console|nintendo|playstation|xbox|sega|atari|arcade/.test(text)) return "GAMES";
  if (/comic|marvel|dc|figure|toy|manga|funko|statue/.test(text)) return "POP_CULTURE";
  if (/handmade|ceramic|woodwork|plant|botany|succulent|terrarium|bonsai/.test(text)) return "BUILT_BOTANY";
  if (/car|cars|automobile|automotive|motorcycle|bicycle|vehicle|hotrod|hot rod/.test(text)) return "AUTOMOTIVE";
  if (/painting|sculpture|fine art|original art|print|lithograph|sketch card/.test(text)) return "ART";

  return null; // unknown — don't assume MISC, just skip
}

// ─── Core: sort galleries ─────────────────────────────────────────────────────

/**
 * Re-ranks `galleries` using the user's affinity map.
 *
 * Strategy: Interleaved personalisation — preferred universes surface to the
 * top while still preserving intra-universe order (so a TCG fan sees the
 * best TCG galleries first, then the next universe, etc.).
 *
 * @param galleries   - Already filtered list of galleries
 * @param prefs       - Built by buildUserPreferences()
 * @param getUniverse - Function that maps a gallery → UniverseKey
 */
export function sortByPersonalization<T>(
  galleries: T[],
  prefs: UserPreferences,
  getUniverse: (g: T) => UniverseKey,
): T[] {
  if (!prefs.hasPreferences || galleries.length === 0) return galleries;

  // Score each gallery: base position score × universe affinity
  // Position score: later in the list → lower score (preserve existing ranking)
  const n = galleries.length;

  return [...galleries]
    .map((g, i) => {
      const universe = getUniverse(g);
      const affinity = prefs.affinityMap.get(universe) ?? 0;
      // Normalised position score: index 0 = 1.0, last = ~0
      const positionScore = (n - i) / n;
      // Blend: 50% original position + 50% affinity-boosted
      // This keeps the feed feeling natural rather than hyper-filtered
      const blended = positionScore * 0.5 + affinity * 0.5;
      return { g, score: blended };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ g }) => g);
}

// ─── Utility: top preferred universes (for UI hints) ─────────────────────────

/**
 * Returns the top N universe keys the user prefers, sorted by affinity desc.
 * Useful for showing "because you collect X" labels in the UI.
 */
export function getTopUniverses(prefs: UserPreferences, n = 3): UniverseKey[] {
  return Array.from(prefs.affinityMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key]) => key);
}

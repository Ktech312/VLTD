import { isUniverseKey, type UniverseKey } from "@/lib/taxonomy";
import type { VaultItem } from "@/lib/vaultModel";

// Honest placeholders for items that have no photo yet.
//
// The rule (per EK): never show fake art that looks like the real item. When an
// item has no real photo, show a background image that simply matches the
// item's Universe — a clear "add your photo" nudge, not a stand-in that
// pretends to be the item. This replaces the old keyword-guessing that returned
// a comic-slab / sports-slab image for anything.

const UNIVERSE_PLACEHOLDER: Record<UniverseKey, string> = {
  POP_CULTURE: "/universe-thumbnails/pop-culture.png",
  SPORTS: "/universe-thumbnails/sports.png",
  TCG: "/universe-thumbnails/tcg.png",
  MUSIC: "/universe-thumbnails/music.png",
  JEWELRY_APPAREL: "/universe-thumbnails/jewelry-apparel.png",
  GAMES: "/universe-thumbnails/games.png",
  BUILT_BOTANY: "/universe-thumbnails/built-botany.png",
  MISC: "/universe-thumbnails/misc.png",
  AUTOMOTIVE: "/universe-thumbnails/automotive.png",
  ART: "/universe-thumbnails/art.png",
};

type ItemLike = Pick<VaultItem, "imageFrontUrl" | "images" | "universe">;

/** The Universe-matched placeholder image for an item (or MISC if unknown). */
export function universePlaceholder(universe?: string | null): string {
  const upper = String(universe ?? "").toUpperCase();
  const key: UniverseKey = isUniverseKey(upper) ? (upper as UniverseKey) : "MISC";
  return UNIVERSE_PLACEHOLDER[key];
}

/** True when the item has a real uploaded photo (not a placeholder). */
export function hasRealPhoto(item?: ItemLike | null): boolean {
  return Boolean(item?.imageFrontUrl || item?.images?.[0]?.url);
}

/** The item's real photo if it has one, otherwise undefined. */
export function realItemPhoto(item?: ItemLike | null): string | undefined {
  if (!item) return undefined;
  if (item.imageFrontUrl) return item.imageFrontUrl;
  const first = item.images?.[0]?.url;
  return first || undefined;
}

/**
 * Real photo if the item has one, otherwise the Universe-matched placeholder.
 * Use this anywhere an item thumbnail is shown. Pair with hasRealPhoto() if you
 * want to overlay an "add photo" hint on the placeholder.
 */
export function itemImageOrPlaceholder(item?: ItemLike | null): string | undefined {
  if (!item) return undefined;
  return realItemPhoto(item) ?? universePlaceholder(item.universe);
}

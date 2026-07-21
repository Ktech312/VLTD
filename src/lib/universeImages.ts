import { isUniverseKey, UNIVERSE_LABEL, type UniverseKey } from "@/lib/taxonomy";

export const UNIVERSE_THUMBNAILS: Record<UniverseKey, string> = {
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

function normalize(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferUniverseKey(value: unknown): UniverseKey {
  const raw = String(value ?? "").trim();
  if (isUniverseKey(raw)) return raw;

  const normalized = normalize(raw);
  for (const key of Object.keys(UNIVERSE_LABEL) as UniverseKey[]) {
    if (normalize(key) === normalized || normalize(UNIVERSE_LABEL[key]) === normalized) {
      return key;
    }
  }

  if (normalized.includes("pop") || normalized.includes("comic")) return "POP_CULTURE";
  if (normalized.includes("sport")) return "SPORTS";
  if (normalized.includes("tcg") || normalized.includes("trading card") || normalized.includes("pokemon")) return "TCG";
  if (normalized.includes("music") || normalized.includes("vinyl")) return "MUSIC";
  if (normalized.includes("jewelry") || normalized.includes("apparel") || normalized.includes("watch")) return "JEWELRY_APPAREL";
  if (normalized.includes("game")) return "GAMES";
  if (normalized.includes("botany") || normalized.includes("built") || normalized.includes("bar")) return "BUILT_BOTANY";
  if (normalized.includes("auto") || normalized.includes("gasoline")) return "AUTOMOTIVE";
  if (normalized.includes("art")) return "ART";

  return "MISC";
}

export function getUniverseThumbnail(value: unknown) {
  return UNIVERSE_THUMBNAILS[inferUniverseKey(value)];
}

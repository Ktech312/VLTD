export type AvatarPreset = {
  id: string;
  label: string;
  src: string;
};

export type RealisticAvatar = {
  displayName: string;
  handle: string;
  src: string;
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "key", label: "Vault Key", src: "/avatars/presets/key.png" },
  { id: "lion", label: "Lion Collector", src: "/avatars/presets/lion.png" },
  { id: "dragon", label: "Jade Dragon", src: "/avatars/presets/dragon.png" },
  { id: "fox", label: "Fox Collector", src: "/avatars/presets/fox.png" },
  { id: "eagle", label: "Eagle Aviator", src: "/avatars/presets/eagle.png" },
  { id: "gem", label: "Blue Gem", src: "/avatars/presets/gem.png" },
  { id: "orb", label: "Crystal Orb", src: "/avatars/presets/orb.png" },
  { id: "sword", label: "Crossed Swords", src: "/avatars/presets/sword.png" },
  { id: "cards", label: "Card Vault", src: "/avatars/presets/cards.png" },
  { id: "crown", label: "Crown Vault", src: "/avatars/presets/crown.png" },
  { id: "vault", label: "Museum Vault", src: "/avatars/presets/vault.png" },
  { id: "fire", label: "Fire Relic", src: "/avatars/presets/fire.png" },
  { id: "keysmith", label: "Keysmith", src: "/avatars/presets/keysmith.png" },
  { id: "guitar", label: "Guitar", src: "/avatars/presets/guitar.png" },
  { id: "vinyl", label: "Vinyl Record", src: "/avatars/presets/vinyl.png" },
  { id: "harp", label: "Harp", src: "/avatars/presets/harp.png" },
];

export const REALISTIC_AVATARS: RealisticAvatar[] = [
  { displayName: "J.P. Morgan", handle: "jpmorgan", src: "/avatars/realistic/jpmorgan.png" },
  { displayName: "William Randolph Hearst", handle: "wrhearst", src: "/avatars/realistic/wrhearst.png" },
  { displayName: "Cornelius Vanderbilt", handle: "thecommodore", src: "/avatars/realistic/thecommodore.png" },
  { displayName: "King Henry VIII", handle: "kinghenry8", src: "/avatars/realistic/kinghenry8.png" },
  { displayName: "Howard Hughes", handle: "howardhughes", src: "/avatars/realistic/howardhughes.png" },
  { displayName: "Nikola Tesla", handle: "nikolatesla", src: "/avatars/realistic/nikolatesla.png" },
  { displayName: "Emperor Nero", handle: "emperornero", src: "/avatars/realistic/emperornero.png" },
  { displayName: "John D. Rockefeller", handle: "jdrockefeller", src: "/avatars/realistic/jdrockefeller.png" },
  { displayName: "Emperor Qianlong", handle: "emperorqianlong", src: "/avatars/realistic/emperorqianlong.png" },
  { displayName: "King Louis XIV", handle: "sunking", src: "/avatars/realistic/sunking.png" },
  { displayName: "Ludwig van Beethoven", handle: "beethoven", src: "/avatars/realistic/beethoven.png" },
  { displayName: "Leonardo da Vinci", handle: "leonardodavinci", src: "/avatars/realistic/leonardodavinci.png" },
  { displayName: "Blackbeard", handle: "blackbeard", src: "/avatars/realistic/blackbeard.png" },
  { displayName: "P.T. Barnum", handle: "ptbarnum", src: "/avatars/realistic/ptbarnum.png" },
  { displayName: "Giacomo Casanova", handle: "casanova", src: "/avatars/realistic/casanova.png" },
  { displayName: "Marie Antoinette", handle: "marieantoinette", src: "/avatars/realistic/marieantoinette.png" },
  { displayName: "Orpheus", handle: "orpheus", src: "/avatars/realistic/orpheus.png" },
  { displayName: "Rumplestiltskin", handle: "rumplestiltskin", src: "/avatars/realistic/rumplestiltskin.png" },
  { displayName: "Walton J. Jr.", handle: "waltonjjr", src: "/avatars/realistic/waltonjjr.png" },
  { displayName: "Erik - The Phantom", handle: "phantomoftheopera", src: "/avatars/realistic/phantomoftheopera.png" },
  { displayName: "Solomon King", handle: "solomonking", src: "/avatars/realistic/solomonking.png" },
  { displayName: "Kai Sterling", handle: "kaisterling", src: "/avatars/realistic/kaisterling.png" },
  { displayName: "Funko Collector", handle: "funko-collector", src: "/avatars/realistic/funko-collector.png" },
];

export const DEFAULT_AVATAR_URL = "__preset:key";
export const DEFAULT_AVATAR_EMOJI = "\u{1F5DD}\uFE0F";

export function presetAvatarUrl(id: string) {
  return `__preset:${id}`;
}

export function resolveAvatarImageSrc(avatarUrl?: string | null) {
  const clean = String(avatarUrl ?? "").trim();
  if (!clean) return "";
  if (clean.startsWith("__preset:")) {
    const id = clean.replace("__preset:", "");
    return AVATAR_PRESETS.find((preset) => preset.id === id)?.src ?? "";
  }
  return clean;
}

export function emojiToPresetUrl(emoji?: string | null) {
  switch (emoji) {
    case "\u{1F981}": return "__preset:lion";
    case "\u{1F409}": return "__preset:dragon";
    case "\u{1F98A}": return "__preset:fox";
    case "\u{1F985}": return "__preset:eagle";
    case "\u{1F48E}": return "__preset:gem";
    case "\u{1F52E}": return "__preset:orb";
    case "\u2694\uFE0F": return "__preset:sword";
    case "\u{1F0CF}": return "__preset:cards";
    case "\u{1F451}": return "__preset:crown";
    case "\u{1F3DB}\uFE0F": return "__preset:vault";
    case "\u{1F525}": return "__preset:fire";
    default: return DEFAULT_AVATAR_URL;
  }
}


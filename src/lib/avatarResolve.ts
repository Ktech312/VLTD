/* One place to turn a profile's avatar fields into an <img> src.
   Order: uploaded url → preset (from url or emoji) → seed avatar → null (caller
   falls back to initials). */

import { getSeedAvatarUrlForProfile, isRenderableAvatarUrl } from "./seedAvatar";

const PRESETS: Record<string, string> = {
  key: "/avatars/presets/key.png",
  lion: "/avatars/presets/lion.png",
  dragon: "/avatars/presets/dragon.png",
  fox: "/avatars/presets/fox.png",
  eagle: "/avatars/presets/eagle.png",
  gem: "/avatars/presets/gem.png",
  orb: "/avatars/presets/orb.png",
  sword: "/avatars/presets/sword.png",
  cards: "/avatars/presets/cards.png",
  crown: "/avatars/presets/crown.png",
  vault: "/avatars/presets/vault.png",
  fire: "/avatars/presets/fire.png",
  keysmith: "/avatars/presets/keysmith.png",
  guitar: "/avatars/presets/guitar.png",
  vinyl: "/avatars/presets/vinyl.png",
  harp: "/avatars/presets/harp.png",
};

const EMOJI_TO_PRESET: Record<string, string> = {
  "🗝️": "key",
  "🦁": "lion",
  "🐉": "dragon",
  "🦊": "fox",
  "🦅": "eagle",
  "💎": "gem",
  "🔮": "orb",
  "⚔️": "sword",
  "🃏": "cards",
  "👑": "crown",
  "🏛️": "vault",
  "🔥": "fire",
  "🎸": "guitar",
  "🎵": "vinyl",
};

export function resolveAvatarSrc(p: {
  avatarUrl?: string | null;
  avatarEmoji?: string | null;
  profileId?: string | null;
  displayName?: string | null;
}): string | null {
  const { avatarUrl, avatarEmoji, profileId, displayName } = p;

  if (avatarUrl) {
    if (avatarUrl.startsWith("__preset:")) {
      const key = avatarUrl.slice("__preset:".length);
      if (PRESETS[key]) return PRESETS[key];
    } else if (isRenderableAvatarUrl(avatarUrl)) {
      return avatarUrl;
    }
  }

  if (avatarEmoji && EMOJI_TO_PRESET[avatarEmoji]) return PRESETS[EMOJI_TO_PRESET[avatarEmoji]] ?? null;

  const seed = getSeedAvatarUrlForProfile({ profileId, displayName });
  if (seed && isRenderableAvatarUrl(seed)) return seed;

  return null;
}

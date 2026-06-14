const REALISTIC_SEED_AVATAR_HANDLES = new Set([
  "jpmorgan",
  "wrhearst",
  "thecommodore",
  "kinghenry8",
  "howardhughes",
  "nikolatesla",
  "emperornero",
  "jdrockefeller",
  "emperorqianlong",
  "sunking",
  "beethoven",
  "leonardodavinci",
  "blackbeard",
  "ptbarnum",
  "casanova",
  "marieantoinette",
  "orpheus",
  "rumplestiltskin",
  "waltonjjr",
  "phantomoftheopera",
  "solomonking",
  "kaisterling",
]);

const SEED_AVATAR_HANDLES = Array.from(REALISTIC_SEED_AVATAR_HANDLES);

const SEED_AVATAR_DISPLAY_NAMES: Record<string, string> = {
  "j.p. morgan": "jpmorgan",
  "william randolph hearst": "wrhearst",
  "cornelius vanderbilt": "thecommodore",
  "king henry viii": "kinghenry8",
  "howard hughes": "howardhughes",
  "nikola tesla": "nikolatesla",
  "emperor nero": "emperornero",
  "john d. rockefeller": "jdrockefeller",
  "emperor qianlong": "emperorqianlong",
  "king louis xiv": "sunking",
  "ludwig van beethoven": "beethoven",
  "leonardo da vinci": "leonardodavinci",
  "blackbeard": "blackbeard",
  "p.t. barnum": "ptbarnum",
  "giacomo casanova": "casanova",
  "marie antoinette": "marieantoinette",
  "orpheus": "orpheus",
  "rumplestiltskin": "rumplestiltskin",
  "walton j. jr.": "waltonjjr",
  "erik - the phantom": "phantomoftheopera",
  "erik the phantom": "phantomoftheopera",
  "solomon king": "solomonking",
  "kai sterling": "kaisterling",
};

function normalizeSeedName(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ");
}

export function getSeedAvatarUrl(handle?: string | null) {
  const cleanHandle = String(handle ?? "").trim().toLowerCase();
  if (!REALISTIC_SEED_AVATAR_HANDLES.has(cleanHandle)) return "";
  return `/avatars/realistic/${cleanHandle}.png`;
}

export function getSeedAvatarUrlByProfileId(profileId?: string | null) {
  const numericId = Number(String(profileId ?? "").trim().split("-").at(-1));
  if (!Number.isInteger(numericId) || numericId < 1 || numericId > REALISTIC_SEED_AVATAR_HANDLES.size) return "";
  return getSeedAvatarUrl(SEED_AVATAR_HANDLES[numericId - 1]);
}

export function getSeedAvatarUrlByDisplayName(displayName?: string | null) {
  return getSeedAvatarUrl(SEED_AVATAR_DISPLAY_NAMES[normalizeSeedName(displayName)]);
}

export function getSeedAvatarUrlForProfile(profile?: { profileId?: string | null; displayName?: string | null }) {
  return getSeedAvatarUrlByProfileId(profile?.profileId) || getSeedAvatarUrlByDisplayName(profile?.displayName);
}

export function isRenderableAvatarUrl(value?: string | null) {
  const url = String(value ?? "").trim();
  return Boolean(url) && !url.startsWith("__preset:");
}

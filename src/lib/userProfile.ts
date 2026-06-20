// src/lib/userProfile.ts
export const PROFILE_KEY = "vltd_profile_v1";
export const PROFILE_EVENT = "vltd:profile";

export type AvatarMode = "EMOJI" | "IMAGE";

export type UserProfile = {
  displayName: string;
  username: string;
  email: string;

  // avatar
  avatarMode: AvatarMode;
  avatarEmoji: string;
  avatarImageDataUrl: string; // dataURL (or URL later)

  // age verification (demo)
  dob: string; // YYYY-MM-DD
  ageVerified: boolean;

  // marketing (demo)
  marketingOptIn: boolean;
};

export const DEFAULT_PROFILE: UserProfile = {
  displayName: "User",
  username: "collector",
  email: "user@example.com",

  avatarMode: "EMOJI",
  avatarEmoji: "🗝️",
  avatarImageDataUrl: "",

  dob: "",
  ageVerified: false,

  marketingOptIn: true,
};

function safeParseJSON<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/**
 * Read profile from localStorage with safe defaults.
 * Never throws. Safe to call in client components.
 */
export function getProfileSafe(): UserProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;

  const saved = safeParseJSON<Partial<UserProfile>>(window.localStorage.getItem(PROFILE_KEY));

  return {
    ...DEFAULT_PROFILE,
    ...saved,

    // extra hardening
    displayName:
      typeof saved?.displayName === "string" && saved.displayName.trim()
        ? (saved.displayName.trim().toLowerCase() === "usere"
            ? DEFAULT_PROFILE.displayName
            : saved.displayName)
        : DEFAULT_PROFILE.displayName,
    username: typeof saved?.username === "string" && saved.username.trim() ? saved.username : DEFAULT_PROFILE.username,
    email: typeof saved?.email === "string" && saved.email.trim() ? saved.email : DEFAULT_PROFILE.email,

    avatarMode: saved?.avatarMode === "IMAGE" ? "IMAGE" : "EMOJI",
    avatarEmoji: typeof saved?.avatarEmoji === "string" && saved.avatarEmoji.trim() ? saved.avatarEmoji : DEFAULT_PROFILE.avatarEmoji,
    avatarImageDataUrl: typeof saved?.avatarImageDataUrl === "string" ? saved.avatarImageDataUrl : DEFAULT_PROFILE.avatarImageDataUrl,

    dob: typeof saved?.dob === "string" ? saved.dob : DEFAULT_PROFILE.dob,
    ageVerified: typeof saved?.ageVerified === "boolean" ? saved.ageVerified : DEFAULT_PROFILE.ageVerified,

    marketingOptIn: typeof saved?.marketingOptIn === "boolean" ? saved.marketingOptIn : DEFAULT_PROFILE.marketingOptIn,
  };
}

/**
 * Persist profile to localStorage.
 */
export function setProfileSafe(profile: UserProfile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

/**
 * Broadcast an in-app update event so components (TopNav, etc.) can refresh.
 */
export function broadcastProfileChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PROFILE_EVENT));
}

/**
 * Subscribe to profile changes via:
 * - 'storage' (other tabs)
 * - custom event (same tab)
 *
 * Returns an unsubscribe function.
 */
export function onProfileChange(handler: () => void) {
  if (typeof window === "undefined") return () => {};

  function onStorage(e: StorageEvent) {
    if (e.key !== PROFILE_KEY) return;
    handler();
  }

  function onCustom() {
    handler();
  }

  window.addEventListener("storage", onStorage);
  window.addEventListener(PROFILE_EVENT, onCustom as any);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(PROFILE_EVENT, onCustom as any);
  };
}
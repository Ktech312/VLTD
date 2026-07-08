export type OnboardingDraft = {
  username: string;
  display_name: string;
  profile_type: "personal" | "business";
  primary_focus: string;
  avatar_emoji: string;
  avatar_url: string;
};

const LS_KEY = "vltd_onboarding_draft_v2";

const EMPTY_DRAFT: OnboardingDraft = {
  username: "",
  display_name: "",
  profile_type: "personal",
  primary_focus: "",
  avatar_emoji: "",
  avatar_url: "",
};

export function loadOnboardingDraft(): OnboardingDraft {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed = JSON.parse(raw);
    return {
      username: String(parsed?.username ?? ""),
      display_name: String(parsed?.display_name ?? ""),
      profile_type: parsed?.profile_type === "business" ? "business" : "personal",
      primary_focus: String(parsed?.primary_focus ?? ""),
      avatar_emoji: String(parsed?.avatar_emoji ?? ""),
      avatar_url: String(parsed?.avatar_url ?? ""),
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function saveOnboardingDraft(draft: Partial<OnboardingDraft>) {
  if (typeof window === "undefined") return;
  const next = { ...loadOnboardingDraft(), ...draft };
  window.localStorage.setItem(LS_KEY, JSON.stringify(next));
}

export function clearOnboardingDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LS_KEY);
}

export type OnboardingStep = 1 | 2 | 3 | 4;

export type OnboardingDraft = {
  step: OnboardingStep;
  username: string;
  display_name: string;
  avatar_emoji: string;
  add_business: boolean;
  business_name: string;
  business_username: string;
  business_type: string;
  business_website: string;
  focused_universes: string[];
  personal_profile_id: string;
  business_profile_id: string;
  owner_user_id: string;
};

const LS_KEY = "vltd_onboarding_draft_v3";
const LEGACY_LS_KEY = "vltd_onboarding_draft_v2";

const EMPTY_DRAFT: OnboardingDraft = {
  step: 1,
  username: "",
  display_name: "",
  avatar_emoji: "",
  add_business: false,
  business_name: "",
  business_username: "",
  business_type: "dealer",
  business_website: "",
  focused_universes: [],
  personal_profile_id: "",
  business_profile_id: "",
  owner_user_id: "",
};

function normalizeStep(value: unknown): OnboardingStep {
  return value === 2 || value === 3 || value === 4 ? value : 1;
}

function normalizeDraft(parsed: Record<string, unknown>): OnboardingDraft {
  return {
    step: normalizeStep(parsed.step),
    username: String(parsed.username ?? ""),
    display_name: String(parsed.display_name ?? ""),
    avatar_emoji: String(parsed.avatar_emoji ?? ""),
    add_business:
      typeof parsed.add_business === "boolean"
        ? parsed.add_business
        : parsed.profile_type === "business",
    business_name: String(parsed.business_name ?? ""),
    business_username: String(parsed.business_username ?? ""),
    business_type: String(parsed.business_type ?? "dealer"),
    business_website: String(parsed.business_website ?? ""),
    focused_universes: Array.isArray(parsed.focused_universes)
      ? parsed.focused_universes.filter((value): value is string => typeof value === "string")
      : [],
    personal_profile_id: String(parsed.personal_profile_id ?? ""),
    business_profile_id: String(parsed.business_profile_id ?? ""),
    owner_user_id: String(parsed.owner_user_id ?? ""),
  };
}

export function loadOnboardingDraft(expectedUserId?: string): OnboardingDraft {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  try {
    const raw = window.localStorage.getItem(LS_KEY) ?? window.localStorage.getItem(LEGACY_LS_KEY);
    if (!raw) return EMPTY_DRAFT;
    const draft = normalizeDraft(JSON.parse(raw) as Record<string, unknown>);
    if (expectedUserId && draft.owner_user_id !== expectedUserId) return EMPTY_DRAFT;
    return draft;
  } catch {
    return EMPTY_DRAFT;
  }
}

export function saveOnboardingDraft(draft: Partial<OnboardingDraft>) {
  if (typeof window === "undefined") return;
  const current = loadOnboardingDraft();
  const base = draft.owner_user_id && current.owner_user_id !== draft.owner_user_id ? EMPTY_DRAFT : current;
  const next = { ...base, ...draft };
  window.localStorage.setItem(LS_KEY, JSON.stringify(next));
}

export function clearOnboardingDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(LS_KEY);
  window.localStorage.removeItem(LEGACY_LS_KEY);
}

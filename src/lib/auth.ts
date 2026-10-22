import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type AuthProfileType = "personal" | "business";

export type ProfileRow = {
  id: string;
  user_id?: string;
  username: string;
  display_name: string;
  profile_type: AuthProfileType;
  primary_focus?: string | null;
  /** What you collect (profile, personalises Discover and the category shortcuts). Never filters your own items. */
  collection_interests?: string[] | null;
  /** The removed "Universes displayed" setting. Nothing reads it; an old value stays stored and hides nothing. */
  displayed_universes?: string[] | null;
  bio?: string | null;
  avatar_emoji?: string | null;
  avatar_url?: string | null;
  is_public?: boolean | null;
  created_at?: string;
  is_default?: boolean | null;
  tier?: string | null;
  tier_expires_at?: string | null;
  tier_source?: string | null;
  stripe_customer_id?: string | null;
  business_type?: string | null;
  website?: string | null;
  // Contact info (private, not on public profile)
  full_name?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  // Identity settings edited on /account
  date_of_birth?: string | null;
  age_verified?: boolean | null;
  marketing_opt_in?: boolean | null;
  onboarding_completed?: boolean | null;
};

import { currentLocalOwner, reconcileLocalDataOwner, resolveLegacyOwner } from "./localDataOwner";
import { stillSignedInAs } from "./sessionGuard";
import { resetCloudSaveStatus } from "./cloudSaveStatus";

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";
const AUTH_TIMEOUT_MS = 8000;

let authListenerInitialized = false;

let cachedSession:
  | {
      access_token?: string;
      refresh_token?: string;
      user?: { id?: string; email?: string | null } | null;
    }
  | null
  | undefined = undefined;

let cachedUser:
  | {
      id?: string;
      email?: string | null;
    }
  | null
  | undefined = undefined;

let currentSessionPromise:
  | Promise<{
      data: { session: any };
      error: Error | null;
    }>
  | null = null;

let currentUserPromise:
  | Promise<{
      data: { user: any };
      error: Error | null;
    }>
  | null = null;

let profilesPromise:
  | Promise<{
      data: ProfileRow[];
      error: Error | null;
    }>
  | null = null;

function getSupabase() {
  return getSupabaseBrowserClient();
}

function withTimeout<T extends { data?: any; error?: any }>(
  promise: PromiseLike<T>,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out.`)), AUTH_TIMEOUT_MS);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function safelyReadStoredAuth() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem("vltd-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function hydrateCacheFromStorage() {
  const stored = safelyReadStoredAuth();
  if (!stored) return;

  const possibleSession =
    stored.currentSession ??
    stored.session ??
    (stored.access_token || stored.refresh_token || stored.user ? stored : null);

  const possibleUser =
    stored.user ??
    stored.currentSession?.user ??
    stored.session?.user ??
    null;

  // Whose data is on this device must be settled before anything reads it (see localDataOwner.ts).
  if (possibleUser?.id) reconcileLocalDataOwner(possibleUser.id);

  if (possibleSession && cachedSession === undefined) {
    cachedSession = possibleSession;
  }
  if (possibleUser && cachedUser === undefined) {
    cachedUser = possibleUser;
  }
}

function setCachedAuthFromSession(session: any) {
  const previousOwner = currentLocalOwner();
  if (session?.user?.id) reconcileLocalDataOwner(session.user.id);
  // Someone else has taken over this device: the previous account's push subscription must stop working here.
  if (previousOwner && session?.user?.id && previousOwner !== session.user.id && typeof window !== "undefined") {
    void import("./pushNotifications").then((m) => m.dropDevicePushSubscription()).catch(() => {});
  }
  // A profile lookup started for the previous person must not be handed to the next one.
  if ((session?.user?.id ?? null) !== (cachedUser?.id ?? null)) profilesPromise = null;
  cachedSession = session ?? null;
  cachedUser = session?.user ?? null;
}

function clearInFlightAuth() {
  currentSessionPromise = null;
  currentUserPromise = null;
}

export function initAuthListener() {
  if (authListenerInitialized) return;

  const supabase = getSupabase();
  if (!supabase) return;

  authListenerInitialized = true;
  hydrateCacheFromStorage();

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      reconcileLocalDataOwner(null);
      resetCloudSaveStatus(); // whatever was being said belonged to the person who just left
    }
    setCachedAuthFromSession(session);
    clearInFlightAuth();
    // A session that is merely restored or refreshed (INITIAL_SESSION, TOKEN_REFRESHED, a repeated SIGNED_IN on tab focus) does
    // not change the profile list; setCachedAuthFromSession already drops it when the person is a different one.
    if (event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "PASSWORD_RECOVERY") profilesPromise = null;
  });
}

/** For a person's own "Try again": forget a failed or stuck account lookup so the next one really asks again instead of reusing the failure. */
export function retryAccountLookups() {
  profilesPromise = null;
  clearInFlightAuth();
}

export async function getCurrentSession() {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      data: { session: null },
      error: new Error("Supabase client is not configured."),
    };
  }

  initAuthListener();
  hydrateCacheFromStorage();

  if (cachedSession !== undefined) {
    return {
      data: { session: cachedSession ?? null },
      error: null,
    };
  }

  if (currentSessionPromise) return currentSessionPromise;

  currentSessionPromise = (async () => {
    try {
      const result = await withTimeout(
        supabase.auth.getSession(),
        "Auth session lookup"
      );
      const session = result.data?.session ?? null;
      setCachedAuthFromSession(session);
      return {
        data: { session },
        error: (result as any).error ?? null,
      };
    } catch (error) {
      return {
        data: { session: null },
        error: error instanceof Error ? error : new Error("Auth session lookup failed."),
      };
    } finally {
      currentSessionPromise = null;
    }
  })();

  return currentSessionPromise;
}

export async function getCurrentUser() {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      data: { user: null },
      error: new Error("Supabase client is not configured."),
    };
  }

  initAuthListener();
  hydrateCacheFromStorage();

  if (cachedUser !== undefined) {
    return {
      data: { user: cachedUser ?? null },
      error: null,
    };
  }

  if (currentUserPromise) return currentUserPromise;

  currentUserPromise = (async () => {
    try {
      const sessionResult = await getCurrentSession();
      const sessionUser = sessionResult.data?.session?.user ?? null;
      cachedUser = sessionUser;
      return {
        data: { user: sessionUser },
        error: sessionResult.error ?? null,
      };
    } catch (error) {
      return {
        data: { user: null },
        error: error instanceof Error ? error : new Error("Auth user lookup failed."),
      };
    } finally {
      currentUserPromise = null;
    }
  })();

  return currentUserPromise;
}

export function onAuthStateChange(callback: any) {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      data: {
        subscription: {
          unsubscribe() {},
        },
      },
    };
  }

  initAuthListener();

  return supabase.auth.onAuthStateChange((event, session) => {
    setCachedAuthFromSession(session);
    clearInFlightAuth();
    if (event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "PASSWORD_RECOVERY") profilesPromise = null;
    callback(event, session);
  });
}

export async function signInWithPassword(email: string, password: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not ready");

  const { data, error } = await withTimeout(
    supabase.auth.signInWithPassword({ email, password }),
    "Password sign in"
  );

  if (error) throw error;

  setCachedAuthFromSession(data.session ?? null);
  clearInFlightAuth();
  profilesPromise = null;
  return data;
}

export async function signInWithGoogle() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not ready");

  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/` : undefined;

  const { data, error } = await withTimeout(
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    }),
    "Google sign in"
  );

  if (error) throw error;
  return data;
}

// Password reset goes through the server so it can be refused unless account email is sending as VLTD
// (src/lib/email/senderGate.ts). The browser must never call Supabase's mailer directly.
export async function resetPasswordForEmail(email: string, returnPath: "/reset-password" | "/account/security" = "/reset-password") {
  const response = await fetch("/api/auth/password-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), returnPath }),
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(result.message || "Password reset failed.");
  }
}

// Multi-device fix (2026-09-22): ordinary sign-out must only end THIS
// device's session — signOut() used to call supabase.auth.signOut() with no
// scope, which defaults to "global" and silently logged every other signed-
// in device out too. Defaults to "local" so every existing call site (the
// TopNav "Sign Out" button, admin pages, etc.) is correct with zero change;
// the one deliberate exception is Account -> Security's "Sign out all
// devices" action, which passes { scope: "global" } explicitly.
// Returns null when the session really ended, or a plain message when the sign-out request failed
// (the session then continues, so callers must not behave as if the person were signed out).
export async function signOut(options?: { scope?: "local" | "global" }): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  // Stop this device receiving this account's push notifications while the account can still delete its own subscription row.
  try {
    const { releasePushOnSignOut } = await import("./pushNotifications");
    await releasePushOnSignOut();
  } catch {
    /* never block sign-out */
  }

  let failure: string | null = null;
  try {
    const { error } = await supabase.auth.signOut({ scope: options?.scope ?? "local" });
    if (error) failure = error.message || "The sign-out request failed.";
  } catch (e) {
    failure = e instanceof Error && e.message ? e.message : "The sign-out request failed.";
  }
  if (failure) {
    return `Couldn't sign you out (${failure.replace(/\.$/, "")}). You are still signed in. Check your connection and try again.`;
  }

  cachedUser = null;
  cachedSession = null;
  clearInFlightAuth();
  profilesPromise = null;

  // Park this person's data on the device so the next person who signs in here never sees it.
  reconcileLocalDataOwner(null);

  if (typeof window !== "undefined") {
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
    window.dispatchEvent(new Event("vltd:active-profile"));
  }
  return null;
}

const PROFILES_REUSE_MS = 8_000;

export async function listMyProfiles() {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      data: [] as ProfileRow[],
      error: new Error("Supabase client is not configured."),
    };
  }

  if (profilesPromise) return profilesPromise;

  let mine: Promise<{ data: ProfileRow[]; error: Error | null }> | null = null;
  mine = profilesPromise = (async () => {
    const userResult = await getCurrentUser();
    const userId = userResult.data.user?.id;
    if (!userId) {
      profilesPromise = null;
      // No signed-in user is an auth problem, not "this account has zero
      // profiles" — callers must be able to tell those apart.
      return { data: [] as ProfileRow[], error: new Error("Not authenticated.") };
    }

    try {
      const result = await withTimeout(
        supabase
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .then((res) => res),
        "Profile list lookup"
      );

      const rows = (result.data ?? []) as ProfileRow[];
      // Profiles are known: settle whose data older browsers are holding (see localDataOwner.ts).
      // (Only if this person is still the one signed in: a slow answer for someone who has since signed out settles nothing.)
      if (!result.error && stillSignedInAs(userId)) resolveLegacyOwner(userId, rows.map((row) => row.id));
      return {
        data: rows,
        error: result.error ?? null,
      };
    } catch (error) {
      return {
        data: [] as ProfileRow[],
        error: error instanceof Error ? error : new Error("Profile list lookup failed."),
      };
    } finally {
      // The list is asked for by the route check, the header, the page and its menus within the same second; each used to be
      // its own request for every column of every profile. The answer is reused briefly. Anything that changes a profile, a
      // sign-in or a sign-out clears it (profilesPromise = null above). A failed lookup is kept for the same few seconds: the route
      // check, the Vault's own gate and the page used to wait out the same 8-second timeout one after another.
      setTimeout(() => {
        if (profilesPromise === mine) profilesPromise = null;
      }, PROFILES_REUSE_MS);
    }
  })();

  return profilesPromise;
}

export async function createProfile(input: {
  username: string;
  display_name: string;
  profile_type: AuthProfileType;
  primary_focus?: string;
  avatar_emoji?: string;
  avatar_url?: string;
  business_type?: string;
  website?: string;
  onboarding_completed?: boolean;
  is_public?: boolean;
}) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not ready");

  const userResult = await getCurrentUser();
  const userId = userResult.data.user?.id;
  if (!userId) throw new Error("No authenticated user found.");

  const payload: Record<string, unknown> = {
    user_id: userId,
    username: input.username.trim(),
    display_name: input.display_name.trim(),
    profile_type: input.profile_type,
    primary_focus: input.primary_focus?.trim() || null,
    avatar_emoji: input.avatar_emoji?.trim() || "🗝️",
    onboarding_completed: input.onboarding_completed ?? true,
    is_public: input.is_public ?? true,
  };
  if (input.avatar_url?.trim()) {
    payload.avatar_url = input.avatar_url.trim();
  }
  if (input.profile_type === "business") {
    payload.business_type = input.business_type?.trim() || null;
    payload.website = input.website?.trim() || null;
  }

  const result = await withTimeout(
    supabase
      .from("profiles")
      .insert(payload)
      .select("*")
      .single()
      .then((res) => res),
    "Profile creation"
  );

  const { data, error } = result;

  if (error) throw error;

  profilesPromise = null;

  if (typeof window !== "undefined" && data?.id) {
    localStorage.setItem(ACTIVE_PROFILE_KEY, String(data.id));
    window.dispatchEvent(new Event("vltd:active-profile"));
  }

  return data as ProfileRow;
}

export async function updateProfile(profileId: string, patch: Partial<ProfileRow>) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not ready");

  const payload: Record<string, unknown> = {};

  if (typeof patch.username === "string") payload.username = patch.username.trim();
  if (typeof patch.display_name === "string") payload.display_name = patch.display_name.trim();
  if (patch.profile_type === "personal" || patch.profile_type === "business") {
    payload.profile_type = patch.profile_type;
  }
  if (typeof patch.primary_focus === "string") {
    payload.primary_focus = patch.primary_focus.trim();
  }
  if (typeof patch.is_default === "boolean") {
    payload.is_default = patch.is_default;
  }
  // Contact info fields
  const contactFields = ["full_name", "phone", "address_line1", "address_line2", "city", "state", "zip", "country"] as const;
  for (const field of contactFields) {
    if (field in patch) payload[field] = typeof patch[field] === "string" ? (patch[field] as string).trim() || null : null;
  }
  if (typeof patch.avatar_emoji === "string") payload.avatar_emoji = patch.avatar_emoji.trim() || null;
  // "in patch" (not a truthiness check) so callers can explicitly clear a
  // real uploaded avatar back to null (e.g. switching back to the emoji
  // picker) -- a truthy-string check like avatar_emoji's above would make
  // clearing impossible, since an empty string and "not passed at all"
  // would look identical.
  if ("avatar_url" in patch) payload.avatar_url = patch.avatar_url?.trim() || null;
  if ("date_of_birth" in patch) payload.date_of_birth = patch.date_of_birth || null;
  if (typeof patch.age_verified === "boolean") payload.age_verified = patch.age_verified;
  if (typeof patch.marketing_opt_in === "boolean") payload.marketing_opt_in = patch.marketing_opt_in;
  if (typeof patch.onboarding_completed === "boolean") payload.onboarding_completed = patch.onboarding_completed;
  if (typeof patch.is_public === "boolean") payload.is_public = patch.is_public;
  if ("bio" in patch) payload.bio = patch.bio?.trim() || null;

  const result = await withTimeout(
    supabase
      .from("profiles")
      .update(payload)
      .eq("id", profileId)
      .select("*")
      .single()
      .then((res) => res),
    "Profile update"
  );

  const { data, error } = result;

  if (error) throw error;

  profilesPromise = null;
  return data as ProfileRow;
}

export function getStoredActiveProfileId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "";
}

export function setStoredActiveProfileId(profileId: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
  window.dispatchEvent(new Event("vltd:active-profile"));
}

/**
 * Pick the active profile consistently everywhere in the app.  This used to
 * be duplicated in TopNav and getOnboardingStatus with different fallback
 * orders, so a route change could silently switch a collector from their
 * default profile to the legacy `clerk` profile.
 */
export function resolveActiveProfile(profiles: ProfileRow[], storedId = "") {
  return (
    profiles.find((profile) => profile.id === storedId) ??
    profiles.find((profile) => profile.is_default) ??
    profiles.find((profile) => profile.username === "clerk") ??
    profiles[0] ??
    null
  );
}

// A failure to REACH the account service (no connection, a timeout, a server error, too many requests) says nothing about whether the
// person is signed in. Only an answer from the service that there is no valid session means signed out.
function looksTransient(error: unknown): boolean {
  const e = error as { name?: string; status?: number; message?: string } | null;
  if (!e) return false;
  if (e.name === "AuthRetryableFetchError") return true;
  if (typeof e.status === "number" && (e.status === 0 || e.status === 429 || e.status >= 500)) return true;
  return /failed to fetch|network|timeout|timed out|load failed|offline|unreachable/i.test(String(e.message ?? ""));
}

export async function getOnboardingStatus() {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      isAuthenticated: false,
      needsOnboarding: false,
      profiles: [] as ProfileRow[],
      activeProfile: null as ProfileRow | null,
      error: "",
    };
  }

  const userResult = await getCurrentUser();
  if (userResult.error && looksTransient(userResult.error)) {
    // The account service could not be reached: that must neither sign the person out nor look like an account with nothing in it.
    // Pages carry on with what is on this device and show their own "could not load" when there is nothing.
    return {
      isAuthenticated: true,
      needsOnboarding: false,
      profiles: [] as ProfileRow[],
      activeProfile: null as ProfileRow | null,
      error: "Could not reach your account just now.",
    };
  }
  if (userResult.error) {
    return {
      isAuthenticated: false,
      needsOnboarding: false,
      profiles: [] as ProfileRow[],
      activeProfile: null as ProfileRow | null,
      error: "",
    };
  }

  const profilesResult = await listMyProfiles();

  // A FAILED profile lookup must never be read as "this user has no profiles".
  // Otherwise an expired session (PGRST303 "JWT expired") or a blip sends a
  // real, fully-onboarded user to /onboarding and asks them to recreate their
  // identity — as if their account had been wiped. Auth failures belong at
  // /login; anything else should just pass through untouched.
  if (profilesResult.error) {
    const message = String(
      (profilesResult.error as { message?: string })?.message ?? profilesResult.error
    ).toLowerCase();
    const isAuthFailure =
      message.includes("jwt") ||
      message.includes("expired") ||
      message.includes("api key") ||
      message.includes("401") ||
      message.includes("not authenticated");

    return {
      isAuthenticated: !isAuthFailure,
      needsOnboarding: false,
      profiles: [] as ProfileRow[],
      activeProfile: null as ProfileRow | null,
      error: isAuthFailure ? "Your session expired. Please sign in again." : message,
    };
  }

  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const storedId = getStoredActiveProfileId();

  const activeProfile = resolveActiveProfile(profiles, storedId);

  if (activeProfile && activeProfile.id !== storedId) {
    setStoredActiveProfileId(activeProfile.id);
  }

  // Backend tier wins (when the column exists): sync the profile's tier into the
  // local subscription state, honoring expiry — an expired grant reverts to FREE.
  if (typeof window !== "undefined" && activeProfile && "tier" in activeProfile) {
    const raw = activeProfile.tier;
    const expiresAt = activeProfile.tier_expires_at;
    const expired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;
    const effective: "FREE" | "MID" | "FULL" =
      !raw || expired ? "FREE" : raw === "MID" || raw === "FULL" ? raw : "FREE";
    const { getTierSafe, setTierSafe } = await import("./subscription");
    if (getTierSafe() !== effective) {
      setTierSafe(effective);
    }
  }

  return {
    isAuthenticated: true,
    needsOnboarding:
      profiles.length === 0 ||
      profiles.some((profile) => profile.profile_type === "personal" && profile.onboarding_completed === false),
    profiles,
    activeProfile,
    error: "",
  };
}

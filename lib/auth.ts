import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type AuthProfileType = "personal" | "business";

export type ProfileRow = {
  id: string;
  user_id?: string;
  username: string;
  display_name: string;
  profile_type: AuthProfileType;
  primary_focus?: string | null;
  created_at?: string;
  is_default?: boolean | null;
};

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

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
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

  if (possibleSession && cachedSession === undefined) {
    cachedSession = possibleSession;
  }
  if (possibleUser && cachedUser === undefined) {
    cachedUser = possibleUser;
  }
}

function setCachedAuthFromSession(session: any) {
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

  supabase.auth.onAuthStateChange((_event, session) => {
    setCachedAuthFromSession(session);
    clearInFlightAuth();
    profilesPromise = null;
  });
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
    profilesPromise = null;
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

export async function signUpWithPassword(email: string, password: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not ready");

  const { data, error } = await withTimeout(
    supabase.auth.signUp({ email, password }),
    "Password sign up"
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

export async function signOut() {
  const supabase = getSupabase();
  if (!supabase) return;

  cachedUser = null;
  cachedSession = null;
  clearInFlightAuth();
  profilesPromise = null;

  await supabase.auth.signOut();

  if (typeof window !== "undefined") {
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
    window.dispatchEvent(new Event("vltd:active-profile"));
  }
}

export async function listMyProfiles() {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      data: [] as ProfileRow[],
      error: new Error("Supabase client is not configured."),
    };
  }

  if (profilesPromise) return profilesPromise;

  profilesPromise = (async () => {
    const userResult = await getCurrentUser();
    const userId = userResult.data.user?.id;
    if (!userId) {
      profilesPromise = null;
      return { data: [] as ProfileRow[], error: null };
    }

    try {
      const query = supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      const result = await withTimeout(query, "Profile list lookup");
      return {
        data: (result.data ?? []) as ProfileRow[],
        error: (result as any).error ?? null,
      };
    } catch (error) {
      return {
        data: [] as ProfileRow[],
        error: error instanceof Error ? error : new Error("Profile list lookup failed."),
      };
    } finally {
      profilesPromise = null;
    }
  })();

  return profilesPromise;
}

export async function createProfile(input: {
  username: string;
  display_name: string;
  profile_type: AuthProfileType;
  primary_focus?: string;
}) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Supabase not ready");

  const userResult = await getCurrentUser();
  const userId = userResult.data.user?.id;
  if (!userId) throw new Error("No authenticated user found.");

  const payload = {
    user_id: userId,
    username: input.username.trim(),
    display_name: input.display_name.trim(),
    profile_type: input.profile_type,
    primary_focus: input.primary_focus?.trim() || null,
  };

  const { data, error } = await withTimeout(
    supabase.from("profiles").insert(payload).select("*").single(),
    "Profile creation"
  );

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

  const { data, error } = await withTimeout(
    supabase.from("profiles").update(payload).eq("id", profileId).select("*").single(),
    "Profile update"
  );

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
  if (userResult.error) {
    return {
      isAuthenticated: false,
      needsOnboarding: false,
      profiles: [] as ProfileRow[],
      activeProfile: null as ProfileRow | null,
      error: userResult.error.message,
    };
  }

  const user = userResult.data.user;
  if (!user) {
    return {
      isAuthenticated: false,
      needsOnboarding: false,
      profiles: [] as ProfileRow[],
      activeProfile: null as ProfileRow | null,
      error: "",
    };
  }

  const profilesResult = await listMyProfiles();
  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const storedId = getStoredActiveProfileId();

  const activeProfile =
    profiles.find((p) => p.id === storedId) ??
    profiles.find((p) => p.is_default) ??
    profiles.find((p) => p.username === "clerk") ??
    profiles[0] ??
    null;

  if (activeProfile && activeProfile.id !== storedId) {
    setStoredActiveProfileId(activeProfile.id);
  }

  return {
    isAuthenticated: true,
    needsOnboarding: profiles.length === 0,
    profiles,
    activeProfile,
    error: profilesResult.error
      ? String(profilesResult.error.message ?? "Failed to load profiles.")
      : "",
  };
}
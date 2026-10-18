"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getStoredActiveProfileId } from "@/lib/auth";

/**
 * Favorites belong to the profile you are signed into (personal or Business). Each new favorite is stamped
 * with its profile; favorites saved before that carry no profile and stay visible to both.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scopeToProfile<T>(query: T): T {
  const id = getStoredActiveProfileId();
  if (!id) return query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (query as any).or(`metadata->>profile_id.eq.${id},metadata->>profile_id.is.null`) as T;
}

export type FavoriteContentType = "item" | "gallery";

export type FavoriteIdentity =
  | { type: "user"; userId: string; anonymousId?: string }
  | { type: "anonymous"; anonymousId: string };

export type FavoriteStatus = {
  favorited: boolean;
  count: number;
  identityType: FavoriteIdentity["type"] | "unavailable";
};

export type FavoriteRecord = {
  id: string;
  content_type: FavoriteContentType;
  content_id: string;
  user_id?: string | null;
  anonymous_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
};

const FAVORITE_ANON_KEY = "vltd_public_favorite_anon_id_v1";
const FAVORITES_TABLE = "public_favorites";

function makeAnonymousId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function getAnonymousId() {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(FAVORITE_ANON_KEY);
    if (existing) return existing;
    const next = makeAnonymousId();
    window.localStorage.setItem(FAVORITE_ANON_KEY, next);
    return next;
  } catch {
    return makeAnonymousId();
  }
}

export async function getFavoriteIdentity(): Promise<FavoriteIdentity | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  try {
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id;
    if (userId) return { type: "user", userId, anonymousId: getAnonymousId() };
  } catch {
    // Guest identity is still valid for public favorite actions.
  }

  return { type: "anonymous", anonymousId: getAnonymousId() };
}

function identityFilter(identity: FavoriteIdentity) {
  if (identity.type === "user") return { user_id: identity.userId };
  return { anonymous_id: identity.anonymousId };
}

/** True when a database function the app tries first has not been installed yet (so the older query is used instead). */
function isMissingFunction(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false;
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function|does not exist/i.test(String(error.message ?? ""));
}

/**
 * Has THIS guest saved it? Visitors can no longer read the saves table (it listed every account's and every guest's saves), so the question
 * goes to a database function that answers yes or no for the exact guest id it is given. The guest id is a random string made in the guest's own
 * browser and is no longer listable, which is what makes it work as ownership.
 */
async function guestHasSaved(contentType: FavoriteContentType, contentId: string, anonymousId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const viaFunction = await supabase.rpc("guest_favorite_status", { p_content_type: contentType, p_content_id: contentId, p_anonymous_id: anonymousId });
  if (!viaFunction.error) return viaFunction.data === true;
  if (!isMissingFunction(viaFunction.error)) return false;
  // Function not installed yet: the older direct query.
  const { data, error } = await supabase.from(FAVORITES_TABLE).select("id").eq("content_type", contentType).eq("content_id", contentId).eq("anonymous_id", anonymousId).limit(1);
  return !error && Array.isArray(data) && data.length > 0;
}

export async function getFavoriteCount(contentType: FavoriteContentType, contentId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !contentId) return 0;

  // The public count comes from a database function that returns only a number: nobody can read the saves themselves.
  const viaFunction = await supabase.rpc("favorite_count", { p_content_type: contentType, p_content_id: contentId });
  if (!viaFunction.error) return Number(viaFunction.data) || 0;
  if (!isMissingFunction(viaFunction.error)) return 0;

  const { count, error } = await supabase
    .from(FAVORITES_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("content_type", contentType)
    .eq("content_id", contentId);

  if (error) return 0;
  return count ?? 0;
}

export async function getFavoriteStatus(
  contentType: FavoriteContentType,
  contentId: string
): Promise<FavoriteStatus> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !contentId) return { favorited: false, count: 0, identityType: "unavailable" };

  const identity = await getFavoriteIdentity();
  if (!identity) return { favorited: false, count: await getFavoriteCount(contentType, contentId), identityType: "unavailable" };

  const countPromise = getFavoriteCount(contentType, contentId);
  if (identity.type === "anonymous") {
    const [favorited, count] = await Promise.all([guestHasSaved(contentType, contentId, identity.anonymousId), countPromise]);
    return { favorited, count, identityType: identity.type };
  }
  let query = supabase
    .from(FAVORITES_TABLE)
    .select("id")
    .eq("content_type", contentType)
    .eq("content_id", contentId)
    .limit(1);

  const filter = identityFilter(identity);
  if ("user_id" in filter) query = scopeToProfile(query.eq("user_id", filter.user_id));
  else query = query.eq("anonymous_id", filter.anonymous_id);

  const [{ data, error }, count] = await Promise.all([query, countPromise]);

  return {
    favorited: !error && Array.isArray(data) && data.length > 0,
    count,
    identityType: identity.type,
  };
}

export async function setFavoriteState({
  contentType,
  contentId,
  favorited,
  metadata,
}: {
  contentType: FavoriteContentType;
  contentId: string;
  favorited: boolean;
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Favorites require Supabase to be configured.");
  if (!contentId) throw new Error("Missing favorite content id.");

  const identity = await getFavoriteIdentity();
  if (!identity) throw new Error("Favorite identity unavailable.");

  if (!favorited) {
    const filter = identityFilter(identity);
    if ("user_id" in filter) {
      // Signed-in users have a real, RLS-verified identity (auth.uid() =
      // user_id) — the direct delete is already safely scoped server-side.
      const { error } = await scopeToProfile(
        supabase
          .from(FAVORITES_TABLE)
          .delete()
          .eq("content_type", contentType)
          .eq("content_id", contentId)
          .eq("user_id", filter.user_id)
      );
      if (error) throw error;
    } else {
      // Guests have no server-verified identity to check against, so this
      // goes through unfavorite_as_guest instead of a raw delete — that
      // RPC only ever removes the one exact row named, instead of relying
      // on an RLS policy that (before 20260823_fix_guest_favorite_delete)
      // couldn't tell an anonymous_id-scoped request from a bare
      // "delete every guest favorite" one.
      const { error } = await supabase.rpc("unfavorite_as_guest", {
        p_content_type: contentType,
        p_content_id: contentId,
        p_anonymous_id: filter.anonymous_id,
      });
      if (error) throw error;
    }
    return getFavoriteStatus(contentType, contentId);
  }

  let existingQuery = supabase
    .from(FAVORITES_TABLE)
    .select("id")
    .eq("content_type", contentType)
    .eq("content_id", contentId)
    .limit(1);

  const filter = identityFilter(identity);
  if (!("user_id" in filter)) {
    // A guest cannot read the table: ask the function whether this guest already saved it.
    if (await guestHasSaved(contentType, contentId, filter.anonymous_id)) return getFavoriteStatus(contentType, contentId);
  } else {
    existingQuery = scopeToProfile(existingQuery.eq("user_id", filter.user_id));
    const { data: existingRows } = await existingQuery;
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      return getFavoriteStatus(contentType, contentId);
    }
  }

  const payload = {
    content_type: contentType,
    content_id: contentId,
    user_id: identity.type === "user" ? identity.userId : null,
    anonymous_id: identity.type === "anonymous" ? identity.anonymousId : null,
    metadata: { ...(metadata ?? {}), ...(identity.type === "user" && getStoredActiveProfileId() ? { profile_id: getStoredActiveProfileId() } : {}) },
  };

  const { error } = await supabase.from(FAVORITES_TABLE).insert(payload);

  if (error) throw error;
  return getFavoriteStatus(contentType, contentId);
}

export async function toggleFavorite({
  contentType,
  contentId,
  current,
  metadata,
}: {
  contentType: FavoriteContentType;
  contentId: string;
  current: boolean;
  metadata?: Record<string, unknown>;
}) {
  return setFavoriteState({ contentType, contentId, favorited: !current, metadata });
}

export async function listViewerFavorites() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [] as FavoriteRecord[];

  const identity = await getFavoriteIdentity();
  if (!identity) return [] as FavoriteRecord[];

  let query = supabase
    .from(FAVORITES_TABLE)
    .select("id,content_type,content_id,user_id,anonymous_id,metadata,created_at")
    .order("created_at", { ascending: false });

  const filter = identityFilter(identity);
  if ("user_id" in filter) query = scopeToProfile(query.eq("user_id", filter.user_id));
  else query = query.eq("anonymous_id", filter.anonymous_id);

  const { data, error } = await query;
  if (error || !Array.isArray(data)) return [];
  return data as FavoriteRecord[];
}

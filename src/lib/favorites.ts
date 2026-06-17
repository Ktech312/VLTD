"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

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

export async function getFavoriteCount(contentType: FavoriteContentType, contentId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !contentId) return 0;

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
  let query = supabase
    .from(FAVORITES_TABLE)
    .select("id")
    .eq("content_type", contentType)
    .eq("content_id", contentId)
    .limit(1);

  const filter = identityFilter(identity);
  if ("user_id" in filter) query = query.eq("user_id", filter.user_id);
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
    let deleteQuery = supabase
      .from(FAVORITES_TABLE)
      .delete()
      .eq("content_type", contentType)
      .eq("content_id", contentId);

    const filter = identityFilter(identity);
    if ("user_id" in filter) deleteQuery = deleteQuery.eq("user_id", filter.user_id);
    else deleteQuery = deleteQuery.eq("anonymous_id", filter.anonymous_id);

    const { error } = await deleteQuery;
    if (error) throw error;
    return getFavoriteStatus(contentType, contentId);
  }

  let existingQuery = supabase
    .from(FAVORITES_TABLE)
    .select("id")
    .eq("content_type", contentType)
    .eq("content_id", contentId)
    .limit(1);

  const filter = identityFilter(identity);
  if ("user_id" in filter) existingQuery = existingQuery.eq("user_id", filter.user_id);
  else existingQuery = existingQuery.eq("anonymous_id", filter.anonymous_id);

  const { data: existingRows } = await existingQuery;
  if (Array.isArray(existingRows) && existingRows.length > 0) {
    return getFavoriteStatus(contentType, contentId);
  }

  const payload = {
    content_type: contentType,
    content_id: contentId,
    user_id: identity.type === "user" ? identity.userId : null,
    anonymous_id: identity.type === "anonymous" ? identity.anonymousId : null,
    metadata: metadata ?? {},
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
  if ("user_id" in filter) query = query.eq("user_id", filter.user_id);
  else query = query.eq("anonymous_id", filter.anonymous_id);

  const { data, error } = await query;
  if (error || !Array.isArray(data)) return [];
  return data as FavoriteRecord[];
}

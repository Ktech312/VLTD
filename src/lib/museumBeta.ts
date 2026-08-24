"use client";

// 3D Museum beta gate — EK's ask: a "Beta" button on every exhibition
// card, clicking it requests access (or opens the builder if already
// enabled); EK grants access per-user from /admin/users. See
// 20260823_museum_beta_flag.sql for the two profiles columns this reads/
// writes and why museum_beta_enabled itself can't be set from here.

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

function getActiveProfileId(): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

export type MuseumBetaStatus = {
  enabled: boolean;
  requestedAt: number | null;
};

export async function getMuseumBetaStatus(): Promise<MuseumBetaStatus> {
  const profileId = getActiveProfileId();
  if (!profileId) return { enabled: false, requestedAt: null };

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { enabled: false, requestedAt: null };

  try {
    const { data } = await supabase
      .from("profiles")
      .select("museum_beta_enabled, museum_beta_requested_at")
      .eq("id", profileId)
      .maybeSingle();

    return {
      enabled: !!data?.museum_beta_enabled,
      requestedAt: data?.museum_beta_requested_at
        ? new Date(data.museum_beta_requested_at).getTime()
        : null,
    };
  } catch {
    return { enabled: false, requestedAt: null };
  }
}

/** Records "I asked" — museum_beta_enabled itself is admin-only, locked by a trigger. */
export async function requestMuseumBetaAccess(): Promise<boolean> {
  const profileId = getActiveProfileId();
  if (!profileId) return false;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ museum_beta_requested_at: new Date().toISOString() })
      .eq("id", profileId);
    return !error;
  } catch {
    return false;
  }
}

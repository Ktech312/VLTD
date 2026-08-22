"use client";

// Real clubs + discussion boards + moderation. Mirrors loungePosts.ts's
// pattern (joined profile select, mapRow helper, RPC calls for anything
// that needs server-side authorization instead of a raw table write) --
// see supabase/migrations/20260822_clubs.sql for the full schema/RLS.

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { resolveAvatarSrc } from "@/lib/avatarResolve";

export type ClubRole = "owner" | "moderator" | "member";

export type Club = {
  id: string;
  name: string;
  description: string;
  ownerProfileId: string;
  createdAt: number;
  memberCount: number;
};

export type ClubMember = {
  profileId: string;
  role: ClubRole;
  joinedAt: number;
  name: string;
  username: string;
  avatarSrc: string | null;
};

export type ClubPost = {
  id: string;
  clubId: string;
  profileId: string;
  body: string;
  createdAt: number;
  authorName: string;
  authorUsername: string;
  authorAvatarSrc: string | null;
};

export type ClubReport = {
  id: string;
  postId: string;
  reason: string;
  createdAt: number;
  resolvedAt: number | null;
  postBody: string;
  reporterName: string;
};

export type ClubIntegrations = {
  discordWebhookUrl: string;
  redditSubreddit: string;
};

function authorFields(row: Record<string, unknown>, profileId: string) {
  const author = (row.profiles ?? {}) as Record<string, unknown>;
  const displayName = String(author.display_name || author.username || "Collector");
  return {
    authorName: displayName,
    authorUsername: String(author.username ?? ""),
    authorAvatarSrc: resolveAvatarSrc({
      avatarUrl: (author.avatar_url as string) ?? null,
      avatarEmoji: (author.avatar_emoji as string) ?? null,
      profileId,
      displayName,
    }),
  };
}

/** Clubs, newest first, with a real member count (a second lightweight
 *  query per club -- fine at this scale; worth a count-cache column if the
 *  club list ever gets large). */
export async function listClubs(limit = 50): Promise<Club[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, description, owner_profile_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];

  const clubs = await Promise.all(
    data.map(async (row) => {
      const { count } = await supabase
        .from("club_members")
        .select("profile_id", { count: "exact", head: true })
        .eq("club_id", row.id as string);
      return {
        id: row.id as string,
        name: row.name as string,
        description: (row.description as string) || "",
        ownerProfileId: row.owner_profile_id as string,
        createdAt: new Date(row.created_at as string).getTime(),
        memberCount: count ?? 0,
      };
    })
  );
  return clubs;
}

export async function getClub(clubId: string): Promise<Club | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, description, owner_profile_id, created_at")
    .eq("id", clubId)
    .single();
  if (error || !data) return null;
  const { count } = await supabase
    .from("club_members")
    .select("profile_id", { count: "exact", head: true })
    .eq("club_id", clubId);
  return {
    id: data.id as string,
    name: data.name as string,
    description: (data.description as string) || "",
    ownerProfileId: data.owner_profile_id as string,
    createdAt: new Date(data.created_at as string).getTime(),
    memberCount: count ?? 0,
  };
}

export async function createClub(name: string, description: string): Promise<Club | null> {
  const trimmedName = name.trim();
  if (!trimmedName) return null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;
  const { data: profileRow } = await supabase.from("profiles").select("id").eq("user_id", userData.user.id).limit(1).single();
  const ownerProfileId = profileRow?.id as string | undefined;
  if (!ownerProfileId) return null;

  const { data, error } = await supabase
    .from("clubs")
    .insert({ name: trimmedName, description: description.trim(), owner_profile_id: ownerProfileId })
    .select("id, name, description, owner_profile_id, created_at")
    .single();
  if (error || !data) return null;
  return {
    id: data.id as string,
    name: data.name as string,
    description: (data.description as string) || "",
    ownerProfileId: data.owner_profile_id as string,
    createdAt: new Date(data.created_at as string).getTime(),
    memberCount: 1,
  };
}

/** This signed-in curator's own membership row for a club, or null if
 *  they've never joined. */
export async function getMyMembership(clubId: string, myProfileId: string): Promise<ClubRole | null> {
  if (!myProfileId) return null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("profile_id", myProfileId)
    .maybeSingle();
  return (data?.role as ClubRole) ?? null;
}

export async function joinClub(clubId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase.rpc("join_club", { p_club_id: clubId });
  return !error;
}

export async function leaveClub(clubId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase.rpc("leave_club", { p_club_id: clubId });
  return !error;
}

export async function listClubMembers(clubId: string): Promise<ClubMember[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("club_members")
    .select("profile_id, role, joined_at, profiles(display_name, username, avatar_url, avatar_emoji)")
    .eq("club_id", clubId)
    .order("joined_at", { ascending: true });
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => {
    const profileId = row.profile_id as string;
    const author = authorFields(row as Record<string, unknown>, profileId);
    return {
      profileId,
      role: row.role as ClubRole,
      joinedAt: new Date(row.joined_at as string).getTime(),
      name: author.authorName,
      username: author.authorUsername,
      avatarSrc: author.authorAvatarSrc,
    };
  });
}

export async function removeClubMember(clubId: string, targetProfileId: string, reason?: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase.rpc("remove_club_member", {
    p_club_id: clubId,
    p_target_profile_id: targetProfileId,
    p_reason: reason ?? null,
  });
  return !error;
}

export async function setClubModerator(clubId: string, targetProfileId: string, isModerator: boolean): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase.rpc("set_club_moderator", {
    p_club_id: clubId,
    p_target_profile_id: targetProfileId,
    p_is_moderator: isModerator,
  });
  return !error;
}

export async function listClubPosts(clubId: string, limit = 50): Promise<ClubPost[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("club_posts")
    .select("id, club_id, profile_id, body, created_at, profiles(display_name, username, avatar_url, avatar_emoji)")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => {
    const profileId = row.profile_id as string;
    const author = authorFields(row as Record<string, unknown>, profileId);
    return {
      id: row.id as string,
      clubId: row.club_id as string,
      profileId,
      body: row.body as string,
      createdAt: new Date(row.created_at as string).getTime(),
      ...author,
    };
  });
}

export async function addClubPost(clubId: string, profileId: string, body: string): Promise<ClubPost | null> {
  const trimmed = body.trim();
  if (!clubId || !profileId || !trimmed) return null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("club_posts")
    .insert({ club_id: clubId, profile_id: profileId, body: trimmed })
    .select("id, club_id, profile_id, body, created_at, profiles(display_name, username, avatar_url, avatar_emoji)")
    .single();
  if (error || !data) return null;
  const author = authorFields(data as Record<string, unknown>, profileId);
  return {
    id: data.id as string,
    clubId: data.club_id as string,
    profileId,
    body: data.body as string,
    createdAt: new Date(data.created_at as string).getTime(),
    ...author,
  };
}

/** Hides a post -- allowed for the post's own author OR club staff
 *  (enforced server-side inside hide_club_post(), not just this client
 *  check). */
export async function hideClubPost(postId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase.rpc("hide_club_post", { p_post_id: postId });
  return !error;
}

export async function reportClubPost(postId: string, reason: string): Promise<boolean> {
  const trimmed = reason.trim();
  if (!postId || !trimmed) return false;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return false;
  const { data: profileRow } = await supabase.from("profiles").select("id").eq("user_id", userData.user.id).limit(1).single();
  const reporterProfileId = profileRow?.id as string | undefined;
  if (!reporterProfileId) return false;
  const { error } = await supabase
    .from("club_post_reports")
    .insert({ post_id: postId, reporter_profile_id: reporterProfileId, reason: trimmed });
  return !error;
}

/** Open reports for a club, staff-only (RLS enforces this — a non-staff
 *  caller just gets an empty list back, not an error). Two simple queries
 *  (this club's post ids, then reports against those ids) instead of one
 *  fragile nested-embed filter, since a mistake there would only surface
 *  as a runtime PostgREST error, not a type error. */
export async function listClubReports(clubId: string): Promise<ClubReport[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const { data: postRows } = await supabase.from("club_posts").select("id").eq("club_id", clubId);
  const postIds = (postRows ?? []).map((r) => r.id as string);
  if (postIds.length === 0) return [];

  const { data, error } = await supabase
    .from("club_post_reports")
    .select("id, post_id, reason, created_at, resolved_at, club_posts(body), profiles(display_name, username)")
    .in("post_id", postIds)
    .is("resolved_at", null)
    .order("created_at", { ascending: false });
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => {
    const post = (row.club_posts ?? {}) as unknown as Record<string, unknown>;
    const reporter = (row.profiles ?? {}) as unknown as Record<string, unknown>;
    return {
      id: row.id as string,
      postId: row.post_id as string,
      reason: row.reason as string,
      createdAt: new Date(row.created_at as string).getTime(),
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string).getTime() : null,
      postBody: String(post.body ?? ""),
      reporterName: String(reporter.display_name || reporter.username || "Someone"),
    };
  });
}

export async function resolveClubReport(reportId: string): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase.rpc("resolve_club_report", { p_report_id: reportId });
  return !error;
}

/** Owner-only settings — Discord webhook / Reddit subreddit for the
 *  cross-posting follow-ups. RLS restricts this table to the club's owner,
 *  so a non-owner reading this just gets nulls back, not an error. */
export async function getClubIntegrations(clubId: string): Promise<ClubIntegrations> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { discordWebhookUrl: "", redditSubreddit: "" };
  const { data } = await supabase
    .from("club_integrations")
    .select("discord_webhook_url, reddit_subreddit")
    .eq("club_id", clubId)
    .maybeSingle();
  return {
    discordWebhookUrl: (data?.discord_webhook_url as string) || "",
    redditSubreddit: (data?.reddit_subreddit as string) || "",
  };
}

export async function saveClubIntegrations(clubId: string, integrations: ClubIntegrations): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase.from("club_integrations").upsert({
    club_id: clubId,
    discord_webhook_url: integrations.discordWebhookUrl.trim() || null,
    reddit_subreddit: integrations.redditSubreddit.trim() || null,
    updated_at: new Date().toISOString(),
  });
  return !error;
}

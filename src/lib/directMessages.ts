"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { resolveAvatarSrc } from "@/lib/avatarResolve";

export type Conversation = {
  id: string;
  otherProfileId: string;
  otherName: string;
  otherUsername: string;
  otherAvatarSrc: string | null;
  lastMessageAt: number;
  lastMessagePreview: string;
  unreadCount: number;
  starred: boolean;
};

export type CollectorResult = {
  profileId: string;
  name: string;
  avatarSrc: string | null;
};

export type DirectMessage = {
  id: string;
  conversationId: string;
  senderProfileId: string;
  body: string;
  createdAt: number;
  readAt: number | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  avatar_emoji: string | null;
};

type ConversationRow = {
  id: string;
  profile_a_id: string;
  profile_b_id: string;
  last_message_at: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

type PrefsRow = {
  conversation_id: string;
  starred: boolean;
  hidden: boolean;
};

function mapMessage(row: MessageRow): DirectMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderProfileId: row.sender_profile_id,
    body: row.body,
    createdAt: new Date(row.created_at).getTime(),
    readAt: row.read_at ? new Date(row.read_at).getTime() : null,
  };
}

/** Finds or creates the 1:1 conversation with another profile. Returns the
 *  conversation id, or null if not signed in / targeting yourself.
 *  callerProfileId must be the viewer's own active profile id -- accounts
 *  can own more than one profiles row (personal/business), so the RPC can't
 *  safely guess which one you're acting as; it verifies ownership itself. */
export async function getOrCreateConversation(callerProfileId: string, otherProfileId: string): Promise<string | null> {
  if (!callerProfileId || !otherProfileId) return null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_or_create_conversation", {
    p_caller_profile_id: callerProfileId,
    p_other_profile_id: otherProfileId,
  });
  if (error || !data) return null;
  return String(data);
}

/** All of the viewer's conversations, newest activity first, each enriched
 *  with the other participant's real profile info, a real last-message
 *  preview, and a real unread count — not placeholders. */
export async function listConversations(profileId: string): Promise<Conversation[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !profileId) return [];

  const { data: convRows, error } = await supabase
    .from("conversations")
    .select("id, profile_a_id, profile_b_id, last_message_at")
    .or(`profile_a_id.eq.${profileId},profile_b_id.eq.${profileId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error || !Array.isArray(convRows) || convRows.length === 0) return [];
  const rows = convRows as ConversationRow[];

  const otherIds = [...new Set(rows.map((c) => (c.profile_a_id === profileId ? c.profile_b_id : c.profile_a_id)))];
  const convIds = rows.map((c) => c.id);

  const [profilesRes, messagesRes, prefsRes] = await Promise.all([
    supabase.from("profiles").select("id, display_name, username, avatar_url, avatar_emoji").in("id", otherIds),
    supabase
      .from("direct_messages")
      .select("id, conversation_id, sender_profile_id, body, created_at, read_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("conversation_prefs")
      .select("conversation_id, starred, hidden")
      .eq("profile_id", profileId)
      .in("conversation_id", convIds),
  ]);

  const profileById = new Map<string, ProfileRow>(
    ((profilesRes.data ?? []) as ProfileRow[]).map((p) => [p.id, p])
  );

  const latestByConv = new Map<string, MessageRow>();
  const unreadByConv = new Map<string, number>();
  for (const m of (messagesRes.data ?? []) as MessageRow[]) {
    if (!latestByConv.has(m.conversation_id)) latestByConv.set(m.conversation_id, m);
    if (m.sender_profile_id !== profileId && !m.read_at) {
      unreadByConv.set(m.conversation_id, (unreadByConv.get(m.conversation_id) ?? 0) + 1);
    }
  }

  const prefsByConv = new Map<string, PrefsRow>(
    ((prefsRes.data ?? []) as PrefsRow[]).map((p) => [p.conversation_id, p])
  );

  const result = rows
    .filter((c) => !prefsByConv.get(c.id)?.hidden)
    .map((c) => {
      const otherId = c.profile_a_id === profileId ? c.profile_b_id : c.profile_a_id;
      const p = profileById.get(otherId);
      const displayName = p?.display_name || p?.username || "Collector";
      const latest = latestByConv.get(c.id);
      return {
        id: c.id,
        otherProfileId: otherId,
        otherName: displayName,
        otherUsername: p?.username ?? "",
        otherAvatarSrc: resolveAvatarSrc({
          avatarUrl: p?.avatar_url ?? null,
          avatarEmoji: p?.avatar_emoji ?? null,
          profileId: otherId,
          displayName,
        }),
        lastMessageAt: c.last_message_at ? new Date(c.last_message_at).getTime() : 0,
        lastMessagePreview: latest?.body ?? "",
        unreadCount: unreadByConv.get(c.id) ?? 0,
        starred: prefsByConv.get(c.id)?.starred ?? false,
      };
    });

  // Starred conversations float to the top; within each group, most
  // recent activity first (the query above already sorted by that, so a
  // stable sort here just regroups without disturbing recency order).
  return result.sort((a, b) => Number(b.starred) - Number(a.starred));
}

/** Star or unstar a conversation for the current viewer only — the other
 *  participant's own view is unaffected. */
export async function setConversationStarred(
  profileId: string,
  conversationId: string,
  starred: boolean
): Promise<boolean> {
  if (!profileId || !conversationId) return false;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from("conversation_prefs")
    .upsert(
      { profile_id: profileId, conversation_id: conversationId, starred, updated_at: new Date().toISOString() },
      { onConflict: "profile_id,conversation_id" }
    );
  return !error;
}

/** Removes a conversation from the current viewer's inbox only — not a
 *  delete. It resurfaces automatically the next time either side sends a
 *  new message (server-side, see the touch_conversation_on_message
 *  trigger), same as archiving in most inboxes. */
export async function hideConversation(profileId: string, conversationId: string): Promise<boolean> {
  if (!profileId || !conversationId) return false;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { error } = await supabase
    .from("conversation_prefs")
    .upsert(
      { profile_id: profileId, conversation_id: conversationId, hidden: true, updated_at: new Date().toISOString() },
      { onConflict: "profile_id,conversation_id" }
    );
  return !error;
}

/** Real collector search by display name, for starting a new conversation
 *  from the inbox instead of only from someone's profile page. */
export async function searchCollectors(query: string, excludeProfileId: string): Promise<CollectorResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("public_profiles")
    .select("profile_id, display_name, avatar_url, avatar_emoji")
    .ilike("display_name", `%${trimmed}%`)
    .neq("profile_id", excludeProfileId)
    .limit(10);

  if (error || !Array.isArray(data)) return [];
  return data.map((p) => {
    const displayName = String(p.display_name || "Collector");
    const profileId = String(p.profile_id);
    return {
      profileId,
      name: displayName,
      avatarSrc: resolveAvatarSrc({
        avatarUrl: (p.avatar_url as string) ?? null,
        avatarEmoji: (p.avatar_emoji as string) ?? null,
        profileId,
        displayName,
      }),
    };
  });
}

/** Every message in one conversation, oldest first (thread reading order). */
export async function listMessages(conversationId: string): Promise<DirectMessage[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !conversationId) return [];
  const { data, error } = await supabase
    .from("direct_messages")
    .select("id, conversation_id, sender_profile_id, body, created_at, read_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error || !Array.isArray(data)) return [];
  return (data as MessageRow[]).map(mapMessage);
}

export async function sendMessage(
  conversationId: string,
  senderProfileId: string,
  body: string
): Promise<DirectMessage | null> {
  const trimmed = body.trim();
  if (!conversationId || !senderProfileId || !trimmed) return null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("direct_messages")
    .insert({ conversation_id: conversationId, sender_profile_id: senderProfileId, body: trimmed })
    .select("id, conversation_id, sender_profile_id, body, created_at, read_at")
    .single();

  if (error || !data) return null;
  return mapMessage(data as MessageRow);
}

export async function markConversationRead(callerProfileId: string, conversationId: string): Promise<void> {
  if (!callerProfileId || !conversationId) return;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  await supabase.rpc("mark_conversation_read", {
    p_caller_profile_id: callerProfileId,
    p_conversation_id: conversationId,
  });
}

/** Total unread DMs across every conversation — for the nav badge. */
export async function getTotalUnreadCount(profileId: string): Promise<number> {
  const conversations = await listConversations(profileId);
  return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
}

/** Live-updates an open thread: fires for every new message in this
 *  conversation, from either side, without needing to leave and reopen
 *  the page. Returns an unsubscribe function. */
export function subscribeToConversationMessages(
  conversationId: string,
  onMessage: (message: DirectMessage) => void
): () => void {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !conversationId) return () => {};

  const channel = supabase
    .channel(`dm_thread:${conversationId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${conversationId}` },
      (payload) => onMessage(mapMessage(payload.new as MessageRow))
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/** Live-updates the inbox list (new conversations, new last-message
 *  previews, ordering) for the given viewer profile. Returns an
 *  unsubscribe function. */
export function subscribeToMyConversations(profileId: string, onChange: () => void): () => void {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || !profileId) return () => {};

  const channel = supabase
    .channel(`dm_inbox:${profileId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversations", filter: `profile_a_id=eq.${profileId}` },
      onChange
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversations", filter: `profile_b_id=eq.${profileId}` },
      onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

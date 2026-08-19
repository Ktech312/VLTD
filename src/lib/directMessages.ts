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
 *  conversation id, or null if not signed in / targeting yourself. */
export async function getOrCreateConversation(otherProfileId: string): Promise<string | null> {
  if (!otherProfileId) return null;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_or_create_conversation", {
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

  const [profilesRes, messagesRes] = await Promise.all([
    supabase.from("profiles").select("id, display_name, username, avatar_url, avatar_emoji").in("id", otherIds),
    supabase
      .from("direct_messages")
      .select("id, conversation_id, sender_profile_id, body, created_at, read_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false }),
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

  return rows.map((c) => {
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

export async function markConversationRead(conversationId: string): Promise<void> {
  if (!conversationId) return;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  await supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId });
}

/** Total unread DMs across every conversation — for the nav badge. */
export async function getTotalUnreadCount(profileId: string): Promise<number> {
  const conversations = await listConversations(profileId);
  return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
}

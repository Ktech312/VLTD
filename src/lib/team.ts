// Team management — wrappers over the profile_members RPCs.
// Owner/Admin can invite, re-role, and remove members of a profile.

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type TeamRole = "owner" | "admin" | "member";
export type TeamMember = {
  user_id: string;
  email: string;
  role: TeamRole;
  created_at: string;
};

type RpcResult = { ok: boolean; error?: string };

export async function listTeamMembers(profileId: string): Promise<TeamMember[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb || !profileId) return [];
  const { data, error } = await sb.rpc("list_profile_members", { p_profile: profileId });
  if (error) return [];
  return (data ?? []) as TeamMember[];
}

export async function addTeamMember(profileId: string, email: string, role: "admin" | "member"): Promise<RpcResult> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { ok: false, error: "Not connected." };
  const { data, error } = await sb.rpc("add_profile_member", { p_profile: profileId, p_email: email, p_role: role });
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false, error: "No response." }) as RpcResult;
}

export async function removeTeamMember(profileId: string, userId: string): Promise<RpcResult> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { ok: false, error: "Not connected." };
  const { data, error } = await sb.rpc("remove_profile_member", { p_profile: profileId, p_user: userId });
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false, error: "No response." }) as RpcResult;
}

export async function updateTeamMemberRole(profileId: string, userId: string, role: "admin" | "member"): Promise<RpcResult> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { ok: false, error: "Not connected." };
  const { data, error } = await sb.rpc("update_member_role", { p_profile: profileId, p_user: userId, p_role: role });
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false, error: "No response." }) as RpcResult;
}

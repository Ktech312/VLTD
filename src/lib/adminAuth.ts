import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

export type AdminRole = "owner" | "admin" | null;

export type AdminEntry = {
  id: string;
  email: string;
  granted_by: string | null;
  granted_at: string;
};

const OWNER_EMAIL = process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "";

export async function getCurrentUserEmail(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}

export async function getMyAdminRole(): Promise<AdminRole> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  if (OWNER_EMAIL && user.email === OWNER_EMAIL) return "owner";

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("email", user.email)
    .maybeSingle();

  return (data?.role as AdminRole) ?? null;
}

export async function listAdmins(): Promise<AdminEntry[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("user_roles")
    .select("*")
    .order("granted_at", { ascending: true });
  return (data ?? []) as AdminEntry[];
}

export async function grantAdmin(
  email: string,
  grantedBy: string
): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return "No Supabase connection";
  const { error } = await supabase
    .from("user_roles")
    .insert({ email: email.trim().toLowerCase(), role: "admin", granted_by: grantedBy });
  return error?.message ?? null;
}

export async function revokeAdmin(id: string): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return "No Supabase connection";
  const { error } = await supabase.from("user_roles").delete().eq("id", id);
  return error?.message ?? null;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return "No Supabase connection";
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error?.message ?? null;
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}

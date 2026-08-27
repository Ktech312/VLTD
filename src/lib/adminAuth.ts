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

// Role only, no MFA check — the raw "is this email on the admin list"
// answer, reused by both the public MFA-gated check below and the
// richer status export that tells the UI *why* access was denied.
async function getRawAdminRole(): Promise<AdminRole> {
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

// EK's ask (2026-08-27), after an outside security researcher's earlier
// disclosure made clear real people are probing this app: admin access
// now requires the CURRENT session to have actually completed an MFA
// (2FA/TOTP) challenge, not just a valid password login. Having the
// account-level 2FA toggle at /account/security available was real but
// purely opt-in — nothing stopped an admin (including the owner account)
// from having it off entirely, or from a stolen/replayed session token
// getting full admin access without ever proving a second factor.
// `currentLevel === "aal2"` is Supabase Auth's own signal for "this
// session completed a real MFA challenge, not just a password" — same
// value the /account/security card itself reads. If nothing is enrolled
// at all, currentLevel stays "aal1" forever, so this correctly blocks
// until MFA is actually set up, not just until it's technically possible.
async function hasVerifiedMfaSession(): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return false;
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return data.currentLevel === "aal2";
}

export async function getMyAdminRole(): Promise<AdminRole> {
  const role = await getRawAdminRole();
  if (!role) return null;
  return (await hasVerifiedMfaSession()) ? role : null;
}

// For the admin shell's own "why don't I have access" message — lets it
// tell "you're not an admin at all" apart from "you're an admin, but this
// session hasn't completed 2FA yet" instead of one generic denial for both.
export async function getMyAdminAccessStatus(): Promise<{ role: AdminRole; mfaOk: boolean }> {
  const role = await getRawAdminRole();
  const mfaOk = await hasVerifiedMfaSession();
  return { role, mfaOk };
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

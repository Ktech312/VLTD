import { getSupabaseBrowserClient } from "./supabaseClient";

/** A member's chosen look, kept on their account so it follows them across devices. */
export type LookPrefs = {
  theme?: string;
  iconStyle?: string;
  logoVariant?: string;
};

type UserWithMeta = { user_metadata?: { vltd_look?: LookPrefs } };

/** Fire-and-forget: merges the given prefs into the signed-in member's saved look. */
export async function saveLookToAccount(prefs: LookPrefs): Promise<void> {
  try {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data } = await supabase.auth.getUser();
    const user = data?.user as UserWithMeta | null;
    if (!user) return;
    await supabase.auth.updateUser({ data: { vltd_look: { ...(user.user_metadata?.vltd_look ?? {}), ...prefs } } });
  } catch {
    // Look still works from this device if the account save fails.
  }
}

/** Returns the saved look for the signed-in member, or null (signed out / nothing saved). */
export async function loadLookFromAccount(): Promise<LookPrefs | null> {
  try {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getUser();
    const user = data?.user as UserWithMeta | null;
    return user?.user_metadata?.vltd_look ?? null;
  } catch {
    return null;
  }
}

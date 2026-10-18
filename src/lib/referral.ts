import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Not granted today: referral rewards are unavailable pending a separate product decision (see HANDOFF.md). Kept only as the admin perk form default. */
export const REFERRAL_BONUS_GALLERIES = 1;

/** Not granted today (see above). Unused. */
export const REFERRED_BONUS_GALLERIES = 1;

// ─── Code helpers ─────────────────────────────────────────────────────────────

function generateCode(userId: string): string {
  // Short readable code: first 5 chars of userId (hex) + 4 random chars
  const prefix = userId.replace(/-/g, "").slice(0, 5).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}${suffix}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get the current user's referral code, creating one if it doesn't exist yet.
 * Returns null if Supabase is unavailable.
 */
export async function getOrCreateReferralCode(userId: string): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  // Check for existing code
  const { data: existing } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing?.code) return existing.code;

  // Create a new unique code (retry up to 3 times on collision)
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode(userId);
    const { data, error } = await supabase
      .from("referral_codes")
      .insert({ user_id: userId, code })
      .select("code")
      .single();

    if (!error && data?.code) return data.code;
    // If error was a uniqueness collision, retry with a new code
    if (error?.code !== "23505") break;
  }

  return null;
}

/**
 * Redeem a referral code when a new user signs up.
 * The database function redeem_referral_code does the whole job for the signed-in caller (the code must exist, no
 * self-referral, one redemption per account) and answers with only ok or a plain message: no account id or code owner
 * ever reaches the browser, because signed-in accounts can read only their own referral code.
 * It records the redemption. It does NOT grant bonus galleries: that grant (increment_user_perk_galleries) is refused by
 * row-level security on user_perks for ordinary accounts, as it was before this function existed. Granting them, and
 * limiting how often one person can earn them, is a separate decision.
 */
export async function redeemReferralCode(code: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ok: false, error: "No Supabase connection" };

  const { data, error } = await supabase.rpc("redeem_referral_code", { p_code: code });
  if (error) return { ok: false, error: error.message };
  const answer = (data ?? {}) as { ok?: boolean; error?: string };
  return answer.ok === true ? { ok: true } : { ok: false, error: answer.error ?? "Could not redeem this code" };
}

/**
 * Total bonus galleries granted to a user (referral rewards + admin grants).
 */
export async function getUserBonusGalleries(userId: string): Promise<number> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return 0;

  const { data } = await supabase
    .from("user_perks")
    .select("bonus_galleries")
    .eq("user_id", userId)
    .maybeSingle();

  return typeof data?.bonus_galleries === "number" ? data.bonus_galleries : 0;
}

/**
 * How many people have redeemed this user's referral code. No reward is attached (referral rewards are not available).
 */
export async function getReferralStats(
  userId: string
): Promise<{ referralCount: number }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { referralCount: 0 };

  // Overnight QA pass (2026-09-22): same fix as follows.ts's getFollowerCount
  // - narrowed select("*") to select("id") for this HEAD+count query, since
  // that exact combination was reproducibly 503ing there.
  const { count } = await supabase
    .from("referral_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", userId);

  return { referralCount: count ?? 0 };
}

// ─── Admin API ────────────────────────────────────────────────────────────────

export type ReferralRow = {
  id: string;
  code: string;
  user_id: string;
  created_at: string;
  redemption_count: number;
};

export type PerkRow = {
  id: string;
  user_id: string;
  bonus_galleries: number;
  reason: string | null;
  granted_by: string | null;
  updated_at: string;
};

/** Admin: list all referral codes with redemption counts. */
export async function listAllReferralCodes(): Promise<ReferralRow[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const { data: codes } = await supabase
    .from("referral_codes")
    .select("id, code, user_id, created_at")
    .order("created_at", { ascending: false });

  if (!codes?.length) return [];

  // Get redemption counts for each code
  const { data: redemptions } = await supabase
    .from("referral_redemptions")
    .select("code");

  const countMap = new Map<string, number>();
  for (const r of redemptions ?? []) {
    countMap.set(r.code, (countMap.get(r.code) ?? 0) + 1);
  }

  return codes.map((c) => ({
    ...c,
    redemption_count: countMap.get(c.code) ?? 0,
  }));
}

/** Admin: list all user perks. */
export async function listAllUserPerks(): Promise<PerkRow[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("user_perks")
    .select("*")
    .order("updated_at", { ascending: false });

  return (data ?? []) as PerkRow[];
}

/** Admin: set or update the bonus_galleries for a user. */
export async function setUserPerk(
  userId: string,
  bonusGalleries: number,
  reason: string,
  grantedBy: string
): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return "No Supabase connection";

  const { error } = await supabase.from("user_perks").upsert(
    {
      user_id: userId,
      bonus_galleries: bonusGalleries,
      reason,
      granted_by: grantedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  return error?.message ?? null;
}

/** Admin: delete a referral code (and its redemptions). */
export async function deleteReferralCode(code: string): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return "No Supabase connection";

  await supabase.from("referral_redemptions").delete().eq("code", code);
  const { error } = await supabase.from("referral_codes").delete().eq("code", code);
  return error?.message ?? null;
}

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";

// ─── Constants ────────────────────────────────────────────────────────────────

/** How many bonus galleries a referrer earns per successful invite */
export const REFERRAL_BONUS_GALLERIES = 1;

/** How many bonus galleries the new user earns when they sign up via invite */
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
 * - Looks up the referrer from the code
 * - Records the redemption
 * - Grants bonus galleries to both parties via user_perks (upsert)
 */
export async function redeemReferralCode(
  code: string,
  referredUserId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { ok: false, error: "No Supabase connection" };

  const upperCode = code.trim().toUpperCase();

  // Look up the referrer
  const { data: codeRow, error: codeErr } = await supabase
    .from("referral_codes")
    .select("user_id")
    .eq("code", upperCode)
    .maybeSingle();

  if (codeErr || !codeRow) return { ok: false, error: "Invalid referral code" };
  if (codeRow.user_id === referredUserId) return { ok: false, error: "Cannot refer yourself" };

  const referrerId = codeRow.user_id;

  // Check if this user already redeemed a code
  const { data: already } = await supabase
    .from("referral_redemptions")
    .select("id")
    .eq("referred_id", referredUserId)
    .maybeSingle();

  if (already) return { ok: false, error: "Already redeemed a referral code" };

  // Record the redemption
  const { error: insertErr } = await supabase.from("referral_redemptions").insert({
    code: upperCode,
    referrer_id: referrerId,
    referred_id: referredUserId,
  });

  if (insertErr) return { ok: false, error: insertErr.message };

  // Grant bonus to referrer: upsert user_perks, incrementing by REFERRAL_BONUS_GALLERIES
  await supabase.rpc("increment_user_perk_galleries", {
    p_user_id: referrerId,
    p_amount: REFERRAL_BONUS_GALLERIES,
    p_reason: "referral",
    p_granted_by: "referral",
  });

  // Grant bonus to referred user
  await supabase.rpc("increment_user_perk_galleries", {
    p_user_id: referredUserId,
    p_amount: REFERRED_BONUS_GALLERIES,
    p_reason: "joined via referral",
    p_granted_by: "referral",
  });

  return { ok: true };
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
 * How many people this user has referred + total bonus galleries earned via referrals.
 */
export async function getReferralStats(
  userId: string
): Promise<{ referralCount: number; bonusEarned: number }> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { referralCount: 0, bonusEarned: 0 };

  const { count } = await supabase
    .from("referral_redemptions")
    .select("*", { count: "exact", head: true })
    .eq("referrer_id", userId);

  const referralCount = count ?? 0;
  return {
    referralCount,
    bonusEarned: referralCount * REFERRAL_BONUS_GALLERIES,
  };
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

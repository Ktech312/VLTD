// Access coupons — comp/beta tier grants redeemable by code.
// Admin creates codes; users redeem them via the redeem_access_coupon RPC.

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { Tier } from "@/lib/subscription";

export type AccessCoupon = {
  id: string;
  code: string;
  tier: Tier;
  duration_months: number; // 0 = lifetime
  max_redemptions: number | null;
  times_redeemed: number;
  note: string | null;
  active: boolean;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type RedeemResult =
  | { ok: true; tier: Tier; until: string | null }
  | { ok: false; error: string };

// Unambiguous alphabet (no 0/O/1/I) for human-friendly codes
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Generate a readable coupon code like "VLTD-7K4P-9QM2". */
export function generateCouponCode(prefix = "VLTD"): string {
  const rand = (n: number) =>
    Array.from({ length: n }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");
  return `${prefix}-${rand(4)}-${rand(4)}`;
}

export async function listCoupons(): Promise<AccessCoupon[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return [];
  const { data } = await sb
    .from("access_coupons")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as AccessCoupon[];
}

export async function createCoupon(input: {
  tier: Tier;
  durationMonths: number; // 0 = lifetime
  maxRedemptions: number | null;
  note?: string;
  createdBy?: string;
  expiresAt?: string | null;
}): Promise<{ coupon?: AccessCoupon; error?: string }> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { error: "Supabase is not configured." };

  // Retry a couple times in the (rare) event of a code collision
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = generateCouponCode();
    const { data, error } = await sb
      .from("access_coupons")
      .insert({
        code,
        tier: input.tier,
        duration_months: input.durationMonths,
        max_redemptions: input.maxRedemptions,
        note: input.note?.trim() || null,
        created_by: input.createdBy ?? null,
        expires_at: input.expiresAt ?? null,
      })
      .select("*")
      .single();

    if (!error && data) return { coupon: data as AccessCoupon };
    if (error && !/duplicate key|unique/i.test(error.message)) return { error: error.message };
  }
  return { error: "Could not generate a unique code — try again." };
}

export async function setCouponActive(id: string, active: boolean): Promise<string | null> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return "Supabase is not configured.";
  const { error } = await sb.from("access_coupons").update({ active }).eq("id", id);
  return error?.message ?? null;
}

/** Redeem a code for the signed-in user. Applies the tier to all their profiles. */
export async function redeemCoupon(code: string): Promise<RedeemResult> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return { ok: false, error: "Supabase is not configured." };
  const { data, error } = await sb.rpc("redeem_access_coupon", { p_code: code.trim() });
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false, error: "No response." }) as RedeemResult;
}

/** Human label for a duration in months (0 = lifetime). */
export function durationLabel(months: number): string {
  if (months === 0) return "Lifetime";
  if (months === 12) return "1 year";
  if (months === 24) return "2 years";
  if (months % 12 === 0) return `${months / 12} years`;
  return `${months} month${months === 1 ? "" : "s"}`;
}

"use client";

// Client helpers for the bulk AI-scan quota.
//
// Adding photos/drafts is always free; only an AI identify is metered.
// The database (20260723_bulk_scan_quota.sql) owns the real logic — cycle
// reset on the signup anniversary, per-tier limits, per-user overrides, and
// atomic spending. This file is a thin, typed wrapper around those RPCs plus
// the admin read/write helpers used by /admin/scan-limits.

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { Tier } from "@/lib/subscription";

export const SCAN_TIERS: Tier[] = ["FREE", "MID", "FULL"];

export type BulkScanStatus = {
  scanLimit: number;
  used: number;
  remaining: number;
  cycleStart: string | null;
  cycleEnd: string | null;
};

export type TierQuota = { tier: Tier; monthlyLimit: number };

// ── Runtime (used by the bulk flow + ticker) ────────────────────

/** Current quota status for a profile. Lazily resets a lapsed cycle. */
export async function getBulkScanStatus(profileId: string): Promise<BulkScanStatus | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("bulk_scan_status", { p_profile: profileId });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    scanLimit: row.scan_limit ?? 0,
    used: row.used ?? 0,
    remaining: row.remaining ?? 0,
    cycleStart: row.cycle_start ?? null,
    cycleEnd: row.cycle_end ?? null,
  };
}

// There is deliberately NO browser-side "spend a scan" any more. The AI scan routes reserve the scan on the server before the provider is called
// (lib/server/scanGuard.ts), so charging here as well would take two scans for one. The browser only reads the status above.

// ── Admin (used by /admin/scan-limits) ──────────────────────────

/** The per-tier monthly defaults, ordered FREE, MID, FULL. */
export async function getTierQuotas(): Promise<TierQuota[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from("bulk_scan_quotas").select("tier, monthly_limit");
  if (error || !data) return [];
  const byTier = new Map<string, number>();
  for (const r of data as { tier: string; monthly_limit: number }[]) {
    byTier.set(r.tier, r.monthly_limit);
  }
  return SCAN_TIERS.map((tier) => ({ tier, monthlyLimit: byTier.get(tier) ?? 0 }));
}

/** Set a tier's monthly default. Returns an error message or null on success. */
export async function setTierQuota(tier: Tier, monthlyLimit: number): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return "No Supabase connection";
  if (!Number.isFinite(monthlyLimit) || monthlyLimit < 0) return "Limit must be 0 or more";
  const { error } = await supabase
    .from("bulk_scan_quotas")
    .upsert({ tier, monthly_limit: Math.round(monthlyLimit), updated_at: new Date().toISOString() });
  return error?.message ?? null;
}

/**
 * Give one profile a custom limit, or pass null to clear it (fall back to the
 * tier default). Returns an error message or null on success.
 */
export async function setUserScanOverride(
  profileId: string,
  override: number | null
): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return "No Supabase connection";
  if (override !== null && (!Number.isFinite(override) || override < 0)) {
    return "Override must be 0 or more";
  }
  const { error } = await supabase
    .from("profiles")
    .update({ bulk_scan_limit_override: override === null ? null : Math.round(override) })
    .eq("id", profileId);
  return error?.message ?? null;
}

/** Effective limit for a profile given its tier + optional override. */
export function effectiveLimit(
  tier: string | null,
  override: number | null,
  tierQuotas: TierQuota[]
): number {
  if (override !== null && override !== undefined) return override;
  const t = (tier === "MID" || tier === "FULL" ? tier : "FREE") as Tier;
  return tierQuotas.find((q) => q.tier === t)?.monthlyLimit ?? 0;
}

import { createClient } from "@supabase/supabase-js";

/**
 * Shared server-side helper for the generic lookup-API guard
 * (supabase/migrations/20260811_lookup_api_guards.sql) -- the same
 * permanent-cache + daily-budget pattern built for PSA
 * (20260806_psa_api_guard.sql), generalized so every metered third-party
 * lookup route (upcitemdb, Discogs, Metron) can share one implementation
 * instead of three near-identical copies.
 *
 * `reserveDailyCall`/`markProviderExhausted` are only meaningful for a
 * provider with a real, confirmed hard DAILY cap (currently just
 * upcitemdb's 100/day) -- don't call them for a provider that's only
 * rate-limited per-minute (Discogs, Metron); those should rely on the
 * cache plus their own 429 handling instead of an invented daily quota.
 *
 * Fails OPEN (returns allowed:true / null cache) if Supabase env vars
 * aren't configured, same as the PSA route already does -- a missing
 * guard shouldn't be the reason a lookup that would otherwise work stops
 * working.
 */

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function getCachedLookup<T>(provider: string, cacheKey: string): Promise<T | null> {
  const supabase = getServiceClient();
  if (!supabase) return null;
  const { data } = await supabase.rpc("lookup_api_cache_get", { p_provider: provider, p_key: cacheKey });
  return (data as T | null) ?? null;
}

export async function putCachedLookup(provider: string, cacheKey: string, result: unknown): Promise<void> {
  const supabase = getServiceClient();
  if (!supabase) return;
  await supabase.rpc("lookup_api_cache_put", { p_provider: provider, p_key: cacheKey, p_result: result });
}

export type ReserveResult = { allowed: boolean; callsMade: number };

export async function reserveDailyCall(provider: string, safeCap: number): Promise<ReserveResult> {
  const supabase = getServiceClient();
  if (!supabase) return { allowed: true, callsMade: 0 };
  const { data } = await supabase.rpc("lookup_api_try_reserve", { p_provider: provider, p_safe_cap: safeCap });
  const row = Array.isArray(data) ? data[0] : data;
  return { allowed: row ? Boolean(row.allowed) : true, callsMade: row?.calls_made ?? 0 };
}

export async function markProviderExhausted(provider: string): Promise<void> {
  const supabase = getServiceClient();
  if (!supabase) return;
  await supabase.rpc("lookup_api_mark_exhausted", { p_provider: provider });
}

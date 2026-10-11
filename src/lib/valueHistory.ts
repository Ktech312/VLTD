// Path: src/lib/valueHistory.ts
// Daily portfolio value snapshots.
//
// Source of truth: Supabase (portfolio_value_history), scoped per profile so it
// survives device changes. localStorage is kept as an instant/offline cache.
// All Supabase calls are best-effort and wrapped — if the table isn't there yet
// (migration not applied) or the user is offline, the local cache still works.

import { mayAdoptLegacyKey } from "./legacyKeys";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { VaultItem } from "@/lib/vaultModel";
import type { UniverseKey } from "@/lib/taxonomy";
import { activeItems, summarizeValues, totalsValue } from "@/lib/vaultStats";

export type HistoryPoint = {
  day: string; // YYYY-MM-DD (UTC)
  t: number; // ms timestamp (UTC midnight-ish)
  totalValue: number;
  totalCost: number;
  byUniverseValue: Partial<Record<UniverseKey, number>>;
};

const LS_BASE = "vltd_value_history_v1";
const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

function clamp(n: number) {
  return Number.isFinite(n) ? n : 0;
}

function activeProfileId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "";
  } catch {
    return "";
  }
}

// Cache is keyed per profile so switching profiles never mixes histories.
function lsKey(): string {
  const pid = activeProfileId();
  return pid ? `${LS_BASE}:${pid}` : LS_BASE;
}

function dayKeyUTC(ms: number) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function nowDayKeyUTC() {
  return dayKeyUTC(Date.now());
}

export function readHistory(): HistoryPoint[] {
  if (typeof window === "undefined") return [];
  try {
    const key = lsKey();
    let raw = window.localStorage.getItem(key);
    // One-time adoption of any legacy (device-global) history into the
    // profile-scoped key, so existing users don't lose their local trend.
    if (!raw && key !== LS_BASE) {
      const legacy = window.localStorage.getItem(LS_BASE);
      if (legacy && mayAdoptLegacyKey(LS_BASE, key)) {
        window.localStorage.setItem(key, legacy);
        raw = legacy;
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HistoryPoint[];
  } catch {
    return [];
  }
}

export function writeHistory(points: HistoryPoint[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lsKey(), JSON.stringify(points));
  } catch {
    // ignore
  }
}

// Best-effort upsert of a single day's snapshot to Supabase.
async function pushSnapshot(p: HistoryPoint) {
  try {
    const pid = activeProfileId();
    if (!pid) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.from("portfolio_value_history").upsert(
      {
        profile_id: pid,
        day: p.day,
        total_value: p.totalValue,
        total_cost: p.totalCost,
        by_universe: p.byUniverseValue ?? {},
        updated_at: new Date(p.t || Date.now()).toISOString(),
      },
      { onConflict: "profile_id,day" }
    );
  } catch {
    // Table may not exist yet (migration pending) — local cache still holds it.
  }
}

export function takeDailySnapshotIfNeeded(items: VaultItem[]) {
  if (typeof window === "undefined") return;

  const today = nowDayKeyUTC();
  const history = readHistory();

  // If today's snapshot already exists, skip (already pushed when created).
  if (history.length > 0 && history[history.length - 1]?.day === today) return;

  // Same rule as every vault total (lib/vaultStats): owned items only, and an
  // un-priced item counts at what was paid. Points before 2026-10-11 used raw
  // current value (sold items included), so the line steps once at that date.
  const owned = activeItems(items);
  const summary = summarizeValues(owned, "fill");
  const totalCost = clamp(summary.totalCost);
  const totalValue = clamp(summary.totalValue);

  const byUniverseValue: Record<string, number> = {};
  for (const it of owned) {
    const u = (it.universe ?? "MISC") as UniverseKey;
    byUniverseValue[u] = (byUniverseValue[u] ?? 0) + clamp(totalsValue(it).amount);
  }

  const p: HistoryPoint = {
    day: today,
    t: Date.now(),
    totalValue,
    totalCost,
    byUniverseValue: byUniverseValue as Partial<Record<UniverseKey, number>>,
  };

  const next = [...history, p].slice(-370); // keep ~1 year
  writeHistory(next);
  void pushSnapshot(p);
}

// Pull durable history from Supabase for the active profile and merge into the
// local cache (server wins per day; local-only days are kept). Safe to call on
// mount — returns the local cache unchanged if anything goes wrong.
export async function syncValueHistoryFromSupabase(): Promise<HistoryPoint[]> {
  if (typeof window === "undefined") return [];
  const local = readHistory();
  try {
    const pid = activeProfileId();
    if (!pid) return local;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return local;

    const { data, error } = await supabase
      .from("portfolio_value_history")
      .select("day,total_value,total_cost,by_universe")
      .eq("profile_id", pid)
      .order("day", { ascending: true });

    if (error || !data) return local;

    // Server empty but we have local history → seed the server from local.
    if (data.length === 0) {
      for (const p of local) void pushSnapshot(p);
      return local;
    }

    const serverPoints: HistoryPoint[] = data.map((r: Record<string, unknown>) => {
      const day = String(r.day);
      return {
        day,
        t: Date.parse(day) || Date.now(),
        totalValue: Number(r.total_value ?? 0),
        totalCost: Number(r.total_cost ?? 0),
        byUniverseValue: (r.by_universe ?? {}) as Partial<Record<UniverseKey, number>>,
      };
    });

    const byDay = new Map<string, HistoryPoint>();
    for (const p of serverPoints) byDay.set(p.day, p);
    for (const p of local) if (!byDay.has(p.day)) byDay.set(p.day, p);

    const merged = Array.from(byDay.values())
      .sort((a, b) => a.day.localeCompare(b.day))
      .slice(-370);

    writeHistory(merged);
    return merged;
  } catch {
    return local;
  }
}

// Snapshots before this UTC day were saved under the old value rule (raw
// current value, sold items included, un-priced = $0). Comparing them with
// totals under the shared rule produced numbers like "-95.9% (30D)", so they
// are left out of every chart and % change. 2026-10-12 is the first full day
// after the rule shipped (a 2026-10-11 snapshot may predate the deploy).
const VALUE_RULE_START_DAY = "2026-10-12";

export function sliceHistory(points: HistoryPoint[], range: "7d" | "30d" | "90d" | "all") {
  const current = points.filter((p) => p.day >= VALUE_RULE_START_DAY);
  if (range === "all") return current;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return current.slice(-days);
}

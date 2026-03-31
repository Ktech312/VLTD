// Path: src/lib/valueHistory.ts
// NEW — daily snapshots for real historical charts (localStorage)

import type { VaultItem } from "@/lib/vaultModel";
import type { UniverseKey } from "@/lib/taxonomy";

export type HistoryPoint = {
  day: string; // YYYY-MM-DD (UTC)
  t: number; // ms timestamp (UTC midnight-ish)
  totalValue: number;
  totalCost: number;
  byUniverseValue: Partial<Record<UniverseKey, number>>;
};

const LS_HISTORY = "vltd_value_history_v1";

function clamp(n: number) {
  return Number.isFinite(n) ? n : 0;
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
    const raw = window.localStorage.getItem(LS_HISTORY);
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
    window.localStorage.setItem(LS_HISTORY, JSON.stringify(points));
  } catch {
    // ignore
  }
}

export function takeDailySnapshotIfNeeded(items: VaultItem[]) {
  if (typeof window === "undefined") return;

  const today = nowDayKeyUTC();
  const history = readHistory();

  // If today's snapshot already exists, skip
  if (history.length > 0 && history[history.length - 1]?.day === today) return;

  const totalCost = items.reduce((s, i) => s + clamp(Number(i.purchasePrice ?? 0)), 0);
  const totalValue = items.reduce((s, i) => s + clamp(Number(i.currentValue ?? 0)), 0);

  const byUniverseValue: Record<string, number> = {};
  for (const it of items) {
    const u = (it.universe ?? "MISC") as UniverseKey;
    byUniverseValue[u] = (byUniverseValue[u] ?? 0) + clamp(Number(it.currentValue ?? 0));
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
}

export function sliceHistory(points: HistoryPoint[], range: "7d" | "30d" | "90d" | "all") {
  if (range === "all") return points;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return points.slice(-days);
}
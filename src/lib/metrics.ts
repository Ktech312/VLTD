// src/lib/metrics.ts
import { type VaultItem } from "@/lib/vaultModel";

export function clamp(n: unknown, fallback = 0) {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export function cost(i: VaultItem) {
  return clamp(i.purchasePrice, 0);
}

export function value(i: VaultItem) {
  return clamp(i.currentValue, 0);
}

export function gain(i: VaultItem) {
  return value(i) - cost(i);
}

export function gainPct(i: VaultItem) {
  const c = cost(i);
  if (c <= 0) return 0;
  return (gain(i) / c) * 100;
}

export function fmtMoney(n: unknown, digits = 0) {
  const v = clamp(n, 0);
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: digits })}`;
}

export function fmtPct(n: unknown, digits = 1) {
  const v = clamp(n, 0);
  const sign = v > 0 ? "+" : v < 0 ? "" : "";
  return `${sign}${v.toFixed(digits)}%`;
}

export function fmtMonthYear(ms: number) {
  return new Date(ms).toLocaleString(undefined, { month: "short", year: "2-digit" });
}

export function fmtMonthDay(ms: number) {
  return new Date(ms).toLocaleString(undefined, { month: "short", day: "2-digit" });
}

export function createdAtMs(i: any): number {
  const v = i?.createdAt;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const parsed = Date.parse(v);
    if (Number.isFinite(parsed)) return parsed;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  if (typeof i?.id === "string") {
    const n = Number(i.id);
    if (Number.isFinite(n) && n > 1_000_000_000) return n;
  }
  return Date.now();
}
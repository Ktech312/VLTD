"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getMyAdminRole, type AdminRole } from "@/lib/adminAuth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { timeAgo, exactDateTime, formatDuration, averageSessionLength, isOnline } from "@/lib/presence";
import { getStoredActiveProfileId } from "@/lib/auth";
import { setTierSafe, type Tier } from "@/lib/subscription";
import OnlineDot from "@/components/OnlineDot";
import { SEED_CHARACTERS } from "@/lib/seedCharacters";
import { SEED_CHARACTERS_PART2 } from "@/lib/seedCharacters_part2";
import { SEED_CHARACTERS_PART3 } from "@/lib/seedCharacters_part3";
import { SEED_CHARACTERS_PART4 } from "@/lib/seedCharacters_part4";

// Seed characters are backed by real `profiles` rows (fixed 00000000-...
// UUIDs, see seedCharacters.ts) so they show up in this list right
// alongside real users. Same split-and-collapse pattern as the
// Account Rights panel in admin/characters/page.tsx — reusing its seed
// list rather than duplicating it.
const SEED_PROFILE_IDS = new Set(
  [...SEED_CHARACTERS, ...SEED_CHARACTERS_PART2, ...SEED_CHARACTERS_PART3, ...SEED_CHARACTERS_PART4].map(
    (c) => c.profileId
  )
);

type SortKey =
  | "account"
  | "joined"
  | "lastActive"
  | "sessions"
  | "totalTime"
  | "avgSession"
  | "aiCalls"
  | "aiTokens"
  | "museumBeta";
type SortDir = "asc" | "desc";

type UserRow = {
  id: string;
  displayName: string | null;
  username: string | null;
  email: string | null;
  createdAt: string | null;
  lastSeenAt: string | null;
  totalSecondsOnline: number;
  sessionCount: number;
  aiCalls: number;
  aiInputTokens: number;
  aiOutputTokens: number;
  museumBetaEnabled: boolean;
  museumBetaRequestedAt: string | null;
  profileType: string;
  tier: Tier;
  tierExpiresAt: string | null;
  tierSource: string | null;
};

const RIGHTS_TIERS: Tier[] = ["FREE", "MID", "FULL"];
const TIER_STYLE: Record<Tier, { bg: string; border: string; fg: string }> = {
  FREE: { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.18)", fg: "var(--muted)" },
  MID: { bg: "rgba(96,165,250,0.14)", border: "rgba(96,165,250,0.45)", fg: "#93c5fd" },
  FULL: { bg: "rgba(203,208,213,0.16)", border: "rgba(203,208,213,0.55)", fg: "#C8CDD2" },
};

function formatJoined(value: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

async function authHeader(): Promise<Record<string, string>> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminUsersPage() {
  const [role, setRole] = useState<AdminRole | "loading">("loading");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [status, setStatus] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showSeed, setShowSeed] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("lastActive");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [query, setQuery] = useState("");
  const [savingTierId, setSavingTierId] = useState("");

  const loadRows = useCallback(async () => {
    setStatus("Loading…");
    try {
      const res = await fetch("/api/admin/users", { headers: await authHeader() });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.message || "Failed to load users.");
        return;
      }
      setRows(data.rows ?? []);
      setStatus("");
    } catch {
      setStatus("Couldn't load users. Try again.");
    }
  }, []);

  async function toggleMuseumBeta(row: UserRow) {
    setTogglingId(row.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ profileId: row.id, museumBetaEnabled: !row.museumBetaEnabled }),
      });
      if (res.ok) {
        setRows((current) =>
          current.map((r) => (r.id === row.id ? { ...r, museumBetaEnabled: !r.museumBetaEnabled } : r))
        );
      }
    } finally {
      setTogglingId(null);
    }
  }

  // Moved over from Account Rights (admin/characters/page.tsx) at EK's
  // request, 2026-08-24 -- same "lifetime, sourced as admin" semantics as
  // that panel's applyTier, just going through this route's verified
  // service-role PATCH instead of a direct client-side RLS-trusting update.
  async function applyTier(row: UserRow, tier: Tier) {
    setSavingTierId(row.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ profileId: row.id, tier }),
      });
      if (res.ok) {
        setRows((current) =>
          current.map((r) => (r.id === row.id ? { ...r, tier, tierExpiresAt: null, tierSource: "admin" } : r)),
        );
        if (getStoredActiveProfileId() === row.id) setTierSafe(tier);
      }
    } finally {
      setSavingTierId("");
    }
  }

  useEffect(() => {
    void (async () => {
      const myRole = await getMyAdminRole();
      setRole(myRole);
      if (myRole) await loadRows();
    })();
  }, [loadRows]);

  function toggleSort(key: SortKey) {
    setSortDir((current) => (sortKey === key ? (current === "asc" ? "desc" : "asc") : "asc"));
    setSortKey(key);
  }

  function compareRows(a: UserRow, b: UserRow, key: SortKey): number {
    switch (key) {
      case "account":
        return (a.displayName || a.username || "").localeCompare(b.displayName || b.username || "");
      case "joined":
        return (a.createdAt ? Date.parse(a.createdAt) : 0) - (b.createdAt ? Date.parse(b.createdAt) : 0);
      case "lastActive": {
        // Online now always sorts above offline, regardless of exact
        // timestamps; within the same online status, most-recent first.
        const aOnline = isOnline(a.lastSeenAt) ? 1 : 0;
        const bOnline = isOnline(b.lastSeenAt) ? 1 : 0;
        if (aOnline !== bOnline) return aOnline - bOnline;
        return (a.lastSeenAt ? Date.parse(a.lastSeenAt) : 0) - (b.lastSeenAt ? Date.parse(b.lastSeenAt) : 0);
      }
      case "sessions":
        return a.sessionCount - b.sessionCount;
      case "totalTime":
        return a.totalSecondsOnline - b.totalSecondsOnline;
      case "avgSession":
        return (
          (a.sessionCount ? a.totalSecondsOnline / a.sessionCount : 0) -
          (b.sessionCount ? b.totalSecondsOnline / b.sessionCount : 0)
        );
      case "aiCalls":
        return a.aiCalls - b.aiCalls;
      case "aiTokens":
        return a.aiInputTokens + a.aiOutputTokens - (b.aiInputTokens + b.aiOutputTokens);
      case "museumBeta":
        return Number(a.museumBetaEnabled) - Number(b.museumBetaEnabled);
    }
  }

  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => compareRows(a, b, sortKey));
    if (sortDir === "desc") sorted.reverse();
    return sorted;
  }, [rows, sortKey, sortDir]);

  const queriedRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedRows;
    return sortedRows.filter(
      (r) =>
        r.displayName?.toLowerCase().includes(q) ||
        r.username?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q),
    );
  }, [sortedRows, query]);

  const realRows = useMemo(() => queriedRows.filter((r) => !SEED_PROFILE_IDS.has(r.id)), [queriedRows]);
  const seedRows = useMemo(() => queriedRows.filter((r) => SEED_PROFILE_IDS.has(r.id)), [queriedRows]);

  function SortHeader({ k, label, center = true }: { k: SortKey; label: string; center?: boolean }) {
    const active = sortKey === k;
    return (
      <th className={`px-3 py-2 font-semibold ${center ? "text-center" : ""}`}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={[
            "inline-flex items-center gap-1 transition hover:text-text-primary",
            active ? "text-text-primary" : "",
          ].join(" ")}
        >
          {label}
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={[
              "shrink-0 transition-transform",
              active ? "opacity-100" : "opacity-30",
              active && sortDir === "asc" ? "rotate-180" : "",
            ].join(" ")}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </th>
    );
  }

  if (role === "loading") {
    return (
      <main className="px-4 py-10 text-[color:var(--fg)]">
        <div className="mx-auto max-w-3xl text-[color:var(--muted)]">Checking access…</div>
      </main>
    );
  }

  if (!role) {
    return (
      <main className="px-4 py-10 text-[color:var(--fg)]">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[color:var(--border)] bg-vault-card p-6 text-[color:var(--muted)]">
          You don&apos;t have access to this page.
        </div>
      </main>
    );
  }

  const totalAiCalls = rows.reduce((sum, r) => sum + r.aiCalls, 0);
  const totalTokens = rows.reduce((sum, r) => sum + r.aiInputTokens + r.aiOutputTokens, 0);

  function renderRow(r: UserRow) {
    return (
      <tr key={r.id} className="border-b border-[color:var(--border)] last:border-0">
        <td className="whitespace-nowrap px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <OnlineDot lastSeenAt={r.lastSeenAt} size={7} />
            <span className="font-medium text-text-primary">{r.displayName || r.username || "Unnamed"}</span>
          </div>
          <div className="whitespace-nowrap font-mono text-[10.5px] text-[color:var(--muted)]" title={r.id}>
            {r.username ? `@${r.username}` : "—"} · {r.id.slice(0, 8)}
          </div>
        </td>
        <td className="px-3 py-1.5 text-center text-[color:var(--muted)]">{formatJoined(r.createdAt)}</td>
        <td className="px-3 py-1.5 text-center text-[color:var(--muted)]" title={exactDateTime(r.lastSeenAt)}>
          {timeAgo(r.lastSeenAt)}
        </td>
        <td className="px-3 py-1.5 text-center text-[color:var(--muted)]">{r.sessionCount}</td>
        <td className="px-3 py-1.5 text-center text-[color:var(--muted)]">{formatDuration(r.totalSecondsOnline)}</td>
        <td className="px-3 py-1.5 text-center text-[color:var(--muted)]">
          {averageSessionLength(r.totalSecondsOnline, r.sessionCount)}
        </td>
        <td className="px-3 py-1.5 text-center text-[color:var(--muted)]">{r.aiCalls}</td>
        <td className="px-3 py-1.5 text-center text-[color:var(--muted)]">
          {(r.aiInputTokens + r.aiOutputTokens).toLocaleString()}
        </td>
        <td className="px-3 py-1.5 text-center">
          <button
            type="button"
            onClick={() => void toggleMuseumBeta(r)}
            disabled={togglingId === r.id}
            className={[
              "inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold transition disabled:opacity-50",
              r.museumBetaEnabled
                ? "bg-[#4FD3EE] text-[#06171d]"
                : "border border-[color:var(--border)] bg-[color:var(--pill)] text-[color:var(--muted)]",
            ].join(" ")}
            title={
              r.museumBetaRequestedAt
                ? `Requested ${formatJoined(r.museumBetaRequestedAt)}`
                : "Not requested"
            }
          >
            {r.museumBetaEnabled ? "Enabled" : r.museumBetaRequestedAt ? "Requested" : "Off"}
          </button>
        </td>
        <td className="px-3 py-1.5 text-center">
          <span className="rounded-full bg-[color:var(--pill)] px-2 py-0.5 text-[10px] text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
            {r.profileType}
          </span>
        </td>
        <td className="max-w-[180px] truncate px-3 py-1.5 text-center text-[color:var(--muted)]" title={r.email || undefined}>
          {r.email || "—"}
        </td>
        <td className="px-3 py-1.5 text-center">
          <select
            value={r.tier}
            disabled={savingTierId === r.id}
            onChange={(e) => void applyTier(r, e.target.value as Tier)}
            className="w-[68px] rounded-md border px-1 py-0.5 text-[11px] font-bold disabled:opacity-50"
            style={{
              background: TIER_STYLE[r.tier].bg,
              borderColor: TIER_STYLE[r.tier].border,
              color: TIER_STYLE[r.tier].fg,
            }}
          >
            {RIGHTS_TIERS.map((tier) => (
              <option key={tier} value={tier} style={{ background: "var(--surface)", color: "var(--fg)" }}>
                {tier}
              </option>
            ))}
          </select>
          {r.tier !== "FREE" && (
            <div className="mt-0.5 text-[10px] text-[color:var(--muted)]">
              {r.tierExpiresAt ? `Expires ${formatJoined(r.tierExpiresAt)}` : "Lifetime"}
              {r.tierSource ? ` · via ${r.tierSource}` : ""}
            </div>
          )}
        </td>
      </tr>
    );
  }

  return (
    <main className="px-4 py-8 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-[-0.03em]">Users</h1>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              {rows.length} account{rows.length === 1 ? "" : "s"} · {totalAiCalls} AI calls ·{" "}
              {totalTokens.toLocaleString()} tokens total
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, username, or ID…"
              className="h-10 w-64 rounded-full border border-[color:var(--border)] bg-[color:var(--pill)] px-4 text-sm outline-none placeholder:text-[color:var(--muted)]"
            />
            <button
              type="button"
              onClick={() => void loadRows()}
              className="h-10 shrink-0 rounded-full border border-[color:var(--border)] bg-[color:var(--pill)] px-4 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
            >
              Refresh
            </button>
          </div>
        </div>

        {status && (
          <div className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3 text-sm text-[color:var(--muted)]">
            {status}
          </div>
        )}

        <div className="mt-6 overflow-x-auto rounded-2xl border border-[color:var(--border)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] text-[color:var(--muted2)]">
                <SortHeader k="account" label="Account" center={false} />
                <SortHeader k="joined" label="Joined" />
                <SortHeader k="lastActive" label="Last active" />
                <SortHeader k="sessions" label="Sessions" />
                <SortHeader k="totalTime" label="Total time" />
                <SortHeader k="avgSession" label="Avg session" />
                <SortHeader k="aiCalls" label="AI calls" />
                <SortHeader k="aiTokens" label="AI tokens" />
                <SortHeader k="museumBeta" label="3D Museum beta" />
                <th className="px-3 py-2 text-center font-semibold">Type</th>
                <th className="px-3 py-2 text-center font-semibold">Email</th>
                <th className="px-3 py-2 text-center font-semibold">Tier</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-[color:var(--muted)]">No accounts yet.</td>
                </tr>
              ) : (
                <>
                  {realRows.map(renderRow)}
                  {realRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-6 text-center text-[color:var(--muted)]">No accounts match.</td>
                    </tr>
                  ) : null}
                </>
              )}
            </tbody>
          </table>
        </div>

        {seedRows.length > 0 ? (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowSeed((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2.5 text-left transition hover:bg-[rgba(255,255,255,0.03)]"
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted)]">
                Seed / test accounts ({seedRows.length})
              </span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-[color:var(--muted)] transition-transform ${showSeed ? "rotate-180" : ""}`}
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showSeed ? (
              <div className="mt-2 overflow-x-auto rounded-2xl border border-[color:var(--border)]">
                <table className="w-full text-left text-sm">
                  <tbody>{seedRows.map(renderRow)}</tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { getMyAdminRole, type AdminRole } from "@/lib/adminAuth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import {
  getTierQuotas,
  setTierQuota,
  setUserScanOverride,
  effectiveLimit,
  SCAN_TIERS,
  type TierQuota,
} from "@/lib/bulkScanQuota";
import type { Tier } from "@/lib/subscription";

type ScanProfileRow = {
  id: string;
  username: string;
  display_name: string;
  tier: string | null;
  bulk_scan_limit_override: number | null;
  bulk_scans_used: number | null;
};

const TIER_COLORS: Record<Tier, { bg: string; border: string; fg: string }> = {
  FREE: { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.18)", fg: "rgba(255,255,255,0.7)" },
  MID: { bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.4)", fg: "#93c5fd" },
  FULL: { bg: "rgba(203,208,213,0.14)", border: "rgba(203,208,213,0.5)", fg: "#C8CDD2" },
};

export default function AdminScanLimitsPage() {
  const [role, setRole] = useState<AdminRole | "loading">("loading");
  const [quotas, setQuotas] = useState<TierQuota[]>([]);
  const [drafts, setDrafts] = useState<Record<Tier, string>>({ FREE: "", MID: "", FULL: "" });
  const [profiles, setProfiles] = useState<ScanProfileRow[]>([]);
  const [overrideDrafts, setOverrideDrafts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [savingTier, setSavingTier] = useState<Tier | "">("");
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    void (async () => {
      const myRole = await getMyAdminRole();
      setRole(myRole);
      if (myRole) {
        await loadQuotas();
        await loadProfiles();
      }
    })();
  }, []);

  async function loadQuotas() {
    const rows = await getTierQuotas();
    setQuotas(rows);
    setDrafts({
      FREE: String(rows.find((r) => r.tier === "FREE")?.monthlyLimit ?? 0),
      MID: String(rows.find((r) => r.tier === "MID")?.monthlyLimit ?? 0),
      FULL: String(rows.find((r) => r.tier === "FULL")?.monthlyLimit ?? 0),
    });
  }

  async function loadProfiles() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, tier, bulk_scan_limit_override, bulk_scans_used")
      .order("created_at", { ascending: true });
    if (error) {
      setStatus(`Failed to load profiles: ${error.message}`);
      return;
    }
    setProfiles((data ?? []) as ScanProfileRow[]);
    setStatus("");
  }

  async function saveTier(tier: Tier) {
    const value = Number(drafts[tier]);
    setSavingTier(tier);
    try {
      const err = await setTierQuota(tier, value);
      if (err) {
        setStatus(`Couldn't save ${tier}: ${err}`);
        return;
      }
      await loadQuotas();
      setStatus(`${tier} limit set to ${Math.round(value)} scans / month.`);
    } finally {
      setSavingTier("");
    }
  }

  async function saveOverride(profile: ScanProfileRow, clear: boolean) {
    const raw = overrideDrafts[profile.id];
    const value = clear ? null : Number(raw);
    if (!clear && (raw === undefined || raw.trim() === "" || Number.isNaN(value))) {
      setStatus("Enter a number first, or use Clear.");
      return;
    }
    setSavingId(profile.id);
    try {
      const err = await setUserScanOverride(profile.id, value);
      if (err) {
        setStatus(`Couldn't update ${profile.display_name || profile.username}: ${err}`);
        return;
      }
      setProfiles((prev) =>
        prev.map((p) => (p.id === profile.id ? { ...p, bulk_scan_limit_override: value } : p))
      );
      setOverrideDrafts((prev) => ({ ...prev, [profile.id]: value === null ? "" : String(value) }));
      setStatus(
        value === null
          ? `${profile.display_name || profile.username} → back to tier default.`
          : `${profile.display_name || profile.username} → custom limit ${value}.`
      );
    } finally {
      setSavingId("");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Default to only showing profiles that already have an override, so the
    // list is short; searching reveals everyone.
    if (!q) return profiles.filter((p) => p.bulk_scan_limit_override !== null);
    return profiles.filter(
      (p) =>
        p.username?.toLowerCase().includes(q) ||
        p.display_name?.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    );
  }, [profiles, query]);

  if (role === "loading") {
    return (
      <main className="min-h-dvh bg-[color:var(--bg)] p-6 text-[color:var(--fg)]">
        <div className="text-sm text-[color:var(--muted)]">Checking access…</div>
      </main>
    );
  }

  if (!role) {
    return (
      <main className="min-h-dvh bg-[color:var(--bg)] p-6 text-[color:var(--fg)]">
        <h1 className="text-lg font-semibold">Admin — Scan Limits</h1>
        <div className="mt-3 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-200 ring-1 ring-red-500/20">
          You need admin access to view this page. Sign in with an admin account.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[color:var(--bg)] px-4 py-6 text-[color:var(--fg)]">
      <div className="mx-auto w-full max-w-3xl">
        <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">Admin Tools</div>
        <h1 className="mt-1 text-xl font-semibold">AI Scan Limits</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          How many items the AI may identify per month, per plan. Adding photos and typing details
          by hand is always free — only AI identify counts. Each person&apos;s count resets on their own
          signup anniversary day.
        </p>

        {/* Per-tier defaults */}
        <div className="mt-5 rounded-2xl bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)]">
          <div className="text-sm font-semibold">Monthly limit by plan</div>
          <div className="mt-3 grid gap-2">
            {SCAN_TIERS.map((tier) => {
              const colors = TIER_COLORS[tier];
              const current = quotas.find((q) => q.tier === tier)?.monthlyLimit ?? 0;
              return (
                <div key={tier} className="flex items-center gap-3">
                  <span
                    className="w-16 shrink-0 rounded-full px-3 py-1.5 text-center text-xs font-bold"
                    style={{ background: colors.bg, border: `1px solid ${colors.border}`, color: colors.fg }}
                  >
                    {tier}
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={drafts[tier]}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [tier]: e.target.value }))}
                    className="h-10 w-28 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                  />
                  <span className="text-xs text-[color:var(--muted2)]">scans / month</span>
                  <button
                    type="button"
                    disabled={savingTier === tier || String(current) === drafts[tier].trim()}
                    onClick={() => void saveTier(tier)}
                    className="ml-auto h-10 shrink-0 rounded-xl px-4 text-sm font-semibold ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)] disabled:opacity-40"
                  >
                    {savingTier === tier ? "Saving…" : "Save"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Per-user overrides */}
        <div className="mt-5">
          <div className="text-sm font-semibold">Custom limit for one person</div>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Optional. Give a specific account its own number (e.g. a VIP tester). Leave blank to use
            their plan&apos;s default. Search to find anyone; the list starts with only accounts that
            already have a custom limit.
          </p>

          <div className="mt-3 flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search username, display name, or ID…"
              className="h-10 w-full rounded-xl bg-[color:var(--pill)] px-4 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void loadProfiles()}
              className="h-10 shrink-0 rounded-xl px-4 text-sm font-semibold ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
            >
              Refresh
            </button>
          </div>

          <div className="mt-3 grid gap-2">
            {filtered.length === 0 ? (
              <div className="rounded-xl bg-[color:var(--pill)] px-4 py-3 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                {query.trim() ? "No profiles found." : "No custom limits set. Search to add one."}
              </div>
            ) : (
              filtered.map((profile) => {
                const tier = (profile.tier === "MID" || profile.tier === "FULL"
                  ? profile.tier
                  : "FREE") as Tier;
                const eff = effectiveLimit(profile.tier, profile.bulk_scan_limit_override, quotas);
                const used = profile.bulk_scans_used ?? 0;
                const draft = overrideDrafts[profile.id] ?? (profile.bulk_scan_limit_override?.toString() ?? "");
                return (
                  <div
                    key={profile.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl bg-[color:var(--surface)] px-4 py-3 ring-1 ring-[color:var(--border)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">
                          {profile.display_name || profile.username}
                        </span>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{
                            background: TIER_COLORS[tier].bg,
                            border: `1px solid ${TIER_COLORS[tier].border}`,
                            color: TIER_COLORS[tier].fg,
                          }}
                        >
                          {tier}
                        </span>
                        {profile.bulk_scan_limit_override !== null ? (
                          <span className="shrink-0 rounded-full bg-[color:var(--pill)] px-2 py-0.5 text-[10px] text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                            custom
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-[color:var(--muted2)]">
                        @{profile.username} · used {used} of {eff} this cycle
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        value={draft}
                        placeholder="default"
                        onChange={(e) =>
                          setOverrideDrafts((prev) => ({ ...prev, [profile.id]: e.target.value }))
                        }
                        className="h-9 w-24 rounded-xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={savingId === profile.id}
                        onClick={() => void saveOverride(profile, false)}
                        className="h-9 shrink-0 rounded-xl px-3 text-xs font-semibold ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)] disabled:opacity-40"
                      >
                        Set
                      </button>
                      <button
                        type="button"
                        disabled={savingId === profile.id || profile.bulk_scan_limit_override === null}
                        onClick={() => void saveOverride(profile, true)}
                        className="h-9 shrink-0 rounded-xl px-3 text-xs font-semibold text-[color:var(--muted)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)] disabled:opacity-30"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {status ? (
          <div className="mt-4 rounded-xl bg-[color:var(--pill)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)]">
            {status}
          </div>
        ) : null}
      </div>
    </main>
  );
}

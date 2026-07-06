"use client";

import { useEffect, useMemo, useState } from "react";
import { getMyAdminRole, type AdminRole } from "@/lib/adminAuth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getStoredActiveProfileId } from "@/lib/auth";
import { setTierSafe, type Tier } from "@/lib/subscription";

type TierProfileRow = {
  id: string;
  user_id: string | null;
  username: string;
  display_name: string;
  profile_type: string | null;
  tier: string | null;
  created_at: string | null;
};

const TIERS: Tier[] = ["FREE", "MID", "FULL"];

const TIER_COLORS: Record<Tier, { bg: string; border: string; fg: string }> = {
  FREE: { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.18)", fg: "rgba(255,255,255,0.7)" },
  MID: { bg: "rgba(96,165,250,0.12)", border: "rgba(96,165,250,0.4)", fg: "#93c5fd" },
  FULL: { bg: "rgba(245,181,72,0.14)", border: "rgba(245,181,72,0.5)", fg: "#F5B548" },
};

export default function AdminTiersPage() {
  const [role, setRole] = useState<AdminRole | "loading">("loading");
  const [profiles, setProfiles] = useState<TierProfileRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    void (async () => {
      const myRole = await getMyAdminRole();
      setRole(myRole);
      if (myRole) await loadProfiles();
    })();
  }, []);

  async function loadProfiles() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setStatus("Supabase is not configured.");
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, username, display_name, profile_type, tier, created_at")
      .order("created_at", { ascending: true });
    if (error) {
      setStatus(`Failed to load profiles: ${error.message}`);
      return;
    }
    setProfiles((data ?? []) as TierProfileRow[]);
    setStatus("");
  }

  async function setProfileTier(profile: TierProfileRow, tier: Tier) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setSavingId(profile.id);
    try {
      const { error } = await supabase.from("profiles").update({ tier }).eq("id", profile.id);
      if (error) {
        setStatus(`Failed to set tier: ${error.message}`);
        return;
      }
      setProfiles((prev) => prev.map((p) => (p.id === profile.id ? { ...p, tier } : p)));
      setStatus(`${profile.display_name || profile.username} → ${tier}`);

      // If this is the profile active on THIS device, apply immediately —
      // no reload needed while testing.
      if (getStoredActiveProfileId() === profile.id) {
        setTierSafe(tier);
      }
    } finally {
      setSavingId("");
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        p.username?.toLowerCase().includes(q) ||
        p.display_name?.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.user_id ?? "").toLowerCase().includes(q)
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
        <h1 className="text-lg font-semibold">Admin — Tiers</h1>
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
        <h1 className="mt-1 text-xl font-semibold">Account Tiers</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Set any profile&apos;s plan from the backend. The change syncs to the user&apos;s device the next
          time the app loads (instantly if it&apos;s the profile active on this device).
        </p>

        <div className="mt-4 flex items-center gap-2">
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

        {status ? (
          <div className="mt-3 rounded-xl bg-[color:var(--pill)] px-4 py-2 text-sm ring-1 ring-[color:var(--border)]">
            {status}
          </div>
        ) : null}

        <div className="mt-4 grid gap-2">
          {filtered.length === 0 ? (
            <div className="rounded-xl bg-[color:var(--pill)] px-4 py-3 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
              No profiles found.
            </div>
          ) : (
            filtered.map((profile) => {
              const currentTier: Tier =
                profile.tier === "MID" || profile.tier === "FULL" ? profile.tier : "FREE";
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
                      <span className="shrink-0 rounded-full bg-[color:var(--pill)] px-2 py-0.5 text-[10px] text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                        {profile.profile_type ?? "personal"}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-[color:var(--muted2)]">
                      @{profile.username} · {profile.id}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {TIERS.map((tier) => {
                      const active = currentTier === tier;
                      const colors = TIER_COLORS[tier];
                      return (
                        <button
                          key={tier}
                          type="button"
                          disabled={savingId === profile.id}
                          onClick={() => void setProfileTier(profile, tier)}
                          className="rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-50"
                          style={
                            active
                              ? { background: colors.bg, border: `1px solid ${colors.border}`, color: colors.fg }
                              : {
                                  background: "transparent",
                                  border: "1px solid var(--border)",
                                  color: "var(--muted)",
                                }
                          }
                        >
                          {tier}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}

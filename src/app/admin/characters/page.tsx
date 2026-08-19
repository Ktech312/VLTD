"use client";

// ─────────────────────────────────────────────────────────────
// /admin/characters — Seed Character Admin
// ─────────────────────────────────────────────────────────────

import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { setTierSafe, type Tier } from "@/lib/subscription";
import { getStoredActiveProfileId } from "@/lib/auth";
import {
  listCoupons,
  createCoupon,
  setCouponActive,
  durationLabel,
  type AccessCoupon,
} from "@/lib/accessCoupons";
import { VAULT_IMAGES_BUCKET } from "@/lib/vaultCloud";
import { SEED_CHARACTERS } from "@/lib/seedCharacters";
import { SEED_CHARACTERS_PART2 } from "@/lib/seedCharacters_part2";
import { SEED_CHARACTERS_PART3 } from "@/lib/seedCharacters_part3";
import { SEED_CHARACTERS_PART4 } from "@/lib/seedCharacters_part4";
import type { SeedCharacter, SeedItem, SeedGallery } from "@/lib/seedCharacters";
import { getSeedAvatarUrl } from "@/lib/seedAvatar";
import OnlineDot from "@/components/OnlineDot";
import { isOnline, sessionLength, exactDateTime, averageSessionLength, formatDuration } from "@/lib/presence";
import { useSaveFeedback } from "@/lib/useSaveFeedback";
import {
  getMyAdminRole,
  listAdmins,
  grantAdmin,
  revokeAdmin,
  signInWithEmail,
  signOut,
  type AdminRole,
  type AdminEntry,
} from "@/lib/adminAuth";

const ALL_CHARACTERS: SeedCharacter[] = [
  ...SEED_CHARACTERS,
  ...SEED_CHARACTERS_PART2,
  ...SEED_CHARACTERS_PART3,
  ...SEED_CHARACTERS_PART4,
];

// Seed characters are backed by real `profiles` rows (fixed 00000000-...
// UUIDs, see seedCharacters.ts) so they show up in the Account Rights list
// alongside real users. This set lets that list tell them apart.
const SEED_PROFILE_IDS = new Set(ALL_CHARACTERS.map((c) => c.profileId));

// ── Live item data from Supabase ───────────────────────────────
// dbId = actual Supabase UUID (seed TS files use string IDs that don't match DB UUIDs)
type LiveItem = { imageUrl: string; disabled: boolean; dbId: string };

// Key live data by normalized title so seed string IDs and DB UUIDs both resolve correctly
function titleKey(t: string) { return t.toLowerCase().trim(); }

// ── Formatters ──────────────────────────────────────────────
function formatMoney(n?: number) {
  if (!n) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// ── Auth Gate ───────────────────────────────────────────────
// ── Admin Login Gate ─────────────────────────────────────────
function seedAvatarUrl(char: SeedCharacter) {
  return getSeedAvatarUrl(char.handle);
}

function SeedAvatar({ char, size = 32 }: { char: SeedCharacter; size?: number }) {
  const src = seedAvatarUrl(char);
  if (!src) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-white/5 ring-1 ring-amber-400/25"
        style={{ width: size, height: size, fontSize: Math.max(12, Math.floor(size * 0.5)) }}
      >
        {char.avatarEmoji}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="shrink-0 rounded-full object-cover ring-1 ring-amber-400/25"
      style={{ width: size, height: size }}
    />
  );
}

function AdminLoginGate({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    const err = await signInWithEmail(email.trim(), password);
    if (err) {
      setError(err);
      setLoading(false);
    } else {
      onSignedIn();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0c12]">
      <div className="w-full max-w-sm rounded-[24px] bg-[#111318] p-8 ring-1 ring-white/10">
        <div className="text-center">
          <div className="text-2xl">🔐</div>
          <div className="mt-2 text-sm font-semibold text-white">Admin Login</div>
          <div className="mt-1 text-xs text-white/40">Sign in with your VLTD account</div>
        </div>
        <div className="mt-6 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Email"
            className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/40 placeholder:text-white/30"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Password"
            className="w-full rounded-xl bg-white/5 px-4 py-2.5 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/40 placeholder:text-white/30"
          />
        </div>
        {error && <div className="mt-2 text-center text-xs text-red-400">{error}</div>}
        <button
          onClick={handleSubmit}
          disabled={loading || !email || !password}
          className="mt-4 w-full rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </div>
  );
}

// ── Not Authorized Screen ────────────────────────────────────
function NotAuthorized({ userEmail }: { userEmail: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0c12]">
      <div className="w-full max-w-sm rounded-[24px] bg-[#111318] p-8 ring-1 ring-white/10 text-center">
        <div className="text-2xl">🚫</div>
        <div className="mt-2 text-sm font-semibold text-white">Not Authorized</div>
        <div className="mt-1 text-xs text-white/40">{userEmail} does not have admin access.</div>
        <button
          onClick={() => signOut().then(() => window.location.reload())}
          className="mt-6 w-full rounded-xl bg-white/10 py-2.5 text-sm text-white/60 transition hover:bg-white/20"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

// ── Account Rights Panel — per-account tier control ───────────
type TierProfile = {
  id: string;
  user_id: string | null;
  username: string;
  display_name: string;
  profile_type: string | null;
  tier: string | null;
  tier_expires_at: string | null;
  tier_source: string | null;
  created_at: string | null;
  last_seen_at?: string | null;
  session_started_at?: string | null;
  total_seconds_online?: number | null;
  session_count?: number | null;
};

const RIGHTS_TIERS: Tier[] = ["FREE", "MID", "FULL"];
const TIER_STYLE: Record<Tier, { bg: string; border: string; fg: string }> = {
  FREE: { bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.18)", fg: "rgba(255,255,255,0.7)" },
  MID: { bg: "rgba(96,165,250,0.14)", border: "rgba(96,165,250,0.45)", fg: "#93c5fd" },
  FULL: { bg: "rgba(203,208,213,0.16)", border: "rgba(203,208,213,0.55)", fg: "#C8CDD2" },
};

function ProfileRow({
  p,
  savingId,
  onApplyTier,
}: {
  p: TierProfile;
  savingId: string;
  onApplyTier: (p: TierProfile, tier: Tier) => void;
}) {
  const current: Tier = p.tier === "MID" || p.tier === "FULL" ? p.tier : "FREE";
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-white">{p.display_name || p.username}</span>
          <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/40 ring-1 ring-white/10">
            {p.profile_type ?? "personal"}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[11px] text-white/30">@{p.username} · {p.id}</div>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-white/40">
          <OnlineDot lastSeenAt={p.last_seen_at} label size={8} />
          {isOnline(p.last_seen_at) && p.session_started_at ? (
            <span>· on for {sessionLength(p.session_started_at, p.last_seen_at)}</span>
          ) : null}
        </div>
        {p.last_seen_at ? (
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-[10px] text-white/30">
            <span>Last active {exactDateTime(p.last_seen_at)}</span>
            <span>Avg {averageSessionLength(p.total_seconds_online, p.session_count)}/session</span>
            <span>Clocked {formatDuration(p.total_seconds_online ?? 0)}</span>
          </div>
        ) : null}
        {current !== "FREE" ? (
          <div className="mt-0.5 text-[10px] text-white/40">
            {p.tier_expires_at
              ? `Expires ${new Date(p.tier_expires_at).toLocaleDateString()}`
              : "Lifetime"}
            {p.tier_source ? ` · via ${p.tier_source}` : ""}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {RIGHTS_TIERS.map((tier) => {
          const active = current === tier;
          const s = TIER_STYLE[tier];
          return (
            <button
              key={tier}
              type="button"
              disabled={savingId === p.id}
              onClick={() => onApplyTier(p, tier)}
              className="rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-50"
              style={
                active
                  ? { background: s.bg, border: `1px solid ${s.border}`, color: s.fg }
                  : { background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }
              }
            >
              {tier}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AccountRightsPanel() {
  const [profiles, setProfiles] = useState<TierProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [savingId, setSavingId] = useState("");
  const [needsMigration, setNeedsMigration] = useState(false);
  const [showFake, setShowFake] = useState(false);

  const load = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    if (!sb) { setStatus("Supabase is not configured."); setLoading(false); return; }
    setLoading(true);
    const BASE_COLS = "id,user_id,username,display_name,profile_type,tier,tier_expires_at,tier_source,created_at";
    const PRESENCE_COLS = "last_seen_at,session_started_at";
    const TOTALS_COLS = "total_seconds_online,session_count";
    let data: TierProfile[] | null = null;
    let error: { message: string } | null = null;
    {
      const res = await sb
        .from("profiles")
        .select(`${BASE_COLS},${PRESENCE_COLS},${TOTALS_COLS}`)
        .order("created_at", { ascending: true });
      data = (res.data ?? null) as TierProfile[] | null;
      error = res.error;
    }
    // Cumulative-totals columns may not be migrated yet — fall back gracefully.
    if (error && /total_seconds_online|session_count/i.test(error.message)) {
      const res = await sb
        .from("profiles")
        .select(`${BASE_COLS},${PRESENCE_COLS}`)
        .order("created_at", { ascending: true });
      data = (res.data ?? null) as TierProfile[] | null;
      error = res.error;
    }
    // Presence columns may not be migrated yet either — fall back gracefully.
    if (error && /last_seen_at|session_started_at/i.test(error.message)) {
      const res = await sb.from("profiles").select(BASE_COLS).order("created_at", { ascending: true });
      data = (res.data ?? null) as TierProfile[] | null;
      error = res.error;
    }
    if (error) {
      if (/tier/i.test(error.message) && /column|does not exist|schema cache/i.test(error.message)) {
        setNeedsMigration(true);
      } else {
        setStatus(error.message);
      }
      setLoading(false);
      return;
    }
    setProfiles((data ?? []) as TierProfile[]);
    setNeedsMigration(false);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function applyTier(p: TierProfile, tier: Tier) {
    const sb = getSupabaseBrowserClient();
    if (!sb) return;
    setSavingId(p.id);
    // Admin grants are lifetime (no expiry) and sourced as 'admin'.
    const patch = { tier, tier_expires_at: null as string | null, tier_source: "admin" };
    const { error } = await sb.from("profiles").update(patch).eq("id", p.id);
    if (error) {
      setStatus(`Failed: ${error.message}`);
      setSavingId("");
      return;
    }
    setProfiles((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
    // If this profile is active on THIS device, apply immediately.
    if (getStoredActiveProfileId() === p.id) setTierSafe(tier);
    setStatus(`${p.display_name || p.username} → ${tier} (lifetime)`);
    setSavingId("");
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

  const realFiltered = useMemo(() => filtered.filter((p) => !SEED_PROFILE_IDS.has(p.id)), [filtered]);
  const fakeFiltered = useMemo(() => filtered.filter((p) => SEED_PROFILE_IDS.has(p.id)), [filtered]);
  const realOnlineCount = useMemo(
    () => profiles.filter((p) => !SEED_PROFILE_IDS.has(p.id) && isOnline(p.last_seen_at)).length,
    [profiles]
  );

  return (
    <div className="flex h-full flex-col p-5">
      <div className="shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Account Rights</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-semibold text-white/60 ring-1 ring-white/10">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#4ade80", boxShadow: "0 0 8px rgba(74,222,128,0.7)" }} />
            {realOnlineCount} online now
          </span>
        </div>
        <p className="mt-1 text-xs text-white/40">
          Grant or revoke plan access per account. FULL lifts the item limit and unlocks paid features.
          Changes sync to the user on next app load (instantly if it&apos;s the profile active on this device).
        </p>
      </div>

      {needsMigration ? (
        <div className="mt-4 rounded-xl bg-amber-500/10 px-4 py-3 text-xs text-amber-200 ring-1 ring-amber-400/25">
          The <code>profiles.tier</code> column isn&apos;t set up yet. Run the migration
          <code className="mx-1">supabase/migrations/20260705_profiles_tier.sql</code>
          in your Supabase SQL editor, then Refresh.
        </div>
      ) : null}

      <div className="mt-4 flex shrink-0 items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, username, or ID…"
          className="h-9 w-full rounded-xl bg-white/5 px-3 text-xs text-white ring-1 ring-white/10 focus:outline-none placeholder:text-white/30"
        />
        <button
          onClick={() => void load()}
          className="h-9 shrink-0 rounded-xl bg-white/5 px-3 text-xs font-semibold ring-1 ring-white/10 transition hover:bg-white/10"
        >
          Refresh
        </button>
      </div>

      {status ? <div className="mt-2 shrink-0 text-[11px] text-white/50">{status}</div> : null}

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="text-xs text-white/30">Loading accounts…</div>
        ) : filtered.length === 0 ? (
          <div className="text-xs text-white/30">No accounts found.</div>
        ) : (
          <>
            <div className="grid gap-2">
              {realFiltered.map((p) => (
                <ProfileRow key={p.id} p={p} savingId={savingId} onApplyTier={(pr, t) => void applyTier(pr, t)} />
              ))}
              {realFiltered.length === 0 ? (
                <div className="text-xs text-white/30">No real accounts match.</div>
              ) : null}
            </div>

            {fakeFiltered.length > 0 ? (
              <div className="mt-3 border-t border-white/8 pt-3">
                <button
                  type="button"
                  onClick={() => setShowFake((v) => !v)}
                  className="flex w-full items-center justify-between rounded-xl px-1 py-1.5 text-left transition hover:bg-white/[0.03]"
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    Seed / test accounts ({fakeFiltered.length})
                  </span>
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    strokeLinecap="round" strokeLinejoin="round"
                    className={`text-white/30 transition-transform ${showFake ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {showFake ? (
                  <div className="mt-2 grid gap-2">
                    {fakeFiltered.map((p) => (
                      <ProfileRow key={p.id} p={p} savingId={savingId} onApplyTier={(pr, t) => void applyTier(pr, t)} />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

// ── Coupons Panel — generate & manage redeemable access codes ─
function CouponsPanel({ adminEmail }: { adminEmail: string }) {
  const [coupons, setCoupons] = useState<AccessCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [needsMigration, setNeedsMigration] = useState(false);
  const [copied, setCopied] = useState("");

  // form
  const [tier, setTier] = useState<Tier>("FULL");
  const [months, setMonths] = useState(6);
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const sb = getSupabaseBrowserClient();
    if (!sb) { setStatus("Supabase is not configured."); setLoading(false); return; }
    const { data, error } = await sb.from("access_coupons").select("*").order("created_at", { ascending: false });
    if (error) {
      if (/access_coupons/i.test(error.message) && /does not exist|schema cache|relation/i.test(error.message)) {
        setNeedsMigration(true);
      } else {
        setStatus(error.message);
      }
      setLoading(false);
      return;
    }
    setCoupons((data ?? []) as AccessCoupon[]);
    setNeedsMigration(false);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate() {
    setCreating(true);
    setStatus("");
    const res = await createCoupon({
      tier,
      durationMonths: months,
      maxRedemptions: maxRedemptions.trim() ? Math.max(1, parseInt(maxRedemptions, 10)) : null,
      note,
      createdBy: adminEmail,
    });
    if (res.error) {
      if (/access_coupons/i.test(res.error) && /does not exist|schema cache|relation/i.test(res.error)) setNeedsMigration(true);
      else setStatus(res.error);
    } else if (res.coupon) {
      setCoupons((prev) => [res.coupon as AccessCoupon, ...prev]);
      setNote("");
      setMaxRedemptions("");
      void copy(res.coupon.code);
      setStatus(`Created ${res.coupon.code}`);
    }
    setCreating(false);
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(""), 1500);
    } catch { /* ignore */ }
  }

  async function toggleActive(c: AccessCoupon) {
    const err = await setCouponActive(c.id, !c.active);
    if (err) { setStatus(err); return; }
    setCoupons((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: !x.active } : x)));
  }

  const inputCls = "h-9 rounded-xl bg-white/5 px-3 text-xs text-white ring-1 ring-white/10 focus:outline-none placeholder:text-white/30";

  return (
    <div className="flex h-full flex-col p-5">
      <div className="shrink-0">
        <h2 className="text-lg font-semibold">Coupons</h2>
        <p className="mt-1 text-xs text-white/40">
          Generate codes that grant timed access — hand out 6-month or 1-year FULL passes for beta.
          Users redeem at <code>/redeem</code>.
        </p>
      </div>

      {needsMigration ? (
        <div className="mt-4 rounded-xl bg-amber-500/10 px-4 py-3 text-xs text-amber-200 ring-1 ring-amber-400/25">
          The coupon tables aren&apos;t set up yet. Run <code className="mx-1">supabase/migrations/20260706_access_coupons.sql</code>
          in your Supabase SQL editor, then Refresh.
        </div>
      ) : null}

      {/* Generator */}
      <div className="mt-4 shrink-0 rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10">
        <div className="text-[10px] uppercase tracking-widest text-white/40 mb-3">New coupon</div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-white/40">Tier</span>
            <select value={tier} onChange={(e) => setTier(e.target.value as Tier)} className={inputCls}>
              <option value="FULL">FULL</option>
              <option value="MID">MID</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-white/40">Duration</span>
            <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className={inputCls}>
              <option value={1}>1 month</option>
              <option value={3}>3 months</option>
              <option value={6}>6 months</option>
              <option value={12}>1 year</option>
              <option value={24}>2 years</option>
              <option value={0}>Lifetime</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-white/40">Max uses</span>
            <input value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value.replace(/\D/g, ""))} placeholder="∞" inputMode="numeric" className={`${inputCls} w-20`} />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-[10px] text-white/40">Note</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. beta wave 1" className={`${inputCls} w-full`} />
          </label>
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating}
            className="h-9 shrink-0 rounded-xl bg-amber-500 px-4 text-xs font-bold text-black transition hover:bg-amber-400 disabled:opacity-50"
          >
            {creating ? "…" : "Generate"}
          </button>
        </div>
      </div>

      {status ? <div className="mt-2 shrink-0 text-[11px] text-white/50">{status}</div> : null}

      {/* List */}
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="text-xs text-white/30">Loading coupons…</div>
        ) : coupons.length === 0 ? (
          <div className="text-xs text-white/30">No coupons yet.</div>
        ) : (
          <div className="grid gap-2">
            {coupons.map((c) => {
              const used = c.max_redemptions != null;
              const exhausted = used && c.times_redeemed >= (c.max_redemptions ?? 0);
              return (
                <div key={c.id} className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 ring-1 ${c.active && !exhausted ? "bg-white/[0.04] ring-white/10" : "bg-white/[0.02] ring-white/5 opacity-60"}`}>
                  <button type="button" onClick={() => void copy(c.code)} className="font-mono text-sm font-bold text-[#C8CDD2] hover:underline" title="Copy code">
                    {copied === c.code ? "Copied!" : c.code}
                  </button>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: "rgba(203,208,213,0.14)", color: "#C8CDD2" }}>{c.tier}</span>
                  <span className="text-[11px] text-white/50">{durationLabel(c.duration_months)}</span>
                  <span className="text-[11px] text-white/40">
                    {c.times_redeemed}{used ? ` / ${c.max_redemptions}` : ""} used
                  </span>
                  {c.note ? <span className="text-[11px] text-white/30 truncate">— {c.note}</span> : null}
                  <button
                    type="button"
                    onClick={() => void toggleActive(c)}
                    className="ml-auto shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold ring-1 ring-white/15 transition hover:bg-white/5"
                    style={{ color: c.active ? "#f87171" : "#4ade80" }}
                  >
                    {c.active ? "Disable" : "Enable"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sidebar icons (clean line icons — no emoji) ──────────────
function AdminIcon({ name }: { name: string }) {
  const p = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "characters":
      return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>;
    case "key":
      return <svg {...p}><circle cx="8" cy="8" r="4" /><path d="M11 11l9 9M17 17l2-2M14 14l2-2" /></svg>;
    case "ticket":
      return <svg {...p}><path d="M3 9a2 2 0 0 0 0 6v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 1 0-6V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z" /><path d="M13 6v12" /></svg>;
    case "shield":
      return <svg {...p}><path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3z" /></svg>;
    case "palette":
      return <svg {...p}><path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1.1.9-2 2-2H17a4 4 0 0 0 4-4c0-4.4-4-7.5-9-7.5z" /><circle cx="7.5" cy="10.5" r="1" /><circle cx="12" cy="7.5" r="1" /><circle cx="16.5" cy="10.5" r="1" /></svg>;
    case "inbox":
      return <svg {...p}><path d="M4 4h16v16H4zM4 9h16M9 4v5" /></svg>;
    case "bug":
      return <svg {...p}><path d="M12 20a6 6 0 0 0 6-6v-2a6 6 0 0 0-12 0v2a6 6 0 0 0 6 6zM12 8V6M5 11H3M19 11h2M5 16l-2 1M19 16l2 1" /></svg>;
    default:
      return null;
  }
}

// ── Collapsible sidebar section ──────────────────────────────
function SidebarSection({
  title,
  icon,
  open,
  active,
  onToggle,
  children,
}: {
  title: string;
  icon: string;
  open: boolean;
  active: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-white/8">
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center justify-between px-4 py-3 text-left transition ${active ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"}`}
      >
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-white/70">
          <span className="shrink-0" style={{ color: "var(--theme-gold, #C8CDD2)" }}>
            <AdminIcon name={icon} />
          </span>
          {title}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-white/40 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open ? <div className="px-3 pb-3">{children}</div> : null}
    </div>
  );
}

// ── Manage Admins Panel (Owner only) ─────────────────────────
function ManageAdminsPanel({ ownerEmail, panel = false }: { ownerEmail: string; panel?: boolean }) {
  const [admins, setAdmins] = useState<AdminEntry[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAdmins().then((data) => { setAdmins(data); setLoading(false); });
  }, []);

  async function handleGrant() {
    if (!newEmail.trim()) return;
    setSaving(true);
    setError(null);
    const err = await grantAdmin(newEmail, ownerEmail);
    if (err) {
      setError(err);
    } else {
      setNewEmail("");
      const updated = await listAdmins();
      setAdmins(updated);
    }
    setSaving(false);
  }

  async function handleRevoke(id: string) {
    const err = await revokeAdmin(id);
    if (err) { setError(err); return; }
    setAdmins((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className={panel ? "p-0" : "p-4 border-t border-white/8"}>
      {!panel ? (
        <div className="text-[10px] uppercase tracking-widest text-white/30 mb-3">Manage Admins</div>
      ) : null}
      {loading ? (
        <div className="text-xs text-white/30">Loading...</div>
      ) : (
        <div className="space-y-2">
          {admins.map((admin) => (
            <div key={admin.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2">
              <div>
                <div className="text-xs text-white font-medium">{admin.email}</div>
                <div className="text-[10px] text-white/30">
                  Added by {admin.granted_by ?? "owner"} &middot; {new Date(admin.granted_at).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => handleRevoke(admin.id)}
                className="text-[10px] text-red-400 hover:text-red-300 transition"
              >
                Revoke
              </button>
            </div>
          ))}
          {admins.length === 0 && (
            <div className="text-xs text-white/30">No admins assigned yet.</div>
          )}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <input
          type="email"
          value={newEmail}
          onChange={(e) => { setNewEmail(e.target.value); setError(null); }}
          onKeyDown={(e) => e.key === "Enter" && handleGrant()}
          placeholder="user@email.com"
          className="flex-1 min-w-0 rounded-xl bg-white/5 px-3 py-1.5 text-xs text-white ring-1 ring-white/10 focus:outline-none placeholder:text-white/25"
        />
        <button
          onClick={handleGrant}
          disabled={saving || !newEmail.trim()}
          className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? "..." : "Add"}
        </button>
      </div>
      {error && <div className="mt-1 text-[10px] text-red-400">{error}</div>}
    </div>
  );
}

// ── Item Edit Modal ───────────────────────────────────────────
function ItemEditModal({
  item,
  live,
  onSave,
  onClose,
}: {
  item: SeedItem;
  live?: LiveItem;
  onSave: (id: string, data: Partial<LiveItem & { title: string; subtitle: string; notes: string; grade: string; currentValue: number; purchasePrice: number }>) => Promise<void>;
  onClose: () => void;
}) {
  const [imageUrl, setImageUrl] = useState(live?.imageUrl ?? "");
  const [title, setTitle] = useState(item.title ?? "");
  const [subtitle, setSubtitle] = useState(item.subtitle ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [grade, setGrade] = useState(item.grade ?? "");
  const [value, setValue] = useState(String(item.currentValue ?? ""));
  const [cost, setCost] = useState(String(item.purchasePrice ?? ""));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { justSaved, flashSaved } = useSaveFeedback();

  async function handleUpload(file: File) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setError("No Supabase client"); return; }
    setUploading(true);
    setError("");
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `admin/${item.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(VAULT_IMAGES_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw new Error(upErr.message);
      const { data: { publicUrl } } = supabase.storage
        .from(VAULT_IMAGES_BUCKET)
        .getPublicUrl(path);
      setImageUrl(publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await onSave(item.title, {
        imageUrl: imageUrl.trim(),
        title: title.trim(),
        subtitle: subtitle.trim(),
        notes: notes.trim(),
        grade: grade.trim(),
        currentValue: Number(value) || 0,
        purchasePrice: Number(cost) || 0,
      });
      flashSaved();
      setTimeout(onClose, 450);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-[24px] bg-[#14181f] ring-1 ring-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="text-sm font-semibold text-white">Edit Item</div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* Image preview + URL + Upload */}
        <div className="px-5 pt-4">
          <div className="flex gap-3">
            {/* Thumbnail — click to upload */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10 group hover:ring-amber-400/40 transition"
              title="Click to upload image"
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1">
                  <span className="text-lg opacity-30">📷</span>
                  <span className="text-[8px] text-white/25">Upload</span>
                </div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition rounded-xl">
                <span className="text-[9px] font-semibold text-white">
                  {uploading ? "Uploading…" : "Replace"}
                </span>
              </div>
            </button>

            {/* URL field + upload button */}
            <div className="flex-1 flex flex-col gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-white/30">Image URL</label>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="Paste URL or upload a file →"
                  className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2 text-xs text-white ring-1 ring-white/10 focus:outline-none focus:ring-amber-400/40 placeholder:text-white/20"
                />
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-white/60 hover:bg-white/10 hover:text-white transition disabled:opacity-40"
              >
                {uploading ? "Uploading…" : "📁 Upload from computer"}
              </button>
            </div>
          </div>
          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleUpload(file);
              e.target.value = "";
            }}
          />
        </div>

        {/* Fields */}
        <div className="grid grid-cols-2 gap-3 px-5 pt-4">
          {[
            { label: "Title", value: title, set: setTitle, full: true },
            { label: "Subtitle", value: subtitle, set: setSubtitle, full: true },
            { label: "Grade", value: grade, set: setGrade },
            { label: "Notes", value: notes, set: setNotes, full: true, area: true },
            { label: "Est. Value ($)", value: value, set: setValue },
            { label: "Purchase Cost ($)", value: cost, set: setCost },
          ].map(({ label, value: v, set, full, area }) => (
            <div key={label} className={full ? "col-span-2" : ""}>
              <label className="text-[10px] uppercase tracking-widest text-white/30">{label}</label>
              {area ? (
                <textarea
                  value={v}
                  onChange={(e) => set(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2 text-xs text-white ring-1 ring-white/10 focus:outline-none focus:ring-amber-400/40 resize-none placeholder:text-white/25"
                />
              ) : (
                <input
                  value={v}
                  onChange={(e) => set(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2 text-xs text-white ring-1 ring-white/10 focus:outline-none focus:ring-amber-400/40 placeholder:text-white/25"
                />
              )}
            </div>
          ))}
        </div>

        {error && <div className="mx-5 mt-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>}

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-white/8 px-5 py-4">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-xs text-white/50 hover:text-white transition">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={[
              "rounded-xl px-5 py-2 text-xs font-semibold transition disabled:opacity-50",
              justSaved ? "bg-emerald-500 text-white" : "bg-amber-500 text-black hover:bg-amber-400",
            ].join(" ")}
          >
            {saving ? "Saving…" : justSaved ? "Saved ✓" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bio Edit Modal ────────────────────────────────────────────
function BioEditModal({
  char,
  currentBio,
  onSave,
  onClose,
}: {
  char: SeedCharacter;
  currentBio: string;
  onSave: (bio: string) => Promise<void>;
  onClose: () => void;
}) {
  const [bio, setBio] = useState(currentBio);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { justSaved, flashSaved } = useSaveFeedback();

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await onSave(bio.trim());
      flashSaved();
      setTimeout(onClose, 450);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-[24px] bg-[#14181f] ring-1 ring-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-2">
            <SeedAvatar char={char} size={28} />
            <div className="text-sm font-semibold text-white">Edit Bio — {char.displayName}</div>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="p-5">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={8}
            className="w-full rounded-xl bg-white/5 px-4 py-3 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-amber-400/40 leading-relaxed resize-none"
          />
          <div className="mt-1 text-right text-[10px] text-white/25">{bio.length} chars</div>
        </div>
        {error && <div className="mx-5 mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>}
        <div className="flex justify-end gap-2 border-t border-white/8 px-5 py-4">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-xs text-white/50 hover:text-white transition">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={[
              "rounded-xl px-5 py-2 text-xs font-semibold transition disabled:opacity-50",
              justSaved ? "bg-emerald-500 text-white" : "bg-amber-500 text-black hover:bg-amber-400",
            ].join(" ")}
          >
            {saving ? "Saving…" : justSaved ? "Saved ✓" : "Save Bio"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Exhibit Edit Modal ────────────────────────────────────────
function ExhibitEditModal({
  exhibit,
  profileId,
  onSave,
  onClose,
}: {
  exhibit: SeedGallery;
  profileId: string;
  onSave: (id: string, data: { title: string; description: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(exhibit.title);
  const [description, setDescription] = useState(exhibit.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { justSaved, flashSaved } = useSaveFeedback();

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await onSave(exhibit.id, { title: title.trim(), description: description.trim() });
      flashSaved();
      setTimeout(onClose, 450);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-lg rounded-[24px] bg-[#14181f] ring-1 ring-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="text-sm font-semibold text-white">Edit Gallery</div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none">✕</button>
        </div>
        <div className="grid gap-3 p-5">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-white/30">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-amber-400/40"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-white/30">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10 focus:outline-none focus:ring-amber-400/40 resize-none leading-relaxed"
            />
          </div>
          <div className="rounded-xl bg-white/[0.03] px-3 py-2 text-[10px] text-white/30">
            <span className="text-white/20">ID: </span><span className="font-mono">{exhibit.id}</span>
            <span className="ml-4 text-white/20">Items: </span>{exhibit.itemIds.length}
          </div>
        </div>
        {error && <div className="mx-5 mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>}
        <div className="flex justify-end gap-2 border-t border-white/8 px-5 py-4">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-xs text-white/50 hover:text-white transition">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={[
              "rounded-xl px-5 py-2 text-xs font-semibold transition disabled:opacity-50",
              justSaved ? "bg-emerald-500 text-white" : "bg-amber-500 text-black hover:bg-amber-400",
            ].join(" ")}
          >
            {saving ? "Saving…" : justSaved ? "Saved ✓" : "Save Gallery"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Item Row ─────────────────────────────────────────────────
function ItemRow({
  item,
  index,
  live,
  onEdit,
  onToggleDisable,
}: {
  item: SeedItem;
  index: number;
  live?: LiveItem;
  onEdit: (item: SeedItem) => void;
  onToggleDisable: (item: SeedItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const imageUrl = live?.imageUrl ?? "";
  const disabled = live?.disabled ?? false;

  return (
    <div className="border-b border-white/5 last:border-0">
      <div className="flex w-full items-center gap-3 px-4 py-2.5">
        {/* Index */}
        <span className="w-5 shrink-0 text-center text-[10px] text-white/25">{index + 1}</span>

        {/* Thumbnail */}
        <div className="h-10 w-8 shrink-0 overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/8">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[8px] text-white/20">—</div>
          )}
        </div>

        {/* Title */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left"
        >
          <div className={["text-xs font-medium leading-tight", disabled ? "text-white/30 line-through" : "text-white/80"].join(" ")}>
            {item.title}
          </div>
          {item.subtitle && (
            <div className="text-[10px] text-white/30 truncate">{item.subtitle}</div>
          )}
        </button>

        {/* Value */}
        <span className="shrink-0 text-[10px] font-semibold text-amber-400/70 w-14 text-right">
          {formatMoney(item.currentValue)}
        </span>

        {/* Action buttons */}
        <div className="shrink-0 flex items-center gap-1.5">
          {/* Edit */}
          <button
            onClick={() => onEdit(item)}
            className="rounded-full bg-white/8 px-2.5 py-1 text-[10px] font-semibold text-white/60 hover:bg-white/15 hover:text-white transition"
          >
            Edit
          </button>

          {/* Disable / Enable */}
          <button
            onClick={() => onToggleDisable(item)}
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold transition"
            style={
              disabled
                ? {
                    background: "rgba(239,68,68,0.12)",
                    color: "#f87171",
                    boxShadow: "0 0 8px rgba(239,68,68,0.35), 0 0 0 1px rgba(239,68,68,0.3)",
                  }
                : {
                    background: "rgba(34,197,94,0.10)",
                    color: "#4ade80",
                    boxShadow: "0 0 8px rgba(34,197,94,0.30), 0 0 0 1px rgba(34,197,94,0.25)",
                  }
            }
          >
            {disabled ? "Disabled" : "Enabled"}
          </button>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-white/20 text-[10px] hover:text-white/50 transition px-1"
          >
            {expanded ? "▲" : "▼"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 pt-2 bg-white/[0.02] border-t border-white/5">
          <div className="flex gap-4">
            {/* Image preview */}
            <div className="shrink-0">
              <div className="h-28 w-24 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-1">
                    <span className="text-2xl opacity-20">🖼️</span>
                    <span className="text-[9px] text-white/20">No image</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => onEdit(item)}
                className="mt-1.5 w-full rounded-lg bg-amber-500/15 py-1 text-[10px] font-semibold text-amber-400 hover:bg-amber-500/25 transition"
              >
                Change image
              </button>
            </div>

            {/* Metadata */}
            <div className="flex-1 grid gap-1 text-[11px] text-white/60">
              {item.universe && <div><span className="text-white/30">Universe: </span>{item.universe}</div>}
              {item.category && <div><span className="text-white/30">Category: </span>{item.category}</div>}
              {item.grade && <div><span className="text-white/30">Grade: </span>{item.grade}</div>}
              {item.notes && <div><span className="text-white/30">Notes: </span>{item.notes}</div>}
              <div className="flex flex-wrap gap-4 mt-1">
                <div><span className="text-white/30">Value: </span><span className="text-amber-400">{formatMoney(item.currentValue)}</span></div>
                {item.purchasePrice != null && <div><span className="text-white/30">Cost: </span>{formatMoney(item.purchasePrice)}</div>}
              </div>
              <div className="mt-1"><span className="text-white/20">ID: </span><span className="font-mono text-[9px] text-white/20">{item.id}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Character Card (Sidebar) ──────────────────────────────────
function CharacterCard({
  char,
  isSelected,
  onClick,
}: {
  char: SeedCharacter;
  isSelected: boolean;
  onClick: () => void;
}) {
  const totalValue = char.items.reduce((s, i) => s + (i.currentValue ?? 0), 0);
  return (
    <button
      onClick={onClick}
      className={[
        "w-full rounded-2xl p-4 text-left transition ring-1",
        isSelected
          ? "bg-amber-500/10 ring-amber-400/40"
          : "bg-white/[0.03] ring-white/8 hover:bg-white/[0.06]",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <SeedAvatar char={char} size={36} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{char.displayName}</div>
          <div className="text-[10px] text-white/40">@{char.handle}</div>
        </div>
      </div>
      <div className="mt-2 flex gap-3 text-[10px] text-white/50">
        <span>{char.items.length} items</span>
        <span>{char.galleries.length} galleries</span>
        <span className="text-amber-400/70">{formatMoney(totalValue)}</span>
      </div>
      <div className="mt-1 text-[10px] text-white/30">{char.primaryFocus}</div>
    </button>
  );
}

// ── Exhibit Grid (3×6 slot layout) ───────────────────────────
const MAX_SLOTS = 18;

function ExhibitGrid({
  galleryId,
  slots,
  allItems,
  liveData,
  saving,
  onRemove,
  onPlace,
  onSave,
  onClose,
}: {
  galleryId: string;
  slots: (string | null)[];
  allItems: SeedItem[];
  liveData: Map<string, LiveItem>;
  saving: boolean;
  onRemove: (galleryId: string, slotIdx: number) => void;
  onPlace: (galleryId: string, slotIdx: number, itemId: string) => void;
  onSave: (galleryId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);
  const [pickSearch, setPickSearch] = useState("");
  const { justSaved, flashSaved } = useSaveFeedback();

  const itemById = new Map(allItems.map((i) => [i.id, i]));
  const occupied = new Set(slots.filter(Boolean) as string[]);
  const available = allItems.filter((i) => !occupied.has(i.id));
  const filtered = pickSearch
    ? available.filter((i) => i.title.toLowerCase().includes(pickSearch.toLowerCase()))
    : available;

  const filledCount = slots.filter(Boolean).length;

  return (
    <div className="border-t border-white/8">
      {/* 3-col × 6-row slot grid */}
      <div className="grid grid-cols-3 gap-2.5 p-4">
        {Array.from({ length: MAX_SLOTS }).map((_, idx) => {
          const itemId = slots[idx] ?? null;
          const item = itemId ? itemById.get(itemId) : null;
          const liveKey = item ? titleKey(item.title) : "";
          const imgUrl = liveKey ? (liveData.get(liveKey)?.imageUrl ?? "") : "";
          const disabled = liveKey ? (liveData.get(liveKey)?.disabled ?? false) : false;

          if (item) {
            return (
              <div
                key={idx}
                className="flex flex-col overflow-hidden rounded-2xl ring-1 ring-white/10"
                style={{ background: "rgba(255,255,255,0.04)" }}
              >
                {/* Thumbnail */}
                <div className="relative h-24 shrink-0 bg-white/5">
                  {imgUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imgUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-3xl opacity-15">🖼️</div>
                  )}
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-white/50">
                    {idx + 1}
                  </span>
                </div>
                {/* Info */}
                <div className="flex-1 px-2.5 py-2">
                  <div className={["text-sm font-semibold leading-snug line-clamp-2", disabled ? "line-through text-white/30" : "text-white"].join(" ")}>
                    {item.title}
                  </div>
                  <div className="mt-0.5 text-xs text-white/40 truncate">{item.universe}</div>
                </div>
                {/* Actions */}
                <div className="flex shrink-0 border-t border-white/8">
                  <button
                    onClick={() => onRemove(galleryId, idx)}
                    className="flex flex-1 items-center justify-center gap-1 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/10"
                  >
                    <span className="text-base leading-none">−</span> Remove
                  </button>
                  <div className="w-px bg-white/8" />
                  <button
                    onClick={() => { setPickingSlot(idx); setPickSearch(""); }}
                    className="flex flex-1 items-center justify-center py-2 text-xs font-semibold text-white/50 transition hover:bg-white/5 hover:text-white"
                  >
                    Replace
                  </button>
                </div>
              </div>
            );
          }

          // Empty slot
          return (
            <button
              key={idx}
              onClick={() => { setPickingSlot(idx); setPickSearch(""); }}
              className="group relative flex h-[168px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/10 transition hover:border-green-400/50 hover:bg-green-400/5"
            >
              <span className="absolute left-1.5 top-1.5 rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-white/25">{idx + 1}</span>
              <span className="text-3xl font-bold text-green-400/40 transition group-hover:text-green-400">+</span>
              <span className="text-xs text-white/25 transition group-hover:text-white/50">Add item</span>
            </button>
          );
        })}
      </div>

      {/* Item picker panel */}
      {pickingSlot !== null && (
        <div className="border-t border-white/8 bg-black/25 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-white">
              {slots[pickingSlot] ? "Replace" : "Add item"} — Slot {pickingSlot + 1}
            </div>
            <button onClick={() => setPickingSlot(null)} className="text-white/40 hover:text-white">✕</button>
          </div>
          <input
            autoFocus
            type="text"
            value={pickSearch}
            onChange={(e) => setPickSearch(e.target.value)}
            placeholder="Search items…"
            className="mb-3 w-full rounded-xl bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-white/10 focus:outline-none placeholder:text-white/25"
          />
          <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto">
            {filtered.map((item) => {
              const img = liveData.get(titleKey(item.title))?.imageUrl ?? "";
              return (
                <button
                  key={item.id}
                  onClick={() => { onPlace(galleryId, pickingSlot, item.id); setPickingSlot(null); }}
                  className="flex items-center gap-2 rounded-xl bg-white/5 p-2.5 text-left transition hover:bg-amber-500/10 hover:ring-1 hover:ring-amber-400/30"
                >
                  <div className="h-10 w-8 shrink-0 overflow-hidden rounded-lg bg-white/5">
                    {img && <img src={img} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-white/80 line-clamp-2 leading-snug">{item.title}</div>
                    <div className="text-[10px] text-white/35">{item.universe}</div>
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="col-span-2 py-6 text-center text-sm text-white/30">
                {available.length === 0 ? "All items are in this gallery" : "No items match"}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save bar */}
      <div className="flex items-center justify-between border-t border-white/8 px-4 py-3">
        <div className="text-sm text-white/40">{filledCount} of {MAX_SLOTS} slots filled</div>
        <div className="flex gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-white/40 hover:text-white transition">
            Close
          </button>
          <button
            onClick={async () => {
              await onSave(galleryId);
              flashSaved();
            }}
            disabled={saving}
            className={[
              "rounded-xl px-5 py-2 text-sm font-bold transition disabled:opacity-50",
              justSaved ? "bg-emerald-500 text-white" : "bg-amber-500 text-black hover:bg-amber-400",
            ].join(" ")}
          >
            {saving ? "Saving…" : justSaved ? "Saved ✓" : "Save Gallery"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Character Detail Panel ────────────────────────────────────
function CharacterDetail({ char }: { char: SeedCharacter }) {
  const [tab, setTab] = useState<"bio" | "items" | "exhibits">("bio");
  const [search, setSearch] = useState("");
  const [liveData, setLiveData] = useState<Map<string, LiveItem>>(new Map());
  const [bio, setBio] = useState(char.bio);
  const [loadingLive, setLoadingLive] = useState(false);

  // Exhibit item management — ordered slot array (18 slots = 3 cols × 6 rows)
  const MAX_SLOTS = 18;
  const [openExhibitId, setOpenExhibitId] = useState<string | null>(null);
  const [exhibitSlots, setExhibitSlots] = useState<Map<string, (string | null)[]>>(new Map());
  const [savingExhibit, setSavingExhibit] = useState<string | null>(null);

  // Modals
  const [editingItem, setEditingItem] = useState<SeedItem | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [editingExhibit, setEditingExhibit] = useState<SeedGallery | null>(null);

  const totalValue = char.items.reduce((s, i) => s + (i.currentValue ?? 0), 0);
  const universes = [...new Set(char.items.map((i) => i.universe).filter(Boolean))];

  // Load live data from Supabase when character changes
  useEffect(() => {
    setLiveData(new Map());
    setBio(char.bio);

    async function loadLive() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      setLoadingLive(true);
      try {
        const { data } = await supabase
          .from("vault_items")
          .select("id, title, image_front_url, is_public")
          .eq("profile_id", char.profileId);
        if (data) {
          const map = new Map<string, LiveItem>();
          for (const row of data) {
            map.set(titleKey(String(row.title ?? "")), {
              dbId: String(row.id),
              imageUrl: String(row.image_front_url ?? ""),
              disabled: row.is_public === false,
            });
          }
          setLiveData(map);
        }

        // Also fetch bio from public_profiles
        const { data: profData } = await supabase
          .from("public_profiles")
          .select("bio")
          .eq("profile_id", char.profileId)
          .single();
        if (profData?.bio) setBio(String(profData.bio));
      } finally {
        setLoadingLive(false);
      }
    }

    void loadLive();
  }, [char.profileId, char.bio]);

  // Save item edits to Supabase
  // `itemTitle` is the seed item's title (used as the liveData map key)
  const handleSaveItem = useCallback(async (itemTitle: string, data: Partial<LiveItem & { title: string; subtitle: string; notes: string; grade: string; currentValue: number; purchasePrice: number }>) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("No Supabase client");

    const key = titleKey(itemTitle);
    const dbId = liveData.get(key)?.dbId;
    if (!dbId) throw new Error("Item not found in database — check that seed data is synced");

    const { error } = await supabase
      .from("vault_items")
      .update({
        image_front_url: data.imageUrl,
        title: data.title,
        subtitle: data.subtitle,
        notes: data.notes,
        grade: data.grade,
        current_value: data.currentValue,
        purchase_price: data.purchasePrice,
      })
      .eq("id", dbId);

    if (error) throw new Error(error.message);

    setLiveData((prev) => {
      const next = new Map(prev);
      const existing = next.get(key) ?? { imageUrl: "", disabled: false, dbId: "" };
      next.set(key, { ...existing, imageUrl: data.imageUrl ?? existing.imageUrl });
      return next;
    });
  }, [liveData]);

  // Toggle disable/enable in Supabase
  const handleToggleDisable = useCallback(async (item: SeedItem) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const key = titleKey(item.title);
    const current = liveData.get(key);
    const dbId = current?.dbId;
    if (!dbId) return;
    const nowDisabled = !(current?.disabled ?? false);

    const { error } = await supabase
      .from("vault_items")
      .update({ is_public: !nowDisabled })
      .eq("id", dbId);

    if (!error) {
      setLiveData((prev) => {
        const next = new Map(prev);
        const existing = next.get(key) ?? { imageUrl: "", disabled: false, dbId: "" };
        next.set(key, { ...existing, disabled: nowDisabled });
        return next;
      });
    }
  }, [liveData]);

  // Save bio to Supabase
  const handleSaveBio = useCallback(async (newBio: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("No Supabase client");

    const { error } = await supabase
      .from("public_profiles")
      .update({ bio: newBio })
      .eq("profile_id", char.profileId);

    if (error) throw new Error(error.message);
    setBio(newBio);
  }, [char.profileId]);

  // Save exhibit title/description to Supabase
  const handleSaveExhibit = useCallback(async (id: string, data: { title: string; description: string }) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) throw new Error("No Supabase client");
    const { error } = await supabase
      .from("galleries")
      .update({ title: data.title, description: data.description })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }, []);

  // Load exhibit items from Supabase → fill ordered slot array
  const loadExhibitItems = useCallback(async (galleryId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { data } = await supabase.from("galleries").select("layout").eq("id", galleryId).single();
    const ids: string[] = data?.layout?.itemIds ?? [];
    const slots: (string | null)[] = Array(MAX_SLOTS).fill(null);
    ids.forEach((id, i) => { if (i < MAX_SLOTS) slots[i] = id; });
    setExhibitSlots((prev) => new Map(prev).set(galleryId, [...slots]));
  }, [MAX_SLOTS]);

  // Remove item from a slot
  const handleRemoveSlot = useCallback((galleryId: string, slotIdx: number) => {
    setExhibitSlots((prev) => {
      const next = new Map(prev);
      const slots = [...(next.get(galleryId) ?? Array(MAX_SLOTS).fill(null))];
      slots[slotIdx] = null;
      next.set(galleryId, slots);
      return next;
    });
  }, [MAX_SLOTS]);

  // Place item into a slot
  const handlePlaceItem = useCallback((galleryId: string, slotIdx: number, itemId: string) => {
    setExhibitSlots((prev) => {
      const next = new Map(prev);
      const slots = [...(next.get(galleryId) ?? Array(MAX_SLOTS).fill(null))];
      // Remove from any other slot first
      const existing = slots.indexOf(itemId);
      if (existing !== -1) slots[existing] = null;
      slots[slotIdx] = itemId;
      next.set(galleryId, slots);
      return next;
    });
  }, [MAX_SLOTS]);

  // Persist exhibit slot changes to Supabase
  const saveExhibitItems = useCallback(async (galleryId: string) => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSavingExhibit(galleryId);
    try {
      const slots = exhibitSlots.get(galleryId) ?? [];
      const ids = slots.filter(Boolean) as string[];
      // Fetch current layout so we don't clobber other fields
      const { data } = await supabase.from("galleries").select("layout").eq("id", galleryId).single();
      const layout = { ...(data?.layout ?? {}), itemIds: ids };
      await supabase.from("galleries").update({ layout }).eq("id", galleryId);
    } finally {
      setSavingExhibit(null);
    }
  }, [exhibitSlots]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return char.items;
    const q = search.toLowerCase();
    return char.items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.subtitle ?? "").toLowerCase().includes(q) ||
        (i.universe ?? "").toLowerCase().includes(q) ||
        (i.category ?? "").toLowerCase().includes(q)
    );
  }, [char.items, search]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-white/8 p-5">
        <div className="flex items-center gap-3">
          <SeedAvatar char={char} size={56} />
          <div>
            <div className="text-xl font-bold text-white">{char.displayName}</div>
            <div className="text-sm text-white/40">@{char.handle}</div>
          </div>
          {loadingLive && (
            <div className="ml-auto text-[10px] text-white/25 animate-pulse">Loading live data…</div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
          <div className="rounded-full bg-white/5 px-3 py-1 text-white/60">
            {char.items.length} items
          </div>
          <div className="rounded-full bg-white/5 px-3 py-1 text-white/60">
            {char.galleries.length} exhibits
          </div>
          <div className="rounded-full bg-amber-400/10 px-3 py-1 text-amber-400">
            {formatMoney(totalValue)} total value
          </div>
          <div className="rounded-full bg-white/5 px-3 py-1 text-white/60">
            {char.primaryFocus}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {universes.map((u) => (
            <span key={u} className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/40">
              {u}
            </span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex gap-1 border-b border-white/8 px-4 pt-2">
        {(["bio", "items", "exhibits"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-3 py-2 text-xs font-semibold capitalize transition border-b-2",
              tab === t
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-white/40 hover:text-white/70",
            ].join(" ")}
          >
            {t === "items" ? `Items (${char.items.length})` : t === "exhibits" ? `Galleries (${char.galleries.length})` : "Bio"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Bio Tab ── */}
        {tab === "bio" && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-widest text-white/30">Biography</div>
              <button
                onClick={() => setEditingBio(true)}
                className="rounded-full bg-amber-500/15 px-3 py-1 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/25 transition"
              >
                Edit Bio
              </button>
            </div>
            <div className="text-sm leading-relaxed text-white/70">{bio || <span className="text-white/25 italic">No bio set</span>}</div>

            <div className="mt-4 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/8">
              <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Profile ID</div>
              <div className="font-mono text-xs text-white/50 break-all">{char.profileId}</div>
            </div>
            <div className="mt-3 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/8">
              <div className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Gallery IDs</div>
              {char.galleries.map((g) => (
                <div key={g.id} className="font-mono text-[10px] text-white/40 mb-1">{g.id}</div>
              ))}
            </div>
          </div>
        )}

        {/* ── Items Tab ── */}
        {tab === "items" && (
          <div>
            <div className="sticky top-0 bg-[#111318] p-3 border-b border-white/5 z-10">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items..."
                className="w-full rounded-xl bg-white/5 px-3 py-2 text-xs text-white ring-1 ring-white/10 focus:outline-none placeholder:text-white/30"
              />
              {search && (
                <div className="mt-1 text-[10px] text-white/30">
                  {filteredItems.length} of {char.items.length} items
                </div>
              )}
            </div>
            <div>
              {filteredItems.map((item, i) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  index={i}
                  live={liveData.get(titleKey(item.title))}
                  onEdit={setEditingItem}
                  onToggleDisable={handleToggleDisable}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Exhibits Tab ── */}
        {tab === "exhibits" && (
          <div className="p-4 grid gap-4">
            {char.galleries.map((g) => {
              const isOpen = openExhibitId === g.id;
              const slots = exhibitSlots.get(g.id);
              const filledCount = slots ? slots.filter(Boolean).length : g.itemIds.length;

              return (
                <div key={g.id} className="overflow-hidden rounded-2xl ring-1 ring-white/8"
                  style={{ background: isOpen ? "rgba(203,208,213,0.03)" : "rgba(255,255,255,0.03)" }}>

                  {/* Header */}
                  <div className="flex items-center gap-3 p-4">
                    <button
                      className="flex-1 min-w-0 text-left"
                      onClick={async () => {
                        if (isOpen) {
                          setOpenExhibitId(null);
                        } else {
                          setOpenExhibitId(g.id);
                          if (!exhibitSlots.has(g.id)) await loadExhibitItems(g.id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white/40">{isOpen ? "▼" : "▶"}</span>
                        <div>
                          <div className="text-base font-bold text-white">{g.title}</div>
                          <div className="mt-0.5 text-sm text-white/45">{g.description}</div>
                        </div>
                      </div>
                    </button>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className="rounded-full bg-white/8 px-3 py-1 text-sm text-white/50">
                        {filledCount} items
                      </span>
                      <button
                        onClick={() => setEditingExhibit(g)}
                        className="rounded-full bg-amber-500/15 px-3 py-1.5 text-sm font-semibold text-amber-400 hover:bg-amber-500/25 transition"
                      >
                        Edit Info
                      </button>
                    </div>
                  </div>

                  {/* 3×6 Grid (when open) */}
                  {isOpen && (
                    <ExhibitGrid
                      galleryId={g.id}
                      slots={slots ?? Array(MAX_SLOTS).fill(null)}
                      allItems={char.items}
                      liveData={liveData}
                      saving={savingExhibit === g.id}
                      onRemove={handleRemoveSlot}
                      onPlace={handlePlaceItem}
                      onSave={saveExhibitItems}
                      onClose={() => setOpenExhibitId(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {editingItem && (
        <ItemEditModal
          item={editingItem}
          live={liveData.get(titleKey(editingItem.title))}
          onSave={handleSaveItem}
          onClose={() => setEditingItem(null)}
        />
      )}
      {editingBio && (
        <BioEditModal
          char={char}
          currentBio={bio}
          onSave={handleSaveBio}
          onClose={() => setEditingBio(false)}
        />
      )}
      {editingExhibit && (
        <ExhibitEditModal
          exhibit={editingExhibit}
          profileId={char.profileId}
          onSave={handleSaveExhibit}
          onClose={() => setEditingExhibit(null)}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
type AdminSection = "characters" | "account-rights" | "coupons" | "admins" | "themes" | "waitlist" | "bugs" | "scan-limits";

export default function AdminCharactersPage() {
  const [authState, setAuthState] = useState<"loading" | "signed-out" | "unauthorized" | "authorized">("loading");
  const [role, setRole] = useState<AdminRole>(null);
  const [userEmail, setUserEmail] = useState("");
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<AdminSection>("characters");
  const [openSections, setOpenSections] = useState<Record<AdminSection, boolean>>({
    characters: false,
    "account-rights": false,
    coupons: false,
    admins: false,
    themes: false,
    waitlist: false,
    bugs: false,
    "scan-limits": false,
  });

  function selectSection(section: AdminSection) {
    const willOpen = !openSections[section];
    setOpenSections((prev) => ({ ...prev, [section]: willOpen }));
    if (willOpen) setActiveSection(section);
  }

  async function checkAuth() {
    setAuthState("loading");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setAuthState("signed-out"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setAuthState("signed-out"); return; }
    setUserEmail(user.email);
    const r = await getMyAdminRole();
    if (!r) { setAuthState("unauthorized"); return; }
    setRole(r);
    setAuthState("authorized");
  }

  useEffect(() => { checkAuth(); }, []);

  if (authState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0c12]">
        <div className="text-sm text-white/30">Checking access...</div>
      </div>
    );
  }
  if (authState === "signed-out") return <AdminLoginGate onSignedIn={checkAuth} />;
  if (authState === "unauthorized") return <NotAuthorized userEmail={userEmail} />;

  const filtered = ALL_CHARACTERS.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.displayName.toLowerCase().includes(q) ||
      c.handle.toLowerCase().includes(q) ||
      c.primaryFocus.toLowerCase().includes(q)
    );
  });

  const selected = ALL_CHARACTERS.find((c) => c.handle === selectedHandle) ?? null;

  const totalItems = ALL_CHARACTERS.reduce((s, c) => s + c.items.length, 0);
  const totalValue = ALL_CHARACTERS.reduce(
    (s, c) => s + c.items.reduce((ss, i) => ss + (i.currentValue ?? 0), 0),
    0
  );

  return (
    <div className="flex h-screen bg-[#0a0c12] text-white overflow-hidden">
      {/* Sidebar — collapsible sections */}
      <div className="w-72 shrink-0 flex flex-col border-r border-white/8">
        <div className="shrink-0 p-4 border-b border-white/8">
          <div className="text-sm font-bold text-white">VLTD Admin</div>
          <div className="mt-0.5 text-[10px] text-white/40">
            {ALL_CHARACTERS.length} characters · {totalItems} items · {formatMoney(totalValue)}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Characters */}
          <SidebarSection
            title="Characters"
            icon="characters"
            open={openSections.characters}
            active={activeSection === "characters"}
            onToggle={() => selectSection("characters")}
          >
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search characters..."
              className="w-full rounded-xl bg-white/5 px-3 py-1.5 text-xs text-white ring-1 ring-white/10 focus:outline-none placeholder:text-white/30"
            />
            <div className="mt-2 grid gap-2">
              {filtered.map((char) => (
                <CharacterCard
                  key={char.handle}
                  char={char}
                  isSelected={selectedHandle === char.handle && activeSection === "characters"}
                  onClick={() => { setSelectedHandle(char.handle); setActiveSection("characters"); }}
                />
              ))}
              {filtered.length === 0 && (
                <div className="text-center text-xs text-white/30 py-6">No characters found</div>
              )}
            </div>
          </SidebarSection>

          {/* Account Rights */}
          <SidebarSection
            title="Account Rights"
            icon="key"
            open={openSections["account-rights"]}
            active={activeSection === "account-rights"}
            onToggle={() => selectSection("account-rights")}
          >
            <p className="text-[11px] leading-4 text-white/40">
              Grant or revoke full access per account. Controls open on the right.
            </p>
          </SidebarSection>

          {/* Coupons */}
          <SidebarSection
            title="Coupons"
            icon="ticket"
            open={openSections.coupons}
            active={activeSection === "coupons"}
            onToggle={() => selectSection("coupons")}
          >
            <p className="text-[11px] leading-4 text-white/40">
              Generate 6-month / 1-year access codes for beta. Opens on the right.
            </p>
          </SidebarSection>

          {/* Manage Admins — owner only */}
          {role === "owner" && (
            <SidebarSection
              title="Manage Admins"
              icon="shield"
              open={openSections.admins}
              active={activeSection === "admins"}
              onToggle={() => selectSection("admins")}
            >
              <p className="text-[11px] leading-4 text-white/40">
                Add or revoke admin access. Controls open on the right.
              </p>
            </SidebarSection>
          )}

          {/* Themes */}
          <SidebarSection
            title="Themes"
            icon="palette"
            open={openSections.themes}
            active={activeSection === "themes"}
            onToggle={() => selectSection("themes")}
          >
            <p className="text-[11px] leading-4 text-white/40">
              Seasonal themes and overrides. Opens on the right.
            </p>
          </SidebarSection>

          {/* Beta Waitlist */}
          <SidebarSection
            title="Beta Waitlist"
            icon="inbox"
            open={openSections.waitlist}
            active={activeSection === "waitlist"}
            onToggle={() => selectSection("waitlist")}
          >
            <p className="text-[11px] leading-4 text-white/40">
              Approve requests and send invites. Opens on the right.
            </p>
          </SidebarSection>

          {/* Bug Reports */}
          <SidebarSection
            title="Bug Reports"
            icon="bug"
            open={openSections.bugs}
            active={activeSection === "bugs"}
            onToggle={() => selectSection("bugs")}
          >
            <p className="text-[11px] leading-4 text-white/40">
              Feedback from beta testers. Opens on the right.
            </p>
          </SidebarSection>

          {/* AI Scan Limits */}
          <SidebarSection
            title="Scan Limits"
            icon="ticket"
            open={openSections["scan-limits"]}
            active={activeSection === "scan-limits"}
            onToggle={() => selectSection("scan-limits")}
          >
            <p className="text-[11px] leading-4 text-white/40">
              Monthly AI-scan allowance per plan, plus custom per-account limits. Opens on the right.
            </p>
          </SidebarSection>
        </div>

        <div className="shrink-0 p-3 border-t border-white/8 flex items-center justify-between">
          <span className="text-[10px] text-white/30 truncate">{userEmail}</span>
          <button
            onClick={() => signOut().then(() => setAuthState("signed-out"))}
            className="text-[10px] text-white/30 hover:text-white/60 transition ml-2 shrink-0"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Main workspace — content for the active section */}
      <div className="flex-1 overflow-hidden bg-[#111318]">
        {activeSection === "characters" ? (
          selected ? (
            <CharacterDetail char={selected} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="text-4xl opacity-20">👤</div>
                <div className="mt-2 text-sm text-white/30">Select a character</div>
              </div>
            </div>
          )
        ) : activeSection === "account-rights" ? (
          <AccountRightsPanel />
        ) : activeSection === "coupons" ? (
          <CouponsPanel adminEmail={userEmail} />
        ) : activeSection === "admins" ? (
          <div className="h-full overflow-y-auto p-5">
            <h2 className="text-lg font-semibold">Manage Admins</h2>
            <p className="mt-1 mb-4 text-xs text-white/40">Grant or revoke admin access to the admin console.</p>
            <div className="max-w-xl">
              <ManageAdminsPanel ownerEmail={userEmail} panel />
            </div>
          </div>
        ) : activeSection === "waitlist" ? (
          <iframe
            src="/admin/waitlist"
            title="Beta Waitlist"
            className="h-full w-full border-0"
          />
        ) : activeSection === "bugs" ? (
          <iframe
            src="/admin/bugs"
            title="Bug Reports"
            className="h-full w-full border-0"
          />
        ) : activeSection === "scan-limits" ? (
          <iframe
            src="/admin/scan-limits"
            title="AI Scan Limits"
            className="h-full w-full border-0"
          />
        ) : (
          <iframe
            src="/admin/themes"
            title="Seasonal Themes"
            className="h-full w-full border-0"
          />
        )}
      </div>
    </div>
  );
}

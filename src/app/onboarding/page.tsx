"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createProfile, getOnboardingStatus, setStoredActiveProfileId } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { UNIVERSE_KEYS, UNIVERSE_LABEL, UNIVERSE_ICON } from "@/lib/taxonomy";
import { clearOnboardingDraft, loadOnboardingDraft, saveOnboardingDraft } from "@/lib/onboardingDraft";

// ─── Constants ────────────────────────────────────────────────────────────────
// Realistic preset avatars — the same illustrated set the app renders elsewhere
// (TopNav resolves `__preset:<id>` → /avatars/presets/<id>.png). No more raw emoji.
const AVATAR_PRESETS: { id: string; label: string }[] = [
  { id: "key", label: "Vault Key" },
  { id: "crown", label: "Crown Vault" },
  { id: "vault", label: "Museum Vault" },
  { id: "cards", label: "Card Vault" },
  { id: "gem", label: "Blue Gem" },
  { id: "orb", label: "Crystal Orb" },
  { id: "dragon", label: "Jade Dragon" },
  { id: "lion", label: "Lion Collector" },
  { id: "fox", label: "Fox Collector" },
  { id: "eagle", label: "Eagle Aviator" },
  { id: "sword", label: "Crossed Swords" },
  { id: "fire", label: "Fire Relic" },
  { id: "guitar", label: "Guitar" },
  { id: "vinyl", label: "Vinyl" },
  { id: "harp", label: "Golden Harp" },
  { id: "keysmith", label: "Keysmith" },
];
const AVATAR_PRESET_IDS = new Set(AVATAR_PRESETS.map((a) => a.id));
const presetSrc = (id: string) => `/avatars/presets/${id}.png`;

const VALUE_PROPS = [
  { icon: "vault", text: "Vault everything you own" },
  { icon: "chart", text: "Track grades & market value" },
  { icon: "trophy", text: "Rank on the global registry" },
  { icon: "image", text: "Share beautiful public galleries" },
];

// Clean line icons (no emoji). name → SVG path set.
function UiIcon({ name, size = 18 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "person": return <svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>;
    case "store": return <svg {...p}><path d="M3 9l1.5-5h15L21 9M4 9h16v11H4zM9 20v-6h6v6" /></svg>;
    case "key": return <svg {...p}><circle cx="8" cy="8" r="4" /><path d="M11 11l9 9M17 17l2-2M14 14l2-2" /></svg>;
    case "vault": return <svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M12 4v3M12 17v3" /></svg>;
    case "chart": return <svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M2 20h20" /></svg>;
    case "trophy": return <svg {...p}><path d="M8 21h8M12 17v4M6 4h12v4a6 6 0 0 1-12 0zM6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3" /></svg>;
    case "image": return <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="1.6" /><path d="M21 15l-5-5L5 21" /></svg>;
    default: return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function slugifyUsername(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
}

function accountTypeCardClass(active: boolean) {
  return [
    "rounded-2xl border p-5 text-left transition cursor-pointer",
    active
      ? "border-[rgba(203,208,213,0.55)] bg-[rgba(203,208,213,0.10)] text-text-primary shadow-[0_0_0_1px_rgba(203,208,213,0.18)]"
      : "border-[color:var(--border)] bg-vault-card text-[color:var(--muted)] hover:border-[rgba(203,208,213,0.35)] hover:bg-[rgba(203,208,213,0.06)] hover:text-text-primary",
  ].join(" ");
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="mt-6 grid gap-2" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <div
          key={n}
          className={[
            "h-1.5 rounded-full transition-all",
            step >= n
              ? "bg-[#C8CDD2] shadow-[0_0_12px_rgba(203,208,213,0.4)]"
              : "bg-[rgba(203,208,213,0.12)]",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

function GoldButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-12 items-center rounded-[8px] px-6 text-sm font-black text-[#0B0B0B] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
      style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)" }}
    >
      {children}
    </button>
  );
}

function GhostButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-12 items-center rounded-[8px] border border-[color:var(--border)] bg-vault-card px-6 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
    >
      {children}
    </button>
  );
}

function AvatarThumb({ id, size = 40 }: { id: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={presetSrc(id)}
      alt=""
      width={size}
      height={size}
      className="h-full w-full rounded-full object-cover"
      draggable={false}
    />
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarPreset, setAvatarPreset] = useState("key");
  const [accountChoice, setAccountChoice] = useState<"personal" | "business" | "both">("personal");
  const [focusedUniverses, setFocusedUniverses] = useState<string[]>([]);

  // Business fields (shown for Business or Both)
  const [bizName, setBizName] = useState("");
  const [bizUsername, setBizUsername] = useState("");
  const [bizType, setBizType] = useState("dealer");
  const [bizWebsite, setBizWebsite] = useState("");
  const [bizEin, setBizEin] = useState("");

  // The PRIMARY profile is business only when "Business" is chosen; "Both" makes
  // the primary personal and adds a separate business profile.
  const profileType: "personal" | "business" = accountChoice === "business" ? "business" : "personal";

  useEffect(() => {
    const draft = loadOnboardingDraft();
    setUsername(draft.username);
    setDisplayName(draft.display_name);
    setAccountChoice(draft.profile_type === "business" ? "business" : "personal");
    // The draft stores the chosen avatar preset id in the avatar_emoji slot.
    if (draft.avatar_emoji && AVATAR_PRESET_IDS.has(draft.avatar_emoji)) {
      setAvatarPreset(draft.avatar_emoji);
    }

    async function load() {
      const status = await getOnboardingStatus();
      if (!status.isAuthenticated) { router.replace("/login"); return; }
      if (!status.needsOnboarding) { router.replace("/"); return; }
      setLoading(false);
    }
    void load();
  }, [router]);

  // Persist draft on any field change
  useEffect(() => {
    saveOnboardingDraft({
      username,
      display_name: displayName,
      profile_type: profileType,
      primary_focus: "",
      avatar_emoji: avatarPreset,
    });
  }, [username, displayName, profileType, avatarPreset]);

  const canContinueIdentity = useMemo(
    () => displayName.trim().length >= 2 && slugifyUsername(username).length >= 3,
    [displayName, username]
  );

  async function handleFinish() {
    if (!canContinueIdentity) return;
    setSaving(true);
    setError("");
    try {
      const isPrimaryBusiness = accountChoice === "business";
      // Primary focus is derived from the first universe the user picked (if any).
      const primaryFocus = focusedUniverses[0]
        ? UNIVERSE_LABEL[focusedUniverses[0] as keyof typeof UNIVERSE_LABEL] ?? ""
        : "";
      const profileData = await createProfile({
        username: slugifyUsername(username),
        display_name: displayName.trim(),
        profile_type: isPrimaryBusiness ? "business" : "personal",
        primary_focus: primaryFocus || undefined,
        avatar_url: `__preset:${avatarPreset}`,
        ...(isPrimaryBusiness
          ? { business_type: bizType, website: bizWebsite, tax_id: bizEin }
          : {}),
      });

      // Save focused_universes if any were chosen. This is best-effort: if the
      // column isn't present yet it must NOT block onboarding from completing.
      if (focusedUniverses.length > 0 && profileData?.id) {
        try {
          const supabase = getSupabaseBrowserClient();
          if (supabase) {
            await supabase
              .from("profiles")
              .update({ focused_universes: focusedUniverses })
              .eq("id", profileData.id);
          }
        } catch (universeErr) {
          console.warn("Could not save focused universes (non-blocking):", universeErr);
        }
      }

      // "Both" — also create a separate business profile, then land on personal.
      if (accountChoice === "both") {
        await createProfile({
          username: slugifyUsername(bizUsername || `${username}-biz`),
          display_name: bizName.trim() || `${displayName.trim()} Business`,
          profile_type: "business",
          avatar_url: "__preset:vault",
          business_type: bizType,
          website: bizWebsite,
          tax_id: bizEin,
        });
        if (profileData?.id) setStoredActiveProfileId(profileData.id);
      }

      clearOnboardingDraft();
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finish onboarding.");
    } finally {
      setSaving(false);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <main className="px-4 py-8 text-[color:var(--fg)]">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-[color:var(--border)] bg-vault-card p-6 text-[color:var(--muted)] shadow-[0_22px_72px_rgba(0,0,0,0.24)]">
          Loading…
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg">
        <section
          className="relative overflow-hidden rounded-[34px] p-6 sm:p-8"
          style={{
            background: "var(--theme-elevated, rgba(20,32,55,0.9))",
            border: "1px solid var(--theme-gold-border, rgba(203,208,213,0.25))",
            boxShadow: "0 26px 86px rgba(0,0,0,0.32)",
          }}
        >
          {/* Ambient glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(circle at 18% 0%, var(--theme-gold-subtle, rgba(203,208,213,0.06)), transparent 50%)" }}
          />

          <div className="relative">
            {/* Header */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--theme-gold,#C8CDD2)]">VLTD</span>
              <span className="text-[11px] uppercase tracking-[0.2em] text-[color:var(--muted2)]">/ Setup</span>
            </div>
            <h1 className="mt-3 text-3xl font-black leading-[1] tracking-[-0.05em] text-text-primary sm:text-4xl">
              {step === 1 && "Your identity."}
              {step === 2 && "Account type."}
              {step === 3 && "What you collect."}
            </h1>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              {step === 1 && "Pick an avatar, set your name. You can change all of this later."}
              {step === 2 && "This shapes your dashboard and visibility defaults."}
              {step === 3 && "Pick the universes to focus your experience. You can change this anytime."}
            </p>

            <StepIndicator step={step} total={TOTAL_STEPS} />

            {error && (
              <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {/* ── Step 1: Identity ── */}
            {step === 1 && (
              <div className="mt-6 space-y-5">
                {/* Realistic avatar picker */}
                <div>
                  <div className="mb-2 text-sm font-semibold text-text-primary">Avatar</div>
                  <div className="flex flex-wrap gap-2.5">
                    {AVATAR_PRESETS.map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        title={label}
                        aria-label={label}
                        aria-pressed={avatarPreset === id}
                        onClick={() => setAvatarPreset(id)}
                        className={[
                          "flex h-12 w-12 items-center justify-center overflow-hidden rounded-full transition",
                          avatarPreset === id
                            ? "ring-2 ring-[#C8CDD2] scale-110"
                            : "ring-1 ring-[color:var(--border)] opacity-85 hover:scale-105 hover:opacity-100 hover:ring-[rgba(203,208,213,0.5)]",
                        ].join(" ")}
                      >
                        <AvatarThumb id={id} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Display name */}
                <label className="block">
                  <span className="text-sm font-semibold text-text-primary">Display name</span>
                  <input
                    value={displayName}
                    onChange={(e) => {
                      const next = e.target.value;
                      setDisplayName(next);
                      if (!username.trim()) setUsername(slugifyUsername(next));
                    }}
                    placeholder="e.g. Jordan Collector"
                    className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] bg-vault-card px-4 text-[color:var(--fg)] placeholder:text-[color:var(--muted2)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(203,208,213,0.12)]"
                  />
                </label>

                {/* Username */}
                <label className="block">
                  <span className="text-sm font-semibold text-text-primary">Username</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(slugifyUsername(e.target.value))}
                    placeholder="e.g. jordan_collects"
                    className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] bg-vault-card px-4 text-[color:var(--fg)] placeholder:text-[color:var(--muted2)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(203,208,213,0.12)]"
                  />
                  <div className="mt-1.5 text-xs text-[color:var(--muted2)]">
                    Public URL: vltd.app/v/<span className="font-semibold text-[color:var(--muted)]">{slugifyUsername(username) || "username"}</span>
                  </div>
                </label>

                <GoldButton disabled={!canContinueIdentity} onClick={() => setStep(2)}>
                  Continue →
                </GoldButton>
              </div>
            )}

            {/* ── Step 2: Account type ── */}
            {step === 2 && (
              <div className="mt-6 space-y-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  {([
                    { key: "personal", icon: "person", title: "Curator", desc: "Personal vault, portfolio, and galleries." },
                    { key: "business", icon: "store", title: "Business", desc: "Shop, resale inventory, or team workflow." },
                    { key: "both", icon: "key", title: "Both", desc: "A personal vault plus a separate business." },
                  ] as const).map(({ key, icon, title, desc }) => (
                    <button key={key} type="button" onClick={() => setAccountChoice(key)} className={accountTypeCardClass(accountChoice === key)}>
                      <div className="flex items-center justify-between">
                        <div className="mb-2 text-[color:var(--theme-gold,#C8CDD2)]"><UiIcon name={icon} size={22} /></div>
                        {accountChoice === key && (
                          <div className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#0B0B0B]" style={{ background: "var(--theme-gold-gradient)" }}>✓</div>
                        )}
                      </div>
                      <div className="text-base font-black text-text-primary">{title}</div>
                      <div className="mt-1 text-sm leading-6 text-[color:var(--muted)]">{desc}</div>
                    </button>
                  ))}
                </div>

                {/* Business details — shown for Business or Both */}
                {(accountChoice === "business" || accountChoice === "both") && (
                  <div className="rounded-2xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-4 space-y-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted2)]">Business details</div>
                    {accountChoice === "both" && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="text-xs text-[color:var(--muted)]">Business name</span>
                          <input value={bizName} onChange={(e) => setBizName(e.target.value)} placeholder="The Kellogg Collection" className="mt-1 w-full rounded-xl border border-[color:var(--border)] bg-[var(--theme-card)] px-3 py-2 text-sm outline-none" />
                        </label>
                        <label className="block">
                          <span className="text-xs text-[color:var(--muted)]">Business handle</span>
                          <input value={bizUsername} onChange={(e) => setBizUsername(e.target.value)} placeholder="kelloggcollection" className="mt-1 w-full rounded-xl border border-[color:var(--border)] bg-[var(--theme-card)] px-3 py-2 text-sm outline-none" />
                        </label>
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs text-[color:var(--muted)]">Business type</span>
                        <select value={bizType} onChange={(e) => setBizType(e.target.value)} className="mt-1 w-full rounded-xl border border-[color:var(--border)] bg-[var(--theme-card)] px-3 py-2 text-sm outline-none">
                          <option value="dealer">Dealer</option>
                          <option value="gallery">Gallery</option>
                          <option value="brand">Brand</option>
                          <option value="estate">Estate</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs text-[color:var(--muted)]">Website (optional)</span>
                        <input value={bizWebsite} onChange={(e) => setBizWebsite(e.target.value)} placeholder="https://…" className="mt-1 w-full rounded-xl border border-[color:var(--border)] bg-[var(--theme-card)] px-3 py-2 text-sm outline-none" />
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-xs text-[color:var(--muted)]">EIN / Tax ID (optional, private)</span>
                      <input value={bizEin} onChange={(e) => setBizEin(e.target.value)} placeholder="XX-XXXXXXX" className="mt-1 w-full rounded-xl border border-[color:var(--border)] bg-[var(--theme-card)] px-3 py-2 text-sm outline-none" />
                    </label>
                  </div>
                )}

                {/* Value props */}
                <div className="rounded-2xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted2)] mb-3">What you&apos;re unlocking</div>
                  <div className="grid grid-cols-2 gap-2">
                    {VALUE_PROPS.map(({ icon, text }) => (
                      <div key={text} className="flex items-start gap-2 text-sm text-[color:var(--muted)]">
                        <span className="shrink-0 text-[color:var(--theme-gold,#C8CDD2)]"><UiIcon name={icon} size={16} /></span>
                        <span>{text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <GoldButton onClick={() => setStep(3)}>Continue →</GoldButton>
                  <GhostButton onClick={() => setStep(1)}>Back</GhostButton>
                </div>
              </div>
            )}

            {/* ── Step 3: Universes + Confirm + Launch ── */}
            {step === 3 && (
              <div className="mt-6 space-y-5">
                <div>
                  <div className="text-sm font-semibold text-text-primary mb-1">What universes do you collect in?</div>
                  <p className="text-xs text-[color:var(--muted2)] mb-3">We&apos;ll focus your experience around these. You can always change it later.</p>
                  <div className="flex flex-wrap gap-2">
                    {UNIVERSE_KEYS.map((key) => {
                      const active = focusedUniverses.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() =>
                            setFocusedUniverses((prev) =>
                              active ? prev.filter((k) => k !== key) : [...prev, key]
                            )
                          }
                          className={[
                            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition ring-1",
                            active
                              ? "bg-[rgba(203,208,213,0.15)] ring-[rgba(203,208,213,0.55)] text-text-primary"
                              : "bg-[color:var(--pill)] ring-[color:var(--border)] text-[color:var(--muted)] hover:ring-[rgba(203,208,213,0.35)] hover:text-text-primary",
                          ].join(" ")}
                        >
                          <span>{UNIVERSE_ICON[key]}</span>
                          <span>{UNIVERSE_LABEL[key]}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFocusedUniverses([...UNIVERSE_KEYS])}
                      className="text-xs font-semibold text-[color:var(--muted)] hover:text-text-primary transition"
                    >
                      Select all
                    </button>
                    <span className="text-[color:var(--muted2)]">·</span>
                    <button
                      type="button"
                      onClick={() => setFocusedUniverses([])}
                      className="text-xs font-semibold text-[color:var(--muted)] hover:text-text-primary transition"
                    >
                      Skip — show everything
                    </button>
                  </div>
                </div>

                {/* Confirm summary */}
                <div className="rounded-2xl border border-[color:var(--border)] bg-vault-card p-4 space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted2)] mb-1">Confirming</div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-[color:var(--border)]">
                      <AvatarThumb id={avatarPreset} />
                    </div>
                    <div>
                      <div className="font-semibold text-text-primary">{displayName.trim()}</div>
                      <div className="text-xs text-[color:var(--muted2)]">@{slugifyUsername(username)} · {profileType === "business" ? "Business" : "Curator"}{focusedUniverses.length > 0 ? ` · ${focusedUniverses.length} ${focusedUniverses.length === 1 ? "universe" : "universes"}` : ""}</div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <GoldButton disabled={saving || !canContinueIdentity} onClick={() => void handleFinish()}>
                    {saving ? "Setting up…" : "Launch my vault →"}
                  </GoldButton>
                  <GhostButton onClick={() => setStep(2)}>Back</GhostButton>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Fine print */}
        <p className="mt-5 text-center text-xs text-[color:var(--muted2)]">
          You can change your name, avatar, and focus anytime in settings.
        </p>
      </div>
    </main>
  );
}

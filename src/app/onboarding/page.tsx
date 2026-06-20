"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createProfile, getOnboardingStatus } from "@/lib/auth";
import { clearOnboardingDraft, loadOnboardingDraft, saveOnboardingDraft } from "@/lib/onboardingDraft";

// ─── Constants ────────────────────────────────────────────────────────────────
const AVATAR_EMOJIS = [
  "🗝️","🏆","⚡","🔥","👑","🎯","🎲","🎴","🃏","🀄",
  "🏅","🎖️","💎","🪙","🔮","🧿","🎪","🎭","🛡️","⚔️",
  "🦁","🐉","🦊","🦅","🐺","🦋","🐙","🦈","🌟","💫",
];

const FOCUS_OPTIONS = [
  { label: "Sports Cards", emoji: "⚾" },
  { label: "TCG", emoji: "🃏" },
  { label: "Comics", emoji: "📚" },
  { label: "Toys", emoji: "🧸" },
  { label: "Memorabilia", emoji: "🏆" },
  { label: "Watches", emoji: "⌚" },
  { label: "Coins", emoji: "🪙" },
  { label: "Vinyl", emoji: "💿" },
  { label: "Art", emoji: "🎨" },
  { label: "Mixed", emoji: "📦" },
];

const VALUE_PROPS = [
  { icon: "🗄️", text: "Vault everything you own" },
  { icon: "📊", text: "Track grades & market value" },
  { icon: "🏆", text: "Rank on the global registry" },
  { icon: "🖼️", text: "Share beautiful public galleries" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function slugifyUsername(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
}

function accountTypeCardClass(active: boolean) {
  return [
    "rounded-2xl border p-5 text-left transition cursor-pointer",
    active
      ? "border-[rgba(245,181,72,0.55)] bg-[rgba(245,181,72,0.10)] text-text-primary shadow-[0_0_0_1px_rgba(245,181,72,0.18)]"
      : "border-[color:var(--border)] bg-vault-card text-[color:var(--muted)] hover:border-[rgba(245,181,72,0.35)] hover:bg-[rgba(245,181,72,0.06)] hover:text-text-primary",
  ].join(" ");
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: number }) {
  return (
    <div className="mt-6 grid grid-cols-3 gap-2">
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className={[
            "h-1.5 rounded-full transition-all",
            step >= n
              ? "bg-[#F5B548] shadow-[0_0_12px_rgba(245,181,72,0.4)]"
              : "bg-[rgba(245,181,72,0.12)]",
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
      className="inline-flex h-12 items-center rounded-full px-6 text-sm font-black text-[#0B0B0B] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
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
      className="inline-flex h-12 items-center rounded-full border border-[color:var(--border)] bg-vault-card px-6 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary"
    >
      {children}
    </button>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarEmoji, setAvatarEmoji] = useState("");
  const [profileType, setProfileType] = useState<"personal" | "business">("personal");
  const [primaryFocus, setPrimaryFocus] = useState("");

  const resolvedAvatar = avatarEmoji || "🗝️";

  useEffect(() => {
    const draft = loadOnboardingDraft();
    setUsername(draft.username);
    setDisplayName(draft.display_name);
    setProfileType(draft.profile_type);
    setPrimaryFocus(draft.primary_focus);
    setAvatarEmoji(draft.avatar_emoji);

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
      primary_focus: primaryFocus,
      avatar_emoji: avatarEmoji,
    });
  }, [username, displayName, profileType, primaryFocus, avatarEmoji]);

  const canContinueIdentity = useMemo(
    () => displayName.trim().length >= 2 && slugifyUsername(username).length >= 3,
    [displayName, username]
  );

  async function handleFinish() {
    if (!canContinueIdentity) return;
    setSaving(true);
    setError("");
    try {
      await createProfile({
        username: slugifyUsername(username),
        display_name: displayName.trim(),
        profile_type: profileType,
        primary_focus: primaryFocus.trim() || undefined,
        avatar_emoji: resolvedAvatar,
      });
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
      <main className="min-h-screen px-4 py-8 text-[color:var(--fg)]">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-[color:var(--border)] bg-vault-card p-6 text-[color:var(--muted)] shadow-[0_22px_72px_rgba(0,0,0,0.24)]">
          Loading…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-lg">
        <section
          className="relative overflow-hidden rounded-[34px] p-6 sm:p-8"
          style={{
            background: "var(--theme-elevated, rgba(20,32,55,0.9))",
            border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.25))",
            boxShadow: "0 26px 86px rgba(0,0,0,0.32)",
          }}
        >
          {/* Ambient glow */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(circle at 18% 0%, var(--theme-gold-subtle, rgba(245,181,72,0.06)), transparent 50%)" }}
          />

          <div className="relative">
            {/* Header */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--theme-gold,#F5B548)]">VLTD</span>
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
              {step === 3 && "Helps us tune the registry and discovery for you."}
            </p>

            <StepIndicator step={step} />

            {error && (
              <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {/* ── Step 1: Identity ── */}
            {step === 1 && (
              <div className="mt-6 space-y-5">
                {/* Emoji picker */}
                <div>
                  <div className="mb-2 text-sm font-semibold text-text-primary">Avatar</div>
                  <div className="flex flex-wrap gap-2">
                    {AVATAR_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setAvatarEmoji(emoji)}
                        className={[
                          "flex h-10 w-10 items-center justify-center rounded-full text-xl transition",
                          resolvedAvatar === emoji
                            ? "bg-[rgba(245,181,72,0.2)] ring-2 ring-[#F5B548] scale-110"
                            : "bg-[color:var(--pill)] ring-1 ring-[color:var(--border)] hover:scale-110 hover:ring-[rgba(245,181,72,0.4)]",
                        ].join(" ")}
                      >
                        {emoji}
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
                    className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] bg-vault-card px-4 text-[color:var(--fg)] placeholder:text-[color:var(--muted2)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(245,181,72,0.12)]"
                  />
                </label>

                {/* Username */}
                <label className="block">
                  <span className="text-sm font-semibold text-text-primary">Username</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(slugifyUsername(e.target.value))}
                    placeholder="e.g. jordan_collects"
                    className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] bg-vault-card px-4 text-[color:var(--fg)] placeholder:text-[color:var(--muted2)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(245,181,72,0.12)]"
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => setProfileType("personal")} className={accountTypeCardClass(profileType === "personal")}>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl mb-2">🧑</div>
                      {profileType === "personal" && (
                        <div className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#0B0B0B]" style={{ background: "var(--theme-gold-gradient)" }}>✓</div>
                      )}
                    </div>
                    <div className="text-base font-black text-text-primary">Collector</div>
                    <div className="mt-1 text-sm leading-6 text-[color:var(--muted)]">Personal vault, portfolio, and public galleries.</div>
                  </button>
                  <button type="button" onClick={() => setProfileType("business")} className={accountTypeCardClass(profileType === "business")}>
                    <div className="flex items-center justify-between">
                      <div className="text-2xl mb-2">🏪</div>
                      {profileType === "business" && (
                        <div className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#0B0B0B]" style={{ background: "var(--theme-gold-gradient)" }}>✓</div>
                      )}
                    </div>
                    <div className="text-base font-black text-text-primary">Business</div>
                    <div className="mt-1 text-sm leading-6 text-[color:var(--muted)]">Shop, resale inventory, or team workflow.</div>
                  </button>
                </div>

                {/* Value props */}
                <div className="rounded-2xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted2)] mb-3">What you're unlocking</div>
                  <div className="grid grid-cols-2 gap-2">
                    {VALUE_PROPS.map(({ icon, text }) => (
                      <div key={text} className="flex items-start gap-2 text-sm text-[color:var(--muted)]">
                        <span className="shrink-0 text-base">{icon}</span>
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

            {/* ── Step 3: Focus + Confirm ── */}
            {step === 3 && (
              <div className="mt-6 space-y-5">
                <div>
                  <div className="text-sm font-semibold text-text-primary mb-3">Primary collection focus <span className="text-[color:var(--muted2)] font-normal">(optional)</span></div>
                  <div className="flex flex-wrap gap-2">
                    {FOCUS_OPTIONS.map(({ label, emoji }) => {
                      const active = primaryFocus === label;
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setPrimaryFocus(active ? "" : label)}
                          className={[
                            "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition ring-1",
                            active
                              ? "bg-[rgba(245,181,72,0.15)] ring-[rgba(245,181,72,0.55)] text-text-primary"
                              : "bg-[color:var(--pill)] ring-[color:var(--border)] text-[color:var(--muted)] hover:ring-[rgba(245,181,72,0.35)] hover:text-text-primary",
                          ].join(" ")}
                        >
                          <span>{emoji}</span>
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Confirm summary */}
                <div className="rounded-2xl border border-[color:var(--border)] bg-vault-card p-4 space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted2)] mb-1">Confirming</div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--pill)] text-xl ring-1 ring-[color:var(--border)]">
                      {resolvedAvatar}
                    </div>
                    <div>
                      <div className="font-semibold text-text-primary">{displayName.trim()}</div>
                      <div className="text-xs text-[color:var(--muted2)]">@{slugifyUsername(username)} · {profileType === "business" ? "Business" : "Collector"}{primaryFocus ? ` · ${primaryFocus}` : ""}</div>
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

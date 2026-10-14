"use client";

import { nativeSelectClass } from "@/components/ui/nativeSelect";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createProfile, getCurrentUser, getOnboardingStatus, setStoredActiveProfileId, updateProfile } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { UNIVERSE_KEYS, UNIVERSE_LABEL } from "@/lib/taxonomy";
import { Glyph, universeGlyphName } from "@/components/ui/Glyph";
import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { clearOnboardingDraft, loadOnboardingDraft, saveOnboardingDraft } from "@/lib/onboardingDraft";
import { PillButton } from "@/components/ui/PillButton";
import VltdLogo from "@/components/VltdLogo";
import { useTheme } from "@/lib/ThemeContext";

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
  { icon: "image", text: "Share beautiful public exhibitions" },
];

const UI_ICON_MAP: Record<string, AppIconName> = {
  person: "account",
  store: "building",
  key: "key",
  vault: "vault",
  chart: "chart",
  trophy: "trophy",
  image: "frame",
};

// Clean line icons (no emoji), routed through the shared AppIcon system.
function UiIcon({ name, size = 18 }: { name: string; size?: number }) {
  const mapped = UI_ICON_MAP[name];
  if (!mapped) return null;
  return <AppIcon name={mapped} size={size} strokeWidth={1.8} />;
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
    <PillButton
      onClick={onClick}
      disabled={disabled}
      className="font-black"
      style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)", color: "#0B0B0B" }}
    >
      {children}
    </PillButton>
  );
}

function GhostButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return <PillButton onClick={onClick}>{children}</PillButton>;
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
const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const { theme, setTheme, setIconStyle, logoVariant, setLogoVariant } = useTheme();
  const lookMode = theme.mode;
  function chooseLook(next: "classic" | "bright") {
    setIconStyle(next === "bright" ? "simplified-glass" : "classic");
    setLogoVariant(next === "bright" ? "b" : "a");
  }
  function chooseMode(next: "dark" | "light") {
    setTheme(next === "light" ? "pearl-light" : "deep-vault");
  }

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarPreset, setAvatarPreset] = useState("key");
  const [personalProfileId, setPersonalProfileId] = useState("");
  const [businessProfileId, setBusinessProfileId] = useState("");
  const [onboardingUserId, setOnboardingUserId] = useState("");
  const [addBusiness, setAddBusiness] = useState(false);
  const [focusedUniverses, setFocusedUniverses] = useState<string[]>([]);

  // Optional second profile. Every VLTD account starts with a personal profile.
  const [bizName, setBizName] = useState("");
  const [bizUsername, setBizUsername] = useState("");
  const [bizType, setBizType] = useState("dealer");
  const [bizWebsite, setBizWebsite] = useState("");

  useEffect(() => {
    async function load() {
      const [status, userResult] = await Promise.all([getOnboardingStatus(), getCurrentUser()]);
      if (!status.isAuthenticated) { router.replace("/login"); return; }
      if (!status.needsOnboarding) { router.replace("/"); return; }
      const userId = userResult.data.user?.id ?? "";
      const draft = loadOnboardingDraft(userId);
      const identityIsComplete = draft.display_name.trim().length >= 2 && slugifyUsername(draft.username).length >= 3;
      const businessIsComplete = !draft.add_business || (
        draft.business_name.trim().length >= 2 && slugifyUsername(draft.business_username).length >= 3
      );
      setOnboardingUserId(userId);
      setStep(!identityIsComplete ? 1 : !businessIsComplete && draft.step > 2 ? 2 : draft.step);
      setUsername(draft.username);
      setDisplayName(draft.display_name);
      setAddBusiness(draft.add_business);
      setBizName(draft.business_name);
      setBizUsername(draft.business_username);
      setBizType(draft.business_type);
      setBizWebsite(draft.business_website);
      setFocusedUniverses(draft.focused_universes);
      if (draft.avatar_emoji && AVATAR_PRESET_IDS.has(draft.avatar_emoji)) setAvatarPreset(draft.avatar_emoji);
      const cloudPersonal = status.profiles.find(
        (profile) => profile.profile_type === "personal" && profile.onboarding_completed === false
      );
      if (cloudPersonal) {
        setPersonalProfileId(cloudPersonal.id);
        setDisplayName(cloudPersonal.display_name ?? "");
        setUsername(cloudPersonal.username ?? "");
        const cloudAvatar = String(cloudPersonal.avatar_url ?? "");
        if (cloudAvatar.startsWith("__preset:")) {
          const preset = cloudAvatar.slice("__preset:".length);
          if (AVATAR_PRESET_IDS.has(preset)) setAvatarPreset(preset);
        }
        setStep(draft.step > 1 ? draft.step : 2);
      } else {
        setPersonalProfileId(draft.personal_profile_id);
      }
      setBusinessProfileId(draft.business_profile_id);
      setDraftLoaded(true);
      setLoading(false);
    }
    void load();
  }, [router]);

  // Persist draft on any field change
  useEffect(() => {
    if (!draftLoaded) return;
    saveOnboardingDraft({
      step,
      username,
      display_name: displayName,
      avatar_emoji: avatarPreset,
      add_business: addBusiness,
      business_name: bizName,
      business_username: bizUsername,
      business_type: bizType,
      business_website: bizWebsite,
      focused_universes: focusedUniverses,
      personal_profile_id: personalProfileId,
      business_profile_id: businessProfileId,
      owner_user_id: onboardingUserId,
    });
  }, [step, username, displayName, avatarPreset, addBusiness, bizName, bizUsername, bizType, bizWebsite, focusedUniverses, personalProfileId, businessProfileId, onboardingUserId, draftLoaded]);

  const canContinueIdentity = useMemo(
    () => displayName.trim().length >= 2 && slugifyUsername(username).length >= 3,
    [displayName, username]
  );

  const canContinueBusiness = useMemo(
    () => !addBusiness || (bizName.trim().length >= 2 && slugifyUsername(bizUsername).length >= 3),
    [addBusiness, bizName, bizUsername]
  );

  async function savePersonalCheckpoint() {
    if (!canContinueIdentity || identitySaving) return;
    setIdentitySaving(true);
    setError("");
    try {
      const input = {
        username: slugifyUsername(username),
        display_name: displayName.trim(),
        profile_type: "personal" as const,
        avatar_url: `__preset:${avatarPreset}`,
        onboarding_completed: false,
        is_public: false,
      };
      const profile = personalProfileId
        ? await updateProfile(personalProfileId, input)
        : await createProfile(input);
      setPersonalProfileId(profile.id);
      setStoredActiveProfileId(profile.id);
      saveOnboardingDraft({ ...input, avatar_emoji: avatarPreset, personal_profile_id: profile.id, owner_user_id: onboardingUserId, step: 2 });
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your personal profile.");
    } finally {
      setIdentitySaving(false);
    }
  }

  async function handleFinish() {
    if (!canContinueIdentity || !canContinueBusiness) return;
    setSaving(true);
    setError("");
    try {
      // Primary focus is derived from the first universe the user picked (if any).
      const primaryFocus = focusedUniverses[0]
        ? UNIVERSE_LABEL[focusedUniverses[0] as keyof typeof UNIVERSE_LABEL] ?? ""
        : "";
      const profileData = personalProfileId
        ? await updateProfile(personalProfileId, {
            username: slugifyUsername(username),
            display_name: displayName.trim(),
            profile_type: "personal",
            primary_focus: primaryFocus || undefined,
            avatar_url: `__preset:${avatarPreset}`,
          })
        : await createProfile({
        username: slugifyUsername(username),
        display_name: displayName.trim(),
        profile_type: "personal",
        primary_focus: primaryFocus || undefined,
        avatar_url: `__preset:${avatarPreset}`,
        onboarding_completed: false,
      });
      setPersonalProfileId(profileData.id);

      // Save focused_universes if any were chosen. This is best-effort: if the
      // column isn't present yet it must NOT block onboarding from completing.
      if (focusedUniverses.length > 0 && profileData?.id) {
        try {
          const supabase = getSupabaseBrowserClient();
          if (supabase) {
            await supabase
              .from("profiles")
              .update({ collection_interests: focusedUniverses })
              .eq("id", profileData.id);
          }
        } catch (universeErr) {
          console.warn("Could not save focused universes (non-blocking):", universeErr);
        }
      }

      // A business is always a separate second profile. The personal profile
      // remains the active profile after setup.
      if (addBusiness && !businessProfileId) {
        const business = await createProfile({
          username: slugifyUsername(bizUsername),
          display_name: bizName.trim(),
          profile_type: "business",
          avatar_url: "__preset:vault",
          business_type: bizType,
          website: bizWebsite,
        });
        setBusinessProfileId(business.id);
        saveOnboardingDraft({ business_profile_id: business.id });
      }

      setStoredActiveProfileId(profileData.id);
      await updateProfile(profileData.id, { onboarding_completed: true, is_public: true });

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
              {step === 1 && "Your personal account."}
              {step === 2 && "Add a business?"}
              {step === 3 && "Pick your look."}
              {step === 4 && "Review and finish."}
            </h1>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              {step === 1 && "Set up the personal profile every VLTD member starts with."}
              {step === 2 && "Your personal details are ready. A separate business profile is optional."}
              {step === 3 && "Choose how VLTD looks for you. Change it anytime in your account menu."}
              {step === 4 && "Choose your interests and confirm exactly which profiles will be created."}
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
                    Public URL: vltd.app/@<span className="font-semibold text-[color:var(--muted)]">{slugifyUsername(username) || "username"}</span>
                  </div>
                </label>

                <GoldButton disabled={!canContinueIdentity || identitySaving} onClick={() => void savePersonalCheckpoint()}>
                  {identitySaving ? "Saving…" : "Save and continue →"}
                </GoldButton>
              </div>
            )}

            {/* ── Step 2: Optional business profile ── */}
            {step === 2 && (
              <div className="mt-6 space-y-5">
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3">
                  <div className="text-sm font-black text-text-primary">Personal profile details complete</div>
                  <div className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
                    {displayName.trim()} · @{slugifyUsername(username)}. Saved to your account, so you can continue on another device.
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    { key: false, icon: "person", title: "Personal only", desc: "Continue with your personal vault without creating a business profile." },
                    { key: true, icon: "store", title: "Add a business profile", desc: "Create a separate profile for a shop, dealer, brand, or team." },
                  ] as const).map(({ key, icon, title, desc }) => (
                    <button key={String(key)} type="button" onClick={() => setAddBusiness(key)} className={accountTypeCardClass(addBusiness === key)}>
                      <div className="flex items-center justify-between">
                        <div className="mb-2 text-[color:var(--theme-gold,#C8CDD2)]"><UiIcon name={icon} size={22} /></div>
                        {addBusiness === key && (
                          <div className="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-[#0B0B0B]" style={{ background: "var(--theme-gold-gradient)" }}>✓</div>
                        )}
                      </div>
                      <div className="text-base font-black text-text-primary">{title}</div>
                      <div className="mt-1 text-sm leading-6 text-[color:var(--muted)]">{desc}</div>
                    </button>
                  ))}
                </div>

                {/* Business details — shown only when adding a second profile */}
                {addBusiness && (
                  <div className="rounded-2xl border border-[color:var(--border)] bg-[rgba(255,255,255,0.02)] p-4 space-y-3">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted2)]">Business details</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs text-[color:var(--muted)]">Business name</span>
                        <input value={bizName} onChange={(e) => setBizName(e.target.value)} placeholder="Business name" className={`mt-1 w-full ${nativeSelectClass}`} />
                      </label>
                      <label className="block">
                        <span className="text-xs text-[color:var(--muted)]">Business handle</span>
                        <input value={bizUsername} onChange={(e) => setBizUsername(slugifyUsername(e.target.value))} placeholder="business_handle" className={`mt-1 w-full ${nativeSelectClass}`} />
                      </label>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-xs text-[color:var(--muted)]">Business type</span>
                        <select value={bizType} onChange={(e) => setBizType(e.target.value)} className={`mt-1 w-full ${nativeSelectClass}`}>
                          <option value="dealer">Dealer</option>
                          <option value="gallery">Gallery</option>
                          <option value="brand">Brand</option>
                          <option value="estate">Estate</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs text-[color:var(--muted)]">Website (optional)</span>
                        <input value={bizWebsite} onChange={(e) => setBizWebsite(e.target.value)} placeholder="https://…" className={`mt-1 w-full ${nativeSelectClass}`} />
                      </label>
                    </div>
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

                <div className="flex flex-wrap items-center gap-3">
                  <GoldButton disabled={!canContinueBusiness} onClick={() => setStep(3)}>Continue →</GoldButton>
                  <GhostButton onClick={() => setStep(1)}>Back</GhostButton>
                </div>
              </div>
            )}

            {/* ── Step 3: Pick your look ── */}
            {step === 3 && (
              <div className="mt-6 space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    { key: "classic", title: "Classic", desc: "Calm platinum, Classic icons.", force: "a" as const },
                    { key: "bright", title: "Bright", desc: "Color logo, Simple Glass icons.", force: "b" as const },
                  ]).map((opt) => {
                    const active = (opt.key === "bright") === (logoVariant === "b");
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => chooseLook(opt.key as "classic" | "bright")}
                        aria-pressed={active}
                        className={`${accountTypeCardClass(active)} h-full${active ? " ring-2 ring-[color:var(--data-color,#4FD3EE)]" : ""}`}
                      >
                        <div className="flex h-16 items-center">
                          <VltdLogo height={34} force={opt.force} />
                        </div>
                        <div className="mt-3 text-base font-black text-text-primary">{opt.title}</div>
                        <div className="mt-1 text-xs text-[color:var(--muted2)]">{opt.desc}</div>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <div className="mb-2 text-sm font-semibold text-text-primary">Screen</div>
                  <div className="flex flex-wrap gap-2">
                    {(["dark", "light"] as const).map((m) => (
                      <PillButton key={m} onClick={() => chooseMode(m)} variant={lookMode === m ? "active" : "default"} pressed={lookMode === m}>
                        {m === "dark" ? "Dark" : "Light"}
                      </PillButton>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <GoldButton onClick={() => setStep(4)}>Continue →</GoldButton>
                  <GhostButton onClick={() => setStep(2)}>Back</GhostButton>
                </div>
              </div>
            )}

            {/* ── Step 4: Universes + Confirm + Launch ── */}
            {step === 4 && (
              <div className="mt-6 space-y-5">
                <div>
                  <div className="text-sm font-semibold text-text-primary mb-1">What universes do you collect in?</div>
                  <p className="text-xs text-[color:var(--muted2)] mb-3">We&apos;ll focus your experience around these. You can always change it later.</p>
                  <div className="flex flex-wrap gap-2">
                    {UNIVERSE_KEYS.map((key) => {
                      const active = focusedUniverses.includes(key);
                      return (
                        <PillButton
                          key={key}
                          variant={active ? "active" : "default"}
                          pressed={active}
                          onClick={() =>
                            setFocusedUniverses((prev) =>
                              active ? prev.filter((k) => k !== key) : [...prev, key]
                            )
                          }
                        >
                          <Glyph name={universeGlyphName(key)} size={16} />
                          <span>{UNIVERSE_LABEL[key]}</span>
                        </PillButton>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <PillButton size="compact" onClick={() => setFocusedUniverses([...UNIVERSE_KEYS])}>
                      Select all
                    </PillButton>
                    <PillButton size="compact" onClick={() => setFocusedUniverses([])}>
                      Skip — show everything
                    </PillButton>
                  </div>
                </div>

                {/* Confirm summary */}
                <div className="rounded-2xl border border-[color:var(--border)] bg-vault-card p-4 space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted2)] mb-1">Setup summary</div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-[color:var(--border)]">
                      <AvatarThumb id={avatarPreset} />
                    </div>
                    <div>
                      <div className="font-semibold text-text-primary">{displayName.trim()}</div>
                      <div className="text-xs text-[color:var(--muted2)]">@{slugifyUsername(username)} · Personal{focusedUniverses.length > 0 ? ` · ${focusedUniverses.length} ${focusedUniverses.length === 1 ? "universe" : "universes"}` : ""}</div>
                    </div>
                  </div>
                  {addBusiness && (
                    <div className="mt-3 border-t border-[color:var(--border)] pt-3">
                      <div className="font-semibold text-text-primary">{bizName.trim()}</div>
                      <div className="text-xs text-[color:var(--muted2)]">@{slugifyUsername(bizUsername)} · Separate business profile</div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <GoldButton disabled={saving || !canContinueIdentity || !canContinueBusiness} onClick={() => void handleFinish()}>
                    {saving ? "Setting up…" : addBusiness ? "Create business and finish →" : "Finish setup →"}
                  </GoldButton>
                  <GhostButton onClick={() => setStep(3)}>Back</GhostButton>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Fine print */}
        <p className="mt-5 text-center text-xs text-[color:var(--muted2)]">
          Your personal profile is saved to your account after Step 1. Later choices stay on this device until setup is finished.
        </p>
      </div>
    </main>
  );
}

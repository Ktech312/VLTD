"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createProfile, getOnboardingStatus } from "@/lib/auth";
import { clearOnboardingDraft, loadOnboardingDraft, saveOnboardingDraft } from "@/lib/onboardingDraft";

const FOCUS_OPTIONS = ["Sports Cards", "TCG", "Comics", "Toys", "Memorabilia", "Watches", "Mixed Collection"];

function slugifyUsername(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
}

function accountTypeCardClass(active: boolean) {
  return [
    "rounded-2xl border p-5 text-left transition",
    active
      ? "border-[rgba(245,181,72,0.55)] bg-[rgba(245,181,72,0.10)] text-text-primary shadow-[0_0_0_1px_rgba(245,181,72,0.18),0_18px_48px_rgba(245,181,72,0.12)]"
      : "border-[color:var(--border)] bg-vault-card text-[color:var(--muted)] hover:border-[rgba(245,181,72,0.35)] hover:bg-[rgba(245,181,72,0.06)] hover:text-text-primary",
  ].join(" ");
}

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profileType, setProfileType] = useState<"personal" | "business">("personal");
  const [primaryFocus, setPrimaryFocus] = useState("");

  useEffect(() => {
    const draft = loadOnboardingDraft();
    setUsername(draft.username);
    setDisplayName(draft.display_name);
    setProfileType(draft.profile_type);
    setPrimaryFocus(draft.primary_focus);
    async function load() {
      const status = await getOnboardingStatus();
      if (!status.isAuthenticated) {
        router.replace("/login");
        return;
      }
      if (!status.needsOnboarding) {
        router.replace("/");
        return;
      }
      setLoading(false);
    }
    void load();
  }, [router]);

  useEffect(() => {
    saveOnboardingDraft({ username, display_name: displayName, profile_type: profileType, primary_focus: primaryFocus });
  }, [username, displayName, profileType, primaryFocus]);

  const canContinueIdentity = useMemo(() => displayName.trim().length >= 2 && slugifyUsername(username).length >= 3, [displayName, username]);

  async function handleFinish() {
    if (!canContinueIdentity) return;
    setSaving(true);
    setError("");
    try {
      await createProfile({ username: slugifyUsername(username), display_name: displayName.trim(), profile_type: profileType, primary_focus: primaryFocus.trim() });
      clearOnboardingDraft();
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to finish onboarding.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-8 text-[color:var(--fg)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-[color:var(--border)] bg-vault-card p-6 text-[color:var(--muted)] shadow-[0_22px_72px_rgba(0,0,0,0.24)]">
          Loading onboarding...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <section
          className="relative overflow-hidden rounded-[34px] p-5 sm:p-7"
          style={{
            background: 'var(--theme-elevated, rgba(20,32,55,0.9))',
            border: '1px solid var(--theme-gold-border, rgba(245,181,72,0.25))',
            boxShadow: '0 26px 86px rgba(0,0,0,0.32)',
          }}
        >
          <div className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(circle at 18% 0%, var(--theme-gold-subtle, rgba(245,181,72,0.06)), transparent 30%)' }} />

          <div className="relative">
            <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)]">
              Welcome to VLTD
            </div>
            <h1 className="mt-3 text-4xl font-black leading-[0.98] tracking-[-0.055em] text-text-primary sm:text-5xl">
              Let’s get you in fast.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--muted)]">
              Minimal setup now. Richer profile, vault, and gallery controls later.
            </p>

            <div className="mt-7 grid gap-2 sm:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className={[
                    "h-2 rounded-full transition",
                    step >= n ? "bg-[#F5B548] shadow-[0_0_18px_rgba(245,181,72,0.28)]" : "bg-[rgba(245,181,72,0.12)]",
                  ].join(" ")}
                />
              ))}
            </div>

            {error ? (
              <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="mt-7 grid gap-5">
                <label className="block">
                  <span className="text-sm font-semibold text-text-primary">Display name</span>
                  <input
                    value={displayName}
                    onChange={(e) => {
                      const next = e.target.value;
                      setDisplayName(next);
                      if (!username.trim()) setUsername(slugifyUsername(next));
                    }}
                    className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] bg-vault-card px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(245,181,72,0.12)]"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-text-primary">Username</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(slugifyUsername(e.target.value))}
                    className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] bg-vault-card px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(245,181,72,0.12)]"
                  />
                  <div className="mt-2 text-xs text-[color:var(--muted2)]">Public handle preview: @{slugifyUsername(username) || "username"}</div>
                </label>

                <button
                  type="button"
                  disabled={!canContinueIdentity}
                  onClick={() => setStep(2)}
                  className="inline-flex h-12 w-fit items-center rounded-full px-6 text-sm font-black text-[#0B0B0B] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: 'var(--theme-gold-gradient)', boxShadow: 'var(--theme-gold-glow)' }}
                >
                  Continue
                </button>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="mt-7 space-y-5">
                <div>
                  <div className="text-sm font-semibold text-text-primary">Account type</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setProfileType("personal")}
                      className={accountTypeCardClass(profileType === "personal")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-base font-black">Collector</div>
                        {profileType === "personal" ? <div className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#0B0B0B]" style={{ background: 'var(--theme-gold-gradient)' }}>Selected</div> : null}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">Personal vault, portfolio, and public galleries.</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileType("business")}
                      className={accountTypeCardClass(profileType === "business")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-base font-black">Business</div>
                        {profileType === "business" ? <div className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#0B0B0B]" style={{ background: 'var(--theme-gold-gradient)' }}>Selected</div> : null}
                      </div>
                      <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">Shop, team, resale, or inventory workflow.</div>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => setStep(3)} className="inline-flex h-12 items-center rounded-full px-6 text-sm font-black text-[#0B0B0B] transition hover:-translate-y-0.5 hover:brightness-105" style={{ background: 'var(--theme-gold-gradient)', boxShadow: 'var(--theme-gold-glow)' }}>
                    Continue
                  </button>
                  <button type="button" onClick={() => setStep(1)} className="inline-flex h-12 items-center rounded-full border border-[color:var(--border)] bg-vault-card px-6 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary">
                    Back
                  </button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="mt-7 space-y-5">
                <label className="block">
                  <span className="text-sm font-semibold text-text-primary">Primary collection focus</span>
                  <select
                    value={primaryFocus}
                    onChange={(e) => setPrimaryFocus(e.target.value)}
                    className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] bg-vault-card px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(245,181,72,0.12)]"
                  >
                    <option value="">Skip for now</option>
                    {FOCUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>

                <div className="rounded-2xl border border-[color:var(--border)] bg-vault-card p-5 text-sm leading-7 text-[color:var(--muted)]">
                  <div><span className="text-[color:var(--muted2)]">Username:</span> <span className="font-semibold text-text-primary">@{slugifyUsername(username)}</span></div>
                  <div><span className="text-[color:var(--muted2)]">Display name:</span> <span className="font-semibold text-text-primary">{displayName.trim()}</span></div>
                  <div><span className="text-[color:var(--muted2)]">Account type:</span> <span className="font-semibold text-text-primary">{profileType === "business" ? "Business" : "Collector"}</span></div>
                  <div><span className="text-[color:var(--muted2)]">Focus:</span> <span className="font-semibold text-text-primary">{primaryFocus || "Not set yet"}</span></div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={saving || !canContinueIdentity}
                    onClick={() => void handleFinish()}
                    className="inline-flex h-12 items-center rounded-full px-6 text-sm font-black text-[#0B0B0B] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: 'var(--theme-gold-gradient)', boxShadow: 'var(--theme-gold-glow)' }}
                  >
                    {saving ? "Finishing..." : "Finish setup"}
                  </button>
                  <button type="button" onClick={() => setStep(2)} className="inline-flex h-12 items-center rounded-full border border-[color:var(--border)] bg-vault-card px-6 text-sm font-semibold text-[color:var(--muted)] transition hover:text-text-primary">
                    Back
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

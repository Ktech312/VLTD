"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createProfile, getOnboardingStatus } from "@/lib/auth";
import { clearOnboardingDraft, loadOnboardingDraft, saveOnboardingDraft } from "@/lib/onboardingDraft";

const FOCUS_OPTIONS = ["Sports Cards", "TCG", "Comics", "Toys", "Memorabilia", "Watches", "Mixed Collection"];

function slugifyUsername(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
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
      <main className="vltd-page-depth min-h-screen px-4 py-8 text-[color:var(--fg)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-[28px] border border-[color:var(--border)] bg-[rgba(15,29,49,0.82)] p-6 text-[color:var(--muted)] shadow-[0_22px_72px_rgba(0,0,0,0.24)]">
          Loading onboarding...
        </div>
      </main>
    );
  }

  return (
    <main className="vltd-page-depth min-h-screen px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <section className="relative overflow-hidden rounded-[34px] border border-[rgba(82,214,244,0.30)] bg-[linear-gradient(180deg,rgba(18,38,66,0.92),rgba(8,18,32,0.94))] p-5 shadow-[0_26px_86px_rgba(82,214,244,0.10),0_24px_88px_rgba(0,0,0,0.32)] sm:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(82,214,244,0.14),transparent_30%),radial-gradient(circle_at_82%_8%,rgba(245,170,60,0.08),transparent_28%)]" />

          <div className="relative">
            <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)]">
              Welcome to VLTD
            </div>
            <h1 className="mt-3 text-4xl font-black leading-[0.98] tracking-[-0.055em] text-white sm:text-5xl">
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
                    step >= n ? "bg-[#52d6f4] shadow-[0_0_18px_rgba(82,214,244,0.28)]" : "bg-[rgba(104,146,196,0.18)]",
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
                  <span className="text-sm font-semibold text-white">Display name</span>
                  <input
                    value={displayName}
                    onChange={(e) => {
                      const next = e.target.value;
                      setDisplayName(next);
                      if (!username.trim()) setUsername(slugifyUsername(next));
                    }}
                    className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[rgba(9,20,36,0.82)] px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(82,214,244,0.12)]"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-white">Username</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(slugifyUsername(e.target.value))}
                    className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[rgba(9,20,36,0.82)] px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(82,214,244,0.12)]"
                  />
                  <div className="mt-2 text-xs text-[color:var(--muted2)]">Public handle preview: @{slugifyUsername(username) || "username"}</div>
                </label>

                <button
                  type="button"
                  disabled={!canContinueIdentity}
                  onClick={() => setStep(2)}
                  className="inline-flex h-12 w-fit items-center rounded-full bg-[#52d6f4] px-6 text-sm font-black text-[#06101d] shadow-[0_16px_42px_rgba(82,214,244,0.20)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="mt-7 space-y-5">
                <div>
                  <div className="text-sm font-semibold text-white">Account type</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setProfileType("personal")}
                      className={[
                        "rounded-2xl border p-5 text-left transition",
                        profileType === "personal"
                          ? "border-[rgba(82,214,244,0.42)] bg-[rgba(82,214,244,0.12)] text-white"
                          : "border-[color:var(--border)] bg-[rgba(7,16,31,0.42)] text-[color:var(--muted)] hover:text-white",
                      ].join(" ")}
                    >
                      <div className="text-base font-black">Collector</div>
                      <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">Personal vault, portfolio, and public galleries.</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProfileType("business")}
                      className={[
                        "rounded-2xl border p-5 text-left transition",
                        profileType === "business"
                          ? "border-[rgba(82,214,244,0.42)] bg-[rgba(82,214,244,0.12)] text-white"
                          : "border-[color:var(--border)] bg-[rgba(7,16,31,0.42)] text-[color:var(--muted)] hover:text-white",
                      ].join(" ")}
                    >
                      <div className="text-base font-black">Business</div>
                      <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">Shop, team, resale, or inventory workflow.</div>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => setStep(3)} className="inline-flex h-12 items-center rounded-full bg-[#52d6f4] px-6 text-sm font-black text-[#06101d] shadow-[0_16px_42px_rgba(82,214,244,0.20)] transition hover:-translate-y-0.5 hover:brightness-105">
                    Continue
                  </button>
                  <button type="button" onClick={() => setStep(1)} className="inline-flex h-12 items-center rounded-full border border-[color:var(--border)] bg-[rgba(7,16,31,0.42)] px-6 text-sm font-semibold text-[color:var(--muted)] transition hover:text-white">
                    Back
                  </button>
                </div>
              </div>
            ) : null}

            {step === 3 ? (
              <div className="mt-7 space-y-5">
                <label className="block">
                  <span className="text-sm font-semibold text-white">Primary collection focus</span>
                  <select
                    value={primaryFocus}
                    onChange={(e) => setPrimaryFocus(e.target.value)}
                    className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[rgba(9,20,36,0.82)] px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(82,214,244,0.12)]"
                  >
                    <option value="">Skip for now</option>
                    {FOCUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </label>

                <div className="rounded-2xl border border-[color:var(--border)] bg-[rgba(7,16,31,0.48)] p-5 text-sm leading-7 text-[color:var(--muted)]">
                  <div><span className="text-[color:var(--muted2)]">Username:</span> <span className="font-semibold text-white">@{slugifyUsername(username)}</span></div>
                  <div><span className="text-[color:var(--muted2)]">Display name:</span> <span className="font-semibold text-white">{displayName.trim()}</span></div>
                  <div><span className="text-[color:var(--muted2)]">Account type:</span> <span className="font-semibold text-white">{profileType === "business" ? "Business" : "Collector"}</span></div>
                  <div><span className="text-[color:var(--muted2)]">Focus:</span> <span className="font-semibold text-white">{primaryFocus || "Not set yet"}</span></div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={saving || !canContinueIdentity}
                    onClick={() => void handleFinish()}
                    className="inline-flex h-12 items-center rounded-full bg-[#52d6f4] px-6 text-sm font-black text-[#06101d] shadow-[0_16px_42px_rgba(82,214,244,0.20)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Finishing..." : "Finish setup"}
                  </button>
                  <button type="button" onClick={() => setStep(2)} className="inline-flex h-12 items-center rounded-full border border-[color:var(--border)] bg-[rgba(7,16,31,0.42)] px-6 text-sm font-semibold text-[color:var(--muted)] transition hover:text-white">
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

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

  if (loading) return <main className="min-h-screen bg-[color:var(--bg)] px-4 py-12 text-[color:var(--fg)]"><div className="mx-auto max-w-2xl rounded-[24px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)]">Loading onboarding...</div></main>;

  return (
    <main className="min-h-screen bg-[color:var(--bg)] px-4 py-8 text-[color:var(--fg)] sm:px-6">
      <div className="mx-auto max-w-2xl rounded-[28px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:p-8">
        <div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">Welcome to VLTD</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Let’s get you in fast</h1>
        <p className="mt-2 text-sm text-[color:var(--muted)]">Minimal setup now. Richer profile data later.</p>
        <div className="mt-6 flex gap-2">{[1,2,3].map((n)=><div key={n} className={["h-2 flex-1 rounded-full", step>=n?"bg-[color:var(--pill-active-bg)]":"bg-[color:var(--pill)]"].join(" ")} />)}</div>
        {error ? <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
        {step===1 ? <div className="mt-6 space-y-4"><div><div className="text-sm font-medium">Display name</div><input value={displayName} onChange={(e)=>{ const next=e.target.value; setDisplayName(next); if(!username.trim()) setUsername(slugifyUsername(next)); }} className="mt-2 h-12 w-full rounded-2xl bg-[color:var(--input)] px-4 ring-1 ring-[color:var(--border)] outline-none" /></div><div><div className="text-sm font-medium">Username</div><input value={username} onChange={(e)=>setUsername(slugifyUsername(e.target.value))} className="mt-2 h-12 w-full rounded-2xl bg-[color:var(--input)] px-4 ring-1 ring-[color:var(--border)] outline-none" /></div><button type="button" disabled={!canContinueIdentity} onClick={()=>setStep(2)} className="inline-flex h-11 items-center rounded-full bg-[color:var(--pill-active-bg)] px-5 text-sm font-semibold text-[color:var(--fg)] disabled:opacity-40">Continue</button></div> : null}
        {step===2 ? <div className="mt-6 space-y-4"><div className="text-sm font-medium">Account type</div><div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={()=>setProfileType("personal")} className={["rounded-2xl p-4 text-left ring-1", profileType==="personal"?"bg-[color:var(--pill-active-bg)] ring-[color:var(--pill-active-bg)]":"bg-[color:var(--pill)] ring-[color:var(--border)]"].join(" ")}>Collector</button><button type="button" onClick={()=>setProfileType("business")} className={["rounded-2xl p-4 text-left ring-1", profileType==="business"?"bg-[color:var(--pill-active-bg)] ring-[color:var(--pill-active-bg)]":"bg-[color:var(--pill)] ring-[color:var(--border)]"].join(" ")}>Business</button></div><div><button type="button" onClick={()=>setStep(3)} className="inline-flex h-11 items-center rounded-full bg-[color:var(--pill-active-bg)] px-5 text-sm font-semibold text-[color:var(--fg)]">Continue</button><button type="button" onClick={()=>setStep(1)} className="ml-2 inline-flex h-11 items-center rounded-full bg-[color:var(--pill)] px-5 text-sm font-medium ring-1 ring-[color:var(--border)]">Back</button></div></div> : null}
        {step===3 ? <div className="mt-6 space-y-4"><div><div className="text-sm font-medium">Primary collection focus</div><select value={primaryFocus} onChange={(e)=>setPrimaryFocus(e.target.value)} className="mt-2 h-12 w-full rounded-2xl bg-[color:var(--input)] px-4 ring-1 ring-[color:var(--border)] outline-none"><option value="">Skip for now</option>{FOCUS_OPTIONS.map((o)=><option key={o} value={o}>{o}</option>)}</select></div><div className="rounded-2xl bg-[color:var(--pill)] p-4 ring-1 ring-[color:var(--border)] text-sm">Username: @{slugifyUsername(username)}<br/>Display name: {displayName.trim()}<br/>Account type: {profileType === "business" ? "Business" : "Collector"}<br/>Focus: {primaryFocus || "Not set yet"}</div><div><button type="button" disabled={saving || !canContinueIdentity} onClick={()=>void handleFinish()} className="inline-flex h-11 items-center rounded-full bg-[color:var(--pill-active-bg)] px-5 text-sm font-semibold text-[color:var(--fg)] disabled:opacity-40">{saving ? "Finishing..." : "Finish setup"}</button><button type="button" onClick={()=>setStep(2)} className="ml-2 inline-flex h-11 items-center rounded-full bg-[color:var(--pill)] px-5 text-sm font-medium ring-1 ring-[color:var(--border)]">Back</button></div></div> : null}
      </div>
    </main>
  );
}

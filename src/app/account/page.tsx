"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getOnboardingStatus, updateProfile } from "@/lib/auth";

export default function AccountPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profileId, setProfileId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [profileType, setProfileType] = useState<"personal" | "business">("personal");
  const [primaryFocus, setPrimaryFocus] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const status = await getOnboardingStatus();
        if (!status.isAuthenticated) {
          router.replace("/login");
          return;
        }
        if (status.needsOnboarding || !status.activeProfile) {
          router.replace("/onboarding");
          return;
        }
        setProfileId(status.activeProfile.id);
        setDisplayName(status.activeProfile.display_name ?? "");
        setUsername(status.activeProfile.username ?? "");
        setProfileType(status.activeProfile.profile_type ?? "personal");
        setPrimaryFocus(String(status.activeProfile.primary_focus ?? ""));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load account.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [router]);

  async function handleSave() {
    if (!profileId) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await updateProfile(profileId, { display_name: displayName, username, profile_type: profileType, primary_focus: primaryFocus });
      setSuccess("Account updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save account.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="min-h-screen bg-[color:var(--bg)] px-4 py-10 text-[color:var(--fg)]"><div className="mx-auto max-w-3xl rounded-[24px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)]">Loading account...</div></main>;

  return <main className="min-h-screen bg-[color:var(--bg)] px-4 py-8 text-[color:var(--fg)] sm:px-6"><div className="mx-auto max-w-3xl rounded-[28px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] sm:p-8"><div className="text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted2)]">Account</div><h1 className="mt-2 text-3xl font-semibold tracking-tight">Account settings</h1>{error ? <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}{success ? <div className="mt-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{success}</div> : null}<div className="mt-6 grid gap-4"><input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} placeholder="Display name" className="h-12 w-full rounded-2xl bg-[color:var(--input)] px-4 ring-1 ring-[color:var(--border)] outline-none" /><input value={username} onChange={(e)=>setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, "_"))} placeholder="Username" className="h-12 w-full rounded-2xl bg-[color:var(--input)] px-4 ring-1 ring-[color:var(--border)] outline-none" /><select value={profileType} onChange={(e)=>setProfileType(e.target.value === "business" ? "business" : "personal")} className="h-12 w-full rounded-2xl bg-[color:var(--input)] px-4 ring-1 ring-[color:var(--border)] outline-none"><option value="personal">Collector</option><option value="business">Business</option></select><input value={primaryFocus} onChange={(e)=>setPrimaryFocus(e.target.value)} placeholder="Primary focus" className="h-12 w-full rounded-2xl bg-[color:var(--input)] px-4 ring-1 ring-[color:var(--border)] outline-none" /></div><div className="mt-6"><button type="button" disabled={saving} onClick={()=>void handleSave()} className="inline-flex h-11 items-center rounded-full bg-[color:var(--pill-active-bg)] px-5 text-sm font-semibold text-[color:var(--fg)] disabled:opacity-40">{saving ? "Saving..." : "Save changes"}</button></div></div></main>;
}

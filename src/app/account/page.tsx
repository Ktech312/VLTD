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
      await updateProfile(profileId, {
        display_name: displayName,
        username,
        profile_type: profileType,
        primary_focus: primaryFocus,
      });
      setSuccess("Account updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save account.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="vltd-page-depth min-h-screen px-4 py-8 text-[color:var(--fg)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-[28px] border border-[color:var(--border)] bg-[rgba(15,29,49,0.82)] p-6 text-[color:var(--muted)] shadow-[0_22px_72px_rgba(0,0,0,0.24)]">
          Loading account...
        </div>
      </main>
    );
  }

  return (
    <main className="vltd-page-depth min-h-screen px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <section className="relative overflow-hidden rounded-[34px] border border-[rgba(82,214,244,0.30)] bg-[linear-gradient(180deg,rgba(18,38,66,0.92),rgba(8,18,32,0.94))] p-5 shadow-[0_26px_86px_rgba(82,214,244,0.10),0_24px_88px_rgba(0,0,0,0.32)] sm:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(82,214,244,0.14),transparent_30%),radial-gradient(circle_at_82%_8%,rgba(245,170,60,0.08),transparent_28%)]" />

          <div className="relative grid gap-7 lg:grid-cols-[1fr_340px]">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)]">
                Account
              </div>
              <h1 className="mt-3 text-4xl font-black leading-[0.98] tracking-[-0.055em] text-white sm:text-5xl">
                Account settings
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-[color:var(--muted)]">
                Keep your collector identity, workspace type, and primary focus aligned across VLTD.
              </p>

              {error ? (
                <div className="mt-5 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}
              {success ? (
                <div className="mt-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
                  {success}
                </div>
              ) : null}

              <div className="mt-6 grid gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-white">Display name</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Display name"
                    className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[rgba(9,20,36,0.82)] px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(82,214,244,0.12)]"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-white">Username</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, "_"))}
                    placeholder="Username"
                    className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[rgba(9,20,36,0.82)] px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(82,214,244,0.12)]"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setProfileType("personal")}
                    className={[
                      "rounded-2xl border p-4 text-left transition",
                      profileType === "personal"
                        ? "border-[rgba(82,214,244,0.42)] bg-[rgba(82,214,244,0.12)] text-white"
                        : "border-[color:var(--border)] bg-[rgba(7,16,31,0.42)] text-[color:var(--muted)] hover:text-white",
                    ].join(" ")}
                  >
                    <div className="text-sm font-black">Collector</div>
                    <div className="mt-1 text-xs leading-5 text-[color:var(--muted)]">Personal vault and gallery.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileType("business")}
                    className={[
                      "rounded-2xl border p-4 text-left transition",
                      profileType === "business"
                        ? "border-[rgba(82,214,244,0.42)] bg-[rgba(82,214,244,0.12)] text-white"
                        : "border-[color:var(--border)] bg-[rgba(7,16,31,0.42)] text-[color:var(--muted)] hover:text-white",
                    ].join(" ")}
                  >
                    <div className="text-sm font-black">Business</div>
                    <div className="mt-1 text-xs leading-5 text-[color:var(--muted)]">Shop, team, or inventory workflow.</div>
                  </button>
                </div>

                <label className="block">
                  <span className="text-sm font-semibold text-white">Primary focus</span>
                  <input
                    value={primaryFocus}
                    onChange={(e) => setPrimaryFocus(e.target.value)}
                    placeholder="Primary focus"
                    className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] bg-[rgba(9,20,36,0.82)] px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(82,214,244,0.12)]"
                  />
                </label>
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className="inline-flex h-12 items-center rounded-full bg-[#52d6f4] px-6 text-sm font-black text-[#06101d] shadow-[0_16px_42px_rgba(82,214,244,0.20)] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>

            <aside className="rounded-[28px] border border-[color:var(--border)] bg-[rgba(7,16,31,0.48)] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.30em] text-[color:var(--muted2)]">
                Profile Summary
              </div>
              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-[color:var(--border)] bg-[rgba(9,20,36,0.70)] p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">Name</div>
                  <div className="mt-1 font-black text-white">{displayName || "Not set"}</div>
                </div>
                <div className="rounded-2xl border border-[color:var(--border)] bg-[rgba(9,20,36,0.70)] p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">Handle</div>
                  <div className="mt-1 font-black text-white">@{username || "username"}</div>
                </div>
                <div className="rounded-2xl border border-[color:var(--border)] bg-[rgba(9,20,36,0.70)] p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">Type</div>
                  <div className="mt-1 font-black text-white">{profileType === "business" ? "Business" : "Collector"}</div>
                </div>
                <div className="rounded-2xl border border-[color:var(--border)] bg-[rgba(9,20,36,0.70)] p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">Focus</div>
                  <div className="mt-1 font-black text-white">{primaryFocus || "Not set"}</div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

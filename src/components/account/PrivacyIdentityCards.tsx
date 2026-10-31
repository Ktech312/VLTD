"use client";

import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { Toggle } from "@/components/ui/Toggle";
import { useEffect, useMemo, useState } from "react";

import { Glyph } from "@/components/ui/Glyph";
import { PillButton } from "@/components/ui/PillButton";
import { getOnboardingStatus, updateProfile } from "@/lib/auth";
import { syncPublicProfile } from "@/lib/publicProfile";
import { showToast } from "@/lib/toast";

// Moved here from the main Account page so age verification and profile visibility live under
// Privacy and security. Behaviour is unchanged: the age check is self-declared, not government ID.

function computeAge(dobStr: string) {
  if (!dobStr) return null;
  const d = new Date(dobStr);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  if (age < 0 || age > 120) return null;
  return age;
}

const sectionClass = "mt-6 rounded-[9px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)]";
const labelClass = "text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)] px-1";

export default function PrivacyIdentityCards() {
  const [profileId, setProfileId] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [dob, setDob] = useState("");
  const [ageVerified, setAgeVerified] = useState(false);
  const [savedAgeVerified, setSavedAgeVerified] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const status = await getOnboardingStatus();
        if (!active || !status.activeProfile) return;
        setProfileId(status.activeProfile.id);
        setIsPublic(status.activeProfile.is_public !== false);
        setDob(status.activeProfile.date_of_birth ?? "");
        setAgeVerified(Boolean(status.activeProfile.age_verified));
        setSavedAgeVerified(Boolean(status.activeProfile.age_verified));
        setMarketingOptIn(status.activeProfile.marketing_opt_in !== false);
      } finally {
        if (active) setLoaded(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const age = useMemo(() => computeAge(dob), [dob]);
  const canVerifyAge = age !== null && age >= 18;

  async function handleSave() {
    if (!profileId) return;
    setSaving(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const nextAgeVerified = ageVerified && canVerifyAge;
      await updateProfile(profileId, {
        date_of_birth: dob || null,
        age_verified: nextAgeVerified,
        marketing_opt_in: marketingOptIn,
      });
      setAgeVerified(nextAgeVerified);
      setSavedAgeVerified(nextAgeVerified);
      void syncPublicProfile(profileId);
      setMessage("Saved.");
    } catch (err) {
      setMessageIsError(true);
      setMessage(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(""), 3000);
    }
  }

  if (!loaded) {
    return <div className={sectionClass + " text-sm text-[color:var(--muted)]"}>Loading privacy settings…</div>;
  }

  return (
    <>
      <section className={sectionClass}>
        <div className={labelClass + " mb-4"}>Privacy</div>
        <div className="flex items-start justify-between gap-4 rounded-[14px] border border-[color:var(--border)] p-4" style={{ background: "var(--theme-card)" }}>
          <div className="flex-1">
            <div className="text-sm font-black text-text-primary">Public profile</div>
            <div className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
              Your vault and exhibitions are visible to other collectors. Turn this off to go incognito — your profile disappears from search and the Discover feed.
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ring-[color:var(--frame-ring)]" style={{ background: "var(--pill-active-bg)", color: "var(--theme-gold, #C8CDD2)" }}>
              <AppIcon name="sparkle" size={12} /> Paid feature — coming soon
            </div>
          </div>
          <Toggle on={isPublic} onChange={() => {}} disabled title="Going incognito is a paid feature" ariaLabel="Public profile" className="mt-0.5" />
        </div>
      </section>

      <section className={sectionClass}>
        <div className={labelClass + " mb-1"}>Age verification</div>
        <p className="px-1 mb-4 text-xs text-[color:var(--muted)]">
          Age verification is self-declared (you enter your birthdate) — not government ID verification.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-text-primary">Date of birth</span>
            <input
              type="date"
              value={dob}
              onChange={(e) => {
                setDob(e.target.value);
                const nextAge = computeAge(e.target.value);
                if (nextAge === null || nextAge < 18) setAgeVerified(false);
              }}
              className="mt-2 h-12 w-full rounded-[14px] border border-[color:var(--border)] px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(203,208,213,0.12)]"
              style={{ background: "var(--theme-card)" }}
            />
            <span className="mt-1 block text-xs text-[color:var(--muted2)]">
              {age === null ? "Enter a valid date." : `Computed age: ${age}`}
            </span>
          </label>

          <div>
            <span className="text-sm font-semibold text-text-primary">Age verification</span>
            <p className="mt-0.5 text-xs text-[color:var(--muted2)]">
              {canVerifyAge ? "Eligible to verify." : "Not eligible yet — enter a valid DOB and be 18+."}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <PillButton
                variant={canVerifyAge ? "active" : "default"}
                onClick={() => {
                  if (!canVerifyAge) {
                    showToast("Must be 18+ with a valid DOB to verify.");
                    return;
                  }
                  setAgeVerified(true);
                }}
                disabled={!canVerifyAge}
              >
                {ageVerified ? <span className="inline-flex items-center gap-1">Verified <Glyph name="check" size={13} /></span> : "Verify Age"}
              </PillButton>
              {ageVerified ? (
                <PillButton onClick={() => setAgeVerified(false)} className="bg-red-500/10 text-red-200 ring-red-400/20 hover:bg-red-500/15">
                  Remove Verification
                </PillButton>
              ) : null}
            </div>
            {ageVerified !== savedAgeVerified ? (
              <p data-testid="age-unsaved-note" className="mt-2 text-xs text-[color:var(--muted2)]">
                {ageVerified ? "Not saved yet. Press Save to keep the verification." : "Not saved yet. Press Save to remove the verification."}
              </p>
            ) : null}
          </div>
        </div>

        <label className="mt-5 flex items-center gap-3 text-sm">
          <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} />
          Receive product updates
        </label>

        <div className="mt-5 flex items-center gap-4">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="inline-flex h-11 items-center rounded-[8px] px-6 text-sm font-black text-[#0B0B0B] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 md:h-9"
            style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)", color: "#0B0B0B" }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {message ? <span className={`text-sm ${messageIsError ? "text-red-300" : "text-emerald-400"}`}>{message}</span> : null}
        </div>
      </section>
    </>
  );
}

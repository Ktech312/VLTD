"use client";
// NOTE: primaryFocus uses taxonomy universe keys for personalisation

import { AppIcon, type AppIconName } from "@/components/ui/AppIcon";
import { Toggle } from "@/components/ui/Toggle";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ThemePicker } from "@/components/ui/ThemePicker";
import { PillButton } from "@/components/ui/PillButton";
import { Glyph, universeGlyphName } from "@/components/ui/Glyph";
import { AccountTabs } from "@/components/account/AccountTabs";

import { getOnboardingStatus, updateProfile } from "@/lib/auth";
import { USERNAME_TAKEN_MESSAGE, isUsernameTakenError } from "@/lib/friendlyError";
import { displayNameProblem, usernameProblem } from "@/lib/profileRules";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { syncPublicProfile } from "@/lib/publicProfile";
import { getPendingVaultSyncCount, processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import { loadItems, syncVaultItemsFromSupabase } from "@/lib/vaultModel";
import { exportVaultJson } from "@/lib/vaultExport";
import { countVaultItemsInSupabase, hasSupabaseEnv } from "@/lib/vaultCloud";
import { UNIVERSE_KEYS, UNIVERSE_LABEL, isUniverseKey } from "@/lib/taxonomy";
import { getProfileSafe, setProfileSafe, broadcastProfileChange } from "@/lib/userProfile";
import { showToast } from "@/lib/toast";
import { isPushSupported, getPushSubscriptionState, subscribeToPush, unsubscribeFromPush, type PushState } from "@/lib/pushNotifications";
import { resolveAvatarSrc } from "@/lib/avatarResolve";
import { readUniversePrefs, saveCollectionInterests, saveDisplayedUniverses } from "@/lib/universePrefs";
import type { UniverseKey } from "@/lib/taxonomy";

/** Normalize a stored focus value — treats the literal string "null" as empty. */
function normalizeFocus(value: unknown): string {
  const s = String(value ?? "").trim();
  return s && s.toLowerCase() !== "null" ? s : "";
}
import { migrateExistingVaultImagesToSupabase } from "@/lib/vaultMigration";
import { prepareImageBlob } from "@/lib/vaultImageStore";

export default function AccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Settings categories on this page: profile (default), preferences, contact, data.
  const rawSection = searchParams.get("section");
  const section = rawSection === "preferences" || rawSection === "contact" || rawSection === "data" ? rawSection : "profile";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [profileId, setProfileId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [savedUsername, setSavedUsername] = useState("");
  const [profileType, setProfileType] = useState<"personal" | "business">("personal");
  const [primaryFocus, setPrimaryFocus] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [syncStatus, setSyncStatus] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  // EK's ask (2026-09-18): a small, quiet local-vs-cloud check right on this
  // page — not its own page, not a banner, not buried in "More." Deliberately
  // separate from the "Vault Maintenance" section's own Sync Now below (that
  // one only retries what's already queued; this checks for the case where
  // an item silently failed server-side and was never queued at all — the
  // gap the enforce_vault_item_limit() trigger bug exposed).
  const [localItemCount, setLocalItemCount] = useState<number | null>(null);
  const [cloudItemCount, setCloudItemCount] = useState<number | null>(null);
  const [miniSyncBusy, setMiniSyncBusy] = useState(false);
  const [miniSyncMsg, setMiniSyncMsg] = useState("");
  // Contact info
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("US");
  const [contactSaving, setContactSaving] = useState(false);
  const [contactSuccess, setContactSuccess] = useState("");
  // Collection interests (Profile) and Universes displayed (Preferences) are two separate settings.
  const [focusedUniverses, setFocusedUniverses] = useState<string[]>([]);
  const [displayedUniverses, setDisplayedUniverses] = useState<string[]>([]);
  const [showAllUniverses, setShowAllUniverses] = useState(false);
  const [universeFocusSaving, setUniverseFocusSaving] = useState(false);
  const [universeFocusSuccess, setUniverseFocusSuccess] = useState("");
  // Avatar (emoji and uploaded image are both real/synced via profiles.avatar_emoji/avatar_url)
  const [avatarMode, setAvatarMode] = useState<"EMOJI" | "IMAGE">("EMOJI");
  const [avatarEmoji, setAvatarEmoji] = useState("🗝️");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState("");
  // Push notifications
  const [pushState, setPushState] = useState<PushState>("unsupported");
  const [pushBusy, setPushBusy] = useState(false);

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
        setSavedUsername(status.activeProfile.username ?? "");
        setProfileType(status.activeProfile.profile_type ?? "personal");
        setPrimaryFocus(normalizeFocus(status.activeProfile.primary_focus));
        setBio(String(status.activeProfile.bio ?? ""));
        setIsPublic(status.activeProfile.is_public !== false);
        setFullName(status.activeProfile.full_name ?? "");
        setPhone(status.activeProfile.phone ?? "");
        setAddressLine1(status.activeProfile.address_line1 ?? "");
        setAddressLine2(status.activeProfile.address_line2 ?? "");
        setCity(status.activeProfile.city ?? "");
        setStateVal(status.activeProfile.state ?? "");
        setZip(status.activeProfile.zip ?? "");
        setCountry(status.activeProfile.country ?? "US");
        // Two separate saved settings (see lib/universePrefs.ts): what you collect, and which universes are displayed.
        const prefs = readUniversePrefs(status.activeProfile as unknown as Record<string, unknown>);
        setFocusedUniverses(prefs.interests);
        setDisplayedUniverses(prefs.displayed ?? []);
        setShowAllUniverses(prefs.displayed === null);

        // Avatar emoji + uploaded image are both real (profiles table) --
        // whichever one is actually set wins; "mode" here just remembers
        // which tab to show, not a separate source of truth. avatar_url
        // used to be local-only (a data: URL cached in this browser only);
        // it's real now, so it's loaded from the profile like everything
        // else, not a local cache.
        const localProfile = getProfileSafe();
        setAvatarUrl(status.activeProfile.avatar_url ?? "");
        setAvatarMode(status.activeProfile.avatar_url ? "IMAGE" : localProfile.avatarMode);
        setAvatarEmoji(status.activeProfile.avatar_emoji || localProfile.avatarEmoji || "🗝️");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load account.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [router]);

  useEffect(() => {
    if (!isPushSupported()) {
      setPushState("unsupported");
      return;
    }
    void getPushSubscriptionState().then(setPushState);
  }, []);

  async function handleTogglePush() {
    if (pushBusy || !profileId) return;
    setPushBusy(true);
    try {
      if (pushState === "subscribed") {
        const ok = await unsubscribeFromPush();
        if (ok) setPushState("unsubscribed");
      } else {
        const ok = await subscribeToPush(profileId);
        setPushState(ok ? "subscribed" : await getPushSubscriptionState());
      }
    } finally {
      setPushBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function loadCounts() {
      // Scoped to the active profile only — matching fetchVaultItemsFromSupabase's
      // own default scope below. getAllLocalItems() (the original version of
      // this) counts every profile stored on this device, which never matched
      // the cloud count for anyone with more than one local profile, regardless
      // of whether sync was actually working.
      setLocalItemCount(loadItems().length);
      if (!hasSupabaseEnv()) return;
      try {
        // A count only: this page used to download every item in the vault (about 5 MB) just to count them.
        const cloudCount = await countVaultItemsInSupabase();
        if (active) setCloudItemCount(cloudCount);
      } catch {
        if (active) setCloudItemCount(null);
      }
    }
    void loadCounts();
    return () => { active = false; };
  }, []);

  async function handleMiniSync() {
    if (miniSyncBusy) return;
    setMiniSyncBusy(true);
    setMiniSyncMsg("");
    try {
      const pendingBefore = getPendingVaultSyncCount();
      const r = await processVaultSyncQueue();
      setLocalItemCount(loadItems().length);
      if (hasSupabaseEnv()) {
        try {
          setCloudItemCount(await countVaultItemsInSupabase());
        } catch {
          setCloudItemCount(null);
        }
      }
      setMiniSyncMsg(
        r.remaining > 0
          ? `${r.remaining} still pending.`
          : pendingBefore > 0
            ? "Pending changes synced."
            : "No pending changes to upload."
      );
    } catch (e) {
      setMiniSyncMsg(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setMiniSyncBusy(false);
    }
  }

  async function handleSyncNow() {
    setIsSyncing(true);
    setSyncStatus("Syncing...");
    try {
      await processVaultSyncQueue();
      await syncVaultItemsFromSupabase();
      setSyncStatus("Sync complete.");
    } catch (err) {
      setSyncStatus(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleRepairMigrate() {
    setIsMigrating(true);
    setSyncStatus("Migrating local-only images to Supabase...");
    try {
      const result = await migrateExistingVaultImagesToSupabase();
      await processVaultSyncQueue();
      await syncVaultItemsFromSupabase();
      setSyncStatus(`Migration finished. ${result.migrated} migrated, ${result.skipped} skipped.`);
    } catch (err) {
      setSyncStatus(err instanceof Error ? err.message : "Migration failed.");
    } finally {
      setIsMigrating(false);
    }
  }

  useEffect(() => {
    // Scroll to anchor if URL has a hash (e.g. #profile-setup)
    if (window.location.hash) {
      const target = document.getElementById(window.location.hash.slice(1));
      if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
    }
  }, []);

  async function handleSave() {
    if (!profileId) return;
    setError("");
    setSuccess("");
    // Nothing is sent until the name and username are acceptable, so a refused save never looks like a saved one.
    const problem = displayNameProblem(displayName) ?? (username !== savedUsername ? usernameProblem(username) : null);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      await updateProfile(profileId, {
        display_name: displayName,
        username,
        primary_focus: primaryFocus,
        bio: bio || null,
        is_public: isPublic,
      });
      // Collection interests save on their own; they never change which universes are displayed.
      try {
        await saveCollectionInterests(profileId, focusedUniverses as UniverseKey[]);
      } catch (interestsError) {
        setError(
          "Your profile was saved, but your collection interests could not be saved yet: " +
            (interestsError instanceof Error ? interestsError.message : "unknown error")
        );
      }
      void syncPublicProfile(profileId);
      setSavedUsername(username.trim());
      setSuccess("Account updated.");
      router.refresh();
    } catch (err) {
      setError(isUsernameTakenError(err) ? USERNAME_TAKEN_MESSAGE : err instanceof Error ? err.message : "Failed to save account.");
    } finally {
      setSaving(false);
    }
  }

  async function handleContactSave() {
    if (!profileId) return;
    setContactSaving(true);
    setContactSuccess("");
    try {
      await updateProfile(profileId, {
        full_name: fullName,
        phone,
        address_line1: addressLine1,
        address_line2: addressLine2,
        city,
        state: stateVal,
        zip,
        country,
      });
      setContactSuccess("Contact info saved.");
    } catch (err) {
      setContactSuccess(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setContactSaving(false);
      setTimeout(() => setContactSuccess(""), 3000);
    }
  }

  async function handleUniverseFocusSave() {
    if (!profileId) return;
    setUniverseFocusSaving(true);
    setUniverseFocusSuccess("");
    try {
      const val = showAllUniverses ? null : (displayedUniverses.length > 0 ? (displayedUniverses as UniverseKey[]) : null);
      await saveDisplayedUniverses(profileId, val);
      // The Vault remembers its own copy on this device; refresh it so the change shows there right away.
      try {
        window.localStorage.removeItem("vltd_visible_universe_chips");
      } catch {
        /* storage blocked: the Vault simply reloads the saved setting */
      }
      setUniverseFocusSuccess("Saved.");
    } catch (err) {
      setUniverseFocusSuccess(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setUniverseFocusSaving(false);
      setTimeout(() => setUniverseFocusSuccess(""), 3000);
    }
  }

  const avatarUploadRef = useRef<HTMLInputElement | null>(null);

  async function handleAvatarSave() {
    if (!profileId) return;
    setAvatarSaving(true);
    setAvatarSuccess("");
    try {
      // Only "mode" (which tab was open) is worth caching locally now --
      // the emoji and the uploaded image URL are both real, synced via
      // profiles.avatar_emoji/avatar_url below.
      setProfileSafe({ ...getProfileSafe(), avatarMode });
      broadcastProfileChange();
      await updateProfile(profileId, {
        avatar_emoji: avatarEmoji,
        // Explicit null when on the Emoji tab -- clears a previously
        // uploaded image so the emoji actually takes over everywhere else
        // in the app (resolveAvatarSrc prefers avatar_url over avatar_emoji
        // whenever avatar_url is set at all).
        avatar_url: avatarMode === "IMAGE" ? avatarUrl || null : null,
      });
      void syncPublicProfile(profileId);
      setAvatarSuccess("Saved.");
    } catch (err) {
      setAvatarSuccess(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setAvatarSaving(false);
      setTimeout(() => setAvatarSuccess(""), 3000);
    }
  }

  function clearLocalCache() {
    if (
      !confirm(
        "This clears cached display preferences on this device only (theme frame, plan cache, palette, spreadsheet link, avatar image) and reloads them from your account. It does NOT delete your vault or account data. Continue?"
      )
    ) {
      return;
    }
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("vltd_profile_v1");
    window.localStorage.removeItem("vltd_frame_style");
    window.localStorage.removeItem("vltd_tier");
    window.localStorage.removeItem("vltd_palette");
    window.localStorage.removeItem("vltd_google_sheet_id_v1");
    broadcastProfileChange();
    showToast("Cleared local cache. Refresh the page.");
  }

  if (loading) {
    return (
      <main className="px-4 py-8 text-[color:var(--fg)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-[9px] border border-[color:var(--border)] p-6 text-[color:var(--muted)] shadow-[0_22px_72px_rgba(0,0,0,0.24)]" style={{ background: "var(--theme-card)" }}>
          Loading account...
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <AccountTabs />

        {section === "profile" ? (
        <section
          id="profile-setup"
          className="relative -mt-px overflow-hidden rounded-[34px] rounded-tl-none p-5 sm:p-7"
          style={{
            background: 'var(--theme-elevated, rgba(20,32,55,0.9))',
            border: '1px solid var(--theme-gold-border, rgba(203,208,213,0.25))',
            boxShadow: '0 26px 86px rgba(0,0,0,0.32)',
          }}
        >
          <div className="relative grid gap-7 lg:grid-cols-[1fr_340px]">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)]">
                Profile
              </div>
              <h1 className="mt-3 text-3xl font-black leading-[1.05] tracking-[-0.04em] text-text-primary sm:text-4xl">
                Your profile
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
                  <span className="text-sm font-semibold text-text-primary">Display name</span>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Display name"
                    className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(203,208,213,0.12)]"
                    style={{ background: "var(--theme-card)" }}
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-text-primary">Username</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, "_"))}
                    placeholder="Username"
                    className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(203,208,213,0.12)]"
                    style={{ background: "var(--theme-card)" }}
                  />
                </label>

                <div className="rounded-2xl border border-[color:var(--border)] p-4" style={{ background: "var(--theme-card)" }}>
                  <div className="text-sm font-black text-text-primary">
                    {profileType === "business" ? "Business profile" : "Personal profile"}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
                    {profileType === "business"
                      ? "This profile is a separate business workspace."
                      : "Every VLTD member keeps a personal profile. Add a separate business profile whenever you need one."}
                  </div>
                  {profileType === "personal" ? (
                    <Link href="/account/business/new" className="mt-3 inline-flex h-9 items-center rounded-[8px] px-3 text-xs font-semibold ring-1 ring-[color:var(--border)]">
                      + Add business profile
                    </Link>
                  ) : null}
                </div>

                <div>
                  <span className="text-sm font-semibold text-text-primary">Collection interests</span>
                  <p className="mt-0.5 text-xs text-[color:var(--muted2)]">
                    Used to personalise your Discover feed — pick every universe you focus on. Your first pick is your primary.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {UNIVERSE_KEYS.map((key) => {
                      const active = focusedUniverses.includes(key);
                      return (
                        <PillButton
                          key={key}
                          variant={active ? "active" : "default"}
                          onClick={() => {
                            const next = active
                              ? focusedUniverses.filter((k) => k !== key)
                              : [...focusedUniverses, key];
                            setFocusedUniverses(next);
                            setPrimaryFocus(next[0] ?? "");
                          }}
                        >
                          <Glyph name={universeGlyphName(key)} size={16} />
                          <span>{UNIVERSE_LABEL[key]}</span>
                        </PillButton>
                      );
                    })}
                  </div>
                </div>

                <label className="block">
                  <span className="text-sm font-semibold text-text-primary">Bio</span>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell collectors who you are and what you collect…"
                    rows={3}
                    maxLength={300}
                    className="mt-2 w-full resize-none rounded-2xl border border-[color:var(--border)] px-4 py-3 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(203,208,213,0.12)]"
                    style={{ background: "var(--theme-card)" }}
                  />
                  <span className="mt-1 block text-right text-[11px] text-[color:var(--muted2)]">{bio.length}/300</span>
                </label>
              </div>

              <div className="mt-6">
                <PillButton onClick={() => void handleSave()} disabled={saving} className="font-black" style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)", color: "#0B0B0B" }}>
                  {saving ? "Saving..." : "Save changes"}
                </PillButton>
              </div>
            </div>

            <aside className="rounded-[9px] p-5" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
              {/* Small, quiet — EK's ask: local-vs-cloud + a sync button,
                  nothing louder than that. */}
              {localItemCount != null ? (
                <div
                  className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-4 text-xs"
                  style={{ borderColor: "var(--theme-border)" }}
                >
                  <span>
                    {cloudItemCount == null ? (
                      <span className="text-[color:var(--muted2)]">Local {localItemCount}</span>
                    ) : localItemCount === cloudItemCount ? (
                      <span className="vltd-keep-color" style={{ "--vltd-keep-color": "var(--ok-text, #4ade80)" } as React.CSSProperties}>
                        <span className="inline-flex items-center gap-1"><AppIcon name="checkmark" size={14} /> Synced ({localItemCount})</span>
                      </span>
                    ) : localItemCount === 0 && cloudItemCount > 0 ? (
                      <span className="text-[color:var(--muted2)]" data-testid="vault-not-downloaded">Your vault ({cloudItemCount} items) has not been downloaded to this device yet. Open the Vault to load it.</span>
                    ) : (
                      <span className="vltd-keep-color" style={{ "--vltd-keep-color": "#f87171" } as React.CSSProperties}>
                        Out of sync — Local {localItemCount}, Cloud {cloudItemCount}
                      </span>
                    )}
                    {miniSyncMsg ? <span className="text-[color:var(--muted2)]"> · {miniSyncMsg}</span> : null}
                  </span>
                  {getPendingVaultSyncCount() > 0 ? (
                    <button
                      type="button"
                      onClick={() => void handleMiniSync()}
                      disabled={miniSyncBusy}
                      className="font-semibold text-[color:var(--muted)] underline underline-offset-2 disabled:opacity-50"
                    >
                      {miniSyncBusy ? "Syncing…" : "Sync pending changes"}
                    </button>
                  ) : cloudItemCount != null && localItemCount !== cloudItemCount ? (
                    <Link
                      href="/vault/sync"
                      className="max-w-[18rem] text-right font-semibold text-[color:var(--muted)] underline underline-offset-2"
                    >
                      Review {Math.max(0, localItemCount - cloudItemCount)} device-only record{localItemCount - cloudItemCount === 1 ? "" : "s"}
                    </Link>
                  ) : null}
                </div>
              ) : null}

              <div className="text-[11px] font-semibold uppercase tracking-[0.30em] text-[color:var(--muted2)]">
                Profile Summary
              </div>
              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-[color:var(--border)] p-4" style={{ background: "var(--theme-card)" }}>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">Name</div>
                  <div className="mt-1 font-black text-text-primary">{displayName || "Not set"}</div>
                </div>
                <div className="rounded-2xl border border-[color:var(--border)] p-4" style={{ background: "var(--theme-card)" }}>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">Handle</div>
                  <div className="mt-1 font-black text-text-primary">@{username || "username"}</div>
                  {username ? <PillButton href={`/u/${username}`} className="mt-3">View public profile</PillButton> : null}
                </div>
                <div className="rounded-2xl border border-[color:var(--border)] p-4" style={{ background: "var(--theme-card)" }}>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">Type</div>
                  <div className="mt-1 font-black text-text-primary">{profileType === "business" ? "Business" : "Curator"}</div>
                </div>
                <div className="rounded-2xl border border-[color:var(--border)] p-4" style={{ background: "var(--theme-card)" }}>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[color:var(--muted2)]">Focus</div>
                  <div className="mt-1 font-black text-text-primary">
                    {focusedUniverses.length > 0
                      ? focusedUniverses.filter(isUniverseKey).map((k) => UNIVERSE_LABEL[k]).join(", ")
                      : "Not set"}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
        ) : null}

        {/* Avatar */}
        {section === "profile" ? (
        <section className="mt-6 rounded-[9px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)] px-1 mb-4">
            Avatar
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] p-4" style={{ background: "var(--theme-card)" }}>
            <div className="flex flex-wrap gap-2">
              <PillButton variant={avatarMode === "EMOJI" ? "active" : "default"} onClick={() => setAvatarMode("EMOJI")}>Emoji</PillButton>
              <PillButton variant={avatarMode === "IMAGE" ? "active" : "default"} onClick={() => setAvatarMode("IMAGE")}>Image upload</PillButton>
            </div>

            {avatarMode === "EMOJI" ? (
              <div className="mt-4 flex items-center gap-3">
                <input
                  value={avatarEmoji}
                  onChange={(e) => setAvatarEmoji(e.target.value.slice(0, 4))}
                  placeholder="🗝️"
                  className="h-11 w-24 rounded-xl px-3 text-center text-lg ring-1 ring-[color:var(--border)] focus:outline-none"
                  style={{ background: "var(--theme-card)" }}
                />
                <div className="grid h-12 w-12 place-items-center rounded-2xl text-xl ring-1 ring-[color:var(--border)]" style={{ background: "var(--pill)" }}>
                  {avatarEmoji || "🗝️"}
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-3">
                {avatarUrl ? (
                  // Overnight QA pass (2026-09-22): avatarUrl can be a raw
                  // "__preset:guitar"-style sentinel (a chosen preset, not a
                  // real image URL — same convention TopNav.tsx/HomeClient.tsx
                  // already resolve) rather than always a real uploaded URL.
                  // This was rendering the sentinel string directly as <img
                  // src>, producing a literal 404 request and a broken image
                  // icon in the user's own account settings whenever their
                  // avatar was a preset. resolveAvatarSrc is this app's one
                  // shared place that turns either shape into a real src.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveAvatarSrc({ avatarUrl }) ?? avatarUrl} alt="Avatar preview" className="h-12 w-12 rounded-2xl object-cover ring-1 ring-[color:var(--border)]" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-2xl text-sm ring-1 ring-[color:var(--border)]" style={{ background: "var(--pill)" }}>
                    {(displayName || "U").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <PillButton onClick={() => avatarUploadRef.current?.click()} disabled={avatarUploading}>
                  {avatarUploading ? "Uploading…" : "Choose Image"}
                </PillButton>
                {avatarUrl ? (
                  <PillButton onClick={() => setAvatarUrl("")} className="bg-red-500/10 text-red-200 ring-red-400/20 hover:bg-red-500/15">
                    Remove
                  </PillButton>
                ) : null}
                <input
                  ref={avatarUploadRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f || !profileId) return;
                    setAvatarUploading(true);
                    try {
                      // Same real, cloud-synced upload the home page's own
                      // avatar picker already uses (avatars bucket, public
                      // URL saved to profiles.avatar_url) -- this page's
                      // upload used to be a separate, local-only path that
                      // never actually persisted anywhere but this device.
                      const supabase = getSupabaseBrowserClient();
                      if (!supabase) throw new Error("Supabase not ready");
                      // Perf/size fix (2026-09-19): avatars uploaded whatever
                      // the browser/phone camera produced, full resolution,
                      // no resize -- same gap as the vault-item photo flows,
                      // just for a small round image nobody needs at full
                      // camera resolution. Reuses the same shared utility.
                      const durableBlob = await prepareImageBlob(f, { maxDimension: 512, quality: 0.86 });
                      // prepareImageBlob always re-encodes to JPEG -- match
                      // the path's own extension to what's actually stored,
                      // instead of trusting the original file's extension.
                      const path = `${profileId}/avatar.jpg`;
                      const { error } = await supabase.storage.from("avatars").upload(path, durableBlob, { upsert: true, contentType: "image/jpeg" });
                      if (error) throw error;
                      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
                      setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : "Failed to upload image.");
                    } finally {
                      setAvatarUploading(false);
                      if (avatarUploadRef.current) avatarUploadRef.current.value = "";
                    }
                  }}
                />
              </div>
            )}
            <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
              Shown across the app, on every device.
            </div>
            <div className="mt-4 flex items-center gap-3">
              <PillButton variant="active" onClick={() => void handleAvatarSave()} disabled={avatarSaving}>
                {avatarSaving ? "Saving..." : "Save avatar"}
              </PillButton>
              {avatarSuccess ? <span className="text-sm text-emerald-400">{avatarSuccess}</span> : null}
            </div>
          </div>
        </section>
        ) : null}


        {section === "preferences" ? (
        <section className="mt-6 rounded-[9px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)] px-1 mb-1">
            Appearance
          </div>
          <ThemePicker />
        </section>
        ) : null}


        {/* Notifications */}
        {section === "preferences" ? (
        <section className="mt-6 rounded-[9px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)] px-1 mb-4">
            Notifications
          </div>
          <div className="flex items-start justify-between gap-4 rounded-2xl border border-[color:var(--border)] p-4" style={{ background: "var(--theme-card)" }}>
            <div className="flex-1">
              <div className="text-sm font-black text-text-primary">New message alerts</div>
              <div className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
                {pushState === "unsupported"
                  ? "Not available in this browser. On iPhone, add VLTD to your Home Screen first (Share → Add to Home Screen), then come back here."
                  : pushState === "denied"
                    ? "Blocked — notifications for this site were denied. Enable them in your browser's site settings to turn this on."
                    : "Get notified the moment someone sends you a message, even with VLTD closed."}
              </div>
            </div>
            <Toggle
              on={pushState === "subscribed"}
              onChange={() => void handleTogglePush()}
              disabled={pushBusy || pushState === "unsupported" || pushState === "denied"}
              title={pushState === "denied" ? "Blocked in browser settings" : undefined}
              ariaLabel="Push notifications"
              className="mt-0.5"
            />
          </div>
        </section>
        ) : null}

        {section === "data" ? (
        <section className="mt-6 rounded-[9px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)] px-1 mb-4">
            Vault Maintenance
          </div>
          <div className="flex flex-wrap gap-3">
            <PillButton onClick={() => void handleSyncNow()} disabled={isSyncing || isMigrating}>
              {isSyncing ? "Syncing..." : "Sync Now"}
            </PillButton>
            <PillButton onClick={() => void handleRepairMigrate()} disabled={isSyncing || isMigrating}>
              {isMigrating ? "Migrating..." : "Repair / Migrate Images"}
            </PillButton>
          </div>
          {syncStatus ? (
            <p className="mt-3 text-sm text-[color:var(--muted)]">{syncStatus}</p>
          ) : null}
        </section>
        ) : null}

        {/* Contact Info */}
        {section === "contact" ? (
        <section className="mt-6 rounded-[9px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)] px-1 mb-4">
            Contact Information
          </div>
          <p className="px-1 mb-4 text-xs text-[color:var(--muted)]">Private — used for shipping and billing. Never shown publicly.</p>

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-text-primary">Full name</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="First and last name"
                  className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(203,208,213,0.12)]"
                  style={{ background: "var(--theme-card)" }}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-text-primary">Phone</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  type="tel"
                  className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(203,208,213,0.12)]"
                  style={{ background: "var(--theme-card)" }}
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-text-primary">Address line 1</span>
              <input
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Street address"
                className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(203,208,213,0.12)]"
                style={{ background: "var(--theme-card)" }}
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-text-primary">Address line 2 <span className="font-normal text-[color:var(--muted)]">(optional)</span></span>
              <input
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Apt, suite, unit, etc."
                className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(203,208,213,0.12)]"
                style={{ background: "var(--theme-card)" }}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-sm font-semibold text-text-primary">City</span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(203,208,213,0.12)]"
                  style={{ background: "var(--theme-card)" }}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-text-primary">State</span>
                <input
                  value={stateVal}
                  onChange={(e) => setStateVal(e.target.value)}
                  placeholder="State"
                  className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(203,208,213,0.12)]"
                  style={{ background: "var(--theme-card)" }}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-text-primary">ZIP code</span>
                <input
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder="00000"
                  className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(203,208,213,0.12)]"
                  style={{ background: "var(--theme-card)" }}
                />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-text-primary">Country</span>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="US"
                className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(203,208,213,0.12)]"
                style={{ background: "var(--theme-card)" }}
              />
            </label>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <PillButton onClick={() => void handleContactSave()} disabled={contactSaving} className="font-black" style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)", color: "#0B0B0B" }}>
              {contactSaving ? "Saving..." : "Save contact info"}
            </PillButton>
            {contactSuccess && (
              <span className="text-sm text-emerald-400">{contactSuccess}</span>
            )}
          </div>
        </section>
        ) : null}

        {/* Universe Focus */}
        {section === "preferences" ? (
        <section className="mt-6 rounded-[9px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)] px-1 mb-1">
            Universes displayed
          </div>
          <p className="px-1 mb-4 text-xs text-[color:var(--muted)]">
            Choose which universes appear in your home, vault, and discover pages.
          </p>

          {/* Show all toggle */}
          <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-[color:var(--border)] px-4 py-3" style={{ background: "var(--theme-card)" }}>
            <div>
              <div className="text-sm font-black text-text-primary">Show all universes</div>
              <div className="mt-0.5 text-xs text-[color:var(--muted)]">Turn off to pick specific universes</div>
            </div>
            <Toggle on={showAllUniverses} onChange={() => setShowAllUniverses((v) => !v)} ariaLabel="Show all universes" />
          </div>

          {/* Universe chip grid */}
          {!showAllUniverses && (
            <div className="flex flex-wrap gap-2 mb-4">
              {UNIVERSE_KEYS.map((key) => {
                const active = displayedUniverses.includes(key);
                return (
                  <PillButton
                    key={key}
                    variant={active ? "active" : "default"}
                    onClick={() =>
                      setDisplayedUniverses((prev) =>
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
          )}

          <div className="flex items-center gap-4">
            <PillButton onClick={() => void handleUniverseFocusSave()} disabled={universeFocusSaving} className="font-black" style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)", color: "#0B0B0B" }}>
              {universeFocusSaving ? "Saving..." : "Save"}
            </PillButton>
            {universeFocusSuccess && (
              <span className="text-sm text-emerald-400">{universeFocusSuccess}</span>
            )}
          </div>
        </section>
        ) : null}

        {/* Data Controls */}
        {section === "data" ? (
        <section className="mt-6 rounded-[9px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)] px-1 mb-1">
            Data Controls
          </div>
          <p className="px-1 mb-4 text-xs text-[color:var(--muted)]">
            Export a backup, or clear cached display preferences on this device.
          </p>
          <p className="px-1 mb-4 text-xs text-[color:var(--muted)]">
            Restore from a backup is not available. The old Restore Vault button looked for a backup that the app never saves, and replacing what is stored on this device has not been checked against your Personal and Business profiles, so it has been turned off. Your items are saved to your account automatically, and Export Vault JSON gives you your own copy.
          </p>
          <div className="flex flex-wrap gap-2">
            <PillButton href="/vault/sync">Review device-only records</PillButton>
            <PillButton onClick={exportVaultJson}>Export Vault JSON</PillButton>
            <PillButton onClick={clearLocalCache} className="bg-red-500/10 text-red-200 ring-red-400/20 hover:bg-red-500/15">
              Clear Local Cache
            </PillButton>
          </div>
        </section>
        ) : null}


      </div>
    </main>
  );
}

"use client";
// NOTE: primaryFocus uses taxonomy universe keys for personalisation

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemePicker } from "@/components/ui/ThemePicker";
import { PillButton } from "@/components/ui/PillButton";
import { Glyph, universeGlyphName } from "@/components/ui/Glyph";
import { AccountTabs } from "@/components/account/AccountTabs";

import { getOnboardingStatus, updateProfile } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { syncPublicProfile } from "@/lib/publicProfile";
import { processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import { syncVaultItemsFromSupabase } from "@/lib/vaultModel";
import { loadWatchlist, removeFromWatchlist, type WatchlistItem } from "@/lib/watchlistModel";
import { UNIVERSE_KEYS, UNIVERSE_LABEL, isUniverseKey } from "@/lib/taxonomy";
import { getProfileSafe, setProfileSafe, broadcastProfileChange } from "@/lib/userProfile";
import { showToast } from "@/lib/toast";

/** Normalize a stored focus value — treats the literal string "null" as empty. */
function normalizeFocus(value: unknown): string {
  const s = String(value ?? "").trim();
  return s && s.toLowerCase() !== "null" ? s : "";
}
import { migrateExistingVaultImagesToSupabase } from "@/lib/vaultMigration";

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

async function fileToCompressedDataUrl(file: File, opts?: { maxSize?: number; quality?: number }) {
  const maxSize = opts?.maxSize ?? 256;
  const quality = opts?.quality ?? 0.85;
  const blobUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = blobUrl;
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Failed to load image"));
    });
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const tw = Math.max(1, Math.round(img.width * scale));
    const th = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(img, 0, 0, tw, th);
    let data = canvas.toDataURL("image/webp", quality);
    if (!data.startsWith("data:image/webp")) data = canvas.toDataURL("image/jpeg", quality);
    return data;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

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
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [syncStatus, setSyncStatus] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
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
  // Universe Focus
  const [focusedUniverses, setFocusedUniverses] = useState<string[]>([]);
  const [showAllUniverses, setShowAllUniverses] = useState(false);
  const [universeFocusSaving, setUniverseFocusSaving] = useState(false);
  const [universeFocusSuccess, setUniverseFocusSuccess] = useState("");
  // Avatar (emoji is real/synced; image upload is local-only, no backend yet)
  const [avatarMode, setAvatarMode] = useState<"EMOJI" | "IMAGE">("EMOJI");
  const [avatarEmoji, setAvatarEmoji] = useState("🗝️");
  const [avatarImageDataUrl, setAvatarImageDataUrl] = useState("");
  // Age verification (self-declared, not government ID) + marketing opt-in
  const [dob, setDob] = useState("");
  const [ageVerified, setAgeVerified] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [identitySaving, setIdentitySaving] = useState(false);
  const [identitySuccess, setIdentitySuccess] = useState("");

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
        const fu = (status.activeProfile as Record<string, unknown>).focused_universes;
        const primary = normalizeFocus(status.activeProfile.primary_focus);
        // Seed the multi-select from focused_universes; fall back to the legacy
        // single primary_focus (only when it's a real universe key).
        const seeded = Array.isArray(fu) && fu.length > 0
          ? (fu as string[]).filter((k) => isUniverseKey(k))
          : primary && isUniverseKey(primary)
            ? [primary]
            : [];
        setFocusedUniverses(seeded);
        setShowAllUniverses(!Array.isArray(fu) || (fu as string[]).length === 0);

        // Avatar image/mode has no backend yet -- local cache only.
        const localProfile = getProfileSafe();
        setAvatarMode(localProfile.avatarMode);
        setAvatarImageDataUrl(localProfile.avatarImageDataUrl);
        // Avatar emoji + DOB/age/marketing ARE real (profiles table) -- the
        // real value wins over whatever the local cache had.
        setAvatarEmoji(status.activeProfile.avatar_emoji || localProfile.avatarEmoji || "🗝️");
        setDob(status.activeProfile.date_of_birth ?? "");
        setAgeVerified(Boolean(status.activeProfile.age_verified));
        setMarketingOptIn(status.activeProfile.marketing_opt_in !== false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load account.");
      } finally {
        setWatchlist(loadWatchlist());
      setLoading(false);
      }
    }
    void load();
  }, [router]);

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
    function onWatchlistUpdate() {
      setWatchlist(loadWatchlist());
    }
    window.addEventListener("vltd:watchlist-updated", onWatchlistUpdate);

    // Scroll to anchor if URL has a hash (e.g. #watchlist or #profile-setup)
    if (window.location.hash) {
      const target = document.getElementById(window.location.hash.slice(1));
      if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
    }

    return () => window.removeEventListener("vltd:watchlist-updated", onWatchlistUpdate);
  }, []);

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
        bio: bio || null,
        is_public: isPublic,
      });
      // Persist the multi-select collection focus alongside the primary.
      const supabase = getSupabaseBrowserClient();
      if (supabase) {
        await supabase
          .from("profiles")
          .update({ focused_universes: focusedUniverses.length > 0 ? focusedUniverses : null })
          .eq("id", profileId);
      }
      void syncPublicProfile(profileId);
      setSuccess("Account updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save account.");
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
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase not ready");
      const val = showAllUniverses ? null : (focusedUniverses.length > 0 ? focusedUniverses : null);
      await supabase.from("profiles").update({ focused_universes: val }).eq("id", profileId);
      setUniverseFocusSuccess("Universe focus saved.");
    } catch (err) {
      setUniverseFocusSuccess(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setUniverseFocusSaving(false);
      setTimeout(() => setUniverseFocusSuccess(""), 3000);
    }
  }

  const age = useMemo(() => computeAge(dob), [dob]);
  const canVerifyAge = age !== null && age >= 18;
  const avatarUploadRef = useRef<HTMLInputElement | null>(null);

  async function handleIdentitySave() {
    if (!profileId) return;
    setIdentitySaving(true);
    setIdentitySuccess("");
    try {
      const nextAgeVerified = ageVerified && canVerifyAge;
      // Avatar image/mode has no backend yet -- keep it in the local cache
      // alongside whatever real values are already there.
      setProfileSafe({ ...getProfileSafe(), avatarMode, avatarImageDataUrl, avatarEmoji });
      broadcastProfileChange();
      await updateProfile(profileId, {
        avatar_emoji: avatarEmoji,
        date_of_birth: dob || null,
        age_verified: nextAgeVerified,
        marketing_opt_in: marketingOptIn,
      });
      setAgeVerified(nextAgeVerified);
      void syncPublicProfile(profileId);
      setIdentitySuccess("Saved.");
    } catch (err) {
      setIdentitySuccess(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setIdentitySaving(false);
      setTimeout(() => setIdentitySuccess(""), 3000);
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

  function exportVaultJson() {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem("vltd_items_v2") || "[]";
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vltd_vault_export.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <main className="px-4 py-8 text-[color:var(--fg)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-[28px] border border-[color:var(--border)] p-6 text-[color:var(--muted)] shadow-[0_22px_72px_rgba(0,0,0,0.24)]" style={{ background: "var(--theme-card)" }}>
          Loading account...
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 py-6 text-[color:var(--fg)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <AccountTabs />

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
                Account
              </div>
              <h1 className="mt-3 text-4xl font-black leading-[0.98] tracking-[-0.055em] text-text-primary sm:text-5xl">
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setProfileType("personal")}
                    className={[
                      "rounded-2xl border p-4 text-left transition",
                      profileType === "personal"
                        ? "border-[color:var(--frame-ring)] text-text-primary"
                        : "border-[color:var(--border)] text-[color:var(--muted)] hover:text-text-primary",
                    ].join(" ")}
                    style={{ background: profileType === "personal" ? "var(--pill-active-bg)" : "var(--theme-card)" }}
                  >
                    <div className="text-sm font-black">Curator</div>
                    <div className="mt-1 text-xs leading-5 text-[color:var(--muted)]">Personal vault and gallery.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileType("business")}
                    className={[
                      "rounded-2xl border p-4 text-left transition",
                      profileType === "business"
                        ? "border-[color:var(--frame-ring)] text-text-primary"
                        : "border-[color:var(--border)] text-[color:var(--muted)] hover:text-text-primary",
                    ].join(" ")}
                    style={{ background: profileType === "business" ? "var(--pill-active-bg)" : "var(--theme-card)" }}
                  >
                    <div className="text-sm font-black">Business</div>
                    <div className="mt-1 text-xs leading-5 text-[color:var(--muted)]">Shop, team, or inventory workflow.</div>
                  </button>
                </div>

                <div>
                  <span className="text-sm font-semibold text-text-primary">Collection focus</span>
                  <p className="mt-0.5 text-xs text-[color:var(--muted2)]">
                    Used to personalise your Discover feed — pick every universe you focus on. Your first pick is your primary.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {UNIVERSE_KEYS.map((key) => {
                      const active = focusedUniverses.includes(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            const next = active
                              ? focusedUniverses.filter((k) => k !== key)
                              : [...focusedUniverses, key];
                            setFocusedUniverses(next);
                            setPrimaryFocus(next[0] ?? "");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition ring-1"
                          style={active ? {
                            background: "var(--pill-active-bg)",
                            border: "1px solid var(--frame-ring)",
                            color: "var(--theme-text-primary, #ECEDEF)",
                            boxShadow: "0 0 12px var(--frame-glow-soft)",
                          } : {
                            background: "var(--theme-card)",
                            border: "1px solid var(--theme-border, rgba(203,208,213,0.12))",
                            color: "var(--muted)",
                          }}
                        >
                          <Glyph name={universeGlyphName(key)} size={16} />
                          <span>{UNIVERSE_LABEL[key]}</span>
                        </button>
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
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className="inline-flex h-12 items-center rounded-[8px] px-6 text-sm font-black text-[#0B0B0B] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: 'var(--theme-gold-gradient)', boxShadow: 'var(--theme-gold-glow)' }}
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>

            <aside className="rounded-[28px] p-5" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
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

        {/* Avatar */}
        <section className="mt-6 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)] px-1 mb-4">
            Avatar
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] p-4" style={{ background: "var(--theme-card)" }}>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAvatarMode("EMOJI")}
                className="rounded-full px-3 py-1.5 text-xs font-semibold ring-1"
                style={avatarMode === "EMOJI"
                  ? { background: "var(--pill-active-bg)", color: "var(--theme-gold, #C8CDD2)", borderColor: "var(--frame-ring)" }
                  : { background: "var(--pill)", color: "var(--muted)", borderColor: "var(--border)" }}
              >
                Emoji
              </button>
              <button
                type="button"
                onClick={() => setAvatarMode("IMAGE")}
                className="rounded-full px-3 py-1.5 text-xs font-semibold ring-1"
                style={avatarMode === "IMAGE"
                  ? { background: "var(--pill-active-bg)", color: "var(--theme-gold, #C8CDD2)", borderColor: "var(--frame-ring)" }
                  : { background: "var(--pill)", color: "var(--muted)", borderColor: "var(--border)" }}
              >
                Image upload
              </button>
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
                {avatarImageDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarImageDataUrl} alt="Avatar preview" className="h-12 w-12 rounded-2xl object-cover ring-1 ring-[color:var(--border)]" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-2xl text-sm ring-1 ring-[color:var(--border)]" style={{ background: "var(--pill)" }}>
                    {(displayName || "U").slice(0, 1).toUpperCase()}
                  </div>
                )}
                <PillButton onClick={() => avatarUploadRef.current?.click()}>Choose Image</PillButton>
                {avatarImageDataUrl ? (
                  <PillButton onClick={() => setAvatarImageDataUrl("")} className="bg-red-500/10 text-red-200 ring-red-400/20 hover:bg-red-500/15">
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
                    if (!f) return;
                    try {
                      const dataUrl = await fileToCompressedDataUrl(f, { maxSize: 256, quality: 0.85 });
                      setAvatarImageDataUrl(dataUrl);
                    } catch (err) {
                      showToast(err instanceof Error ? err.message : "Failed to process image.");
                    } finally {
                      if (avatarUploadRef.current) avatarUploadRef.current.value = "";
                    }
                  }}
                />
              </div>
            )}
            <div className="mt-3 text-xs" style={{ color: "var(--muted)" }}>
              {avatarMode === "IMAGE" ? "Image uploads are stored on this device only for now — they don't sync across devices yet." : "Shown across the app."}
            </div>
          </div>
        </section>

        {/* Identity & Security (self-declared age check, not government ID verification) */}
        <section className="mt-6 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)] px-1 mb-1">
            Identity &amp; Security
          </div>
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
                className="mt-2 h-12 w-full rounded-2xl border border-[color:var(--border)] px-4 text-[color:var(--fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-4 focus:ring-[rgba(203,208,213,0.12)]"
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
            </div>
          </div>

          <label className="mt-5 flex items-center gap-3 text-sm">
            <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} />
            Receive product updates
          </label>

          <div className="mt-5 flex items-center gap-4">
            <button
              type="button"
              disabled={identitySaving}
              onClick={() => void handleIdentitySave()}
              className="inline-flex h-12 items-center rounded-[8px] px-6 text-sm font-black text-[#0B0B0B] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)" }}
            >
              {identitySaving ? "Saving..." : "Save identity settings"}
            </button>
            {identitySuccess && <span className="text-sm text-emerald-400">{identitySuccess}</span>}
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)] px-1 mb-1">
            Appearance
          </div>
          <ThemePicker />
        </section>

        {/* Privacy */}
        <section className="mt-6 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)] px-1 mb-4">
            Privacy
          </div>
          <div className="flex items-start justify-between gap-4 rounded-2xl border border-[color:var(--border)] p-4" style={{ background: "var(--theme-card)" }}>
            <div className="flex-1">
              <div className="text-sm font-black text-text-primary">Public profile</div>
              <div className="mt-1 text-xs leading-5 text-[color:var(--muted)]">
                Your vault and galleries are visible to other collectors. Turn this off to go incognito — your profile disappears from search and the Discover feed.
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ring-[color:var(--frame-ring)]" style={{ background: "var(--pill-active-bg)", color: "var(--theme-gold, #C8CDD2)" }}>
                ✦ Paid feature — coming soon
              </div>
            </div>
            <button
              type="button"
              disabled={true}
              title="Going incognito is a paid feature"
              aria-pressed={isPublic}
              className="relative mt-0.5 h-6 w-11 shrink-0 cursor-not-allowed rounded-full transition-colors opacity-50"
              style={{ background: isPublic ? "var(--theme-gold-gradient, #C8CDD2)" : "rgba(255,255,255,0.12)" }}
            >
              <span
                className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                style={{ transform: isPublic ? "translateX(20px)" : "translateX(0)" }}
              />
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
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

        {/* Contact Info */}
        <section className="mt-6 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
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
            <button
              type="button"
              disabled={contactSaving}
              onClick={() => void handleContactSave()}
              className="inline-flex h-12 items-center rounded-[8px] px-6 text-sm font-black text-[#0B0B0B] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: 'var(--theme-gold-gradient)', boxShadow: 'var(--theme-gold-glow)' }}
            >
              {contactSaving ? "Saving..." : "Save contact info"}
            </button>
            {contactSuccess && (
              <span className="text-sm text-emerald-400">{contactSuccess}</span>
            )}
          </div>
        </section>

        {/* Universe Focus */}
        <section className="mt-6 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)] px-1 mb-1">
            Universe Focus
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
            <button
              type="button"
              onClick={() => setShowAllUniverses((v) => !v)}
              aria-pressed={showAllUniverses}
              className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
              style={{ background: showAllUniverses ? "var(--theme-gold-gradient, #C8CDD2)" : "rgba(255,255,255,0.12)" }}
            >
              <span
                className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                style={{ transform: showAllUniverses ? "translateX(20px)" : "translateX(0)" }}
              />
            </button>
          </div>

          {/* Universe chip grid */}
          {!showAllUniverses && (
            <div className="flex flex-wrap gap-2 mb-4">
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
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition ring-1 min-h-[40px]"
                    style={active ? {
                      background: "var(--pill-active-bg)",
                      border: "1px solid var(--frame-ring)",
                      color: "var(--theme-text-primary, #ECEDEF)",
                      boxShadow: "0 0 12px var(--frame-glow-soft)",
                    } : {
                      background: "var(--theme-card)",
                      border: "1px solid var(--theme-border, rgba(203,208,213,0.12))",
                      color: "var(--muted)",
                    }}
                  >
                    <Glyph name={universeGlyphName(key)} size={16} />
                    <span>{UNIVERSE_LABEL[key]}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="button"
              disabled={universeFocusSaving}
              onClick={() => void handleUniverseFocusSave()}
              className="inline-flex h-12 items-center rounded-[8px] px-6 text-sm font-black text-[#0B0B0B] transition hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: "var(--theme-gold-gradient)", boxShadow: "var(--theme-gold-glow)" }}
            >
              {universeFocusSaving ? "Saving..." : "Save focus"}
            </button>
            {universeFocusSuccess && (
              <span className="text-sm text-emerald-400">{universeFocusSuccess}</span>
            )}
          </div>
        </section>

        {/* Data Controls */}
        <section className="mt-6 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
          <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)] px-1 mb-1">
            Data Controls
          </div>
          <p className="px-1 mb-4 text-xs text-[color:var(--muted)]">
            Export a backup, or clear cached display preferences on this device.
          </p>
          <div className="flex flex-wrap gap-2">
            <PillButton onClick={exportVaultJson}>Export Vault JSON</PillButton>
            <PillButton onClick={clearLocalCache} className="bg-red-500/10 text-red-200 ring-red-400/20 hover:bg-red-500/15">
              Clear Local Cache
            </PillButton>
          </div>
        </section>

        {/* Watchlist */}
        <section id="watchlist" className="mt-6 rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.24)]">
          <div className="flex items-center justify-between px-1 mb-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[color:var(--muted2)]">
              Watchlist
            </div>
            {watchlist.length > 0 && (
              <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: "var(--pill-active-bg)", color: "var(--theme-gold, #C8CDD2)" }}>
                {watchlist.length}
              </span>
            )}
          </div>

          {watchlist.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <Glyph name="cards" size={30} style={{ color: "var(--theme-gold)", opacity: 0.7 }} />
              <p className="text-sm text-[color:var(--muted)]">Nothing saved yet — use The Flip in Discover to save items you like.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {watchlist.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--bg)] p-3">
                  {item.imageFrontUrl ? (
                    <img
                      src={item.imageFrontUrl}
                      alt={item.title}
                      className="h-14 w-14 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 shrink-0 rounded-xl bg-white/8 flex items-center justify-center text-xl">🎴</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-[color:var(--fg)]">{item.title}</div>
                    {item.subtitle && <div className="truncate text-xs text-[color:var(--muted)]">{item.subtitle}</div>}
                    <div className="mt-0.5 flex items-center gap-2">
                      {item.grade && (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "rgba(203,208,213,0.18)", color: "var(--theme-gold, #C8CDD2)" }}>{item.grade}</span>
                      )}
                      {item.collectorName && (
                        <span className="text-[11px] text-[color:var(--muted2)]">by {item.collectorName}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromWatchlist(item.id)}
                    className="ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-[color:var(--muted)] transition hover:bg-red-500/12 hover:text-red-400"
                    aria-label="Remove from watchlist"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}

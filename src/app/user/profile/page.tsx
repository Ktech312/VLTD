// Path: src/app/user/profile/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PillButton } from "@/components/ui/PillButton";
import {
  DEFAULT_PROFILE,
  UserProfile,
  getProfileSafe,
  setProfileSafe,
  broadcastProfileChange,
} from "@/lib/userProfile";

const LS_ITEMS_KEY = "vltd_items_v2";
const LS_FRAME_KEY = "vltd_frame_style";
const TIER_KEY = "vltd_tier";
const PALETTE_KEY = "vltd_palette";
const SHEET_ID_KEY = "vltd_google_sheet_id_v1";

function clampUsername(v: string) {
  const cleaned = v
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);
  return cleaned || "collector";
}

function clampDisplayName(v: string) {
  const cleaned = v.trim().replace(/\s+/g, " ").slice(0, 40);
  return cleaned || "User";
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

function computeAge(dob: string) {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  if (age < 0 || age > 120) return null;
  return age;
}

function downloadTextFile(filename: string, contents: string, mime = "text/plain") {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] vltd-panel-main">
      <div className="text-lg font-semibold">{title}</div>
      {description ? (
        <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{description}</div>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[22px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)] vltd-panel-soft">
      <div className="text-xs tracking-widest text-[color:var(--muted2)]">{label}</div>
      <div className="mt-2">{children}</div>
      {helper ? <div className="mt-2 text-xs text-[color:var(--muted)]">{helper}</div> : null}
    </div>
  );
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

    const w = img.width;
    const h = img.height;
    const scale = Math.min(1, maxSize / Math.max(w, h));
    const tw = Math.max(1, Math.round(w * scale));
    const th = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");

    ctx.drawImage(img, 0, 0, tw, th);

    let mime = "image/webp";
    let data = canvas.toDataURL(mime, quality);
    if (!data.startsWith("data:image/webp")) {
      mime = "image/jpeg";
      data = canvas.toDataURL(mime, quality);
    }

    return data;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export default function UserProfilePage() {
  const [mounted, setMounted] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const importJsonRef = useRef<HTMLInputElement | null>(null);
  const avatarUploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => setProfile(getProfileSafe()), []);

  const age = useMemo(() => computeAge(profile.dob), [profile.dob]);
  const canVerify = age !== null && age >= 18;

  function saveProfile(next: UserProfile) {
    setSaving(true);
    try {
      setProfileSafe(next);
      broadcastProfileChange();
      setProfile(next);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof UserProfile>(k: K, v: UserProfile[K]) {
    setProfile((p) => ({ ...p, [k]: v }));
    setDirty(true);
  }

  function onSaveClick() {
    const dn = clampDisplayName(profile.displayName);
    const un = clampUsername(profile.username);
    const email = profile.email.trim();

    if (!isValidEmail(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    const next: UserProfile = {
      ...profile,
      displayName: dn,
      username: un,
      email,
      ageVerified: profile.ageVerified && canVerify ? true : false,
    };

    saveProfile(next);
    alert("Saved profile.");
  }

  function onResetToDefaults() {
    if (!confirm("Reset profile to defaults?")) return;
    saveProfile(DEFAULT_PROFILE);
  }

  function exportVaultJson() {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(LS_ITEMS_KEY) || "[]";
    downloadTextFile("vltd_vault_export.json", raw, "application/json");
  }

  function exportProfileJson() {
    downloadTextFile(
      "vltd_profile_export.json",
      JSON.stringify(profile, null, 2),
      "application/json"
    );
  }

  function importProfileJson(file: File) {
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text) as Partial<UserProfile>;
        const merged = { ...DEFAULT_PROFILE, ...parsed } as UserProfile;
        saveProfile(merged);
        alert("Imported profile.");
      } catch {
        alert("Import failed: invalid JSON.");
      }
    });
  }

  function clearAllLocalDemoData() {
    if (!confirm("This will clear ALL local demo data (vault + profile + settings). Continue?")) {
      return;
    }
    if (typeof window === "undefined") return;

    window.localStorage.removeItem("vltd_profile_v1");
    window.localStorage.removeItem(LS_ITEMS_KEY);
    window.localStorage.removeItem(LS_FRAME_KEY);
    window.localStorage.removeItem(TIER_KEY);
    window.localStorage.removeItem(PALETTE_KEY);
    window.localStorage.removeItem(SHEET_ID_KEY);

    broadcastProfileChange();
    alert("Cleared local demo data. Refresh the page.");
  }

  const avatarNode =
    profile.avatarMode === "IMAGE" && profile.avatarImageDataUrl.trim() ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatarImageDataUrl.trim()}
        alt="Avatar"
        className="h-16 w-16 rounded-[20px] object-cover ring-1 ring-[color:var(--border)]"
      />
    ) : (
      <div className="grid h-16 w-16 place-items-center rounded-[20px] bg-[color:var(--pill)] text-2xl ring-1 ring-[color:var(--border)]">
        {profile.avatarEmoji || "🗝️"}
      </div>
    );

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Link href="/account">
            <PillButton>Account</PillButton>
          </Link>

          <Link href="/user">
            <PillButton>Back to Settings</PillButton>
          </Link>

          <PillButton
            variant={dirty && !saving ? "active" : "default"}
            onClick={onSaveClick}
            disabled={!dirty || saving}
          >
            {saving ? "Saving..." : dirty ? "Save Changes" : "Saved"}
          </PillButton>
        </div>

        <section className="rounded-[28px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)] vltd-panel-main">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-4">
              {avatarNode}
              <div>
                <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
                  PERSONAL PROFILE
                </div>
                <h1 className="mt-2 text-3xl font-semibold">{profile.displayName || "User"}</h1>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  @{profile.username || "collector"}
                </div>
                <div className="mt-2 text-sm text-[color:var(--muted)]">
                  {profile.ageVerified ? "Age verified ✅" : "Age not verified"}
                  {mounted && age !== null ? ` • Age ${age}` : ""}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <PillButton
                onClick={onResetToDefaults}
                className="bg-red-500/10 text-red-200 ring-red-400/20 hover:bg-red-500/15"
              >
                Reset
              </PillButton>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-6">
          <SectionCard
            title="Identity"
            description="These are the core details used across the app."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="DISPLAY NAME" helper="Shown across the app.">
                <input
                  value={profile.displayName}
                  onChange={(e) => update("displayName", e.target.value)}
                  placeholder="e.g. Ehren Kellogg"
                  className="h-11 w-full rounded-xl bg-[color:var(--surface)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                />
              </Field>

              <Field
                label="USERNAME"
                helper="Lowercase letters, numbers, and underscore only."
              >
                <input
                  value={profile.username}
                  onChange={(e) => update("username", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
                  placeholder="collector"
                  className="h-11 w-full rounded-xl bg-[color:var(--surface)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="EMAIL" helper="Used for account and recovery in demo mode.">
                  <input
                    value={profile.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="user@example.com"
                    className="h-11 w-full rounded-xl bg-[color:var(--surface)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                  />
                </Field>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Avatar"
            description="Choose a simple emoji avatar or upload an image stored locally."
          >
            <div className="rounded-[22px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)] vltd-panel-soft">
              <div className="flex flex-wrap gap-2">
                <PillButton
                  variant={profile.avatarMode === "EMOJI" ? "active" : "default"}
                  onClick={() => update("avatarMode", "EMOJI")}
                >
                  Emoji
                </PillButton>

                <PillButton
                  variant={profile.avatarMode === "IMAGE" ? "active" : "default"}
                  onClick={() => update("avatarMode", "IMAGE")}
                >
                  Image Upload
                </PillButton>
              </div>

              {profile.avatarMode === "EMOJI" ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="EMOJI" helper="Use one emoji or a short sequence.">
                    <input
                      value={profile.avatarEmoji}
                      onChange={(e) => update("avatarEmoji", e.target.value.slice(0, 4))}
                      placeholder="🗝️"
                      className="h-11 w-full rounded-xl bg-[color:var(--surface)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                    />
                  </Field>

                  <Field label="PREVIEW">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[color:var(--pill)] text-xl ring-1 ring-[color:var(--border)]">
                        {profile.avatarEmoji || "🗝️"}
                      </div>
                      <div className="text-sm text-[color:var(--muted)]">
                        {clampDisplayName(profile.displayName)} • @{clampUsername(profile.username)}
                      </div>
                    </div>
                  </Field>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field
                    label="UPLOAD IMAGE"
                    helper="Stored locally after resize and compression."
                  >
                    <div className="flex flex-wrap gap-2">
                      <PillButton onClick={() => avatarUploadRef.current?.click()}>
                        Choose Image
                      </PillButton>

                      {profile.avatarImageDataUrl ? (
                        <PillButton
                          onClick={() => update("avatarImageDataUrl", "")}
                          className="bg-red-500/10 text-red-200 ring-red-400/20 hover:bg-red-500/15"
                        >
                          Remove Image
                        </PillButton>
                      ) : null}
                    </div>
                  </Field>

                  <Field label="PREVIEW">
                    <div className="flex items-center gap-3">
                      {profile.avatarImageDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={profile.avatarImageDataUrl}
                          alt="Avatar preview"
                          className="h-12 w-12 rounded-2xl object-cover ring-1 ring-[color:var(--border)]"
                        />
                      ) : (
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[color:var(--pill)] text-xl ring-1 ring-[color:var(--border)]">
                          {initialsFromName(profile.displayName)}
                        </div>
                      )}
                      <div className="text-sm text-[color:var(--muted)]">
                        {clampDisplayName(profile.displayName)} • @{clampUsername(profile.username)}
                      </div>
                    </div>
                  </Field>

                  <input
                    ref={avatarUploadRef}
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;

                      try {
                        const dataUrl = await fileToCompressedDataUrl(f, {
                          maxSize: 256,
                          quality: 0.85,
                        });
                        update("avatarImageDataUrl", dataUrl);
                        update("avatarMode", "IMAGE");
                      } catch (err: any) {
                        alert(err?.message ?? "Failed to process image.");
                      } finally {
                        if (avatarUploadRef.current) avatarUploadRef.current.value = "";
                      }
                    }}
                  />
                </div>
              )}

              <input
                ref={importJsonRef}
                type="file"
                className="hidden"
                accept="application/json,.json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  importProfileJson(f);
                  e.currentTarget.value = "";
                }}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Age Verification"
            description="Demo flow: enter date of birth, then verify if age is 18 or older."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="DATE OF BIRTH"
                helper={mounted ? (age === null ? "Enter a valid date." : `Computed age: ${age}`) : ""}
              >
                <input
                  type="date"
                  value={profile.dob}
                  onChange={(e) => {
                    const dob = e.target.value;
                    update("dob", dob);
                    const ageNow = computeAge(dob);
                    if (ageNow === null || ageNow < 18) {
                      setProfile((p) => ({ ...p, ageVerified: false }));
                      setDirty(true);
                    }
                  }}
                  className="h-11 w-full rounded-xl bg-[color:var(--surface)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
                />
              </Field>

              <Field
                label="VERIFICATION"
                helper={
                  canVerify
                    ? "Eligible to verify."
                    : "Not eligible yet. Enter a valid DOB and be 18+."
                }
              >
                <div className="flex flex-wrap gap-2">
                  <PillButton
                    variant={canVerify ? "active" : "default"}
                    onClick={() => {
                      if (!canVerify) {
                        alert("Must be 18+ with a valid DOB to verify.");
                        return;
                      }
                      update("ageVerified", true);
                    }}
                    disabled={!canVerify}
                  >
                    {profile.ageVerified ? "Verified ✅" : "Verify Age"}
                  </PillButton>

                  {profile.ageVerified ? (
                    <PillButton
                      onClick={() => update("ageVerified", false)}
                      className="bg-red-500/10 text-red-200 ring-red-400/20 hover:bg-red-500/15"
                    >
                      Remove Verification
                    </PillButton>
                  ) : null}
                </div>
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Preferences"
            description="Simple personal settings for the demo profile."
          >
            <div className="rounded-[22px] bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)] vltd-panel-soft">
              <label className="inline-flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={profile.marketingOptIn}
                  onChange={(e) => update("marketingOptIn", e.target.checked)}
                />
                Receive product updates
              </label>
              <div className="mt-2 text-xs text-[color:var(--muted)]">
                In a real app this would sync to account preferences.
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Data Controls"
            description="Export, import, or clear local demo data."
          >
            <div className="flex flex-wrap gap-2">
              <PillButton onClick={exportProfileJson}>Export Profile JSON</PillButton>
              <PillButton onClick={() => importJsonRef.current?.click()}>
                Import Profile JSON
              </PillButton>
              <PillButton onClick={exportVaultJson}>Export Vault JSON</PillButton>
              <PillButton
                onClick={clearAllLocalDemoData}
                className="bg-red-500/10 text-red-200 ring-red-400/20 hover:bg-red-500/15"
              >
                Clear Local Demo Data
              </PillButton>
            </div>

            <div className="mt-4 text-xs text-[color:var(--muted2)]">
              Vault spreadsheet exports still live in{" "}
              <Link href="/user" className="underline">
                User Settings
              </Link>
              .
            </div>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}
# VLTD — Public Vault URL

**Philosophy:** Every collector deserves a shareable link. You control what's in it — item by item, with the lock icon. The public page is your vault's face to the world: the Museum View, your name, your collection. No login required to view it.

**URL pattern:** `vltd.app/v/[profileId]`

The `profileId` is the UUID already stored in `localStorage` as `vltd_active_profile_id_v1`. No username table needed to ship. The collector copies their link once, shares it everywhere.

**Files changed:** 5 (2 SQL migrations, 1 new lib file, 1 new page route, 1 modified vault header)

---

## Step 0 — Supabase migrations

Run both in the Supabase SQL editor.

### 0a — Public profiles table

```sql
CREATE TABLE IF NOT EXISTS public_profiles (
  profile_id  TEXT        PRIMARY KEY,
  display_name TEXT       NOT NULL DEFAULT 'Collector',
  avatar_emoji TEXT       NOT NULL DEFAULT '🗝️',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public_profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read a public profile
CREATE POLICY "public_profiles_select"
  ON public_profiles FOR SELECT
  USING (true);

-- Any authenticated user can upsert their own row
CREATE POLICY "public_profiles_upsert"
  ON public_profiles FOR ALL
  USING (true)
  WITH CHECK (true);
```

### 0b — RLS policy: public vault items readable by anyone

```sql
-- Allow unauthenticated reads on rows where is_public = true
CREATE POLICY "vault_items_public_read"
  ON vault_items FOR SELECT
  USING (is_public = true);
```

> **Check for conflicts first.** If there is already a catch-all SELECT policy on `vault_items` that restricts to authenticated users, this new policy adds an OR branch — Supabase RLS is permissive (any matching policy grants access). If there is a RESTRICTIVE policy, discuss with coder before running.

---

## Step 1 — New lib: `src/lib/publicProfile.ts`

Create this file. It handles syncing the collector's display name + emoji to Supabase, and fetching a public profile + items for the public page.

```ts
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getProfileSafe } from "@/lib/userProfile";
import type { VaultItem } from "@/lib/vaultModel";

const PROFILE_ID_KEY = "vltd_active_profile_id_v1";

export function getActiveProfileId(): string {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(PROFILE_ID_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

// ─── Sync ────────────────────────────────────────────────────────────────────

/**
 * Upsert this collector's display name + emoji to public_profiles.
 * Call this on app load and whenever the user saves their profile.
 * Silent failure — never throws, never blocks.
 */
export async function syncPublicProfile(): Promise<void> {
  const profileId = getActiveProfileId();
  if (!profileId) return;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { displayName, avatarEmoji } = getProfileSafe();

  await supabase.from("public_profiles").upsert(
    {
      profile_id: profileId,
      display_name: displayName || "Collector",
      avatar_emoji: avatarEmoji || "🗝️",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "profile_id" }
  );
}

// ─── Public page fetch ────────────────────────────────────────────────────────

export type PublicProfile = {
  profileId: string;
  displayName: string;
  avatarEmoji: string;
};

/**
 * Fetch the public profile row for a given profileId.
 * Returns null if not found.
 */
export async function fetchPublicProfile(profileId: string): Promise<PublicProfile | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("public_profiles")
    .select("profile_id, display_name, avatar_emoji")
    .eq("profile_id", profileId)
    .single();

  if (error || !data) return null;

  return {
    profileId: String(data.profile_id),
    displayName: String(data.display_name || "Collector"),
    avatarEmoji: String(data.avatar_emoji || "🗝️"),
  };
}

/**
 * Fetch all public vault items for a given profileId.
 * Uses the anon key — works without auth because of the RLS policy added in Step 0b.
 */
export async function fetchPublicVaultItems(profileId: string): Promise<VaultItem[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("vault_items")
    .select("*")
    .eq("profile_id", profileId)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  // Normalize DB rows to VaultItem shape
  // Mirror the normalization in vaultCloud.ts normalizeRow()
  return data.map((row): VaultItem => ({
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    subtitle: row.subtitle ?? undefined,
    number: row.number ?? undefined,
    grade: row.grade ?? undefined,
    universe: row.universe ?? undefined,
    category: row.category ?? undefined,
    categoryLabel: row.category_label ?? undefined,
    currentValue: typeof row.current_value === "number" ? row.current_value : undefined,
    purchasePrice: typeof row.purchase_price === "number" ? row.purchase_price : undefined,
    imageFrontUrl: row.image_front_url ?? undefined,
    imageBackUrl: row.image_back_url ?? undefined,
    imageFrontStoragePath: row.image_front_storage_path ?? undefined,
    primaryImageKey: row.primary_image_key ?? undefined,
    notes: row.notes ?? undefined,
    status: row.status ?? undefined,
    isPublic: true, // by definition — this query only returns public items
    isNew: false,
    createdAt: row.created_at ? new Date(row.created_at as string).getTime() : Date.now(),
  }));
}

// ─── Share URL ────────────────────────────────────────────────────────────────

/**
 * Build the public vault URL for the current user.
 * Returns null if no profileId is set (e.g. not logged in / profile not initialized).
 */
export function getPublicVaultUrl(): string | null {
  const profileId = getActiveProfileId();
  if (!profileId) return null;

  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? "https://vltd.app";

  return `${base}/v/${profileId}`;
}
```

---

## Step 2 — Sync public profile on app load

**File: wherever the app initializes on load — likely `src/app/layout.tsx` or a top-level client component (e.g. `AppShell.tsx`, `ClientProviders.tsx`, or wherever `syncVaultItemsFromSupabase` is called).**

Add a one-time call:

```ts
import { syncPublicProfile } from "@/lib/publicProfile";

// Fire and forget — non-blocking
void syncPublicProfile();
```

Also call it whenever the user saves their profile (find where `setProfileSafe` is called and add `void syncPublicProfile()` immediately after).

---

## Step 3 — New route: `src/app/v/[profileId]/page.tsx`

Create the directory `src/app/v/[profileId]/` and add `page.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import VaultMuseumView from "@/components/VaultMuseumView";
import {
  fetchPublicProfile,
  fetchPublicVaultItems,
  type PublicProfile,
} from "@/lib/publicProfile";
import type { VaultItem } from "@/lib/vaultModel";

export default function PublicVaultPage() {
  const params = useParams<{ profileId: string }>();
  const profileId = String(params?.profileId ?? "").trim();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!profileId) return;

    let cancelled = false;

    async function load() {
      const [prof, vaultItems] = await Promise.all([
        fetchPublicProfile(profileId),
        fetchPublicVaultItems(profileId),
      ]);

      if (cancelled) return;

      if (!prof && vaultItems.length === 0) {
        setNotFound(true);
      } else {
        setProfile(prof);
        setItems(vaultItems);
      }

      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const displayName = profile?.displayName ?? "Collector";
  const avatarEmoji = profile?.avatarEmoji ?? "🗝️";
  const publicCount = items.length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-sm text-[color:var(--muted)]">Loading vault…</div>
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div
            className="rounded-[28px] p-8 text-center ring-1"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">PUBLIC VAULT</div>
            <h1 className="mt-3 text-xl font-semibold">Vault not found</h1>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              This vault link is invalid or has no public items.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      {/* ── Collector header ── */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{
          background: "var(--bg)",
          borderBottom: "0.5px solid var(--border)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Avatar emoji */}
        <div
          className="flex items-center justify-center rounded-full text-xl"
          style={{
            width: 40,
            height: 40,
            background: "rgba(245,181,72,0.12)",
            border: "1.5px solid rgba(245,181,72,0.3)",
            flexShrink: 0,
          }}
        >
          {avatarEmoji}
        </div>

        {/* Name + count */}
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-[color:var(--fg)]">
            {displayName}&apos;s Vault
          </div>
          <div className="text-[11px] text-[color:var(--muted2)]">
            {publicCount} {publicCount === 1 ? "item" : "items"} on display
          </div>
        </div>

        {/* VLTD wordmark — drives signups */}
        <a
          href="/"
          className="ml-auto flex-shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
          style={{ color: "var(--theme-gold, #F5B548)", letterSpacing: "0.06em" }}
        >
          VLTD
        </a>
      </div>

      {/* ── Museum view ── */}
      {items.length === 0 ? (
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="text-center">
            <div className="text-4xl">🔒</div>
            <div className="mt-3 text-sm text-[color:var(--muted)]">
              No public items yet.
            </div>
          </div>
        </div>
      ) : (
        <VaultMuseumView
          items={items}
          onFilterToUniverse={() => {}}
        />
      )}
    </main>
  );
}
```

---

## Step 4 — "Share vault" button in the vault header

The collector needs a way to find and copy their public vault URL. Add a share button to the vault page header — the simplest place is wherever the vault page title / top action bar lives.

**File: `src/app/vault/page.tsx` (or the vault header component — wherever the "Add Item" or top-right actions are)**

### 4a — Import

```tsx
import { getPublicVaultUrl } from "@/lib/publicProfile";
```

### 4b — State + handler

```tsx
const [copied, setCopied] = useState(false);

async function handleShareVault() {
  const url = getPublicVaultUrl();
  if (!url) return;

  try {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  } catch {
    // fallback: prompt with the URL
    window.prompt("Copy your vault link:", url);
  }
}
```

### 4c — Button in the header

Add alongside the existing top-right vault actions (Export, etc.):

```tsx
<button
  type="button"
  onClick={() => void handleShareVault()}
  className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-medium ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill)]"
  style={{ color: copied ? "var(--theme-gold, #F5B548)" : "var(--muted)" }}
>
  {copied ? (
    <>
      {/* Checkmark */}
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
        <path d="M2 6.5l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Copied!
    </>
  ) : (
    <>
      {/* Share icon */}
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
      </svg>
      Share vault
    </>
  )}
</button>
```

---

## How the share loop works

1. Collector opens vault → taps "Share vault" → link copied to clipboard
2. They paste it on Reddit / Twitter / Discord / eBay listings
3. Anyone clicks the link → lands on `/v/[profileId]` → sees the Museum View with only the items the collector unlocked
4. The "VLTD" pill in the top-right corner links back to the homepage → new collector signups

---

## Verify

```bash
npx tsc --noEmit
npm run build
```

Test checklist:
- [ ] SQL migrations ran: `public_profiles` table exists, `vault_items` has `vault_items_public_read` RLS policy
- [ ] Profile sync: opening the app upserts a row in `public_profiles` for the active profile ID
- [ ] `getPublicVaultUrl()` returns a valid URL with the profileId
- [ ] "Share vault" button copies the URL to clipboard, shows "Copied!" for 2 seconds
- [ ] Visiting `/v/[profileId]` without being logged in: page loads, shows collector header and public items only
- [ ] Items with `is_public = false` do NOT appear on the public page
- [ ] Items with `is_public = true` DO appear in VaultMuseumView
- [ ] Profile not found / no public items: shows "Vault not found" state
- [ ] Zero public items (profile exists but all items private): shows lock emoji + "No public items yet"
- [ ] TypeScript passes with no new errors
- [ ] VaultMuseumView on public page: no lock icon visible (ItemVisibilityToggle is on VaultCard, not on MuseumCard — this should be fine out of the box)

Commit: `feat: public vault URL — /v/[profileId] shows collector's public items, Share vault button copies link`

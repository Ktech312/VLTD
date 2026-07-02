"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createGallery,
  GALLERY_THEME_PACK_OPTIONS,
  loadGalleries,
  saveGalleries,
  type Gallery,
  type GalleryThemePack,
} from "@/lib/galleryModel";
import { getGalleryLimits, mustBePublicGallery } from "@/lib/galleryTier";
import { getUserBonusGalleries } from "@/lib/referral";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getTierSafe } from "@/lib/subscription";

function safeTrim(value: string) {
  return String(value ?? "").trim();
}

export default function NewMuseumGalleryPage() {
  const router = useRouter();

  const tier = getTierSafe();
  const baseLimits = useMemo(() => getGalleryLimits(tier), [tier]);
  const existingGalleries = useMemo(() => loadGalleries(), []);
  const forcePublic = mustBePublicGallery(tier);

  const [bonusGalleries, setBonusGalleries] = useState(0);

  useEffect(() => {
    async function fetchBonus() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const bonus = await getUserBonusGalleries(user.id);
      setBonusGalleries(bonus);
    }
    void fetchBonus();
  }, []);

  const effectiveLimit =
    baseLimits.galleries === Infinity ? Infinity : baseLimits.galleries + bonusGalleries;

  const canCreate = effectiveLimit === Infinity || existingGalleries.length < effectiveLimit;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Free tier exhibitions must be PUBLIC
  const [visibility, setVisibility] = useState<Gallery["visibility"]>(
    forcePublic ? "PUBLIC" : "LOCKED"
  );
  const [state, setState] = useState<Gallery["state"]>("ACTIVE");
  const [themePack, setThemePack] = useState<GalleryThemePack>("classic");
  const [displayMode, setDisplayMode] = useState<"grid" | "shelf">("grid");
  const [guestViewMode, setGuestViewMode] = useState<"public" | "guest">("public");
  const [adultOnly, setAdultOnly] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const remaining =
    effectiveLimit === Infinity
      ? Infinity
      : Math.max(0, effectiveLimit - existingGalleries.length);

  async function handleCreate() {
    if (submitting) return;
    if (!canCreate) return;

    const cleanTitle = safeTrim(title);
    if (!cleanTitle) return;

    setSubmitting(true);

    try {
      const next = createGallery(cleanTitle);

      const updated: Gallery = {
        ...next,
        description: safeTrim(description),
        visibility,
        state,
        themePack,
        displayMode,
        guestViewMode,
        adultOnly,
        updatedAt: Date.now(),
      };

      saveGalleries([...existingGalleries, updated]);
      router.push(`/museum/${updated.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="text-[color:var(--fg)]">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <Link
            href="/museum"
            className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
          >
            ← Back to Exhibitions
          </Link>

          <Link
            href="/collector"
            className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
          >
            Collector Profile
          </Link>
        </div>

        <section className="relative overflow-hidden rounded-[26px] border border-[color:var(--theme-border)] bg-[color:var(--theme-card)] p-5 shadow-[0_18px_54px_rgba(0,0,0,0.3)] sm:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),rgba(255,255,255,0)_28%),radial-gradient(circle_at_75%_0%,rgba(255,205,120,0.06),rgba(255,205,120,0)_22%)]" />

          <div className="relative">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              MUSEUM
            </div>

            <h1 className="mt-2 text-3xl font-semibold sm:text-[2.2rem]">
              Create Exhibition
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
              Start a new curated gallery with your preferred visibility, theme pack,
              display mode, and guest view behavior. You can refine exhibits, items,
              notes, shelves, and sharing after creation.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[20px] bg-[color:var(--theme-elevated)] p-4 ring-1 ring-[color:var(--theme-border)]">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  TIER
                </div>
                <div className="mt-2 text-2xl font-semibold">{tier}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Current subscription
                </div>
              </div>

              <div className="rounded-[20px] bg-[color:var(--theme-elevated)] p-4 ring-1 ring-[color:var(--theme-border)]">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  CURRENT EXHIBITIONS
                </div>
                <div className="mt-2 text-2xl font-semibold">{existingGalleries.length}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  In active profile
                </div>
              </div>

              <div className="rounded-[20px] bg-[color:var(--theme-elevated)] p-4 ring-1 ring-[color:var(--theme-border)]">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  REMAINING
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {remaining === Infinity ? "∞" : remaining}
                </div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Available slots
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
            EXHIBITION SETUP
          </div>
          <h2 className="mt-2 text-xl font-semibold">Basic Information</h2>

          <div className="mt-5 grid gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium">Exhibition Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Hall of Grails"
                className="min-h-[46px] w-full rounded-2xl bg-[color:var(--input)] px-4 py-3 ring-1 ring-[color:var(--border)] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Write a short curatorial description for this gallery..."
                className="w-full rounded-2xl bg-[color:var(--input)] px-4 py-3 ring-1 ring-[color:var(--border)] focus:outline-none"
              />
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              ACCESS
            </div>
            <h2 className="mt-2 text-xl font-semibold">Visibility + State</h2>

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Visibility</label>
                {forcePublic ? (
                  <div className="flex items-center gap-2 min-h-[46px] w-full rounded-2xl bg-[color:var(--input)] px-4 py-3 ring-1 ring-[color:var(--border)]">
                    <span className="text-sm text-[color:var(--fg)]">Public</span>
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted2)]">
                      Free plan · <a href="/account/billing" className="underline">Upgrade</a> for private
                    </span>
                  </div>
                ) : (
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as Gallery["visibility"])}
                    className="min-h-[46px] w-full rounded-2xl bg-[color:var(--input)] px-4 py-3 ring-1 ring-[color:var(--border)] focus:outline-none"
                  >
                    <option value="PUBLIC">Public</option>
                    <option value="INVITE">Invite Only</option>
                    <option value="LOCKED">Locked</option>
                  </select>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">State</label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value as Gallery["state"])}
                  className="min-h-[46px] w-full rounded-2xl bg-[color:var(--input)] px-4 py-3 ring-1 ring-[color:var(--border)] focus:outline-none"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="STORAGE">Storage</option>
                </select>
              </div>

              <label className="flex items-start justify-between gap-4 rounded-2xl bg-[color:var(--input)] px-4 py-3 ring-1 ring-[color:var(--border)]">
                <span>
                  <span className="block text-sm font-medium">18+ gallery</span>
                  <span className="mt-1 block text-xs leading-5 text-[color:var(--muted)]">
                    Require public viewers to confirm they are 18 or older before viewing this gallery.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={adultOnly}
                  onChange={(e) => setAdultOnly(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-cyan-400"
                />
              </label>
            </div>
          </div>

          <div className="rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              PRESENTATION
            </div>
            <h2 className="mt-2 text-xl font-semibold">Theme + Display</h2>

            <div className="mt-5 grid gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Theme Pack</label>
                <select
                  value={themePack}
                  onChange={(e) => setThemePack(e.target.value as GalleryThemePack)}
                  className="min-h-[46px] w-full rounded-2xl bg-[color:var(--input)] px-4 py-3 ring-1 ring-[color:var(--border)] focus:outline-none"
                >
                  {GALLERY_THEME_PACK_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Display Mode</label>
                <select
                  value={displayMode}
                  onChange={(e) => setDisplayMode(e.target.value as "grid" | "shelf")}
                  className="min-h-[46px] w-full rounded-2xl bg-[color:var(--input)] px-4 py-3 ring-1 ring-[color:var(--border)] focus:outline-none"
                >
                  <option value="grid">Grid</option>
                  <option value="shelf">Shelf</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">Guest View Mode</label>
                <select
                  value={guestViewMode}
                  onChange={(e) => setGuestViewMode(e.target.value as "public" | "guest")}
                  className="min-h-[46px] w-full rounded-2xl bg-[color:var(--input)] px-4 py-3 ring-1 ring-[color:var(--border)] focus:outline-none"
                >
                  <option value="public">Public</option>
                  <option value="guest">Guest</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
          <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
            CREATE
          </div>
          <h2 className="mt-2 text-xl font-semibold">Finish Setup</h2>

          {!canCreate ? (
            <div className="mt-4 rounded-[20px] bg-[color:var(--input)] p-4 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
              You have reached your current gallery limit for this profile.
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate || !safeTrim(title) || submitting}
              className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-5 py-2 text-sm font-semibold text-[color:var(--fg)] transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Exhibition"}
            </button>

            <Link
              href="/museum"
              className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill)] px-5 py-2 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
            >
              Cancel
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

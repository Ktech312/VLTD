"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getGalleryScore } from "@/lib/galleryScore";
import {
  GALLERY_EVENT,
  deleteGallery,
  loadGalleries,
  type Gallery,
} from "@/lib/galleryModel";
import { getGalleryLimits } from "@/lib/galleryTier";
import { getTierSafe, onTierChange, type Tier } from "@/lib/subscription";
import { loadItems, type VaultItem } from "@/lib/vaultModel";
import { getVaultImagePublicUrl } from "@/lib/vaultCloud";

const ACTIVE_PROFILE_EVENT = "vltd:active-profile";

function visibilityLabel(v: Gallery["visibility"]) {
  if (v === "LOCKED") return "Locked";
  if (v === "INVITE") return "Invite Only";
  return "Public";
}

function stateLabel(v: Gallery["state"]) {
  return v === "STORAGE" ? "Storage" : "Active";
}

function scoreBandTone(band: "Basic" | "Curated" | "Exhibition Grade") {
  if (band === "Exhibition Grade") return "Exhibition Grade";
  if (band === "Curated") return "Curated";
  return "Basic";
}

function galleryValue(gallery: Gallery, itemsById: Map<string, VaultItem>) {
  return gallery.itemIds.reduce((sum, itemId) => {
    const item = itemsById.get(itemId);
    return sum + Number(item?.currentValue ?? 0);
  }, 0);
}

function resolveGalleryImage(value?: string | null) {
  const next = String(value ?? "").trim();
  if (!next) return "";
  if (
    next.startsWith("http://") ||
    next.startsWith("https://") ||
    next.startsWith("data:") ||
    next.startsWith("blob:")
  ) {
    return next;
  }
  return getVaultImagePublicUrl(next);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function MuseumPage() {
  const router = useRouter();

  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [tier, setTier] = useState<Tier>(getTierSafe());
  const [galleryPendingDelete, setGalleryPendingDelete] = useState<Gallery | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  function refresh() {
    setGalleries(loadGalleries());
    setItems(loadItems());
  }

  useEffect(() => {
    refresh();

    function onGalleryChange() {
      refresh();
    }

    function onActiveProfileChange() {
      refresh();
    }

    window.addEventListener(GALLERY_EVENT, onGalleryChange);
    window.addEventListener(ACTIVE_PROFILE_EVENT, onActiveProfileChange);

    return () => {
      window.removeEventListener(GALLERY_EVENT, onGalleryChange);
      window.removeEventListener(ACTIVE_PROFILE_EVENT, onActiveProfileChange);
    };
  }, []);

  useEffect(() => {
    const unsub = onTierChange((next) => setTier(next));
    return unsub;
  }, []);

  const limits = useMemo(() => getGalleryLimits(tier), [tier]);
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const scoredGalleries = useMemo(() => {
    return galleries.map((gallery) => {
      const score = getGalleryScore(gallery, items);
      const totalValue = galleryValue(gallery, itemsById);
      const views = gallery.analytics?.views ?? 0;

      return {
        gallery,
        score,
        totalValue,
        views,
      };
    });
  }, [galleries, items, itemsById]);

  const stats = useMemo(() => {
    const active = galleries.filter((g) => g.state === "ACTIVE").length;
    const storage = galleries.filter((g) => g.state === "STORAGE").length;
    const publicCount = galleries.filter((g) => g.visibility === "PUBLIC").length;
    const totalViews = galleries.reduce((sum, g) => sum + (g.analytics?.views ?? 0), 0);

    return {
      total: galleries.length,
      active,
      storage,
      publicCount,
      totalViews,
    };
  }, [galleries]);

  const strongestGallery = useMemo(
    () => [...scoredGalleries].sort((a, b) => b.score.score - a.score.score)[0] ?? null,
    [scoredGalleries]
  );

  const mostViewedGallery = useMemo(
    () => [...scoredGalleries].sort((a, b) => b.views - a.views)[0] ?? null,
    [scoredGalleries]
  );

  const mostValuableGallery = useMemo(
    () => [...scoredGalleries].sort((a, b) => b.totalValue - a.totalValue)[0] ?? null,
    [scoredGalleries]
  );

  const orderedGalleries = useMemo(() => {
    return [...scoredGalleries].sort((a, b) => {
      if (b.score.score !== a.score.score) return b.score.score - a.score.score;
      if (b.views !== a.views) return b.views - a.views;
      return b.totalValue - a.totalValue;
    });
  }, [scoredGalleries]);

  function openGallery(galleryId: string) {
    router.push(`/museum/${galleryId}`);
  }

  function handleAskDelete(gallery: Gallery) {
    setGalleryPendingDelete(gallery);
  }

  function handleCancelDelete() {
    if (isDeleting) return;
    setGalleryPendingDelete(null);
  }

  async function handleConfirmDelete() {
    if (!galleryPendingDelete || isDeleting) return;

    setIsDeleting(true);

    try {
      deleteGallery(galleryPendingDelete.id);
      refresh();
      setGalleryPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
        <section className="vltd-panel-main relative overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-5 py-5 shadow-[0_18px_54px_rgba(0,0,0,0.3)] sm:px-6 sm:py-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),rgba(255,255,255,0)_28%),radial-gradient(circle_at_75%_0%,rgba(255,205,120,0.06),rgba(255,205,120,0)_22%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.18))]" />

          <div className="relative flex flex-col gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
                  MUSEUM
                </div>

                <h1 className="mt-2 text-3xl font-semibold sm:text-[2.2rem]">
                  Curated Galleries
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
                  Build editorial, museum-style presentations from the active profile’s
                  collection with public, locked, and invite-only sharing.
                </p>
              </div>

              <div className="shrink-0">
                <Link
                  href="/museum/new"
                  className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-ring)] vltd-pill-main-glow transition hover:bg-[color:var(--pill-hover)]"
                >
                  Add Gallery
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-[20px] bg-black/16 p-4 ring-1 ring-white/8">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  TOTAL
                </div>
                <div className="mt-2 text-2xl font-semibold">{stats.total}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  All galleries
                </div>
              </div>

              <div className="rounded-[20px] bg-black/16 p-4 ring-1 ring-white/8">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  ACTIVE
                </div>
                <div className="mt-2 text-2xl font-semibold">{stats.active}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Live exhibitions
                </div>
              </div>

              <div className="rounded-[20px] bg-black/16 p-4 ring-1 ring-white/8">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  PUBLIC
                </div>
                <div className="mt-2 text-2xl font-semibold">{stats.publicCount}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Share-ready galleries
                </div>
              </div>

              <div className="rounded-[20px] bg-black/16 p-4 ring-1 ring-white/8">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  TOTAL VIEWS
                </div>
                <div className="mt-2 text-2xl font-semibold">{stats.totalViews}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Audience engagement
                </div>
              </div>

              <div className="rounded-[20px] bg-black/16 p-4 ring-1 ring-white/8">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  TIER LIMIT
                </div>
                <div className="mt-2 text-2xl font-semibold">
                  {limits.galleries === Infinity ? "∞" : limits.galleries}
                </div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  {limits.galleries === Infinity ? "Unlimited" : "Per active profile"}
                </div>
              </div>
            </div>
          </div>
        </section>

        {galleries.length > 0 ? (
          <section className="mt-6 grid gap-5 xl:grid-cols-3">
            <div className="vltd-panel-soft rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
              <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
                STRONGEST GALLERY
              </div>
              <h2 className="mt-2 text-xl font-semibold">
                {strongestGallery?.gallery.title || "—"}
              </h2>
              <div className="mt-3 text-sm text-[color:var(--muted)]">
                {strongestGallery
                  ? `${strongestGallery.score.score}/100 • ${scoreBandTone(strongestGallery.score.band)}`
                  : "No gallery signal yet."}
              </div>
              {strongestGallery ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                    {strongestGallery.gallery.itemIds.length} items
                  </span>
                  <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                    {strongestGallery.score.signals.sections} sections
                  </span>
                  <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                    {strongestGallery.score.signals.featuredWorks} featured
                  </span>
                </div>
              ) : null}
            </div>

            <div className="vltd-panel-soft rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
              <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
                MOST VIEWED
              </div>
              <h2 className="mt-2 text-xl font-semibold">
                {mostViewedGallery?.gallery.title || "—"}
              </h2>
              <div className="mt-3 text-sm text-[color:var(--muted)]">
                {mostViewedGallery
                  ? `${mostViewedGallery.views} views • ${scoreBandTone(mostViewedGallery.score.band)}`
                  : "No audience data yet."}
              </div>
              {mostViewedGallery ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                    {mostViewedGallery.gallery.visibility}
                  </span>
                  <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                    {stateLabel(mostViewedGallery.gallery.state)}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="vltd-panel-soft rounded-[24px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
              <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
                MOST VALUABLE
              </div>
              <h2 className="mt-2 text-xl font-semibold">
                {mostValuableGallery?.gallery.title || "—"}
              </h2>
              <div className="mt-3 text-sm text-[color:var(--muted)]">
                {mostValuableGallery
                  ? `${formatMoney(mostValuableGallery.totalValue)} total exhibit value`
                  : "No value data yet."}
              </div>
              {mostValuableGallery ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                    {mostValuableGallery.gallery.itemIds.length} items
                  </span>
                  <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                    {mostValuableGallery.score.score}/100 score
                  </span>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="mt-6">
          {galleries.length === 0 ? (
            <div className="vltd-panel-main rounded-[26px] bg-[color:var(--surface)] p-7 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
              <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
                START THE MUSEUM
              </div>

              <h2 className="mt-3 text-2xl font-semibold">No galleries yet</h2>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
                Create your first gallery from the active profile and shape a public or
                private museum-quality story.
              </p>

              <div className="mt-6">
                <Link
                  href="/museum/new"
                  className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-[color:var(--pill)] px-5 py-2 text-sm font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--pill-active-ring)] vltd-pill-main-glow transition hover:bg-[color:var(--pill-hover)]"
                >
                  Create First Gallery
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {orderedGalleries.map(({ gallery, score, totalValue, views }) => {
                const coverImage = resolveGalleryImage(gallery.coverImage);

                return (
                  <article
                    key={gallery.id}
                    className="vltd-panel-soft group relative overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] p-5 shadow-[0_16px_42px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_56px_rgba(0,0,0,0.28)]"
                  >
                    {coverImage ? (
                      <>
                        <div
                          className="absolute inset-0 opacity-30"
                          style={{
                            backgroundImage: `url(${coverImage})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                        />
                        <div className="absolute inset-0 bg-black/55" />
                      </>
                    ) : null}

                    <div className="relative">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                          CURATED GALLERY
                        </div>

                        <div className="flex items-start gap-2">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <span className="rounded-full bg-black/20 px-2.5 py-1 text-[10px] tracking-[0.14em] text-[color:var(--muted2)] ring-1 ring-white/10">
                              {visibilityLabel(gallery.visibility)}
                            </span>

                            <span className="rounded-full bg-black/20 px-2.5 py-1 text-[10px] tracking-[0.14em] text-[color:var(--muted2)] ring-1 ring-white/10">
                              {stateLabel(gallery.state)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleAskDelete(gallery);
                            }}
                            className="inline-flex min-h-[32px] items-center justify-center rounded-full bg-[rgba(120,18,18,0.68)] px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-red-400/30 transition hover:bg-[rgba(145,20,20,0.88)]"
                            aria-label={`Delete gallery ${gallery.title}`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openGallery(gallery.id)}
                        className="mt-4 block w-full text-left"
                      >
                        <h2 className="line-clamp-2 text-2xl font-semibold leading-tight">
                          {gallery.title}
                        </h2>

                        <p className="mt-3 line-clamp-3 min-h-[60px] text-sm leading-6 text-[color:var(--muted)]">
                          {gallery.description?.trim()
                            ? gallery.description
                            : "A museum-style presentation built from selected collection pieces."}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                            Score {score.score}/100
                          </span>
                          <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                            {scoreBandTone(score.band)}
                          </span>
                          <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                            {views} views
                          </span>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3 rounded-[20px] bg-black/20 px-4 py-3 ring-1 ring-white/8">
                          <div>
                            <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                              ITEMS
                            </div>
                            <div className="mt-1 text-xl font-semibold">{gallery.itemIds.length}</div>
                          </div>

                          <div>
                            <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                              VALUE
                            </div>
                            <div className="mt-1 text-xl font-semibold">{formatMoney(totalValue)}</div>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between text-sm text-[color:var(--muted)]">
                          <div>
                            {score.signals.sections} sections • {score.signals.featuredWorks} featured
                          </div>
                          <div className="transition group-hover:translate-x-0.5">Open →</div>
                        </div>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {galleryPendingDelete ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              DELETE GALLERY
            </div>

            <h2 className="mt-3 text-2xl font-semibold">
              Delete Gallery "{galleryPendingDelete.title}"?
            </h2>

            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              This will delete gallery "{galleryPendingDelete.title}". Are you sure you want to.
            </p>

            <p className="mt-4 text-sm text-[color:var(--muted)]">
              Deleting this Gallery will not delete items in your Vault.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-[rgba(145,20,20,0.92)] px-5 py-2 text-sm font-semibold text-white ring-1 ring-red-400/30 transition hover:bg-[rgba(170,24,24,1)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Yes Delete FOREVER"}
              </button>

              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-[color:var(--pill)] px-5 py-2 text-sm font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel, save My Gallery
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

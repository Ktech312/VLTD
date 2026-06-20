"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
function IconLayoutTemplate({ size = 24, style }: { size?: number; style?: Record<string, string | number> }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <rect x="3" y="3" width="18" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}

import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { getGalleryScore } from "@/lib/galleryScore";
import {
  GALLERY_EVENT,
  deleteGallery,
  loadGalleries,
  refreshGalleriesFromSupabase,
  updateGallery,
  type Gallery,
} from "@/lib/galleryModel";
import { getGalleryLimits } from "@/lib/galleryTier";
import { getTierSafe, onTierChange, type Tier } from "@/lib/subscription";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { loadItems, type VaultItem } from "@/lib/vaultModel";
import { getVaultImagePublicUrl } from "@/lib/vaultCloud";

const ACTIVE_PROFILE_EVENT = "vltd:active-profile";
const GALLERY_ASSET_BUCKET = "gallery-backgrounds";

function visibilityLabel(v: Gallery["visibility"]) {
  if (v === "LOCKED") return "Locked";
  if (v === "INVITE") return "Invite Only";
  return "Public";
}

function stateLabel(v: Gallery["state"]) {
  return v === "STORAGE" ? "Storage" : "Active";
}

function visibilityPillClass(v: Gallery["visibility"]) {
  if (v === "PUBLIC") return "bg-gold/14 text-cyan-100 ring-cyan-300/28";
  if (v === "INVITE") return "bg-amber-400/14 text-amber-100 ring-amber-300/28";
  return "bg-[color:var(--pill)] text-[color:var(--muted2)] ring-[color:var(--theme-border)]";
}

function statePillClass(v: Gallery["state"]) {
  if (v === "ACTIVE") return "bg-emerald-500/14 text-emerald-200 ring-emerald-400/25";
  return "bg-[color:var(--theme-elevated)] text-[color:var(--muted2)] ring-[color:var(--theme-border)]";
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

async function uploadGalleryCover(galleryId: string, file: File) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase storage is not available for gallery cover uploads.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${galleryId}/cover/${Date.now()}_${safeName}`;

  const { error } = await supabase.storage.from(GALLERY_ASSET_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: true,
    contentType: file.type || "application/octet-stream",
  });

  if (error) throw error;

  const { data } = supabase.storage.from(GALLERY_ASSET_BUCKET).getPublicUrl(path);
  const publicUrl = typeof data?.publicUrl === "string" ? data.publicUrl.trim() : "";
  if (!publicUrl) throw new Error("Failed to resolve uploaded gallery cover URL.");

  return publicUrl;
}

export default function MuseumPage() {
  const router = useRouter();

  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [tier, setTier] = useState<Tier>(getTierSafe());
  const [galleryPendingDelete, setGalleryPendingDelete] = useState<Gallery | null>(null);
  const [gallerySettings, setGallerySettings] = useState<Gallery | null>(null);
  const [coverTargetGallery, setCoverTargetGallery] = useState<Gallery | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  function refresh() {
    setGalleries(loadGalleries());
    setItems(loadItems());
  }

  useEffect(() => {
    refresh();
    void refreshGalleriesFromSupabase(true);

    function onGalleryChange() {
      refresh();
    }

    function onActiveProfileChange() {
      refresh();
    }

    function onWindowFocus() {
      refresh();
      void refreshGalleriesFromSupabase(true);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        refresh();
        void refreshGalleriesFromSupabase(true);
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshGalleriesFromSupabase(true);
      }
    }, 15000);

    window.addEventListener(GALLERY_EVENT, onGalleryChange);
    window.addEventListener(ACTIVE_PROFILE_EVENT, onActiveProfileChange);
    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener(GALLERY_EVENT, onGalleryChange);
      window.removeEventListener(ACTIVE_PROFILE_EVENT, onActiveProfileChange);
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(intervalId);
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

  function handleOpenCoverPicker(gallery: Gallery) {
    setCoverTargetGallery(gallery);
    coverInputRef.current?.click();
  }

  async function handleCoverSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !coverTargetGallery || isUploadingCover) return;

    setIsUploadingCover(true);
    setStatusMessage("Uploading gallery cover...");

    try {
      const publicUrl = await uploadGalleryCover(coverTargetGallery.id, file);
      updateGallery({ ...coverTargetGallery, coverImage: publicUrl });
      refresh();
      setStatusMessage("Exhibition cover updated.");
    } catch (error) {
      console.error("Failed uploading gallery cover:", error);
      setStatusMessage(error instanceof Error ? error.message : "Exhibition cover upload failed.");
    } finally {
      setIsUploadingCover(false);
      setCoverTargetGallery(null);
    }
  }

  function handleSaveGallerySettings() {
    if (!gallerySettings) return;
    updateGallery(gallerySettings);
    refresh();
    setGallerySettings(null);
    setStatusMessage("Exhibition settings updated.");
  }

  return (
    <main className="min-h-screen text-[color:var(--fg)]">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void handleCoverSelection(event)}
        />

        <section className="relative overflow-hidden rounded-[18px] px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.2)]" style={{ background: 'var(--theme-card, rgba(15,25,45,0.85))', border: '1px solid var(--theme-border, rgba(245,181,72,0.12))' }}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),rgba(255,255,255,0)_28%),radial-gradient(circle_at_75%_0%,rgba(255,205,120,0.06),rgba(255,205,120,0)_22%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.18))]" />

          <div className="relative flex flex-col gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
                  MUSEUM
                </div>

                <h1 className="mt-2 text-3xl font-semibold sm:text-[2.2rem]">
                  Curated Exhibitions
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
                  Add Exhibit
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-[14px] p-2.5" style={{ background: 'var(--theme-card, rgba(15,25,45,0.85))', border: '1px solid var(--theme-border, rgba(245,181,72,0.12))' }}>
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  TOTAL
                </div>
                <div className="mt-2 text-2xl font-semibold">{stats.total}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  All exhibits
                </div>
              </div>

              <div className="rounded-[14px] p-2.5" style={{ background: 'var(--theme-card, rgba(15,25,45,0.85))', border: '1px solid var(--theme-border, rgba(245,181,72,0.12))' }}>
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  ACTIVE
                </div>
                <div className="mt-2 text-2xl font-semibold">{stats.active}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Live exhibitions
                </div>
              </div>

              <div className="rounded-[14px] p-2.5" style={{ background: 'var(--theme-card, rgba(15,25,45,0.85))', border: '1px solid var(--theme-border, rgba(245,181,72,0.12))' }}>
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  PUBLIC
                </div>
                <div className="mt-2 text-2xl font-semibold">{stats.publicCount}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Share-ready exhibits
                </div>
              </div>

              <div className="rounded-[14px] p-2.5" style={{ background: 'var(--theme-card, rgba(15,25,45,0.85))', border: '1px solid var(--theme-border, rgba(245,181,72,0.12))' }}>
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  TOTAL VIEWS
                </div>
                <div className="mt-2 text-2xl font-semibold">{stats.totalViews}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">
                  Audience engagement
                </div>
              </div>

              <div className="rounded-[14px] p-2.5" style={{ background: 'var(--theme-card, rgba(15,25,45,0.85))', border: '1px solid var(--theme-border, rgba(245,181,72,0.12))' }}>
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
                STRONGEST EXHIBIT
              </div>
              <h2 className="mt-2 text-xl font-semibold">
                {strongestGallery?.gallery.title || "—"}
              </h2>
              <div className="mt-3 text-sm text-[color:var(--muted)]">
                {strongestGallery
                  ? `${strongestGallery.score.score}/100 • ${scoreBandTone(strongestGallery.score.band)}`
                  : "No exhibit signal yet."}
              </div>
              {strongestGallery ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-[color:var(--theme-elevated)] px-3 py-1 text-xs ring-1 ring-black/10">
                    {strongestGallery.gallery.itemIds.length} items
                  </span>
                  <span className="rounded-full bg-[color:var(--theme-elevated)] px-3 py-1 text-xs ring-1 ring-black/10">
                    {strongestGallery.score.signals.sections} sections
                  </span>
                  <span className="rounded-full bg-[color:var(--theme-elevated)] px-3 py-1 text-xs ring-1 ring-black/10">
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
                  <span className="rounded-full bg-[color:var(--theme-elevated)] px-3 py-1 text-xs ring-1 ring-black/10">
                    {mostViewedGallery.gallery.visibility}
                  </span>
                  <span className="rounded-full bg-[color:var(--theme-elevated)] px-3 py-1 text-xs ring-1 ring-black/10">
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
                  <span className="rounded-full bg-[color:var(--theme-elevated)] px-3 py-1 text-xs ring-1 ring-black/10">
                    {mostValuableGallery.gallery.itemIds.length} items
                  </span>
                  <span className="rounded-full bg-[color:var(--theme-elevated)] px-3 py-1 text-xs ring-1 ring-black/10">
                    {mostValuableGallery.score.score}/100 score
                  </span>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="mt-6">
          {statusMessage ? (
            <div className="mb-4 rounded-2xl bg-[color:var(--surface)] px-4 py-3 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
              {statusMessage}
            </div>
          ) : null}

          {galleries.length === 0 ? (
            <div
              className="rounded-[26px] border p-8 text-center"
              style={{
                background: "var(--theme-card, rgba(15,25,45,0.85))",
                borderColor: "var(--theme-border, rgba(245,181,72,0.12))",
              }}
            >
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  background: "var(--theme-gold-subtle, rgba(245,181,72,0.10))",
                  border: "1px solid var(--theme-gold-border, rgba(245,181,72,0.25))",
                }}
              >
                <IconLayoutTemplate size={24} style={{ color: "var(--theme-gold, #F5B548)" }} />
              </div>

              <h2 className="text-xl font-black" style={{ color: "var(--theme-text-primary, #F0EAD6)" }}>
                Your museum is waiting
              </h2>

              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed" style={{ color: "var(--theme-text-muted, #A0956B)" }}>
                Create your first gallery and shape a museum-quality story from your collection — public or private.
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                  href="/museum/new"
                  className="inline-flex min-h-[40px] items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition"
                  style={{
                    background: "linear-gradient(135deg, #8B6914 0%, #C8941F 25%, #F5B548 50%, #FFE08A 70%, #C8941F 100%)",
                    color: "#0B0B0B",
                  }}
                >
                  Create First Exhibition
                </Link>
                <Link
                  href="/vault"
                  className="inline-flex min-h-[40px] items-center justify-center rounded-full border px-5 py-2 text-sm font-semibold transition"
                  style={{
                    borderColor: "var(--theme-gold-border, rgba(245,181,72,0.30))",
                    color: "var(--theme-gold, #F5B548)",
                  }}
                >
                  Browse your vault →
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid justify-center gap-5 [grid-template-columns:repeat(auto-fill,minmax(300px,360px))]">
              {orderedGalleries.map(({ gallery, score, totalValue, views }) => {
                const coverImage = resolveGalleryImage(gallery.coverImage);

                return (
                  <article
                    key={gallery.id}
                    onClick={() => openGallery(gallery.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openGallery(gallery.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open gallery ${gallery.title}`}
                    className="vltd-panel-soft group relative flex h-[430px] w-full max-w-[360px] cursor-pointer flex-col overflow-hidden rounded-[22px] border border-[color:var(--theme-border)] bg-[color:var(--theme-card)] p-4 shadow-[0_16px_42px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_56px_rgba(0,0,0,0.28)]"
                  >
                    <div className="relative mb-4 h-[188px] overflow-hidden rounded-[18px] bg-[color:var(--theme-elevated)] ring-1 ring-[color:var(--theme-border)]">
                      {coverImage ? (
                        <ProgressiveImage
                          src={coverImage}
                          alt={`${gallery.title} cover`}
                          className="h-full w-full"
                          imageClassName="object-cover object-center transition duration-300 group-hover:scale-[1.03]"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/32">
                          No cover
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleOpenCoverPicker(gallery);
                        }}
                        disabled={isUploadingCover}
                        className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gold/18 text-lg font-semibold text-cyan-100 ring-1 ring-cyan-300/35 transition hover:bg-gold/28 disabled:opacity-50"
                        aria-label={`Change cover image for ${gallery.title}`}
                      >
                        +
                      </button>
                    </div>

                    <div className="relative flex min-h-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                          CURATED EXHIBIT
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setGallerySettings(gallery);
                            }}
                            className={[
                              "rounded-full px-2.5 py-1 text-[10px] tracking-[0.14em] ring-1 transition hover:ring-cyan-300/40",
                              visibilityPillClass(gallery.visibility),
                            ].join(" ")}
                          >
                            {visibilityLabel(gallery.visibility)}
                          </button>

                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setGallerySettings(gallery);
                            }}
                            className={[
                              "rounded-full px-2.5 py-1 text-[10px] tracking-[0.14em] ring-1 transition hover:ring-cyan-300/30",
                              statePillClass(gallery.state),
                            ].join(" ")}
                          >
                            {stateLabel(gallery.state)}
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex min-h-0 flex-1 flex-col text-left">
                        <h2 className="line-clamp-2 text-xl font-semibold leading-tight">
                          {gallery.title}
                        </h2>

                        <p className="mt-2 line-clamp-2 text-sm leading-5 text-[color:var(--muted)]">
                          {gallery.description?.trim()
                            ? gallery.description
                            : "A museum-style presentation built from selected collection pieces."}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="rounded-full bg-[color:var(--theme-elevated)] px-3 py-1 text-xs ring-1 ring-black/10">
                            Score {score.score}/100
                          </span>
                          <span className="rounded-full bg-[color:var(--theme-elevated)] px-3 py-1 text-xs ring-1 ring-black/10">
                            {scoreBandTone(score.band)}
                          </span>
                          <span className="rounded-full bg-[color:var(--theme-elevated)] px-3 py-1 text-xs ring-1 ring-black/10">
                            {views} views
                          </span>
                        </div>

                        <div className="mt-auto grid grid-cols-2 gap-3 rounded-[18px] bg-[color:var(--theme-elevated)] px-3 py-2.5 ring-1 ring-[color:var(--theme-border)]">
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

                        <div className="mt-3 flex items-center justify-between gap-3 text-sm text-[color:var(--muted)]">
                          <div>
                            {score.signals.sections} sections • {score.signals.featuredWorks} featured
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleAskDelete(gallery);
                            }}
                            className="order-first inline-flex min-h-[28px] items-center justify-center rounded-full bg-red-500/10 px-3 py-1 text-[11px] font-semibold text-red-100 ring-1 ring-red-400/20 transition hover:bg-red-500/18"
                            aria-label={`Delete exhibit ${gallery.title}`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
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
              DELETE EXHIBIT
            </div>

            <h2 className="mt-3 text-2xl font-semibold">
              Delete Exhibit: {galleryPendingDelete.title}?
            </h2>

            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              This will delete exhibit {galleryPendingDelete.title}. Are you sure you want to continue?
            </p>

            <p className="mt-4 text-sm text-[color:var(--muted)]">
              Deleting this Exhibit will not delete items in your Vault.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-[rgba(145,20,20,0.92)] px-5 py-2 text-sm font-semibold text-text-primary ring-1 ring-red-400/30 transition hover:bg-[rgba(170,24,24,1)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? "Deleting..." : "Yes Delete FOREVER"}
              </button>

              <button
                type="button"
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-[color:var(--pill)] px-5 py-2 text-sm font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel, keep My Exhibit
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {gallerySettings ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[26px] bg-[color:var(--surface)] p-5 ring-1 ring-[color:var(--border)] shadow-[0_30px_90px_rgba(0,0,0,0.42)]">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              EXHIBIT STATUS
            </div>
            <h2 className="mt-2 text-xl font-semibold">{gallerySettings.title}</h2>

            <label className="mt-5 block text-xs font-semibold tracking-[0.16em] text-[color:var(--muted2)]">
              Visibility
            </label>
            <select
              value={gallerySettings.visibility}
              onChange={(event) =>
                setGallerySettings((current) =>
                  current ? { ...current, visibility: event.target.value as Gallery["visibility"] } : current
                )
              }
              className="mt-2 h-11 w-full rounded-2xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            >
              <option value="PUBLIC">Public</option>
              <option value="INVITE">Invite Only</option>
              <option value="LOCKED">Locked</option>
            </select>

            <label className="mt-4 block text-xs font-semibold tracking-[0.16em] text-[color:var(--muted2)]">
              State
            </label>
            <select
              value={gallerySettings.state}
              onChange={(event) =>
                setGallerySettings((current) =>
                  current ? { ...current, state: event.target.value as Gallery["state"] } : current
                )
              }
              className="mt-2 h-11 w-full rounded-2xl bg-[color:var(--pill)] px-3 text-sm ring-1 ring-[color:var(--border)] focus:outline-none"
            >
              <option value="ACTIVE">Active</option>
              <option value="STORAGE">Storage</option>
            </select>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGallerySettings(null)}
                className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-semibold ring-1 ring-[color:var(--border)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveGallerySettings}
                className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-gold/16 px-4 py-2 text-sm font-semibold text-cyan-100 ring-1 ring-cyan-300/30"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

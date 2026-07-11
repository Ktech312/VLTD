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
import { getUserBonusGalleries } from "@/lib/referral";
import { getTierSafe, onTierChange, type Tier } from "@/lib/subscription";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getPrimaryImageUrl, loadItems, type VaultItem } from "@/lib/vaultModel";
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

function gradeLetter(band: "Basic" | "Curated" | "Exhibition Grade") {
  if (band === "Exhibition Grade") return "A+";
  if (band === "Curated") return "A";
  return "B+";
}

type ExhibitionFilter = "ACTIVE" | "DRAFTS" | "PUBLIC" | "PRIVATE" | "INVITE";
const EXHIBITION_FILTERS: { key: ExhibitionFilter; label: string }[] = [
  { key: "ACTIVE", label: "Active" },
  { key: "DRAFTS", label: "Drafts" },
  { key: "PUBLIC", label: "Public" },
  { key: "PRIVATE", label: "Private" },
  { key: "INVITE", label: "Invite-only" },
];

type ExhibitionSort = "updated" | "value" | "views" | "grade";
const EXHIBITION_SORTS: { key: ExhibitionSort; label: string }[] = [
  { key: "updated", label: "Recently updated" },
  { key: "value", label: "Highest value" },
  { key: "views", label: "Most viewed" },
  { key: "grade", label: "Best grade" },
];

function gradeBandLabel(band: "Basic" | "Curated" | "Exhibition Grade") {
  if (band === "Exhibition Grade") return "Exceptional";
  if (band === "Curated") return "Solid";
  return "Getting started";
}

function factorRating(value: number, good: number, veryGood: number, excellent: number) {
  if (value >= excellent) return { label: "Excellent", ok: true };
  if (value >= veryGood) return { label: "Very Good", ok: true };
  if (value >= good) return { label: "Good", ok: true };
  return { label: "Needs work", ok: false };
}

function formatGalleryDate(ms?: number) {
  if (!ms || !Number.isFinite(ms)) return "—";
  try {
    return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
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
  const [bonusGalleries, setBonusGalleries] = useState(0);
  const [galleryPendingDelete, setGalleryPendingDelete] = useState<Gallery | null>(null);
  const [gallerySettings, setGallerySettings] = useState<Gallery | null>(null);
  const [coverTargetGallery, setCoverTargetGallery] = useState<Gallery | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [filter, setFilter] = useState<ExhibitionFilter>("ACTIVE");
  const [sortMode, setSortMode] = useState<ExhibitionSort>("updated");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copyOk, setCopyOk] = useState(false);

  function refresh() {
    setGalleries(loadGalleries());
    setItems(loadItems());
  }

  useEffect(() => {
    // Fetch referral bonus galleries for this user
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      void supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          void getUserBonusGalleries(user.id).then(setBonusGalleries);
        }
      });
    }
  }, []);

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

  const baseLimits = useMemo(() => getGalleryLimits(tier), [tier]);
  const limits = useMemo(
    () => ({
      ...baseLimits,
      galleries:
        baseLimits.galleries === Infinity ? Infinity : baseLimits.galleries + bonusGalleries,
    }),
    [baseLimits, bonusGalleries]
  );
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

  const sortedGalleries = useMemo(() => {
    return [...scoredGalleries].sort((a, b) => {
      if (sortMode === "value") return b.totalValue - a.totalValue;
      if (sortMode === "views") return b.views - a.views;
      if (sortMode === "grade") return b.score.score - a.score.score;
      return Number(b.gallery.updatedAt ?? 0) - Number(a.gallery.updatedAt ?? 0);
    });
  }, [scoredGalleries, sortMode]);

  const displayedGalleries = useMemo(() => {
    return sortedGalleries.filter(({ gallery }) => {
      if (filter === "ACTIVE") return gallery.state === "ACTIVE";
      if (filter === "DRAFTS") return gallery.state === "STORAGE";
      if (filter === "PUBLIC") return gallery.visibility === "PUBLIC";
      if (filter === "PRIVATE") return gallery.visibility === "LOCKED";
      if (filter === "INVITE") return gallery.visibility === "INVITE";
      return true;
    });
  }, [sortedGalleries, filter]);

  const selectedEntry = useMemo(
    () => displayedGalleries.find((e) => e.gallery.id === selectedId) ?? displayedGalleries[0] ?? null,
    [displayedGalleries, selectedId]
  );

  async function handleCopyShareLink(shareUrl: string) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyOk(true);
      window.setTimeout(() => setCopyOk(false), 1600);
    } catch {
      setCopyOk(false);
    }
  }

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
      setStatusMessage("Gallery cover updated.");
    } catch (error) {
      console.error("Failed uploading gallery cover:", error);
      setStatusMessage(error instanceof Error ? error.message : "Gallery cover upload failed.");
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
    setStatusMessage("Gallery settings updated.");
  }

  const headerBlock = (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-[-0.04em] leading-none">Exhibitions</h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">Curate public rooms from your private vault.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-[8px] border p-[3px]" style={{ borderColor: "var(--theme-border)", background: "rgba(3,9,11,0.72)", boxShadow: "inset 0 1px 0 rgba(255,241,168,0.08)" }}>
            {(["grid", "list"] as const).map((mode) => (
              <button key={mode} type="button" onClick={() => setViewMode(mode)} aria-label={`${mode} view`} className={`inline-flex h-7 w-8 items-center justify-center rounded-[6px] transition ${viewMode === mode ? "bg-gold/15 text-gold shadow-[inset_0_1px_0_rgba(255,241,168,0.12)]" : "text-[color:var(--muted2)]"}`}>
                {mode === "grid" ? (<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>) : (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>)}
              </button>
            ))}
          </div>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as ExhibitionSort)} className="h-9 rounded-[8px] border px-3 text-xs font-semibold outline-none" style={{ borderColor: "var(--theme-border)", background: "rgba(3,9,11,0.72)", color: "var(--fg)", boxShadow: "inset 0 1px 0 rgba(255,241,168,0.08)" }}>
            {EXHIBITION_SORTS.map((s) => (<option key={s.key} value={s.key}>{s.label}</option>))}
          </select>
          <Link href="/museum/new" className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-[8px] px-4 text-xs font-black transition" style={{ background: "var(--theme-gold-gradient)", color: "#0B0B0B", boxShadow: "inset 0 1px 0 rgba(255,241,168,0.38), 0 0 14px rgba(217,162,58,0.18)" }}>+ Create Exhibition</Link>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {EXHIBITION_FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={`inline-flex items-center rounded-[8px] px-4 py-1.5 text-sm font-semibold ring-1 transition ${filter === f.key ? "bg-gold/15 text-gold ring-gold/35 shadow-[inset_0_1px_0_rgba(255,241,168,0.10)]" : "bg-[color:var(--pill)] text-[color:var(--muted)] ring-[color:var(--border)]"}`}>{f.label}</button>
        ))}
      </div>
    </>
  );

  return (
    <main className="text-[color:var(--fg)]">
      <div className="mx-auto max-w-[1500px] px-4 py-3 sm:px-6 sm:py-4">
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void handleCoverSelection(event)}
        />

        {/* Insight cards hidden to match the redesigned Exhibitions layout */}
        {false ? (
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
                  <span className="rounded-full bg-[color:var(--theme-elevated)] px-3 py-1 text-xs ring-1 ring-black/10">
                    {strongestGallery.gallery.itemIds.length} items
                  </span>
                  <span className="rounded-full bg-[color:var(--theme-elevated)] px-3 py-1 text-xs ring-1 ring-black/10">
                    {strongestGallery.score.signals.sections} exhibits
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
                  ? `${formatMoney(mostValuableGallery.totalValue)} total gallery value`
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

        <section className="mt-1">
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
                  Create First Gallery
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
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
              <div className="min-w-0">
                {headerBlock}
                <div className={`mt-5 grid gap-4 ${viewMode === "list" ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
              {displayedGalleries.map(({ gallery, totalValue, views }) => {
                const coverImage = resolveGalleryImage(gallery.coverImage);

                return (
                  <article
                    key={gallery.id}
                    onClick={() => setSelectedId(gallery.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(gallery.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Show details for ${gallery.title}`}
                    className={`group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-[10px] border bg-[color:var(--theme-card)] shadow-[0_16px_42px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_56px_rgba(0,0,0,0.30)] ${selectedEntry?.gallery.id === gallery.id ? "border-[color:var(--theme-gold)] ring-1 ring-[color:var(--theme-gold)]" : "border-[color:var(--theme-border)]"}`}
                  >
                    {/* Cover */}
                    <div className="relative h-[116px] overflow-hidden bg-[color:var(--theme-elevated)]">
                      {coverImage ? (
                        <ProgressiveImage
                          src={coverImage}
                          alt={`${gallery.title} cover`}
                          className="h-full w-full"
                          imageClassName="object-cover object-center transition duration-500 group-hover:scale-[1.04]"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-white/32">
                          No cover
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" />

                      {/* Hover controls: change cover / delete */}
                      <div className="absolute right-2 top-2 flex items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleOpenCoverPicker(gallery);
                          }}
                          disabled={isUploadingCover}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-black/75 disabled:opacity-50"
                          aria-label={`Change cover image for ${gallery.title}`}
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleAskDelete(gallery);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-red-200 ring-1 ring-red-400/30 backdrop-blur transition hover:bg-red-600/80 hover:text-white"
                          aria-label={`Delete gallery ${gallery.title}`}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
                        </button>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex min-h-[128px] flex-col gap-0.5 p-2.5">
                      <h2 className="line-clamp-1 text-[14px] font-black tracking-[-0.015em]">
                        {gallery.title}
                      </h2>
                      <div className="flex items-center gap-1 text-[11px] text-[color:var(--muted)]">
                        {gallery.itemIds.length} {gallery.itemIds.length === 1 ? "item" : "items"} <span className="opacity-60">·</span>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="opacity-80"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                        {visibilityLabel(gallery.visibility)}
                      </div>
                      <div className="mt-auto">
                        <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted2)]">
                          Total Value
                        </div>
                        <div className="text-lg font-black" style={{ color: "var(--data-color, #52d6f4)" }}>
                          {formatMoney(totalValue)}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
              {(() => {
                // Ghost exhibits: fill the grid out to 3 rows (3 cols), always at least one create card.
                const ghostCount = Math.max(1, 9 - displayedGalleries.length);
                return Array.from({ length: ghostCount }).map((_, i) => (
                  <Link
                    key={`ghost-${i}`}
                    href="/museum/new"
                    aria-label="Create a new exhibit"
                    className="group flex min-h-[206px] w-full flex-col items-center justify-center gap-2.5 rounded-[10px] border border-dashed border-[color:var(--theme-border)] transition duration-300 hover:-translate-y-0.5 hover:border-[color:var(--theme-gold)]"
                    style={{ background: "rgba(255,255,255,0.015)" }}
                  >
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-full border transition group-hover:scale-110"
                      style={{ borderColor: "var(--theme-gold-border, rgba(245,181,72,0.35))", color: "var(--theme-gold)" }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                    </span>
                    <span className="text-[12px] font-semibold tracking-[0.02em] text-[color:var(--muted)] transition group-hover:text-[color:var(--theme-gold)]">New exhibit</span>
                  </Link>
                ));
              })()}
                </div>
              </div>

              {/* Right: Exhibition Details */}
              <aside className="lg:sticky lg:top-4">
                {selectedEntry ? (() => {
                  const g = selectedEntry.gallery;
                  const s = selectedEntry.score;
                  const sig = s.signals;
                  const cover = resolveGalleryImage(g.coverImage);
                  const origin = typeof window !== "undefined" ? window.location.origin : "";
                  const token = g.share?.publicToken;
                  const shareUrl = token ? `${origin}/museum/share/${token}` : `${origin}/gallery/${g.id}`;
                  const panelItems = g.itemIds.map((id) => itemsById.get(id)).filter(Boolean) as VaultItem[];
                  const factors = [
                    { name: "Presentation", r: factorRating(sig.hasCover ? (sig.hasDescription ? 2 : 1) : 0, 1, 2, 2) },
                    { name: "Item Quality", r: factorRating(sig.featuredWorks, 1, 2, 3) },
                    { name: "Diversity", r: factorRating(sig.sections, 1, 2, 4) },
                    { name: "Completeness", r: factorRating(sig.notes + (sig.hasDescription ? 1 : 0), 1, 3, 5) },
                    { name: "Engagement", r: factorRating(sig.views, 1, 5, 20) },
                  ];
                  const topPct = Math.max(1, 100 - s.score);
                  return (
                    <div className="overflow-hidden rounded-[12px] border shadow-[0_18px_46px_rgba(0,0,0,0.24)]" style={{ borderColor: "var(--theme-border)", background: "var(--theme-card)", boxShadow: "inset 0 1px 0 rgba(255,241,168,0.08), 0 18px 46px rgba(0,0,0,0.24)" }}>
                      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--theme-border)" }}>
                        <div className="text-sm font-black">Exhibition Details</div>
                      </div>

                      <div className="px-3 pt-3">
                        <div className="relative h-40 overflow-hidden rounded-[8px] border bg-[color:var(--theme-elevated)]" style={{ borderColor: "var(--theme-border)" }}>
                          {cover ? (
                            <ProgressiveImage src={cover} alt={`${g.title} cover`} className="h-full w-full" imageClassName="object-cover object-center" draggable={false} />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[11px] uppercase tracking-[0.18em] text-white/30">No cover</div>
                          )}
                          <button type="button" onClick={() => handleOpenCoverPicker(g)} disabled={isUploadingCover}
                            className="absolute right-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-[6px] border bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur transition hover:bg-black/75 disabled:opacity-50" style={{ borderColor: "var(--theme-border)" }}>
                            Edit cover
                          </button>
                        </div>
                      </div>

                      <div className="p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-black">{g.title}</h2>
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: g.visibility === "PUBLIC" ? "var(--data-color, #52d6f4)" : "var(--theme-gold)" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                            {visibilityLabel(g.visibility)}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--muted)]">{g.itemIds.length} items · Updated {formatGalleryDate(g.updatedAt)}</div>

                        {/* Grade + factors, side by side */}
                        <div className="mt-4 grid grid-cols-[106px_1fr] gap-3 rounded-[8px] border bg-black/10 p-3" style={{ borderColor: "var(--theme-border)" }}>
                          <div className="flex flex-col">
                            <div className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[color:var(--muted2)]">Exhibition Grade</div>
                            <div className="relative mt-2 flex h-[72px] w-[72px] items-center justify-center">
                              <svg viewBox="0 0 76 84" className="absolute inset-0 h-full w-full"><polygon points="38,3 71,22 71,62 38,81 5,62 5,22" fill="rgba(245,181,72,0.08)" stroke="var(--theme-gold-border, rgba(245,181,72,0.45))" strokeWidth="2"/></svg>
                              <span className="relative text-3xl font-black" style={{ color: "var(--theme-gold)" }}>{gradeLetter(s.band)}</span>
                            </div>
                            <div className="mt-1.5 text-base font-black" style={{ color: "var(--theme-gold)" }}>{gradeBandLabel(s.band)}</div>
                            <div className="text-[11px] leading-tight text-[color:var(--muted)]">Top {topPct}% of public exhibitions</div>
                            <div className="mt-1 text-[11px] font-semibold leading-tight" style={{ color: "var(--theme-gold)" }}>How grades work <svg className="ml-0.5 inline-block align-[-1.5px]" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></div>
                          </div>
                          <div className="min-w-0 border-l pl-3" style={{ borderColor: "var(--theme-border)" }}>
                            <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted2)]"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v13M6 12l6 6 6-6"/></svg>Grade factors</div>
                            <div className="mt-1.5 divide-y divide-[color:var(--theme-border)]">
                              {factors.map((f) => (
                                <div key={f.name} className="flex items-center justify-between gap-2 py-[7px] text-[12px]">
                                  <span className="flex min-w-0 items-center gap-2 text-[color:var(--muted)]">
                                    <svg width="16" height="16" viewBox="0 0 24 24" className="shrink-0">
                                      {f.r.ok ? (
                                        <>
                                          <circle cx="12" cy="12" r="10" fill="#4CAF82" />
                                          <path d="M8 12.5l2.5 2.5 5-5.5" fill="none" stroke="#0B1320" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        </>
                                      ) : (
                                        <>
                                          <circle cx="12" cy="12" r="10" fill="none" stroke="#F5B548" strokeWidth="2" />
                                          <circle cx="12" cy="12" r="3.2" fill="#F5B548" />
                                        </>
                                      )}
                                    </svg>
                                    <span className="truncate">{f.name}</span>
                                  </span>
                                  <span className="shrink-0 whitespace-nowrap font-semibold" style={{ color: f.r.ok ? "#4CAF82" : "#F5B548" }}>{f.r.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Share link */}
                        <div className="mt-5">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted2)]">Share link</div>
                          <div className="mt-2 flex gap-2">
                            <input readOnly value={shareUrl} className="h-9 min-w-0 flex-1 rounded-[7px] border px-3 text-xs" style={{ borderColor: "var(--theme-border)", background: "var(--theme-elevated)", color: "var(--muted)" }} />
                            <button type="button" onClick={() => handleCopyShareLink(shareUrl)} className="inline-flex shrink-0 items-center gap-1.5 rounded-[7px] px-3 text-xs font-semibold ring-1" style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>
                              {copyOk ? "Copied" : "Copy link"}
                            </button>
                          </div>
                          <button type="button" onClick={() => openGallery(g.id)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "var(--theme-gold)" }}>View public page ↗</button>
                        </div>

                        {/* Privacy & access */}
                        <div className="mt-5 flex items-center justify-between gap-3">
                          <div className="flex items-start gap-2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="mt-0.5 text-[color:var(--muted)]"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted2)]">Privacy &amp; access</div>
                              <div className="text-sm font-semibold text-text-primary">{visibilityLabel(g.visibility)}</div>
                              <div className="text-[11px] text-[color:var(--muted)]">{g.visibility === "PUBLIC" ? "Anyone can view this exhibition." : g.visibility === "INVITE" ? "Only invited people can view." : "Only you can view this exhibition."}</div>
                            </div>
                          </div>
                          <button type="button" onClick={() => setGallerySettings(g)} className="shrink-0 rounded-[7px] px-3.5 py-1.5 text-xs font-semibold ring-1" style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }}>Change</button>
                        </div>

                        {panelItems.length > 0 ? (
                          <div className="mt-5">
                            <div className="flex items-center justify-between">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--muted2)]">Selected items ({panelItems.length})</div>
                              <button type="button" onClick={() => openGallery(g.id)} className="inline-flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: "var(--theme-gold)" }}>View all ›</button>
                            </div>
                            <div className="mt-2 flex gap-2">
                              {panelItems.slice(0, 5).map((it) => {
                                const img = getPrimaryImageUrl(it);
                                return (
                                  <div key={it.id} className="h-16 w-12 overflow-hidden rounded-lg bg-[color:var(--theme-elevated)] ring-1 ring-[color:var(--theme-border)]">
                                    {img ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={img} alt={it.title} className="h-full w-full object-cover" />
                                    ) : null}
                                  </div>
                                );
                              })}
                              {panelItems.length > 5 ? (
                                <div className="flex h-16 w-12 items-center justify-center rounded-lg text-xs font-semibold text-[color:var(--muted)] ring-1 ring-[color:var(--theme-border)]">+{panelItems.length - 5}</div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        <div className="mt-5 grid grid-cols-3 gap-2">
                          <button type="button" onClick={() => openGallery(g.id)} className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[7px] text-xs font-semibold ring-1" style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
                            Duplicate
                          </button>
                          <button type="button" onClick={() => openGallery(g.id)} className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[7px] text-xs font-semibold ring-1" style={{ background: "var(--pill)", color: "var(--fg)", borderColor: "var(--border)" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>
                            Export PDF
                          </button>
                          <button type="button" onClick={() => handleAskDelete(g)} className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[7px] text-xs font-semibold ring-1" style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", borderColor: "rgba(248,113,113,0.3)" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })() : null}
              </aside>
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
              Delete Gallery: {galleryPendingDelete.title}?
            </h2>

            <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
              This will delete the gallery {galleryPendingDelete.title}. Are you sure you want to continue?
            </p>

            <p className="mt-4 text-sm text-[color:var(--muted)]">
              Deleting this gallery will not delete items in your Vault.
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

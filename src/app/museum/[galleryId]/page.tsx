"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import {
  loadGalleries,
  type Gallery,
  GALLERY_EVENT,
  recordGalleryView,
  setGalleryItemIds,
  setGalleryItemNote,
  setGalleryCoverImage,
  ensureGalleryPublicToken,
  regenerateGalleryPublicToken,
  getGalleryShareUrl,
  createGalleryInviteToken,
  disableGalleryInviteToken,
  getGalleryInviteUrl,
  getActiveInviteTokens,
} from "@/lib/galleryModel";

import { loadItems, type VaultItem } from "@/lib/vaultModel";
import { getVaultImagePublicUrl } from "@/lib/vaultCloud";
import GalleryBuilder from "@/components/GalleryBuilder";
import { formatMoney, getGalleryMetrics } from "@/lib/portfolioMetrics";

function visibilityLabel(v: Gallery["visibility"]) {
  if (v === "LOCKED") return "Locked";
  if (v === "INVITE") return "Invite Only";
  return "Public";
}

function itemSubtitle(i: VaultItem) {
  return [i.subtitle, i.number, i.grade].filter(Boolean).join(" • ");
}

function itemImage(i: VaultItem) {
  const directUrl = i.imageFrontUrl || i.imageBackUrl || "";
  if (directUrl) return directUrl;

  const firstImage = Array.isArray(i.images) ? i.images.find((image) => image?.url || image?.storageKey) : null;
  const storagePath =
    i.imageFrontStoragePath ||
    i.primaryImageKey ||
    firstImage?.storageKey ||
    "";

  return storagePath ? getVaultImagePublicUrl(storagePath) : "";
}

function formatDateTime(ts?: number) {
  if (!ts || !Number.isFinite(ts)) return "—";

  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "—";
  }
}

function fullItemCost(item: VaultItem) {
  const total =
    Number(item.purchasePrice ?? 0) +
    Number(item.purchaseTax ?? 0) +
    Number(item.purchaseShipping ?? 0) +
    Number(item.purchaseFees ?? 0);

  return Number.isFinite(total) ? total : 0;
}

export default function GalleryPage() {
  const params = useParams();
  const id = params?.galleryId as string | undefined;

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [inviteLabel, setInviteLabel] = useState("");
  const [inviteCopiedToken, setInviteCopiedToken] = useState<string>("");

  function loadState() {
    if (!id) return;

    const galleries = loadGalleries();
    const g = galleries.find((x) => x.id === id) ?? null;

    setGallery(g);
    setItems(loadItems());
  }

  useEffect(() => {
    if (!id) return;

    ensureGalleryPublicToken(id);
    loadState();
    recordGalleryView(id);

    function onGalleryChange() {
      loadState();
    }

    window.addEventListener(GALLERY_EVENT, onGalleryChange);
    return () => window.removeEventListener(GALLERY_EVENT, onGalleryChange);
  }, [id]);

  useEffect(() => {
    if (!gallery) {
      setShareUrl("");
      return;
    }

    setShareUrl(getGalleryShareUrl(gallery));
  }, [gallery]);

  useEffect(() => {
    if (!copied) return;

    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!inviteCopiedToken) return;

    const timer = window.setTimeout(() => setInviteCopiedToken(""), 1800);
    return () => window.clearTimeout(timer);
  }, [inviteCopiedToken]);

  const galleryItems = useMemo(() => {
    if (!gallery) return [];
    return gallery.itemIds
      .map((itemId) => items.find((item) => item.id === itemId))
      .filter(Boolean) as VaultItem[];
  }, [gallery, items]);

  const activeInviteTokens = useMemo(() => {
    if (!gallery) return [];
    return getActiveInviteTokens(gallery);
  }, [gallery]);

  const metrics = useMemo(() => {
    if (!gallery) return null;
    return getGalleryMetrics(gallery, items);
  }, [gallery, items]);

  const exhibitionSections = useMemo(() => {
    if (!gallery) return [];

    const sections = gallery.exhibitionLayout?.sections ?? [];
    const itemMap = new Map(items.map((item) => [item.id, item]));

    return sections.map((section) => {
      const sectionItems = section.itemIds
        .map((itemId) => itemMap.get(itemId))
        .filter(Boolean) as VaultItem[];

      const featuredItem =
        section.featuredItemId && itemMap.has(section.featuredItemId)
          ? (itemMap.get(section.featuredItemId) as VaultItem)
          : null;

      return {
        ...section,
        items: sectionItems,
        featuredItem,
      };
    });
  }, [gallery, items]);

  const unsectionedItems = useMemo(() => {
    if (!gallery) return [];

    const sectionIds = new Set<string>();
    for (const section of gallery.exhibitionLayout?.sections ?? []) {
      for (const itemId of section.itemIds) {
        sectionIds.add(itemId);
      }
    }

    return galleryItems.filter((item) => !sectionIds.has(item.id));
  }, [gallery, galleryItems]);

  function update(ids: string[]) {
    if (!gallery) return;
    setGalleryItemIds(gallery.id, ids);
  }

  function updateCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !gallery) return;

    const reader = new FileReader();

    reader.onload = () => {
      setGalleryCoverImage(gallery.id, String(reader.result ?? ""));
    };

    reader.readAsDataURL(file);
  }

  function updateNote(itemId: string, note: string) {
    if (!gallery) return;
    setGalleryItemNote(gallery.id, itemId, note);
  }

  async function copyShareLink() {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      // ignore
    }
  }

  async function copyInviteLink(token: string) {
    if (!gallery) return;

    const url = getGalleryInviteUrl(gallery, token);
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setInviteCopiedToken(token);
    } catch {
      // ignore
    }
  }

  function handleCreateInviteToken() {
    if (!gallery) return;

    createGalleryInviteToken(gallery.id, inviteLabel.trim() || undefined);
    setInviteLabel("");
  }

  function handleDisableInviteToken(token: string) {
    if (!gallery) return;
    disableGalleryInviteToken(gallery.id, token);
  }

  function handleRegeneratePublicLink() {
    if (!gallery) return;
    regenerateGalleryPublicToken(gallery.id);
  }

  if (!gallery || !metrics) {
    return (
      <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="rounded-[28px] vltd-panel-main bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              MUSEUM
            </div>
            <h1 className="mt-3 text-2xl font-semibold">Gallery not found</h1>
            <p className="mt-3 text-sm text-[color:var(--muted)]">
              This gallery could not be loaded from local storage.
            </p>
            <div className="mt-6">
              <Link
                href="/museum"
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-5 py-2 text-sm font-semibold text-[color:var(--fg)]"
              >
                Back to Museum
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--fg)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link
            href="/museum"
            className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
          >
            ← Back to Museum
          </Link>

          <Link
            href="/collector"
            className="inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
          >
            Collector Profile
          </Link>
        </div>

        <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)] sm:p-8 lg:p-10">
          {gallery.coverImage ? (
            <>
              <div
                className="absolute inset-0 opacity-35"
                style={{
                  backgroundImage: `url(${gallery.coverImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div className="absolute inset-0 bg-black/55" />
            </>
          ) : null}

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),rgba(255,255,255,0)_28%),radial-gradient(circle_at_80%_0%,rgba(255,225,170,0.10),rgba(255,225,170,0)_24%)]" />

          <div className="relative">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="text-[11px] tracking-[0.28em] text-[color:var(--muted2)]">
                  CURATED GALLERY
                </div>

                <h1 className="mt-3 text-3xl font-semibold sm:text-4xl lg:text-5xl">
                  {gallery.title}
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)] sm:text-base">
                  {gallery.description?.trim()
                    ? gallery.description
                    : "Curated collection presentation"}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-black/20 px-3 py-1.5 text-xs tracking-[0.14em] text-[color:var(--muted2)] ring-1 ring-white/10">
                    {visibilityLabel(gallery.visibility)}
                  </span>

                  <span className="rounded-full bg-black/20 px-3 py-1.5 text-xs tracking-[0.14em] text-[color:var(--muted2)] ring-1 ring-white/10">
                    {metrics.totalItems} ITEMS
                  </span>

                  <span className="rounded-full bg-black/20 px-3 py-1.5 text-xs tracking-[0.14em] text-[color:var(--muted2)] ring-1 ring-white/10">
                    {metrics.views} VIEWS
                  </span>

                  <span className="rounded-full bg-black/20 px-3 py-1.5 text-xs tracking-[0.14em] text-[color:var(--muted2)] ring-1 ring-white/10">
                    {gallery.exhibitionLayout?.type ?? "GRID"} LAYOUT
                  </span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:w-[440px]">
                <div className="rounded-3xl bg-black/20 p-4 ring-1 ring-white/10 backdrop-blur-sm">
                  <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                    GALLERY VALUE
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{formatMoney(metrics.totalValue)}</div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">
                    Current exhibit value
                  </div>
                </div>

                <div className="rounded-3xl bg-black/20 p-4 ring-1 ring-white/10 backdrop-blur-sm">
                  <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                    ROI
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {metrics.roi >= 0 ? "+" : ""}
                    {metrics.roi.toFixed(1)}%
                  </div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">
                    Based on purchase totals
                  </div>
                </div>

                <div className="rounded-3xl bg-black/20 p-4 ring-1 ring-white/10 backdrop-blur-sm">
                  <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                    NOTES COVERAGE
                  </div>
                  <div className="mt-2 text-2xl font-semibold">
                    {metrics.notesCoverage.toFixed(0)}%
                  </div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">
                    {metrics.notesCount} noted exhibits
                  </div>
                </div>

                <div className="rounded-3xl bg-black/20 p-4 ring-1 ring-white/10 backdrop-blur-sm">
                  <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                    LAST VIEWED
                  </div>
                  <div className="mt-2 text-sm font-semibold">
                    {formatDateTime(gallery.analytics?.lastViewedAt)}
                  </div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">
                    Latest tracked access time
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-[28px] bg-black/20 p-5 ring-1 ring-white/10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                      PUBLIC SHARE LINK
                    </div>
                    <div className="mt-1 text-sm text-[color:var(--muted)]">
                      Uses a dedicated public route for clean sharing.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleRegeneratePublicLink}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-xs font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                  >
                    Regenerate
                  </button>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={shareUrl}
                    readOnly
                    className="min-h-[48px] w-full rounded-2xl bg-black/35 px-4 py-3 text-sm ring-1 ring-white/10 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={copyShareLink}
                    className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-5 py-3 text-sm font-semibold text-[color:var(--fg)] transition hover:opacity-95"
                  >
                    {copied ? "Copied" : "Copy Link"}
                  </button>
                </div>
              </div>

              <div className="rounded-[28px] bg-black/20 p-5 ring-1 ring-white/10">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  COVER IMAGE
                </div>
                <label className="mt-3 block text-sm text-[color:var(--muted)]">
                  Upload cover artwork
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={updateCover}
                  className="mt-3 block w-full text-sm"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="rounded-[30px] vltd-panel-main bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">
              GALLERY PERFORMANCE
            </div>

            <h2 className="mt-3 text-2xl font-semibold">Exhibit Value Breakdown</h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl vltd-panel-soft bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
                <div className="text-xs text-[color:var(--muted2)]">TOTAL COST</div>
                <div className="mt-2 text-2xl font-semibold">{formatMoney(metrics.totalCost)}</div>
              </div>

              <div className="rounded-2xl vltd-panel-soft bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
                <div className="text-xs text-[color:var(--muted2)]">CURRENT VALUE</div>
                <div className="mt-2 text-2xl font-semibold">{formatMoney(metrics.totalValue)}</div>
              </div>

              <div className="rounded-2xl vltd-panel-soft bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
                <div className="text-xs text-[color:var(--muted2)]">NET CHANGE</div>
                <div className="mt-2 text-2xl font-semibold">
                  {metrics.delta >= 0 ? "+" : ""}
                  {formatMoney(metrics.delta)}
                </div>
              </div>

              <div className="rounded-2xl vltd-panel-soft bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
                <div className="text-xs text-[color:var(--muted2)]">SHARING READY</div>
                <div className="mt-2 text-2xl font-semibold">
                  {metrics.shareReady ? "Yes" : "No"}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[24px] bg-[color:var(--input)] p-5 ring-1 ring-[color:var(--border)]">
              <div className="text-sm font-semibold">Top Gallery Segments</div>

              {metrics.topSegments.length === 0 ? (
                <div className="mt-4 text-sm text-[color:var(--muted)]">
                  No segment data available yet.
                </div>
              ) : (
                <div className="mt-5 grid gap-4">
                  {metrics.topSegments.map((entry) => {
                    const width =
                      metrics.maxSegmentValue > 0
                        ? Math.max(8, (entry.value / metrics.maxSegmentValue) * 100)
                        : 0;

                    return (
                      <div key={entry.label}>
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{entry.label}</div>
                            <div className="text-xs text-[color:var(--muted)]">
                              {entry.count} items
                            </div>
                          </div>
                          <div className="shrink-0 text-sm font-semibold">
                            {formatMoney(entry.value)}
                          </div>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-black/15 ring-1 ring-[color:var(--border)]">
                          <div
                            className="h-full rounded-full bg-[color:var(--pill-active-bg)]"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl vltd-panel-soft bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
                <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                  LAYOUT TYPE
                </div>
                <div className="mt-2 text-xl font-semibold">
                  {gallery.exhibitionLayout?.type ?? "GRID"}
                </div>
              </div>

              <div className="rounded-2xl vltd-panel-soft bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
                <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                  SECTIONS
                </div>
                <div className="mt-2 text-xl font-semibold">
                  {gallery.exhibitionLayout?.sections?.length ?? 0}
                </div>
              </div>

              <div className="rounded-2xl vltd-panel-soft bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
                <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                  FEATURED WORKS
                </div>
                <div className="mt-2 text-xl font-semibold">
                  {(gallery.exhibitionLayout?.sections ?? []).filter((section) => !!section.featuredItemId).length}
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-[30px] vltd-panel-main bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">
              AUDIENCE + ACCESS
            </div>

            <h2 className="mt-3 text-2xl font-semibold">Invite Tokens</h2>

            <div className="mt-5 grid gap-4">
              <div className="rounded-2xl vltd-panel-soft bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
                <div className="text-xs text-[color:var(--muted2)]">TOTAL VIEWS</div>
                <div className="mt-2 text-2xl font-semibold">{metrics.views}</div>
              </div>

              <div className="rounded-2xl vltd-panel-soft bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
                <div className="text-xs text-[color:var(--muted2)]">UNIQUE VIEWERS</div>
                <div className="mt-2 text-2xl font-semibold">{metrics.uniqueViewers}</div>
              </div>

              <div className="rounded-2xl vltd-panel-soft bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
                <div className="text-xs text-[color:var(--muted2)]">INVITE TOKENS</div>
                <div className="mt-2 text-2xl font-semibold">{metrics.inviteCount}</div>
              </div>
            </div>

            <p className="mt-5 text-sm leading-6 text-[color:var(--muted)]">
              Generate labeled invite links for controlled sharing. Links use a dedicated invite route.
            </p>

            <div className="mt-5 rounded-[24px] vltd-panel-soft bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
              <div className="text-sm font-semibold">Create Invite Token</div>

              <input
                value={inviteLabel}
                onChange={(e) => setInviteLabel(e.target.value)}
                placeholder="Optional label, e.g. VIP preview"
                className="mt-3 min-h-[46px] w-full rounded-2xl bg-[color:var(--surface)] px-4 py-3 ring-1 ring-[color:var(--border)] focus:outline-none"
              />

              <button
                type="button"
                onClick={handleCreateInviteToken}
                className="mt-3 inline-flex min-h-[46px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-5 py-2 text-sm font-semibold text-[color:var(--fg)]"
              >
                Create Invite Link
              </button>
            </div>

            <div className="mt-5">
              <div className="text-sm font-semibold">Active Invite Links</div>

              {activeInviteTokens.length === 0 ? (
                <div className="mt-3 rounded-[24px] bg-[color:var(--input)] p-4 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                  No active invite tokens yet.
                </div>
              ) : (
                <div className="mt-3 grid gap-3">
                  {activeInviteTokens.map((entry) => {
                    const inviteUrl = getGalleryInviteUrl(gallery, entry.token);

                    return (
                      <div
                        key={entry.token}
                        className="rounded-[24px] vltd-panel-soft bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">
                              {entry.label?.trim() || "Untitled invite"}
                            </div>
                            <div className="mt-1 text-xs text-[color:var(--muted)]">
                              Created {formatDateTime(entry.createdAt)}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDisableInviteToken(entry.token)}
                            className="inline-flex min-h-[34px] items-center justify-center rounded-full bg-[color:var(--pill)] px-3 py-1.5 text-xs font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                          >
                            Disable
                          </button>
                        </div>

                        <input
                          value={inviteUrl}
                          readOnly
                          className="mt-3 min-h-[42px] w-full rounded-2xl bg-[color:var(--surface)] px-3 py-2 text-xs ring-1 ring-[color:var(--border)] focus:outline-none"
                        />

                        <button
                          type="button"
                          onClick={() => copyInviteLink(entry.token)}
                          className="mt-3 inline-flex min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-4 py-2 text-xs font-semibold text-[color:var(--fg)]"
                        >
                          {inviteCopiedToken === entry.token ? "Copied" : "Copy Invite Link"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </section>

        {exhibitionSections.length > 0 ? (
          <section className="mt-10">
            <div className="mb-4">
              <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">
                EXHIBITION STRUCTURE
              </div>
              <h2 className="mt-2 text-2xl font-semibold">Curated Sections</h2>
            </div>

            <div className="grid gap-6">
              {exhibitionSections.map((section, sectionIndex) => (
                <section
                  key={section.id}
                  className="rounded-[30px] vltd-panel-main bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-3xl">
                      <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                        SECTION #{sectionIndex + 1}
                      </div>
                      <h3 className="mt-2 text-2xl font-semibold">{section.title}</h3>
                      {section.description?.trim() ? (
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
                          {section.description}
                        </p>
                      ) : null}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:w-[360px]">
                      <div className="rounded-2xl vltd-panel-soft bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
                        <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                          ITEMS
                        </div>
                        <div className="mt-2 text-xl font-semibold">{section.items.length}</div>
                      </div>

                      <div className="rounded-2xl vltd-panel-soft bg-[color:var(--input)] p-4 ring-1 ring-[color:var(--border)]">
                        <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                          FEATURED
                        </div>
                        <div className="mt-2 text-xl font-semibold">
                          {section.featuredItem ? "Yes" : "No"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {section.featuredItem ? (
                    <div className="mt-6 rounded-[26px] vltd-panel-soft bg-[color:var(--input)] p-5 ring-1 ring-[color:var(--border)]">
                      <div className="mb-3 text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                        FEATURED WORK
                      </div>

                      <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
                        <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-black/20">
                          {itemImage(section.featuredItem) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={itemImage(section.featuredItem)}
                              alt={section.featuredItem.title}
                              className="h-full w-full object-cover"
                              draggable={false}
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-sm text-[color:var(--muted)]">
                              No image
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="text-2xl font-semibold">{section.featuredItem.title}</div>
                          <div className="mt-2 text-sm text-[color:var(--muted)]">
                            {itemSubtitle(section.featuredItem) || "—"}
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full bg-black/10 px-3 py-1 text-xs ring-1 ring-black/10">
                              Value {formatMoney(Number(section.featuredItem.currentValue ?? 0))}
                            </span>
                            <span className="rounded-full bg-black/10 px-3 py-1 text-xs ring-1 ring-black/10">
                              Cost {formatMoney(fullItemCost(section.featuredItem))}
                            </span>
                          </div>

                          {gallery.itemNotes?.find((n) => n.itemId === section.featuredItem?.id)?.note ? (
                            <div className="mt-5 rounded-2xl bg-black/10 p-4 ring-1 ring-black/10">
                              <div className="text-[11px] tracking-[0.14em] text-[color:var(--muted2)]">
                                CURATOR NOTE
                              </div>
                              <div className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                                {
                                  gallery.itemNotes?.find(
                                    (n) => n.itemId === section.featuredItem?.id
                                  )?.note
                                }
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {section.items.length > 0 ? (
                    <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                      {section.items.map((item, index) => {
                        const existingNote =
                          gallery.itemNotes?.find((n) => n.itemId === item.id)?.note ?? "";

                        return (
                          <article
                            key={`${section.id}_${item.id}`}
                            className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.20)]"
                          >
                            <div className="mb-2 text-xs tracking-[0.16em] text-[color:var(--muted2)]">
                              SECTION EXHIBIT #{index + 1}
                            </div>

                            <div className="mb-4 aspect-[4/5] overflow-hidden rounded-xl bg-black/25">
                              {itemImage(item) ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={itemImage(item)}
                                  alt={item.title}
                                  className="h-full w-full object-cover"
                                  draggable={false}
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-sm text-[color:var(--muted)]">
                                  No image
                                </div>
                              )}
                            </div>

                            <div className="text-lg font-semibold">{item.title}</div>
                            <div className="mt-1 text-sm text-[color:var(--muted)]">
                              {itemSubtitle(item) || "—"}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                                Value {formatMoney(Number(item.currentValue ?? 0))}
                              </span>
                              <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                                Cost {formatMoney(fullItemCost(item))}
                              </span>
                            </div>

                            <textarea
                              defaultValue={existingNote}
                              placeholder="Curator note..."
                              onBlur={(e) => updateNote(item.id, e.target.value)}
                              className="mt-4 min-h-[110px] w-full rounded-2xl bg-black/30 p-3 text-sm ring-1 ring-white/10 focus:outline-none"
                            />
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-6 rounded-[24px] bg-[color:var(--input)] p-5 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                      This section does not yet contain any assigned exhibits.
                    </div>
                  )}
                </section>
              ))}
            </div>
          </section>
        ) : null}

        {unsectionedItems.length > 0 ? (
          <section className="mt-10">
            <div className="mb-4">
              <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">
                UNSECTIONED EXHIBITS
              </div>
              <h2 className="mt-2 text-2xl font-semibold">Main Gallery Flow</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {unsectionedItems.map((item, index) => {
                const existingNote =
                  gallery.itemNotes?.find((n) => n.itemId === item.id)?.note ?? "";

                return (
                  <article
                    key={item.id}
                    className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.20)]"
                  >
                    <div className="mb-2 text-xs tracking-[0.16em] text-[color:var(--muted2)]">
                      EXHIBIT #{index + 1}
                    </div>

                    <div className="mb-4 aspect-[4/5] overflow-hidden rounded-xl bg-black/25">
                      {itemImage(item) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={itemImage(item)}
                          alt={item.title}
                          className="h-full w-full object-cover"
                          draggable={false}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-[color:var(--muted)]">
                          No image
                        </div>
                      )}
                    </div>

                    <div className="text-lg font-semibold">{item.title}</div>

                    <div className="mt-1 text-sm text-[color:var(--muted)]">
                      {itemSubtitle(item) || "—"}
                    </div>

                    <textarea
                      defaultValue={existingNote}
                      placeholder="Curator note..."
                      onBlur={(e) => updateNote(item.id, e.target.value)}
                      className="mt-4 min-h-[110px] w-full rounded-2xl bg-black/30 p-3 text-sm ring-1 ring-white/10 focus:outline-none"
                    />
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {metrics.topItems.length > 0 ? (
          <section className="mt-10">
            <div className="mb-4">
              <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">
                HIGHLIGHT EXHIBITS
              </div>
              <h2 className="mt-2 text-2xl font-semibold">Top Value Pieces</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {metrics.topItems.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.20)]"
                >
                  <div className="mb-4 aspect-[4/5] overflow-hidden rounded-xl bg-black/25">
                    {itemImage(item) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={itemImage(item)}
                        alt={item.title}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-[color:var(--muted)]">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="text-lg font-semibold">{item.title}</div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">
                    {itemSubtitle(item) || "—"}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                      Value {formatMoney(Number(item.currentValue ?? 0))}
                    </span>
                    <span className="rounded-full bg-black/15 px-3 py-1 text-xs ring-1 ring-black/10">
                      Cost {formatMoney(fullItemCost(item))}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-12">
          <div className="mb-4">
            <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">
              BUILDER
            </div>
            <h2 className="mt-2 text-2xl font-semibold">Curate the Layout</h2>
          </div>

          <GalleryBuilder gallery={gallery} onChange={update} />
        </section>
      </div>
    </main>
  );
}

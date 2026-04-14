"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

import {
  loadGalleries,
  saveGalleries,
  type Gallery,
  GALLERY_EVENT,
  recordGalleryView,
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

type GalleryAccessPillMode = "private" | "public_gallery" | "guest_view" | "registered_users";

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

function cloneGallery<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function mergeHeavyDraftFields(nextGallery: Gallery | null, fallback: Gallery | null) {
  if (!nextGallery) return nextGallery;
  if (!fallback) return nextGallery;

  return {
    ...nextGallery,
    coverImage: nextGallery.coverImage || fallback.coverImage || "",
    shelfBackground: nextGallery.shelfBackground || fallback.shelfBackground || "",
  };
}

function normalizeDraftForCompare(gallery: Gallery | null) {
  if (!gallery) return "";

  return JSON.stringify({
    id: gallery.id,
    title: gallery.title,
    description: gallery.description,
    visibility: gallery.visibility,
    guestViewMode: gallery.guestViewMode,
    itemIds: gallery.itemIds,
    coverImage: gallery.coverImage || "",
    shelfBackground: gallery.shelfBackground || "",
    themePack: gallery.themePack,
    displayMode: gallery.displayMode,
    templateId: gallery.templateId,
    sections: gallery.sections ?? [],
    exhibitionLayout: gallery.exhibitionLayout ?? null,
    analytics: gallery.analytics ?? { views: 0, uniqueViewKeys: [] },
    itemNotes: gallery.itemNotes ?? [],
    share: gallery.share ?? { publicToken: undefined, inviteTokens: [] },
  });
}

function getAccessMode(gallery: Gallery | null | undefined): GalleryAccessPillMode {
  if (!gallery) return "private";
  if (gallery.guestViewMode === "guest") return "registered_users";
  if (gallery.visibility === "LOCKED") return "private";
  if (gallery.visibility === "INVITE") return "guest_view";
  return "public_gallery";
}

function applyAccessMode(current: Gallery, mode: GalleryAccessPillMode): Gallery {
  if (mode === "private") {
    return {
      ...current,
      visibility: "LOCKED",
      guestViewMode: "public",
    };
  }

  if (mode === "registered_users") {
    return {
      ...current,
      visibility: "INVITE",
      guestViewMode: "guest",
    };
  }

  if (mode === "guest_view") {
    return {
      ...current,
      visibility: "INVITE",
      guestViewMode: "public",
    };
  }

  return {
    ...current,
    visibility: "PUBLIC",
    guestViewMode: "public",
  };
}

function accessDescription(mode: GalleryAccessPillMode) {
  switch (mode) {
    case "public_gallery":
      return "Public Gallery - Available to registered or unregistered users, searchable on Home page.";
    case "guest_view":
      return "Guest View - Anyone with access to the shared link can view your gallery.";
    case "registered_users":
      return "Registered Users - Any registered user with access to the shared link can view your gallery, allows analytics on views.";
    case "private":
    default:
      return "Private Gallery - This only for yourself, good for gallery test beds before sharing with anyone.";
  }
}

function accessPillClass(active: boolean) {
  return [
    "vltd-selectable inline-flex min-h-[44px] items-center justify-center rounded-full px-4 py-2 text-sm font-semibold ring-1 transition",
    active
      ? "vltd-pill-main-glow bg-[color:var(--pill-active-bg)] text-[color:var(--pill-active-fg)]"
      : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]",
  ].join(" ");
}

function neutralPillClass() {
  return "vltd-selectable inline-flex min-h-[42px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-medium text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]";
}

export default function GalleryPage() {
  const params = useParams();
  const id = params?.galleryId as string | undefined;

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [draft, setDraft] = useState<Gallery | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [accessInfoOpen, setAccessInfoOpen] = useState(false);
  const [inviteLabel, setInviteLabel] = useState("");
  const [inviteCopiedToken, setInviteCopiedToken] = useState<string>("");
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "good">("neutral");

  const originalSnapshotRef = useRef("");
  const latestGalleryRef = useRef<Gallery | null>(null);
  const latestDraftRef = useRef<Gallery | null>(null);

  function loadState() {
    if (!id) return;

    const galleries = loadGalleries();
    const rawGallery = galleries.find((x) => x.id === id) ?? null;
    const mergedGallery = mergeHeavyDraftFields(
      rawGallery,
      latestDraftRef.current ?? latestGalleryRef.current
    );

    setGallery(mergedGallery);
    setDraft(mergedGallery ? cloneGallery(mergedGallery) : null);
    originalSnapshotRef.current = normalizeDraftForCompare(mergedGallery);
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
    if (!draft) {
      setShareUrl("");
      return;
    }

    setShareUrl(getGalleryShareUrl(draft));
  }, [draft]);

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

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(""), 2200);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    latestGalleryRef.current = gallery;
  }, [gallery]);

  useEffect(() => {
    latestDraftRef.current = draft;
  }, [draft]);

  const galleryItems = useMemo(() => {
    if (!draft) return [];
    return draft.itemIds
      .map((itemId) => items.find((item) => item.id === itemId))
      .filter(Boolean) as VaultItem[];
  }, [draft, items]);

  const activeInviteTokens = useMemo(() => {
    if (!draft) return [];
    return getActiveInviteTokens(draft);
  }, [draft]);

  const metrics = useMemo(() => {
    if (!draft) return null;
    return getGalleryMetrics(draft, items);
  }, [draft, items]);

  const isDirty = useMemo(() => {
    return normalizeDraftForCompare(draft) !== originalSnapshotRef.current;
  }, [draft]);

  const selectedAccessMode = useMemo(() => getAccessMode(draft), [draft]);

  function patchDraft(updater: (current: Gallery) => Gallery) {
    setDraft((current) => {
      if (!current) return current;
      const next = updater(cloneGallery(current));
      return {
        ...next,
        updatedAt: Date.now(),
      };
    });
  }

  function update(ids: string[]) {
    patchDraft((current) => ({
      ...current,
      itemIds: [...ids],
    }));
  }

  function updateAccessMode(mode: GalleryAccessPillMode) {
    patchDraft((current) => applyAccessMode(current, mode));
  }

  function updateCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !draft) return;

    const reader = new FileReader();

    reader.onload = () => {
      patchDraft((current) => ({
        ...current,
        coverImage: String(reader.result ?? ""),
      }));
    };

    reader.readAsDataURL(file);
  }

  function updateNote(itemId: string, note: string) {
    patchDraft((current) => {
      const existing = Array.isArray(current.itemNotes) ? [...current.itemNotes] : [];
      const next = existing.filter((entry) => entry.itemId !== itemId);

      if (note.trim()) {
        next.push({
          itemId,
          note,
          updatedAt: Date.now(),
        });
      }

      return {
        ...current,
        itemNotes: next,
      };
    });
  }

  function saveDraft() {
    if (!draft) return;

    const all = loadGalleries({ includeAllProfiles: true });
    const next = all.map((entry) => (entry.id === draft.id ? cloneGallery(draft) : entry));
    saveGalleries(next);

    setGallery(cloneGallery(draft));
    originalSnapshotRef.current = normalizeDraftForCompare(draft);
    setStatusTone("good");
    setStatus("Gallery saved.");
  }

  function cancelChanges() {
    if (!gallery) return;
    setDraft(cloneGallery(gallery));
    setStatusTone("neutral");
    setStatus("Changes reverted.");
  }

  async function copyShareLink() {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {}
  }

  async function copyInviteLink(token: string) {
    if (!draft) return;

    const url = getGalleryInviteUrl(draft, token);
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setInviteCopiedToken(token);
    } catch {}
  }

  function handleCreateInviteToken() {
    if (!draft) return;

    const token = createGalleryInviteToken(draft.id, inviteLabel.trim() || undefined);
    setInviteLabel("");
    if (token) {
      const refreshed = loadGalleries({ includeAllProfiles: true }).find((x) => x.id === draft.id) ?? null;
      if (refreshed) {
        setGallery(cloneGallery(refreshed));
        setDraft(cloneGallery(refreshed));
        originalSnapshotRef.current = normalizeDraftForCompare(refreshed);
      }
    }
  }

  function handleDisableInviteToken(token: string) {
    if (!draft) return;
    disableGalleryInviteToken(draft.id, token);
    const refreshed = loadGalleries({ includeAllProfiles: true }).find((x) => x.id === draft.id) ?? null;
    if (refreshed) {
      setGallery(cloneGallery(refreshed));
      setDraft(cloneGallery(refreshed));
      originalSnapshotRef.current = normalizeDraftForCompare(refreshed);
    }
  }

  function handleRegeneratePublicLink() {
    if (!draft) return;
    regenerateGalleryPublicToken(draft.id);
    const refreshed = loadGalleries({ includeAllProfiles: true }).find((x) => x.id === draft.id) ?? null;
    if (refreshed) {
      setGallery(cloneGallery(refreshed));
      setDraft(cloneGallery(refreshed));
      originalSnapshotRef.current = normalizeDraftForCompare(refreshed);
    }
  }

  if (!draft || !metrics) {
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
              <Link href="/museum" className={neutralPillClass()}>
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
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link href="/museum" className={neutralPillClass()}>
            ← Back to Museum
          </Link>

          <Link href="/collector" className={neutralPillClass()}>
            Collector Profile
          </Link>
        </div>

        {status ? (
          <div
            className={[
              "mb-5 rounded-2xl px-4 py-3 text-sm ring-1",
              statusTone === "good"
                ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30"
                : "bg-[color:var(--surface)] text-[color:var(--muted)] ring-[color:var(--border)]",
            ].join(" ")}
          >
            {status}
          </div>
        ) : null}

        <section className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.42)] sm:p-8 lg:p-10">
          {draft.coverImage ? (
            <>
              <div
                className="absolute inset-0 opacity-35"
                style={{
                  backgroundImage: `url(${draft.coverImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div className="absolute inset-0 bg-black/55" />
            </>
          ) : null}

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),rgba(255,255,255,0)_28%),radial-gradient(circle_at_80%_0%,rgba(255,225,170,0.10),rgba(255,225,170,0)_24%)]" />

          <div className="relative">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={saveDraft}
                disabled={!isDirty}
                className={[
                  "inline-flex min-h-[42px] items-center justify-center rounded-full px-4 py-2 text-sm font-semibold ring-1 transition disabled:opacity-40",
                  isDirty
                    ? "vltd-pill-main-glow bg-[color:var(--pill-active-bg)] text-[color:var(--fg)]"
                    : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)]",
                ].join(" ")}
              >
                Save Changes
              </button>

              <button
                type="button"
                onClick={cancelChanges}
                disabled={!isDirty}
                className={neutralPillClass() + " disabled:opacity-40"}
              >
                Cancel Changes
              </button>

              <span className="text-sm text-[color:var(--muted)]">
                {isDirty ? "Unsaved changes" : "All changes saved"}
              </span>
            </div>

            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="text-[11px] tracking-[0.28em] text-[color:var(--muted2)]">
                  CURATED GALLERY
                </div>

                <h1 className="mt-3 text-3xl font-semibold sm:text-4xl lg:text-5xl">
                  {draft.title}
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--muted)] sm:text-base">
                  {draft.description?.trim()
                    ? draft.description
                    : "Curated collection presentation"}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-black/20 px-3 py-1.5 text-xs tracking-[0.14em] text-[color:var(--muted2)] ring-1 ring-white/10">
                    {visibilityLabel(draft.visibility)}
                  </span>

                  <span className="rounded-full bg-black/20 px-3 py-1.5 text-xs tracking-[0.14em] text-[color:var(--muted2)] ring-1 ring-white/10">
                    {metrics.totalItems} ITEMS
                  </span>

                  <span className="rounded-full bg-black/20 px-3 py-1.5 text-xs tracking-[0.14em] text-[color:var(--muted2)] ring-1 ring-white/10">
                    {metrics.views} VIEWS
                  </span>

                  <span className="rounded-full bg-black/20 px-3 py-1.5 text-xs tracking-[0.14em] text-[color:var(--muted2)] ring-1 ring-white/10">
                    {draft.exhibitionLayout?.type ?? "GRID"} LAYOUT
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
                    {formatDateTime(draft.analytics?.lastViewedAt)}
                  </div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">
                    Latest tracked access time
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
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
                    className="vltd-selectable inline-flex min-h-[40px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-xs font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]"
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
                    className="vltd-pill-main-glow inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-5 py-3 text-sm font-semibold text-[color:var(--fg)] transition hover:opacity-95"
                  >
                    {copied ? "Copied" : "Copy Link"}
                  </button>
                </div>

                <div className="relative mt-6">
                  <div className="flex items-center gap-2">
                    <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                      USER ACCESS MODE
                    </div>
                    <button
                      type="button"
                      onClick={() => setAccessInfoOpen((current) => !current)}
                      className="vltd-selectable inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--pill)] text-[11px] font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                      aria-label="Access mode help"
                      aria-expanded={accessInfoOpen}
                    >
                      i
                    </button>
                  </div>

                  {accessInfoOpen ? (
                    <div className="absolute right-0 top-8 z-20 w-full max-w-[420px] rounded-2xl bg-[color:var(--surface)] p-4 text-sm leading-6 text-[color:var(--muted)] ring-1 ring-[color:var(--border)] shadow-[0_18px_48px_rgba(0,0,0,0.32)]">
                      <div><strong>Public Gallery</strong> - Available to registered or unregistered users, searchable on Home page.</div>
                      <div className="mt-2"><strong>Guest View</strong> - Anyone with access to the shared link can view your gallery.</div>
                      <div className="mt-2"><strong>Registered Users</strong> - Any registered user with access to the shared link can view your gallery and analytics track signed-in views.</div>
                      <div className="mt-2"><strong>Private Gallery</strong> - For your own testing before sharing with anyone.</div>
                      <div className="mt-3 text-xs text-[color:var(--muted2)]">Current mode: {accessDescription(selectedAccessMode)}</div>
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateAccessMode("private")}
                      className={accessPillClass(selectedAccessMode === "private")}
                    >
                      Private
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAccessMode("public_gallery")}
                      className={accessPillClass(selectedAccessMode === "public_gallery")}
                    >
                      Public Gallery
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAccessMode("guest_view")}
                      className={accessPillClass(selectedAccessMode === "guest_view")}
                    >
                      Guest View
                    </button>
                    <button
                      type="button"
                      onClick={() => updateAccessMode("registered_users")}
                      className={accessPillClass(selectedAccessMode === "registered_users")}
                    >
                      Registered Users
                    </button>
                  </div>

                  <div className="mt-3 text-xs text-[color:var(--muted2)]">
                    Current mode: {accessDescription(selectedAccessMode)}
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] bg-black/20 p-5 ring-1 ring-white/10">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">
                  COVER IMAGE
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <input
                    id="gallery-cover-upload"
                    type="file"
                    accept="image/*"
                    onChange={updateCover}
                    className="hidden"
                  />
                  <label
                    htmlFor="gallery-cover-upload"
                    className="vltd-selectable inline-flex min-h-[40px] cursor-pointer items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-2 text-sm font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                  >
                    Upload Cover Artwork
                  </label>
                  <div className="text-sm text-[color:var(--muted)]">Choose file to refresh the hero panel artwork.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="mb-4">
            <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">
              BUILDER
            </div>
            <h2 className="mt-2 text-2xl font-semibold">Curate the Layout</h2>
          </div>

          <GalleryBuilder gallery={draft} onChange={update} onGalleryChange={patchDraft} onQuickSave={saveDraft} />
        </section>

        <section className="mt-10 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="rounded-[30px] vltd-panel-main bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">
              EXHIBIT NOTES
            </div>
            <h2 className="mt-2 text-2xl font-semibold">Visible Items</h2>

            {galleryItems.length === 0 ? (
              <div className="mt-4 rounded-2xl bg-[color:var(--input)] p-4 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                Add items to this gallery in the builder, then save changes.
              </div>
            ) : (
              <div className="mt-5 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {galleryItems.map((item, index) => {
                  const existingNote =
                    draft.itemNotes?.find((n) => n.itemId === item.id)?.note ?? "";

                  return (
                    <article
                      key={`${item.id}_${index}`}
                      className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.20)]"
                    >
                      <div className="mb-2 text-xs tracking-[0.16em] text-[color:var(--muted2)]">
                        EXHIBIT #{index + 1}
                      </div>

                      <div className="mb-4 aspect-[4/5] overflow-hidden rounded-xl bg-black/25">
                        {itemImage(item) ? (
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
            )}
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
                className="vltd-pill-main-glow mt-3 inline-flex min-h-[46px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-5 py-2 text-sm font-semibold text-[color:var(--fg)]"
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
                    const inviteUrl = getGalleryInviteUrl(draft, entry.token);

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
                          className="vltd-pill-main-glow mt-3 inline-flex min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-4 py-2 text-xs font-semibold text-[color:var(--fg)]"
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
      </div>
    </main>
  );
}

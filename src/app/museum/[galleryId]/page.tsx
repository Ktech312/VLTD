"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";

import {
  loadGalleries,
  refreshGalleriesFromSupabase,
  saveGalleriesLocally,
  type Gallery,
  type GalleryPublicItemSnapshot,
  type GalleryInvitePermissions,
  GALLERY_EVENT,
  ensureGalleryPublicToken,
  regenerateGalleryPublicToken,
  getGalleryShareUrl,
  createGalleryInviteToken,
  disableGalleryInviteToken,
  updateGalleryInviteToken,
  getGalleryInviteUrl,
  getActiveInviteTokens,
  syncGalleryToSupabaseNow,
} from "@/lib/galleryModel";

import { loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";
import { getVaultImagePublicUrl } from "@/lib/vaultCloud";
import { enqueueVaultItemSync, processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import GalleryBuilder from "@/components/GalleryBuilder";
import { ItemPickerSheet } from "@/components/gallery/ItemPickerSheet";
import { formatMoney, getGalleryMetrics } from "@/lib/portfolioMetrics";

type GalleryAccessPillMode = "private" | "public_gallery" | "guest_view" | "registered_users";

const GALLERY_ASSET_BUCKET = "gallery-backgrounds";
const GALLERY_DRAFT_CACHE_PREFIX = "vltd_gallery_editor_draft_v1";

function visibilityLabel(v: Gallery["visibility"]) {
  if (v === "LOCKED") return "Locked";
  if (v === "INVITE") return "Invite Only";
  return "Public";
}

function itemSubtitle(i: VaultItem) {
  return [i.subtitle, i.number, i.grade].filter(Boolean).join(" - ");
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
  if (!ts || !Number.isFinite(ts)) return "-";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "-";
  }
}

function cloneGallery<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function getGalleryDraftCacheKey(galleryId: string) {
  return `${GALLERY_DRAFT_CACHE_PREFIX}:${galleryId}`;
}

function compactShareUrl(value: string) {
  if (!value) return "";

  try {
    const url = new URL(value);
    const token = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
    const shortToken = token.length > 14 ? `${token.slice(0, 8)}...${token.slice(-4)}` : token;
    const host = url.hostname.replace(/^www\./, "").replace(/\.vercel\.app$/, "");
    return `${host}/.../${shortToken}`;
  } catch {
    return value.length > 24 ? `${value.slice(0, 14)}...${value.slice(-5)}` : value;
  }
}

function loadCachedGalleryDraft(galleryId: string): Gallery | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(getGalleryDraftCacheKey(galleryId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Gallery | null;
    if (!parsed || parsed.id !== galleryId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistCachedGalleryDraft(galleryId: string, draft: Gallery | null) {
  if (typeof window === "undefined") return;

  if (!draft) {
    window.sessionStorage.removeItem(getGalleryDraftCacheKey(galleryId));
    return;
  }

  window.sessionStorage.setItem(getGalleryDraftCacheKey(galleryId), JSON.stringify(draft));
}

async function uploadGalleryAssetToStorage(
  galleryId: string,
  file: File,
  kind: "cover" | "background"
): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase browser client is not available.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${galleryId}/${kind}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(GALLERY_ASSET_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage.from(GALLERY_ASSET_BUCKET).getPublicUrl(path);
  const publicUrl = typeof data?.publicUrl === "string" ? data.publicUrl.trim() : "";

  if (!publicUrl) {
    throw new Error("Failed to resolve public URL for uploaded gallery asset.");
  }

  return publicUrl;
}

function toGalleryPublicItemSnapshot(item: VaultItem): GalleryPublicItemSnapshot {
  return {
    id: item.id,
    title: item.title || "Untitled Item",
    subtitle: item.subtitle,
    number: item.number,
    grade: item.grade,
    currentValue:
      typeof item.currentValue === "number" && Number.isFinite(item.currentValue)
        ? item.currentValue
        : undefined,
    imageFrontUrl: item.imageFrontUrl,
    imageBackUrl: item.imageBackUrl,
    imageFrontStoragePath: item.imageFrontStoragePath,
    primaryImageKey: item.primaryImageKey,
    createdAt: item.createdAt,
  };
}

function vaultItemFromGallerySnapshot(snapshot: GalleryPublicItemSnapshot): VaultItem {
  return {
    id: snapshot.id,
    title: snapshot.title || "Untitled Item",
    subtitle: snapshot.subtitle,
    number: snapshot.number,
    grade: snapshot.grade,
    currentValue: snapshot.currentValue,
    imageFrontUrl: snapshot.imageFrontUrl,
    imageBackUrl: snapshot.imageBackUrl,
    imageFrontStoragePath: snapshot.imageFrontStoragePath,
    primaryImageKey: snapshot.primaryImageKey,
    createdAt:
      typeof snapshot.createdAt === "number" && Number.isFinite(snapshot.createdAt)
        ? snapshot.createdAt
        : Date.now(),
    isNew: false,
  };
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
    adultOnly: gallery.adultOnly ?? false,
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
      return "Public Exhibit - Available to registered or unregistered users, searchable on Home page.";
    case "guest_view":
      return "Guest View - Anyone with access to the shared link can view your exhibit.";
    case "registered_users":
      return "Registered Users - Any registered user with access to the shared link can view your exhibit, allows analytics on views.";
    case "private":
    default:
      return "Private Exhibit - This only for yourself, good for exhibit test beds before sharing with anyone.";
  }
}

function accessPillClass(active: boolean) {
  return [
    "vltd-selectable inline-flex min-h-[32px] items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold ring-1 transition xl:min-h-[26px] xl:px-2.5 xl:text-[10px]",
    active
      ? "vltd-pill-main-glow bg-[color:var(--pill-active-bg)] text-[color:var(--pill-active-fg)]"
      : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)] hover:bg-[color:var(--pill-hover)]",
  ].join(" ");
}

function neutralPillClass() {
  return "vltd-selectable inline-flex min-h-[38px] items-center justify-center rounded-full bg-[color:var(--pill)] px-4 py-1.5 text-xs font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)]";
}

export default function GalleryPage() {
  const params = useParams();
  const id = params?.galleryId as string | undefined;

  const [gallery, setGallery] = useState<Gallery | null>(null);
  const [draft, setDraft] = useState<Gallery | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSectionTitle, setPickerSectionTitle] = useState("Section 1");
  const [pickerSectionIds, setPickerSectionIds] = useState<string[] | null>(null);
  const [pickerSectionIdx, setPickerSectionIdx] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [accessInfoOpen, setAccessInfoOpen] = useState(false);
  const [adultInfoOpen, setAdultInfoOpen] = useState(false);
  const [inviteLabel, setInviteLabel] = useState("");
  const [inviteCopiedToken, setInviteCopiedToken] = useState<string>("");
  const [openPermissionsToken, setOpenPermissionsToken] = useState<string | null>(null);
  const [openExpiryToken, setOpenExpiryToken] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "good">("neutral");
  const [isUploadingCover, setIsUploadingCover] = useState(false);

  const [originalSnapshot, setOriginalSnapshot] = useState("");
  const latestGalleryRef = useRef<Gallery | null>(null);
  const latestDraftRef = useRef<Gallery | null>(null);

  const loadState = useCallback(() => {
    if (!id) return;

    const galleries = loadGalleries();
    const rawGallery = galleries.find((x) => x.id === id) ?? null;
    const cachedDraft = loadCachedGalleryDraft(id);
    const mergedGallery = mergeHeavyDraftFields(
      rawGallery,
      latestDraftRef.current ?? latestGalleryRef.current ?? cachedDraft
    );
    const nextDraft =
      cachedDraft &&
      cachedDraft.updatedAt >= (mergedGallery?.updatedAt ?? 0)
        ? mergeHeavyDraftFields(cachedDraft, mergedGallery)
        : mergedGallery;

    setGallery(mergedGallery);
    setDraft(nextDraft ? cloneGallery(nextDraft) : null);
    setOriginalSnapshot(normalizeDraftForCompare(mergedGallery));
    setItems(loadItems());
  }, [id]);

  useEffect(() => {
    if (!id) return;

    ensureGalleryPublicToken(id);
    loadState();
    void refreshGalleriesFromSupabase(true);

    function onGalleryChange() {
      loadState();
    }

    window.addEventListener(GALLERY_EVENT, onGalleryChange);
    return () => window.removeEventListener(GALLERY_EVENT, onGalleryChange);
  }, [id, loadState]);

  useEffect(() => {
    if (!id) return;

    function onWindowFocus() {
      void refreshGalleriesFromSupabase(true);
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshGalleriesFromSupabase(true);
      }
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshGalleriesFromSupabase(true);
      }
    }, 15000);

    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function hydrateVaultItems() {
      await syncVaultItemsFromSupabase();
      if (cancelled) return;
      setItems(loadItems());
    }

    void hydrateVaultItems();

    function onVaultUpdate() {
      setItems(loadItems());
    }

    window.addEventListener("vltd:vault-updated", onVaultUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("vltd:vault-updated", onVaultUpdate);
    };
  }, [id]);

  const shareUrl = useMemo(() => (draft ? getGalleryShareUrl(draft) : ""), [draft]);
  const shareUrlPreview = useMemo(() => compactShareUrl(shareUrl), [shareUrl]);

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

  useEffect(() => {
    if (!id) return;

    if (!draft) {
      persistCachedGalleryDraft(id, null);
      return;
    }

    persistCachedGalleryDraft(id, draft);
  }, [draft, id, originalSnapshot]);

  const galleryItems = useMemo(() => {
    if (!draft) return [];
    const byId = new Map(items.map((item) => [item.id, item]));
    const snapshotById = new Map(
      (draft.publicItemSnapshots ?? []).map((snapshot) => [snapshot.id, snapshot])
    );

    return draft.itemIds
      .map((itemId) => {
        const localItem = byId.get(itemId);
        if (localItem) return localItem;
        const snapshot = snapshotById.get(itemId);
        return snapshot ? vaultItemFromGallerySnapshot(snapshot) : undefined;
      })
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
    return normalizeDraftForCompare(draft) !== originalSnapshot;
  }, [draft, originalSnapshot]);

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

  async function updateCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !draft) return;

    try {
      setIsUploadingCover(true);
      const publicUrl = await uploadGalleryAssetToStorage(draft.id, file, "cover");
      patchDraft((current) => ({
        ...current,
        coverImage: publicUrl,
      }));
      setStatusTone("neutral");
      setStatus("Cover artwork uploaded. Click Save to publish it.");
    } catch (error) {
      console.error("Failed uploading cover artwork:", error);
      setStatusTone("neutral");
      setStatus(
        error instanceof Error ? error.message : "Cover upload failed."
      );
    } finally {
      setIsUploadingCover(false);
    }
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

  async function saveDraft(overrideIds?: string[], overrideSections?: Gallery["sections"]) {
    const baseDraft = latestDraftRef.current ?? draft;
    if (!baseDraft) return;
    const effectiveIds = overrideIds ?? baseDraft.itemIds;
    const effectiveSections = overrideSections ?? baseDraft.sections;

    const preservedPublicToken =
      baseDraft.share?.publicToken ||
      gallery?.share?.publicToken ||
      ensureGalleryPublicToken(baseDraft.id) ||
      undefined;

    const snapshotFallbackById = new Map<string, GalleryPublicItemSnapshot>();
    for (const snapshot of baseDraft.publicItemSnapshots ?? []) {
      snapshotFallbackById.set(snapshot.id, snapshot);
    }
    for (const snapshot of gallery?.publicItemSnapshots ?? []) {
      if (!snapshotFallbackById.has(snapshot.id)) {
        snapshotFallbackById.set(snapshot.id, snapshot);
      }
    }

    const selectedItemById = new Map(items.map((item) => [item.id, item]));
    const publicItemSnapshots = effectiveIds
      .map((itemId) => {
        const localItem = selectedItemById.get(itemId);
        if (localItem) return toGalleryPublicItemSnapshot(localItem);
        return snapshotFallbackById.get(itemId);
      })
      .filter(Boolean) as GalleryPublicItemSnapshot[];
    const effectiveExhibitionLayout = effectiveSections
      ? (Object.assign({}, baseDraft.exhibitionLayout ?? {}, {
          sections: effectiveSections,
        }) as Gallery["exhibitionLayout"])
      : baseDraft.exhibitionLayout;

    const nextDraft = cloneGallery({
      ...baseDraft,
      itemIds: effectiveIds,
      sections: effectiveSections,
      exhibitionLayout: effectiveExhibitionLayout,
      publicItemSnapshots,
      updatedAt: Date.now(), // bump so local always beats Supabase in hydration merge
      share: {
        publicToken: preservedPublicToken,
        inviteTokens:
          baseDraft.share?.inviteTokens ??
          gallery?.share?.inviteTokens ??
          [],
      },
    });

    const all = loadGalleries({ includeAllProfiles: true });
    let found = false;
    const next = all.map((entry) => {
      if (entry.id !== baseDraft.id) return entry;
      found = true;
      return nextDraft;
    });
    if (!found) {
      next.push(nextDraft);
    }
    saveGalleriesLocally(next);
    persistCachedGalleryDraft(nextDraft.id, nextDraft);

    setGallery(cloneGallery(nextDraft));
    setDraft(cloneGallery(nextDraft));
    setOriginalSnapshot(normalizeDraftForCompare(nextDraft));

    try {
      // Sync gallery to Supabase FIRST so slotLayout/sections land in cloud immediately.
      // Vault item syncs are secondary — they run concurrently but don't block gallery save.
      let vaultSyncError: unknown = null;

      const [galleryResult] = await Promise.allSettled([
        syncGalleryToSupabaseNow(nextDraft),
        (async () => {
          try {
            for (const itemId of nextDraft.itemIds) {
              enqueueVaultItemSync(itemId);
            }
            await processVaultSyncQueue();
            await syncVaultItemsFromSupabase();
            setItems(loadItems());
          } catch (error) {
            vaultSyncError = error;
            console.error("Vault sync failed during gallery save:", error);
          }
        })(),
      ]);

      if (galleryResult.status === "rejected") {
        throw galleryResult.reason;
      }

      setStatusTone(vaultSyncError ? "neutral" : "good");
      setStatus(
        vaultSyncError
          ? "Gallery saved. Some vault sync tasks still need retrying."
          : "Gallery saved."
      );
    } catch (error) {
      console.error("Direct gallery sync failed:", error);
      setStatusTone("neutral");
      setStatus("Gallery saved locally. Cloud sync failed.");
    }
  }

  function cancelChanges() {
    if (!gallery) return;
    persistCachedGalleryDraft(gallery.id, null);
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
          setOriginalSnapshot(normalizeDraftForCompare(refreshed));
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
        setOriginalSnapshot(normalizeDraftForCompare(refreshed));
    }
  }

  function handleUpdateTokenPermissions(token: string, permissions: GalleryInvitePermissions) {
    if (!draft) return;
    updateGalleryInviteToken(draft.id, token, { permissions });
    const refreshed = loadGalleries({ includeAllProfiles: true }).find((x) => x.id === draft.id) ?? null;
    if (refreshed) {
      setGallery(cloneGallery(refreshed));
      setDraft(cloneGallery(refreshed));
      setOriginalSnapshot(normalizeDraftForCompare(refreshed));
    }
  }

  function handleUpdateTokenExpiry(token: string, expiresAt: number | null) {
    if (!draft) return;
    updateGalleryInviteToken(draft.id, token, { expiresAt });
    const refreshed = loadGalleries({ includeAllProfiles: true }).find((x) => x.id === draft.id) ?? null;
    if (refreshed) {
      setGallery(cloneGallery(refreshed));
      setDraft(cloneGallery(refreshed));
      setOriginalSnapshot(normalizeDraftForCompare(refreshed));
    }
    setOpenExpiryToken(null);
  }

  function handleRegeneratePublicLink() {
    if (!draft) return;
    regenerateGalleryPublicToken(draft.id);
    const refreshed = loadGalleries({ includeAllProfiles: true }).find((x) => x.id === draft.id) ?? null;
    if (refreshed) {
      setGallery(cloneGallery(refreshed));
      setDraft(cloneGallery(refreshed));
        setOriginalSnapshot(normalizeDraftForCompare(refreshed));
    }
  }

  if (!draft || !metrics) {
    return (
      <main className="min-h-screen text-[color:var(--fg)]">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4">
          <div className="rounded-[28px] vltd-panel-main bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              MUSEUM
            </div>
            <h1 className="mt-3 text-2xl font-semibold">Gallery not found</h1>
            <p className="mt-3 text-sm text-[color:var(--muted)]">
              This exhibit could not be loaded from local storage.
            </p>
            <div className="mt-6">
              <Link href="/museum" className={neutralPillClass()}>
                Back to Exhibitions
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden text-[color:var(--fg)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 xl:py-5">
        <div className="mx-auto mb-4 flex max-w-[780px] flex-wrap items-center gap-3">
          <Link href="/museum" className={neutralPillClass()}>
            Back to Exhibitions
          </Link>
        </div>

        {status ? (
          <div
            className={[
              "mx-auto mb-5 max-w-[780px] rounded-2xl px-4 py-3 text-sm ring-1",
              statusTone === "good"
                ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30"
                : "bg-[color:var(--surface)] text-[color:var(--muted)] ring-[color:var(--border)]",
            ].join(" ")}
          >
            {status}
          </div>
        ) : null}

        <section className="relative mx-auto max-w-[780px] overflow-hidden rounded-[24px] border border-[color:var(--border)] bg-[color:var(--surface)] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.38)] sm:p-4 xl:p-3.5">
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

          <div className="relative md:mx-auto md:w-[690px] md:max-w-full">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between xl:justify-start xl:gap-5">
              <div className="flex items-start gap-2.5 max-w-3xl">
                {/* Cover image portrait card */}
                <div className="shrink-0">
                  {draft.coverImage ? (
                    <div
                      className="w-[72px] overflow-hidden rounded-[14px] shadow-[0_8px_24px_rgba(0,0,0,0.5)] xl:w-14"
                      style={{ aspectRatio: "3/4" }}
                    >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={draft.coverImage}
                        alt="Cover art"
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    </div>
                  ) : null}
                  <input
                    id="gallery-cover-upload"
                    type="file"
                    accept="image/*"
                    onChange={updateCover}
                    className="hidden"
                  />
                  <label
                    htmlFor="gallery-cover-upload"
                    className={[
                      "mt-1 block cursor-pointer text-center text-[8px] font-semibold text-[color:var(--fg)]",
                      isUploadingCover ? "cursor-wait opacity-70" : "",
                    ].join(" ")}
                  >
                    {isUploadingCover ? "Uploading..." : "Cover Artwork"}
                  </label>
                </div>

                <div className="min-w-0">
                  <div className="text-[11px] tracking-[0.28em] text-[color:var(--muted2)] xl:text-[10px]">
                    CURATED EXHIBIT
                  </div>

                  <h1 className="mt-2 text-2xl font-semibold xl:mt-1 xl:text-2xl">
                    {draft.title}
                  </h1>

                  <p className="mt-1 max-w-2xl text-sm leading-5 text-[color:var(--muted)] xl:text-xs xl:leading-4">
                    {draft.description?.trim()
                      ? draft.description
                      : "Curated collection presentation"}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5 xl:mt-2 xl:gap-1">
                    <span className="rounded-full bg-[color:var(--theme-elevated)] px-3 py-1.5 text-xs tracking-[0.14em] text-[color:var(--muted2)] ring-1 ring-[color:var(--theme-border)] xl:px-2.5 xl:py-1 xl:text-[10px]">
                      {visibilityLabel(draft.visibility)}
                    </span>

                    <span className="rounded-full bg-[color:var(--theme-elevated)] px-3 py-1.5 text-xs tracking-[0.14em] text-[color:var(--muted2)] ring-1 ring-[color:var(--theme-border)] xl:px-2.5 xl:py-1 xl:text-[10px]">
                      {metrics.totalItems} ITEMS
                    </span>

                    <span className="rounded-full bg-[color:var(--theme-elevated)] px-3 py-1.5 text-xs tracking-[0.14em] text-[color:var(--muted2)] ring-1 ring-[color:var(--theme-border)] xl:px-2.5 xl:py-1 xl:text-[10px]">
                      {metrics.views} VIEWS
                    </span>

                    <span className="rounded-full bg-[color:var(--theme-elevated)] px-3 py-1.5 text-xs tracking-[0.14em] text-[color:var(--muted2)] ring-1 ring-[color:var(--theme-border)] xl:px-2.5 xl:py-1 xl:text-[10px]">
                      {draft.exhibitionLayout?.type ?? "GRID"} LAYOUT
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end xl:justify-start xl:gap-1.5">
                <div className="rounded-2xl bg-[color:var(--surface)] px-3.5 py-2.5 ring-1 ring-[color:var(--border)] xl:rounded-xl xl:px-2.5 xl:py-2">
                  <div className="text-[9px] tracking-[0.18em] text-[color:var(--muted2)]">VALUE</div>
                  <div className="mt-0.5 text-lg font-semibold leading-tight xl:text-base">{formatMoney(metrics.totalValue)}</div>
                </div>

                <div className="rounded-2xl bg-[color:var(--surface)] px-3.5 py-2.5 ring-1 ring-[color:var(--border)] xl:rounded-xl xl:px-2.5 xl:py-2">
                  <div className="text-[9px] tracking-[0.18em] text-[color:var(--muted2)]">ROI</div>
                  <div className="mt-0.5 text-lg font-semibold leading-tight xl:text-base">
                    {metrics.roi >= 0 ? "+" : ""}{metrics.roi.toFixed(1)}%
                  </div>
                </div>

                <div className="rounded-2xl bg-[color:var(--surface)] px-3.5 py-2.5 ring-1 ring-[color:var(--border)] xl:rounded-xl xl:px-2.5 xl:py-2">
                  <div className="text-[9px] tracking-[0.18em] text-[color:var(--muted2)]">NOTES</div>
                  <div className="mt-0.5 text-lg font-semibold leading-tight xl:text-base">{metrics.notesCoverage.toFixed(0)}%</div>
                </div>

                <div className="rounded-2xl bg-[color:var(--surface)] px-3.5 py-2.5 ring-1 ring-[color:var(--border)] xl:rounded-xl xl:px-2.5 xl:py-2">
                  <div className="text-[9px] tracking-[0.18em] text-[color:var(--muted2)]">VIEWS</div>
                  <div className="mt-0.5 text-lg font-semibold leading-tight xl:text-base">{metrics.views}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 md:max-w-[690px] xl:mt-2">
              <div className="rounded-[22px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)] xl:rounded-[18px] xl:p-3">
                <div>
                  <div>
                    <div className="text-[10px] tracking-[0.18em] text-[color:var(--muted2)]">
                      PUBLIC SHARE LINK
                    </div>
                    <div className="mt-0.5 text-xs text-[color:var(--muted)]">
                      Uses a dedicated public route for clean sharing.
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-[auto_auto_auto] items-center justify-start gap-1.5 xl:mt-2">
                  <button
                    type="button"
                    onClick={copyShareLink}
                    className="vltd-pill-main-glow inline-flex min-h-[30px] shrink-0 items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-2 py-1 text-[10px] font-semibold text-[color:var(--fg)] transition hover:opacity-95 xl:min-h-[28px]"
                  >
                    {copied ? "Copied" : "Copy Link"}
                  </button>
                  <div
                    title={shareUrl}
                    className="min-h-[30px] min-w-0 truncate rounded-full bg-[color:var(--input)] px-2 py-1.5 text-[10px] font-semibold text-[color:var(--fg)] ring-1 ring-[color:var(--border)] xl:min-h-[28px]"
                  >
                    {shareUrlPreview}
                  </div>
                  <button
                    type="button"
                    onClick={handleRegeneratePublicLink}
                    className="vltd-selectable inline-flex min-h-[30px] items-center justify-center rounded-full bg-[color:var(--pill)] px-2 py-1 text-[9px] font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)] xl:min-h-[28px]"
                  >
                    Regenerate
                  </button>
                </div>

                <div className="relative mt-4 xl:mt-2">
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] tracking-[0.18em] text-[color:var(--muted2)]">
                      USER ACCESS MODE
                    </div>
                    <button
                      type="button"
                      onClick={() => setAccessInfoOpen((current) => !current)}
                      className="vltd-selectable inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--pill)] text-[10px] font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                      aria-label="Access mode help"
                      aria-expanded={accessInfoOpen}
                    >
                      i
                    </button>
                  </div>

                  {accessInfoOpen ? (
                    <div className="absolute left-0 bottom-full z-20 mb-3 w-full max-w-[520px] rounded-2xl bg-[color:var(--surface)] p-4 text-sm leading-6 text-[color:var(--fg)] ring-1 ring-[color:var(--border)] shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">ACCESS MODE HELP</div>
                        <button
                          type="button"
                          onClick={() => setAccessInfoOpen(false)}
                          className="vltd-selectable inline-flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--pill)] text-xs font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                          aria-label="Close access mode help"
                        >
                          X
                        </button>
                      </div>
                      <div className="mt-3"><strong>Public Exhibit</strong> - Available to registered or unregistered users, searchable on Home page.</div>
                      <div className="mt-2"><strong>Guest View</strong> - Anyone with access to the shared link can view your exhibit.</div>
                      <div className="mt-2"><strong>Registered Users</strong> - Any registered user with access to the shared link can view your exhibit and analytics track signed-in views.</div>
                      <div className="mt-2"><strong>Private Exhibit</strong> - For your own testing before sharing with anyone.</div>
                      <div className="mt-3 rounded-xl bg-[color:var(--input)] px-3 py-2 text-xs text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">Current mode: {accessDescription(selectedAccessMode)}</div>
                    </div>
                  ) : null}

                  <div className="mt-2 flex flex-wrap items-center gap-1.5 xl:gap-1">
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
                      Public Exhibit
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

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--border)] pt-2 md:flex-nowrap">
                    <div className="relative inline-flex min-h-[34px] w-fit items-center gap-2 rounded-full bg-[color:var(--surface)] px-3 py-1.5 ring-1 ring-[color:var(--border)] xl:min-h-[28px] xl:px-2.5 xl:py-1">
                      <span className="flex items-center gap-1.5">
                        <span className="block text-xs font-semibold">18+ exhibit</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setAdultInfoOpen((current) => !current);
                          }}
                          className="vltd-selectable inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--pill)] text-[10px] font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                          aria-label="18+ exhibit help"
                          aria-expanded={adultInfoOpen}
                        >
                          i
                        </button>
                      </span>
                      <input
                        type="checkbox"
                        aria-label="Require 18+ confirmation"
                        checked={draft.adultOnly === true}
                        onChange={(event) =>
                          patchDraft((current) => ({
                            ...current,
                            adultOnly: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 accent-cyan-400"
                      />
                      {adultInfoOpen ? (
                        <span className="absolute left-0 bottom-full z-20 mb-2 w-[min(360px,calc(100vw-48px))] rounded-xl bg-[color:var(--surface)] px-3 py-2 text-[11px] leading-4 text-[color:var(--muted)] ring-1 ring-[color:var(--border)] shadow-[0_18px_44px_rgba(0,0,0,0.38)]">
                          Public viewers must confirm they are 18 or older before entering this exhibit.
                        </span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 md:ml-auto md:flex-nowrap">
                      <button
                        type="button"
                        onClick={() => void saveDraft()}
                        disabled={!isDirty}
                        className="vltd-pill-main-glow inline-flex min-h-[30px] min-w-[104px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-3 py-1 text-[10px] font-semibold text-[color:var(--fg)] ring-1 ring-[rgba(245,181,72,0.48)] transition hover:opacity-95"
                      >
                        Save Changes
                      </button>
                      <button
                        type="button"
                        onClick={cancelChanges}
                        disabled={!isDirty}
                        className="inline-flex min-h-[30px] min-w-[104px] items-center justify-center rounded-full bg-[color:var(--pill)] px-3 py-1 text-[10px] font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)] transition hover:bg-[color:var(--pill-hover)] disabled:opacity-60"
                      >
                        Cancel Changes
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-[780px]">
          <div className="mb-4">
            <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">
              BUILDER
            </div>
            <h2 className="mt-2 text-2xl font-semibold">Curate the Layout</h2>
          </div>

          <GalleryBuilder
            gallery={draft}
            items={items}
            onChange={update}
            onGalleryChange={patchDraft}
            onQuickSave={saveDraft}
            onOpenPicker={(sectionTitle, sectionItemIds, sectionIdx) => {
              setPickerSectionTitle(sectionTitle ?? "Section 1");
              setPickerSectionIds(sectionItemIds ?? null);
              setPickerSectionIdx(sectionIdx ?? null);
              setPickerOpen(true);
            }}
            advancedContent={
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]" style={{ maxWidth: "calc(100vw - 2rem)" }}>
          <div className="rounded-[30px] vltd-panel-main bg-[color:var(--surface)] p-6 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-[11px] tracking-[0.24em] text-[color:var(--muted2)]">
              EXHIBIT NOTES
            </div>
            <h2 className="mt-2 text-2xl font-semibold">Description</h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Shown to visitors on the public exhibit page.
            </p>

            <textarea
              value={draft.description ?? ""}
              onChange={(e) =>
                patchDraft((current) => ({ ...current, description: e.target.value }))
              }
              placeholder="Describe this exhibit for visitors — theme, story, what makes it special..."
              className="mt-4 min-h-[160px] w-full rounded-2xl bg-[color:var(--input)] p-4 text-sm ring-1 ring-[color:var(--border)] focus:outline-none resize-none leading-relaxed"
            />

            {galleryItems.length > 0 ? (
              <div className="mt-4">
                <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">ITEMS IN THIS EXHIBIT</div>
                <div className="mt-2 flex flex-col gap-1">
                  {galleryItems.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-xl bg-[color:var(--input)] px-3 py-2 text-sm ring-1 ring-[color:var(--border)]">
                      <span className="text-[10px] tracking-[0.14em] text-[color:var(--muted2)] shrink-0">#{index + 1}</span>
                      <span className="font-medium truncate">{item.title}</span>
                      <span className="ml-auto text-[11px] text-[color:var(--muted)] shrink-0">{itemSubtitle(item) || ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-[color:var(--input)] p-4 text-sm text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                Add items in the builder above, then save.
              </div>
            )}
          </div>

          <aside className="rounded-[22px] vltd-panel-main bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-[10px] tracking-[0.24em] text-[color:var(--muted2)]">
              AUDIENCE + ACCESS
            </div>

            <h2 className="mt-2 text-xl font-semibold">Invite Tokens</h2>

            {/* Compact stats row */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-[color:var(--input)] px-2.5 py-2 ring-1 ring-[color:var(--border)]">
                <div className="text-[9px] tracking-[0.16em] text-[color:var(--muted2)]">VIEWS</div>
                <div className="mt-0.5 text-lg font-semibold leading-tight">{metrics.views}</div>
              </div>
              <div className="rounded-xl bg-[color:var(--input)] px-2.5 py-2 ring-1 ring-[color:var(--border)]">
                <div className="text-[9px] tracking-[0.16em] text-[color:var(--muted2)]">UNIQUE</div>
                <div className="mt-0.5 text-lg font-semibold leading-tight">{metrics.uniqueViewers}</div>
              </div>
              <div className="rounded-xl bg-[color:var(--input)] px-2.5 py-2 ring-1 ring-[color:var(--border)]">
                <div className="text-[9px] tracking-[0.16em] text-[color:var(--muted2)]">TOKENS</div>
                <div className="mt-0.5 text-lg font-semibold leading-tight">{metrics.inviteCount}</div>
              </div>
            </div>

            {/* Create token form */}
            <div className="mt-3 rounded-[18px] bg-[color:var(--input)] p-3 ring-1 ring-[color:var(--border)]">
              <div className="text-[10px] font-semibold tracking-[0.14em] text-[color:var(--muted2)]">CREATE INVITE TOKEN</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  value={inviteLabel}
                  onChange={(e) => setInviteLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateInviteToken(); }}
                  placeholder="Optional label, e.g. VIP preview"
                  className="min-h-[36px] w-full rounded-xl bg-[color:var(--surface)] px-3 py-1.5 text-xs ring-1 ring-[color:var(--border)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCreateInviteToken}
                  className="vltd-pill-main-glow inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-4 py-1.5 text-xs font-semibold text-[color:var(--fg)] whitespace-nowrap"
                >
                  Create Link
                </button>
              </div>
            </div>

            {/* Active invite links */}
            <div className="mt-3">
              <div className="text-[10px] font-semibold tracking-[0.14em] text-[color:var(--muted2)]">ACTIVE INVITE LINKS</div>

              {activeInviteTokens.length === 0 ? (
                <div className="mt-2 rounded-[18px] bg-[color:var(--input)] px-3 py-3 text-xs text-[color:var(--muted)] ring-1 ring-[color:var(--border)]">
                  No active invite tokens yet.
                </div>
              ) : (
                <div className="mt-2 grid gap-2">
                  {activeInviteTokens.map((entry) => {
                    const inviteUrl = getGalleryInviteUrl(draft, entry.token);
                    const perms = entry.permissions ?? {};
                    const isPermsOpen = openPermissionsToken === entry.token;
                    const isExpiryOpen = openExpiryToken === entry.token;

                    const expiryLabel = (() => {
                      if (!entry.expiresAt) return "Never";
                      const diff = entry.expiresAt - Date.now();
                      if (diff <= 0) return "Expired";
                      const days = Math.ceil(diff / 86400000);
                      return days === 1 ? "1 day" : `${days}d`;
                    })();

                    return (
                      <div
                        key={entry.token}
                        className="rounded-[18px] bg-[color:var(--input)] p-3 ring-1 ring-[color:var(--border)]"
                      >
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold">
                              {entry.label?.trim() || "Untitled invite"}
                            </div>
                            <div className="mt-0.5 text-[10px] text-[color:var(--muted)]">
                              Created {formatDateTime(entry.createdAt)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDisableInviteToken(entry.token)}
                            className="inline-flex min-h-[28px] shrink-0 items-center justify-center rounded-full bg-[color:var(--pill)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--pill-fg)] ring-1 ring-[color:var(--border)]"
                          >
                            Disable
                          </button>
                        </div>

                        {/* URL input — selectable */}
                        <input
                          value={inviteUrl}
                          readOnly
                          onFocus={(e) => e.target.select()}
                          className="mt-2 min-h-[34px] w-full rounded-xl bg-[color:var(--surface)] px-3 py-1.5 text-[11px] ring-1 ring-[color:var(--border)] focus:outline-none cursor-text select-all"
                        />

                        {/* Action pills row */}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => copyInviteLink(entry.token)}
                            className="vltd-pill-main-glow inline-flex min-h-[30px] items-center justify-center rounded-full bg-[color:var(--pill-active-bg)] px-3 py-1 text-[10px] font-semibold text-[color:var(--fg)]"
                          >
                            {inviteCopiedToken === entry.token ? "Copied!" : "Copy Link"}
                          </button>

                          {/* Expiry pill */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenExpiryToken(isExpiryOpen ? null : entry.token);
                                setOpenPermissionsToken(null);
                              }}
                              className={[
                                "inline-flex min-h-[30px] items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 transition",
                                isExpiryOpen
                                  ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-[color:var(--pill-active-ring)]"
                                  : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)]",
                              ].join(" ")}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                                <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                              Expires: {expiryLabel}
                            </button>

                            {isExpiryOpen && (
                              <div className="absolute left-0 top-full z-20 mt-1.5 w-40 rounded-[14px] bg-[color:var(--surface)] p-2 ring-1 ring-[color:var(--border)] shadow-[0_12px_36px_rgba(0,0,0,0.42)]">
                                {[
                                  { label: "Never", value: null },
                                  { label: "24 hours", value: Date.now() + 86400000 },
                                  { label: "7 days", value: Date.now() + 7 * 86400000 },
                                  { label: "30 days", value: Date.now() + 30 * 86400000 },
                                ].map(({ label, value }) => (
                                  <button
                                    key={label}
                                    type="button"
                                    onClick={() => handleUpdateTokenExpiry(entry.token, value)}
                                    className="flex w-full items-center rounded-xl px-2.5 py-1.5 text-left text-[11px] transition hover:bg-[color:var(--input)]"
                                  >
                                    {label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Permissions pill */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenPermissionsToken(isPermsOpen ? null : entry.token);
                                setOpenExpiryToken(null);
                              }}
                              className={[
                                "inline-flex min-h-[30px] items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 transition",
                                isPermsOpen
                                  ? "bg-[color:var(--pill-active-bg)] text-[color:var(--fg)] ring-[color:var(--pill-active-ring)]"
                                  : "bg-[color:var(--pill)] text-[color:var(--pill-fg)] ring-[color:var(--border)]",
                              ].join(" ")}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M12 2a5 5 0 0 1 5 5v1h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h1V7a5 5 0 0 1 5-5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                                <circle cx="12" cy="15" r="1.5" fill="currentColor" />
                              </svg>
                              Permissions
                            </button>

                            {isPermsOpen && (
                              <div className="absolute left-0 top-full z-20 mt-1.5 w-52 rounded-[14px] bg-[color:var(--surface)] p-3 ring-1 ring-[color:var(--border)] shadow-[0_12px_36px_rgba(0,0,0,0.42)]">
                                <div className="mb-2 text-[9px] font-bold tracking-[0.18em] text-[color:var(--muted2)]">VIEWER PERMISSIONS</div>
                                {(
                                  [
                                    { key: "images" as const, label: "Images", desc: "Enlarge gallery images" },
                                    { key: "descriptionPage" as const, label: "Description Page", desc: "Full item info, no prices" },
                                    { key: "financialHistory" as const, label: "Financial History", desc: "Reveal purchase & value data" },
                                  ] as const
                                ).map(({ key, label, desc }) => (
                                  <label
                                    key={key}
                                    className="flex cursor-pointer items-start gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-[color:var(--input)]"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={!!perms[key]}
                                      onChange={(e) => {
                                        const next = { ...perms, [key]: e.target.checked };
                                        handleUpdateTokenPermissions(entry.token, next);
                                      }}
                                      className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[color:var(--accent)]"
                                    />
                                    <div>
                                      <div className="text-[11px] font-semibold leading-tight">{label}</div>
                                      <div className="mt-0.5 text-[10px] leading-tight text-[color:var(--muted)]">{desc}</div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </section>
            }
          />
        </section>



      </div>

      {pickerOpen && (
        <ItemPickerSheet
          allItems={items}
          confirmedIds={pickerSectionIds !== null ? pickerSectionIds : draft.itemIds}
          sectionTitle={pickerSectionTitle}
          onConfirm={(ids) => {
            if (pickerSectionIds !== null && pickerSectionIdx !== null) {
              // Section-specific update: add/remove items for this section only
              patchDraft((current) => {
                const oldSet = new Set(pickerSectionIds);
                const removedFromSection = pickerSectionIds.filter((id) => !ids.includes(id));
                const addedToSection = ids.filter((id) => !oldSet.has(id));
                const removedSet = new Set(removedFromSection);
                // Sync gallery.itemIds: remove deselected, add newly picked
                let nextGalleryIds = current.itemIds.filter((id) => !removedSet.has(id));
                const gallerySet = new Set(nextGalleryIds);
                nextGalleryIds = [...nextGalleryIds, ...addedToSection.filter((id) => !gallerySet.has(id))];
                // Update the section's itemIds
                const currentSections = Array.isArray(current.sections) ? current.sections : [];
                const nextSections = currentSections.map((s, i) =>
                  i === pickerSectionIdx ? { ...s, itemIds: ids } : s
                );
                return {
                  ...current,
                  itemIds: nextGalleryIds,
                  sections: nextSections,
                  exhibitionLayout: {
                    ...(current.exhibitionLayout as object ?? {}),
                    sections: nextSections,
                  } as Gallery["exhibitionLayout"],
                };
              });
              void saveDraft();
            } else {
              // No sections — old behavior
              update(ids);
              void saveDraft(ids);
            }
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </main>
  );
}

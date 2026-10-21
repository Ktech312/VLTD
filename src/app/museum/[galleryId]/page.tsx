"use client";

import { pillClassName, type PillVariant } from "@/components/ui/PillButton";
import { accessDescription, applyAccessMode, getAccessMode, type GalleryAccessPillMode } from "@/lib/galleryAccess";
import { buildPublicSnapshot, isHiddenInExhibits, vaultItemFromPublicSnapshot as vaultItemFromGallerySnapshot } from "@/lib/hiddenItems";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import ContentActionBar from "@/components/share/ContentActionBar";
import { AppIcon } from "@/components/ui/AppIcon";
import { Glyph } from "@/components/ui/Glyph";

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

import { getPrimaryImageUrl, loadItems, syncVaultItemsFromSupabase, type VaultItem } from "@/lib/vaultModel";
import { isSupplyItem } from "@/lib/vaultStats";
import { logExhibitionPublished, logExhibitionAnnouncement } from "@/lib/exhibitionEvents";
import { getVaultImagePublicUrl } from "@/lib/vaultCloud";
import { enqueueVaultItemSync, processVaultSyncQueue } from "@/lib/vaultSyncQueue";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import GalleryBuilder from "@/components/GalleryBuilder";
import { INLINE_EDIT_LINE } from "@/lib/inlineEdit";
import { ItemPickerSheet } from "@/components/gallery/ItemPickerSheet";
import { formatMoney, getGalleryMetrics } from "@/lib/portfolioMetrics";


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

  try {
    if (!draft) {
      window.sessionStorage.removeItem(getGalleryDraftCacheKey(galleryId));
      return;
    }

    window.sessionStorage.setItem(getGalleryDraftCacheKey(galleryId), JSON.stringify(draft));
  } catch {
    // Private mode or full storage: the draft cache is only a convenience.
  }
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
    // the curator alias and the shelf style are edited here too: without them a change to either never counted as an edit, so it was
    // never autosaved (RB: alias and shelf-style edits lived only in this browser)
    aliasEnabled: gallery.aliasEnabled ?? false,
    aliasName: gallery.aliasName ?? "",
    aliasAvatar: gallery.aliasAvatar ?? "",
    shelfOverlayStyle: gallery.shelfOverlayStyle ?? "",
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

// Every control in the exhibit editor uses the one shared compact pill (32px, 28px on desktop, 44px touch target on phones).
function compactPill(variant: PillVariant = "default", extra = "") {
  return pillClassName(variant, false, extra, "compact");
}

// Checkbox wrapper: the 14px box stays visually the same; on phones the label supplies an invisible 44px hit area
// (extra left margin keeps it clear of the neighbouring "i" button).
const CHECKBOX_LABEL =
  "relative inline-flex cursor-pointer items-center max-md:ml-[21px] max-md:after:absolute max-md:after:-inset-[15px] max-md:after:content-['']";

function accessPillClass(active: boolean) {
  return compactPill(active ? "active" : "default");
}

function neutralPillClass() {
  return compactPill("default");
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
  const [accessInfoOpen, setAccessInfoOpen] = useState(false);
  const [adultInfoOpen, setAdultInfoOpen] = useState(false);
  const [aliasInfoOpen, setAliasInfoOpen] = useState(false);
  const [inviteLabel, setInviteLabel] = useState("");
  const [inviteCopiedToken, setInviteCopiedToken] = useState<string>("");
  const [openPermissionsToken, setOpenPermissionsToken] = useState<string | null>(null);
  const [openExpiryToken, setOpenExpiryToken] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<"neutral" | "good">("neutral");
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [confirmPublic, setConfirmPublic] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [headerEditing, setHeaderEditing] = useState(false);
  const [announcing, setAnnouncing] = useState(false);
  // A refused follower notice stays on screen next to the buttons until the next action (the page-wide status line clears itself in 2 s
  // and can sit above the visible part of the page).
  const [noticeProblem, setNoticeProblem] = useState("");
  const [announced, setAnnounced] = useState(false);

  const [originalSnapshot, setOriginalSnapshot] = useState("");
  const latestGalleryRef = useRef<Gallery | null>(null);
  const latestDraftRef = useRef<Gallery | null>(null);
  const isDirtyRef = useRef(false);

  const loadState = useCallback(() => {
    if (!id) return;
    setLoadedOnce(true);

    // A background refresh (the 15s poll, a window focus/visibility event,
    // or any other GALLERY_EVENT) must never replace an in-progress, unsaved
    // edit. Live-confirmed regression: remove an item, wait past the 15s
    // poll, and the next tick of this function was silently restoring the
    // old server state into `draft` — the removal vanished with no error,
    // and Save then pushed the untouched original count. Vault items are a
    // separate concern from the exhibition draft, so they still refresh.
    if (isDirtyRef.current) {
      setItems(loadItems({ includeAllProfiles: true }));
      return;
    }

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
    setItems(loadItems({ includeAllProfiles: true }));
  }, [id]);

  useEffect(() => {
    if (!id) return;

    // Loading only reads. A share token is created by an intentional save (or when sharing is enabled), never by opening the page.
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

    // Reading only. Opening, refreshing or failing to load an exhibition must never change what it holds: no item ids,
    // links or public snapshots are removed here, whatever the vault read returns (an item can be missing because it
    // belongs to another profile, the read failed or was partial, or it has not arrived yet). Items that cannot be shown
    // are listed as unavailable below; ids leave an exhibition only through the confirmed delete workflow
    // (vaultActions) or an explicit edit in this editor.
    async function hydrateVaultItems() {
      await syncVaultItemsFromSupabase();
      if (cancelled) return;
      setItems(loadItems({ includeAllProfiles: true }));
    }

    void hydrateVaultItems();

    function onVaultUpdate() {
      setItems(loadItems({ includeAllProfiles: true }));
    }

    window.addEventListener("vltd:vault-updated", onVaultUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("vltd:vault-updated", onVaultUpdate);
    };
  }, [id]);

  const [enablingShare, setEnablingShare] = useState(false);
  const shareUrl = useMemo(() => (draft ? getGalleryShareUrl(draft) : ""), [draft]);

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

  // Items the exhibition still lists but that cannot be shown right now (not loaded yet, a failed or partial read, or the owner
  // profile is not the active one). They stay in the exhibition: this only tells the person they are not on screen.
  const unavailableCount = draft ? Math.max(0, draft.itemIds.length - galleryItems.length) : 0;

  // Pictures that can be shared as pictures from the Share panel: the cover, then the photos of the exhibition's items, leaving
  // out any item hidden from viewers. Nothing is published by sharing a picture.
  const sharePhotos = useMemo(() => {
    const out: { url: string; label: string }[] = [];
    const seen = new Set<string>();
    const add = (url: string | undefined, label: string) => {
      if (!url || seen.has(url) || out.length >= 16) return;
      seen.add(url);
      out.push({ url, label });
    };
    add(draft?.coverImage || undefined, "Cover");
    for (const item of galleryItems) {
      if (isHiddenInExhibits(item.id) || isSupplyItem(item)) continue;
      add(getPrimaryImageUrl(item), item.title || "Item photo");
    }
    return out;
  }, [draft?.coverImage, galleryItems]);

  // The item picker only offers this exhibit's own profile (a personal vault and a business vault are separate).
  const ownProfileItems = useMemo(() => {
    const owner = draft?.profile_id;
    if (!owner) return items;
    return items.filter((item) => !item.profile_id || item.profile_id === owner);
  }, [draft?.profile_id, items]);

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

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  const selectedAccessMode = useMemo(() => getAccessMode(draft), [draft]);

  // Public details of older exhibits (year, description, category) are refreshed by the next intentional save, which rebuilds every
  // public snapshot from the items (saveDraft). Opening the page never saves: it used to patch the draft here, which triggered an autosave
  // of the whole exhibition (and of its link rows) just because someone looked at it.

  // Autosave: every change (items, exhibits, title, description, layout, background) saves
  // itself about a second after the last edit, so nothing depends on pressing Save Changes.
  const autosaveRef = useRef<() => void>(() => {});
  useEffect(() => {
    autosaveRef.current = () => { void saveDraft(undefined, undefined, true); };
  });
  useEffect(() => {
    if (!isDirty || !draft) return;
    const timer = window.setTimeout(() => autosaveRef.current(), 1000);
    return () => window.clearTimeout(timer);
  }, [isDirty, draft]);
  // A save that did not reach the cloud tries again by itself until it does.
  useEffect(() => {
    if (saveState !== "failed") return;
    const timer = window.setTimeout(() => autosaveRef.current(), 15000);
    return () => window.clearTimeout(timer);
  }, [saveState]);

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
    patchDraft((current) => {
      // An item taken out of the exhibition must also leave every exhibit it sat in, including when
      // it was the last one (an empty list used to stop the exhibits being trimmed).
      const keep = new Set(ids);
      const currentSections = Array.isArray(current.sections) ? current.sections : [];
      if (currentSections.length === 0) return { ...current, itemIds: [...ids] };
      const trimmed = currentSections.map((section) => ({
        ...section,
        itemIds: section.itemIds.filter((id) => keep.has(id)),
        slotLayout: section.slotLayout?.map((id) => (id && keep.has(id) ? id : null)),
      }));
      return {
        ...current,
        itemIds: [...ids],
        sections: trimmed,
        exhibitionLayout: {
          ...((current.exhibitionLayout as object) ?? {}),
          sections: trimmed,
        } as Gallery["exhibitionLayout"],
      };
    });
  }

  function updateAccessMode(mode: GalleryAccessPillMode, confirmed = false) {
    // Going public shows the exhibit to everyone, and autosave would do it within a second: ask first.
    if (mode === "public_gallery" && selectedAccessMode !== "public_gallery" && !confirmed) {
      setConfirmPublic(true);
      return;
    }
    setConfirmPublic(false);
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
      setStatus("Cover artwork uploaded.");
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

  async function saveDraft(overrideIds?: string[], overrideSections?: Gallery["sections"], auto = false): Promise<boolean> {
    const baseDraft = latestDraftRef.current ?? draft;
    if (!baseDraft) return false;
    setSaveState("saving");
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
        // Supplies (boxes, cases) are never part of the public record.
        if (localItem) return isSupplyItem(localItem) ? undefined : buildPublicSnapshot(localItem, snapshotFallbackById.get(itemId));
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

    // Detect first-time or re-publish: was not PUBLIC, is now PUBLIC.
    const wasPublic = gallery?.visibility === "PUBLIC";
    const isNowPublic = nextDraft.visibility === "PUBLIC";
    const justPublished = !wasPublic && isNowPublic;

    try {
      // Sync gallery to Supabase FIRST so slotLayout/sections land in cloud immediately.
      // Vault item syncs are secondary — they run concurrently but don't block gallery save.
      let vaultSyncError: unknown = null;

      const [galleryResult] = await Promise.allSettled([
        syncGalleryToSupabaseNow(nextDraft),
        (async () => {
          // Autosave only saves the exhibit itself; the heavier item sync runs on explicit saves.
          if (auto) return;
          try {
            for (const itemId of nextDraft.itemIds) {
              enqueueVaultItemSync(itemId);
            }
            await processVaultSyncQueue();
            await syncVaultItemsFromSupabase();
            setItems(loadItems({ includeAllProfiles: true }));
          } catch (error) {
            vaultSyncError = error;
            console.error("Vault sync failed during gallery save:", error);
          }
        })(),
      ]);

      if (galleryResult.status === "rejected") {
        throw galleryResult.reason;
      }

      setSaveState("saved");
      if (!auto || justPublished || vaultSyncError) {
        setStatusTone(vaultSyncError ? "neutral" : "good");
        setStatus(
          vaultSyncError
            ? "Exhibition saved. Some vault sync tasks still need retrying."
            : justPublished
              ? "Exhibition published!"
              : "Exhibition saved."
        );
      }

      // Record the publish event after a successful save. The exhibition itself is public either way; if the account refuses the
      // follower notice the page says so instead of claiming followers were told.
      if (justPublished) {
        const profileId =
          typeof window !== "undefined"
            ? String(window.localStorage.getItem("vltd_active_profile_id_v1") ?? "").trim()
            : "";
        if (profileId) {
          const noticeRecorded = await logExhibitionPublished(nextDraft.id, profileId, nextDraft.title);
          if (!noticeRecorded) {
            const msg = "Published, but followers were not notified: the account did not accept the notice.";
            setNoticeProblem(msg);
            setStatusTone("neutral");
            setStatus("Exhibition published, but followers were not notified: the account did not accept the notice.");
          }
        }
      }
      return true;
    } catch (error) {
      console.error("Direct gallery sync failed:", error);
      setSaveState("failed");
      return false;
    }
  }

  async function handleAnnounce() {
    if (!gallery || announcing) return;
    const profileId =
      typeof window !== "undefined"
        ? String(window.localStorage.getItem("vltd_active_profile_id_v1") ?? "").trim()
        : "";
    if (!profileId) return;
    setAnnouncing(true);
    setNoticeProblem("");
    try {
      const recorded = await logExhibitionAnnouncement(gallery.id, profileId, gallery.title, gallery.itemIds.length);
      if (recorded) {
        setAnnounced(true);
        setTimeout(() => setAnnounced(false), 3000);
      } else {
        // The account refused (or could not be reached): say so, never "Announced".
        setNoticeProblem("Not announced: your followers were not told, because the account did not accept the announcement. Nothing was sent.");
        setStatusTone("neutral");
        setStatus("Not announced: your followers were not told, because the account did not accept the announcement. Nothing was sent. Try again later.");
      }
    } finally {
      setAnnouncing(false);
    }
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

  // Invite and public-link changes are saved straight to storage. Bring only the sharing info back
  // into the open draft, so nothing typed in the last second is thrown away.
  function adoptRefreshedShare(galleryId: string) {
    const refreshed = loadGalleries({ includeAllProfiles: true }).find((x) => x.id === galleryId) ?? null;
    if (!refreshed) return;
    const base = latestGalleryRef.current ?? refreshed;
    setGallery(cloneGallery({ ...base, share: refreshed.share }));
    setOriginalSnapshot(normalizeDraftForCompare({ ...base, share: refreshed.share }));
    setDraft((current) => (current ? cloneGallery({ ...current, share: refreshed.share }) : cloneGallery(refreshed)));
  }

  function handleCreateInviteToken() {
    if (!draft) return;

    const token = createGalleryInviteToken(draft.id, inviteLabel.trim() || undefined);
    setInviteLabel("");
    if (token) {
      adoptRefreshedShare(draft.id);
    }
  }

  function handleDisableInviteToken(token: string) {
    if (!draft) return;
    disableGalleryInviteToken(draft.id, token);
    adoptRefreshedShare(draft.id);
  }

  function handleUpdateTokenPermissions(token: string, permissions: GalleryInvitePermissions) {
    if (!draft) return;
    updateGalleryInviteToken(draft.id, token, { permissions });
    adoptRefreshedShare(draft.id);
  }

  function handleUpdateTokenExpiry(token: string, expiresAt: number | null) {
    if (!draft) return;
    updateGalleryInviteToken(draft.id, token, { expiresAt });
    adoptRefreshedShare(draft.id);
    setOpenExpiryToken(null);
  }

  // "Turn on public sharing?" -> Yes: anyone with the link may view it (Guest View, not listed on Home). Resolves only once the
  // exhibition is saved; on a failure the exhibition goes back to what it was and the Share panel shows why.
  async function enablePublicSharing() {
    const base = latestDraftRef.current ?? draft;
    if (!base) throw new Error("The exhibition is not loaded yet.");
    const before = cloneGallery(base);
    const next = applyAccessMode(cloneGallery(base), "guest_view");
    latestDraftRef.current = next;
    setDraft(cloneGallery(next));
    // Until the save has gone through, the Share panel keeps asking: no link and no destinations are offered early.
    setEnablingShare(true);
    try {
      // Only the exhibition itself is saved here (the same light save the autosave uses), not a full item sync.
      const ok = await saveDraft(undefined, undefined, true);
      if (!ok) {
        latestDraftRef.current = before;
        setDraft(before);
        throw new Error("The exhibition could not be saved just now.");
      }
    } finally {
      setEnablingShare(false);
    }
  }

  function handleRegeneratePublicLink() {
    if (!draft) return;
    regenerateGalleryPublicToken(draft.id);
    adoptRefreshedShare(draft.id);
  }

  if (!draft || !metrics) {
    if (!loadedOnce) {
      return (
        <main className="text-[color:var(--fg)]">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-[color:var(--muted)]">Loading exhibition…</div>
        </main>
      );
    }
    return (
      <main className="text-[color:var(--fg)]">
        <div className="mx-auto flex max-w-3xl items-center justify-center px-4">
          <div className="rounded-[28px] vltd-panel-main bg-[color:var(--surface)] p-8 text-center ring-1 ring-[color:var(--border)] shadow-[var(--shadow-soft)]">
            <div className="text-[11px] tracking-[0.22em] text-[color:var(--muted2)]">
              MUSEUM
            </div>
            <h1 className="mt-3 text-2xl font-semibold">Exhibition not found</h1>
            <p className="mt-3 text-sm text-[color:var(--muted)]">
              This exhibition could not be found. It may have been deleted, or it belongs to another profile.
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
    <main className="overflow-x-hidden text-[color:var(--fg)]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 xl:py-5">
        <div className="mx-auto mb-4 flex max-w-[780px] flex-wrap items-center gap-3">
          <Link href="/museum" className={neutralPillClass()}>
            Back to Exhibitions
          </Link>
          <span
            className="ml-auto text-[11px]"
            style={{ color: saveState === "failed" ? "#fca5a5" : "var(--muted2)" }}
            aria-live="polite"
          >
            {saveState === "saving"
              ? "Saving…"
              : saveState === "failed"
                ? "Not saved to the cloud yet, retrying…"
                : saveState === "saved"
                  ? "Saved"
                  : ""}
          </span>
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
              <div className="absolute inset-0 bg-black/68" />
            </>
          ) : null}

          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.10),rgba(255,255,255,0)_28%),radial-gradient(circle_at_80%_0%,rgba(255,225,170,0.10),rgba(255,225,170,0)_24%)]" />

          <div className="relative md:mx-auto md:w-[690px] md:max-w-full">
                  <div className="mb-2 flex flex-wrap justify-end gap-1 sm:absolute sm:right-0 sm:top-0 sm:z-10 sm:mb-0 sm:flex-col sm:items-end">
                    <span className="rounded-full bg-[color:var(--theme-elevated)] px-2 py-[1px] text-[9px] tracking-[0.1em] text-[color:var(--muted2)] ring-1 ring-[color:var(--theme-border)]">
                      {visibilityLabel(draft.visibility)}
                    </span>

                    <span className="rounded-full bg-[color:var(--theme-elevated)] px-2 py-[1px] text-[9px] tracking-[0.1em] text-[color:var(--muted2)] ring-1 ring-[color:var(--theme-border)]">
                      {metrics.totalItems} ITEMS
                    </span>

                    {unavailableCount > 0 ? (
                      <span
                        className="rounded-full bg-[color:var(--theme-elevated)] px-2 py-[1px] text-[9px] tracking-[0.1em] text-[color:var(--muted2)] ring-1 ring-[color:var(--theme-border)]"
                        title="These items are still in this exhibition but could not be loaded right now. Nothing was removed."
                        data-testid="unavailable-items"
                      >
                        {unavailableCount} NOT LOADED
                      </span>
                    ) : null}

                    <span className="rounded-full bg-[color:var(--theme-elevated)] px-2 py-[1px] text-[9px] tracking-[0.1em] text-[color:var(--muted2)] ring-1 ring-[color:var(--theme-border)]">
                      {metrics.views} VIEWS
                    </span>
                  </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between xl:justify-start xl:gap-5">
              <div className="flex w-full flex-col items-center gap-2.5 sm:flex-row sm:items-start">
                {/* Cover image portrait card */}
                <div className="shrink-0">
                  {draft.coverImage ? (
                    <div
                      className="w-[132px] overflow-hidden rounded-[14px] shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
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

                {/* Light text is only right when a cover image puts a dark scrim behind it; on the plain
                    card it is the theme's own text colour (the dark-surface class made it near-invisible
                    on light themes). */}
                <div className={(draft.coverImage ? "vltd-dark-surface " : "") + "w-full min-w-0 flex-1 sm:w-auto"}>
                  <div className="text-center text-[11px] tracking-[0.28em] text-white/55 xl:text-[10px]">
                    CURATED EXHIBIT
                  </div>

                  {headerEditing ? (
                    <>
                      <input
                        value={draft.title ?? ""}
                        onChange={(event) =>
                          patchDraft((current) => ({ ...current, title: event.target.value.slice(0, 80) }))
                        }
                        placeholder="Exhibit title"
                        aria-label="Exhibit title"
                        className={INLINE_EDIT_LINE + " mx-auto mt-2 block w-full max-w-[320px] text-center text-2xl font-semibold max-md:min-h-11 xl:mt-1"}
                      />
                      <textarea
                        value={draft.description ?? ""}
                        onChange={(event) =>
                          patchDraft((current) => ({ ...current, description: event.target.value }))
                        }
                        rows={1}
                        placeholder="Curated collection presentation"
                        aria-label="Exhibit description"
                        className={INLINE_EDIT_LINE + " mx-auto mt-1 block w-full max-w-[320px] resize-none text-center text-sm leading-5 text-white/80 max-md:min-h-11 xl:text-xs xl:leading-4"}
                      />
                    </>
                  ) : (
                    <>
                      <h1 className="mt-2 break-words text-center text-2xl font-semibold [overflow-wrap:anywhere] xl:mt-1 xl:text-2xl">
                        {draft.title}
                      </h1>

                      <p className="mx-auto mt-1 max-w-2xl break-words text-center text-sm leading-5 text-white/80 [overflow-wrap:anywhere] xl:text-xs xl:leading-4">
                        {draft.description?.trim()
                          ? draft.description
                          : "Curated collection presentation"}
                      </p>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setHeaderEditing((value) => !value)}
                    aria-label={headerEditing ? "Done editing title and description" : "Edit title and description"}
                    title={headerEditing ? "Done" : "Edit title and description"}
                    className="relative mx-auto mt-1 flex h-7 w-7 max-md:mt-3 items-center justify-center rounded-[8px] text-white/80 ring-1 ring-white/30 transition hover:text-white max-md:after:absolute max-md:after:-inset-2 max-md:after:content-['']"
                  >
                    <AppIcon name={headerEditing ? "checkmark" : "edit"} size={12} strokeWidth={1.8} />
                  </button>

                </div>
              </div>

            </div>

            <div className="mt-4 md:max-w-[690px] xl:mt-2">
              <div className="rounded-[22px] bg-[color:var(--surface)] p-4 ring-1 ring-[color:var(--border)] xl:rounded-[18px] xl:p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] tracking-[0.18em] text-[color:var(--muted2)]">
                      PUBLIC SHARE LINK
                    </div>
                    <div className="mt-0.5 text-xs text-[color:var(--muted)]">
                      Uses a dedicated public route for clean sharing.
                    </div>
                  </div>
              <div className="flex flex-wrap gap-1.5 sm:justify-end">
                <div className="rounded-2xl bg-[color:var(--surface)] px-3.5 py-2.5 ring-1 ring-[color:var(--border)] xl:rounded-xl xl:px-2.5 xl:py-2">
                  <div className="text-[9px] tracking-[0.18em] text-[color:var(--muted2)]">VALUE</div>
                  <div className="mt-0.5 text-lg font-semibold leading-tight xl:text-base">{formatMoney(metrics.totalValue)}</div>
                </div>

                <div className="rounded-2xl bg-[color:var(--surface)] px-3.5 py-2.5 ring-1 ring-[color:var(--border)] xl:rounded-xl xl:px-2.5 xl:py-2">
                  <div className="text-[9px] tracking-[0.18em] text-[color:var(--muted2)]">ROI</div>
                  <div className="mt-0.5 text-lg font-semibold leading-tight xl:text-base">
                    {metrics.gainItemCount > 0 ? `${metrics.roi >= 0 ? "+" : ""}${metrics.roi.toFixed(1)}%` : "—"}
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

                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 max-md:gap-y-4 xl:mt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <ContentActionBar
                    kind="exhibition"
                    contentId={draft.id}
                    title={draft?.title ?? gallery?.title ?? "My Exhibition"}
                    previewUrl={draft.coverImage || undefined}
                    shareUrl={shareUrl}
                    canShare={Boolean(shareUrl) && selectedAccessMode !== "private" && !enablingShare}
                    shareRestriction="This exhibition has no public link yet, so there is nothing to share."
                    onEnablePublic={shareUrl ? enablePublicSharing : undefined}
                    sharePhotos={sharePhotos}
                    isOwner
                    viewerProfileId=""
                  />
                  <button
                    type="button"
                    onClick={() => setConfirmRegenerate(true)}
                    className={compactPill("default")}
                  >
                    Regenerate link
                  </button>
                </div>
                </div>

                {confirmRegenerate ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--muted)] max-md:mt-3 max-md:gap-y-3">
                    <span>Regenerating stops the old link from working. Continue?</span>
                    <button
                      type="button"
                      onClick={() => { setConfirmRegenerate(false); handleRegeneratePublicLink(); }}
                      className={compactPill("active")}
                    >
                      Regenerate
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRegenerate(false)}
                      className={compactPill("default")}
                    >
                      Cancel
                    </button>
                  </div>
                ) : null}


                <div className="relative mt-4 xl:mt-2">
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] tracking-[0.18em] text-[color:var(--muted2)]">
                      USER ACCESS MODE
                    </div>
                    <button
                      type="button"
                      onClick={() => setAccessInfoOpen((current) => !current)}
                      className={compactPill("default", "w-8 px-0! md:w-7")}
                      aria-label="Access mode help"
                      aria-expanded={accessInfoOpen}
                    >
                      i
                    </button>
                  </div>

                  {accessInfoOpen ? (
                    <div id="gallery-access-mode-help" className="vltd-dark-surface absolute left-0 bottom-full z-20 mb-3 w-full max-w-[520px] rounded-2xl p-4 text-sm leading-6 text-[color:var(--fg)] ring-1 ring-[color:var(--border)] shadow-[0_24px_60px_rgba(0,0,0,0.42)]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="text-[11px] tracking-[0.18em] text-[color:var(--muted2)]">ACCESS MODE HELP</div>
                        <button
                          type="button"
                          onClick={() => setAccessInfoOpen(false)}
                          className={compactPill("default", "w-8 px-0! md:w-7")}
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

                  <div className="mt-2 flex flex-wrap items-center gap-1.5 max-md:mt-3 max-md:gap-y-3 xl:gap-1">
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
                  {confirmPublic ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--muted)] max-md:mt-3 max-md:gap-y-3">
                      <span>Make this exhibit public now? Anyone will be able to find it.</span>
                      <button
                        type="button"
                        onClick={() => updateAccessMode("public_gallery", true)}
                        className={compactPill("active")}
                      >
                        Make public
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmPublic(false)}
                        className={compactPill("default")}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-1.5 max-md:mt-4 max-md:gap-y-3">
                    <div className="relative inline-flex min-h-[30px] w-fit items-center gap-1.5 rounded-full bg-[color:var(--surface)] px-2.5 py-1 text-[10px] ring-1 ring-[color:var(--border)]">
                      <span className="font-semibold">18+ exhibit</span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setAdultInfoOpen((current) => !current);
                        }}
                        className={compactPill("default", "w-8 px-0! md:w-7")}
                        aria-label="18+ exhibit help"
                        aria-expanded={adultInfoOpen}
                      >
                        i
                      </button>
                      <label className={CHECKBOX_LABEL}>
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
                          className="h-3.5 w-3.5 accent-cyan-400"
                        />
                      </label>
                      {adultInfoOpen ? (
                        <span id="gallery-adult-info" className="vltd-dark-surface absolute left-0 bottom-full z-20 mb-2 w-[min(360px,calc(100vw-48px))] rounded-xl px-3 py-2 text-[11px] leading-4 text-[color:var(--muted)] ring-1 ring-[color:var(--border)] shadow-[0_18px_44px_rgba(0,0,0,0.38)]">
                          Public viewers must confirm they are 18 or older before entering this exhibit.
                        </span>
                      ) : null}
                    </div>

                    <div className="relative inline-flex min-h-[30px] w-fit items-center gap-1.5 rounded-full bg-[color:var(--surface)] px-2.5 py-1 text-[10px] ring-1 ring-[color:var(--border)]">
                      <span className="font-semibold">Use an alias</span>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setAliasInfoOpen((current) => !current);
                        }}
                        className={compactPill("default", "w-8 px-0! md:w-7")}
                        aria-label="Alias help"
                        aria-expanded={aliasInfoOpen}
                      >
                        i
                      </button>
                      <label className={CHECKBOX_LABEL}>
                        <input
                          type="checkbox"
                          aria-label="Show a made-up curator identity instead of your real name"
                          checked={draft.aliasEnabled === true}
                          onChange={(event) =>
                            patchDraft((current) => ({
                              ...current,
                              aliasEnabled: event.target.checked,
                            }))
                          }
                          className="h-3.5 w-3.5 accent-cyan-400"
                        />
                      </label>
                      {aliasInfoOpen ? (
                        <span id="gallery-alias-info" className="vltd-dark-surface absolute left-0 bottom-full z-20 mb-2 w-[min(360px,calc(100vw-48px))] rounded-xl px-3 py-2 text-[11px] leading-4 text-[color:var(--muted)] ring-1 ring-[color:var(--border)] shadow-[0_18px_44px_rgba(0,0,0,0.38)]">
                          Hides your real name on THIS exhibition's public page. Visitors see the name you choose instead. You still manage this exhibition as yourself.
                        </span>
                      ) : null}
                    </div>

                    {draft.aliasEnabled ? (
                      <input
                        value={draft.aliasName ?? ""}
                        onChange={(event) =>
                          patchDraft((current) => ({
                            ...current,
                            aliasName: event.target.value.slice(0, 60),
                          }))
                        }
                        placeholder="Alias name"
                        aria-label="Alias name"
                        className="h-[30px] w-[140px] min-w-0 rounded-full max-md:h-11 bg-[color:var(--pill)] px-3 text-[11px] ring-1 ring-[color:var(--border)] focus:outline-none"
                      />
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void handleAnnounce()}
                      disabled={announcing || announced}
                      title="Let your followers know you&#39;ve updated this exhibition"
                      className={compactPill("default", "md:ml-auto")}
                    >
                      {announced ? "✓ Announced" : announcing ? "Announcing…" : (
                        <span className="inline-flex items-center gap-1"><Glyph name="megaphone" size={12} /> Announce</span>
                      )}
                    </button>
                  </div>
                  {noticeProblem ? (
                    <div role="alert" data-testid="follower-notice-problem" className="mt-2 text-[12px] leading-snug text-amber-300">{noticeProblem}</div>
                  ) : null}
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
              ITEMS
            </div>
            <h2 className="mt-2 text-2xl font-semibold">In this exhibition</h2>

            {galleryItems.length > 0 ? (
              <div className="mt-4">
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
                  className="min-h-[36px] w-full rounded-xl bg-[color:var(--surface)] px-3 py-1.5 text-xs max-md:min-h-11 ring-1 ring-[color:var(--border)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCreateInviteToken}
                  className={pillClassName("active", false, "shrink-0")}
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
                            className={compactPill("default", "shrink-0")}
                          >
                            Disable
                          </button>
                        </div>

                        {/* URL input — selectable */}
                        <input
                          value={inviteUrl}
                          readOnly
                          onFocus={(e) => e.target.select()}
                          className="mt-2 min-h-[34px] max-md:min-h-11 w-full rounded-xl bg-[color:var(--surface)] px-3 py-1.5 text-[11px] ring-1 ring-[color:var(--border)] focus:outline-none cursor-text select-all"
                        />

                        {/* Action pills row */}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 max-md:mt-3 max-md:gap-y-3">
                          <button
                            type="button"
                            onClick={() => copyInviteLink(entry.token)}
                            className={compactPill("active")}
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
                              className={compactPill(isExpiryOpen ? "active" : "default")}
                            >
                              <Glyph name="clock" size={10} strokeWidth={2} />
                              Expires: {expiryLabel}
                            </button>

                            {isExpiryOpen && (
                              <div id="gallery-expiry-dropdown" className="vltd-dark-surface absolute left-0 top-full z-20 mt-1.5 w-40 rounded-[14px] p-2 ring-1 ring-[color:var(--border)] shadow-[0_12px_36px_rgba(0,0,0,0.42)]">
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
                                    className="flex min-h-11 w-full items-center rounded-xl px-2.5 py-1.5 text-left text-[12px] transition hover:bg-[color:var(--input)] md:min-h-8"
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
                              className={compactPill(isPermsOpen ? "active" : "default")}
                            >
                              <Glyph name="lock" size={10} strokeWidth={1.8} />
                              Permissions
                            </button>

                            {isPermsOpen && (
                              <div id="gallery-permissions-dropdown" className="vltd-dark-surface absolute left-0 top-full z-20 mt-1.5 w-52 rounded-[14px] p-3 ring-1 ring-[color:var(--border)] shadow-[0_12px_36px_rgba(0,0,0,0.42)]">
                                <div className="mb-2 text-[9px] font-bold tracking-[0.18em] text-[color:var(--muted2)]">VIEWER PERMISSIONS</div>
                                {(
                                  [
                                    { key: "images" as const, label: "Images", desc: "Enlarge exhibition images" },
                                    { key: "descriptionPage" as const, label: "Description Page", desc: "Full item info, no prices" },
                                    { key: "financialHistory" as const, label: "Financial History", desc: "Reveal purchase & value data" },
                                  ] as const
                                ).map(({ key, label, desc }) => (
                                  <label
                                    key={key}
                                    className="flex cursor-pointer items-start gap-2.5 rounded-xl px-2 py-1.5 max-md:min-h-11 max-md:items-center transition hover:bg-[color:var(--input)]"
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
          allItems={ownProfileItems}
          confirmedIds={pickerSectionIds !== null ? pickerSectionIds : draft.itemIds}
          sectionTitle={pickerSectionTitle}
          pages={
            pickerSectionIds !== null && pickerSectionIdx !== null && (draft.sections ?? []).length > 0
              ? (draft.sections ?? []).map((section) => ({ id: section.id, title: section.title, itemIds: section.itemIds }))
              : undefined
          }
          activePageIdx={pickerSectionIdx ?? 0}
          onConfirmPages={(pickedPages) => {
            const baseDraft = latestDraftRef.current ?? draft;
            if (!baseDraft) {
              setPickerOpen(false);
              return;
            }
            const currentSections = Array.isArray(baseDraft.sections) ? baseDraft.sections : [];
            const nextSections = pickedPages.map((page) => {
              const existing = currentSections.find((section) => section.id === page.id);
              return existing
                ? { ...existing, itemIds: page.itemIds }
                : {
                    id: `sec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
                    title: page.title,
                    description: "",
                    itemIds: page.itemIds,
                  };
            });
            // Items that sat in no exhibit page stay in the exhibition as they were.
            const placedBefore = new Set(currentSections.flatMap((section) => section.itemIds));
            const looseIds = baseDraft.itemIds.filter((id) => !placedBefore.has(id));
            const nextGalleryIds = Array.from(new Set([...nextSections.flatMap((section) => section.itemIds), ...looseIds]));
            patchDraft((current) => ({
              ...current,
              itemIds: nextGalleryIds,
              sections: nextSections,
              exhibitionLayout: {
                ...(current.exhibitionLayout as object ?? {}),
                sections: nextSections,
              } as Gallery["exhibitionLayout"],
            }));
            void saveDraft(nextGalleryIds, nextSections);
            setPickerOpen(false);
          }}
          onConfirm={(ids, pickedName) => {
            if (pickerSectionIds !== null && pickerSectionIdx !== null) {
              // Section-specific update: add/remove items for this section only.
              // Compute the next ids/sections from the freshest known draft BEFORE
              // calling patchDraft (which only schedules an async setState) so we
              // can pass them straight into saveDraft as overrides. saveDraft()
              // with no arguments would otherwise read latestDraftRef/draft before
              // the patch has actually landed, silently saving the OLD item list -
              // this is what was causing picked items to not persist.
              const baseDraft = latestDraftRef.current ?? draft;
              if (!baseDraft) {
                setPickerOpen(false);
                return;
              }
              const oldSet = new Set(pickerSectionIds);
              const removedFromSection = pickerSectionIds.filter((id) => !ids.includes(id));
              const addedToSection = ids.filter((id) => !oldSet.has(id));
              const removedSet = new Set(removedFromSection);
              // Sync gallery.itemIds: remove deselected, add newly picked
              let nextGalleryIds = baseDraft.itemIds.filter((id) => !removedSet.has(id));
              const gallerySet = new Set(nextGalleryIds);
              nextGalleryIds = [...nextGalleryIds, ...addedToSection.filter((id) => !gallerySet.has(id))];
              // Update the section's itemIds
              const currentSections = Array.isArray(baseDraft.sections) ? baseDraft.sections : [];
              const nextSections = currentSections.map((s, i) =>
                i === pickerSectionIdx ? { ...s, itemIds: ids, title: pickedName?.trim() ? pickedName.trim() : s.title } : s
              );

              patchDraft((current) => ({
                ...current,
                itemIds: nextGalleryIds,
                sections: nextSections,
                exhibitionLayout: {
                  ...(current.exhibitionLayout as object ?? {}),
                  sections: nextSections,
                } as Gallery["exhibitionLayout"],
              }));
              void saveDraft(nextGalleryIds, nextSections);
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

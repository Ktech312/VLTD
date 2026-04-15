"use client";

import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { GalleryLayout, getDefaultGalleryLayout } from "./galleryLayout";
import { type GalleryState, type GalleryVisibility } from "./galleryTier";

export type GalleryItemNote = {
  itemId: string;
  note: string;
  updatedAt: number;
};

export type GalleryInviteToken = {
  token: string;
  label?: string;
  createdAt: number;
  lastUsedAt?: number;
  expiresAt?: number;
  disabled?: boolean;
};

export type GalleryShareSettings = {
  publicToken?: string;
  inviteTokens: GalleryInviteToken[];
};

export type GalleryAnalytics = {
  views: number;
  uniqueViewKeys: string[];
  lastViewedAt?: number;
};

export type GallerySection = {
  id: string;
  title: string;
  description?: string;
  itemIds: string[];
  featuredItemId?: string;
};

export type ExhibitionLayoutType =
  | "GRID"
  | "CURATED"
  | "TIMELINE"
  | "MASTERPIECE"
  | "ARTIST_STUDY"
  | "TOP_10"
  | "INVESTMENT";

export type ExhibitionLayout = GalleryLayout & {
  type?: ExhibitionLayoutType;
  sections?: GallerySection[];
};

export type GalleryThemePack = "classic" | "walnut" | "midnight" | "marble";
export type GalleryDisplayMode = "grid" | "shelf";
export type GalleryGuestViewMode = "public" | "guest";

export type GalleryTemplateId =
  | "CUSTOM"
  | "MASTERPIECE"
  | "TIMELINE"
  | "ARTIST_STUDY"
  | "TOP_10"
  | "INVESTMENT";

export type Gallery = {
  id: string;
  profile_id?: string;

  title: string;
  description?: string;

  itemIds: string[];

  visibility: GalleryVisibility;
  state: GalleryState;

  layout: GalleryLayout;
  exhibitionLayout?: ExhibitionLayout;

  coverImage?: string;

  itemNotes?: GalleryItemNote[];
  share?: GalleryShareSettings;
  analytics?: GalleryAnalytics;

  templateId?: GalleryTemplateId;
  sections?: GallerySection[];

  themePack?: GalleryThemePack;
  displayMode?: GalleryDisplayMode;
  guestViewMode?: GalleryGuestViewMode;
  shelfBackground?: string;

  createdAt: number;
  updatedAt: number;
};

export type GalleryInviteLookupResult = {
  gallery: Gallery;
  inviteToken: GalleryInviteToken;
};

type LoadGalleryOptions = {
  profileId?: string;
  includeAllProfiles?: boolean;
};

const KEY = "vltd_galleries";
const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

export const GALLERY_EVENT = "vltd:galleries";

let supabaseHydrationStarted = false;

function emitGalleryChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GALLERY_EVENT));
}

function makeGalleryId() {
  const now = Date.now();

  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `gallery_${now}`;
}

function makeToken(prefix = "shr") {
  const rand = Math.random().toString(36).slice(2, 10);
  const now = Date.now().toString(36);
  return `${prefix}_${now}_${rand}`;
}

function makeSectionId() {
  return makeToken("sec");
}

function getActiveProfileId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "";
}

function safeString(value: unknown) {
  return String(value ?? "").trim();
}

function isUuidLike(value: unknown) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    safeString(value)
  );
}

function normalizeTitle(value: unknown) {
  return safeString(value);
}

function normalizeDescription(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeCoverImage(value: unknown) {
  if (typeof value !== "string") return "";
  const next = value.trim();
  return next || "";
}

function normalizeLargeLocalString(value: unknown) {
  if (typeof value !== "string") return "";
  const next = value.trim();
  if (!next) return "";
  if (next.startsWith("data:")) return "";
  return next;
}

function slimGalleryForLocalCache(gallery: Gallery): Gallery {
  return {
    ...gallery,
    coverImage: normalizeLargeLocalString(gallery.coverImage),
    shelfBackground: normalizeLargeLocalString(gallery.shelfBackground),
  };
}

function normalizeGalleryState(value: unknown): GalleryState {
  return value === "STORAGE" ? "STORAGE" : "ACTIVE";
}

function normalizeGalleryVisibility(value: unknown): GalleryVisibility {
  return value === "LOCKED" || value === "INVITE" ? value : "PUBLIC";
}

function normalizeGalleryLayout(value: unknown): GalleryLayout {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return getDefaultGalleryLayout();
  }
  return value as unknown as GalleryLayout;
}

function asPlainObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function normalizeExhibitionLayoutType(value: unknown): ExhibitionLayoutType {
  if (
    value === "CURATED" ||
    value === "TIMELINE" ||
    value === "MASTERPIECE" ||
    value === "ARTIST_STUDY" ||
    value === "TOP_10" ||
    value === "INVESTMENT"
  ) {
    return value;
  }

  return "GRID";
}

function normalizeTemplateId(value: unknown): GalleryTemplateId {
  if (
    value === "MASTERPIECE" ||
    value === "TIMELINE" ||
    value === "ARTIST_STUDY" ||
    value === "TOP_10" ||
    value === "INVESTMENT"
  ) {
    return value;
  }

  return "CUSTOM";
}

function normalizeThemePack(value: unknown): GalleryThemePack {
  if (value === "walnut" || value === "midnight" || value === "marble") {
    return value;
  }
  return "classic";
}

function normalizeDisplayMode(value: unknown): GalleryDisplayMode {
  return value === "shelf" ? "shelf" : "grid";
}

function normalizeGuestViewMode(value: unknown): GalleryGuestViewMode {
  return value === "guest" ? "guest" : "public";
}

function normalizeTimestamp(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeProfileId(value: unknown) {
  const next = safeString(value);
  return next || undefined;
}

function normalizeItemIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const rawId of value) {
    const id = safeString(rawId);
    if (!id) continue;
    if (seen.has(id)) continue;

    seen.add(id);
    out.push(id);
  }

  return out;
}

function normalizeItemNotes(value: unknown): GalleryItemNote[] {
  if (!Array.isArray(value)) return [];

  const out: GalleryItemNote[] = [];
  const seen = new Set<string>();

  for (const raw of value) {
    const itemId = safeString((raw as any)?.itemId);
    if (!itemId) continue;
    if (seen.has(itemId)) continue;

    const note = typeof (raw as any)?.note === "string" ? (raw as any).note : "";
    const updatedAt = normalizeTimestamp((raw as any)?.updatedAt, Date.now());

    seen.add(itemId);
    out.push({
      itemId,
      note,
      updatedAt,
    });
  }

  return out;
}

function normalizeInviteTokens(value: unknown): GalleryInviteToken[] {
  if (!Array.isArray(value)) return [];

  const out: GalleryInviteToken[] = [];
  const seen = new Set<string>();

  for (const raw of value) {
    const token = safeString((raw as any)?.token);
    if (!token) continue;
    if (seen.has(token)) continue;

    seen.add(token);

    out.push({
      token,
      label: typeof (raw as any)?.label === "string" ? (raw as any).label : undefined,
      createdAt: normalizeTimestamp((raw as any)?.createdAt, Date.now()),
      lastUsedAt:
        typeof (raw as any)?.lastUsedAt === "number" && Number.isFinite((raw as any).lastUsedAt)
          ? (raw as any).lastUsedAt
          : undefined,
      expiresAt:
        typeof (raw as any)?.expiresAt === "number" && Number.isFinite((raw as any).expiresAt)
          ? (raw as any).expiresAt
          : undefined,
      disabled: !!(raw as any)?.disabled,
    });
  }

  return out;
}

function normalizeShare(value: unknown): GalleryShareSettings {
  const publicToken =
    typeof (value as any)?.publicToken === "string" && safeString((value as any)?.publicToken)
      ? safeString((value as any)?.publicToken)
      : undefined;

  const inviteTokens = normalizeInviteTokens((value as any)?.inviteTokens);

  return {
    publicToken,
    inviteTokens,
  };
}

function normalizeAnalytics(value: unknown): GalleryAnalytics {
  const uniqueViewKeys = Array.isArray((value as any)?.uniqueViewKeys)
    ? (value as any).uniqueViewKeys
        .map((v: unknown) => safeString(v))
        .filter(Boolean)
        .slice(-500)
    : [];

  const views =
    typeof (value as any)?.views === "number" && Number.isFinite((value as any).views)
      ? Math.max(0, Math.floor((value as any).views))
      : 0;

  const lastViewedAt =
    typeof (value as any)?.lastViewedAt === "number" &&
    Number.isFinite((value as any).lastViewedAt)
      ? (value as any).lastViewedAt
      : undefined;

  return {
    views,
    uniqueViewKeys,
    lastViewedAt,
  };
}

function normalizeSections(value: unknown, galleryItemIds?: string[]): GallerySection[] {
  if (!Array.isArray(value)) return [];

  const out: GallerySection[] = [];
  const seen = new Set<string>();
  const allowedItemIds = new Set(galleryItemIds ?? []);

  for (const raw of value) {
    const id = safeString((raw as any)?.id) || makeSectionId();
    if (seen.has(id)) continue;

    const title = safeString((raw as any)?.title) || "Untitled Section";
    const description =
      typeof (raw as any)?.description === "string" ? (raw as any).description : "";
    const itemIds = normalizeItemIds((raw as any)?.itemIds).filter((itemId) =>
      allowedItemIds.size > 0 ? allowedItemIds.has(itemId) : true
    );
    const featuredItemId = safeString((raw as any)?.featuredItemId) || undefined;

    seen.add(id);
    out.push({
      id,
      title,
      description,
      itemIds,
      featuredItemId:
        featuredItemId && itemIds.includes(featuredItemId) ? featuredItemId : itemIds[0],
    });
  }

  return out;
}

function normalizeSectionsFromGalleryRaw(raw: any, itemIds: string[]) {
  const directSections = normalizeSections(raw?.sections, itemIds);
  if (directSections.length > 0) return directSections;

  const legacySections = normalizeSections(raw?.exhibitionLayout?.sections, itemIds);
  if (legacySections.length > 0) return legacySections;

  return [];
}

function normalizeLayoutFromGalleryRaw(raw: any): GalleryLayout {
  const directLayout = raw?.layout;
  if (directLayout && typeof directLayout === "object") {
    return normalizeGalleryLayout(directLayout);
  }

  const legacyLayout = raw?.exhibitionLayout;
  if (legacyLayout && typeof legacyLayout === "object") {
    return normalizeGalleryLayout(legacyLayout);
  }

  return getDefaultGalleryLayout();
}

function normalizeExhibitionLayoutFromGalleryRaw(
  raw: any,
  itemIds: string[],
  layout: GalleryLayout,
  sections: GallerySection[]
): ExhibitionLayout {
  const legacy = raw?.exhibitionLayout;
  const directType = normalizeExhibitionLayoutType((layout as any)?.type);
  const legacyType = normalizeExhibitionLayoutType(legacy?.type);

  return Object.assign(
    {} as ExhibitionLayout,
    layout as unknown as object,
    (legacy && typeof legacy === "object" ? legacy : {}) as object,
    {
      type: legacy?.type ? legacyType : directType,
      sections,
    }
  );
}

function normalizeGallery(raw: any): Gallery | null {
  if (!raw) return null;

  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : makeGalleryId();

  const title = normalizeTitle(raw.title);
  if (!title) return null;

  const createdAt = normalizeTimestamp(raw.createdAt, Date.now());
  const updatedAt = normalizeTimestamp(raw.updatedAt, createdAt);
  const itemIds = normalizeItemIds(raw.itemIds);
  const layout = normalizeLayoutFromGalleryRaw(raw);
  const sections = normalizeSectionsFromGalleryRaw(raw, itemIds);
  const exhibitionLayout = normalizeExhibitionLayoutFromGalleryRaw(raw, itemIds, layout, sections);

  return {
    id,
    profile_id: normalizeProfileId(raw.profile_id ?? raw.profileId),
    title,
    description: normalizeDescription(raw.description),
    itemIds,
    visibility: normalizeGalleryVisibility(raw.visibility),
    state: normalizeGalleryState(raw.state),
    layout,
    exhibitionLayout,
    coverImage: normalizeCoverImage(raw.coverImage),
    itemNotes: normalizeItemNotes(raw.itemNotes),
    share: normalizeShare(raw.share),
    analytics: normalizeAnalytics(raw.analytics),
    templateId: normalizeTemplateId(raw.templateId),
    sections,
    themePack: normalizeThemePack(raw.themePack),
    displayMode: normalizeDisplayMode(raw.displayMode),
    guestViewMode: normalizeGuestViewMode(raw.guestViewMode),
    shelfBackground: typeof raw.shelfBackground === "string" ? raw.shelfBackground : "",
    createdAt,
    updatedAt,
  };
}


function normalizeSupabaseGallery(raw: any): Gallery | null {
  if (!raw) return null;

  const createdAt =
    typeof raw.created_at === "number"
      ? raw.created_at
      : typeof raw.created_at === "string"
        ? Date.parse(raw.created_at) || Date.now()
        : Date.now();

  const updatedAt =
    typeof raw.updated_at === "number"
      ? raw.updated_at
      : typeof raw.updated_at === "string"
        ? Date.parse(raw.updated_at) || createdAt
        : createdAt;

  return normalizeGallery({
    id: raw.id,
    profile_id: raw.profile_id,
    title: raw.title,
    description: raw.description,
    itemIds: raw.item_ids ?? raw.itemIds ?? [],
    visibility: raw.visibility,
    state: raw.state,
    layout: raw.layout,
    exhibitionLayout: raw.exhibition_layout,
    coverImage: raw.cover_image,
    itemNotes: raw.item_notes ?? [],
    share: {
      publicToken:
        typeof raw.public_token === "string" && raw.public_token.trim()
          ? raw.public_token.trim()
          : undefined,
      inviteTokens: [],
    },
    analytics: {
      views:
        typeof raw.analytics_views === "number" && Number.isFinite(raw.analytics_views)
          ? raw.analytics_views
          : 0,
      uniqueViewKeys: [],
      lastViewedAt: raw.analytics_last_viewed_at
        ? Date.parse(raw.analytics_last_viewed_at) || undefined
        : undefined,
    },
    templateId:
      raw.template_id ??
      raw.layout?.templateId ??
      raw.exhibition_layout?.templateId,
    sections:
      raw.sections ??
      raw.exhibition_layout?.sections ??
      [],
    themePack:
      raw.theme_pack ??
      raw.layout?.themePack ??
      raw.exhibition_layout?.themePack,
    displayMode:
      raw.display_mode ??
      raw.layout?.displayMode ??
      raw.exhibition_layout?.displayMode,
    guestViewMode:
      raw.guest_view_mode ??
      raw.layout?.guestViewMode ??
      raw.exhibition_layout?.guestViewMode,
    shelfBackground:
      raw.shelf_background ??
      raw.layout?.shelfBackground ??
      raw.exhibition_layout?.shelfBackground ??
      "",
    createdAt,
    updatedAt,
  });
}

function serializeGalleryForSupabase(gallery: Gallery) {
  const safeExhibitionLayout = asPlainObject(gallery.exhibitionLayout);

  return {
    id: gallery.id,
    profile_id: isUuidLike(gallery.profile_id) ? safeString(gallery.profile_id) : null,
    title: gallery.title,
    description: gallery.description || "",
    visibility: gallery.visibility,
    state: gallery.state,
    cover_image: gallery.coverImage || "",
    layout: {
      themePack: gallery.themePack ?? "classic",
      displayMode: gallery.displayMode ?? "grid",
      guestViewMode: gallery.guestViewMode ?? "public",
      shelfBackground: gallery.shelfBackground ?? "",
      templateId: gallery.templateId ?? "CUSTOM",
    },
    exhibition_layout: {
      ...safeExhibitionLayout,
      type:
        gallery.exhibitionLayout?.type ??
        normalizeExhibitionLayoutType((gallery.layout as any)?.type),
      sections: gallery.sections ?? gallery.exhibitionLayout?.sections ?? [],
      themePack: gallery.themePack ?? "classic",
      displayMode: gallery.displayMode ?? "grid",
      guestViewMode: gallery.guestViewMode ?? "public",
      shelfBackground: gallery.shelfBackground ?? "",
      templateId: gallery.templateId ?? "CUSTOM",
    },
    public_token: gallery.share?.publicToken || null,
    analytics_views: gallery.analytics?.views ?? 0,
    analytics_last_viewed_at: gallery.analytics?.lastViewedAt
      ? new Date(gallery.analytics.lastViewedAt).toISOString()
      : null,
    created_at: new Date(gallery.createdAt).toISOString(),
    updated_at: new Date(gallery.updatedAt).toISOString(),
  };
}

function serializeInviteTokenForSupabase(galleryId: string, invite: GalleryInviteToken) {
  return {
    token: invite.token,
    gallery_id: galleryId,
    label: invite.label ?? null,
    created_at: new Date(invite.createdAt).toISOString(),
    last_used_at:
      typeof invite.lastUsedAt === "number" ? new Date(invite.lastUsedAt).toISOString() : null,
    expires_at:
      typeof invite.expiresAt === "number" ? new Date(invite.expiresAt).toISOString() : null,
    disabled: !!invite.disabled,
  };
}

function serializeGalleryItemsForSupabase(gallery: Gallery) {
  const itemIds = normalizeItemIds(gallery.itemIds);

  return itemIds.map((itemId, index) => ({
    gallery_id: gallery.id,
    artifact_id: itemId,
    position: index,
  }));
}

async function syncGalleryItemsToSupabase(gallery: Gallery) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const rows = serializeGalleryItemsForSupabase(gallery);

  try {
    const { data: existingRows, error: existingError } = await supabase
      .from("gallery_items")
      .select("gallery_id, artifact_id, position")
      .eq("gallery_id", gallery.id)
      .order("position", { ascending: true });

    if (existingError) {
      console.error("Failed loading existing gallery_items rows:", existingError);
      return;
    }

    const normalizedExisting = Array.isArray(existingRows)
      ? existingRows.map((row: any, index: number) => ({
          gallery_id: gallery.id,
          artifact_id: String(row?.artifact_id ?? "").trim(),
          position:
            typeof row?.position === "number" && Number.isFinite(row.position)
              ? row.position
              : index,
        }))
      : [];

    const existingSignature = JSON.stringify(
      normalizedExisting.map((row) => ({
        artifact_id: row.artifact_id,
        position: row.position,
      }))
    );

    const nextSignature = JSON.stringify(
      rows.map((row) => ({
        artifact_id: row.artifact_id,
        position: row.position,
      }))
    );

    if (existingSignature === nextSignature) {
      return;
    }

    if (rows.length === 0) {
      const { error: deleteError } = await supabase
        .from("gallery_items")
        .delete()
        .eq("gallery_id", gallery.id);

      if (deleteError) {
        console.error("Failed clearing gallery_items rows:", deleteError);
      }

      return;
    }

    const { error: deleteError } = await supabase
      .from("gallery_items")
      .delete()
      .eq("gallery_id", gallery.id);

    if (deleteError) {
      console.error("Failed clearing gallery_items rows:", deleteError);
      return;
    }

    const { error: insertError } = await supabase.from("gallery_items").insert(rows);

    if (!insertError) {
      return;
    }

    console.error("Failed inserting gallery_items rows:", insertError);

    if (normalizedExisting.length > 0) {
      const { error: restoreError } = await supabase
        .from("gallery_items")
        .insert(normalizedExisting);

      if (restoreError) {
        console.error("Failed restoring previous gallery_items rows:", restoreError);
      } else {
        console.warn("Restored previous gallery_items rows after failed sync.", {
          galleryId: gallery.id,
          restoredCount: normalizedExisting.length,
        });
      }
    }
  } catch (error) {
    console.error("Unexpected gallery_items sync error:", error);
  }
}

async function upsertGalleryToSupabase(gallery: Gallery) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  try {
    const payload = serializeGalleryForSupabase(gallery);
    const { error } = await supabase.from("galleries").upsert(payload, {
      onConflict: "id",
    });

    if (error) {
      console.error("Failed to upsert gallery:", error);
      return;
    }

    await syncGalleryItemsToSupabase(gallery);

    const inviteTokens = normalizeInviteTokens(gallery.share?.inviteTokens);
    const inviteRows = inviteTokens.map((invite) =>
      serializeInviteTokenForSupabase(gallery.id, invite)
    );

    if (inviteRows.length > 0) {
      const { error: inviteError } = await supabase.from("gallery_invites").upsert(inviteRows, {
        onConflict: "token",
      });

      if (inviteError) {
        console.error("Failed to upsert gallery invite tokens:", inviteError);
      }
    }

    let deleteQuery = supabase.from("gallery_invites").delete().eq("gallery_id", gallery.id);
    if (inviteRows.length > 0) {
      const keepTokens = inviteRows.map((row) => row.token);
      deleteQuery = deleteQuery.not("token", "in", `(${keepTokens.map((t) => JSON.stringify(t)).join(",")})`);
    }

    const { error: deleteError } = await deleteQuery;
    if (deleteError) {
      console.error("Failed to prune gallery invite tokens:", deleteError);
    }
  } catch (error) {
    console.error("Unexpected gallery Supabase sync error:", error);
  }
}

async function deleteGalleryFromSupabase(galleryId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  try {
    await supabase.from("gallery_items").delete().eq("gallery_id", galleryId);
    await supabase.from("gallery_invites").delete().eq("gallery_id", galleryId);
    await supabase.from("galleries").delete().eq("id", galleryId);
  } catch (error) {
    console.error("Failed to delete gallery from Supabase:", error);
  }
}

function syncGalleriesToSupabase(galleries: Gallery[]) {
  if (typeof window === "undefined") return;
  const normalized = galleries.map(syncGalleryShape);
  for (const gallery of normalized) {
    void upsertGalleryToSupabase(gallery);
  }
}

function ensureUniqueGalleryIds(galleries: Gallery[]) {
  const seen = new Set<string>();
  let repaired = false;

  const next = galleries.map((gallery) => {
    let id = safeString(gallery.id);

    if (!id || seen.has(id)) {
      id = makeGalleryId();
      repaired = true;
    }

    seen.add(id);

    if (id !== gallery.id) {
      repaired = true;
      return {
        ...gallery,
        id,
      };
    }

    return gallery;
  });

  return {
    galleries: next,
    repaired,
  };
}

function migrateMissingProfileIds(galleries: Gallery[]) {
  const activeProfileId = getActiveProfileId();
  if (!activeProfileId) {
    return {
      galleries,
      repaired: false,
    };
  }

  let repaired = false;

  const next = galleries.map((gallery) => {
    if (gallery.profile_id) return gallery;
    repaired = true;
    return {
      ...gallery,
      profile_id: activeProfileId,
    };
  });

  return {
    galleries: next,
    repaired,
  };
}

function writeLocalCache(galleries: Gallery[], emit: boolean) {
  if (typeof window === "undefined") return;

  const slimmed = galleries.map((gallery) => slimGalleryForLocalCache(gallery));
  window.localStorage.setItem(KEY, JSON.stringify(slimmed));

  if (emit) emitGalleryChange();
}

async function hydrateLocalGalleriesFromSupabase() {
  if (typeof window === "undefined") return;
  if (supabaseHydrationStarted) return;
  supabaseHydrationStarted = true;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  try {
    const { data, error } = await supabase
      .from("galleries")
      .select("*")
      .order("created_at", { ascending: false });

    if (error || !Array.isArray(data)) {
      if (error) console.error("Failed to hydrate galleries from Supabase:", error);
      return;
    }

    const remote = data
      .map((row) => normalizeSupabaseGallery(row))
      .filter(Boolean) as Gallery[];

    if (remote.length === 0) return;

    const local = (() => {
      try {
        const raw = window.localStorage.getItem(KEY);
        if (!raw) return [] as Gallery[];
        return normalizeAll(JSON.parse(raw)).galleries;
      } catch {
        return [] as Gallery[];
      }
    })();

    const merged = new Map<string, Gallery>();
    for (const gallery of remote) merged.set(gallery.id, gallery);
    for (const gallery of local) {
      const existing = merged.get(gallery.id);
      if (!existing || gallery.updatedAt >= existing.updatedAt) {
        merged.set(gallery.id, gallery);
      }
    }

    writeLocalCache(Array.from(merged.values()), true);
  } catch (error) {
    console.error("Unexpected Supabase gallery hydration error:", error);
  }
}

function normalizeAll(rawList: unknown) {
  if (!Array.isArray(rawList)) {
    return {
      galleries: [] as Gallery[],
      repaired: false,
    };
  }

  const normalized = rawList.map(normalizeGallery).filter(Boolean) as Gallery[];
  const unique = ensureUniqueGalleryIds(normalized);
  const migrated = migrateMissingProfileIds(unique.galleries);

  return {
    galleries: migrated.galleries,
    repaired: unique.repaired || migrated.repaired,
  };
}

function loadRawGalleries() {
  if (typeof window === "undefined") return [];

  const raw = window.localStorage.getItem(KEY);
  if (!raw) {
    void hydrateLocalGalleriesFromSupabase();
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    const { galleries, repaired } = normalizeAll(parsed);

    if (repaired || JSON.stringify(galleries) !== raw) {
      writeLocalCache(galleries, false);
    }

    void hydrateLocalGalleriesFromSupabase();
    return galleries;
  } catch {
    void hydrateLocalGalleriesFromSupabase();
    return [];
  }
}

function filterGalleriesForProfile(galleries: Gallery[], options?: LoadGalleryOptions) {
  if (options?.includeAllProfiles) return galleries;

  const explicitProfileId = safeString(options?.profileId);
  const activeProfileId = explicitProfileId || getActiveProfileId();

  if (!activeProfileId) return galleries;

  return galleries.filter((gallery) => gallery.profile_id === activeProfileId);
}

function saveNormalized(galleries: Gallery[], emit: boolean) {
  if (typeof window === "undefined") return;

  const { galleries: normalized } = normalizeAll(galleries);

  try {
    writeLocalCache(normalized, emit);
  } catch (error) {
    console.error("Failed writing gallery cache, retrying with slim cache:", error);
    const slimmed = normalized.map((gallery) => slimGalleryForLocalCache(gallery));
    writeLocalCache(slimmed, emit);
  }

  syncGalleriesToSupabase(normalized);
}

function syncGalleryShape(gallery: Gallery): Gallery {
  const normalized = normalizeGallery(gallery);
  return normalized ?? gallery;
}

function mutateGallery(
  galleryId: string,
  updater: (gallery: Gallery) => Gallery,
  options?: { includeAllProfiles?: boolean }
) {
  const galleries = loadGalleries({
    includeAllProfiles: options?.includeAllProfiles ?? true,
  });

  let changed = false;

  const next = galleries.map((gallery) => {
    if (gallery.id !== galleryId) return gallery;

    changed = true;

    return syncGalleryShape({
      ...updater(gallery),
      updatedAt: Date.now(),
    });
  });

  if (!changed) return;

  saveNormalized(next, true);
}

function getViewerKey() {
  if (typeof window === "undefined") return "server";

  const KEY_VIEWER = "vltd_gallery_viewer_key";
  const existing = window.localStorage.getItem(KEY_VIEWER);
  if (existing) return existing;

  const created = makeToken("viewer");
  window.localStorage.setItem(KEY_VIEWER, created);
  return created;
}

function rebuildExhibitionLayout(
  gallery: Gallery,
  patch?: { type?: ExhibitionLayoutType; sections?: GallerySection[] }
): ExhibitionLayout {
  const baseLayout = normalizeGalleryLayout(gallery.layout);
  const sections = normalizeSections(gallery.sections, gallery.itemIds);

  const currentType = normalizeExhibitionLayoutType(gallery.exhibitionLayout?.type);

  return Object.assign(
    {} as ExhibitionLayout,
    baseLayout as unknown as object,
    (gallery.exhibitionLayout ?? {}) as object,
    {
      type: currentType,
      sections,
    },
    (patch ?? {}) as object
  );
}

function withSyncedSections(gallery: Gallery, nextSections: GallerySection[]) {
  return {
    ...gallery,
    sections: nextSections,
    exhibitionLayout: rebuildExhibitionLayout(gallery, {
      sections: nextSections,
    }),
  };
}

export function loadGalleries(options?: LoadGalleryOptions): Gallery[] {
  const galleries = loadRawGalleries();
  return filterGalleriesForProfile(galleries, options);
}

export function loadAllGalleries() {
  return loadRawGalleries();
}

export function saveGalleries(galleries: Gallery[]) {
  if (typeof window === "undefined") return;
  saveNormalized(galleries, true);
}

export function saveGalleriesForActiveProfile(galleries: Gallery[]) {
  if (typeof window === "undefined") return;

  const activeProfileId = getActiveProfileId();
  if (!activeProfileId) {
    saveGalleries(galleries);
    return;
  }

  const existing = loadRawGalleries().filter((gallery) => gallery.profile_id !== activeProfileId);

  const nextForProfile = galleries.map((gallery) => ({
    ...gallery,
    profile_id: gallery.profile_id || activeProfileId,
  }));

  saveGalleries([...existing, ...nextForProfile]);
}

export function getGalleryById(id: string) {
  const cleanId = safeString(id);
  if (!cleanId) return null;

  return loadRawGalleries().find((gallery) => gallery.id === cleanId) ?? null;
}

export function getGalleryLayoutType(gallery: Gallery | null | undefined) {
  return normalizeExhibitionLayoutType(gallery?.exhibitionLayout?.type);
}

export function getGallerySections(gallery: Gallery | null | undefined): GallerySection[] {
  if (Array.isArray(gallery?.sections) && gallery!.sections.length > 0) return gallery!.sections;
  return normalizeSections(gallery?.exhibitionLayout?.sections, gallery?.itemIds ?? []);
}

export function getGalleryThemePack(gallery: Gallery | null | undefined): GalleryThemePack {
  return normalizeThemePack(gallery?.themePack);
}

export function getGalleryDisplayMode(gallery: Gallery | null | undefined): GalleryDisplayMode {
  return normalizeDisplayMode(gallery?.displayMode);
}

export function getGalleryGuestViewMode(
  gallery: Gallery | null | undefined
): GalleryGuestViewMode {
  return normalizeGuestViewMode(gallery?.guestViewMode);
}

export function getGalleryShelfBackground(gallery: Gallery | null | undefined) {
  return typeof gallery?.shelfBackground === "string" ? gallery.shelfBackground : "";
}

export type GalleryThemePresentation = {
  backgroundImage: string;
  pageOverlayClass: string;
  heroPanelClass: string;
  chipClass: string;
  sectionPanelClass: string;
  cardClass: string;
  accentClass: string;
  shelfRail: string;
  shelfEdge: string;
};

export function getGalleryThemeBackground(themePack?: GalleryThemePack | string) {
  switch (normalizeThemePack(themePack)) {
    case "walnut":
      return "/themes/walnut-bg.webp";
    case "midnight":
      return "/themes/midnight-bg.webp";
    case "marble":
      return "/themes/marble-bg.webp";
    case "classic":
    default:
      return "/themes/classic-bg.webp";
  }
}

export function getGalleryThemePresentation(
  themePack?: GalleryThemePack | string
): GalleryThemePresentation {
  switch (normalizeThemePack(themePack)) {
    case "walnut":
      return {
        backgroundImage: getGalleryThemeBackground("walnut"),
        pageOverlayClass:
          "bg-[linear-gradient(180deg,rgba(13,9,6,0.52),rgba(13,9,6,0.84))]",
        heroPanelClass:
          "border-[#8c6543]/45 bg-[linear-gradient(135deg,rgba(55,33,18,0.62),rgba(22,13,8,0.68))] text-stone-100 shadow-[0_28px_90px_rgba(0,0,0,0.46)]",
        chipClass:
          "bg-[rgba(72,45,28,0.58)] text-stone-100 ring-[#b98b62]/25",
        sectionPanelClass:
          "bg-[linear-gradient(180deg,rgba(30,18,11,0.80),rgba(18,11,7,0.84))] ring-[#8c6543]/28 text-stone-100",
        cardClass:
          "border-[#b98b62]/20 bg-[linear-gradient(180deg,rgba(255,244,231,0.08),rgba(255,244,231,0.03))] shadow-[0_22px_56px_rgba(0,0,0,0.38)]",
        accentClass: "text-[#e6c9a7]",
        shelfRail:
          "linear-gradient(180deg, rgba(128,86,55,0.96), rgba(77,46,25,0.98))",
        shelfEdge:
          "linear-gradient(180deg, rgba(220,175,126,0.62), rgba(77,46,25,0))",
      };
    case "midnight":
      return {
        backgroundImage: getGalleryThemeBackground("midnight"),
        pageOverlayClass:
          "bg-[linear-gradient(180deg,rgba(3,7,14,0.45),rgba(2,5,10,0.82))]",
        heroPanelClass:
          "border-cyan-300/18 bg-[linear-gradient(135deg,rgba(10,18,28,0.62),rgba(4,9,16,0.72))] text-slate-100 shadow-[0_28px_90px_rgba(0,0,0,0.56)]",
        chipClass:
          "bg-[rgba(15,24,36,0.64)] text-slate-100 ring-cyan-300/18",
        sectionPanelClass:
          "bg-[linear-gradient(180deg,rgba(8,13,22,0.82),rgba(4,8,15,0.86))] ring-cyan-300/16 text-slate-100",
        cardClass:
          "border-cyan-200/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] shadow-[0_24px_64px_rgba(0,0,0,0.50)]",
        accentClass: "text-cyan-100",
        shelfRail:
          "linear-gradient(180deg, rgba(31,45,68,0.96), rgba(10,18,31,0.99))",
        shelfEdge:
          "linear-gradient(180deg, rgba(130,177,255,0.48), rgba(10,18,31,0))",
      };
    case "marble":
      return {
        backgroundImage: getGalleryThemeBackground("marble"),
        pageOverlayClass:
          "bg-[linear-gradient(180deg,rgba(40,44,51,0.26),rgba(30,33,39,0.60))]",
        heroPanelClass:
          "border-white/30 bg-[linear-gradient(135deg,rgba(255,255,255,0.34),rgba(216,220,228,0.18))] text-slate-950 shadow-[0_26px_72px_rgba(10,16,28,0.18)]",
        chipClass:
          "bg-[rgba(255,255,255,0.60)] text-slate-900 ring-slate-300/55",
        sectionPanelClass:
          "bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(229,233,240,0.26))] ring-slate-300/45 text-slate-900",
        cardClass:
          "border-slate-300/35 bg-[linear-gradient(180deg,rgba(255,255,255,0.65),rgba(239,242,247,0.34))] shadow-[0_22px_44px_rgba(57,67,84,0.14)]",
        accentClass: "text-slate-900",
        shelfRail:
          "linear-gradient(180deg, rgba(214,219,226,0.97), rgba(164,172,184,0.99))",
        shelfEdge:
          "linear-gradient(180deg, rgba(255,255,255,0.82), rgba(164,172,184,0))",
      };
    case "classic":
    default:
      return {
        backgroundImage: getGalleryThemeBackground("classic"),
        pageOverlayClass:
          "bg-[linear-gradient(180deg,rgba(12,11,8,0.40),rgba(12,11,8,0.74))]",
        heroPanelClass:
          "border-amber-200/12 bg-[linear-gradient(135deg,rgba(25,21,16,0.56),rgba(14,12,9,0.66))] text-stone-100 shadow-[0_28px_84px_rgba(0,0,0,0.44)]",
        chipClass:
          "bg-[rgba(31,26,20,0.58)] text-stone-100 ring-amber-100/12",
        sectionPanelClass:
          "bg-[linear-gradient(180deg,rgba(20,17,13,0.78),rgba(13,11,8,0.84))] ring-amber-100/12 text-stone-100",
        cardClass:
          "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))] shadow-[0_22px_56px_rgba(0,0,0,0.38)]",
        accentClass: "text-amber-100",
        shelfRail:
          "linear-gradient(180deg, rgba(96,72,52,0.97), rgba(61,43,29,0.99))",
        shelfEdge:
          "linear-gradient(180deg, rgba(196,156,113,0.46), rgba(61,43,29,0))",
      };
  }
}

export function createGallery(title: string): Gallery {
  const now = Date.now();
  const layout = getDefaultGalleryLayout();
  const sections: GallerySection[] = [];

  return {
    id: makeGalleryId(),
    profile_id: getActiveProfileId() || undefined,
    title: normalizeTitle(title),
    description: "",
    itemIds: [],
    visibility: "PUBLIC",
    state: "ACTIVE",
    layout,
    exhibitionLayout: Object.assign(
      {} as ExhibitionLayout,
      layout as unknown as object,
      {
        type: normalizeExhibitionLayoutType((layout as any)?.type),
        sections,
      }
    ),
    coverImage: "",
    itemNotes: [],
    share: {
      publicToken: makeToken("pub"),
      inviteTokens: [],
    },
    analytics: {
      views: 0,
      uniqueViewKeys: [],
      lastViewedAt: undefined,
    },
    templateId: "CUSTOM",
    sections,
    themePack: "classic",
    displayMode: "grid",
    guestViewMode: "public",
    shelfBackground: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function updateGallery(updated: Gallery) {
  const galleries = loadRawGalleries();

  const next = galleries.map((gallery) =>
    gallery.id === updated.id
      ? {
          ...syncGalleryShape(updated),
          updatedAt: Date.now(),
        }
      : gallery
  );

  saveGalleries(next);
}

export function deleteGallery(id: string) {
  const galleries = loadRawGalleries();
  saveGalleries(galleries.filter((gallery) => gallery.id !== id));
  void deleteGalleryFromSupabase(id);
}

export function setGalleryCoverImage(galleryId: string, coverImage: string) {
  mutateGallery(galleryId, (gallery) => ({
    ...gallery,
    coverImage: normalizeCoverImage(coverImage),
  }));
}

export function setGalleryThemePack(galleryId: string, themePack: GalleryThemePack) {
  mutateGallery(galleryId, (gallery) => ({
    ...gallery,
    themePack: normalizeThemePack(themePack),
  }));
}

export function setGalleryDisplayMode(galleryId: string, displayMode: GalleryDisplayMode) {
  mutateGallery(galleryId, (gallery) => ({
    ...gallery,
    displayMode: normalizeDisplayMode(displayMode),
  }));
}

export function setGalleryGuestViewMode(galleryId: string, guestViewMode: GalleryGuestViewMode) {
  mutateGallery(galleryId, (gallery) => ({
    ...gallery,
    guestViewMode: normalizeGuestViewMode(guestViewMode),
  }));
}

export function setGalleryShelfBackground(galleryId: string, shelfBackground: string) {
  mutateGallery(galleryId, (gallery) => ({
    ...gallery,
    shelfBackground: typeof shelfBackground === "string" ? shelfBackground.trim() : "",
  }));
}

export function setGalleryItemIds(galleryId: string, itemIds: string[]) {
  mutateGallery(galleryId, (gallery) => {
    const nextItemIds = normalizeItemIds(itemIds);
    const allowed = new Set(nextItemIds);

    const nextSections = normalizeSections(getGallerySections(gallery), nextItemIds).map((section) => {
      const sectionItemIds = section.itemIds.filter((itemId) => allowed.has(itemId));
      const featuredItemId =
        section.featuredItemId && sectionItemIds.includes(section.featuredItemId)
          ? section.featuredItemId
          : sectionItemIds[0];

      return {
        ...section,
        itemIds: sectionItemIds,
        featuredItemId,
      };
    });

    const nextGallery = {
      ...gallery,
      itemIds: nextItemIds,
    };

    return withSyncedSections(nextGallery, nextSections);
  });
}

export function setGalleryItemNote(galleryId: string, itemId: string, note: string) {
  const cleanItemId = safeString(itemId);
  if (!cleanItemId) return;

  mutateGallery(galleryId, (gallery) => {
    const existing = normalizeItemNotes(gallery.itemNotes);
    const cleanNote = String(note ?? "");

    const nextNotes = existing.filter((entry) => entry.itemId !== cleanItemId);

    if (cleanNote.trim()) {
      nextNotes.push({
        itemId: cleanItemId,
        note: cleanNote,
        updatedAt: Date.now(),
      });
    }

    return {
      ...gallery,
      itemNotes: nextNotes,
    };
  });
}

export function getGalleryItemNote(gallery: Gallery, itemId: string) {
  const cleanItemId = safeString(itemId);
  if (!cleanItemId) return "";

  const notes = normalizeItemNotes(gallery.itemNotes);
  return notes.find((entry) => entry.itemId === cleanItemId)?.note ?? "";
}

export function ensureGalleryPublicToken(galleryId: string) {
  const gallery = getGalleryById(galleryId);
  if (!gallery) return "";

  const existing = gallery.share?.publicToken;
  if (existing) return existing;

  const token = makeToken("pub");

  mutateGallery(
    galleryId,
    (current) => ({
      ...current,
      share: {
        publicToken: token,
        inviteTokens: normalizeInviteTokens(current.share?.inviteTokens),
      },
    }),
    { includeAllProfiles: true }
  );

  return token;
}

export function regenerateGalleryPublicToken(galleryId: string) {
  const token = makeToken("pub");

  mutateGallery(
    galleryId,
    (gallery) => ({
      ...gallery,
      share: {
        publicToken: token,
        inviteTokens: normalizeInviteTokens(gallery.share?.inviteTokens),
      },
    }),
    { includeAllProfiles: true }
  );

  return token;
}

export async function getGalleryByPublicToken(publicToken: string) {
  const cleanToken = safeString(publicToken);
  if (!cleanToken) return null;

  const supabase = getSupabaseBrowserClient();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("galleries")
        .select("*")
        .eq("public_token", cleanToken)
        .single();

      if (!error && data) {
        const normalizedGallery = normalizeSupabaseGallery(data);
        if (normalizedGallery) return normalizedGallery;
      }
    } catch (error) {
      console.error("Supabase public gallery lookup failed:", error);
    }
  }

  const galleries = loadRawGalleries();
  return galleries.find((gallery) => gallery.share?.publicToken === cleanToken) ?? null;
}

export function createGalleryInviteToken(galleryId: string, label?: string, expiresAt?: number) {
  const token = makeToken("inv");
  const cleanLabel = typeof label === "string" ? label.trim() : "";

  mutateGallery(
    galleryId,
    (gallery) => ({
      ...gallery,
      share: {
        publicToken: gallery.share?.publicToken,
        inviteTokens: [
          ...normalizeInviteTokens(gallery.share?.inviteTokens),
          {
            token,
            label: cleanLabel || undefined,
            createdAt: Date.now(),
            expiresAt:
              typeof expiresAt === "number" && Number.isFinite(expiresAt)
                ? expiresAt
                : undefined,
            disabled: false,
          },
        ],
      },
    }),
    { includeAllProfiles: true }
  );

  return token;
}

export function disableGalleryInviteToken(galleryId: string, token: string) {
  const cleanToken = safeString(token);
  if (!cleanToken) return;

  mutateGallery(
    galleryId,
    (gallery) => ({
      ...gallery,
      share: {
        publicToken: gallery.share?.publicToken,
        inviteTokens: normalizeInviteTokens(gallery.share?.inviteTokens).map((entry) =>
          entry.token === cleanToken
            ? {
                ...entry,
                disabled: true,
              }
            : entry
        ),
      },
    }),
    { includeAllProfiles: true }
  );
}

export function validateGalleryInviteToken(gallery: Gallery, token: string) {
  const cleanToken = safeString(token);
  if (!cleanToken) return false;

  const tokens = normalizeInviteTokens(gallery.share?.inviteTokens);
  const match = tokens.find((entry) => entry.token === cleanToken);

  if (!match) return false;
  if (match.disabled) return false;
  if (typeof match.expiresAt === "number" && match.expiresAt < Date.now()) return false;

  return true;
}

export function markGalleryInviteTokenUsed(galleryId: string, token: string) {
  const cleanToken = safeString(token);
  if (!cleanToken) return;

  mutateGallery(
    galleryId,
    (gallery) => ({
      ...gallery,
      share: {
        publicToken: gallery.share?.publicToken,
        inviteTokens: normalizeInviteTokens(gallery.share?.inviteTokens).map((entry) =>
          entry.token === cleanToken
            ? {
                ...entry,
                lastUsedAt: Date.now(),
              }
            : entry
        ),
      },
    }),
    { includeAllProfiles: true }
  );
}

export function getActiveInviteTokens(gallery: Gallery) {
  return normalizeInviteTokens(gallery.share?.inviteTokens).filter((entry) => {
    if (entry.disabled) return false;
    if (typeof entry.expiresAt === "number" && entry.expiresAt < Date.now()) return false;
    return true;
  });
}

async function markSupabaseInviteTokenUsed(token: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  try {
    await supabase
      .from("gallery_invites")
      .update({ last_used_at: new Date().toISOString() })
      .eq("token", token);
  } catch (error) {
    console.error("Failed to mark Supabase invite token used:", error);
  }
}

export async function getGalleryByInviteToken(
  token: string
): Promise<GalleryInviteLookupResult | null> {
  const cleanToken = safeString(token);
  if (!cleanToken) return null;

  const supabase = getSupabaseBrowserClient();

  if (supabase) {
    try {
      const { data: inviteRow, error: inviteError } = await supabase
        .from("gallery_invites")
        .select("*")
        .eq("token", cleanToken)
        .single();

      if (!inviteError && inviteRow) {
        const disabled = !!inviteRow.disabled;
        const expiresAt =
          inviteRow.expires_at != null
            ? new Date(inviteRow.expires_at).getTime()
            : undefined;

        if (!disabled && !(typeof expiresAt === "number" && expiresAt < Date.now())) {
          const { data: galleryRow, error: galleryError } = await supabase
            .from("galleries")
            .select("*")
            .eq("id", inviteRow.gallery_id)
            .single();

          if (!galleryError && galleryRow) {
            const normalizedGallery = normalizeSupabaseGallery(galleryRow);

            if (normalizedGallery) {
              return {
                gallery: normalizedGallery,
                inviteToken: {
                  token: inviteRow.token,
                  label: typeof inviteRow.label === "string" ? inviteRow.label : undefined,
                  createdAt: inviteRow.created_at
                    ? new Date(inviteRow.created_at).getTime()
                    : Date.now(),
                  lastUsedAt: inviteRow.last_used_at
                    ? new Date(inviteRow.last_used_at).getTime()
                    : undefined,
                  expiresAt,
                  disabled,
                },
              };
            }
          }
        }
      }
    } catch (error) {
      console.error("Supabase invite lookup failed:", error);
    }
  }

  const galleries = loadRawGalleries();

  for (const gallery of galleries) {
    const match = normalizeInviteTokens(gallery.share?.inviteTokens).find(
      (entry) => entry.token === cleanToken
    );

    if (!match) continue;
    if (match.disabled) return null;
    if (typeof match.expiresAt === "number" && match.expiresAt < Date.now()) return null;

    return {
      gallery,
      inviteToken: match,
    };
  }

  return null;
}

export async function markGalleryInviteTokenUsedByToken(token: string) {
  const lookup = await getGalleryByInviteToken(token);
  if (!lookup) return null;

  markGalleryInviteTokenUsed(lookup.gallery.id, lookup.inviteToken.token);
  await markSupabaseInviteTokenUsed(lookup.inviteToken.token);
  return lookup.gallery.id;
}

export function recordGalleryView(galleryId: string) {
  if (typeof window === "undefined") return;

  const viewerKey = getViewerKey();

  mutateGallery(
    galleryId,
    (gallery) => {
      const analytics = normalizeAnalytics(gallery.analytics);
      const alreadySeen = analytics.uniqueViewKeys.includes(viewerKey);

      return {
        ...gallery,
        analytics: {
          views: alreadySeen ? analytics.views : analytics.views + 1,
          uniqueViewKeys: alreadySeen
            ? analytics.uniqueViewKeys
            : [...analytics.uniqueViewKeys, viewerKey].slice(-500),
          lastViewedAt: Date.now(),
        },
      };
    },
    { includeAllProfiles: true }
  );
}

export function getGalleryShareUrl(gallery: Gallery, origin?: string) {
  const token = gallery.share?.publicToken;
  if (!token) return "";

  const base =
    typeof origin === "string" && origin.trim()
      ? origin.replace(/\/+$/, "")
      : typeof window !== "undefined"
        ? window.location.origin
        : "";

  if (!base) return "";

  return `${base}/museum/share/${encodeURIComponent(token)}`;
}

export function getGalleryInviteUrl(gallery: Gallery, token: string, origin?: string) {
  const cleanToken = safeString(token);
  if (!cleanToken) return "";

  const base =
    typeof origin === "string" && origin.trim()
      ? origin.replace(/\/+$/, "")
      : typeof window !== "undefined"
        ? window.location.origin
        : "";

  if (!base) return "";

  return `${base}/museum/invite/${encodeURIComponent(cleanToken)}`;
}

export function createGallerySection(galleryId: string, title?: string) {
  const sectionId = makeSectionId();

  mutateGallery(galleryId, (gallery) => {
    const nextSections = [
      ...normalizeSections(getGallerySections(gallery), gallery.itemIds),
      {
        id: sectionId,
        title: safeString(title) || "New Section",
        description: "",
        itemIds: [],
        featuredItemId: undefined,
      },
    ];

    return withSyncedSections(gallery, nextSections);
  });

  return sectionId;
}

export function updateGallerySection(
  galleryId: string,
  sectionId: string,
  patch: Partial<Pick<GallerySection, "title" | "description" | "featuredItemId">>
) {
  const cleanSectionId = safeString(sectionId);
  if (!cleanSectionId) return;

  mutateGallery(galleryId, (gallery) => {
    const nextSections = normalizeSections(getGallerySections(gallery), gallery.itemIds).map((section) => {
      if (section.id !== cleanSectionId) return section;

      const featuredItemId =
        typeof patch.featuredItemId === "string" && section.itemIds.includes(patch.featuredItemId)
          ? patch.featuredItemId
          : patch.featuredItemId === ""
            ? undefined
            : section.featuredItemId;

      return {
        ...section,
        title:
          typeof patch.title === "string"
            ? patch.title.trim() || "Untitled Section"
            : section.title,
        description:
          typeof patch.description === "string" ? patch.description : section.description,
        featuredItemId,
      };
    });

    return withSyncedSections(gallery, nextSections);
  });
}

export function deleteGallerySection(galleryId: string, sectionId: string) {
  const cleanSectionId = safeString(sectionId);
  if (!cleanSectionId) return;

  mutateGallery(galleryId, (gallery) => {
    const nextSections = normalizeSections(getGallerySections(gallery), gallery.itemIds).filter(
      (section) => section.id !== cleanSectionId
    );

    return withSyncedSections(gallery, nextSections);
  });
}

export function assignGallerySectionItems(galleryId: string, sectionId: string, itemIds: string[]) {
  const cleanSectionId = safeString(sectionId);
  if (!cleanSectionId) return;

  mutateGallery(galleryId, (gallery) => {
    const allowed = new Set(gallery.itemIds);
    const nextItemIds = normalizeItemIds(itemIds).filter((itemId) => allowed.has(itemId));

    const nextSections = normalizeSections(getGallerySections(gallery), gallery.itemIds).map((section) => {
      if (section.id !== cleanSectionId) return section;

      return {
        ...section,
        itemIds: nextItemIds,
        featuredItemId: nextItemIds.includes(section.featuredItemId ?? "")
          ? section.featuredItemId
          : nextItemIds[0],
      };
    });

    return withSyncedSections(gallery, nextSections);
  });
}

export function applyGalleryTemplate(galleryId: string, templateId: GalleryTemplateId) {
  mutateGallery(galleryId, (gallery) => {
    const ids = [...gallery.itemIds];

    let sections: GallerySection[] = [];

    if (templateId === "MASTERPIECE") {
      sections = [
        {
          id: makeSectionId(),
          title: "Featured Masterpiece",
          description: "The anchor piece that defines the exhibition.",
          itemIds: ids.slice(0, 1),
          featuredItemId: ids[0],
        },
        {
          id: makeSectionId(),
          title: "Supporting Highlights",
          description: "Key works that deepen the story.",
          itemIds: ids.slice(1),
          featuredItemId: ids[1],
        },
      ];
    } else if (templateId === "TIMELINE") {
      const midpoint = Math.ceil(ids.length / 2);
      sections = [
        {
          id: makeSectionId(),
          title: "Early Era",
          description: "Origins and foundational pieces.",
          itemIds: ids.slice(0, midpoint),
          featuredItemId: ids[0],
        },
        {
          id: makeSectionId(),
          title: "Later Era",
          description: "Mature period and closing highlights.",
          itemIds: ids.slice(midpoint),
          featuredItemId: ids[midpoint],
        },
      ];
    } else if (templateId === "ARTIST_STUDY") {
      const cutoff = Math.min(3, ids.length);
      sections = [
        {
          id: makeSectionId(),
          title: "Signature Works",
          description: "The defining works in the study.",
          itemIds: ids.slice(0, cutoff),
          featuredItemId: ids[0],
        },
        {
          id: makeSectionId(),
          title: "Context Works",
          description: "Companion works and related pieces.",
          itemIds: ids.slice(cutoff),
          featuredItemId: ids[cutoff],
        },
      ];
    } else if (templateId === "TOP_10") {
      sections = [
        {
          id: makeSectionId(),
          title: "Ranked Selection",
          description: "A top-tier ranked presentation.",
          itemIds: ids,
          featuredItemId: ids[0],
        },
      ];
    } else if (templateId === "INVESTMENT") {
      const cutoff = Math.ceil(ids.length / 2);
      sections = [
        {
          id: makeSectionId(),
          title: "High Conviction",
          description: "Primary value drivers in the collection.",
          itemIds: ids.slice(0, cutoff),
          featuredItemId: ids[0],
        },
        {
          id: makeSectionId(),
          title: "Growth Positions",
          description: "Supporting positions with upside potential.",
          itemIds: ids.slice(cutoff),
          featuredItemId: ids[cutoff],
        },
      ];
    } else {
      sections = normalizeSections(getGallerySections(gallery), gallery.itemIds);
    }

    const nextGallery = withSyncedSections(
      {
        ...gallery,
        templateId,
      },
      sections
    );

    return {
      ...nextGallery,
      exhibitionLayout: rebuildExhibitionLayout(nextGallery, {
        type:
          templateId === "CUSTOM"
            ? "GRID"
            : (normalizeExhibitionLayoutType(templateId) as ExhibitionLayoutType),
        sections,
      }),
    };
  });
}

/* Backward-compatible helpers */

export function addGallerySection(galleryId: string, title?: string) {
  return createGallerySection(galleryId, title);
}

export function removeGallerySection(galleryId: string, sectionId: string) {
  return deleteGallerySection(galleryId, sectionId);
}

export function setSectionFeaturedItem(galleryId: string, sectionId: string, itemId?: string) {
  return updateGallerySection(galleryId, sectionId, {
    featuredItemId: itemId ?? "",
  });
}

export function moveItemBetweenSections(
  galleryId: string,
  itemId: string,
  fromSectionId: string,
  toSectionId: string
) {
  const cleanItemId = safeString(itemId);
  const cleanFrom = safeString(fromSectionId);
  const cleanTo = safeString(toSectionId);

  if (!cleanItemId || !cleanFrom || !cleanTo || cleanFrom === cleanTo) return;

  mutateGallery(galleryId, (gallery) => {
    const sections = normalizeSections(getGallerySections(gallery), gallery.itemIds).map((section) => {
      if (section.id === cleanFrom) {
        const nextItemIds = section.itemIds.filter((id) => id !== cleanItemId);
        return {
          ...section,
          itemIds: nextItemIds,
          featuredItemId: nextItemIds.includes(section.featuredItemId ?? "")
            ? section.featuredItemId
            : nextItemIds[0],
        };
      }

      if (section.id === cleanTo) {
        const nextItemIds = section.itemIds.includes(cleanItemId)
          ? section.itemIds
          : [...section.itemIds, cleanItemId];

        return {
          ...section,
          itemIds: nextItemIds,
          featuredItemId: section.featuredItemId || nextItemIds[0],
        };
      }

      return section;
    });

    return withSyncedSections(gallery, sections);
  });
}

export function setExhibitionLayoutType(
  galleryId: string,
  type: GalleryTemplateId | "GRID" | "CURATED"
) {
  mutateGallery(galleryId, (gallery) => {
    const nextLayoutType = normalizeExhibitionLayoutType(type);

    const nextGallery: Gallery = {
      ...gallery,
      layout: Object.assign(
        {} as GalleryLayout,
        (gallery.layout as unknown as object),
        {
          type: nextLayoutType,
        }
      ),
      exhibitionLayout: rebuildExhibitionLayout(gallery, {
        type: nextLayoutType,
        sections: getGallerySections(gallery),
      }),
    };

    return nextGallery;
  });

  if (type === "GRID" || type === "CURATED") {
    return applyGalleryTemplate(galleryId, "CUSTOM");
  }

  return applyGalleryTemplate(galleryId, type);
}

export function assignGalleriesToProfile(profileId: string) {
  const cleanProfileId = safeString(profileId);
  if (!cleanProfileId || typeof window === "undefined") return;

  const galleries = loadRawGalleries();
  let changed = false;

  const next = galleries.map((gallery) => {
    if (gallery.profile_id) return gallery;
    changed = true;
    return {
      ...gallery,
      profile_id: cleanProfileId,
    };
  });

  if (changed) {
    saveGalleries(next);
  }
}

export function getThemeBackgroundSimple(theme?: string){
  switch((theme||"classic").toLowerCase()){
    case "walnut": return "/themes/walnut-bg.webp";
    case "midnight": return "/themes/midnight-bg.webp";
    case "marble": return "/themes/marble-bg.webp";
    default: return "/themes/classic-bg.webp";
  }
}

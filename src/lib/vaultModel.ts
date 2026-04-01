import {
  fetchVaultItemsFromSupabase,
  getVaultImagePublicUrl,
  hasSupabaseEnv,
  isDirectBrowserImageUrl,
} from "@/lib/vaultCloud";
import { newId } from "@/lib/id";

export type PriceConfidence = "low" | "medium" | "high";
export type VaultImageRole = "primary" | "detail" | "proof";

export type VaultImage = {
  id: string;
  storageKey: string;
  url?: string;
  order: number;
  localOnly?: boolean;
  role?: VaultImageRole;
};

export type VaultItem = {
  id: string;
  profile_id?: string;
  universe?: string;
  category?: string;
  customCategoryLabel?: string;
  categoryLabel?: string;
  subcategoryLabel?: string;
  title: string;
  subtitle?: string;
  number?: string;
  grade?: string;
  purchasePrice?: number;
  purchaseTax?: number;
  purchaseShipping?: number;
  purchaseFees?: number;
  currentValue?: number;
  purchaseSource?: string;
  purchaseLocation?: string;
  orderNumber?: string;
  imageFrontUrl?: string;
  imageBackUrl?: string;
  imageFrontStoragePath?: string;
  images?: VaultImage[];
  primaryImageKey?: string;
  notes?: string;
  storageLocation?: string;
  certNumber?: string;
  serialNumber?: string;
  valueSource?: string;
  valueUpdatedAt?: number;
  valueConfidence?: number;
  estimatedValue?: number;
  lastCompValue?: number;
  priceSource?: string;
  priceConfidence?: PriceConfidence;
  priceUpdatedAt?: number;
  priceNotes?: string;
  createdAt?: number;
  isNew?: boolean;
};

type LoadItemsOptions = {
  profileId?: string;
  includeAllProfiles?: boolean;
};

const LS_KEY = "vltd_vault_items_v1";
const LEGACY_LS_KEY = "vltd_items";
const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";

function clampNum(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeProfileId(value: unknown) {
  const next = String(value ?? "").trim();
  return next || undefined;
}

function getActiveProfileId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "";
}

function isEphemeralImageUrl(value?: string | null) {
  if (!value) return false;
  const lower = String(value).toLowerCase();
  return lower.startsWith("blob:") || lower.startsWith("data:");
}

function isProbablyStoragePath(value?: string | null) {
  if (!value) return false;
  return !isDirectBrowserImageUrl(value) && value.includes("/");
}

function sanitizeMaybeImageUrl(value?: string | null) {
  if (!value) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;
  if (isDirectBrowserImageUrl(trimmed)) return trimmed;
  if (isProbablyStoragePath(trimmed)) return undefined;
  return undefined;
}


function sanitizeVaultImageRole(value: unknown): VaultImageRole | undefined {
  if (value === "primary" || value === "detail" || value === "proof") return value;
  return undefined;
}

function inferImageRole(index: number, explicitRole?: VaultImageRole): VaultImageRole {
  if (explicitRole) return explicitRole;
  return index === 0 ? "primary" : "detail";
}

function sanitizePriceConfidence(value: unknown): PriceConfidence | undefined {
  if (value === "low" || value === "medium" || value === "high") return value;
  return undefined;
}

function ensureUniqueIds(items: VaultItem[]) {
  const seen = new Set<string>();
  let repaired = false;

  const next = items.map((item) => {
    let id = String(item.id ?? "").trim();
    if (!id || seen.has(id)) {
      id = newId();
      repaired = true;
    }
    seen.add(id);
    if (id !== item.id) return { ...item, id };
    return item;
  });

  return { items: next, repaired };
}

function migrateMissingProfileIds(items: VaultItem[]) {
  const activeProfileId = getActiveProfileId();
  if (!activeProfileId) return { items, repaired: false };

  let repaired = false;
  const next = items.map((item) => {
    if (item.profile_id) return item;
    repaired = true;
    return { ...item, profile_id: activeProfileId };
  });

  return { items: next, repaired };
}

function normalizeImages(raw: any): VaultImage[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((image, index) => {
      const storageKey = String(image?.storageKey ?? "").trim();
      const rawUrl = String(image?.url ?? "").trim();
      const safeUrl = sanitizeMaybeImageUrl(rawUrl);

      if (!storageKey && !safeUrl) return null;

      const resolvedStorageKey = storageKey || safeUrl || "";

      return {
        id: String(image?.id ?? resolvedStorageKey).trim() || `image_${index}`,
        storageKey: resolvedStorageKey,
        url: safeUrl || undefined,
        order: Number.isFinite(Number(image?.order)) ? Number(image.order) : index,
        localOnly:
          Boolean(image?.localOnly) ||
          isEphemeralImageUrl(safeUrl) ||
          isEphemeralImageUrl(resolvedStorageKey),
        role: inferImageRole(index, sanitizeVaultImageRole(image?.role)),
      } as VaultImage;
    })
    .filter(Boolean) as VaultImage[];
}

function buildLegacyImages(raw: any): VaultImage[] {
  const images: VaultImage[] = [];

  if (typeof raw.imageFrontStoragePath === "string" && raw.imageFrontStoragePath.trim()) {
    images.push({
      id: raw.imageFrontStoragePath.trim(),
      storageKey: raw.imageFrontStoragePath.trim(),
      url: sanitizeMaybeImageUrl(raw.imageFrontUrl),
      order: 0,
      localOnly: false,
      role: "primary",
    });
  } else {
    const frontUrl = sanitizeMaybeImageUrl(raw.imageFrontUrl);
    if (frontUrl) {
      images.push({
        id: "legacy-front",
        storageKey: frontUrl,
        url: frontUrl,
        order: 0,
        localOnly: isEphemeralImageUrl(frontUrl),
      });
    }
  }

  const backUrl = sanitizeMaybeImageUrl(raw.imageBackUrl);
  if (backUrl) {
    images.push({
      id: "legacy-back",
      storageKey: backUrl,
      url: backUrl,
      order: 1,
      localOnly: isEphemeralImageUrl(backUrl),
      role: "detail",
    });
  }

  return images;
}

function dedupeAndRepairImages(images: VaultImage[]) {
  const seen = new Set<string>();
  const next: VaultImage[] = [];

  for (const image of images) {
    const resolvedKey = String(image.storageKey || image.url || "").trim();
    if (!resolvedKey) continue;
    if (seen.has(resolvedKey)) continue;
    seen.add(resolvedKey);

    const safeUrl = sanitizeMaybeImageUrl(image.url);

    next.push({
      ...image,
      storageKey: resolvedKey,
      url: safeUrl || undefined,
      localOnly:
        Boolean(image.localOnly) ||
        isEphemeralImageUrl(safeUrl) ||
        isEphemeralImageUrl(resolvedKey),
    });
  }

  return next.map((image, index) => ({
    ...image,
    order: index,
    role: inferImageRole(index, sanitizeVaultImageRole(image.role)),
  }));
}

function normalizeOne(raw: any): VaultItem | null {
  if (!raw || typeof raw !== "object") return null;

  const title = String(raw.title ?? "").trim();
  if (!title) return null;

  let images = normalizeImages(raw.images);
  if (images.length === 0) {
    images = buildLegacyImages(raw);
  }
  images = dedupeAndRepairImages(images);

  const primaryImageKey =
    typeof raw.primaryImageKey === "string" && raw.primaryImageKey.trim()
      ? raw.primaryImageKey.trim()
      : images[0]?.storageKey;

  const safeFront = sanitizeMaybeImageUrl(raw.imageFrontUrl);
  const safeBack = sanitizeMaybeImageUrl(raw.imageBackUrl);
  const frontUrl = safeFront || images[0]?.url || undefined;

  return {
    id: String(raw.id ?? "").trim() || newId(),
    profile_id: normalizeProfileId(raw.profile_id ?? raw.profileId),
    universe: raw.universe ?? undefined,
    category: raw.category ?? undefined,
    customCategoryLabel: raw.customCategoryLabel ?? undefined,
    categoryLabel: raw.categoryLabel ?? undefined,
    subcategoryLabel: raw.subcategoryLabel ?? undefined,
    title,
    subtitle: raw.subtitle ?? undefined,
    number: raw.number ?? undefined,
    grade: raw.grade ?? undefined,
    purchasePrice: clampNum(raw.purchasePrice, 0),
    purchaseTax: clampNum(raw.purchaseTax, 0),
    purchaseShipping: clampNum(raw.purchaseShipping, 0),
    purchaseFees: clampNum(raw.purchaseFees, 0),
    currentValue: clampNum(raw.currentValue, clampNum(raw.purchasePrice, 0)),
    purchaseSource: raw.purchaseSource ?? undefined,
    purchaseLocation: raw.purchaseLocation ?? undefined,
    orderNumber: raw.orderNumber ?? undefined,
    imageFrontUrl: frontUrl,
    imageBackUrl: safeBack,
    imageFrontStoragePath:
      typeof raw.imageFrontStoragePath === "string" && raw.imageFrontStoragePath.trim()
        ? raw.imageFrontStoragePath.trim()
        : undefined,
    images,
    primaryImageKey,
    notes: raw.notes ?? undefined,
    storageLocation: raw.storageLocation ?? undefined,
    certNumber: raw.certNumber ?? undefined,
    serialNumber: raw.serialNumber ?? undefined,
    valueSource: raw.valueSource ?? undefined,
    valueUpdatedAt:
      typeof raw.valueUpdatedAt === "number" && Number.isFinite(raw.valueUpdatedAt)
        ? raw.valueUpdatedAt
        : undefined,
    valueConfidence:
      typeof raw.valueConfidence === "number" && Number.isFinite(raw.valueConfidence)
        ? raw.valueConfidence
        : undefined,
    estimatedValue:
      typeof raw.estimatedValue === "number" && Number.isFinite(raw.estimatedValue)
        ? raw.estimatedValue
        : undefined,
    lastCompValue:
      typeof raw.lastCompValue === "number" && Number.isFinite(raw.lastCompValue)
        ? raw.lastCompValue
        : undefined,
    priceSource:
      typeof raw.priceSource === "string" && raw.priceSource.trim()
        ? raw.priceSource.trim()
        : undefined,
    priceConfidence: sanitizePriceConfidence(raw.priceConfidence),
    priceUpdatedAt:
      typeof raw.priceUpdatedAt === "number" && Number.isFinite(raw.priceUpdatedAt)
        ? raw.priceUpdatedAt
        : undefined,
    priceNotes:
      typeof raw.priceNotes === "string" && raw.priceNotes.trim()
        ? raw.priceNotes.trim()
        : undefined,
    createdAt:
      typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt)
        ? raw.createdAt
        : Date.now(),
    isNew: typeof raw.isNew === "boolean" ? raw.isNew : true,
  };
}

function normalizeAll(rawList: unknown) {
  if (!Array.isArray(rawList)) return { items: [] as VaultItem[], repaired: false };
  const normalized = rawList.map(normalizeOne).filter(Boolean) as VaultItem[];
  const unique = ensureUniqueIds(normalized);
  const migrated = migrateMissingProfileIds(unique.items);
  return { items: migrated.items, repaired: unique.repaired || migrated.repaired };
}

function stripEphemeralForPersistence(item: VaultItem): VaultItem {
  const cleanImages = getOrderedImages(item)
    .filter((image) => {
      if (!image) return false;
      if (image.localOnly) return false;
      if (isEphemeralImageUrl(image.url)) return false;
      if (isEphemeralImageUrl(image.storageKey)) return false;
      return true;
    })
    .map((image, index) => ({
      ...image,
      order: index,
      localOnly: false,
      role: inferImageRole(index, sanitizeVaultImageRole(image.role)),
    }));

  const primary =
    cleanImages.find((image) => image.storageKey === item.primaryImageKey) ?? cleanImages[0];

  return {
    ...item,
    images: cleanImages,
    primaryImageKey: primary?.storageKey,
    imageFrontUrl:
      primary?.url ||
      (item.imageFrontUrl && !isEphemeralImageUrl(item.imageFrontUrl)
        ? item.imageFrontUrl
        : undefined),
    imageBackUrl:
      item.imageBackUrl && !isEphemeralImageUrl(item.imageBackUrl)
        ? item.imageBackUrl
        : undefined,
    imageFrontStoragePath:
      primary?.storageKey ||
      (item.imageFrontStoragePath && !isEphemeralImageUrl(item.imageFrontStoragePath)
        ? item.imageFrontStoragePath
        : undefined),
  };
}

function saveRawItems(items: VaultItem[]) {
  if (typeof window === "undefined") return;
  const safeItems = items.map((item) => stripEphemeralForPersistence(syncPrimaryFields(item)));
  window.localStorage.setItem(LS_KEY, JSON.stringify(safeItems));
}

function loadRawItems() {
  if (typeof window === "undefined") return [];
  try {
    let raw = window.localStorage.getItem(LS_KEY);
    if (!raw) {
      const legacy = window.localStorage.getItem(LEGACY_LS_KEY);
      if (legacy) {
        window.localStorage.setItem(LS_KEY, legacy);
        raw = legacy;
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const normalized = normalizeAll(parsed);
    saveRawItems(normalized.items);
    return normalized.items;
  } catch {
    return [];
  }
}

export function getAllLocalItems() {
  return loadRawItems();
}

export function getOrderedImages(item: VaultItem) {
  return dedupeAndRepairImages([...(item.images ?? [])]).sort((a, b) => a.order - b.order);
}

export function resolveVaultImageUrl(image?: VaultImage | null) {
  if (!image) return "";
  if (image.url && isDirectBrowserImageUrl(image.url)) return image.url;
  if (image.storageKey && !image.localOnly) return getVaultImagePublicUrl(image.storageKey);
  if (image.storageKey && isDirectBrowserImageUrl(image.storageKey)) return image.storageKey;
  return "";
}

export function getOrderedImageUrls(item: VaultItem) {
  const ordered = getOrderedImages(item)
    .map((image) => resolveVaultImageUrl(image))
    .filter(Boolean);

  if (ordered.length > 0) return ordered;

  const legacy = [item.imageFrontStoragePath, item.imageFrontUrl, item.imageBackUrl]
    .map((entry) => {
      if (!entry) return "";
      if (isDirectBrowserImageUrl(entry)) return entry;
      return getVaultImagePublicUrl(entry);
    })
    .filter(Boolean);

  return legacy;
}

export function getPrimaryImageUrl(item: VaultItem) {
  const ordered = getOrderedImages(item);
  if (ordered.length > 0) {
    const primary =
      ordered.find((image) => image.storageKey === item.primaryImageKey) ?? ordered[0];
    const resolved = resolveVaultImageUrl(primary);
    if (resolved) return resolved;
  }

  if (item.imageFrontStoragePath) return getVaultImagePublicUrl(item.imageFrontStoragePath);
  if (item.imageFrontUrl && isDirectBrowserImageUrl(item.imageFrontUrl)) return item.imageFrontUrl;
  if (item.imageBackUrl && isDirectBrowserImageUrl(item.imageBackUrl)) return item.imageBackUrl;
  return "";
}

function syncPrimaryFields(item: VaultItem) {
  const ordered = getOrderedImages(item);
  const primary =
    ordered.find((image) => image.storageKey === item.primaryImageKey) ?? ordered[0];

  if (!primary) {
    return {
      ...item,
      images: [],
      primaryImageKey: undefined,
      imageFrontUrl: undefined,
      imageFrontStoragePath: undefined,
    };
  }

  return {
    ...item,
    images: ordered,
    primaryImageKey: primary.storageKey,
    imageFrontUrl: resolveVaultImageUrl(primary) || item.imageFrontUrl,
    imageFrontStoragePath: primary.localOnly ? undefined : primary.storageKey,
  };
}

export function appendImage(
  item: VaultItem,
  url: string,
  storageKey?: string,
  options?: { localOnly?: boolean; role?: VaultImageRole }
) {
  const nextImages = getOrderedImages(item);
  const resolvedStorageKey = storageKey || url;

  nextImages.push({
    id: resolvedStorageKey || `image_${Date.now()}`,
    storageKey: resolvedStorageKey,
    url,
    order: nextImages.length,
    localOnly:
      options?.localOnly ?? (isEphemeralImageUrl(url) || isEphemeralImageUrl(resolvedStorageKey)),
    role: options?.role ?? (nextImages.length === 0 ? "primary" : "detail"),
  });

  return syncPrimaryFields({
    ...item,
    images: nextImages,
    primaryImageKey: item.primaryImageKey || resolvedStorageKey || url,
  });
}

export function reorderImages(item: VaultItem, fromIndex: number, toIndex: number) {
  const images = getOrderedImages(item);
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= images.length ||
    toIndex >= images.length ||
    fromIndex === toIndex
  ) {
    return item;
  }

  const next = [...images];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);

  const normalized = next.map((image, index) => ({ ...image, order: index, role: inferImageRole(index, sanitizeVaultImageRole(image.role)) }));

  return syncPrimaryFields({
    ...item,
    images: normalized,
    primaryImageKey: normalized[0]?.storageKey,
  });
}

export function deleteImageAtIndex(item: VaultItem, index: number) {
  const images = getOrderedImages(item);
  if (index < 0 || index >= images.length) return item;

  const next = images.filter((_, i) => i !== index).map((image, order) => ({ ...image, order, role: inferImageRole(order, sanitizeVaultImageRole(image.role)) }));
  return syncPrimaryFields({
    ...item,
    images: next,
    primaryImageKey: next[0]?.storageKey,
  });
}

function mergeById(localItems: VaultItem[], remoteItems: VaultItem[]) {
  const byId = new Map<string, VaultItem>();

  for (const item of localItems) {
    byId.set(String(item.id), syncPrimaryFields(item));
  }

  for (const remoteItem of remoteItems) {
    const existing = byId.get(String(remoteItem.id));

    if (!existing) {
      byId.set(String(remoteItem.id), syncPrimaryFields(remoteItem));
      continue;
    }

    const remoteHasImages =
      Array.isArray(remoteItem.images) && remoteItem.images.length > 0;

    const merged = normalizeOne({
      ...existing,
      ...remoteItem,
      images: remoteHasImages ? remoteItem.images : existing.images,
      primaryImageKey: remoteItem.primaryImageKey || existing.primaryImageKey,
      imageFrontUrl: remoteItem.imageFrontUrl || existing.imageFrontUrl,
      imageFrontStoragePath:
        remoteItem.imageFrontStoragePath || existing.imageFrontStoragePath,
      createdAt: remoteItem.createdAt || existing.createdAt,
    });

    if (merged) {
      byId.set(String(remoteItem.id), syncPrimaryFields(merged));
    }
  }

  return [...byId.values()].sort(
    (a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0)
  );
}

export async function syncVaultItemsFromSupabase() {
  if (typeof window === "undefined") return [];
  if (!hasSupabaseEnv()) return loadRawItems();

  try {
    const remoteItems = await fetchVaultItemsFromSupabase();
    const localItems = loadRawItems();
    const merged = mergeById(localItems, remoteItems);
    saveRawItems(merged);
    return merged;
  } catch {
    return loadRawItems();
  }
}

export function loadItems(options: LoadItemsOptions = {}) {
  const all = loadRawItems();
  const activeProfileId = getActiveProfileId();

  return all.filter((item) => {
    if (options.includeAllProfiles) return true;
    if (options.profileId) return item.profile_id === options.profileId;
    if (!activeProfileId) return true;
    return item.profile_id === activeProfileId;
  });
}

export function saveItems(items: VaultItem[]) {
  saveRawItems(items.map(syncPrimaryFields));
}

export function appendItems(items: VaultItem[]) {
  saveRawItems([...loadRawItems(), ...items.map(syncPrimaryFields)]);
}

export function markItemViewed(itemId: string) {
  const next = loadRawItems().map((item) =>
    String(item.id) === String(itemId) ? { ...item, isNew: false } : item
  );
  saveRawItems(next);
}

export function saveItem(item: VaultItem) {
  const normalized = syncPrimaryFields(item);
  const existing = loadRawItems();
  const idx = existing.findIndex((entry) => String(entry.id) === String(normalized.id));
  if (idx === -1) {
    saveRawItems([...existing, normalized]);
    return;
  }
  const next = [...existing];
  next[idx] = normalized;
  saveRawItems(next);
}

import { getDemoItems } from "@/lib/demoSeed";

export function seedDemoIfEmpty() {
  const existing = loadItems({ includeAllProfiles: true });

  if (!existing.length) {
    const demo = getDemoItems();
    saveItems(demo);
  }
}

export function loadItemsOrSeed(seed?: VaultItem[]) {
  const existing = loadItems({ includeAllProfiles: true });
  if (existing.length > 0) return existing;

  const safeSeed = Array.isArray(seed) ? seed.filter(Boolean).map(syncPrimaryFields) : [];
  if (safeSeed.length > 0) {
    saveItems(safeSeed);
    return loadItems({ includeAllProfiles: true });
  }

  return existing;
}


import { getStoredActiveProfileId } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { VaultImage, VaultItem } from "@/lib/vaultModel";

export const VAULT_IMAGES_BUCKET = "vault-images";
export const VAULT_ITEMS_TABLE = "vault_items";

// Supabase rows are untyped at runtime; row mappers normalize them into VaultItem.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnknownRecord = Record<string, any>;

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function isDirectBrowserImageUrl(value?: string | null) {
  if (!value) return false;
  const lower = value.toLowerCase();
  return (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("blob:") ||
    lower.startsWith("data:")
  );
}

export function isLocalOnlyImageUrl(value?: string | null) {
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower.startsWith("blob:") || lower.startsWith("data:");
}

export function getVaultImagePublicUrl(pathOrUrl?: string | null) {
  if (!pathOrUrl) return "";
  if (isDirectBrowserImageUrl(pathOrUrl)) return pathOrUrl;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return "";

  const { data } = supabase.storage.from(VAULT_IMAGES_BUCKET).getPublicUrl(pathOrUrl);
  return data?.publicUrl || "";
}

function getRequiredActiveProfileId(item?: VaultItem) {
  const activeProfileId = getStoredActiveProfileId().trim();
  const itemProfileId = String(item?.profile_id ?? "").trim();

  return activeProfileId || itemProfileId;
}

function rowToVaultImage(entry: unknown, index: number): VaultImage | null {
  const image = asRecord(entry);
  const storageKey = String(image.storageKey ?? "").trim();
  const url = String(image.url ?? "").trim();

  if (!storageKey && !url) return null;

  return {
    id: String(image.id ?? storageKey ?? url).trim() || `image_${index}`,
    storageKey: storageKey || url,
    url: url || undefined,
    order: Number.isFinite(Number(image.order)) ? Number(image.order) : index,
    localOnly: isLocalOnlyImageUrl(url),
  };
}

function rowToItem(input: unknown): VaultItem {
  const row = asRecord(input);
  const images = Array.isArray(row?.images_json)
    ? row.images_json
        .map(rowToVaultImage)
        .filter((image): image is VaultImage => Boolean(image))
    : [];

  return {
    id: String(row.id),
    profile_id: row.profile_id ?? undefined,
    universe: row.universe ?? undefined,
    category: row.category ?? undefined,
    customCategoryLabel: row.custom_category_label ?? undefined,
    categoryLabel: row.category_label ?? undefined,
    subcategoryLabel: row.subcategory_label ?? undefined,
    title: row.title,
    subtitle: row.subtitle ?? undefined,
    number: row.number ?? undefined,
    grade: row.grade ?? undefined,
    purchasePrice: row.purchase_price ?? undefined,
    purchaseTax: row.purchase_tax ?? undefined,
    purchaseShipping: row.purchase_shipping ?? undefined,
    purchaseFees: row.purchase_fees ?? undefined,
    currentValue: row.current_value ?? undefined,
    purchaseSource: row.purchase_source ?? undefined,
    purchaseLocation: row.purchase_location ?? undefined,
    orderNumber: row.order_number ?? undefined,
    imageFrontUrl: row.image_front_url ?? undefined,
    imageFrontStoragePath: row.image_front_storage_path ?? undefined,
    images,
    primaryImageKey:
      row.primary_image_key ??
      row.image_front_storage_path ??
      row.image_front_url ??
      undefined,
    notes: row.notes ?? undefined,
    storageLocation: row.storage_location ?? undefined,
    certNumber: row.cert_number ?? undefined,
    serialNumber: row.serial_number ?? undefined,
    valueSource: row.value_source ?? undefined,
    valueUpdatedAt: row.value_updated_at ?? undefined,
    valueConfidence: row.value_confidence ?? undefined,
    status: row.status ?? undefined,
    soldPrice: row.sold_price ?? undefined,
    soldAt: row.sold_at ?? undefined,
    createdAt: row.created_at ?? Date.now(),
    isNew: typeof row.is_new === "boolean" ? row.is_new : true,
  };
}

async function fetchRowsWithOptionalGallery(profileId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from(VAULT_ITEMS_TABLE)
      .select("*, images_json, primary_image_key")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  } catch {
    const { data, error } = await supabase
      .from(VAULT_ITEMS_TABLE)
      .select("*")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }
}

export async function fetchVaultItemsFromSupabase(profileId?: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const activeProfileId = String(profileId ?? getStoredActiveProfileId()).trim();
  if (!activeProfileId) return [];

  const rows = await fetchRowsWithOptionalGallery(activeProfileId);
  return rows.map(rowToItem);
}

export async function uploadVaultImageToSupabase(params: {
  itemId: string;
  file: File | Blob;
  fileName?: string;
}) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase client is not configured.");

  const ext =
    params.fileName?.split(".").pop()?.toLowerCase() ||
    ((params.file instanceof File ? params.file.type : params.file.type)?.includes("png")
      ? "png"
      : "jpg");

  const path = `items/${params.itemId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

  const { error } = await supabase.storage
    .from(VAULT_IMAGES_BUCKET)
    .upload(path, params.file, {
      cacheControl: "3600",
      upsert: false,
      contentType:
        params.file instanceof File
          ? params.file.type
          : params.file.type || "image/jpeg",
    });

  if (error) {
    throw new Error(error.message || "Failed to upload image.");
  }

  return {
    path,
    publicUrl: getVaultImagePublicUrl(path),
  };
}

export async function deleteVaultImageFromSupabase(storagePath?: string | null) {
  if (!storagePath) return;
  if (isDirectBrowserImageUrl(storagePath)) return;

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { error } = await supabase.storage.from(VAULT_IMAGES_BUCKET).remove([storagePath]);
  if (error) {
    const message = String(error.message || "");
    if (!message.toLowerCase().includes("not found")) {
      throw new Error(message || "Failed to delete image from storage.");
    }
  }
}

function sanitizeRemoteImages(images?: VaultImage[]) {
  return (images ?? [])
    .filter((image) => {
      if (!image) return false;
      if (!image.storageKey && !image.url) return false;
      if (image.url && isLocalOnlyImageUrl(image.url)) return false;
      if (image.storageKey && isLocalOnlyImageUrl(image.storageKey)) return false;
      return true;
    })
    .map((image, index) => ({
      id: image.id,
      storageKey: image.storageKey,
      url: image.url ?? null,
      order: Number.isFinite(Number(image.order)) ? Number(image.order) : index,
    }));
}

export async function upsertVaultItemToSupabase(item: VaultItem) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase client is not configured.");

  const activeProfileId = getRequiredActiveProfileId(item);
  if (!activeProfileId) {
    throw new Error("No active profile found.");
  }

  const cleanedImages = sanitizeRemoteImages(item.images);

  const primary =
    cleanedImages.find((image) => image.storageKey === item.primaryImageKey) ??
    cleanedImages[0] ??
    null;

  const safeImageFrontUrl =
    primary?.url ||
    (item.imageFrontUrl && !isLocalOnlyImageUrl(item.imageFrontUrl) ? item.imageFrontUrl : null);

  const safeImageFrontStoragePath =
    primary?.storageKey ||
    (item.imageFrontStoragePath && !isLocalOnlyImageUrl(item.imageFrontStoragePath)
      ? item.imageFrontStoragePath
      : null);

  const baseRow = {
    id: String(item.id),
    profile_id: activeProfileId,
    title: item.title,
    subtitle: item.subtitle ?? null,
    number: item.number ?? null,
    grade: item.grade ?? null,
    purchase_price: item.purchasePrice ?? null,
    purchase_tax: item.purchaseTax ?? null,
    purchase_shipping: item.purchaseShipping ?? null,
    purchase_fees: item.purchaseFees ?? null,
    current_value: item.currentValue ?? null,
    purchase_source: item.purchaseSource ?? null,
    purchase_location: item.purchaseLocation ?? null,
    order_number: item.orderNumber ?? null,
    image_front_url: safeImageFrontUrl,
    image_front_storage_path: safeImageFrontStoragePath,
    primary_image_key: primary?.storageKey || safeImageFrontStoragePath || null,
    notes: item.notes ?? null,
    storage_location: item.storageLocation ?? null,
    cert_number: item.certNumber ?? null,
    serial_number: item.serialNumber ?? null,
    value_source: item.valueSource ?? null,
    value_updated_at: item.valueUpdatedAt ?? null,
    value_confidence: item.valueConfidence ?? null,
    status: item.status ?? "COLLECTION",
    sold_price: item.soldPrice ?? null,
    sold_at: item.soldAt ?? null,
    universe: item.universe ?? null,
    category: item.category ?? null,
    custom_category_label: item.customCategoryLabel ?? null,
    category_label: item.categoryLabel ?? null,
    subcategory_label: item.subcategoryLabel ?? null,
    created_at: item.createdAt ?? Date.now(),
    is_new: item.isNew ?? true,
  };

  try {
    const { error } = await supabase.from(VAULT_ITEMS_TABLE).upsert({
      ...baseRow,
      images_json: cleanedImages,
    });

    if (error) throw error;
  } catch (error: unknown) {
    const errorRecord = asRecord(error);
    const message = String(errorRecord.message ?? "");

    console.error("vault_items upsert blocked", {
      message,
      activeProfileId,
      rowProfileId: baseRow.profile_id,
      itemId: baseRow.id,
      title: baseRow.title,
    });

    const missingGalleryColumns =
      message.toLowerCase().includes("images_json") ||
      message.toLowerCase().includes("primary_image_key");

    const missingSoldColumns =
      message.toLowerCase().includes("status") ||
      message.toLowerCase().includes("sold_price") ||
      message.toLowerCase().includes("sold_at");

    if (!missingGalleryColumns && !missingSoldColumns) {
      throw new Error(message || "Failed to save item.");
    }

    const fallbackRow = { ...baseRow } as Record<string, unknown>;

    if (missingGalleryColumns) {
      delete fallbackRow.images_json;
      delete fallbackRow.primary_image_key;
    }

    if (missingSoldColumns) {
      delete fallbackRow.status;
      delete fallbackRow.sold_price;
      delete fallbackRow.sold_at;
    }

    const { error: fallbackError } = await supabase.from(VAULT_ITEMS_TABLE).upsert(fallbackRow);
    if (fallbackError) {
      throw new Error(String(fallbackError.message || "Failed to save item."));
    }
  }
}

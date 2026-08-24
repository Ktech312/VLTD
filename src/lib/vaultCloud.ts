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
    lower.startsWith("data:") ||
    // A root-relative path ("/collectibles/guitar.png") is already
    // directly loadable by the browser too — same-origin public asset,
    // not a Supabase storage key (which never starts with "/"). Without
    // this, getPrimaryImageUrl silently returned "" for the museum's own
    // DEMO_ITEMS (which use these paths), and the one place that tried
    // absolutizing it to a full origin URL instead broke a second time —
    // the image-proxy route only allows supabase.co/supabase.in hosts, so
    // an absolutized http://localhost URL got a 400 there.
    lower.startsWith("/")
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

  // An item's OWN profile wins. Only fall back to the active profile for brand-new
  // items that don't have one yet — otherwise syncing while on a different profile
  // would reassign existing items to whatever is currently active.
  return itemProfileId || activeProfileId;
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
    itemCode: row.item_code ?? undefined,
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
    tags: Array.isArray(row.tags) ? row.tags : undefined,
    itemType: row.item_type ?? undefined,
    itemAttributes: Array.isArray(row.item_attributes) ? row.item_attributes : undefined,
    brand: row.brand ?? undefined,
    valueSource: row.value_source ?? undefined,
    valueUpdatedAt: row.value_updated_at ?? undefined,
    valueConfidence: row.value_confidence ?? undefined,
    status: row.status ?? undefined,
    soldPrice: row.sold_price ?? undefined,
    soldAt: row.sold_at ?? undefined,
    createdAt: row.created_at ?? Date.now(),
    addedVia:
      row.added_via === "scan" || row.added_via === "manual" || row.added_via === "import" || row.added_via === "wishlist"
        ? row.added_via
        : undefined,
    isNew: typeof row.is_new === "boolean" ? row.is_new : true,
    isPublic: typeof row.is_public === "boolean" ? row.is_public : false,
    askingPrice: typeof row.asking_price === "number" ? row.asking_price : undefined,
    videoClip:
      typeof row.video_clip_url === "string" && row.video_clip_url
        ? {
            url: row.video_clip_url,
            durationSeconds: typeof row.video_clip_duration === "number" ? row.video_clip_duration : 0,
          }
        : undefined,
    // Auction fields
    auctionStatus: row.auction_status ?? undefined,
    auctionEndsAt: typeof row.auction_ends_at === "number" ? row.auction_ends_at : undefined,
    auctionStartingBid: typeof row.auction_starting_bid === "number" ? row.auction_starting_bid : undefined,
    auctionCurrentBid: typeof row.auction_current_bid === "number" ? row.auction_current_bid : undefined,
    auctionBidCount: typeof row.auction_bid_count === "number" ? row.auction_bid_count : undefined,
    auctionWinnerId: typeof row.auction_winner_id === "string" ? row.auction_winner_id : undefined,
    reservePrice: typeof row.reserve_price === "number" ? row.reserve_price : undefined,
    buyItNowPrice: typeof row.buy_it_now_price === "number" ? row.buy_it_now_price : undefined,
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
      if (image.localOnly) return false;
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
    tags: item.tags ?? [],
    item_type: item.itemType ?? null,
    item_attributes: item.itemAttributes ?? [],
    brand: item.brand ?? null,
    value_source: item.valueSource ?? null,
    value_updated_at: item.valueUpdatedAt ?? null,
    value_confidence: item.valueConfidence ?? null,
    universe: item.universe ?? null,
    category: item.category ?? null,
    custom_category_label: item.customCategoryLabel ?? null,
    category_label: item.categoryLabel ?? null,
    subcategory_label: item.subcategoryLabel ?? null,
    created_at: item.createdAt ?? Date.now(),
    added_via: item.addedVia ?? null,
    is_new: item.isNew ?? true,
    is_public: item.isPublic ?? false,
    asking_price: item.askingPrice ?? null,
    video_clip_url: item.videoClip?.url ?? null,
    video_clip_duration: item.videoClip?.durationSeconds ?? null,
  } as Record<string, unknown>;

  // Do not let an older unsold local copy erase a sale made on another device.
  // Sold fields are only sent when this item explicitly has sold state.
  if (item.status) baseRow.status = item.status;
  if (item.soldPrice !== undefined) baseRow.sold_price = item.soldPrice;
  if (item.soldAt !== undefined) baseRow.sold_at = item.soldAt;

  // Auction fields — only written when present so non-auction upserts stay clean.
  if (item.auctionStatus !== undefined) baseRow.auction_status = item.auctionStatus;
  if (item.auctionEndsAt !== undefined) baseRow.auction_ends_at = item.auctionEndsAt;
  if (item.auctionStartingBid !== undefined) baseRow.auction_starting_bid = item.auctionStartingBid;
  if (item.auctionCurrentBid !== undefined) baseRow.auction_current_bid = item.auctionCurrentBid;
  if (item.auctionBidCount !== undefined) baseRow.auction_bid_count = item.auctionBidCount;
  if (item.auctionWinnerId !== undefined) baseRow.auction_winner_id = item.auctionWinnerId;
  if (item.reservePrice !== undefined) baseRow.reserve_price = item.reservePrice;
  if (item.buyItNowPrice !== undefined) baseRow.buy_it_now_price = item.buyItNowPrice;

  try {
    const { error } = await supabase.from(VAULT_ITEMS_TABLE).upsert({
      ...baseRow,
      images_json: cleanedImages,
    });

    if (error) throw error;
  } catch (error: unknown) {
    const errorRecord = asRecord(error);
    const message = String(errorRecord.message ?? "");

    const missingGalleryColumns =
      message.toLowerCase().includes("images_json") ||
      message.toLowerCase().includes("primary_image_key");

    const missingSoldColumns =
      message.toLowerCase().includes("status") ||
      message.toLowerCase().includes("sold_price") ||
      message.toLowerCase().includes("sold_at");
    const missingVisibilityColumn = message.toLowerCase().includes("is_public");
    const missingVideoColumns =
      message.toLowerCase().includes("video_clip_url") ||
      message.toLowerCase().includes("video_clip_duration");
    const missingTagsColumn = message.toLowerCase().includes("tags");
    const missingBrandColumn = message.toLowerCase().includes("brand");
    const missingAddedViaColumn = message.toLowerCase().includes("added_via");
    const missingItemTypeColumn = message.toLowerCase().includes("item_type");
    const missingItemAttributesColumn = message.toLowerCase().includes("item_attributes");

    const isRecoverable =
      missingGalleryColumns || missingSoldColumns || missingVisibilityColumn || missingVideoColumns || missingTagsColumn || missingBrandColumn || missingAddedViaColumn || missingItemTypeColumn || missingItemAttributesColumn;

    if (!isRecoverable) {
      // Unrecognised error — log and surface it
      console.error("vault_items upsert failed", {
        message,
        activeProfileId,
        rowProfileId: baseRow.profile_id,
        itemId: baseRow.id,
        title: baseRow.title,
      });
      throw new Error(message || "Failed to save item.");
    }

    // Known schema-mismatch — retry without the unsupported column(s)
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

    if (missingVisibilityColumn) {
      delete fallbackRow.is_public;
    }

    if (missingVideoColumns) {
      delete fallbackRow.video_clip_url;
      delete fallbackRow.video_clip_duration;
    }

    if (missingTagsColumn) {
      delete fallbackRow.tags;
    }

    if (missingBrandColumn) {
      delete fallbackRow.brand;
    }

    if (missingItemTypeColumn) {
      delete fallbackRow.item_type;
    }

    if (missingItemAttributesColumn) {
      delete fallbackRow.item_attributes;
    }

    if (missingAddedViaColumn) {
      delete fallbackRow.added_via;
    }

    const { error: fallbackError } = await supabase.from(VAULT_ITEMS_TABLE).upsert(fallbackRow);
    if (fallbackError) {
      console.error("vault_items fallback upsert failed", {
        message: fallbackError.message,
        itemId: baseRow.id,
        title: baseRow.title,
      });
      throw new Error(String(fallbackError.message || "Failed to save item."));
    }
  }
}

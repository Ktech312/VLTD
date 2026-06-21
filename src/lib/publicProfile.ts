"use client";

import { getProfileSafe } from "@/lib/userProfile";
import { getStoredActiveProfileId } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabaseClient";
import { getSeedAvatarUrlForProfile, isRenderableAvatarUrl } from "@/lib/seedAvatar";

const AVATAR_PRESET_SRCS: Record<string, string> = {
  key: "/avatars/presets/key.png",
  lion: "/avatars/presets/lion.png",
  dragon: "/avatars/presets/dragon.png",
  fox: "/avatars/presets/fox.png",
  eagle: "/avatars/presets/eagle.png",
  gem: "/avatars/presets/gem.png",
  orb: "/avatars/presets/orb.png",
  sword: "/avatars/presets/sword.png",
  cards: "/avatars/presets/cards.png",
  crown: "/avatars/presets/crown.png",
  vault: "/avatars/presets/vault.png",
  fire: "/avatars/presets/fire.png",
  keysmith: "/avatars/presets/keysmith.png",
  guitar: "/avatars/presets/guitar.png",
  vinyl: "/avatars/presets/vinyl.png",
  harp: "/avatars/presets/harp.png",
};

function resolveAvatarUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("__preset:")) return AVATAR_PRESET_SRCS[url.replace("__preset:", "")] ?? "";
  if (isRenderableAvatarUrl(url)) return url;
  return "";
}
import { getVaultImagePublicUrl, isDirectBrowserImageUrl, VAULT_ITEMS_TABLE } from "@/lib/vaultCloud";
import type { VaultImage, VaultItem } from "@/lib/vaultModel";

type UnknownRecord = Record<string, unknown>;

export type SocialLinks = Partial<Record<
  "instagram" | "twitter" | "tiktok" | "youtube" | "facebook" | "whatnot" | "ebay" | "website" | "linktree",
  string
>>;

export type PublicProfile = {
  profileId: string;
  displayName: string;
  avatarEmoji: string;
  avatarUrl?: string;
  bannerUrl?: string;
  bio?: string;
  socialLinks?: SocialLinks;
  /** ISO timestamp from profiles.created_at - powers "Member since" in the Bio view. */
  createdAt?: string;
};

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function optionalNumber(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
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
    localOnly: Boolean(image.localOnly),
  };
}

function publicRowToItem(input: unknown): VaultItem {
  const row = asRecord(input);
  const imageFrontUrlRaw = typeof row.image_front_url === "string" ? row.image_front_url : "";
  const imageFrontStoragePath =
    typeof row.image_front_storage_path === "string" ? row.image_front_storage_path : "";
  const images = Array.isArray(row.images_json)
    ? row.images_json.map(rowToVaultImage).filter((image): image is VaultImage => Boolean(image))
    : [];
  const primaryImageKey =
    (typeof row.primary_image_key === "string" && row.primary_image_key) ||
    imageFrontStoragePath ||
    imageFrontUrlRaw ||
    undefined;
  const imageFrontUrl =
    imageFrontUrlRaw && isDirectBrowserImageUrl(imageFrontUrlRaw)
      ? imageFrontUrlRaw
      : imageFrontStoragePath
        ? getVaultImagePublicUrl(imageFrontStoragePath)
        : images[0]?.url;

  return {
    id: String(row.id),
    profile_id: optionalString(row.profile_id),
    universe: optionalString(row.universe),
    category: optionalString(row.category),
    categoryLabel: optionalString(row.category_label),
    subcategoryLabel: optionalString(row.subcategory_label),
    title: optionalString(row.title) || "Untitled item",
    subtitle: optionalString(row.subtitle),
    number: optionalString(row.number),
    grade: optionalString(row.grade),
    purchasePrice: optionalNumber(row.purchase_price),
    currentValue: optionalNumber(row.current_value),
    imageFrontUrl,
    imageFrontStoragePath: imageFrontStoragePath || undefined,
    images,
    primaryImageKey,
    notes: optionalString(row.notes),
    storageLocation: optionalString(row.storage_location),
    certNumber: optionalString(row.cert_number),
    serialNumber: optionalString(row.serial_number),
    subject: optionalString(row.subject),
    status:
      row.status === "COLLECTION" || row.status === "FOR_SALE" || row.status === "SOLD" || row.status === "WISHLIST"
        ? row.status
        : undefined,
    createdAt: optionalNumber(row.created_at) ?? Date.now(),
    isNew: typeof row.is_new === "boolean" ? row.is_new : false,
    isPublic: typeof row.is_public === "boolean" ? row.is_public : true,
  };
}

export async function syncPublicProfile(profileId = getStoredActiveProfileId()) {
  const supabase = getSupabaseBrowserClient();
  const cleanProfileId = String(profileId ?? "").trim();
  if (!supabase || !cleanProfileId) return null;

  // Fetch full profile row to check is_public and get bio
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("is_public, bio, display_name, username, avatar_url")
    .eq("id", cleanProfileId)
    .maybeSingle();

  // If the user has gone incognito, remove from public_profiles
  if (profileRow && profileRow.is_public === false) {
    await supabase.from("public_profiles").delete().eq("profile_id", cleanProfileId);
    return null;
  }

  const profile = getProfileSafe();
  function validName(s?: string | null) {
    const t = s?.trim() ?? "";
    return t && t.toLowerCase() !== "user" ? t : "";
  }
  const payload: Record<string, unknown> = {
    profile_id: cleanProfileId,
    display_name: validName(profile.displayName) || validName(profile.username) || "Collector",
    avatar_emoji: profile.avatarEmoji?.trim() || "🗝️",
    updated_at: new Date().toISOString(),
  };

  if (profileRow?.bio) {
    payload.bio = profileRow.bio;
  }

  const resolvedAvatar = resolveAvatarUrl(profileRow?.avatar_url);
  if (resolvedAvatar) {
    payload.avatar_url = resolvedAvatar;
  }

  const { data, error } = await supabase
    .from("public_profiles")
    .upsert(payload, { onConflict: "profile_id" })
    .select("*")
    .single();

  if (error) throw new Error(error.message || "Failed to sync public profile.");
  return data;
}

export async function fetchPublicProfile(profileId: string): Promise<PublicProfile | null> {
  const supabase = getSupabaseBrowserClient();
  const cleanProfileId = String(profileId ?? "").trim();
  if (!supabase || !cleanProfileId) return null;

  const [{ data, error }, { data: profileRow }] = await Promise.all([
    supabase
      .from("public_profiles")
      .select("profile_id, display_name, avatar_emoji, avatar_url, bio")
      .eq("profile_id", cleanProfileId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("social_links, bio, avatar_url, banner_url, display_name, created_at")
      .eq("id", cleanProfileId)
      .maybeSingle(),
  ]);

  if (error) throw new Error(error.message || "Failed to load public profile.");

  // Fall back to profiles table if no public_profiles row exists
  if (!data && !profileRow) return null;

  function sanitizeName(s: unknown) {
    const t = typeof s === "string" ? s.trim() : "";
    return t && t.toLowerCase() !== "user" ? t : "";
  }
  const displayName = sanitizeName(data?.display_name) || sanitizeName(profileRow?.display_name) || "Collector";
  const bio = typeof profileRow?.bio === "string" && profileRow.bio
    ? profileRow.bio
    : (typeof data?.bio === "string" && data.bio ? data.bio : undefined);

  const profileAvatarUrl = resolveAvatarUrl(profileRow?.avatar_url);
  const publicAvatarUrl = resolveAvatarUrl(data?.avatar_url);
  const seedAvatarUrl = getSeedAvatarUrlForProfile({ profileId: cleanProfileId, displayName });
  const avatarUrl = profileAvatarUrl || publicAvatarUrl || seedAvatarUrl;

  return {
    profileId: cleanProfileId,
    displayName,
    avatarEmoji: String(data?.avatar_emoji || "🗝️"),
    avatarUrl: avatarUrl || undefined,
    bannerUrl: typeof profileRow?.banner_url === "string" && profileRow.banner_url ? profileRow.banner_url : undefined,
    bio,
    socialLinks: (profileRow?.social_links as SocialLinks) ?? undefined,
    createdAt: typeof profileRow?.created_at === "string" ? profileRow.created_at : undefined,
  };
}

export async function fetchPublicVaultItems(profileId: string): Promise<VaultItem[]> {
  const supabase = getSupabaseBrowserClient();
  const cleanProfileId = String(profileId ?? "").trim();
  if (!supabase || !cleanProfileId) return [];

  const { data, error } = await supabase
    .from(VAULT_ITEMS_TABLE)
    .select("*, images_json, primary_image_key")
    .eq("profile_id", cleanProfileId)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message || "Failed to load public vault.");
  return (data ?? []).map(r => publicRowToItem(r) as MarketItem);
}

export type PublicGallery = {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  itemCount: number;
  views: number;
  visibility: string;
  /** Count of Exhibits (sections) within this Exhibition - powers the Bio view's totals. */
  exhibitsCount: number;
  /** featuredItemId values across this gallery's sections - powers the Bio view's highlight reel. */
  featuredItemIds: string[];
};

export async function fetchPublicGalleriesForProfile(profileId: string): Promise<PublicGallery[]> {
  const supabase = getSupabaseBrowserClient();
  const cleanProfileId = String(profileId ?? "").trim();
  if (!supabase || !cleanProfileId) return [];

  const { data, error } = await supabase
    .from("galleries")
    .select("id, title, description, cover_image, layout, analytics, visibility, sections, exhibition_layout")
    .eq("profile_id", cleanProfileId)
    .neq("visibility", "LOCKED")
    .order("created_at", { ascending: false });

  if (error) return [];

  return (data ?? []).map((row) => {
    const layout = typeof row.layout === "object" && row.layout ? row.layout as Record<string, unknown> : {};
    const itemIds = Array.isArray(layout.itemIds) ? layout.itemIds : [];
    const analytics = typeof row.analytics === "object" && row.analytics ? row.analytics as Record<string, unknown> : {};

    // Sections may live directly on the row or nested under exhibition_layout - same
    // fallback the builder uses (chooseSectionSource), just inlined for a lightweight count.
    const directSections = Array.isArray(row.sections) ? row.sections : [];
    const exhibitionLayout = typeof row.exhibition_layout === "object" && row.exhibition_layout
      ? row.exhibition_layout as Record<string, unknown>
      : {};
    const layoutSections = Array.isArray(exhibitionLayout.sections) ? exhibitionLayout.sections : [];
    const sections = directSections.length > 0 ? directSections : layoutSections;
    const featuredItemIds = sections
      .map((s) => (s && typeof s === "object" ? (s as Record<string, unknown>).featuredItemId : undefined))
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    return {
      id: String(row.id),
      title: String(row.title || "Untitled Gallery"),
      description: typeof row.description === "string" && row.description ? row.description : undefined,
      coverImage: typeof row.cover_image === "string" && row.cover_image ? row.cover_image : undefined,
      itemCount: itemIds.length,
      views: typeof analytics.views === "number" ? analytics.views : 0,
      visibility: String(row.visibility || "PUBLIC"),
      exhibitsCount: sections.length,
      featuredItemIds,
    };
  });
}

export function getPublicVaultUrl(profileId = getStoredActiveProfileId()) {
  const cleanProfileId = String(profileId ?? "").trim();
  if (!cleanProfileId) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/v/${encodeURIComponent(cleanProfileId)}`;
}

export type MarketItem = VaultItem & {
  sellerProfileId: string;
  sellerDisplayName?: string;
  sellerAvatarEmoji?: string;
};

export async function fetchMarketItems(opts?: {
  universe?: string;
  limit?: number;
}): Promise<MarketItem[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  let query = supabase
    .from(VAULT_ITEMS_TABLE)
    .select("*, images_json, primary_image_key")
    .eq("status", "FOR_SALE")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 120);

  if (opts?.universe) query = query.eq("universe", opts.universe);

  const { data, error } = await query;
  if (error) throw new Error(error.message || "Failed to load market.");

  return (data ?? []).map(r => publicRowToItem(r) as MarketItem);
}

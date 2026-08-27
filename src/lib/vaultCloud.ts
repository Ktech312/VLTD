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
    // Core fields that existed on VaultItem/in local storage but had no
    // Supabase column until the 2026-08-27 full-field-sync migration.
    year: row.year ?? undefined,
    condition: row.condition ?? undefined,
    conditionReason: row.condition_reason ?? undefined,
    conditionSource:
      row.condition_source === "ai" || row.condition_source === "manual" ? row.condition_source : undefined,
    imageBackUrl: row.image_back_url ?? undefined,
    subject: row.subject ?? undefined,
    edition: row.edition ?? undefined,
    variant: row.variant ?? undefined,
    printRun: row.print_run ?? undefined,
    isFirstEdition: typeof row.is_first_edition === "boolean" ? row.is_first_edition : undefined,
    estimatedValue: row.estimated_value ?? undefined,
    lastCompValue: row.last_comp_value ?? undefined,
    valueLow: row.value_low ?? undefined,
    valueMedian: row.value_median ?? undefined,
    valueHigh: row.value_high ?? undefined,
    comparables: Array.isArray(row.comparables) ? row.comparables : undefined,
    priceSources: Array.isArray(row.price_sources) ? row.price_sources : undefined,
    priceSource: row.price_source ?? undefined,
    priceConfidence: row.price_confidence ?? undefined,
    priceUpdatedAt: row.price_updated_at ?? undefined,
    priceNotes: row.price_notes ?? undefined,
    // TCG
    tcgParallelType: row.tcg_parallel_type ?? undefined,
    tcgSetCode: row.tcg_set_code ?? undefined,
    tcgHoloType: row.tcg_holo_type ?? undefined,
    tcgRarity: row.tcg_rarity ?? undefined,
    tcgLanguage: row.tcg_language ?? undefined,
    tcgGradingCompany: row.tcg_grading_company ?? undefined,
    // Sports
    sportsParallelType: row.sports_parallel_type ?? undefined,
    sportsIsRelic: typeof row.sports_is_relic === "boolean" ? row.sports_is_relic : undefined,
    sportsRelicDescription: row.sports_relic_description ?? undefined,
    sportsIsAuto: typeof row.sports_is_auto === "boolean" ? row.sports_is_auto : undefined,
    sportsSerialNumber: row.sports_serial_number ?? undefined,
    sportsSport: row.sports_sport ?? undefined,
    sportsTeam: row.sports_team ?? undefined,
    sportsGradingCompany: row.sports_grading_company ?? undefined,
    sportsPop: row.sports_pop ?? undefined,
    sportsAutoAuth: row.sports_auto_auth ?? undefined,
    // Vinyl / Music
    vinylPressing: row.vinyl_pressing ?? undefined,
    vinylLabel: row.vinyl_label ?? undefined,
    vinylMatrix: row.vinyl_matrix ?? undefined,
    vinylSpeedRpm: row.vinyl_speed_rpm ?? undefined,
    vinylColor: row.vinyl_color ?? undefined,
    vinylCountry: row.vinyl_country ?? undefined,
    vinylSleeveCondition: row.vinyl_sleeve_condition ?? undefined,
    vinylInserts: typeof row.vinyl_inserts === "boolean" ? row.vinyl_inserts : undefined,
    vinylGatefold: typeof row.vinyl_gatefold === "boolean" ? row.vinyl_gatefold : undefined,
    // Comics
    comicIssueNumber: row.comic_issue_number ?? undefined,
    comicCoverVariant: row.comic_cover_variant ?? undefined,
    comicArcTitle: row.comic_arc_title ?? undefined,
    comicPublisher: row.comic_publisher ?? undefined,
    comicCoverDate: row.comic_cover_date ?? undefined,
    comicGradingCompany: row.comic_grading_company ?? undefined,
    comicPageQuality: row.comic_page_quality ?? undefined,
    comicRestorationStatus: row.comic_restoration_status ?? undefined,
    comicHolderType: row.comic_holder_type ?? undefined,
    comicCensusRank: row.comic_census_rank ?? undefined,
    // Original Comic Art / Art & Prints
    artPenciller: row.art_penciller ?? undefined,
    artInker: row.art_inker ?? undefined,
    artColorist: row.art_colorist ?? undefined,
    artType: row.art_type ?? undefined,
    artFirstAppearance: row.art_first_appearance ?? undefined,
    artMedium: row.art_medium ?? undefined,
    artSurface: row.art_surface ?? undefined,
    artHeight: row.art_height ?? undefined,
    artWidth: row.art_width ?? undefined,
    artDepth: row.art_depth ?? undefined,
    artIsFramed: typeof row.art_is_framed === "boolean" ? row.art_is_framed : undefined,
    artIsSigned: typeof row.art_is_signed === "boolean" ? row.art_is_signed : undefined,
    artSignatureLocation: row.art_signature_location ?? undefined,
    artProvenance: row.art_provenance ?? undefined,
    artExhibitions: row.art_exhibitions ?? undefined,
    // Toys
    toyBrand: row.toy_brand ?? undefined,
    toyLine: row.toy_line ?? undefined,
    toyScale: row.toy_scale ?? undefined,
    toyPackageCondition: row.toy_package_condition ?? undefined,
    toyBoxIncluded: typeof row.toy_box_included === "boolean" ? row.toy_box_included : undefined,
    toyAccessoriesIncluded:
      typeof row.toy_accessories_included === "boolean" ? row.toy_accessories_included : undefined,
    toyIsComplete: typeof row.toy_is_complete === "boolean" ? row.toy_is_complete : undefined,
    // Art Cards
    artCardArtist: row.art_card_artist ?? undefined,
    artCardSet: row.art_card_set ?? undefined,
    artCardType: row.art_card_type ?? undefined,
    // Memorabilia
    memorabiliaTeam: row.memorabilia_team ?? undefined,
    memorabiliaEvent: row.memorabilia_event ?? undefined,
    memorabiliaSigningDate: row.memorabilia_signing_date ?? undefined,
    memorabiliaWitnessed: typeof row.memorabilia_witnessed === "boolean" ? row.memorabilia_witnessed : undefined,
    memorabiliaAuthCompany: row.memorabilia_auth_company ?? undefined,
    memorabiliaGameUsed: typeof row.memorabilia_game_used === "boolean" ? row.memorabilia_game_used : undefined,
    memorabiliaGameUsedDesc: row.memorabilia_game_used_desc ?? undefined,
    // Watches
    watchBrand: row.watch_brand ?? undefined,
    watchReference: row.watch_reference ?? undefined,
    watchMovement: row.watch_movement ?? undefined,
    watchCaseMaterial: row.watch_case_material ?? undefined,
    watchCaseSize: row.watch_case_size ?? undefined,
    watchDialColor: row.watch_dial_color ?? undefined,
    watchBox: typeof row.watch_box === "boolean" ? row.watch_box : undefined,
    watchPapers: typeof row.watch_papers === "boolean" ? row.watch_papers : undefined,
    watchFullSet: typeof row.watch_full_set === "boolean" ? row.watch_full_set : undefined,
    // Bags / Handbags
    bagBrand: row.bag_brand ?? undefined,
    bagColor: row.bag_color ?? undefined,
    bagMaterial: row.bag_material ?? undefined,
    bagHardware: row.bag_hardware ?? undefined,
    bagAuthCard: typeof row.bag_auth_card === "boolean" ? row.bag_auth_card : undefined,
    bagDustbag: typeof row.bag_dustbag === "boolean" ? row.bag_dustbag : undefined,
    bagBox: typeof row.bag_box === "boolean" ? row.bag_box : undefined,
    // Apparel / Streetwear
    apparelSize: row.apparel_size ?? undefined,
    apparelColorway: row.apparel_colorway ?? undefined,
    apparelWorn: typeof row.apparel_worn === "boolean" ? row.apparel_worn : undefined,
    // Coins & Currency
    coinDenomination: row.coin_denomination ?? undefined,
    coinCountry: row.coin_country ?? undefined,
    coinMint: row.coin_mint ?? undefined,
    coinMintMark: row.coin_mint_mark ?? undefined,
    coinGradingCompany: row.coin_grading_company ?? undefined,
    coinPopulation: row.coin_population ?? undefined,
    coinError: row.coin_error ?? undefined,
    coinKeyDate: typeof row.coin_key_date === "boolean" ? row.coin_key_date : undefined,
    // Games
    gamePlatform: row.game_platform ?? undefined,
    gameRegion: row.game_region ?? undefined,
    gameGradingCompany: row.game_grading_company ?? undefined,
    gameIsSealed: typeof row.game_is_sealed === "boolean" ? row.game_is_sealed : undefined,
    gameIsCIB: typeof row.game_is_cib === "boolean" ? row.game_is_cib : undefined,
    gameHasManual: typeof row.game_has_manual === "boolean" ? row.game_has_manual : undefined,
    gamePublisher: row.game_publisher ?? undefined,
    consoleControllerCount: row.console_controller_count ?? undefined,
    consoleCables: typeof row.console_cables === "boolean" ? row.console_cables : undefined,
    consoleBox: typeof row.console_box === "boolean" ? row.console_box : undefined,
    consoleTested: typeof row.console_tested === "boolean" ? row.console_tested : undefined,
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
    // Core fields that existed on VaultItem/in local storage but had no
    // Supabase column until the 2026-08-27 full-field-sync migration.
    year: item.year ?? null,
    condition: item.condition ?? null,
    condition_reason: item.conditionReason ?? null,
    condition_source: item.conditionSource ?? null,
    image_back_url: item.imageBackUrl ?? null,
    subject: item.subject ?? null,
    edition: item.edition ?? null,
    variant: item.variant ?? null,
    print_run: item.printRun ?? null,
    is_first_edition: item.isFirstEdition ?? null,
    estimated_value: item.estimatedValue ?? null,
    last_comp_value: item.lastCompValue ?? null,
    value_low: item.valueLow ?? null,
    value_median: item.valueMedian ?? null,
    value_high: item.valueHigh ?? null,
    comparables: item.comparables ?? null,
    price_sources: item.priceSources ?? null,
    price_source: item.priceSource ?? null,
    price_confidence: item.priceConfidence ?? null,
    price_updated_at: item.priceUpdatedAt ?? null,
    price_notes: item.priceNotes ?? null,
    // TCG
    tcg_parallel_type: item.tcgParallelType ?? null,
    tcg_set_code: item.tcgSetCode ?? null,
    tcg_holo_type: item.tcgHoloType ?? null,
    tcg_rarity: item.tcgRarity ?? null,
    tcg_language: item.tcgLanguage ?? null,
    tcg_grading_company: item.tcgGradingCompany ?? null,
    // Sports
    sports_parallel_type: item.sportsParallelType ?? null,
    sports_is_relic: item.sportsIsRelic ?? null,
    sports_relic_description: item.sportsRelicDescription ?? null,
    sports_is_auto: item.sportsIsAuto ?? null,
    sports_serial_number: item.sportsSerialNumber ?? null,
    sports_sport: item.sportsSport ?? null,
    sports_team: item.sportsTeam ?? null,
    sports_grading_company: item.sportsGradingCompany ?? null,
    sports_pop: item.sportsPop ?? null,
    sports_auto_auth: item.sportsAutoAuth ?? null,
    // Vinyl / Music
    vinyl_pressing: item.vinylPressing ?? null,
    vinyl_label: item.vinylLabel ?? null,
    vinyl_matrix: item.vinylMatrix ?? null,
    vinyl_speed_rpm: item.vinylSpeedRpm ?? null,
    vinyl_color: item.vinylColor ?? null,
    vinyl_country: item.vinylCountry ?? null,
    vinyl_sleeve_condition: item.vinylSleeveCondition ?? null,
    vinyl_inserts: item.vinylInserts ?? null,
    vinyl_gatefold: item.vinylGatefold ?? null,
    // Comics
    comic_issue_number: item.comicIssueNumber ?? null,
    comic_cover_variant: item.comicCoverVariant ?? null,
    comic_arc_title: item.comicArcTitle ?? null,
    comic_publisher: item.comicPublisher ?? null,
    comic_cover_date: item.comicCoverDate ?? null,
    comic_grading_company: item.comicGradingCompany ?? null,
    comic_page_quality: item.comicPageQuality ?? null,
    comic_restoration_status: item.comicRestorationStatus ?? null,
    comic_holder_type: item.comicHolderType ?? null,
    comic_census_rank: item.comicCensusRank ?? null,
    // Original Comic Art / Art & Prints
    art_penciller: item.artPenciller ?? null,
    art_inker: item.artInker ?? null,
    art_colorist: item.artColorist ?? null,
    art_type: item.artType ?? null,
    art_first_appearance: item.artFirstAppearance ?? null,
    art_medium: item.artMedium ?? null,
    art_surface: item.artSurface ?? null,
    art_height: item.artHeight ?? null,
    art_width: item.artWidth ?? null,
    art_depth: item.artDepth ?? null,
    art_is_framed: item.artIsFramed ?? null,
    art_is_signed: item.artIsSigned ?? null,
    art_signature_location: item.artSignatureLocation ?? null,
    art_provenance: item.artProvenance ?? null,
    art_exhibitions: item.artExhibitions ?? null,
    // Toys
    toy_brand: item.toyBrand ?? null,
    toy_line: item.toyLine ?? null,
    toy_scale: item.toyScale ?? null,
    toy_package_condition: item.toyPackageCondition ?? null,
    toy_box_included: item.toyBoxIncluded ?? null,
    toy_accessories_included: item.toyAccessoriesIncluded ?? null,
    toy_is_complete: item.toyIsComplete ?? null,
    // Art Cards
    art_card_artist: item.artCardArtist ?? null,
    art_card_set: item.artCardSet ?? null,
    art_card_type: item.artCardType ?? null,
    // Memorabilia
    memorabilia_team: item.memorabiliaTeam ?? null,
    memorabilia_event: item.memorabiliaEvent ?? null,
    memorabilia_signing_date: item.memorabiliaSigningDate ?? null,
    memorabilia_witnessed: item.memorabiliaWitnessed ?? null,
    memorabilia_auth_company: item.memorabiliaAuthCompany ?? null,
    memorabilia_game_used: item.memorabiliaGameUsed ?? null,
    memorabilia_game_used_desc: item.memorabiliaGameUsedDesc ?? null,
    // Watches
    watch_brand: item.watchBrand ?? null,
    watch_reference: item.watchReference ?? null,
    watch_movement: item.watchMovement ?? null,
    watch_case_material: item.watchCaseMaterial ?? null,
    watch_case_size: item.watchCaseSize ?? null,
    watch_dial_color: item.watchDialColor ?? null,
    watch_box: item.watchBox ?? null,
    watch_papers: item.watchPapers ?? null,
    watch_full_set: item.watchFullSet ?? null,
    // Bags / Handbags
    bag_brand: item.bagBrand ?? null,
    bag_color: item.bagColor ?? null,
    bag_material: item.bagMaterial ?? null,
    bag_hardware: item.bagHardware ?? null,
    bag_auth_card: item.bagAuthCard ?? null,
    bag_dustbag: item.bagDustbag ?? null,
    bag_box: item.bagBox ?? null,
    // Apparel / Streetwear
    apparel_size: item.apparelSize ?? null,
    apparel_colorway: item.apparelColorway ?? null,
    apparel_worn: item.apparelWorn ?? null,
    // Coins & Currency
    coin_denomination: item.coinDenomination ?? null,
    coin_country: item.coinCountry ?? null,
    coin_mint: item.coinMint ?? null,
    coin_mint_mark: item.coinMintMark ?? null,
    coin_grading_company: item.coinGradingCompany ?? null,
    coin_population: item.coinPopulation ?? null,
    coin_error: item.coinError ?? null,
    coin_key_date: item.coinKeyDate ?? null,
    // Games
    game_platform: item.gamePlatform ?? null,
    game_region: item.gameRegion ?? null,
    game_grading_company: item.gameGradingCompany ?? null,
    game_is_sealed: item.gameIsSealed ?? null,
    game_is_cib: item.gameIsCIB ?? null,
    game_has_manual: item.gameHasManual ?? null,
    game_publisher: item.gamePublisher ?? null,
    console_controller_count: item.consoleControllerCount ?? null,
    console_cables: item.consoleCables ?? null,
    console_box: item.consoleBox ?? null,
    console_tested: item.consoleTested ?? null,
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

  // PostgREST reports one missing column per error, formatted as e.g.
  // "Could not find the 'foo_bar' column of 'vault_items' in the schema
  // cache". Rather than hardcode a check per known-missing column (this
  // list was already 9 special cases and growing every time a new field
  // shipped in code before its migration was run), strip whichever single
  // column the error names and retry — self-healing against ANY column
  // that hasn't been migrated yet, present or future. A genuinely
  // unrecognised error (no column name in the message, or a name we didn't
  // send) still throws immediately.
  let row: Record<string, unknown> = { ...baseRow, images_json: cleanedImages };
  const droppedColumns: string[] = [];

  for (let attempt = 0; attempt < 150; attempt++) {
    const { error } = await supabase.from(VAULT_ITEMS_TABLE).upsert(row);
    if (!error) {
      if (droppedColumns.length) {
        console.warn(
          "vault_items upsert: dropped column(s) missing from the database — run the pending migration",
          { droppedColumns, itemId: baseRow.id }
        );
      }
      return;
    }

    const message = String(error.message ?? "");
    const missingColumn = message.match(/'([a-zA-Z0-9_]+)' column/)?.[1];

    if (!missingColumn || !(missingColumn in row)) {
      console.error("vault_items upsert failed", {
        message,
        activeProfileId,
        rowProfileId: baseRow.profile_id,
        itemId: baseRow.id,
        title: baseRow.title,
      });
      throw new Error(message || "Failed to save item.");
    }

    const nextRow = { ...row };
    delete nextRow[missingColumn];
    row = nextRow;
    droppedColumns.push(missingColumn);
  }

  throw new Error("Failed to save item: too many unsupported columns.");
}

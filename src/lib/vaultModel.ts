import {
  fetchVaultItemsDelta,
  getVaultImagePublicUrl,
  hasSupabaseEnv,
  isDirectBrowserImageUrl,
} from "@/lib/vaultCloud";
import {
  getVaultLocalSignature,
  isVaultLocalRepaired,
  markVaultLocalRepaired,
  readVaultLocalJson,
  writeVaultLocalJson,
} from "@/lib/vaultLocalStore";
import { resolvePrivateImageUrlSync } from "@/lib/privatePhotos";
import { stillSignedInAs, storedSessionUserId } from "@/lib/sessionGuard";
import { newId } from "@/lib/id";
import {
  normalizeComparables,
  normalizePriceSources,
  type PriceComparable,
  type PricingSource,
} from "@/lib/pricingMvp";

export type PriceConfidence = "low" | "medium" | "high";
export type VaultImageRole = "primary" | "detail" | "proof";

export type VaultImage = {
  id: string;
  storageKey: string;
  url?: string;
  order: number;
  localOnly?: boolean;
  role?: VaultImageRole;
  /** Private Photos (paid feature) — storageKey lives in vault-images-private
   *  (needs a signed URL) instead of the default public vault-images bucket.
   *  See src/lib/privatePhotos.ts. */
  isPrivateStorage?: boolean;
  /** "snapshot" = a smaller, lower-quality copy saved when a photo that was only
   *  linked from another site (eBay, Whatnot...) got edited. */
  quality?: "snapshot";
  /** Where the full-quality original lives (the link it replaced), so it can be
   *  upgraded to a full-quality stored copy later. */
  sourceUrl?: string;
};

export type VaultItem = {
  id: string;
  profile_id?: string;
  /** Permanent internal tracking code, e.g. "260312-0001-000142". Assigned by
   *  the database; never edited by the client. */
  itemCode?: string;
  universe?: string;
  category?: string;
  customCategoryLabel?: string;
  categoryLabel?: string;
  subcategoryLabel?: string;
  title: string;
  subtitle?: string;
  number?: string;
  year?: string;
  grade?: string;
  condition?: string;
  conditionReason?: string;
  conditionSource?: "ai" | "manual";
  purchasePrice?: number;
  purchaseTax?: number;
  purchaseShipping?: number;
  purchaseFees?: number;
  currentValue?: number;
  askingPrice?: number;
  // Auction
  auctionStatus?: "ACTIVE" | "ENDED" | "CANCELLED";
  reservePrice?: number;
  buyItNowPrice?: number;
  auctionEndsAt?: number; // unix ms
  auctionStartingBid?: number;
  auctionCurrentBid?: number;
  auctionBidCount?: number;
  auctionWinnerId?: string;
  purchaseSource?: string;
  purchaseLocation?: string;
  orderNumber?: string;
  imageFrontUrl?: string;
  imageBackUrl?: string;
  imageFrontStoragePath?: string;
  images?: VaultImage[];
  primaryImageKey?: string;
  notes?: string;
  /** Public description shown when the item is shared. Separate from `notes`, which stays private. */
  description?: string;
  storageLocation?: string;
  certNumber?: string;
  serialNumber?: string;
  /** Free-form user tags — used for the cross-category search/Halls builder
   *  and for social-export hashtag suggestions. Stored lowercase, no "#". */
  tags?: string[];
  subject?: string;
  /** Manufacturer/publisher/label — Nintendo, Marvel, DC, Topps, a record
   *  label, etc. Distinct from `subject` (who/what the item is ABOUT — a
   *  player, character, artist) — this is who MADE it. Universal across
   *  universes on purpose: a video game's box and a comic's indicia both
   *  have one, and it was previously only captured per-universe
   *  (comicPublisher/vinylLabel below) or not at all. */
  brand?: string;
  edition?: string;
  variant?: string;
  printRun?: string;
  isFirstEdition?: boolean;
  valueSource?: string;
  valueUpdatedAt?: number;
  valueConfidence?: number;
  estimatedValue?: number;
  lastCompValue?: number;
  valueLow?: number;
  valueMedian?: number;
  valueHigh?: number;
  comparables?: PriceComparable[];
  priceSources?: PricingSource[];
  priceSource?: string;
  priceConfidence?: PriceConfidence;
  priceUpdatedAt?: number;
  priceNotes?: string;
  status?: "COLLECTION" | "FOR_SALE" | "SOLD" | "WISHLIST" | "AUCTION";
  soldPrice?: number;
  soldAt?: number;
  /** Where it sold, as typed ("eBay", "Whatnot", "in person"...). Drives the Sold page fee estimate. */
  soldPlatform?: string;
  createdAt?: number;
  /** How this item actually entered the vault — real provenance, not a
   *  guess. "scan" only when an AI photo-identify actually ran and its
   *  result was kept; "manual" for hand-typed entry (including via a scan
   *  flow the user didn't use); "import" for CSV/spreadsheet; "wishlist"
   *  for a wishlist→vault conversion; "catalog" when added from a catalog
   *  listing (Upcoming Comics "Own") with its stock cover and details.
   *  undefined = predates this field. */
  addedVia?: "scan" | "manual" | "import" | "wishlist" | "catalog";
  /** Catalog this item was added from, "source:id" (e.g. "metron:181794"). */
  catalogRef?: string;
  isNew?: boolean;
  isPublic?: boolean;
  /** Public pages only: stands in for an item the owner has hidden (shows as "Hidden Item"). */
  hiddenItem?: boolean;
  // TCG-specific
  tcgParallelType?: string;
  tcgSetCode?: string;
  tcgHoloType?: string;
  // Sports-specific
  sportsParallelType?: string;
  sportsIsRelic?: boolean;
  sportsRelicDescription?: string;
  sportsIsAuto?: boolean;
  sportsSerialNumber?: string;
  // Vinyl / Music-specific
  vinylPressing?: string;
  vinylLabel?: string;
  vinylMatrix?: string;
  vinylSpeedRpm?: string;
  vinylColor?: string;
  // Comics-specific
  comicIssueNumber?: string;
  comicCoverVariant?: string;
  comicArcTitle?: string;
  comicPublisher?: string;
  comicCoverDate?: string;
  comicGradingCompany?: string;
  comicPageQuality?: string;
  comicRestorationStatus?: string;
  comicHolderType?: string;
  comicCensusRank?: string;
  // Original Comic Art (also used under Art & Prints)
  artPenciller?: string;
  artInker?: string;
  artColorist?: string;
  artType?: string;
  artFirstAppearance?: string;
  // Toys
  toyBrand?: string;
  toyLine?: string;
  toyScale?: string;
  toyPackageCondition?: string;
  toyBoxIncluded?: boolean;
  toyAccessoriesIncluded?: boolean;
  toyIsComplete?: boolean;
  // Art Cards
  artCardArtist?: string;
  artCardSet?: string;
  artCardType?: string;
  // Sports additions
  sportsSport?: string;
  sportsTeam?: string;
  sportsGradingCompany?: string;
  sportsPop?: string;
  sportsAutoAuth?: string;
  // Memorabilia
  memorabiliaTeam?: string;
  memorabiliaEvent?: string;
  memorabiliaSigningDate?: string;
  memorabiliaWitnessed?: boolean;
  memorabiliaAuthCompany?: string;
  memorabiliaGameUsed?: boolean;
  memorabiliaGameUsedDesc?: string;
  // TCG additions
  tcgRarity?: string;
  tcgLanguage?: string;
  tcgGradingCompany?: string;
  // Watches
  watchBrand?: string;
  watchReference?: string;
  watchMovement?: string;
  watchCaseMaterial?: string;
  watchCaseSize?: string;
  watchDialColor?: string;
  watchBox?: boolean;
  watchPapers?: boolean;
  watchFullSet?: boolean;
  // Bags / Handbags
  bagBrand?: string;
  bagColor?: string;
  bagMaterial?: string;
  bagHardware?: string;
  bagAuthCard?: boolean;
  bagDustbag?: boolean;
  bagBox?: boolean;
  // Apparel / Streetwear
  apparelSize?: string;
  apparelColorway?: string;
  apparelWorn?: boolean;
  // Vinyl / Music additions
  vinylCountry?: string;
  vinylSleeveCondition?: string;
  vinylInserts?: boolean;
  vinylGatefold?: boolean;
  // Art & Prints (Fine Art)
  artMedium?: string;
  artSurface?: string;
  artHeight?: string;
  artWidth?: string;
  artDepth?: string;
  artIsFramed?: boolean;
  artIsSigned?: boolean;
  artSignatureLocation?: string;
  artProvenance?: string;
  artExhibitions?: string;
  // Coins & Currency
  coinDenomination?: string;
  coinCountry?: string;
  coinMint?: string;
  coinMintMark?: string;
  coinGradingCompany?: string;
  coinPopulation?: string;
  coinError?: string;
  coinKeyDate?: boolean;
  // Games
  gamePlatform?: string;
  gameRegion?: string;
  gameGradingCompany?: string;
  gameIsSealed?: boolean;
  gameIsCIB?: boolean;
  gameHasManual?: boolean;
  gamePublisher?: string;
  consoleControllerCount?: string;
  consoleCables?: boolean;
  consoleBox?: boolean;
  consoleTested?: boolean;
  // Video clip (beta, paid feature)
  videoClip?: {
    url: string;
    durationSeconds: number;
  };
  // Universal taxonomy extras (Type dropdown + Attributes checkboxes)
  itemType?: string;
  itemAttributes?: string[];
  /** Category-specific details that have no field of their own (material, catalog number, dimensions...), keyed by a stable id
   *  from src/lib/detailFields.ts. Values are plain text; "unknown" is simply absent. */
  specs?: Record<string, string>;
};

type LoadItemsOptions = {
  profileId?: string;
  includeAllProfiles?: boolean;
};

// Local storage imports are intentionally loose because old app versions stored varied shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnknownRecord = Record<string, any>;

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

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
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

/** Generic string-array sanitizer -- drops non-strings/empties, trims, keeps
 *  original casing (unlike normalizeTags) since callers like itemAttributes
 *  need to match taxonomy checkbox labels exactly. */
function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
  return out.length ? out : undefined;
}

/** The category-specific details kept in `item.specs`: plain text values by id. An empty set is kept as {} (it is how a cleared set
 *  reaches the cloud); anything that is not text is dropped. */
export function normalizeSpecs(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!key || typeof raw !== "string") continue;
    const text = raw.trim();
    if (text) out[key] = text;
  }
  return out;
}

/** Lowercase, trim, drop empties/dupes, strip a leading "#" (users may paste
 *  hashtag-style). Order preserved (first-seen wins). */
export function normalizeTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const tag = raw.trim().replace(/^#/, "").toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out.length ? out : undefined;
}

function sanitizeVaultStatus(value: unknown): VaultItem["status"] {
  if (value === "COLLECTION" || value === "FOR_SALE" || value === "SOLD" || value === "WISHLIST" || value === "AUCTION") return value;
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

function normalizeImages(raw: unknown): VaultImage[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry, index) => {
      const image = asRecord(entry);
      const storageKey = String(image.storageKey ?? "").trim();
      const rawUrl = String(image.url ?? "").trim();
      const safeUrl = sanitizeMaybeImageUrl(rawUrl);

      if (!storageKey && !safeUrl) return null;

      const resolvedStorageKey = storageKey || safeUrl || "";

      return {
        id: String(image.id ?? resolvedStorageKey).trim() || `image_${index}`,
        storageKey: resolvedStorageKey,
        url: safeUrl || undefined,
        order: Number.isFinite(Number(image.order)) ? Number(image.order) : index,
        localOnly:
          Boolean(image.localOnly) ||
          isEphemeralImageUrl(safeUrl) ||
          isEphemeralImageUrl(resolvedStorageKey),
        role: inferImageRole(index, sanitizeVaultImageRole(image.role)),
        isPrivateStorage: Boolean(image.isPrivateStorage),
        ...(image.quality === "snapshot" ? { quality: "snapshot" as const } : {}),
        ...(typeof image.sourceUrl === "string" && image.sourceUrl ? { sourceUrl: image.sourceUrl } : {}),
      } as VaultImage;
    })
    .filter(Boolean) as VaultImage[];
}

function buildLegacyImages(input: unknown): VaultImage[] {
  const raw = asRecord(input);
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

function normalizeOne(input: unknown): VaultItem | null {
  const raw = asRecord(input);
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
    // Permanent, server-assigned tracking code -- never generated locally,
    // only ever arrives via a Supabase sync merge. Was missing here, so once
    // a synced item picked one up, the next local reload silently dropped
    // it again before the following sync could re-confirm it.
    itemCode: typeof raw.itemCode === "string" && raw.itemCode.trim() ? raw.itemCode.trim() : undefined,
    universe: raw.universe ?? undefined,
    category: raw.category ?? undefined,
    customCategoryLabel: raw.customCategoryLabel ?? undefined,
    categoryLabel: raw.categoryLabel ?? undefined,
    subcategoryLabel: raw.subcategoryLabel ?? undefined,
    title,
    subtitle: raw.subtitle ?? undefined,
    number: raw.number ?? undefined,
    year: raw.year ?? undefined,
    grade: raw.grade ?? undefined,
    condition: raw.condition ?? undefined,
    conditionReason:
      typeof raw.conditionReason === "string" && raw.conditionReason.trim()
        ? raw.conditionReason.trim()
        : undefined,
    conditionSource:
      raw.conditionSource === "ai" || raw.conditionSource === "manual"
        ? raw.conditionSource
        : undefined,
    addedVia:
      raw.addedVia === "scan" || raw.addedVia === "manual" || raw.addedVia === "import" || raw.addedVia === "wishlist" || raw.addedVia === "catalog"
        ? raw.addedVia
        : undefined,
    catalogRef: typeof raw.catalogRef === "string" && raw.catalogRef ? raw.catalogRef : undefined,
    // A blank price is an unknown cost and stays unknown; only a price someone entered (including 0) is a recorded cost.
    purchasePrice: raw.purchasePrice == null || raw.purchasePrice === "" ? undefined : clampNum(raw.purchasePrice, 0),
    // Same rule as the price: blank = unknown (stays unknown), a typed 0 = recorded as 0. Saving anything else on the item
    // used to turn every blank tax / shipping / fee into 0 in the account.
    purchaseTax: raw.purchaseTax == null || raw.purchaseTax === "" ? undefined : clampNum(raw.purchaseTax, 0),
    purchaseShipping: raw.purchaseShipping == null || raw.purchaseShipping === "" ? undefined : clampNum(raw.purchaseShipping, 0),
    purchaseFees: raw.purchaseFees == null || raw.purchaseFees === "" ? undefined : clampNum(raw.purchaseFees, 0),
    // A value is only ever a value someone entered or looked up: when it is missing it stays missing
    // (it used to be filled in with what the item cost, which looked like a market price).
    currentValue: raw.currentValue == null || raw.currentValue === "" ? undefined : clampNum(raw.currentValue, 0),
    askingPrice:
      typeof raw.askingPrice === "number" && Number.isFinite(raw.askingPrice) && raw.askingPrice > 0
        ? raw.askingPrice
        : undefined,
    auctionStatus:
      raw.auctionStatus === "ACTIVE" || raw.auctionStatus === "ENDED" || raw.auctionStatus === "CANCELLED"
        ? (raw.auctionStatus as "ACTIVE" | "ENDED" | "CANCELLED")
        : undefined,
    reservePrice: typeof raw.reservePrice === "number" && Number.isFinite(raw.reservePrice) ? raw.reservePrice : undefined,
    buyItNowPrice: typeof raw.buyItNowPrice === "number" && Number.isFinite(raw.buyItNowPrice) ? raw.buyItNowPrice : undefined,
    auctionEndsAt: typeof raw.auctionEndsAt === "number" ? raw.auctionEndsAt : undefined,
    auctionStartingBid: typeof raw.auctionStartingBid === "number" && Number.isFinite(raw.auctionStartingBid) ? raw.auctionStartingBid : undefined,
    auctionCurrentBid: typeof raw.auctionCurrentBid === "number" && Number.isFinite(raw.auctionCurrentBid) ? raw.auctionCurrentBid : undefined,
    auctionBidCount: typeof raw.auctionBidCount === "number" && Number.isFinite(raw.auctionBidCount) ? raw.auctionBidCount : undefined,
    auctionWinnerId: typeof raw.auctionWinnerId === "string" && raw.auctionWinnerId.trim() ? raw.auctionWinnerId.trim() : undefined,
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
    tags: normalizeTags(raw.tags),
    subject:
      typeof raw.subject === "string" && raw.subject.trim()
        ? raw.subject.trim()
        : undefined,
    brand:
      typeof raw.brand === "string" && raw.brand.trim()
        ? raw.brand.trim()
        : undefined,
    edition: raw.edition ?? undefined,
    variant: raw.variant ?? undefined,
    printRun: raw.printRun ?? undefined,
    // Yes / No / Unknown: only an answer someone gave is kept (unknown used to be saved as No).
    isFirstEdition: typeof raw.isFirstEdition === "boolean" ? raw.isFirstEdition : undefined,
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
    valueLow:
      typeof raw.valueLow === "number" && Number.isFinite(raw.valueLow) && raw.valueLow > 0
        ? raw.valueLow
        : undefined,
    valueMedian:
      typeof raw.valueMedian === "number" && Number.isFinite(raw.valueMedian) && raw.valueMedian > 0
        ? raw.valueMedian
        : undefined,
    valueHigh:
      typeof raw.valueHigh === "number" && Number.isFinite(raw.valueHigh) && raw.valueHigh > 0
        ? raw.valueHigh
        : undefined,
    comparables: normalizeComparables(raw.comparables),
    priceSources: normalizePriceSources(raw.priceSources),
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
    status: sanitizeVaultStatus(raw.status),
    soldPrice:
      typeof raw.soldPrice === "number" && Number.isFinite(raw.soldPrice)
        ? raw.soldPrice
        : undefined,
    soldAt:
      typeof raw.soldAt === "number" && Number.isFinite(raw.soldAt)
        ? raw.soldAt
        : undefined,
    soldPlatform: typeof raw.soldPlatform === "string" && raw.soldPlatform.trim() ? raw.soldPlatform.trim() : undefined,
    createdAt:
      typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt)
        ? raw.createdAt
        : Date.now(),
    isNew: typeof raw.isNew === "boolean" ? raw.isNew : true,
    isPublic:
      typeof raw.isPublic === "boolean"
        ? raw.isPublic
        : typeof raw.is_public === "boolean"
          ? raw.is_public
          : false,
    // TCG
    tcgParallelType: raw.tcgParallelType ?? undefined,
    tcgSetCode: raw.tcgSetCode ?? undefined,
    tcgHoloType: raw.tcgHoloType ?? undefined,
    // Sports
    sportsParallelType: raw.sportsParallelType ?? undefined,
    sportsIsRelic: typeof raw.sportsIsRelic === "boolean" ? raw.sportsIsRelic : undefined,
    sportsRelicDescription: raw.sportsRelicDescription ?? undefined,
    sportsIsAuto: typeof raw.sportsIsAuto === "boolean" ? raw.sportsIsAuto : undefined,
    sportsSerialNumber: raw.sportsSerialNumber ?? undefined,
    // Vinyl
    vinylPressing: raw.vinylPressing ?? undefined,
    vinylLabel: raw.vinylLabel ?? undefined,
    vinylMatrix: raw.vinylMatrix ?? undefined,
    vinylSpeedRpm: raw.vinylSpeedRpm ?? undefined,
    vinylColor: raw.vinylColor ?? undefined,
    // Comics
    comicIssueNumber: raw.comicIssueNumber ?? undefined,
    comicCoverVariant: raw.comicCoverVariant ?? undefined,
    comicArcTitle: raw.comicArcTitle ?? undefined,
    comicPublisher: raw.comicPublisher ?? undefined,
    comicCoverDate: raw.comicCoverDate ?? undefined,
    comicGradingCompany: raw.comicGradingCompany ?? undefined,
    comicPageQuality: raw.comicPageQuality ?? undefined,
    comicRestorationStatus: raw.comicRestorationStatus ?? undefined,
    comicHolderType: raw.comicHolderType ?? undefined,
    comicCensusRank: raw.comicCensusRank ?? undefined,
    // Original Comic Art
    artPenciller: raw.artPenciller ?? undefined,
    artInker: raw.artInker ?? undefined,
    artColorist: raw.artColorist ?? undefined,
    artType: raw.artType ?? undefined,
    artFirstAppearance: raw.artFirstAppearance ?? undefined,
    // Toys
    toyBrand: raw.toyBrand ?? undefined,
    toyLine: raw.toyLine ?? undefined,
    toyScale: raw.toyScale ?? undefined,
    toyPackageCondition: raw.toyPackageCondition ?? undefined,
    toyBoxIncluded: typeof raw.toyBoxIncluded === "boolean" ? raw.toyBoxIncluded : undefined,
    toyAccessoriesIncluded: typeof raw.toyAccessoriesIncluded === "boolean" ? raw.toyAccessoriesIncluded : undefined,
    toyIsComplete: typeof raw.toyIsComplete === "boolean" ? raw.toyIsComplete : undefined,
    // Art Cards
    artCardArtist: raw.artCardArtist ?? undefined,
    artCardSet: raw.artCardSet ?? undefined,
    artCardType: raw.artCardType ?? undefined,
    // Sports additions
    sportsSport: raw.sportsSport ?? undefined,
    sportsTeam: raw.sportsTeam ?? undefined,
    sportsGradingCompany: raw.sportsGradingCompany ?? undefined,
    sportsPop: raw.sportsPop ?? undefined,
    sportsAutoAuth: raw.sportsAutoAuth ?? undefined,
    // Memorabilia
    memorabiliaTeam: raw.memorabiliaTeam ?? undefined,
    memorabiliaEvent: raw.memorabiliaEvent ?? undefined,
    memorabiliaSigningDate: raw.memorabiliaSigningDate ?? undefined,
    memorabiliaWitnessed: typeof raw.memorabiliaWitnessed === "boolean" ? raw.memorabiliaWitnessed : undefined,
    memorabiliaAuthCompany: raw.memorabiliaAuthCompany ?? undefined,
    memorabiliaGameUsed: typeof raw.memorabiliaGameUsed === "boolean" ? raw.memorabiliaGameUsed : undefined,
    memorabiliaGameUsedDesc: raw.memorabiliaGameUsedDesc ?? undefined,
    // TCG additions
    tcgRarity: raw.tcgRarity ?? undefined,
    tcgLanguage: raw.tcgLanguage ?? undefined,
    tcgGradingCompany: raw.tcgGradingCompany ?? undefined,
    // Watches
    watchBrand: raw.watchBrand ?? undefined,
    watchReference: raw.watchReference ?? undefined,
    watchMovement: raw.watchMovement ?? undefined,
    watchCaseMaterial: raw.watchCaseMaterial ?? undefined,
    watchCaseSize: raw.watchCaseSize ?? undefined,
    watchDialColor: raw.watchDialColor ?? undefined,
    watchBox: typeof raw.watchBox === "boolean" ? raw.watchBox : undefined,
    watchPapers: typeof raw.watchPapers === "boolean" ? raw.watchPapers : undefined,
    watchFullSet: typeof raw.watchFullSet === "boolean" ? raw.watchFullSet : undefined,
    // Bags
    bagBrand: raw.bagBrand ?? undefined,
    bagColor: raw.bagColor ?? undefined,
    bagMaterial: raw.bagMaterial ?? undefined,
    bagHardware: raw.bagHardware ?? undefined,
    bagAuthCard: typeof raw.bagAuthCard === "boolean" ? raw.bagAuthCard : undefined,
    bagDustbag: typeof raw.bagDustbag === "boolean" ? raw.bagDustbag : undefined,
    bagBox: typeof raw.bagBox === "boolean" ? raw.bagBox : undefined,
    // Apparel
    apparelSize: raw.apparelSize ?? undefined,
    apparelColorway: raw.apparelColorway ?? undefined,
    apparelWorn: typeof raw.apparelWorn === "boolean" ? raw.apparelWorn : undefined,
    // Vinyl additions
    vinylCountry: raw.vinylCountry ?? undefined,
    vinylSleeveCondition: raw.vinylSleeveCondition ?? undefined,
    vinylInserts: typeof raw.vinylInserts === "boolean" ? raw.vinylInserts : undefined,
    vinylGatefold: typeof raw.vinylGatefold === "boolean" ? raw.vinylGatefold : undefined,
    // Art & Prints
    artMedium: raw.artMedium ?? undefined,
    artSurface: raw.artSurface ?? undefined,
    artHeight: raw.artHeight ?? undefined,
    artWidth: raw.artWidth ?? undefined,
    artDepth: raw.artDepth ?? undefined,
    artIsFramed: typeof raw.artIsFramed === "boolean" ? raw.artIsFramed : undefined,
    artIsSigned: typeof raw.artIsSigned === "boolean" ? raw.artIsSigned : undefined,
    artSignatureLocation: raw.artSignatureLocation ?? undefined,
    artProvenance: raw.artProvenance ?? undefined,
    artExhibitions: raw.artExhibitions ?? undefined,
    // Coins
    coinDenomination: raw.coinDenomination ?? undefined,
    coinCountry: raw.coinCountry ?? undefined,
    coinMint: raw.coinMint ?? undefined,
    coinMintMark: raw.coinMintMark ?? undefined,
    coinGradingCompany: raw.coinGradingCompany ?? undefined,
    coinPopulation: raw.coinPopulation ?? undefined,
    coinError: raw.coinError ?? undefined,
    coinKeyDate: typeof raw.coinKeyDate === "boolean" ? raw.coinKeyDate : undefined,
    // Games
    gamePlatform: raw.gamePlatform ?? undefined,
    gameRegion: raw.gameRegion ?? undefined,
    gameGradingCompany: raw.gameGradingCompany ?? undefined,
    gameIsSealed: typeof raw.gameIsSealed === "boolean" ? raw.gameIsSealed : undefined,
    gameIsCIB: typeof raw.gameIsCIB === "boolean" ? raw.gameIsCIB : undefined,
    gameHasManual: typeof raw.gameHasManual === "boolean" ? raw.gameHasManual : undefined,
    gamePublisher: raw.gamePublisher ?? undefined,
    consoleControllerCount: raw.consoleControllerCount ?? undefined,
    consoleCables: typeof raw.consoleCables === "boolean" ? raw.consoleCables : undefined,
    consoleBox: typeof raw.consoleBox === "boolean" ? raw.consoleBox : undefined,
    consoleTested: typeof raw.consoleTested === "boolean" ? raw.consoleTested : undefined,
    // Universal Type dropdown + Attributes checkboxes -- these were declared
    // on the VaultItem type and written correctly on save, but missing here
    // meant loadRawItems() silently stripped them (and immediately
    // persisted the stripped copy) the very next time the vault reloaded.
    // Real, active UI (vault/add's Type/Attributes section) -- not dead code.
    itemType: typeof raw.itemType === "string" && raw.itemType.trim() ? raw.itemType.trim() : undefined,
    itemAttributes: normalizeStringArray(raw.itemAttributes),
    specs: normalizeSpecs(raw.specs),
    // Video clip (beta) -- same bug: already synced correctly to Supabase
    // (vaultCloud.ts's video_clip_url/video_clip_duration), but the
    // LOCAL copy lost it on every reload before any sync could restore it.
    videoClip:
      raw.videoClip && typeof raw.videoClip === "object" && typeof raw.videoClip.url === "string"
        ? {
            url: raw.videoClip.url,
            durationSeconds:
              typeof raw.videoClip.durationSeconds === "number" ? raw.videoClip.durationSeconds : 0,
          }
        : undefined,
  };
}

function normalizeAll(rawList: unknown) {
  if (!Array.isArray(rawList)) return { items: [] as VaultItem[], repaired: false };
  const normalized: VaultItem[] = [];
  for (const raw of rawList) {
    const one = normalizeOne(raw);
    if (one) normalized.push(withoutUndefined(one));
  }
  const unique = ensureUniqueIds(normalized);
  const migrated = migrateMissingProfileIds(unique.items);
  return { items: migrated.items, repaired: unique.repaired || migrated.repaired };
}

function stripEphemeralForPersistence(item: VaultItem): VaultItem {
  const cleanImages = getOrderedImages(item)
    .filter((image) => {
      if (!image) return false;
      if (!image.storageKey && !image.url) return false;
      if (isEphemeralImageUrl(image.storageKey)) return false;
      if (!image.storageKey && isEphemeralImageUrl(image.url)) return false;
      return true;
    })
    .map((image, index) => ({
      ...image,
      url: image.url && !isEphemeralImageUrl(image.url) ? image.url : undefined,
      order: index,
      localOnly: Boolean(image.localOnly),
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

// The repaired list is remembered against the exact stored text it was made from. Every screen (cards, badges, the upload queue,
// the cloud pull) reads the local vault many times per page, and each read used to decode, repair and re-write every item: about
// half a second for 1,500 items, repeated dozens of times per page load, which is what froze the Vault. Any save, another tab's
// save, a restore or a change of account changes the stored text, so a different key can never be served a stale list.
// `stable`: every item in the list is already in the form the repair step would give it (checked, not assumed), so the stored text
// can be marked as repaired and the next page load can skip the repair.
let repairedItemsCache: { sig: string; items: VaultItem[]; stable: boolean } | null = null;

// Callers get their own copy of every item (they edit items and save them back), never the remembered objects.
function copyForCaller(items: VaultItem[]): VaultItem[] {
  return items.map((item) => ({ ...item }));
}

// A repaired item carries about a hundred keys, most of them undefined (they never reach storage). The remembered copy leaves
// those out, so handing a copy to every caller is a handful of fields per item instead of a hundred.
function withoutUndefined(item: VaultItem): VaultItem {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(item)) {
    const value = (item as unknown as Record<string, unknown>)[key];
    if (value !== undefined) out[key] = value;
  }
  return out as unknown as VaultItem;
}

// The form an item is stored in.
function toStorageForm(item: VaultItem): VaultItem {
  return stripEphemeralForPersistence(syncPrimaryFields(item));
}

// Checks every item of a short list, and an even spread of about sixty of a long one.
function areStableForms(list: VaultItem[]): boolean {
  const step = list.length > 80 ? Math.ceil(list.length / 60) : 1;
  for (let i = 0; i < list.length; i += step) if (!isStableForm(list[i])) return false;
  return true;
}

// Does the repair step leave this stored item exactly as it is? (Only then may a whole stored list be marked as repaired.)
function isStableForm(item: VaultItem): boolean {
  try {
    const again = normalizeOne(JSON.parse(JSON.stringify(item)));
    return Boolean(again) && JSON.stringify(toStorageForm(again as VaultItem)) === JSON.stringify(item);
  } catch {
    return false;
  }
}

// A stored list the repair step would have nothing to do with: every item has an id (all different), a title, and, when a profile
// is active, a profile.
function listNeedsNoRepair(list: unknown): list is VaultItem[] {
  if (!Array.isArray(list)) return false;
  const activeProfileId = getActiveProfileId();
  const seen = new Set<string>();
  for (const entry of list) {
    if (!entry || typeof entry !== "object") return false;
    const item = entry as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    if (!id || seen.has(id)) return false;
    seen.add(id);
    if (typeof item.title !== "string" || !item.title.trim()) return false;
    if (activeProfileId && !item.profile_id) return false;
  }
  return true;
}

/**
 * Saves the whole local list. `changedIds` (only passed by callers that took `items` from loadRawItems() and changed just those
 * items) means the other items are already in their stored form, so only the changed ones are processed again; without it every
 * item is, as before. Returns the stored form of every item (null if nothing could be saved here).
 */
function saveRawItems(items: VaultItem[], changedIds?: Set<string>): VaultItem[] | null {
  if (typeof window === "undefined") return null;
  const sigBefore = changedIds ? getVaultLocalSignature() : null;
  const base = changedIds && sigBefore !== null && repairedItemsCache && repairedItemsCache.sig === sigBefore ? repairedItemsCache : null;
  const reusable = changedIds && base ? new Set(base.items.map((entry) => String(entry.id))) : null;
  const processedNow: VaultItem[] = [];
  const safeItems = items.map((item) => {
    if (changedIds && reusable && !changedIds.has(String(item.id)) && reusable.has(String(item.id))) return item;
    // A brand-new item comes from a form that fills in only some fields; the repair step would add the rest (zero tax, not first edition,
    // new, private ...) the next time the copy is read, and so make the whole saved copy "not yet repaired". Doing that for this one item
    // now gives the stored copy the same content without a whole-collection repair on the next load.
    const brandNew = Boolean(changedIds && reusable && !reusable.has(String(item.id)));
    const stored = toStorageForm(brandNew ? normalizeOne(item) ?? item : item);
    processedNow.push(stored);
    return stored;
  });
  const written = writeVaultLocalJson(JSON.stringify(safeItems));
  // What was just saved is what the next read would produce: remember it so the read after a save does not repeat the work.
  // (Only when every item is a complete record; an untitled or id-less entry is dropped by the repair step on the next read.)
  const sig = getVaultLocalSignature();
  if (written && sig !== null && safeItems.every((item) => item && item.id && String(item.title ?? "").trim())) {
    // The list is in repaired form if the list it grew from was (or there was nothing before it) and every item added or changed is.
    const grewFromRepaired = Boolean(changedIds) && (sigBefore === null || Boolean(base && base.stable));
    const stable = grewFromRepaired && areStableForms(processedNow) && new Set(safeItems.map((item) => String(item.id))).size === safeItems.length;
    repairedItemsCache = { sig, items: safeItems.map(withoutUndefined), stable };
    if (stable) markVaultLocalRepaired();
  }
  return safeItems;
}

function loadRawItems() {
  if (typeof window === "undefined") return [];
  try {
    const stamp = getVaultLocalSignature();
    if (stamp !== null && repairedItemsCache && repairedItemsCache.sig === stamp) {
      return copyForCaller(repairedItemsCache.items);
    }
    let raw = readVaultLocalJson();
    if (!raw) {
      const legacy = window.localStorage.getItem(LEGACY_LS_KEY);
      if (legacy) {
        writeVaultLocalJson(legacy);
        raw = legacy;
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);

    // This exact stored text was repaired before and came out unchanged: nothing to repair, rewrite or re-check.
    if (stamp !== null && isVaultLocalRepaired() && listNeedsNoRepair(parsed)) {
      repairedItemsCache = { sig: stamp, items: parsed, stable: true };
      return copyForCaller(parsed);
    }

    const normalized = normalizeAll(parsed);
    const stored = saveRawItems(normalized.items);
    const after = getVaultLocalSignature();
    if (after !== null) {
      // The list the next read would produce. If a sample of it comes through the repair step unchanged, the stored text is marked
      // as repaired, so the next page load can skip all of this.
      const items = (stored ?? normalized.items).map(withoutUndefined);
      const stable = stored !== null && items.length > 0 && areStableForms(items) && listNeedsNoRepair(items);
      repairedItemsCache = { sig: after, items, stable };
      if (stable) markVaultLocalRepaired();
      return copyForCaller(items);
    }
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
  // Private Photos (paid feature) — this storageKey lives in the private
  // bucket and needs a signed URL, not a permanent public one. See
  // privatePhotos.ts's own comment for why this stays synchronous like
  // every other branch here instead of making this function (called from
  // ~28 places across the app) async.
  if (image.storageKey && image.isPrivateStorage) return resolvePrivateImageUrlSync(image.storageKey);
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
  let primaryIsLocalOnly = false;

  if (ordered.length > 0) {
    const primary =
      ordered.find((image) => image.storageKey === item.primaryImageKey) ?? ordered[0];
    primaryIsLocalOnly = Boolean(primary.localOnly);
    const resolved = resolveVaultImageUrl(primary);
    if (resolved) return resolved;
  }

  if (!primaryIsLocalOnly && item.imageFrontStoragePath) {
    return getVaultImagePublicUrl(item.imageFrontStoragePath);
  }
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
    imageFrontStoragePath: isEphemeralImageUrl(primary.storageKey) ? undefined : primary.storageKey,
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

  const normalized = next.map((image, index) => ({
    ...image,
    order: index,
    role: inferImageRole(index, sanitizeVaultImageRole(image.role)),
  }));

  return syncPrimaryFields({
    ...item,
    images: normalized,
    primaryImageKey: normalized[0]?.storageKey,
  });
}

export function deleteImageAtIndex(item: VaultItem, index: number) {
  const images = getOrderedImages(item);
  if (index < 0 || index >= images.length) return item;

  const next = images
    .filter((_, i) => i !== index)
    .map((image, order) => ({
      ...image,
      order,
      role: inferImageRole(order, sanitizeVaultImageRole(image.role)),
    }));

  return syncPrimaryFields({
    ...item,
    images: next,
    primaryImageKey: next[0]?.storageKey,
  });
}

// Items moved to another profile whose upload has not finished yet: a cloud pull must not move them back.
const PENDING_MOVES_KEY = "vltd_pending_moves_v1";

function readPendingMoves(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PENDING_MOVES_KEY) || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function markPendingMoves(ids: string[], targetProfileId: string) {
  if (typeof window === "undefined") return;
  const next = readPendingMoves();
  for (const id of ids) next[String(id)] = targetProfileId;
  try {
    window.localStorage.setItem(PENDING_MOVES_KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked */
  }
}

export function clearPendingMoves(ids: string[]) {
  if (typeof window === "undefined") return;
  const next = readPendingMoves();
  for (const id of ids) delete next[String(id)];
  try {
    window.localStorage.setItem(PENDING_MOVES_KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked */
  }
}

// Items with an edit that has not reached the account yet (waiting in the upload queue). Same key as vaultSyncQueue.ts.
const SYNC_QUEUE_STORAGE_KEY = "vltd_sync_queue_v1";
function readQueuedItemIds(): Set<string> {
  const ids = new Set<string>();
  if (typeof window === "undefined") return ids;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SYNC_QUEUE_STORAGE_KEY) || "[]");
    if (Array.isArray(parsed)) for (const entry of parsed) if (entry && typeof entry === "object" && "itemId" in entry) ids.add(String((entry as { itemId: unknown }).itemId));
  } catch {
    /* unreadable queue: treated as empty */
  }
  return ids;
}

// When each item last finished uploading from this page. A pull that STARTED before that holds an older copy of the item and
// must not lay it over the newer one.
const uploadedAtById = new Map<string, number>();
export function noteItemUploaded(itemId: string) {
  uploadedAtById.set(String(itemId), Date.now());
}

// `localItems` come from loadRawItems(), so they are already in their stored form: only what the pull changes is processed again.
// `changed` is the set of item ids the merge added or altered.
function mergeById(localItems: VaultItem[], remoteItems: VaultItem[], pullStartedAt = 0) {
  const pendingMoves = readPendingMoves();
  const queuedIds = readQueuedItemIds();
  const byId = new Map<string, VaultItem>();
  const changed = new Set<string>();

  for (const item of localItems) {
    byId.set(String(item.id), item);
  }

  for (const remoteItem of remoteItems) {
    const existing = byId.get(String(remoteItem.id));

    if (!existing) {
      const repairedRemote = normalizeOne(remoteItem);
      byId.set(String(remoteItem.id), syncPrimaryFields(withoutUndefined(repairedRemote ?? remoteItem)));
      changed.add(String(remoteItem.id));
      continue;
    }

    // A newer edit on this device that the account has not got yet (or got after this pull began) is never replaced by the
    // older copy the pull brought back. Only the permanent code the database assigns is taken from the cloud copy.
    if (queuedIds.has(String(remoteItem.id)) || (pullStartedAt > 0 && (uploadedAtById.get(String(remoteItem.id)) ?? 0) >= pullStartedAt)) {
      if (remoteItem.itemCode && remoteItem.itemCode !== existing.itemCode) {
        byId.set(String(remoteItem.id), syncPrimaryFields({ ...existing, itemCode: remoteItem.itemCode }));
        changed.add(String(remoteItem.id));
      }
      continue;
    }

    const remoteHasImages = Array.isArray(remoteItem.images) && remoteItem.images.length > 0;
    const existingSold = existing.status === "SOLD" || existing.soldAt || existing.soldPrice !== undefined;
    const remoteSold =
      remoteItem.status === "SOLD" || remoteItem.soldAt || remoteItem.soldPrice !== undefined;
    const latestSale =
      existingSold || remoteSold
        ? Number(remoteItem.soldAt ?? 0) >= Number(existing.soldAt ?? 0)
          ? remoteItem
          : existing
        : null;

    const merged = normalizeOne({
      ...existing,
      ...remoteItem,
      status: latestSale ? "SOLD" : remoteItem.status ?? existing.status,
      soldPrice: latestSale?.soldPrice ?? existing.soldPrice ?? remoteItem.soldPrice,
      soldAt: latestSale?.soldAt ?? existing.soldAt ?? remoteItem.soldAt,
      soldPlatform: latestSale?.soldPlatform ?? existing.soldPlatform ?? remoteItem.soldPlatform,
      // Provenance never changes once set. A row from before the catalog_ref
      // migration (or a row saved without it) must not blank the local copy,
      // or the next upload would save the blanks back.
      addedVia: remoteItem.addedVia ?? existing.addedVia,
      catalogRef: remoteItem.catalogRef ?? existing.catalogRef,
      // Older databases have no specs column yet: a row without it must not blank what was typed on this device.
      specs: remoteItem.specs ?? existing.specs,
      images: remoteHasImages ? remoteItem.images : existing.images,
      primaryImageKey: remoteItem.primaryImageKey || existing.primaryImageKey,
      imageFrontUrl: remoteItem.imageFrontUrl || existing.imageFrontUrl,
      imageFrontStoragePath: remoteItem.imageFrontStoragePath || existing.imageFrontStoragePath,
      createdAt: remoteItem.createdAt || existing.createdAt,
      ...(pendingMoves[String(remoteItem.id)]
        ? { profile_id: pendingMoves[String(remoteItem.id)], isPublic: false }
        : {}),
    });

    if (merged) {
      byId.set(String(remoteItem.id), syncPrimaryFields(withoutUndefined(merged)));
      changed.add(String(remoteItem.id));
    }
  }

  return {
    items: [...byId.values()].sort((a, b) => Number(b.createdAt ?? 0) - Number(a.createdAt ?? 0)),
    changed,
  };
}

function isNewestFirst(items: VaultItem[]) {
  for (let i = 1; i < items.length; i++) {
    if (Number(items[i - 1].createdAt ?? 0) < Number(items[i].createdAt ?? 0)) return false;
  }
  return true;
}

async function checkForceClearVault(profileId: string) {
  try {
    const { getSupabaseBrowserClient } = await import("@/lib/supabaseClient");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const { data } = await supabase
      .from("profiles")
      .select("force_clear_vault")
      .eq("id", profileId)
      .single();

    if (data?.force_clear_vault) {
      // Wipe all local items belonging to this profile
      const remaining = loadRawItems().filter(
        (item) => item.profile_id !== profileId
      );
      writeVaultLocalJson(JSON.stringify(remaining));

      // Reset the flag
      await supabase
        .from("profiles")
        .update({ force_clear_vault: false })
        .eq("id", profileId);
    }
  } catch {
    // Non-fatal — proceed normally
  }
}

// Every screen, the upload queue and the "vault updated" event listeners can
// each start their own full download of the whole item list -- opening the
// Vault alone fired three back to back (the queue's own pull, then the page's
// explicit pull, then a second one from the event the first pull emits). That
// is real Supabase egress and, because overlapping pulls can re-add an item
// that is mid-delete, it is also how device-only "ghost" items got created.
//
// This shares or reuses a pull ONLY when it is provably equivalent to doing
// a fresh one: same profile, and the locally stored items are byte-for-byte
// what they were when that pull started/finished (so nothing here has been
// added, edited or deleted since). Any local change, profile switch or
// restore changes that signature and forces a real pull, exactly as before.
const PULL_REUSE_MS = 4000;
// "ok" is whether the cloud really answered (a failed or abandoned pull leaves the device copy as it was; the Vault page
// must be able to tell "the cloud says empty" from "the cloud could not be reached").
let pullInFlight: { promise: Promise<{ ok: boolean }>; startSig: string | null; profileId: string } | null = null;
let lastPull: { finishedAt: number; sig: string | null; profileId: string } | null = null;

function localItemsSignature() {
  if (typeof window === "undefined") return null;
  return getVaultLocalSignature();
}

// The pull remembers the newest change it has seen, so the next pull can ask only for what changed since
// (a full pull is about 5 MB for 1,000 items). It still does a full pull at least every 12 hours.
const PULL_CURSOR_KEY = "vltd_pull_cursor_v1";
const FULL_PULL_EVERY_MS = 12 * 60 * 60 * 1000;

function readPullCursor(profileId: string): { c: string; f: number } | null {
  if (typeof window === "undefined" || !profileId) return null;
  try {
    const all = JSON.parse(window.localStorage.getItem(PULL_CURSOR_KEY) || "{}");
    const hit = all?.[profileId];
    return hit && typeof hit.c === "string" && typeof hit.f === "number" ? hit : null;
  } catch {
    return null;
  }
}

function writePullCursor(profileId: string, entry: { c: string; f: number } | null) {
  if (typeof window === "undefined" || !profileId) return;
  try {
    const all = JSON.parse(window.localStorage.getItem(PULL_CURSOR_KEY) || "{}") || {};
    if (entry) all[profileId] = entry;
    else delete all[profileId];
    window.localStorage.setItem(PULL_CURSOR_KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked: the next pull is simply a full one */
  }
}

async function pullAndMergeFromSupabase(profileId: string): Promise<{ ok: boolean }> {
  // The answer is only for the person who asked. If nobody is signed in there is nothing to pull; if someone else signs in
  // (in this tab or another) before it arrives, it is dropped instead of being merged into the new person's copy.
  const startedAs = storedSessionUserId();
  if (!startedAs) return { ok: false };
  // Without a profile there is nothing to ask the cloud for: that is "not answered", never "your vault is empty".
  if (!profileId) return { ok: false };
  try {
    // The cloud only answers truthfully to a signed-in client. A client whose sign-in could not be renewed asks as nobody, and the
    // database then answers "no rows" with no error: that must not be read as an empty vault.
    const { getSupabaseBrowserClient } = await import("@/lib/supabaseClient");
    const client = getSupabaseBrowserClient();
    if (!client) return { ok: false };
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData?.session) return { ok: false };

    // The admin "clear this device's copy" flag is checked first. It must not hold the pull when the cloud is slow: on a
    // connection that cannot reach the cloud one request took about 7 seconds to give up.
    if (profileId) {
      await Promise.race([checkForceClearVault(profileId), new Promise<void>((resolve) => setTimeout(resolve, 4000))]);
    }

    const pullStartedAt = Date.now();
    const saved = readPullCursor(profileId);
    const dueForFull = !saved || Date.now() - saved.f > FULL_PULL_EVERY_MS;
    const knownLocalCount = loadRawItems().filter((item) => String(item.profile_id ?? "") === String(profileId)).length;
    const pulled = await fetchVaultItemsDelta(profileId || undefined, dueForFull ? undefined : saved?.c, knownLocalCount);
    if (!stillSignedInAs(startedAs)) return { ok: false };
    const remoteItems = pulled.items;
    if (pulled.cursor) {
      writePullCursor(profileId, { c: pulled.cursor, f: pulled.delta && saved ? saved.f : Date.now() });
    } else {
      writePullCursor(profileId, null);
    }
    const localItems = loadRawItems();
    if (remoteItems.length > 0 || !isNewestFirst(localItems)) {
      const { items: merged, changed } = mergeById(localItems, remoteItems, pullStartedAt);
      saveRawItems(merged, changed);
    }
    // Settle the stored form (loadRawItems normalizes and re-saves) before
    // taking the signature, so an unchanged vault compares equal later.
    loadRawItems();
    lastPull = { finishedAt: Date.now(), sig: localItemsSignature(), profileId };
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Pulls from the cloud and returns only the active (or given) profile's items: personal and Business never mix. */
export async function syncVaultItemsFromSupabase(explicitProfileId?: string): Promise<VaultItem[]> {
  await syncVaultItemsInternal(explicitProfileId);
  return explicitProfileId ? loadItems({ profileId: explicitProfileId }) : loadItems();
}

/**
 * Same pull, but says whether the cloud really answered. A page showing "your vault is empty" must know the difference
 * between "the cloud has nothing" (ok) and "the cloud could not be reached / the answer was dropped" (not ok).
 */
export async function syncVaultItemsFromSupabaseChecked(
  explicitProfileId?: string
): Promise<{ ok: boolean; items: VaultItem[] }> {
  const { ok } = await syncVaultItemsInternal(explicitProfileId);
  return {
    ok,
    items: explicitProfileId ? loadItems({ profileId: explicitProfileId }) : loadItems(),
  };
}

async function syncVaultItemsInternal(explicitProfileId?: string): Promise<{ ok: boolean }> {
  if (typeof window === "undefined") return { ok: false };
  if (!hasSupabaseEnv()) return { ok: false };

  const profileId = explicitProfileId ?? getActiveProfileId();
  const sig = localItemsSignature();

  if (
    lastPull &&
    lastPull.profileId === profileId &&
    lastPull.sig === sig &&
    Date.now() - lastPull.finishedAt < PULL_REUSE_MS
  ) {
    return { ok: true };
  }

  if (pullInFlight && pullInFlight.profileId === profileId && pullInFlight.startSig === sig) {
    return pullInFlight.promise;
  }

  const entry = { promise: pullAndMergeFromSupabase(profileId), startSig: sig, profileId };
  pullInFlight = entry;
  try {
    return await entry.promise;
  } finally {
    if (pullInFlight === entry) pullInFlight = null;
  }
}

export function loadItems(options: LoadItemsOptions = {}) {
  const all = loadRawItems();
  const activeProfileId = getActiveProfileId();

  return all.filter((item) => {
    if (options.includeAllProfiles) return true;
    if (options.profileId) return item.profile_id === options.profileId;
    if (!activeProfileId) return !item.profile_id;
    return item.profile_id === activeProfileId;
  });
}

export function saveItems(items: VaultItem[]) {
  saveRawItems(items.map(syncPrimaryFields));
}

export function appendItems(items: VaultItem[]) {
  const existing = loadRawItems();

  if (typeof window !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getTierSafe } = require("./subscription") as typeof import("./subscription");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getVaultItemLimit } = require("./galleryTier") as typeof import("./galleryTier");
    const tier = getTierSafe();
    const limit = getVaultItemLimit(tier);
    const activeProfile = getActiveProfileId();
    const ownCount = activeProfile ? existing.filter((item) => item.profile_id === activeProfile).length : existing.length;
    if (isFinite(limit) && ownCount >= limit) {
      throw new Error(
        `FREE_TIER_LIMIT:You've reached the ${limit}-item limit on the free plan. Upgrade to add more items.`
      );
    }
  }

  const added = items.map(syncPrimaryFields);
  saveRawItems([...existing, ...added], new Set(added.map((item) => String(item.id))));
}

export function markItemViewed(itemId: string) {
  const next = loadRawItems().map((item) =>
    String(item.id) === String(itemId) ? { ...item, isNew: false } : item
  );
  saveRawItems(next, new Set([String(itemId)]));
}

export function saveItem(item: VaultItem) {
  const normalized = syncPrimaryFields(item);
  const existing = loadRawItems();
  const idx = existing.findIndex((entry) => String(entry.id) === String(normalized.id));
  if (idx === -1) {
    saveRawItems([...existing, normalized], new Set([String(normalized.id)]));
    return;
  }
  const previous = existing[idx] as VaultItem | undefined;
  const next = [...existing];
  next[idx] = normalized;
  saveRawItems(next, new Set([String(normalized.id)]));

  // Log a real before/after value change. This is the single funnel every
  // save path goes through, so it captures the moment a value actually moves.
  const prevValue = Number(previous?.currentValue ?? NaN);
  const newValue = Number(normalized.currentValue ?? NaN);
  if (Number.isFinite(prevValue) && Number.isFinite(newValue) && prevValue !== newValue) {
    void import("@/lib/activityEvents")
      .then(({ addActivityEvent }) =>
        addActivityEvent({
          kind: "valued",
          title: normalized.title || "Item value updated",
          subtitle: [normalized.universe, normalized.category].filter(Boolean).join(" · ") || undefined,
          detail: `Value changed from ${prevValue} to ${newValue}`,
          itemId: String(normalized.id),
          imageUrl: getPrimaryImageUrl(normalized) || undefined,
          href: `/vault/${normalized.id}`,
          previousValue: prevValue,
          newValue,
          source: "Manual update",
        })
      )
      .catch(() => {
        /* activity logging must never block a save */
      });
  }
}

/**
 * Save many items with ONE read and ONE write. saveItem() re-reads and
 * re-writes the entire local vault every call, so saving a 43-item bulk move
 * item by item meant 43 full rewrites of a vault with thousands of items.
 */
export function saveItemsBatch(items: VaultItem[]) {
  if (items.length === 0) return;
  const incoming = new Map<string, VaultItem>();
  for (const item of items) {
    const normalized = syncPrimaryFields(item);
    incoming.set(String(normalized.id), normalized);
  }
  const placed = new Set<string>();
  const next = loadRawItems().map((entry) => {
    const key = String(entry.id);
    const replacement = incoming.get(key);
    if (!replacement) return entry;
    placed.add(key);
    return replacement;
  });
  for (const [key, item] of incoming) {
    if (!placed.has(key)) next.push(item);
  }
  saveRawItems(next, new Set(incoming.keys()));
}

export function loadItemsOrSeed(seed?: VaultItem[]) {
  const existing = loadItems();
  if (existing.length > 0) return existing;

  // Signed-in users always see their REAL vault — an empty vault stays empty
  // (an empty state), never demo data, and demo is never written into a real
  // profile's storage. Demo is display-only for the logged-out marketing preview.
  const activeProfileId = getActiveProfileId();
  if (activeProfileId) return existing;

  return Array.isArray(seed)
    ? seed.filter(Boolean).map((item) => syncPrimaryFields(item))
    : [];
}

import {
  fetchVaultItemsFromSupabase,
  getVaultImagePublicUrl,
  hasSupabaseEnv,
  isDirectBrowserImageUrl,
} from "@/lib/vaultCloud";
import { newId } from "@/lib/id";
import { getDemoItems } from "@/lib/demoSeed";
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
  storageLocation?: string;
  certNumber?: string;
  serialNumber?: string;
  subject?: string;
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
  createdAt?: number;
  isNew?: boolean;
  isPublic?: boolean;
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
};

type LoadItemsOptions = {
  profileId?: string;
  includeAllProfiles?: boolean;
};

// Local storage imports are intentionally loose because old app versions stored varied shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UnknownRecord = Record<string, any>;

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
    purchasePrice: clampNum(raw.purchasePrice, 0),
    purchaseTax: clampNum(raw.purchaseTax, 0),
    purchaseShipping: clampNum(raw.purchaseShipping, 0),
    purchaseFees: clampNum(raw.purchaseFees, 0),
    currentValue: clampNum(raw.currentValue, clampNum(raw.purchasePrice, 0)),
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
    subject:
      typeof raw.subject === "string" && raw.subject.trim()
        ? raw.subject.trim()
        : undefined,
    edition: raw.edition ?? undefined,
    variant: raw.variant ?? undefined,
    printRun: raw.printRun ?? undefined,
    isFirstEdition: raw.isFirstEdition === true,
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
    sportsIsRelic: raw.sportsIsRelic === true ? true : undefined,
    sportsRelicDescription: raw.sportsRelicDescription ?? undefined,
    sportsIsAuto: raw.sportsIsAuto === true ? true : undefined,
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
    toyBoxIncluded: raw.toyBoxIncluded === true ? true : undefined,
    toyAccessoriesIncluded: raw.toyAccessoriesIncluded === true ? true : undefined,
    toyIsComplete: raw.toyIsComplete === true ? true : undefined,
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
    memorabiliaWitnessed: raw.memorabiliaWitnessed === true ? true : undefined,
    memorabiliaAuthCompany: raw.memorabiliaAuthCompany ?? undefined,
    memorabiliaGameUsed: raw.memorabiliaGameUsed === true ? true : undefined,
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
    watchBox: raw.watchBox === true ? true : undefined,
    watchPapers: raw.watchPapers === true ? true : undefined,
    watchFullSet: raw.watchFullSet === true ? true : undefined,
    // Bags
    bagBrand: raw.bagBrand ?? undefined,
    bagColor: raw.bagColor ?? undefined,
    bagMaterial: raw.bagMaterial ?? undefined,
    bagHardware: raw.bagHardware ?? undefined,
    bagAuthCard: raw.bagAuthCard === true ? true : undefined,
    bagDustbag: raw.bagDustbag === true ? true : undefined,
    bagBox: raw.bagBox === true ? true : undefined,
    // Apparel
    apparelSize: raw.apparelSize ?? undefined,
    apparelColorway: raw.apparelColorway ?? undefined,
    apparelWorn: raw.apparelWorn === true ? true : undefined,
    // Vinyl additions
    vinylCountry: raw.vinylCountry ?? undefined,
    vinylSleeveCondition: raw.vinylSleeveCondition ?? undefined,
    vinylInserts: raw.vinylInserts === true ? true : undefined,
    vinylGatefold: raw.vinylGatefold === true ? true : undefined,
    // Art & Prints
    artMedium: raw.artMedium ?? undefined,
    artSurface: raw.artSurface ?? undefined,
    artHeight: raw.artHeight ?? undefined,
    artWidth: raw.artWidth ?? undefined,
    artDepth: raw.artDepth ?? undefined,
    artIsFramed: raw.artIsFramed === true ? true : undefined,
    artIsSigned: raw.artIsSigned === true ? true : undefined,
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
    coinKeyDate: raw.coinKeyDate === true ? true : undefined,
    // Games
    gamePlatform: raw.gamePlatform ?? undefined,
    gameRegion: raw.gameRegion ?? undefined,
    gameGradingCompany: raw.gameGradingCompany ?? undefined,
    gameIsSealed: raw.gameIsSealed === true ? true : undefined,
    gameIsCIB: raw.gameIsCIB === true ? true : undefined,
    gameHasManual: raw.gameHasManual === true ? true : undefined,
    gamePublisher: raw.gamePublisher ?? undefined,
    consoleControllerCount: raw.consoleControllerCount ?? undefined,
    consoleCables: raw.consoleCables === true ? true : undefined,
    consoleBox: raw.consoleBox === true ? true : undefined,
    consoleTested: raw.consoleTested === true ? true : undefined,
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
      images: remoteHasImages ? remoteItem.images : existing.images,
      primaryImageKey: remoteItem.primaryImageKey || existing.primaryImageKey,
      imageFrontUrl: remoteItem.imageFrontUrl || existing.imageFrontUrl,
      imageFrontStoragePath: remoteItem.imageFrontStoragePath || existing.imageFrontStoragePath,
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
      window.localStorage.setItem(LS_KEY, JSON.stringify(remaining));

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

export async function syncVaultItemsFromSupabase() {
  if (typeof window === "undefined") return [];
  if (!hasSupabaseEnv()) return loadRawItems();

  try {
    const activeProfileId = getActiveProfileId();
    if (activeProfileId) await checkForceClearVault(activeProfileId);

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
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getTierSafe } = require("./subscription") as typeof import("./subscription");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getVaultItemLimit } = require("./galleryTier") as typeof import("./galleryTier");
    const tier = getTierSafe();
    const limit = getVaultItemLimit(tier);
    if (isFinite(limit) && existing.length >= limit) {
      throw new Error(
        `FREE_TIER_LIMIT:You've reached the ${limit}-item limit on the free plan. Upgrade to add more items.`
      );
    }
  }

  saveRawItems([...existing, ...items.map(syncPrimaryFields)]);
}

export function deleteVaultItem(itemId: string) {
  const next = loadRawItems().filter((item) => String(item.id) !== String(itemId));
  saveRawItems(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("vltd:vault-updated"));
  }
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

export function seedDemoIfEmpty() {
  const existing = loadItems();

  if (!existing.length) {
    const activeProfileId = getActiveProfileId();
    const demo = getDemoItems().map((item) =>
      activeProfileId ? { ...item, profile_id: activeProfileId } : item
    );
    saveItems(demo);
  }
}

export function loadItemsOrSeed(seed?: VaultItem[]) {
  const existing = loadItems();
  if (existing.length > 0) return existing;

  const activeProfileId = getActiveProfileId();
  const safeSeed = Array.isArray(seed) ? seed.filter(Boolean).map((item) =>
    syncPrimaryFields(activeProfileId ? { ...item, profile_id: activeProfileId } : item)
  ) : [];

  if (safeSeed.length > 0) {
    saveItems(safeSeed);
    return loadItems();
  }

  return existing;
}

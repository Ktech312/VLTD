export type BulkAddFieldKey =
  | "title"
  | "subtitle"
  | "number"
  | "grade"
  | "conditionReason"
  | "conditionSource"
  | "purchasePrice"
  | "currentValue"
  | "universe"
  | "category"
  | "categoryLabel"
  | "subcategoryLabel"
  | "storageLocation"
  | "purchaseSource"
  | "purchaseLocation"
  | "certNumber"
  | "serialNumber"
  | "subject"
  | "edition"
  | "variant"
  | "printRun"
  | "isFirstEdition"
  | "notes"
  | "tcgParallelType"
  | "tcgSetCode"
  | "tcgHoloType"
  | "sportsParallelType"
  | "sportsIsRelic"
  | "sportsRelicDescription"
  | "sportsIsAuto"
  | "sportsSerialNumber"
  | "vinylPressing"
  | "vinylLabel"
  | "vinylMatrix"
  | "vinylSpeedRpm"
  | "vinylColor"
  | "comicIssueNumber"
  | "comicCoverVariant"
  | "comicArcTitle"
  // TCG additions
  | "tcgRarity"
  | "tcgLanguage"
  | "tcgGradingCompany"
  // Sports Cards additions
  | "sportsSport"
  | "sportsTeam"
  | "sportsGradingCompany"
  | "sportsPop"
  | "sportsAutoAuth"
  // Memorabilia
  | "memorabiliaTeam"
  | "memorabiliaEvent"
  | "memorabiliaSigningDate"
  | "memorabiliaWitnessed"
  | "memorabiliaAuthCompany"
  | "memorabiliaGameUsed"
  | "memorabiliaGameUsedDesc"
  // Vinyl additions
  | "vinylCountry"
  | "vinylSleeveCondition"
  | "vinylInserts"
  | "vinylGatefold"
  // Comics expanded
  | "comicPublisher"
  | "comicCoverDate"
  | "comicGradingCompany"
  | "comicPageQuality"
  | "comicRestorationStatus"
  | "comicHolderType"
  | "comicCensusRank"
  // Original Comic Art
  | "artPenciller"
  | "artInker"
  | "artColorist"
  | "artType"
  | "artFirstAppearance"
  // Toys
  | "toyBrand"
  | "toyLine"
  | "toyScale"
  | "toyPackageCondition"
  | "toyBoxIncluded"
  | "toyAccessoriesIncluded"
  | "toyIsComplete"
  // Art Cards
  | "artCardArtist"
  | "artCardSet"
  | "artCardType"
  // Art & Prints
  | "artMedium"
  | "artSurface"
  | "artHeight"
  | "artWidth"
  | "artDepth"
  | "artIsFramed"
  | "artIsSigned"
  | "artSignatureLocation"
  | "artProvenance"
  | "artExhibitions"
  // Watches
  | "watchBrand"
  | "watchReference"
  | "watchMovement"
  | "watchCaseMaterial"
  | "watchCaseSize"
  | "watchDialColor"
  | "watchBox"
  | "watchPapers"
  | "watchFullSet"
  // Bags
  | "bagBrand"
  | "bagColor"
  | "bagMaterial"
  | "bagHardware"
  | "bagAuthCard"
  | "bagDustbag"
  | "bagBox"
  // Apparel
  | "apparelSize"
  | "apparelColorway"
  | "apparelWorn"
  // Games
  | "gamePlatform"
  | "gameRegion"
  | "gameGradingCompany"
  | "gameIsSealed"
  | "gameIsCIB"
  | "gameHasManual"
  | "gamePublisher"
  // Coins
  | "coinDenomination"
  | "coinCountry"
  | "coinMint"
  | "coinMintMark"
  | "coinGradingCompany"
  | "coinPopulation"
  | "coinError"
  | "coinKeyDate";

export type BulkAddValues = Record<BulkAddFieldKey, string>;
export type BulkAddLocks = Record<BulkAddFieldKey, boolean>;

export const BULK_ADD_STATE_STORAGE_KEY = "vltd_bulk_add_state_v1";

export const EMPTY_BULK_ADD_VALUES: BulkAddValues = {
  title: "",
  subtitle: "",
  number: "",
  grade: "",
  conditionReason: "",
  conditionSource: "",
  purchasePrice: "",
  currentValue: "",
  universe: "",
  category: "",
  categoryLabel: "",
  subcategoryLabel: "",
  storageLocation: "",
  purchaseSource: "",
  purchaseLocation: "",
  certNumber: "",
  serialNumber: "",
  subject: "",
  edition: "",
  variant: "",
  printRun: "",
  isFirstEdition: "",
  notes: "",
  tcgParallelType: "",
  tcgSetCode: "",
  tcgHoloType: "",
  sportsParallelType: "",
  sportsIsRelic: "",
  sportsRelicDescription: "",
  sportsIsAuto: "",
  sportsSerialNumber: "",
  vinylPressing: "",
  vinylLabel: "",
  vinylMatrix: "",
  vinylSpeedRpm: "",
  vinylColor: "",
  comicIssueNumber: "",
  comicCoverVariant: "",
  comicArcTitle: "",
  tcgRarity: "",
  tcgLanguage: "",
  tcgGradingCompany: "",
  sportsSport: "",
  sportsTeam: "",
  sportsGradingCompany: "",
  sportsPop: "",
  sportsAutoAuth: "",
  memorabiliaTeam: "",
  memorabiliaEvent: "",
  memorabiliaSigningDate: "",
  memorabiliaWitnessed: "",
  memorabiliaAuthCompany: "",
  memorabiliaGameUsed: "",
  memorabiliaGameUsedDesc: "",
  vinylCountry: "",
  vinylSleeveCondition: "",
  vinylInserts: "",
  vinylGatefold: "",
  comicPublisher: "",
  comicCoverDate: "",
  comicGradingCompany: "",
  comicPageQuality: "",
  comicRestorationStatus: "",
  comicHolderType: "",
  comicCensusRank: "",
  artPenciller: "",
  artInker: "",
  artColorist: "",
  artType: "",
  artFirstAppearance: "",
  toyBrand: "",
  toyLine: "",
  toyScale: "",
  toyPackageCondition: "",
  toyBoxIncluded: "",
  toyAccessoriesIncluded: "",
  toyIsComplete: "",
  artCardArtist: "",
  artCardSet: "",
  artCardType: "",
  artMedium: "",
  artSurface: "",
  artHeight: "",
  artWidth: "",
  artDepth: "",
  artIsFramed: "",
  artIsSigned: "",
  artSignatureLocation: "",
  artProvenance: "",
  artExhibitions: "",
  watchBrand: "",
  watchReference: "",
  watchMovement: "",
  watchCaseMaterial: "",
  watchCaseSize: "",
  watchDialColor: "",
  watchBox: "",
  watchPapers: "",
  watchFullSet: "",
  bagBrand: "",
  bagColor: "",
  bagMaterial: "",
  bagHardware: "",
  bagAuthCard: "",
  bagDustbag: "",
  bagBox: "",
  apparelSize: "",
  apparelColorway: "",
  apparelWorn: "",
  gamePlatform: "",
  gameRegion: "",
  gameGradingCompany: "",
  gameIsSealed: "",
  gameIsCIB: "",
  gameHasManual: "",
  gamePublisher: "",
  coinDenomination: "",
  coinCountry: "",
  coinMint: "",
  coinMintMark: "",
  coinGradingCompany: "",
  coinPopulation: "",
  coinError: "",
  coinKeyDate: "",
};

export const DEFAULT_BULK_ADD_LOCKS: BulkAddLocks = {
  title: false,
  subtitle: false,
  number: false,
  grade: false,
  conditionReason: false,
  conditionSource: false,
  purchasePrice: false,
  currentValue: false,
  universe: true,
  category: true,
  categoryLabel: false,
  subcategoryLabel: false,
  storageLocation: true,
  purchaseSource: true,
  purchaseLocation: false,
  certNumber: false,
  serialNumber: false,
  subject: false,
  edition: false,
  variant: false,
  printRun: false,
  isFirstEdition: false,
  notes: false,
  tcgParallelType: false,
  tcgSetCode: false,
  tcgHoloType: false,
  sportsParallelType: false,
  sportsIsRelic: false,
  sportsRelicDescription: false,
  sportsIsAuto: false,
  sportsSerialNumber: false,
  vinylPressing: false,
  vinylLabel: false,
  vinylMatrix: false,
  vinylSpeedRpm: false,
  vinylColor: false,
  comicIssueNumber: false,
  comicCoverVariant: false,
  comicArcTitle: false,
  tcgRarity: false,
  tcgLanguage: false,
  tcgGradingCompany: false,
  sportsSport: false,
  sportsTeam: false,
  sportsGradingCompany: false,
  sportsPop: false,
  sportsAutoAuth: false,
  memorabiliaTeam: false,
  memorabiliaEvent: false,
  memorabiliaSigningDate: false,
  memorabiliaWitnessed: false,
  memorabiliaAuthCompany: false,
  memorabiliaGameUsed: false,
  memorabiliaGameUsedDesc: false,
  vinylCountry: false,
  vinylSleeveCondition: false,
  vinylInserts: false,
  vinylGatefold: false,
  comicPublisher: false,
  comicCoverDate: false,
  comicGradingCompany: false,
  comicPageQuality: false,
  comicRestorationStatus: false,
  comicHolderType: false,
  comicCensusRank: false,
  artPenciller: false,
  artInker: false,
  artColorist: false,
  artType: false,
  artFirstAppearance: false,
  toyBrand: false,
  toyLine: false,
  toyScale: false,
  toyPackageCondition: false,
  toyBoxIncluded: false,
  toyAccessoriesIncluded: false,
  toyIsComplete: false,
  artCardArtist: false,
  artCardSet: false,
  artCardType: false,
  artMedium: false,
  artSurface: false,
  artHeight: false,
  artWidth: false,
  artDepth: false,
  artIsFramed: false,
  artIsSigned: false,
  artSignatureLocation: false,
  artProvenance: false,
  artExhibitions: false,
  watchBrand: false,
  watchReference: false,
  watchMovement: false,
  watchCaseMaterial: false,
  watchCaseSize: false,
  watchDialColor: false,
  watchBox: false,
  watchPapers: false,
  watchFullSet: false,
  bagBrand: false,
  bagColor: false,
  bagMaterial: false,
  bagHardware: false,
  bagAuthCard: false,
  bagDustbag: false,
  bagBox: false,
  apparelSize: false,
  apparelColorway: false,
  apparelWorn: false,
  gamePlatform: false,
  gameRegion: false,
  gameGradingCompany: false,
  gameIsSealed: false,
  gameIsCIB: false,
  gameHasManual: false,
  gamePublisher: false,
  coinDenomination: false,
  coinCountry: false,
  coinMint: false,
  coinMintMark: false,
  coinGradingCompany: false,
  coinPopulation: false,
  coinError: false,
  coinKeyDate: false,
};

export type BulkAddState = {
  locks: BulkAddLocks;
  rememberedValues: Partial<BulkAddValues>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeLocks(input: unknown): BulkAddLocks {
  const next: BulkAddLocks = { ...DEFAULT_BULK_ADD_LOCKS };

  if (!isRecord(input)) return next;

  for (const key of Object.keys(DEFAULT_BULK_ADD_LOCKS) as BulkAddFieldKey[]) {
    if (typeof input[key] === "boolean") {
      next[key] = input[key] as boolean;
    }
  }

  return next;
}

function sanitizeRememberedValues(input: unknown): Partial<BulkAddValues> {
  const next: Partial<BulkAddValues> = {};

  if (!isRecord(input)) return next;

  for (const key of Object.keys(EMPTY_BULK_ADD_VALUES) as BulkAddFieldKey[]) {
    const raw = input[key];
    if (typeof raw === "string") {
      next[key] = raw;
    }
  }

  return next;
}

export function createDefaultBulkAddState(): BulkAddState {
  return {
    locks: { ...DEFAULT_BULK_ADD_LOCKS },
    rememberedValues: {},
  };
}

export function readBulkAddState(): BulkAddState {
  if (typeof window === "undefined") {
    return createDefaultBulkAddState();
  }

  try {
    const raw = window.localStorage.getItem(BULK_ADD_STATE_STORAGE_KEY);
    if (!raw) return createDefaultBulkAddState();

    const parsed: unknown = JSON.parse(raw);

    if (!isRecord(parsed)) return createDefaultBulkAddState();

    return {
      locks: sanitizeLocks(parsed.locks),
      rememberedValues: sanitizeRememberedValues(parsed.rememberedValues),
    };
  } catch {
    return createDefaultBulkAddState();
  }
}

export function writeBulkAddState(state: BulkAddState) {
  if (typeof window === "undefined") return;

  const safeState: BulkAddState = {
    locks: sanitizeLocks(state.locks),
    rememberedValues: sanitizeRememberedValues(state.rememberedValues),
  };

  window.localStorage.setItem(BULK_ADD_STATE_STORAGE_KEY, JSON.stringify(safeState));
}

export function clearBulkAddState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(BULK_ADD_STATE_STORAGE_KEY);
}

export function buildRememberedValues(
  values: Partial<BulkAddValues>,
  locks: BulkAddLocks
): Partial<BulkAddValues> {
  const remembered: Partial<BulkAddValues> = {};

  for (const key of Object.keys(EMPTY_BULK_ADD_VALUES) as BulkAddFieldKey[]) {
    if (!locks[key]) continue;

    const value = typeof values[key] === "string" ? values[key] : "";
    if (value.trim()) {
      remembered[key] = value;
    }
  }

  return remembered;
}

export function applyBulkLockedValues(
  baseValues?: Partial<BulkAddValues>,
  rememberedValues?: Partial<BulkAddValues>,
  locks?: Partial<BulkAddLocks>
): BulkAddValues {
  const next: BulkAddValues = { ...EMPTY_BULK_ADD_VALUES };

  const safeLocks = sanitizeLocks(locks ?? DEFAULT_BULK_ADD_LOCKS);
  const safeRemembered = sanitizeRememberedValues(rememberedValues ?? {});
  const safeBase = sanitizeRememberedValues(baseValues ?? {});

  for (const key of Object.keys(EMPTY_BULK_ADD_VALUES) as BulkAddFieldKey[]) {
    const baseValue = safeBase[key];
    if (typeof baseValue === "string") {
      next[key] = baseValue;
      continue;
    }

    if (safeLocks[key] && typeof safeRemembered[key] === "string") {
      next[key] = safeRemembered[key] as string;
    }
  }

  return next;
}

export function resetUnlockedBulkValues(
  values: Partial<BulkAddValues>,
  locks: BulkAddLocks
): BulkAddValues {
  const next: BulkAddValues = { ...EMPTY_BULK_ADD_VALUES };
  const safeLocks = sanitizeLocks(locks);
  const safeValues = sanitizeRememberedValues(values);

  for (const key of Object.keys(EMPTY_BULK_ADD_VALUES) as BulkAddFieldKey[]) {
    if (safeLocks[key] && typeof safeValues[key] === "string") {
      next[key] = safeValues[key] as string;
    }
  }

  return next;
}

export function toggleBulkAddLock(
  locks: BulkAddLocks,
  key: BulkAddFieldKey
): BulkAddLocks {
  return {
    ...sanitizeLocks(locks),
    [key]: !locks[key],
  };
}

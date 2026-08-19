 "use client";

import { newId } from "@/lib/id";
import { appendItems, getAllLocalItems, saveItems, type VaultItem } from "@/lib/vaultModel";
import { enqueueVaultItemSync, removeVaultItemFromSyncQueue } from "@/lib/vaultSyncQueue";

export const LS_KEY = "vltd_vault_items_v1";
export const ACTIVE_PROFILE_KEY = "vltd_active_profile_id_v1";
export const IMPORT_HISTORY_KEY = "vltd_import_history_v1";

export type ParsedImportItem = VaultItem & {
  sourceSheet?: string;
  structuredData?: Record<string, string>;
  missingCost?: boolean;
};

export type IgnoredImportRow = {
  source: string;
  rowNumber: number;
  reason: string;
  raw: Record<string, unknown>;
};

export type DuplicateGroup = {
  key: string;
  items: ParsedImportItem[];
};

export type ExistingDuplicateGroup = {
  key: string;
  importItems: ParsedImportItem[];
  existingItems: VaultItem[];
};

export type LikelyDuplicateCandidate = {
  importItem: ParsedImportItem;
  existingItem: VaultItem;
  score: number;
  reasons: string[];
};

export type ImportHistoryEntry = {
  id: string;
  sourceLabel: string;
  importedAt: number;
  itemIds: string[];
  itemCount: number;
  skippedCount: number;
};

export type MappingField =
  | "ignore"
  | "reference"
  | "player"
  | "brand"
  | "manufacturer"
  | "number"
  | "specialty"
  | "purchaseFrom"
  | "purchaseDate"
  | "purchaseLocation"
  | "auctionNumber"
  | "gradedBy"
  | "grade"
  | "authNumber"
  | "barcode"
  | "estimatedValue"
  | "quantity"
  | "notes"
  | "condition"
  | "storageLocation"
  | "askingPrice"
  | "status"
  | "month"
  | "year"
  | "subtitle"
  | "currentValue"
  | "purchasePrice"
  | "universe"
  | "category"
  | "subcategory"
  | "serialNumber"
  | "edition"
  | "variant";

export type ParsedSourceSheet = {
  sheetName: string;
  headers: string[];
  rows: Record<string, unknown>[];
};

export type ParsedImportSource = {
  sourceLabel: string;
  sheets: ParsedSourceSheet[];
};

export type MappingProfile = Record<string, Record<string, MappingField>>;

type RowRecord = Record<string, unknown>;

const HEADER_ALIASES: Record<Exclude<MappingField, "ignore">, string[]> = {
  reference: ["reference#", "referece#", "ref #", "ref#", "reference number"],
  player: ["player name", "name", "display name", "character name", "title"],
  brand: ["brand name", "brand"],
  manufacturer: ["manufacturer", "maker", "publisher", "company"],
  number: ["card #", "issue #", "number", "#"],
  specialty: ["speciality card", "specialty card", "cover title", "playmate names cover title"],
  purchaseFrom: ["purchase from", "seller", "vendor", "source"],
  purchaseDate: ["purchase date", "date purchased", "order date", "sold date", "transaction date"],
  purchaseLocation: ["purchase location", "location", "venue", "show"],
  auctionNumber: ["auction #"],
  gradedBy: ["graded by"],
  grade: ["grade"],
  authNumber: ["authentic #", "cert #", "cert number"],
  barcode: ["barcode", "upc", "ean", "isbn"],
  estimatedValue: ["estimated value", "market value", "value estimate"],
  quantity: ["quanity", "quantity"],
  notes: ["notes"],
  condition: ["condition"],
  storageLocation: ["storage location", "bin", "box", "shelf", "location code"],
  askingPrice: ["asking price", "list price", "listing price", "price"],
  status: ["status", "inventory status"],
  month: ["month"],
  year: ["year"],
  subtitle: ["subtitle"],
  currentValue: ["current value"],
  purchasePrice: ["purchase price"],
  universe: ["universe", "universekey"],
  category: ["category", "category label"],
  subcategory: ["subcategory", "subcategory label"],
  serialNumber: ["serial number", "serial #", "slab serial"],
  edition: ["edition", "printing", "release"],
  variant: ["variant", "parallel", "cover", "variation"],
};

export const MAPPING_OPTIONS: Array<{ value: MappingField; label: string }> = [
  { value: "ignore", label: "Ignore" },
  { value: "reference", label: "Reference #" },
  { value: "player", label: "Player / Name / Title" },
  { value: "brand", label: "Brand" },
  { value: "manufacturer", label: "Manufacturer / Publisher" },
  { value: "number", label: "Card # / Issue #" },
  { value: "specialty", label: "Specialty / Cover Title" },
  { value: "purchaseFrom", label: "Purchase From" },
  { value: "purchaseDate", label: "Purchase Date" },
  { value: "purchaseLocation", label: "Purchase Location" },
  { value: "auctionNumber", label: "Auction #" },
  { value: "gradedBy", label: "Graded By" },
  { value: "grade", label: "Grade" },
  { value: "authNumber", label: "Authentic / Cert #" },
  { value: "barcode", label: "Barcode / UPC / ISBN" },
  { value: "estimatedValue", label: "Estimated Value" },
  { value: "purchasePrice", label: "Purchase Price" },
  { value: "currentValue", label: "Current Value" },
  { value: "askingPrice", label: "Asking Price" },
  { value: "quantity", label: "Quantity" },
  { value: "condition", label: "Condition" },
  { value: "storageLocation", label: "Storage Location" },
  { value: "status", label: "Status" },
  { value: "notes", label: "Notes" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "subtitle", label: "Subtitle" },
  { value: "universe", label: "Universe" },
  { value: "category", label: "Category" },
  { value: "subcategory", label: "Subcategory" },
  { value: "serialNumber", label: "Serial Number" },
  { value: "edition", label: "Edition" },
  { value: "variant", label: "Variant" },
];

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\n\r\t]/g, " ")
    .replace(/[^a-z0-9# ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stringify(value: unknown) {
  if (value == null) return "";
  return String(value).trim();
}

function parseSingleNumber(value: unknown): number | undefined {
  const text = stringify(value);
  if (!text) return undefined;
  const matches = text.match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length !== 1) return undefined;
  const next = Number(matches[0]);
  return Number.isFinite(next) ? next : undefined;
}

function parsePositiveInteger(value: unknown) {
  const n = Number(String(value ?? "").trim());
  if (!Number.isFinite(n)) return 1;
  return Math.min(250, Math.max(1, Math.floor(n)));
}

function parseStatus(value: unknown): VaultItem["status"] | undefined {
  const normalized = stringify(value).toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes("sold")) return "SOLD";
  if (normalized.includes("wish")) return "WISHLIST";
  if (normalized.includes("sale") || normalized.includes("listed")) return "FOR_SALE";
  if (normalized.includes("collection") || normalized.includes("owned")) return "COLLECTION";
  return undefined;
}

function countRecognizedHeaders(row: unknown[]) {
  return row.reduce<number>((count, cell) => {
    const normalized = normalizeHeader(cell);
    if (!normalized) return count;
    return getDefaultMappingForHeader(String(cell)) !== "ignore" ? count + 1 : count;
  }, 0);
}

function detectHeaderRow(rows: unknown[][]) {
  let bestIndex = -1;
  let bestScore = 0;
  const searchLimit = Math.min(8, rows.length);

  for (let i = 0; i < searchLimit; i += 1) {
    const score = countRecognizedHeaders(rows[i] ?? []);
    if (score > bestScore) {
      bestIndex = i;
      bestScore = score;
    }
  }

  return bestScore >= 3 ? bestIndex : -1;
}

function rowFromHeaders(headers: string[], values: unknown[]) {
  const out: RowRecord = {};
  headers.forEach((header, index) => {
    if (!header) return;
    out[header] = values[index];
  });
  return out;
}

function detectKind(sheetName: string) {
  const name = sheetName.toLowerCase();
  if (name.includes("mlb") || name.includes("nba") || name.includes("nfl") || name.includes("nhl") || name.includes("socc")) return "sports_cards";
  if (name.includes("sports")) return "sports_cards";
  if (name.includes("tcg") || name.includes("non sports")) return "tcg_cards";
  if (name.includes("memorabilia")) return "memorabilia";
  if (name.includes("comic")) return "comics";
  if (name.includes("toy")) return "toys";
  if (name.includes("magazine")) return "magazines";
  return "generic";
}

function appendNote(notes: string[], label: string, value: unknown) {
  const text = stringify(value);
  if (!text || text === "-") return;
  notes.push(`${label}: ${text}`);
}

function buildTitle(kind: string, row: RowRecord) {
  const player = stringify(row.player);
  const brand = stringify(row.brand || row.manufacturer);
  const number = stringify(row.number);
  const specialty = stringify(row.specialty);
  const subtitle = stringify(row.subtitle);
  const edition = stringify(row.edition);
  const variant = stringify(row.variant);

  if (kind === "sports_cards" || kind === "tcg_cards") {
    return [player, brand, number, variant].filter(Boolean).join(" - ") || [player, specialty].filter(Boolean).join(" - ");
  }
  if (kind === "comics" || kind === "magazines") {
    const month = stringify(row.month);
    const year = stringify(row.year);
    return [player, number, edition || variant, month, year].filter(Boolean).join(" - ");
  }
  if (kind === "toys" || kind === "memorabilia") {
    return [brand, player, specialty || subtitle].filter(Boolean).join(" - ");
  }
  return [player, brand, specialty || subtitle, variant].filter(Boolean).join(" - ");
}

function buildSubtitle(row: RowRecord) {
  const parts: string[] = [];
  const specialty = stringify(row.specialty);
  const condition = stringify(row.condition);
  const gradedBy = stringify(row.gradedBy);
  const grade = stringify(row.grade);
  const subtitle = stringify(row.subtitle);
  const edition = stringify(row.edition);
  const variant = stringify(row.variant);

  if (subtitle) parts.push(subtitle);
  if (specialty && specialty !== subtitle) parts.push(specialty);
  if (edition) parts.push(edition);
  if (variant) parts.push(variant);
  if (condition) parts.push(condition);
  if (gradedBy || grade) parts.push([gradedBy, grade].filter(Boolean).join(" "));
  return parts.join(" - ") || undefined;
}

function universeForKind(kind: string) {
  if (kind === "sports_cards" || kind === "memorabilia") return "SPORTS";
  if (kind === "tcg_cards") return "TCG";
  if (kind === "comics" || kind === "toys") return "POP_CULTURE";
  if (kind === "magazines") return "MISC";
  return "MISC";
}

function categoryForKind(kind: string, sheetName: string) {
  const lowered = sheetName.toLowerCase();

  if (kind === "sports_cards") {
    let subcategoryLabel: string | undefined;
    if (lowered.includes("mlb") || lowered.includes("baseball")) subcategoryLabel = "Baseball";
    else if (lowered.includes("nba") || lowered.includes("basketball")) subcategoryLabel = "Basketball";
    else if (lowered.includes("nfl") || lowered.includes("football")) subcategoryLabel = "Football";
    else if (lowered.includes("nhl") || lowered.includes("hockey")) subcategoryLabel = "Hockey";
    else if (lowered.includes("socc") || lowered.includes("soccer")) subcategoryLabel = "Soccer";
    return { categoryLabel: "Sports Cards", subcategoryLabel };
  }

  if (kind === "memorabilia") return { categoryLabel: "Memorabilia", subcategoryLabel: undefined };
  if (kind === "tcg_cards") return { categoryLabel: "Pokemon", subcategoryLabel: undefined };
  if (kind === "comics") return { categoryLabel: "Comics", subcategoryLabel: undefined };
  if (kind === "toys") return { categoryLabel: "Toys", subcategoryLabel: undefined };
  if (kind === "magazines") return { categoryLabel: "Collectors Choice", subcategoryLabel: "Books" };
  return { categoryLabel: "Collectors Choice", subcategoryLabel: undefined };
}

export function getDefaultMappingForHeader(rawHeader: string): MappingField {
  const normalized = normalizeHeader(rawHeader);
  if (!normalized) return "ignore";

  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(normalized)) return key as MappingField;
  }

  if (normalized.includes("estimated value")) return "estimatedValue";
  if (normalized.includes("market value")) return "estimatedValue";
  if (normalized.includes("purchase price")) return "purchasePrice";
  if (normalized.includes("asking price")) return "askingPrice";
  if (normalized.includes("list price")) return "askingPrice";
  if (normalized.includes("graded by")) return "gradedBy";
  if (normalized.includes("authentic")) return "authNumber";
  if (normalized.includes("cert")) return "authNumber";
  if (normalized.includes("card #")) return "number";
  if (normalized.includes("issue #")) return "number";
  if (normalized.includes("serial")) return "serialNumber";
  if (normalized.includes("storage")) return "storageLocation";
  if (normalized.includes("quantity")) return "quantity";
  if (normalized.includes("note")) return "notes";
  return "ignore";
}

export function buildDefaultMappingProfile(source: ParsedImportSource): MappingProfile {
  const profile: MappingProfile = {};
  source.sheets.forEach((sheet) => {
    profile[sheet.sheetName] = {};
    sheet.headers.forEach((header) => {
      profile[sheet.sheetName][header] = getDefaultMappingForHeader(header);
    });
  });
  return profile;
}

function applyMappingToRow(rawRow: Record<string, unknown>, mapping: Record<string, MappingField>): RowRecord {
  const out: RowRecord = {};
  Object.entries(mapping).forEach(([header, field]) => {
    if (!field || field === "ignore") return;
    out[field] = rawRow[header];
  });
  return out;
}

function mapRowToItems(sheetName: string, rowNumber: number, row: RowRecord) {
  const kind = detectKind(sheetName);
  const title = buildTitle(kind, row).trim();

  if (!title) {
    return {
      items: [] as ParsedImportItem[],
      ignored: {
        source: sheetName,
        rowNumber,
        reason: "Missing usable title after mapping.",
        raw: row,
      },
    };
  }

  const quantity = parsePositiveInteger(row.quantity);
  const currentValue = parseSingleNumber(row.estimatedValue ?? row.currentValue);
  const purchasePriceRaw = parseSingleNumber(row.purchasePrice);
  const askingPrice = parseSingleNumber(row.askingPrice);
  const purchasePrice = purchasePriceRaw ?? 0;
  const missingCost = purchasePriceRaw == null;

  const notes: string[] = [];
  appendNote(notes, "Reference", row.reference);
  appendNote(notes, "Purchase From", row.purchaseFrom);
  appendNote(notes, "Purchase Date", row.purchaseDate);
  appendNote(notes, "Auction #", row.auctionNumber);
  appendNote(notes, "Condition", row.condition);
  appendNote(notes, "Barcode", row.barcode);
  appendNote(notes, "Notes", row.notes);

  const estimatedText = stringify(row.estimatedValue ?? row.currentValue);
  const estimatedMatches = estimatedText.match(/-?\d+(?:\.\d+)?/g);
  if (estimatedText && estimatedMatches && estimatedMatches.length > 1) {
    notes.push(`Estimated Value Raw: ${estimatedText}`);
  }

  const categories = categoryForKind(kind, sheetName);

  const structuredData: Record<string, string> = {
    player: stringify(row.player),
    brand: stringify(row.brand),
    manufacturer: stringify(row.manufacturer),
    number: stringify(row.number),
    specialty: stringify(row.specialty),
    gradedBy: stringify(row.gradedBy),
    grade: stringify(row.grade),
    authNumber: stringify(row.authNumber),
    barcode: stringify(row.barcode),
    purchaseFrom: stringify(row.purchaseFrom),
    purchaseDate: stringify(row.purchaseDate),
    purchaseLocation: stringify(row.purchaseLocation),
    auctionNumber: stringify(row.auctionNumber),
    condition: stringify(row.condition),
    storageLocation: stringify(row.storageLocation),
    month: stringify(row.month),
    year: stringify(row.year),
    subtitle: stringify(row.subtitle),
    serialNumber: stringify(row.serialNumber),
    edition: stringify(row.edition),
    variant: stringify(row.variant),
  };

  const base: ParsedImportItem = {
    id: newId(),
    title,
    subtitle: buildSubtitle(row),
    number: stringify(row.number) || undefined,
    grade: [stringify(row.gradedBy), stringify(row.grade)].filter(Boolean).join(" ").trim() || undefined,
    purchasePrice,
    currentValue,
    askingPrice,
    notes: notes.length ? notes.join("\\n") : undefined,
    purchaseSource: stringify(row.purchaseFrom) || undefined,
    purchaseLocation: stringify(row.purchaseLocation) || undefined,
    orderNumber: stringify(row.auctionNumber) || undefined,
    certNumber: stringify(row.authNumber) || undefined,
    serialNumber: stringify(row.serialNumber) || undefined,
    edition: stringify(row.edition) || undefined,
    variant: stringify(row.variant) || undefined,
    storageLocation: stringify(row.storageLocation) || undefined,
    universe: stringify(row.universe) || universeForKind(kind),
    categoryLabel: stringify(row.category) || categories.categoryLabel,
    subcategoryLabel: stringify(row.subcategory) || categories.subcategoryLabel,
    status: parseStatus(row.status),
    sourceSheet: sheetName,
    structuredData,
    missingCost,
    createdAt: Date.now() + rowNumber,
  };

  const items: ParsedImportItem[] = [];
  for (let i = 0; i < quantity; i += 1) {
    items.push({
      ...base,
      id: newId(),
      createdAt: (base.createdAt ?? Date.now()) + i,
    });
  }
  return { items };
}

function parseRowsToSheet(sheetName: string, rows: unknown[][]): ParsedSourceSheet | null {
  const headerIndex = detectHeaderRow(rows);
  if (headerIndex === -1) return null;

  const headers = (rows[headerIndex] ?? []).map((cell) => String(cell ?? "").trim()).filter(Boolean);
  if (headers.length === 0) return null;

  const parsedRows: Record<string, unknown>[] = [];
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const rawRow = rows[i] ?? [];
    if (!rawRow.some((cell) => stringify(cell))) continue;
    parsedRows.push(rowFromHeaders(headers, rawRow));
  }

  return { sheetName, headers, rows: parsedRows };
}

function parseSimpleLines(input: string): ParsedImportSource {
  const lines = input.replace(/\r/g, "").split("\n").map((line) => line.trim()).filter(Boolean);
  return {
    sourceLabel: "Paste",
    sheets: [{ sheetName: "Paste", headers: ["Title"], rows: lines.map((title) => ({ Title: title })) }],
  };
}

function parseDelimitedRows(input: string, delimiter: "," | "\t") {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const nextChar = input[index + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        cell += "\"";
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function parsePastedSource(input: string): ParsedImportSource {
  const cleaned = input.replace(/\r/g, "").trim();
  if (!cleaned) return { sourceLabel: "Paste", sheets: [] };

  const lines = cleaned.split("\n");
  const hasTabs = lines.some((line) => line.includes("\t"));
  const hasCommas = !hasTabs && lines.some((line) => line.includes(","));

  if (!hasTabs && !hasCommas) return parseSimpleLines(cleaned);

  const delimiter = hasTabs ? "\t" : ",";
  const rows = parseDelimitedRows(cleaned, delimiter);
  const sheet = parseRowsToSheet("Paste", rows);

  return { sourceLabel: "Paste", sheets: sheet ? [sheet] : [] };
}

export async function parseSpreadsheetSource(file: File): Promise<ParsedImportSource> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  const sheets: ParsedSourceSheet[] = [];
  workbook.SheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as unknown[][];
    const parsed = parseRowsToSheet(sheetName, rows);
    if (parsed) sheets.push(parsed);
  });

  return { sourceLabel: file.name, sheets };
}

export function buildItemsFromSource(source: ParsedImportSource, mapping: MappingProfile) {
  const items: ParsedImportItem[] = [];
  const ignoredRows: IgnoredImportRow[] = [];

  source.sheets.forEach((sheet) => {
    const sheetMapping = mapping[sheet.sheetName] ?? {};
    sheet.rows.forEach((rawRow, index) => {
      const mappedRow = applyMappingToRow(rawRow, sheetMapping);
      const built = mapRowToItems(sheet.sheetName, index + 1, mappedRow);
      items.push(...built.items);
      if ("ignored" in built && built.ignored) ignoredRows.push(built.ignored);
    });
  });

  return { items, ignoredRows, sourceLabel: source.sourceLabel };
}

export function getActiveProfileId() {
  if (typeof window === "undefined") return "";
  try {
    return String(window.localStorage.getItem(ACTIVE_PROFILE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

function normalizeItem(raw: unknown): VaultItem | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const title = String(record.title ?? "").trim();
  if (!title) return null;

  return {
    id: String(record.id ?? "").trim() || newId(),
    profile_id: String(record.profile_id ?? record.profileId ?? "").trim() || undefined,
    title,
    subtitle: typeof record.subtitle === "string" ? record.subtitle : undefined,
    number: typeof record.number === "string" ? record.number : undefined,
    grade: typeof record.grade === "string" ? record.grade : undefined,
    purchasePrice: Number.isFinite(Number(record.purchasePrice)) ? Number(record.purchasePrice) : undefined,
    currentValue: Number.isFinite(Number(record.currentValue)) ? Number(record.currentValue) : undefined,
    purchaseSource: typeof record.purchaseSource === "string" ? record.purchaseSource : undefined,
    orderNumber: typeof record.orderNumber === "string" ? record.orderNumber : undefined,
    certNumber: typeof record.certNumber === "string" ? record.certNumber : undefined,
    notes: typeof record.notes === "string" ? record.notes : undefined,
    universe: typeof record.universe === "string" ? record.universe : undefined,
    category: typeof record.category === "string" ? record.category : undefined,
    customCategoryLabel: typeof record.customCategoryLabel === "string" ? record.customCategoryLabel : undefined,
    categoryLabel: typeof record.categoryLabel === "string" ? record.categoryLabel : undefined,
    subcategoryLabel: typeof record.subcategoryLabel === "string" ? record.subcategoryLabel : undefined,
    createdAt: Number.isFinite(Number(record.createdAt)) ? Number(record.createdAt) : undefined,
  };
}

export function readRawVault(): VaultItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeItem).filter(Boolean) as VaultItem[];
  } catch {
    return [];
  }
}

export function readVaultForActiveProfile(): VaultItem[] {
  const all = readRawVault();
  const activeProfileId = getActiveProfileId();
  if (!activeProfileId) return all;

  const filtered = all.filter((item) => String(item.profile_id ?? "").trim() === activeProfileId);
  return filtered.length > 0 ? filtered : all;
}

function toVaultItem(item: ParsedImportItem): VaultItem {
  const { sourceSheet, structuredData, missingCost, ...vaultItem } = item;
  void sourceSheet;
  void structuredData;
  void missingCost;
  return vaultItem;
}

export function appendImportedItems(items: ParsedImportItem[]) {
  const activeProfileId = getActiveProfileId();
  const prepared = items.map((item) => ({
    ...toVaultItem(item),
    profile_id: item.profile_id || activeProfileId || undefined,
    addedVia: "import" as const,
  }));

  appendItems(prepared);
  prepared.forEach((item) => enqueueVaultItemSync(item.id));
  return prepared;
}

function readImportHistoryRaw(): ImportHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(IMPORT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const record = entry as Record<string, unknown>;
        const itemIds = Array.isArray(record.itemIds)
          ? record.itemIds.map((id) => String(id)).filter(Boolean)
          : [];
        const sourceLabel = String(record.sourceLabel ?? "").trim();
        if (!sourceLabel || itemIds.length === 0) return null;

        return {
          id: String(record.id ?? "").trim() || newId(),
          sourceLabel,
          importedAt: Number.isFinite(Number(record.importedAt)) ? Number(record.importedAt) : Date.now(),
          itemIds,
          itemCount: Number.isFinite(Number(record.itemCount)) ? Number(record.itemCount) : itemIds.length,
          skippedCount: Number.isFinite(Number(record.skippedCount)) ? Number(record.skippedCount) : 0,
        } satisfies ImportHistoryEntry;
      })
      .filter(Boolean) as ImportHistoryEntry[];
  } catch {
    return [];
  }
}

export function readImportHistory() {
  return readImportHistoryRaw()
    .sort((a, b) => Number(b.importedAt) - Number(a.importedAt))
    .slice(0, 10);
}

export function recordImportHistory(input: {
  sourceLabel: string;
  itemIds: string[];
  skippedCount?: number;
}) {
  if (typeof window === "undefined") return null;
  const itemIds = input.itemIds.map((id) => String(id)).filter(Boolean);
  if (itemIds.length === 0) return null;

  const entry: ImportHistoryEntry = {
    id: newId(),
    sourceLabel: input.sourceLabel,
    importedAt: Date.now(),
    itemIds,
    itemCount: itemIds.length,
    skippedCount: input.skippedCount ?? 0,
  };

  const next = [entry, ...readImportHistoryRaw()].slice(0, 10);
  window.localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(next));
  return entry;
}

export function undoLastImport() {
  if (typeof window === "undefined") return { removed: 0, entry: null as ImportHistoryEntry | null };
  const history = readImportHistory();
  const entry = history[0] ?? null;
  if (!entry) return { removed: 0, entry };

  const ids = new Set(entry.itemIds.map((id) => String(id)));
  const allItems = getAllLocalItems();
  const nextItems = allItems.filter((item) => !ids.has(String(item.id)));

  saveItems(nextItems);
  entry.itemIds.forEach(removeVaultItemFromSyncQueue);

  const remainingHistory = readImportHistoryRaw().filter((record) => String(record.id) !== String(entry.id));
  window.localStorage.setItem(IMPORT_HISTORY_KEY, JSON.stringify(remainingHistory));

  return { removed: allItems.length - nextItems.length, entry };
}

export async function downloadBlankSpreadsheetTemplate(filename = "vltd-blank-import-template.xlsx") {
  if (typeof window === "undefined") return;
  const link = document.createElement("a");
  link.href = "/vltd-blank-import-template.xlsx";
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function buildImportSummary(items: ParsedImportItem[], ignoredRows: IgnoredImportRow[]) {
  return {
    itemCount: items.length,
    ignoredCount: ignoredRows.length,
    missingCostCount: items.filter((item) => item.missingCost || Number(item.purchasePrice ?? 0) <= 0).length,
    totalCost: items.reduce((sum, item) => sum + Number(item.purchasePrice ?? 0), 0),
    totalEstimatedValue: items.reduce((sum, item) => sum + Number(item.currentValue ?? 0), 0),
    byCategory: items.reduce<Record<string, number>>((acc, item) => {
      const key = item.categoryLabel || "Uncategorized";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

export function detectDuplicateGroups(items: ParsedImportItem[]) {
  const map = new Map<string, ParsedImportItem[]>();
  items.forEach((item) => {
    const key = (item.title || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!key) return;
    const existing = map.get(key) ?? [];
    existing.push(item);
    map.set(key, existing);
  });

  return Array.from(map.entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, items: group }));
}

export function detectExistingDuplicateGroups(items: ParsedImportItem[], existingItems: VaultItem[]) {
  const existingByKey = new Map<string, VaultItem[]>();

  existingItems.forEach((item) => {
    const key = (item.title || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!key) return;
    const group = existingByKey.get(key) ?? [];
    group.push(item);
    existingByKey.set(key, group);
  });

  const importByKey = new Map<string, ParsedImportItem[]>();
  items.forEach((item) => {
    const key = (item.title || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || !existingByKey.has(key)) return;
    const group = importByKey.get(key) ?? [];
    group.push(item);
    importByKey.set(key, group);
  });

  return Array.from(importByKey.entries()).map(([key, importItems]) => ({
    key,
    importItems,
    existingItems: existingByKey.get(key) ?? [],
  }));
}

function normalizeDuplicateText(value?: string) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value?: string) {
  return new Set(normalizeDuplicateText(value).split(" ").filter((token) => token.length > 2));
}

function sharedTokenScore(a?: string, b?: string) {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  left.forEach((token) => {
    if (right.has(token)) shared += 1;
  });

  return shared / Math.max(left.size, right.size);
}

export function findLikelyDuplicateCandidates(items: ParsedImportItem[], existingItems: VaultItem[]) {
  const candidates: LikelyDuplicateCandidate[] = [];

  items.forEach((importItem) => {
    existingItems.forEach((existingItem) => {
      const reasons: string[] = [];
      let score = 0;
      const importTitle = normalizeDuplicateText(importItem.title);
      const existingTitle = normalizeDuplicateText(existingItem.title);

      if (importTitle && importTitle === existingTitle) {
        score += 70;
        reasons.push("same title");
      } else {
        const overlap = sharedTokenScore(importItem.title, existingItem.title);
        if (overlap >= 0.45) {
          score += Math.round(overlap * 45);
          reasons.push("similar title");
        }
      }

      if (importItem.number && existingItem.number && normalizeDuplicateText(importItem.number) === normalizeDuplicateText(existingItem.number)) {
        score += 18;
        reasons.push("same number");
      }

      if (importItem.certNumber && existingItem.certNumber && normalizeDuplicateText(importItem.certNumber) === normalizeDuplicateText(existingItem.certNumber)) {
        score += 35;
        reasons.push("same cert");
      }

      if (importItem.grade && existingItem.grade && normalizeDuplicateText(importItem.grade) === normalizeDuplicateText(existingItem.grade)) {
        score += 12;
        reasons.push("same grade");
      }

      if (importItem.categoryLabel && existingItem.categoryLabel && normalizeDuplicateText(importItem.categoryLabel) === normalizeDuplicateText(existingItem.categoryLabel)) {
        score += 8;
        reasons.push("same category");
      }

      if (score >= 52) {
        candidates.push({
          importItem,
          existingItem,
          score: Math.min(100, score),
          reasons,
        });
      }
    });
  });

  return candidates.sort((a, b) => b.score - a.score).slice(0, 50);
}

export type BulkAddFieldKey =
  | "title"
  | "subtitle"
  | "number"
  | "grade"
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
  | "notes";

export type BulkAddValues = Record<BulkAddFieldKey, string>;
export type BulkAddLocks = Record<BulkAddFieldKey, boolean>;

export const BULK_ADD_STATE_STORAGE_KEY = "vltd_bulk_add_state_v1";

export const EMPTY_BULK_ADD_VALUES: BulkAddValues = {
  title: "",
  subtitle: "",
  number: "",
  grade: "",
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
  notes: "",
};

export const DEFAULT_BULK_ADD_LOCKS: BulkAddLocks = {
  title: false,
  subtitle: false,
  number: false,
  grade: false,
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
  notes: false,
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
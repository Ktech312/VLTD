// Field-lock system for the capture builder (src/app/capture/page.tsx).
// Mirrors the UX of src/lib/bulkAddState.ts (used by /vault/add), but keeps
// its own storage key + field set — the capture screen's "number" field means
// something different ("Set / Series" free text) than the add-page's "number"
// (issue/card number), so the two can't safely share one remembered-values map.

export type CaptureFieldKey =
  | "title"
  | "subtitle"
  | "number"
  | "brand"
  | "certCompany"
  | "universe"
  | "categoryLabel"
  | "subcategoryLabel"
  | "storageLocation";

export type CaptureFieldValues = Record<CaptureFieldKey, string>;
export type CaptureFieldLocks = Record<CaptureFieldKey, boolean>;

export const CAPTURE_ADD_STATE_STORAGE_KEY = "vltd_capture_add_state_v1";

export const EMPTY_CAPTURE_VALUES: CaptureFieldValues = {
  title: "",
  subtitle: "",
  number: "",
  brand: "",
  certCompany: "",
  universe: "",
  categoryLabel: "",
  subcategoryLabel: "",
  storageLocation: "",
};

export const DEFAULT_CAPTURE_LOCKS: CaptureFieldLocks = {
  title: false,
  subtitle: false,
  number: false,
  brand: false,
  certCompany: false,
  universe: true,
  categoryLabel: true,
  subcategoryLabel: true,
  storageLocation: true,
};

export type CaptureAddState = {
  locks: CaptureFieldLocks;
  rememberedValues: Partial<CaptureFieldValues>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeLocks(input: unknown): CaptureFieldLocks {
  const next: CaptureFieldLocks = { ...DEFAULT_CAPTURE_LOCKS };
  if (!isRecord(input)) return next;

  for (const key of Object.keys(DEFAULT_CAPTURE_LOCKS) as CaptureFieldKey[]) {
    if (typeof input[key] === "boolean") {
      next[key] = input[key] as boolean;
    }
  }
  return next;
}

function sanitizeRememberedValues(input: unknown): Partial<CaptureFieldValues> {
  const next: Partial<CaptureFieldValues> = {};
  if (!isRecord(input)) return next;

  for (const key of Object.keys(EMPTY_CAPTURE_VALUES) as CaptureFieldKey[]) {
    const raw = input[key];
    if (typeof raw === "string") {
      next[key] = raw;
    }
  }
  return next;
}

export function createDefaultCaptureAddState(): CaptureAddState {
  return {
    locks: { ...DEFAULT_CAPTURE_LOCKS },
    rememberedValues: {},
  };
}

export function readCaptureAddState(): CaptureAddState {
  if (typeof window === "undefined") return createDefaultCaptureAddState();

  try {
    const raw = window.localStorage.getItem(CAPTURE_ADD_STATE_STORAGE_KEY);
    if (!raw) return createDefaultCaptureAddState();

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return createDefaultCaptureAddState();

    return {
      locks: sanitizeLocks(parsed.locks),
      rememberedValues: sanitizeRememberedValues(parsed.rememberedValues),
    };
  } catch {
    return createDefaultCaptureAddState();
  }
}

export function writeCaptureAddState(state: CaptureAddState) {
  if (typeof window === "undefined") return;

  const safeState: CaptureAddState = {
    locks: sanitizeLocks(state.locks),
    rememberedValues: sanitizeRememberedValues(state.rememberedValues),
  };
  window.localStorage.setItem(CAPTURE_ADD_STATE_STORAGE_KEY, JSON.stringify(safeState));
}

export function buildCaptureRememberedValues(
  values: Partial<CaptureFieldValues>,
  locks: CaptureFieldLocks
): Partial<CaptureFieldValues> {
  const remembered: Partial<CaptureFieldValues> = {};

  for (const key of Object.keys(EMPTY_CAPTURE_VALUES) as CaptureFieldKey[]) {
    if (!locks[key]) continue;
    const value = typeof values[key] === "string" ? values[key] : "";
    if (value.trim()) remembered[key] = value;
  }
  return remembered;
}

export function applyCaptureLockedValues(
  rememberedValues: Partial<CaptureFieldValues>,
  locks: CaptureFieldLocks
): Partial<CaptureFieldValues> {
  const next: Partial<CaptureFieldValues> = {};
  const safeRemembered = sanitizeRememberedValues(rememberedValues);

  for (const key of Object.keys(EMPTY_CAPTURE_VALUES) as CaptureFieldKey[]) {
    if (locks[key] && typeof safeRemembered[key] === "string") {
      next[key] = safeRemembered[key];
    }
  }
  return next;
}

export function toggleCaptureFieldLock(
  locks: CaptureFieldLocks,
  key: CaptureFieldKey
): CaptureFieldLocks {
  return {
    ...sanitizeLocks(locks),
    [key]: !locks[key],
  };
}

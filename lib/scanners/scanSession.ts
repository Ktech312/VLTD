export type ScanSessionType = "generic" | "book" | "comic" | "card" | "graded_card";

export type ScanSessionStatus =
  | "idle"
  | "image_attached"
  | "scanning"
  | "review_ready"
  | "applied"
  | "failed";

export type ScanSessionImage = {
  fileName: string;
  previewUrl: string;
  mimeType: string;
  lastModified?: number;
};

export type ScanSessionParsedFieldKey =
  | "title"
  | "subtitle"
  | "number"
  | "grade"
  | "certNumber"
  | "serialNumber"
  | "universe"
  | "category"
  | "categoryLabel"
  | "subcategoryLabel"
  | "notes";

export type ScanSessionFields = Partial<Record<ScanSessionParsedFieldKey, string>>;

export type ScanSessionReview = {
  source: "ocr" | "book_lookup" | "comic_lookup" | "barcode_lookup" | "manual";
  confidence: "low" | "medium" | "high";
  score: number;
  safeToAutofill: boolean;
  warnings: string[];
  rawText: string;
  fields: ScanSessionFields;
};

export type ScanSessionState = {
  type: ScanSessionType;
  status: ScanSessionStatus;
  image: ScanSessionImage | null;
  barcodeRaw: string;
  barcodeDigits: string;
  review: ScanSessionReview | null;
  errorMessage: string;
  updatedAt: number;
};

export const EMPTY_SCAN_SESSION: ScanSessionState = {
  type: "generic",
  status: "idle",
  image: null,
  barcodeRaw: "",
  barcodeDigits: "",
  review: null,
  errorMessage: "",
  updatedAt: 0,
};

function nowTs() {
  return Date.now();
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function cleanWarnings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

function cleanScore(value: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function cleanConfidence(value: unknown): ScanSessionReview["confidence"] {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "low";
}

function cleanStatus(value: unknown): ScanSessionStatus {
  if (
    value === "idle" ||
    value === "image_attached" ||
    value === "scanning" ||
    value === "review_ready" ||
    value === "applied" ||
    value === "failed"
  ) {
    return value;
  }
  return "idle";
}

function cleanType(value: unknown): ScanSessionType {
  if (
    value === "generic" ||
    value === "book" ||
    value === "comic" ||
    value === "card" ||
    value === "graded_card"
  ) {
    return value;
  }
  return "generic";
}

function sanitizeFields(value: unknown): ScanSessionFields {
  const next: ScanSessionFields = {};
  if (!value || typeof value !== "object") return next;

  const input = value as Record<string, unknown>;
  const allowed: ScanSessionParsedFieldKey[] = [
    "title",
    "subtitle",
    "number",
    "grade",
    "certNumber",
    "serialNumber",
    "universe",
    "category",
    "categoryLabel",
    "subcategoryLabel",
    "notes",
  ];

  for (const key of allowed) {
    const raw = input[key];
    if (typeof raw === "string" && raw.trim()) {
      next[key] = raw;
    }
  }

  return next;
}

function sanitizeImage(value: unknown): ScanSessionImage | null {
  if (!value || typeof value !== "object") return null;

  const input = value as Record<string, unknown>;
  const fileName = cleanString(input.fileName);
  const previewUrl = cleanString(input.previewUrl);
  const mimeType = cleanString(input.mimeType);
  const lastModifiedRaw = Number(input.lastModified);

  if (!previewUrl) return null;

  return {
    fileName,
    previewUrl,
    mimeType,
    lastModified: Number.isFinite(lastModifiedRaw) ? lastModifiedRaw : undefined,
  };
}

function sanitizeReview(value: unknown): ScanSessionReview | null {
  if (!value || typeof value !== "object") return null;

  const input = value as Record<string, unknown>;

  const source =
    input.source === "ocr" ||
    input.source === "book_lookup" ||
    input.source === "comic_lookup" ||
    input.source === "barcode_lookup" ||
    input.source === "manual"
      ? input.source
      : "manual";

  return {
    source,
    confidence: cleanConfidence(input.confidence),
    score: cleanScore(input.score),
    safeToAutofill: Boolean(input.safeToAutofill),
    warnings: cleanWarnings(input.warnings),
    rawText: cleanString(input.rawText),
    fields: sanitizeFields(input.fields),
  };
}

export function createScanSession(type: ScanSessionType = "generic"): ScanSessionState {
  return {
    ...EMPTY_SCAN_SESSION,
    type,
    updatedAt: nowTs(),
  };
}

export function attachScanImage(
  state: ScanSessionState,
  image: ScanSessionImage,
  type?: ScanSessionType
): ScanSessionState {
  return {
    ...state,
    type: type ?? state.type,
    status: "image_attached",
    image,
    barcodeRaw: "",
    barcodeDigits: "",
    review: null,
    errorMessage: "",
    updatedAt: nowTs(),
  };
}

export function markScanSessionScanning(state: ScanSessionState): ScanSessionState {
  return {
    ...state,
    status: "scanning",
    errorMessage: "",
    updatedAt: nowTs(),
  };
}

export function setScanSessionBarcode(
  state: ScanSessionState,
  barcodeRaw: string,
  barcodeDigits?: string
): ScanSessionState {
  return {
    ...state,
    barcodeRaw: cleanString(barcodeRaw),
    barcodeDigits: cleanString(barcodeDigits ?? barcodeRaw).replace(/\D/g, ""),
    updatedAt: nowTs(),
  };
}

export function setScanSessionReview(
  state: ScanSessionState,
  review: ScanSessionReview
): ScanSessionState {
  return {
    ...state,
    status: "review_ready",
    review: sanitizeReview(review),
    errorMessage: "",
    updatedAt: nowTs(),
  };
}

export function clearScanSessionReview(state: ScanSessionState): ScanSessionState {
  const nextStatus: ScanSessionStatus = state.image ? "image_attached" : "idle";

  return {
    ...state,
    status: nextStatus,
    review: null,
    errorMessage: "",
    updatedAt: nowTs(),
  };
}

export function markScanSessionApplied(state: ScanSessionState): ScanSessionState {
  return {
    ...state,
    status: "applied",
    updatedAt: nowTs(),
  };
}

export function markScanSessionFailed(
  state: ScanSessionState,
  errorMessage: string
): ScanSessionState {
  return {
    ...state,
    status: "failed",
    errorMessage: cleanString(errorMessage),
    updatedAt: nowTs(),
  };
}

export function clearScanSession(): ScanSessionState {
  return {
    ...EMPTY_SCAN_SESSION,
    updatedAt: nowTs(),
  };
}

export function sanitizeScanSessionState(value: unknown): ScanSessionState {
  if (!value || typeof value !== "object") {
    return createScanSession();
  }

  const input = value as Record<string, unknown>;
  const updatedAtRaw = Number(input.updatedAt);

  return {
    type: cleanType(input.type),
    status: cleanStatus(input.status),
    image: sanitizeImage(input.image),
    barcodeRaw: cleanString(input.barcodeRaw),
    barcodeDigits: cleanString(input.barcodeDigits).replace(/\D/g, ""),
    review: sanitizeReview(input.review),
    errorMessage: cleanString(input.errorMessage),
    updatedAt: Number.isFinite(updatedAtRaw) ? updatedAtRaw : nowTs(),
  };
}
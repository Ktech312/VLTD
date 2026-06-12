export type ParsedComicBarcode = {
  rawBarcode: string;
  normalizedBarcode: string;
  addon: string;
  issueNumber?: string;
  coverNumber?: string;
  printingNumber?: string;
};

export type ParsedComicScan = {
  title: string;
  subtitle: string;
  issueNumber: string;
  barcode?: ParsedComicBarcode;
  notes: string;
  confidence: "low" | "medium" | "high";
  warnings: string[];
};

export type ComicRegionScanResult = {
  titleText: string;
  issueText: string;
  addon: string;
  barcode: string;
};

function cleanText(value: string) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function digitsOnly(value: string) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeLine(value: string) {
  return String(value ?? "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[^A-Za-z0-9#]+/, "")
    .replace(/[^A-Za-z0-9)!?:'"\-.,#/]+$/, "")
    .trim();
}

function uniqueLines(text: string) {
  const seen = new Set<string>();

  return cleanText(text)
    .split("\n")
    .map((line) => normalizeLine(line))
    .filter(Boolean)
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function likelyUiNoise(line: string) {
  return /retake|fit the frame|camera|optional|review and apply|upload|scan image|use camera|clear image|book isbn|comic scan/i.test(
    line
  );
}

function likelyPublisherNoise(line: string) {
  return /^(marvel|dc|image|dark horse|boom|idw|viz|valiant)$/i.test(line.trim());
}

function likelyBadTitle(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed.length < 3) return true;
  if (/^[0-9\s#.-]+$/.test(trimmed)) return true;
  if (likelyUiNoise(trimmed)) return true;
  if (likelyPublisherNoise(trimmed)) return true;
  return false;
}

function scoreTitleCandidate(line: string) {
  let score = 0;
  const trimmed = line.trim();

  if (!trimmed) return -999;
  if (likelyBadTitle(trimmed)) return -999;

  if (trimmed.length >= 6) score += 2;
  if (trimmed.length >= 10) score += 2;
  if (/[A-Za-z]/.test(trimmed)) score += 2;
  if (/[A-Z]/.test(trimmed)) score += 1;
  if (/\b(of|the|and|for|from|in|on)\b/i.test(trimmed)) score += 2;
  if (/[:!?'"]/g.test(trimmed)) score += 1;
  if (trimmed.split(/\s+/).length >= 2) score += 2;
  if (trimmed.split(/\s+/).length >= 3) score += 1;
  if (trimmed.length > 45) score -= 2;
  if (/retake|frame|photo|camera|scan/i.test(trimmed)) score -= 10;

  return score;
}

function pickBestTitle(...texts: string[]) {
  const candidates = texts.flatMap((text) => uniqueLines(text));
  if (!candidates.length) return "";

  const ranked = [...candidates].sort((a, b) => scoreTitleCandidate(b) - scoreTitleCandidate(a));
  const best = ranked[0];

  return scoreTitleCandidate(best) > 0 ? best : "";
}

function pickSubtitle(fullOcrText: string, chosenTitle: string) {
  const lines = uniqueLines(fullOcrText).filter((line) => {
    if (!line) return false;
    if (line === chosenTitle) return false;
    if (likelyBadTitle(line)) return false;
    if (line.length > 50) return false;
    return true;
  });

  return lines[0] ?? "";
}

function normalizeIssueCandidate(value: string) {
  const compact = String(value ?? "").replace(/\s+/g, "").toUpperCase();
  const hashMatch = compact.match(/^#?([0-9]{1,4}[A-Z]?)$/);
  if (hashMatch?.[1]) return hashMatch[1];
  return "";
}

function pickIssueFromText(...texts: string[]) {
  for (const text of texts) {
    const cleaned = cleanText(text);
    if (!cleaned) continue;

    const lines = cleaned.split("\n").map((line) => line.trim()).filter(Boolean);

    for (const line of lines) {
      const exact = line.match(/^(?:#\s*)?([0-9]{1,4}[A-Z]?)$/i);
      if (exact?.[1]) {
        return normalizeIssueCandidate(exact[1]);
      }
    }

    for (const line of lines) {
      const embedded = line.match(/(?:^|\b)#?\s*([0-9]{1,4}[A-Z]?)(?:\b|$)/i);
      if (embedded?.[1]) {
        return normalizeIssueCandidate(embedded[1]);
      }
    }
  }

  return "";
}

async function readImageTextWithTesseract(file: File | Blob): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");

  try {
    const result = await worker.recognize(file);
    return cleanText(result.data.text || "");
  } finally {
    await worker.terminate();
  }
}

async function cropImageToBlob(
  file: File | Blob,
  crop: { x: number; y: number; w: number; h: number }
): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image for region scan."));
      img.src = objectUrl;
    });

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    const sx = Math.max(0, Math.floor(width * crop.x));
    const sy = Math.max(0, Math.floor(height * crop.y));
    const sw = Math.max(1, Math.floor(width * crop.w));
    const sh = Math.max(1, Math.floor(height * crop.h));

    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable for region scan.");

    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    if (!blob) throw new Error("Failed to prepare region scan image.");
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function scanComicRegionsFromFile(file: File | Blob): Promise<ComicRegionScanResult> {
  const [titleBlob, issueBlob, addonBlob, barcodeBlob] = await Promise.all([
    cropImageToBlob(file, { x: 0.08, y: 0.02, w: 0.84, h: 0.2 }),
    cropImageToBlob(file, { x: 0.72, y: 0.02, w: 0.22, h: 0.14 }),
    cropImageToBlob(file, { x: 0.66, y: 0.74, w: 0.22, h: 0.1 }),
    cropImageToBlob(file, { x: 0.58, y: 0.68, w: 0.34, h: 0.22 }),
  ]);

  const [titleText, issueText, addonText, barcodeText] = await Promise.all([
    readImageTextWithTesseract(titleBlob),
    readImageTextWithTesseract(issueBlob),
    readImageTextWithTesseract(addonBlob),
    readImageTextWithTesseract(barcodeBlob),
  ]);

  return {
    titleText,
    issueText,
    addon: extractComicAddonFromText(addonText),
    barcode: digitsOnly(barcodeText),
  };
}

export function extractComicAddonFromText(rawText: string) {
  const text = String(rawText ?? "");

  const matches = text.match(/\b\d{5}\b/g) ?? [];
  for (const match of matches) {
    if (/^\d{5}$/.test(match)) return match;
  }

  const splitStyle = text.match(/\b\d{3}\s?\d{2}\b/g) ?? [];
  for (const chunk of splitStyle) {
    const compact = digitsOnly(chunk);
    if (compact.length === 5) return compact;
  }

  return "";
}

export function parseComicBarcode(rawBarcode: string, addonText?: string): ParsedComicBarcode | null {
  const normalizedBarcode = digitsOnly(rawBarcode);
  const addon = digitsOnly(addonText ?? "");

  if (!normalizedBarcode) return null;

  let issueNumber = "";
  let coverNumber = "";
  let printingNumber = "";

  if (addon.length === 5) {
    const issueRaw = addon.slice(0, 3);
    const coverRaw = addon.slice(3, 4);
    const printingRaw = addon.slice(4, 5);

    issueNumber = String(Number(issueRaw));
    coverNumber = coverRaw;
    printingNumber = printingRaw;
  }

  return {
    rawBarcode,
    normalizedBarcode,
    addon,
    issueNumber: issueNumber || undefined,
    coverNumber: coverNumber || undefined,
    printingNumber: printingNumber || undefined,
  };
}

export function buildComicScanNotes(parsed: ParsedComicBarcode | null) {
  if (!parsed) return "";

  const lines = [`Comic barcode: ${parsed.normalizedBarcode}`];

  if (parsed.addon) lines.push(`Comic addon: ${parsed.addon}`);
  if (parsed.issueNumber) lines.push(`Parsed issue: ${parsed.issueNumber}`);
  if (parsed.coverNumber) lines.push(`Parsed cover: ${parsed.coverNumber}`);
  if (parsed.printingNumber) lines.push(`Parsed printing: ${parsed.printingNumber}`);

  return lines.join("\n");
}

export function parseComicScanResult(input: {
  titleRegionText?: string;
  issueRegionText?: string;
  addonText?: string;
  fallbackOcrText?: string;
  barcodeDigits?: string;
}): ParsedComicScan {
  const titleRegionText = cleanText(input.titleRegionText ?? "");
  const issueRegionText = cleanText(input.issueRegionText ?? "");
  const addonText = cleanText(input.addonText ?? "");
  const fallbackOcrText = cleanText(input.fallbackOcrText ?? "");
  const barcodeDigits = digitsOnly(input.barcodeDigits ?? "");

  const barcode = parseComicBarcode(barcodeDigits, addonText);
  const title = pickBestTitle(titleRegionText, fallbackOcrText);
  const subtitle = pickSubtitle(fallbackOcrText, title);
  const issueNumber =
    barcode?.issueNumber ||
    pickIssueFromText(issueRegionText, titleRegionText, fallbackOcrText) ||
    "";

  const warnings: string[] = [];

  if (!barcode?.normalizedBarcode) warnings.push("Comic barcode was not decoded.");
  if (!issueNumber) warnings.push("Issue number was not confidently parsed.");
  if (!title) warnings.push("Title was not confidently parsed.");

  const notes = [
    buildComicScanNotes(barcode),
    titleRegionText ? `Region title OCR: ${titleRegionText}` : "",
    issueRegionText ? `Region issue OCR: ${issueRegionText}` : "",
    addonText ? `Region addon OCR: ${addonText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  let confidence: ParsedComicScan["confidence"] = "low";
  if (title && issueNumber && barcode?.normalizedBarcode) confidence = "high";
  else if (title || issueNumber || barcode?.normalizedBarcode) confidence = "medium";

  return {
    title,
    subtitle,
    issueNumber,
    barcode: barcode ?? undefined,
    notes,
    confidence,
    warnings,
  };
}
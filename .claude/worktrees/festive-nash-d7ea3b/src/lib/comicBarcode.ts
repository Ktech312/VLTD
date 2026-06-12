import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
  RGBLuminanceSource,
} from "@zxing/library";

export type ComicBarcodeParseResult = {
  rawBarcode: string;
  normalizedBarcode: string;
  addon: string;
  issueNumber?: string;
  coverNumber?: string;
  printingNumber?: string;
};

export type ComicRegionScanResult = {
  barcode: string;
  addon: string;
  titleText: string;
  issueText: string;
};

function digitsOnly(value: string) {
  return String(value ?? "").replace(/\D/g, "");
}

function cleanText(value: string) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));
  return canvas;
}

async function loadImageFromFile(file: File | Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image for comic scan."));
      img.src = objectUrl;
    });

    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function createReader() {
  const reader = new MultiFormatReader();
  const hints = new Map();

  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.UPC_A,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_E,
  ]);

  hints.set(DecodeHintType.TRY_HARDER, true);

  reader.setHints(hints);
  return reader;
}

function decodeCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "";

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const source = new RGBLuminanceSource(imageData.data, width, height);
  const bitmap = new BinaryBitmap(new HybridBinarizer(source));
  const reader = createReader();

  try {
    const result = reader.decode(bitmap);
    return digitsOnly(result.getText());
  } catch (error) {
    if (error instanceof NotFoundException) return "";
    return "";
  } finally {
    reader.reset();
  }
}

function drawRegionToCanvas(
  image: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  scale = 1
) {
  const canvas = makeCanvas(sw * scale, sh * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function enhanceCanvasGrayscale(sourceCanvas: HTMLCanvasElement, contrastBoost = 0) {
  const canvas = makeCanvas(sourceCanvas.width, sourceCanvas.height);
  const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!sourceCtx || !ctx) return sourceCanvas;

  const imageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
  const data = new Uint8ClampedArray(imageData.data);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let y = Math.round(r * 0.299 + g * 0.587 + b * 0.114);

    if (contrastBoost !== 0) {
      y = y < 128 ? Math.max(0, y - contrastBoost) : Math.min(255, y + contrastBoost);
    }

    data[i] = y;
    data[i + 1] = y;
    data[i + 2] = y;
  }

  ctx.putImageData(new ImageData(data, sourceCanvas.width, sourceCanvas.height), 0, 0);
  return canvas;
}

function tryDecodeVariants(canvas: HTMLCanvasElement) {
  const direct = decodeCanvas(canvas);
  if (direct) return direct;

  const gray = enhanceCanvasGrayscale(canvas, 0);
  const grayResult = decodeCanvas(gray);
  if (grayResult) return grayResult;

  const boosted = enhanceCanvasGrayscale(canvas, 45);
  const boostedResult = decodeCanvas(boosted);
  if (boostedResult) return boostedResult;

  return "";
}

async function runOcrOnCanvas(canvas: HTMLCanvasElement) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");

  try {
    const result = await worker.recognize(canvas);
    return cleanText(result.data.text || "");
  } finally {
    await worker.terminate();
  }
}

function normalizeTitleLine(line: string) {
  return line
    .replace(/\s{2,}/g, " ")
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/[^A-Za-z0-9]+$/, "")
    .trim();
}

function looksBadTitle(line: string) {
  const value = normalizeTitleLine(line);
  if (!value) return true;
  if (value.length < 4) return true;
  if (/retake|fit the frame|optional|add more photos|review and apply|camera|scan/i.test(value)) {
    return true;
  }
  if (/^[0-9\s]+$/.test(value)) return true;
  return false;
}

function pickBestTitleFromText(text: string) {
  const lines = cleanText(text)
    .split("\n")
    .map((line) => normalizeTitleLine(line))
    .filter(Boolean);

  const filtered = lines.filter((line) => !looksBadTitle(line));
  if (!filtered.length) return "";

  filtered.sort((a, b) => {
    const score = (value: string) => {
      let total = 0;
      if (value.length >= 8) total += 2;
      if (/[A-Za-z]/.test(value)) total += 2;
      if (/marvel|dc|image|dark horse|boom/i.test(value)) total -= 2;
      if (/children of the atom/i.test(value)) total += 5;
      if (/[A-Z]/.test(value)) total += 1;
      return total;
    };
    return score(b) - score(a);
  });

  return filtered[0] ?? "";
}

function normalizeIssueCandidate(value: string) {
  const compact = String(value ?? "").replace(/\s+/g, "").toUpperCase();

  const hashMatch = compact.match(/#?([0-9]{1,4}[A-Z]?)\b/);
  if (hashMatch?.[1]) return hashMatch[1];

  return "";
}

function pickIssueFromText(text: string) {
  const cleaned = cleanText(text);
  const lines = cleaned.split("\n").map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/(?:^|\b)([0-9]{1,4}[A-Z]?)(?:\b|$)/);
    if (match?.[1]) return normalizeIssueCandidate(match[1]);
  }

  const fallback = cleaned.match(/(?:^|\D)([0-9]{1,4}[A-Z]?)(?:\D|$)/);
  if (fallback?.[1]) return normalizeIssueCandidate(fallback[1]);

  return "";
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

export function parseComicBarcode(rawBarcode: string, addonText?: string): ComicBarcodeParseResult | null {
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

export async function detectComicBarcodeFromFile(file: File | Blob) {
  if (typeof window === "undefined") return "";

  const image = await loadImageFromFile(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!width || !height) return "";

  const regions = [
    { x: Math.floor(width * 0.72), y: Math.floor(height * 0.7), w: Math.floor(width * 0.28), h: Math.floor(height * 0.3), scale: 3.4 },
    { x: Math.floor(width * 0.66), y: Math.floor(height * 0.64), w: Math.floor(width * 0.34), h: Math.floor(height * 0.36), scale: 3.0 },
    { x: Math.floor(width * 0.58), y: Math.floor(height * 0.62), w: Math.floor(width * 0.42), h: Math.floor(height * 0.38), scale: 2.6 },
    { x: 0, y: Math.floor(height * 0.62), w: width, h: Math.floor(height * 0.38), scale: 1.9 },
  ];

  for (const region of regions) {
    if (region.w < 40 || region.h < 40) continue;
    const canvas = drawRegionToCanvas(image, region.x, region.y, region.w, region.h, region.scale);
    const result = tryDecodeVariants(canvas);
    if (result) return result;
  }

  return "";
}

export async function scanComicRegionsFromFile(file: File | Blob): Promise<ComicRegionScanResult> {
  if (typeof window === "undefined") {
    return { barcode: "", addon: "", titleText: "", issueText: "" };
  }

  const image = await loadImageFromFile(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!width || !height) {
    return { barcode: "", addon: "", titleText: "", issueText: "" };
  }

  const titleRegion = drawRegionToCanvas(
    image,
    Math.floor(width * 0.16),
    Math.floor(height * 0.02),
    Math.floor(width * 0.68),
    Math.floor(height * 0.2),
    2.4
  );

  const issueRegion = drawRegionToCanvas(
    image,
    0,
    0,
    Math.floor(width * 0.18),
    Math.floor(height * 0.18),
    4
  );

  const barcodeRegion = drawRegionToCanvas(
    image,
    Math.floor(width * 0.68),
    Math.floor(height * 0.68),
    Math.floor(width * 0.32),
    Math.floor(height * 0.32),
    3.5
  );

  const [titleTextRaw, issueTextRaw, addonTextRaw] = await Promise.all([
    runOcrOnCanvas(enhanceCanvasGrayscale(titleRegion, 30)),
    runOcrOnCanvas(enhanceCanvasGrayscale(issueRegion, 35)),
    runOcrOnCanvas(enhanceCanvasGrayscale(barcodeRegion, 45)),
  ]);

  const barcode = tryDecodeVariants(barcodeRegion) || "";
  const addon = extractComicAddonFromText(addonTextRaw);

  return {
    barcode,
    addon,
    titleText: pickBestTitleFromText(titleTextRaw),
    issueText: pickIssueFromText(issueTextRaw),
  };
}

export function buildComicScanNotes(parsed: ComicBarcodeParseResult | null) {
  if (!parsed) return "";

  const lines = [`Comic barcode: ${parsed.normalizedBarcode}`];

  if (parsed.addon) lines.push(`Comic addon: ${parsed.addon}`);
  if (parsed.issueNumber) lines.push(`Parsed issue: ${parsed.issueNumber}`);
  if (parsed.coverNumber) lines.push(`Parsed cover: ${parsed.coverNumber}`);
  if (parsed.printingNumber) lines.push(`Parsed printing: ${parsed.printingNumber}`);

  return lines.join("\n");
}
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  NotFoundException,
  RGBLuminanceSource,
} from "@zxing/library";

export type BookLookupResult = {
  isbn: string;
  title: string;
  subtitle?: string;
  authors?: string[];
  publishers?: string[];
  publishDate?: string;
  notes?: string;
};

function cleanCandidate(value: string) {
  return value.replace(/[^0-9Xx]/g, "").toUpperCase();
}

function isValidIsbn10(isbn: string) {
  if (!/^[0-9]{9}[0-9X]$/.test(isbn)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += (10 - i) * Number(isbn[i]);
  }

  const check = isbn[9] === "X" ? 10 : Number(isbn[9]);
  sum += check;

  return sum % 11 === 0;
}

function isValidIsbn13(isbn: string) {
  if (!/^[0-9]{13}$/.test(isbn)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    const digit = Number(isbn[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  const check = (10 - (sum % 10)) % 10;
  return check === Number(isbn[12]);
}

export function normalizeIsbn(value?: string) {
  const cleaned = cleanCandidate(String(value ?? ""));
  if (cleaned.length === 10 && isValidIsbn10(cleaned)) return cleaned;
  if (cleaned.length === 13 && isValidIsbn13(cleaned)) return cleaned;
  return "";
}

export function extractIsbnFromText(rawText: string) {
  const text = String(rawText ?? "");
  const candidates = new Set<string>();

  const isbnTagged = text.match(/(?:ISBN(?:-1[03])?\s*[:#]?\s*)([0-9Xx\- ]{10,20})/g) ?? [];
  for (const chunk of isbnTagged) {
    const normalized = normalizeIsbn(chunk);
    if (normalized) candidates.add(normalized);
  }

  const generic = text.match(/\b(?:97[89][\d\- ]{10,18}|[\dXx\- ]{10,16})\b/g) ?? [];
  for (const chunk of generic) {
    const normalized = normalizeIsbn(chunk);
    if (normalized) candidates.add(normalized);
  }

  return Array.from(candidates);
}

function buildBookNotes(result: BookLookupResult) {
  const lines: string[] = [];

  if (result.isbn) lines.push(`ISBN: ${result.isbn}`);
  if (result.authors?.length) lines.push(`Authors: ${result.authors.join(", ")}`);
  if (result.publishers?.length) lines.push(`Publishers: ${result.publishers.join(", ")}`);
  if (result.publishDate) lines.push(`Published: ${result.publishDate}`);

  return lines.join("\n");
}

function createReader() {
  const reader = new MultiFormatReader();
  const hints = new Map();

  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);

  hints.set(DecodeHintType.TRY_HARDER, true);

  reader.setHints(hints);
  return reader;
}

async function loadImageFromFile(file: File | Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image for barcode scan."));
      img.src = objectUrl;
    });

    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));
  return canvas;
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
    return normalizeIsbn(result.getText());
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

function tryDecodeVariants(canvas: HTMLCanvasElement) {
  const direct = decodeCanvas(canvas);
  if (direct) return direct;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "";

  const { width, height } = canvas;
  const original = ctx.getImageData(0, 0, width, height);

  const grayscale = new Uint8ClampedArray(original.data);
  for (let i = 0; i < grayscale.length; i += 4) {
    const r = grayscale[i];
    const g = grayscale[i + 1];
    const b = grayscale[i + 2];
    const y = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
    grayscale[i] = y;
    grayscale[i + 1] = y;
    grayscale[i + 2] = y;
  }

  const grayCanvas = makeCanvas(width, height);
  const grayCtx = grayCanvas.getContext("2d", { willReadFrequently: true });
  if (grayCtx) {
    grayCtx.putImageData(new ImageData(grayscale, width, height), 0, 0);
    const grayResult = decodeCanvas(grayCanvas);
    if (grayResult) return grayResult;
  }

  const boosted = new Uint8ClampedArray(original.data);
  for (let i = 0; i < boosted.length; i += 4) {
    for (let c = 0; c < 3; c += 1) {
      const value = boosted[i + c];
      const next = value < 128 ? Math.max(0, value - 35) : Math.min(255, value + 35);
      boosted[i + c] = next;
    }
  }

  const boostedCanvas = makeCanvas(width, height);
  const boostedCtx = boostedCanvas.getContext("2d", { willReadFrequently: true });
  if (boostedCtx) {
    boostedCtx.putImageData(new ImageData(boosted, width, height), 0, 0);
    const boostedResult = decodeCanvas(boostedCanvas);
    if (boostedResult) return boostedResult;
  }

  return "";
}

export async function detectBookIsbnFromFile(file: File | Blob) {
  if (typeof window === "undefined") return "";

  const image = await loadImageFromFile(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (!width || !height) return "";

  const full = drawRegionToCanvas(image, 0, 0, width, height, 1);
  const fullResult = tryDecodeVariants(full);
  if (fullResult) return fullResult;

  const full2x = drawRegionToCanvas(image, 0, 0, width, height, 2);
  const full2xResult = tryDecodeVariants(full2x);
  if (full2xResult) return full2xResult;

  const regions = [
    { x: 0, y: Math.floor(height * 0.55), w: width, h: Math.floor(height * 0.45) },
    { x: 0, y: Math.floor(height * 0.66), w: width, h: Math.floor(height * 0.34) },
    { x: Math.floor(width * 0.5), y: Math.floor(height * 0.5), w: Math.floor(width * 0.5), h: Math.floor(height * 0.5) },
    { x: Math.floor(width * 0.55), y: Math.floor(height * 0.6), w: Math.floor(width * 0.4), h: Math.floor(height * 0.3) },
    { x: Math.floor(width * 0.15), y: Math.floor(height * 0.65), w: Math.floor(width * 0.7), h: Math.floor(height * 0.22) },
  ];

  for (const region of regions) {
    if (region.w < 40 || region.h < 40) continue;

    const canvas1x = drawRegionToCanvas(image, region.x, region.y, region.w, region.h, 1.5);
    const result1x = tryDecodeVariants(canvas1x);
    if (result1x) return result1x;

    const canvas2x = drawRegionToCanvas(image, region.x, region.y, region.w, region.h, 2.5);
    const result2x = tryDecodeVariants(canvas2x);
    if (result2x) return result2x;
  }

  return "";
}

async function lookupOpenLibrary(isbn: string): Promise<BookLookupResult | null> {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(
    isbn
  )}&format=json&jscmd=data`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = (await response.json()) as Record<string, any>;
  const key = `ISBN:${isbn}`;
  const entry = data?.[key];
  if (!entry) return null;

  const result: BookLookupResult = {
    isbn,
    title: String(entry.title ?? "").trim(),
    subtitle: String(entry.subtitle ?? "").trim() || undefined,
    authors: Array.isArray(entry.authors)
      ? entry.map?.((a: any) => String(a?.name ?? "").trim()).filter(Boolean) ??
        entry.authors.map((a: any) => String(a?.name ?? "").trim()).filter(Boolean)
      : [],
    publishers: Array.isArray(entry.publishers)
      ? entry.publishers.map((p: any) => String(p?.name ?? "").trim()).filter(Boolean)
      : [],
    publishDate: String(entry.publish_date ?? "").trim() || undefined,
  };

  result.notes = buildBookNotes(result);
  if (!result.title) return null;

  return result;
}

async function lookupGoogleBooks(isbn: string): Promise<BookLookupResult | null> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`;

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = (await response.json()) as {
    items?: Array<{
      volumeInfo?: {
        title?: string;
        subtitle?: string;
        authors?: string[];
        publisher?: string;
        publishedDate?: string;
      };
    }>;
  };

  const first = data.items?.[0]?.volumeInfo;
  if (!first?.title) return null;

  const result: BookLookupResult = {
    isbn,
    title: String(first.title ?? "").trim(),
    subtitle: String(first.subtitle ?? "").trim() || undefined,
    authors: Array.isArray(first.authors) ? first.authors.filter(Boolean) : [],
    publishers: first.publisher ? [String(first.publisher).trim()] : [],
    publishDate: String(first.publishedDate ?? "").trim() || undefined,
  };

  result.notes = buildBookNotes(result);
  return result;
}

export async function lookupBookByIsbn(isbn: string): Promise<BookLookupResult | null> {
  const normalized = normalizeIsbn(isbn);
  if (!normalized) return null;

  try {
    const openLibrary = await lookupOpenLibrary(normalized);
    if (openLibrary) return openLibrary;
  } catch {
    // try fallback
  }

  try {
    const googleBooks = await lookupGoogleBooks(normalized);
    if (googleBooks) return googleBooks;
  } catch {
    // ignore
  }

  return null;
}
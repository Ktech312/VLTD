/** OCR region scan for a raw (ungraded) TCG card — the "Cards" analog of
 *  comicParser.ts. Crops the two places a real card's identity is printed
 *  (the name plate near the top, the collector-number strip in a bottom
 *  corner) and reads each with Tesseract, so a much smaller/cleaner crop
 *  gets OCR'd instead of the whole card at once.
 *
 *  What comes out of here is a best-effort text GUESS, same as comics —
 *  the actual identification happens in cardLookup.ts against the real
 *  Scryfall/Pokemon TCG databases. This module never invents a card; it
 *  just proposes a name/number for that lookup to confirm or reject.
 */

export type TcgCardRegionScanResult = {
  titleText: string;
  numberRegionText: string;
  collectorNumber: string;
  collectorTotal: string;
  /** Best-guess 2-5 letter set code, e.g. "MOM" — Magic prints this next to
   *  the collector number as plain text. Pokemon uses a set ICON there
   *  instead of text, so this is almost always empty for Pokemon cards. */
  setCodeGuess: string;
};

function cleanText(value: string) {
  return String(value ?? "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function uniqueLines(text: string) {
  const seen = new Set<string>();

  return cleanText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const key = line.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function likelyBadTitle(line: string) {
  const trimmed = line.trim();
  if (trimmed.length < 3) return true;
  if (/^[0-9\s#./-]+$/.test(trimmed)) return true;
  if (/retake|fit the frame|camera|optional|review and apply|upload|scan image/i.test(trimmed)) {
    return true;
  }
  return false;
}

function scoreTitleCandidate(line: string) {
  const trimmed = line.trim();
  if (!trimmed || likelyBadTitle(trimmed)) return -999;

  let score = 0;
  if (trimmed.length >= 4) score += 2;
  if (trimmed.length >= 8) score += 1;
  if (/[A-Za-z]/.test(trimmed)) score += 2;
  if (trimmed.length > 40) score -= 2;
  return score;
}

function pickBestTitle(text: string) {
  const candidates = uniqueLines(text);
  if (!candidates.length) return "";

  const ranked = [...candidates].sort((a, b) => scoreTitleCandidate(b) - scoreTitleCandidate(a));
  return scoreTitleCandidate(ranked[0]) > 0 ? ranked[0] : "";
}

/** Magic/Pokemon both print collector number as "094/198" near a bottom
 *  corner. Pull the two numbers out wherever that pattern shows up. */
function parseCollectorNumber(text: string): { number: string; total: string } {
  const match = text.match(/\b(\d{1,4})\s*\/\s*(\d{1,4})\b/);
  if (!match) return { number: "", total: "" };
  return { number: String(Number(match[1])), total: String(Number(match[2])) };
}

const LANGUAGE_OR_RARITY_TOKENS = new Set([
  "EN", "FR", "DE", "IT", "ES", "PT", "JA", "KO", "RU", "ZH", "ZHS", "ZHT",
  "C", "U", "R", "M", "S", "B", "T", "L", // rarity letters (common/uncommon/rare/mythic/etc.)
]);

/** Best-effort 2-5 letter set-code guess from the same OCR'd strip as the
 *  collector number — only reliable for Magic (Pokemon has no printed set
 *  code, just an icon, so this returns "" for those and that's expected). */
function parseSetCodeGuess(text: string) {
  const tokens = text.match(/\b[A-Z]{2,5}\b/g) ?? [];
  for (const token of tokens) {
    if (!LANGUAGE_OR_RARITY_TOKENS.has(token)) return token;
  }
  return "";
}

async function readImageTextWithTesseract(blob: Blob): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");

  try {
    const result = await worker.recognize(blob);
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
      img.onerror = () => reject(new Error("Failed to load image for card scan."));
      img.src = objectUrl;
    });

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    const sx = Math.max(0, Math.floor(width * crop.x));
    const sy = Math.max(0, Math.floor(height * crop.y));
    const sw = Math.max(1, Math.floor(width * crop.w));
    const sh = Math.max(1, Math.floor(height * crop.h));

    const canvas = document.createElement("canvas");
    // Upscale small corner crops — the collector-number strip is tiny
    // relative to the full card, same reasoning as comicParser.ts.
    const scale = crop.h <= 0.14 ? 3 : 1.6;
    canvas.width = sw * scale;
    canvas.height = sh * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable for card region scan.");

    ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    if (!blob) throw new Error("Failed to prepare card region scan image.");
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function scanTcgCardRegionsFromFile(
  file: File | Blob
): Promise<TcgCardRegionScanResult> {
  const [titleBlob, numberBlob] = await Promise.all([
    // Name plate — top strip, most TCG layouts (Magic/Pokemon/Yu-Gi-Oh alike).
    cropImageToBlob(file, { x: 0.06, y: 0.03, w: 0.88, h: 0.11 }),
    // Collector-number strip — bottom-left corner.
    cropImageToBlob(file, { x: 0.02, y: 0.85, w: 0.4, h: 0.12 }),
  ]);

  const [titleText, numberRegionText] = await Promise.all([
    readImageTextWithTesseract(titleBlob),
    readImageTextWithTesseract(numberBlob),
  ]);

  const { number, total } = parseCollectorNumber(numberRegionText);

  return {
    titleText: pickBestTitle(titleText),
    numberRegionText,
    collectorNumber: number,
    collectorTotal: total,
    setCodeGuess: parseSetCodeGuess(numberRegionText),
  };
}

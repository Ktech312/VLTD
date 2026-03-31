import { createWorker } from "tesseract.js";

export type ScanItemType = "auto" | "comic" | "card" | "graded_card" | "book";

type ParsedItemType = Exclude<ScanItemType, "auto"> | "unknown";

type ScanAutofillValues = {
  title?: string;
  subtitle?: string;
  number?: string;
  grade?: string;
  certNumber?: string;
  universe?: string;
  category?: string;
  categoryLabel?: string;
  subcategoryLabel?: string;
  notes?: string;
};

export type ScanQuality = {
  score: number;
  confidence: "low" | "medium" | "high";
  safeToAutofill: boolean;
  warnings: string[];
};

function cleanText(input: string) {
  return input
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

function looksLikeNoise(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed.length <= 1) return true;
  if (/^[^a-zA-Z0-9]+$/.test(trimmed)) return true;
  return false;
}

function normalizeTitle(title: string) {
  return title
    .replace(/\s{2,}/g, " ")
    .replace(/^[#:\- \[\]()]+/, "")
    .replace(/[#:\- \[\]()]+$/, "")
    .replace(/[|]{2,}/g, "|")
    .trim();
}

function pickTitleCandidates(lines: string[]) {
  return lines.filter((line) => {
    if (looksLikeNoise(line)) return false;
    if (line.length < 3) return false;
    if (/^\$?\d+([.,]\d+)?$/.test(line)) return false;
    if (/^[0-9.\- ]+$/.test(line)) return false;
    if (/^(marvel|dc|image|boom|idw|dark horse|viz|psa|cgc|cbcs|bgs|sgc)$/i.test(line)) {
      return false;
    }
    if (/^(issue|variant|cover|grade|cert|certification|isbn)$/i.test(line)) {
      return false;
    }
    return true;
  });
}

function extractCertNumber(text: string) {
  const patterns = [
    /\b(?:cert|certification|serial)\s*#?\s*[:\-]?\s*([A-Z0-9\-]{6,})\b/i,
    /\b([0-9]{8,})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "";
}

function extractGrade(text: string) {
  const patterns = [
    /\b(?:CGC|CBCS|PSA|BGS|SGC)\s*([0-9]{1,2}(?:\.[0-9])?)\b/i,
    /\bGrade\s*[:\-]?\s*([0-9]{1,2}(?:\.[0-9])?)\b/i,
    /\b([0-9]{1,2}(?:\.[0-9])?)\s*(?:GEM MINT|MINT|NM|VF|FINE)\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "";
}

function extractIssueNumber(text: string) {
  const patterns = [
    /(?:issue|no\.?|#)\s*([0-9]{1,5}[A-Z]?)\b/i,
    /\b([0-9]{1,5}[A-Z]?)\b(?=.*(?:issue|variant|cover))/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "";
}

function extractCardNumber(text: string) {
  const patterns = [
    /\b(?:card\s*#|no\.?|#)\s*([A-Z]{0,4}-?[0-9]{1,4}[A-Z]?)\b/i,
    /\b([A-Z]{1,4}-[0-9]{1,4}[A-Z]?)\b/,
    /\b([A-Z]{1,3}[0-9]{1,4})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return "";
}

function detectItemType(text: string, lines: string[]): ParsedItemType {
  const lower = text.toLowerCase();
  const joined = lines.join(" ").toLowerCase();

  const gradedSignals =
    /\b(psa|cgc|cbcs|bgs|sgc|gem mint|mint 9|mint 10)\b/.test(lower) &&
    /\b(cert|certification|grade|trading card|card)\b/.test(lower);

  if (gradedSignals) return "graded_card";

  if (
    /\b(issue|variant cover|comic book|marvel|dc|image comics|dark horse|trade paperback)\b/.test(
      lower
    )
  ) {
    return "comic";
  }

  if (
    /\b(trading card|pokemon|one piece|magic|mtg|yu-gi-oh|yugioh|panini|topps|prizm|donruss|score)\b/.test(
      lower
    )
  ) {
    return "card";
  }

  if (
    /\b(hardcover|paperback|illustrated|pages|publisher|isbn|goodreads)\b/.test(lower) ||
    /\bisbn\b/.test(joined)
  ) {
    return "book";
  }

  return "unknown";
}

function inferUniverseAndCategory(text: string, itemType: ParsedItemType) {
  const lower = text.toLowerCase();

  if (
    /\b(pokemon|one piece|magic|mtg|yu-gi-oh|yugioh|panini|topps|prizm|donruss|score|upper deck)\b/.test(
      lower
    ) ||
    itemType === "card" ||
    itemType === "graded_card"
  ) {
    return {
      universe: "TCG",
      category: "CARDS",
      categoryLabel: "Cards",
      subcategoryLabel: itemType === "graded_card" ? "Graded Card" : "Trading Card",
    };
  }

  if (
    /\b(marvel|dc|image comics|dark horse|boom|idw|comic|issue|variant cover|trade paperback)\b/.test(
      lower
    ) ||
    itemType === "comic"
  ) {
    return {
      universe: "POP_CULTURE",
      category: "COMICS",
      categoryLabel: "Comics",
      subcategoryLabel: "Comic Book",
    };
  }

  if (itemType === "book") {
    return {
      universe: "POP_CULTURE",
      category: "BOOKS",
      categoryLabel: "Books",
      subcategoryLabel: "Book",
    };
  }

  return {
    universe: "",
    category: "",
    categoryLabel: "",
    subcategoryLabel: "",
  };
}

function parseComic(lines: string[], text: string): ScanAutofillValues {
  const candidates = pickTitleCandidates(lines);
  const certNumber = extractCertNumber(text);
  const grade = extractGrade(text);
  const number = extractIssueNumber(text);

  let title = "";
  let subtitle = "";

  for (const line of candidates) {
    if (
      /\b(issue|variant|cover|marvel|dc|comic|trade paperback|vol\.?|volume)\b/i.test(line) ||
      !title
    ) {
      title = line;
      break;
    }
  }

  if (!title && candidates[0]) title = candidates[0];
  if (candidates[1] && candidates[1] !== title) subtitle = candidates[1];

  return {
    title: normalizeTitle(title),
    subtitle: normalizeTitle(subtitle),
    number,
    grade,
    certNumber,
  };
}

function parseCard(lines: string[], text: string, graded: boolean): ScanAutofillValues {
  const candidates = pickTitleCandidates(lines);
  const certNumber = extractCertNumber(text);
  const grade = extractGrade(text);
  const number = extractCardNumber(text);

  let title = "";
  let subtitle = "";

  for (const line of candidates) {
    if (
      !/\b(psa|cgc|cbcs|bgs|sgc|gem mint|mint|grade|certification)\b/i.test(line) &&
      !title
    ) {
      title = line;
      continue;
    }

    if (
      !/\b(psa|cgc|cbcs|bgs|sgc|gem mint|mint|grade|certification)\b/i.test(line) &&
      !subtitle &&
      line !== title
    ) {
      subtitle = line;
    }
  }

  return {
    title: normalizeTitle(title),
    subtitle: normalizeTitle(subtitle),
    number,
    grade: graded ? grade : grade || "",
    certNumber: graded ? certNumber : certNumber || "",
  };
}

function parseBook(lines: string[], text: string): ScanAutofillValues {
  const candidates = pickTitleCandidates(lines);

  let title = candidates[0] ?? "";
  let subtitle = candidates[1] ?? "";

  if (title && subtitle && subtitle.toLowerCase().includes(title.toLowerCase())) {
    subtitle = "";
  }

  return {
    title: normalizeTitle(title),
    subtitle: normalizeTitle(subtitle),
    number: "",
    grade: "",
    certNumber: "",
  };
}

function uppercaseRatio(value: string) {
  const letters = value.replace(/[^A-Za-z]/g, "");
  if (!letters.length) return 0;
  const uppercase = letters.replace(/[^A-Z]/g, "").length;
  return uppercase / letters.length;
}

function weirdCharRatio(value: string) {
  if (!value.length) return 0;
  const weird = (value.match(/[^A-Za-z0-9\s\-#:'",&./()]/g) ?? []).length;
  return weird / value.length;
}

function vowelRatio(value: string) {
  const letters = value.replace(/[^A-Za-z]/g, "").toLowerCase();
  if (!letters.length) return 0;
  const vowels = (letters.match(/[aeiou]/g) ?? []).length;
  return vowels / letters.length;
}

function tokenCount(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function repeatedShortTokenPattern(value: string) {
  return /(?:\b[A-Z0-9]{1,3}\b[\s/|\\-]*){5,}/.test(value);
}

function symbolBurst(value: string) {
  return /[|\\/_~`]{3,}/.test(value) || /[A-Z0-9]{1,3}(?:\s+[A-Z0-9]{1,3}){5,}/.test(value);
}

function likelyGibberish(value: string) {
  const v = normalizeTitle(value);
  if (!v) return true;

  const upper = uppercaseRatio(v);
  const weird = weirdCharRatio(v);
  const vowels = vowelRatio(v);
  const tokens = tokenCount(v);

  if (v.length < 3) return true;
  if (weird > 0.12) return true;
  if (tokens >= 4 && vowels < 0.18) return true;
  if (v.length >= 8 && upper > 0.85 && tokens >= 2) return true;
  if (/[A-Z]{4,}\s+[A-Z]{2,}\s+[A-Z]{2,}/.test(v)) return true;
  if (/(?:\b[A-Z]{1,3}\b\s*){5,}/.test(v)) return true;
  if (repeatedShortTokenPattern(v)) return true;
  if (symbolBurst(v)) return true;
  return false;
}

function sanitizeTitle(value?: string) {
  const next = normalizeTitle(value ?? "");
  if (!next) return "";
  if (next.length < 4) return "";
  if (/^[0-9\s#.-]+$/.test(next)) return "";
  if (likelyGibberish(next)) return "";
  return next;
}

function sanitizeSubtitle(value?: string) {
  const next = normalizeTitle(value ?? "");
  if (!next) return "";
  if (next.length > 120) return "";
  if (/^[0-9\s#.-]+$/.test(next)) return "";
  if (likelyGibberish(next)) return "";
  return next;
}

function sanitizeNumber(value?: string) {
  const next = String(value ?? "").trim().toUpperCase();
  if (!next) return "";
  if (!/^[A-Z]{0,4}-?[0-9]{1,5}[A-Z]{0,2}$/.test(next) && !/^[0-9]{1,5}[A-Z]?$/.test(next)) {
    return "";
  }
  return next;
}

function sanitizeCert(value?: string) {
  const next = String(value ?? "").trim().toUpperCase();
  if (!next) return "";
  if (!/^[A-Z0-9\-]{6,}$/.test(next)) return "";
  return next;
}

function sanitizeGrade(value?: string) {
  const next = String(value ?? "").trim();
  if (!next) return "";
  if (!/^[0-9]{1,2}(?:\.[0-9])?$/.test(next)) return "";
  const num = Number(next);
  if (!Number.isFinite(num) || num <= 0 || num > 10) return "";
  return next;
}

function titleLooksWeak(title: string) {
  if (!title) return true;
  if (tokenCount(title) === 1 && title.length <= 4) return true;
  if (uppercaseRatio(title) > 0.82 && tokenCount(title) >= 2) return true;
  return false;
}

function rawTextLooksBad(rawText: string) {
  const upper = uppercaseRatio(rawText);
  const weird = weirdCharRatio(rawText);
  const vowels = vowelRatio(rawText);
  const tokens = tokenCount(rawText);

  if (weird > 0.14) return true;
  if (upper > 0.7 && tokens > 8) return true;
  if (tokens > 12 && vowels < 0.16) return true;
  if (repeatedShortTokenPattern(rawText)) return true;
  if (symbolBurst(rawText)) return true;
  return false;
}

function buildQuality(rawText: string, fields: ScanAutofillValues): ScanQuality {
  const warnings: string[] = [];
  let score = 0;

  const textLength = rawText.length;
  const lineCount = uniqueLines(rawText).length;

  if (textLength < 12) warnings.push("Very little text detected.");
  else score += 10;

  if (lineCount < 2) warnings.push("Not enough readable lines detected.");
  else score += 10;

  const goodTitle = sanitizeTitle(fields.title);
  const goodSubtitle = sanitizeSubtitle(fields.subtitle);
  const goodNumber = sanitizeNumber(fields.number);
  const goodCert = sanitizeCert(fields.certNumber);
  const goodGrade = sanitizeGrade(fields.grade);

  if (goodTitle) score += 30;
  else if (fields.title) warnings.push("Title looks unreliable.");

  if (goodSubtitle) score += 10;
  else if (fields.subtitle) warnings.push("Subtitle looks unreliable.");

  if (goodNumber) score += 15;
  else if (fields.number) warnings.push("Number looks unreliable.");

  if (goodCert) score += 20;
  else if (fields.certNumber) warnings.push("Cert number looks unreliable.");

  if (goodGrade) score += 10;
  else if (fields.grade) warnings.push("Grade looks unreliable.");

  if (!goodTitle) {
    score -= 25;
    warnings.push("No trustworthy title was extracted.");
  } else if (titleLooksWeak(goodTitle)) {
    score -= 15;
    warnings.push("Title is weak and may be OCR noise.");
  }

  if (rawTextLooksBad(rawText)) {
    warnings.push("OCR text quality is low. Try a tighter, straighter, less reflective photo.");
    score -= 30;
  }

  if (!goodTitle && !goodNumber && !goodCert && !goodGrade) {
    warnings.push("Scan produced almost no reliable fields.");
    score -= 20;
  }

  score = Math.max(0, Math.min(100, score));

  const confidence: ScanQuality["confidence"] =
    score >= 65 ? "high" : score >= 40 ? "medium" : "low";

  const safeToAutofill =
    score >= 40 &&
    Boolean(goodTitle) &&
    !titleLooksWeak(goodTitle) &&
    !rawTextLooksBad(rawText);

  if (!safeToAutofill) {
    warnings.push("Scan is too weak to safely autofill fields.");
  }

  return {
    score,
    confidence,
    safeToAutofill,
    warnings: Array.from(new Set(warnings)),
  };
}

export function parseScanText(rawText: string, forcedType: ScanItemType = "auto"): {
  fields: ScanAutofillValues;
  quality: ScanQuality;
} {
  const text = cleanText(rawText);
  const lines = uniqueLines(text);

  const itemType: ParsedItemType =
    forcedType === "auto" ? detectItemType(text, lines) : forcedType;

  let parsed: ScanAutofillValues;

  if (itemType === "comic") {
    parsed = parseComic(lines, text);
  } else if (itemType === "graded_card") {
    parsed = parseCard(lines, text, true);
  } else if (itemType === "card") {
    parsed = parseCard(lines, text, false);
  } else if (itemType === "book") {
    parsed = parseBook(lines, text);
  } else {
    const candidates = pickTitleCandidates(lines);
    parsed = {
      title: normalizeTitle(candidates[0] ?? ""),
      subtitle: normalizeTitle(candidates[1] ?? ""),
      number: extractIssueNumber(text) || extractCardNumber(text),
      grade: extractGrade(text),
      certNumber: extractCertNumber(text),
    };
  }

  const inferred = inferUniverseAndCategory(text, itemType);

  const fields: ScanAutofillValues = {
    title: sanitizeTitle(parsed.title),
    subtitle: sanitizeSubtitle(parsed.subtitle),
    number: sanitizeNumber(parsed.number),
    grade: sanitizeGrade(parsed.grade),
    certNumber: sanitizeCert(parsed.certNumber),
    universe: inferred.universe,
    category: inferred.category,
    categoryLabel: inferred.categoryLabel,
    subcategoryLabel: inferred.subcategoryLabel,
    notes: text,
  };

  const quality = buildQuality(text, {
    ...parsed,
    ...fields,
  });

  return { fields, quality };
}

export async function runImageScanAutofill(
  file: File | Blob,
  forcedType: ScanItemType = "auto"
): Promise<{
  rawText: string;
  fields: ScanAutofillValues;
  quality: ScanQuality;
}> {
  const worker = await createWorker("eng");

  try {
    const result = await worker.recognize(file);
    const rawText = cleanText(result.data.text || "");
    const parsed = parseScanText(rawText, forcedType);

    return {
      rawText,
      fields: parsed.fields,
      quality: parsed.quality,
    };
  } finally {
    await worker.terminate();
  }
}
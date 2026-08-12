import { lookupComicByUpc } from "@/lib/metronLookup";
import { lookupComicByBarcode } from "@/lib/gcdLookup";
import { lookupVinylByBarcode } from "@/lib/discogLookup";
import { lookupUpcItem } from "@/lib/upcLookup";

/** Barcode-only item enrichment -- no photo required, just the decoded
 *  digits. This is the missing link between "a scan reads a code" (the
 *  on-demand scanner built 2026-08-10) and "the app actually does something
 *  with it": every one of these lookups already existed, wired only into
 *  the AFTER-a-photo Identify pipeline (vault/add/page.tsx, capture/
 *  page.tsx) -- this module lets the live Scan button fire the same free
 *  lookups the instant a code is read, before a photo is even taken.
 *
 *  Deliberately excludes PSA -- that lookup is metered/rate-limited and
 *  currently paused (see vault/add/page.tsx's ENABLE_PSA_LOOKUP); firing it
 *  automatically on every scan is the exact bug that got fixed earlier.
 *  Deliberately excludes AI vision -- that's metered per curator plan and
 *  needs an actual photo; this only covers the free, barcode-driven paths.
 */

export type BarcodeLookupFields = {
  title?: string;
  subtitle?: string;
  subject?: string;
  number?: string;
  universe?: string;
  category?: string;
  categoryLabel?: string;
  subcategoryLabel?: string;
  notes?: string;
  comicPublisher?: string;
  comicCoverDate?: string;
  vinylLabel?: string;
  vinylCountry?: string;
  vinylPressing?: string;
};

export type BarcodeLookupResult = {
  source: "comic" | "vinyl" | "book" | "product";
  /** Short human-readable line for a confirmation card, e.g.
   *  "Amazing Spider-Man #300 (Marvel)" or "Nirvana — Nevermind (1991)". */
  summary: string;
  imageUrl: string | null;
  fields: BarcodeLookupFields;
};

function buildComicResult(
  metron: Awaited<ReturnType<typeof lookupComicByUpc>>,
  gcd: Awaited<ReturnType<typeof lookupComicByBarcode>>
): BarcodeLookupResult {
  const title = metron?.seriesTitle || gcd?.series || "";
  const number = metron?.issueNumber || gcd?.number || "";
  const publisher = metron?.publisher || gcd?.publisher || "";
  const coverDate = metron?.coverDate || gcd?.coverDate || "";
  return {
    source: "comic",
    summary: [title, number ? `#${number}` : "", publisher ? `(${publisher})` : ""].filter(Boolean).join(" "),
    imageUrl: metron?.imageUrl ?? null,
    fields: {
      title,
      number,
      universe: "POP_CULTURE",
      category: "COMICS",
      categoryLabel: "Comics",
      subcategoryLabel: "Comic Book",
      comicPublisher: publisher || undefined,
      comicCoverDate: coverDate || undefined,
      notes: metron?.description || undefined,
    },
  };
}

function buildVinylResult(vinyl: NonNullable<Awaited<ReturnType<typeof lookupVinylByBarcode>>>): BarcodeLookupResult {
  return {
    source: "vinyl",
    summary: [vinyl.artist, vinyl.albumTitle, vinyl.year ? `(${vinyl.year})` : ""].filter(Boolean).join(" — "),
    imageUrl: vinyl.imageUrl,
    fields: {
      title: vinyl.albumTitle,
      subject: vinyl.artist,
      subtitle: vinyl.year ?? undefined,
      universe: "MUSIC",
      category: "Audio Formats",
      categoryLabel: "Audio Formats",
      subcategoryLabel: vinyl.format ?? "Vinyl Records",
      vinylLabel: vinyl.label ?? undefined,
      vinylCountry: vinyl.country ?? undefined,
      vinylPressing: vinyl.format ?? undefined,
    },
  };
}

function buildProductResult(upc: NonNullable<Awaited<ReturnType<typeof lookupUpcItem>>>): BarcodeLookupResult {
  return {
    source: upc.source === "openlibrary" ? "book" : "product",
    summary: [upc.title, upc.subtitle].filter(Boolean).join(" — "),
    imageUrl: null,
    fields: {
      title: upc.title,
      subtitle: upc.subtitle,
      universe: upc.universe,
      category: upc.source === "openlibrary" ? "BOOKS" : "PRODUCTS",
      categoryLabel: upc.categoryLabel,
      subcategoryLabel: upc.subcategoryLabel,
      notes: upc.notes,
    },
  };
}

/** Runs the comic/vinyl/generic-product lookups against a decoded barcode
 *  and returns the single best match, or null if nothing matched anywhere.
 *  Comic and vinyl are tried first (and in parallel, not raced) because a
 *  hit there is always a more specific, more useful match (issue number,
 *  publisher, artist, label) than the generic UPC/product lookup would
 *  return for the same code -- the generic lookup is the broadest net and
 *  is only used as a fallback when the narrower databases miss. */
export async function lookupByBarcodeOnly(
  barcode: { digits?: string; rawValue?: string }
): Promise<BarcodeLookupResult | null> {
  const digits = String(barcode.digits ?? "").replace(/\D/g, "").trim();
  if (!digits) return null;

  const [metronSettled, gcdSettled, vinylSettled] = await Promise.allSettled([
    digits.length >= 12 ? lookupComicByUpc(digits) : Promise.resolve(null),
    digits.length >= 8 ? lookupComicByBarcode(digits) : Promise.resolve(null),
    digits.length >= 12 ? lookupVinylByBarcode(digits).catch(() => null) : Promise.resolve(null),
  ]);

  const metron = metronSettled.status === "fulfilled" ? metronSettled.value : null;
  const gcd = gcdSettled.status === "fulfilled" ? gcdSettled.value : null;
  const vinyl = vinylSettled.status === "fulfilled" ? vinylSettled.value : null;

  if (metron || gcd) return buildComicResult(metron, gcd);
  if (vinyl) return buildVinylResult(vinyl);

  try {
    const upc = await lookupUpcItem(barcode.rawValue || digits);
    if (upc) return buildProductResult(upc);
  } catch {
    // Best-effort -- a lookup failure here just means "nothing found," not
    // worth surfacing as an error for a live, pre-shutter enrichment step.
  }

  return null;
}

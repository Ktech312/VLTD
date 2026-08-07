import type { DiscogsReleaseResult } from "@/app/api/vinyl-lookup/route";

export type VinylLookupResult = {
  /** Artist / band name (e.g. "Nirvana") */
  artist: string;
  /** Album title (e.g. "Nevermind") */
  albumTitle: string;
  /** Record label (e.g. "DGC Records") */
  label: string | null;
  /** Release year as string (e.g. "1991") */
  year: string | null;
  /** Country of pressing (e.g. "US") */
  country: string | null;
  /** Primary genre or style (e.g. "Alternative Rock") */
  genre: string | null;
  /** Primary format (e.g. "LP") */
  format: string | null;
  /** Cover image URL from Discogs CDN */
  imageUrl: string | null;
  /** Catalog number */
  catno: string | null;
  /** Raw Discogs release ID */
  discogId: number;
};

export async function lookupVinylByBarcode(barcode: string): Promise<VinylLookupResult | null> {
  const digits = barcode.replace(/\D/g, "").trim();
  if (!digits) return null;

  const res = await fetch(`/api/vinyl-lookup?barcode=${encodeURIComponent(digits)}`);
  const payload = (await res.json().catch(() => ({}))) as { result?: DiscogsReleaseResult | null; error?: string };

  // Throw instead of silently returning null on a non-OK response -- same
  // bug class fixed in psaLookup.ts: a bad/missing DISCOGS_TOKEN, a rate
  // limit, or a real Discogs outage all looked identical to "this barcode
  // just isn't in Discogs" to the UI. Callers that only care about a
  // best-effort match can still `.catch(() => null)` this same as before.
  if (!res.ok) {
    throw new Error(payload.error || `Discogs lookup failed (${res.status}).`);
  }

  return normalizeResult(payload.result ?? null);
}

export async function lookupVinylByText(
  artist: string,
  album?: string
): Promise<VinylLookupResult | null> {
  if (!artist.trim() && !album?.trim()) return null;

  const params = new URLSearchParams();
  if (artist.trim()) params.set("artist", artist.trim());
  if (album?.trim()) params.set("album", album.trim());

  const res = await fetch(`/api/vinyl-lookup?${params}`);
  const payload = (await res.json().catch(() => ({}))) as { result?: DiscogsReleaseResult | null; error?: string };

  if (!res.ok) {
    throw new Error(payload.error || `Discogs lookup failed (${res.status}).`);
  }

  return normalizeResult(payload.result ?? null);
}

function normalizeResult(raw: DiscogsReleaseResult | null): VinylLookupResult | null {
  if (!raw) return null;
  return {
    artist: raw.artist,
    albumTitle: raw.albumTitle,
    label: raw.label,
    year: raw.year,
    country: raw.country,
    genre: raw.genre,
    format: raw.format,
    imageUrl: raw.imageUrl,
    catno: raw.catno,
    discogId: raw.id,
  };
}

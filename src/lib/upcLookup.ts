import type { UpcLookupResult } from "@/app/api/upc-lookup/route";

export type { UpcLookupResult };

/** Client helper -- the actual upcitemdb/OpenLibrary/Google-Books calls
 *  moved server-side into /api/upc-lookup (2026-08-11) so the daily-budget
 *  guard + permanent cache can actually gate them; see that route's own
 *  notes for why. This function's signature is unchanged so callers
 *  (barcodeLookup.ts, capture/page.tsx, vault/add/page.tsx) didn't need to. */
export async function lookupUpcItem(rawCode: string): Promise<UpcLookupResult | null> {
  const code = String(rawCode ?? "").replace(/\D/g, "").trim();
  if (!code) return null;

  const res = await fetch(`/api/upc-lookup?code=${encodeURIComponent(code)}`, { method: "GET" });
  const payload = (await res.json().catch(() => ({}))) as { result?: UpcLookupResult | null; error?: string };

  if (!res.ok) {
    throw new Error(payload.error || `UPC lookup failed (${res.status}).`);
  }

  return payload.result ?? null;
}

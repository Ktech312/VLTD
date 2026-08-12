import { NextRequest, NextResponse } from "next/server";
import { lookupBookByIsbn, normalizeIsbn } from "@/lib/bookIsbn";
import { getCachedLookup, putCachedLookup, reserveDailyCall, markProviderExhausted } from "@/lib/server/lookupApiGuard";

/**
 * GET /api/upc-lookup?code=<digits>
 *
 * Server-side proxy for the generic product/book barcode lookup --
 * previously `upcLookup.ts` called upcitemdb directly from the BROWSER,
 * which meant nothing server-side could ever gate or cache it. Moved here
 * for the same reason PSA's lookup is server-side: upcitemdb's free tier
 * is a hard, ACCOUNT-WIDE 100 calls/day cap (confirmed via their own docs,
 * same shape as the PSA quota that got exhausted 2026-08-06) -- and since
 * 2026-08-10's live-scan feature now fires this on every single barcode
 * scan across /capture, /vault/add, AND Quick Add, call volume through
 * this one free tier went up meaningfully. Guarded with the same
 * permanent-cache + daily-budget pattern as PSA
 * (supabase/migrations/20260811_lookup_api_guards.sql), generalized this
 * time instead of copy-pasted.
 *
 * ISBN/book codes route to OpenLibrary/Google Books instead (via
 * lookupBookByIsbn) -- neither has a confirmed hard daily cap, so those
 * get the permanent cache (repeat scans of the same book cost nothing)
 * but not the daily-budget gate; inventing a quota that doesn't exist
 * would just block real lookups for no reason.
 */

const SAFE_DAILY_CAP = 90; // leave headroom below upcitemdb's real 100/day

export type UpcLookupResult = {
  code: string;
  title: string;
  subtitle?: string;
  brand?: string;
  categoryLabel?: string;
  subcategoryLabel?: string;
  universe?: string;
  notes?: string;
  source: "upcitemdb" | "openlibrary";
};

function cleanCode(value?: string) {
  return String(value ?? "").replace(/\D/g, "").trim();
}

function looksLikeIsbn(code: string) {
  return code.length === 10 || code.length === 13;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = cleanCode(searchParams.get("code") ?? "");

  if (!code) {
    return NextResponse.json({ error: "Provide ?code=<upc-or-isbn>" }, { status: 400 });
  }

  const normalizedIsbn = looksLikeIsbn(code) ? normalizeIsbn(code) : "";

  // ── Book path (OpenLibrary/Google Books) -- cached, no daily-budget gate. ──
  if (normalizedIsbn) {
    const cacheKey = `isbn:${normalizedIsbn}`;
    const cached = await getCachedLookup<UpcLookupResult>("book-isbn", cacheKey);
    if (cached) return NextResponse.json({ result: cached, cached: true });

    try {
      const book = await lookupBookByIsbn(normalizedIsbn);
      if (!book) return NextResponse.json({ result: null });

      const result: UpcLookupResult = {
        code: normalizedIsbn,
        title: book.title,
        subtitle: book.subtitle,
        categoryLabel: "Books",
        subcategoryLabel: "Book",
        universe: "POP_CULTURE",
        notes: book.notes,
        source: "openlibrary",
      };
      await putCachedLookup("book-isbn", cacheKey, result);
      return NextResponse.json({ result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Book lookup failed.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // ── Product path (upcitemdb) -- cached AND daily-budget guarded. ──
  const cached = await getCachedLookup<UpcLookupResult>("upcitemdb", code);
  if (cached) return NextResponse.json({ result: cached, cached: true });

  const reserved = await reserveDailyCall("upcitemdb", SAFE_DAILY_CAP);
  if (!reserved.allowed) {
    return NextResponse.json(
      {
        error:
          "Product lookups are paused for today — the shared daily call budget is used up (upcitemdb's free tier caps at 100/day, account-wide, same protection built for PSA). Fill this item in by hand, or try again tomorrow.",
        budgetPaused: true,
      },
      { status: 503 }
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.status === 429) {
      // upcitemdb's own quota-exceeded response -- mark today exhausted so
      // every OTHER call the rest of today short-circuits above instead of
      // spending another real call to find out the same way.
      await markProviderExhausted("upcitemdb");
      return NextResponse.json(
        {
          error: "upcitemdb's daily quota is exhausted for today. Fill this item in by hand, or try again tomorrow.",
          budgetPaused: true,
        },
        { status: 503 }
      );
    }

    if (!response.ok) {
      return NextResponse.json({ error: `UPC lookup failed: ${response.status}` }, { status: 502 });
    }

    const payload = (await response.json()) as {
      code?: string;
      total?: number;
      items?: Array<Record<string, unknown>>;
    };

    const item = Array.isArray(payload.items) ? payload.items[0] : null;
    if (!item) return NextResponse.json({ result: null });

    const title = String(item.title ?? item.description ?? "").trim();
    if (!title) return NextResponse.json({ result: null });

    const category = String(item.category ?? "").trim();
    const brand = String(item.brand ?? "").trim();

    const result: UpcLookupResult = {
      code,
      title,
      brand: brand || undefined,
      categoryLabel: category || "Product",
      subcategoryLabel: brand || undefined,
      universe: "MISC",
      notes: String(item.description ?? "").trim() || undefined,
      source: "upcitemdb",
    };

    await putCachedLookup("upcitemdb", code, result);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UPC lookup failed.";
    if (message.includes("abort")) {
      return NextResponse.json({ error: "UPC lookup timed out." }, { status: 504 });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

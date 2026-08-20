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
  source: "upcitemdb" | "openlibrary" | "scandex";
};

// ScanDex: video-game barcode -> IGDB metadata (https://scandex.gamery.app).
// Real API contract confirmed 2026-08-19 via their public docs — base URL,
// /lookup?value=<code> GET, Authorization header, response shape below.
// upcitemdb's general retail catalog doesn't specialize in games (the
// Nintendo Switch UPC gap that started this), so this is tried as a
// fallback specifically for that miss, not a replacement for upcitemdb.
// No confirmed hard daily cap ("Free During Launch Period" per their docs)
// so this gets the permanent cache like Discogs/Metron, not an invented
// daily-budget gate.
const SCANDEX_BASE = "https://scandex.gamery.app/api/v2";

type ScanDexResponse = {
  id: number;
  source?: string;
  status?: string;
  igdb_metadata: { id: number; name?: string; platform?: { id: number; name?: string } } | null;
  title?: string;
  platform?: string;
};

type ScanDexDebug = { attempted: boolean; status?: number; body?: string; error?: string };

async function lookupScanDex(code: string): Promise<{ result: UpcLookupResult | null; debug: ScanDexDebug }> {
  const token = process.env.SCANDEX_API_TOKEN ?? "";
  if (!token) return { result: null, debug: { attempted: false } }; // Not configured yet.

  const cacheKey = code;
  const cached = await getCachedLookup<UpcLookupResult>("scandex", cacheKey);
  if (cached) return { result: cached, debug: { attempted: true, status: 200, body: "(from cache)" } };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${SCANDEX_BASE}/lookup?value=${encodeURIComponent(code)}`, {
      headers: { Authorization: token, Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.status === 404) {
      return { result: null, debug: { attempted: true, status: 404, body: "not in ScanDex's database" } };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[ScanDex] lookup failed", { status: res.status, body: body.slice(0, 300) });
      return { result: null, debug: { attempted: true, status: res.status, body: body.slice(0, 300) } };
    }

    const data = (await res.json()) as ScanDexResponse;
    const name = data.igdb_metadata?.name || data.title;
    if (!name || data.status === "unmatched") {
      return { result: null, debug: { attempted: true, status: res.status, body: JSON.stringify(data).slice(0, 300) } };
    }

    const result: UpcLookupResult = {
      code,
      title: name,
      categoryLabel: "Video Games",
      subcategoryLabel: data.igdb_metadata?.platform?.name || data.platform || undefined,
      universe: "GAMES",
      source: "scandex",
    };
    await putCachedLookup("scandex", cacheKey, result);
    return { result, debug: { attempted: true, status: res.status, body: name } };
  } catch (err) {
    clearTimeout(timeout);
    return { result: null, debug: { attempted: true, error: err instanceof Error ? err.message : String(err) } };
  }
}

function cleanCode(value?: string) {
  return String(value ?? "").replace(/\D/g, "").trim();
}

function looksLikeIsbn(code: string) {
  return code.length === 10 || code.length === 13;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = cleanCode(searchParams.get("code") ?? "");
  const debug = searchParams.get("debug") === "1"; // TEMP (2026-08-19) — see lookupScanDex.

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
    if (!item) {
      // Games are exactly the coverage gap that started this — try ScanDex
      // before giving up. No-ops instantly (null) if SCANDEX_API_TOKEN isn't
      // set, so this costs nothing when the provider isn't configured yet.
      const scandex = await lookupScanDex(code);
      return NextResponse.json({ result: scandex.result, _diagVersion: "v3", _debugParam: debug, scandexDebug: scandex.debug });
    }

    const title = String(item.title ?? item.description ?? "").trim();
    if (!title) {
      const scandex = await lookupScanDex(code);
      return NextResponse.json({ result: scandex.result, _diagVersion: "v3", _debugParam: debug, scandexDebug: scandex.debug });
    }

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

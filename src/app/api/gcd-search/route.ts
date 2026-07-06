import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET /api/gcd-search
 *
 * Searches the Grand Comics Database (GCD) comic reference data stored in
 * Supabase (tables gcd_publisher / gcd_series / gcd_issue, flattened by the
 * gcd_comic_search view). English-language subset only.
 *
 * Loaded once via scripts/gcd-load-supabase.js. Public read-only data.
 *
 * Query params:
 *   series=string    → series name (case-insensitive contains)
 *   issue=string     → exact issue number
 *   publisher=string → publisher name (case-insensitive contains)
 *   barcode=string   → exact barcode match
 *   isbn=string      → exact ISBN match
 *   page=number      → page (default 1)
 *   per_page=number  → results per page (default 25, max 100)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type GcdIssue = {
  id: number;
  series: string;
  number: string;
  publisher: string;
  publicationDate: string | null;
  onSaleDate: string | null;
  coverDate: string | null;
  pageCount: number | null;
  price: string | null;
  isbn: string | null;
  barcode: string | null;
  notes: string | null;
  variantName: string | null;
  coverImageUrl: string | null;
};

type ViewRow = {
  id: number;
  series: string;
  number: string;
  publisher: string;
  publication_date: string | null;
  on_sale_date: string | null;
  cover_date: string | null;
  page_count: number | null;
  price: string | null;
  isbn: string | null;
  valid_isbn: string | null;
  barcode: string | null;
  notes: string | null;
  variant_name: string | null;
  series_sort: string | null;
};

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function rowToIssue(row: ViewRow): GcdIssue {
  return {
    id: Number(row.id),
    series: row.series,
    number: row.number,
    publisher: row.publisher,
    publicationDate: row.publication_date || null,
    onSaleDate: row.on_sale_date || null,
    coverDate: row.cover_date || null,
    pageCount: row.page_count != null ? Number(row.page_count) : null,
    price: row.price || null,
    isbn: row.isbn || null,
    barcode: row.barcode || null,
    notes: row.notes || null,
    variantName: row.variant_name || null,
    coverImageUrl: null,
  };
}

function escapeLike(value: string) {
  // Escape PostgREST filter wildcards so user text is treated literally
  return value.replace(/[%,()]/g, " ").trim();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const series    = (searchParams.get("series")    ?? "").trim();
  const issue     = (searchParams.get("issue")     ?? "").trim();
  const publisher = (searchParams.get("publisher") ?? "").trim();
  const barcode   = (searchParams.get("barcode")   ?? "").trim();
  const isbn      = (searchParams.get("isbn")      ?? "").trim();
  const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage   = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "25", 10)));
  const offset    = (page - 1) * perPage;

  if (searchParams.get("creator")) {
    return NextResponse.json(
      { error: "Creator search is not available. Search by series, publisher, barcode, or ISBN." },
      { status: 400 }
    );
  }

  if (!series && !publisher && !barcode && !isbn) {
    return NextResponse.json(
      { error: "Provide at least one of: series, publisher, barcode, isbn" },
      { status: 400 }
    );
  }

  const supabase = getClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / ANON_KEY)." },
      { status: 503 }
    );
  }

  try {
    let query = supabase
      .from("gcd_comic_search")
      .select(
        "id,series,series_sort,number,publisher,publication_date,on_sale_date,cover_date,page_count,price,isbn,valid_isbn,barcode,notes,variant_name",
        { count: "exact" }
      );

    if (series)    query = query.ilike("series", `%${escapeLike(series)}%`);
    if (publisher) query = query.ilike("publisher", `%${escapeLike(publisher)}%`);
    if (issue)     query = query.eq("number", issue);
    if (barcode)   query = query.eq("barcode", barcode);
    if (isbn)      query = query.or(`valid_isbn.eq.${isbn},isbn.eq.${isbn}`);

    query = query
      .order("series_sort", { ascending: true })
      .order("number", { ascending: true })
      .range(offset, offset + perPage - 1);

    const { data, count, error } = await query;
    if (error) {
      return NextResponse.json({ error: `Query failed: ${error.message}` }, { status: 500 });
    }

    const rows = (data ?? []) as ViewRow[];
    const total = count ?? 0;

    return NextResponse.json({
      results: rows.map(rowToIssue),
      count: total,
      page,
      perPage,
      hasMore: offset + rows.length < total,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Query failed: ${msg}` }, { status: 500 });
  }
}

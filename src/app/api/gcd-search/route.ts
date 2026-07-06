import { NextResponse } from "next/server";
import { createClient, type Client } from "@libsql/client";
import path from "path";

/**
 * GET /api/gcd-search
 *
 * Searches the Grand Comics Database (GCD) via libSQL.
 *
 * Data source (chosen automatically):
 *   • Production: Turso (libSQL) — set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.
 *   • Local dev:  the trimmed SQLite file at <project root>/data/gcd.db
 *                 (built with `node --experimental-sqlite scripts/gcd-trim.js`).
 *
 * The trimmed DB holds only gcd_publisher / gcd_series / gcd_issue — enough to
 * match a scanned comic to its series, issue number, publisher, dates, ISBN,
 * and barcode. Creator/story search is not included (those tables are ~16M rows
 * and blow past serverless size limits).
 *
 * Query params:
 *   series=string    → search by series name (LIKE %series%)
 *   issue=string     → filter by exact issue number
 *   publisher=string → filter by publisher name (LIKE %publisher%)
 *   barcode=string   → exact barcode match
 *   isbn=string      → exact ISBN match (valid_isbn)
 *   page=number      → page (default 1)
 *   per_page=number  → results per page (default 25, max 100)
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCAL_DB_PATH = path.join(process.cwd(), "data", "gcd.db");

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

/* ── libSQL client singleton ─────────────────────────────────── */

let client: Client | null = null;
let clientError: string | null = null;

function getClient(): Client {
  if (client) return client;
  if (clientError) throw new Error(clientError);
  try {
    const tursoUrl = process.env.TURSO_DATABASE_URL;
    const tursoToken = process.env.TURSO_AUTH_TOKEN;
    client = tursoUrl
      ? createClient({ url: tursoUrl, authToken: tursoToken })
      : createClient({ url: `file:${LOCAL_DB_PATH}` });
    return client;
  } catch (err) {
    clientError = err instanceof Error ? err.message : String(err);
    throw new Error(clientError);
  }
}

type Row = {
  id: number;
  series: string;
  number: string;
  publisher: string;
  publication_date: string | null;
  on_sale_date: string | null;
  key_date: string | null;
  page_count: number | null;
  price: string | null;
  isbn: string | null;
  barcode: string | null;
  notes: string | null;
  variant_name: string | null;
};

function rowToIssue(row: Row): GcdIssue {
  return {
    id: Number(row.id),
    series: row.series,
    number: row.number,
    publisher: row.publisher,
    publicationDate: row.publication_date || null,
    onSaleDate: row.on_sale_date || null,
    coverDate: row.key_date || null,
    pageCount: row.page_count != null ? Number(row.page_count) : null,
    price: row.price || null,
    isbn: row.isbn || null,
    barcode: row.barcode || null,
    notes: row.notes || null,
    variantName: row.variant_name || null,
    coverImageUrl: null, // GCD cover URLs require their own CDN mapping
  };
}

/* ── GET handler ─────────────────────────────────────────────── */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const series    = (searchParams.get("series")    ?? "").trim();
  const issue     = (searchParams.get("issue")     ?? "").trim();
  const publisher = (searchParams.get("publisher") ?? "").trim();
  const barcode   = (searchParams.get("barcode")   ?? "").trim();
  const isbn      = (searchParams.get("isbn")       ?? "").trim();
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

  let db: Client;
  try {
    db = getClient();
  } catch {
    return NextResponse.json(
      {
        error: "GCD database not configured",
        setup: [
          "Local: build data/gcd.db with `node --experimental-sqlite scripts/gcd-trim.js <full-dump.db>`",
          "Production: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the environment.",
        ],
      },
      { status: 503 }
    );
  }

  try {
    const conditions: string[] = [];
    const args: (string | number)[] = [];

    if (series) {
      conditions.push("s.name LIKE ?");
      args.push(`%${series}%`);
    }
    if (publisher) {
      conditions.push("p.name LIKE ?");
      args.push(`%${publisher}%`);
    }
    if (issue) {
      conditions.push("i.number = ?");
      args.push(issue);
    }
    if (barcode) {
      conditions.push("i.barcode = ?");
      args.push(barcode);
    }
    if (isbn) {
      conditions.push("(i.valid_isbn = ? OR i.isbn = ?)");
      args.push(isbn, isbn);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const mainQuery = `
      SELECT
        i.id,
        s.name AS series,
        i.number,
        p.name AS publisher,
        i.publication_date,
        i.on_sale_date,
        i.key_date,
        i.page_count,
        i.price,
        i.isbn,
        i.barcode,
        i.notes,
        i.variant_name
      FROM gcd_issue i
      JOIN gcd_series s ON i.series_id = s.id
      JOIN gcd_publisher p ON s.publisher_id = p.id
      ${whereClause}
      ORDER BY (i.key_date IS NULL OR i.key_date = ''), s.name, CAST(i.number AS INTEGER), i.number
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) AS cnt
      FROM gcd_issue i
      JOIN gcd_series s ON i.series_id = s.id
      JOIN gcd_publisher p ON s.publisher_id = p.id
      ${whereClause}
    `;

    const countResult = await db.execute({ sql: countQuery, args });
    const count = Number((countResult.rows[0] as unknown as { cnt: number })?.cnt ?? 0);

    const rowsResult = await db.execute({ sql: mainQuery, args: [...args, perPage, offset] });
    const rows = rowsResult.rows as unknown as Row[];

    return NextResponse.json({
      results: rows.map(rowToIssue),
      count,
      page,
      perPage,
      hasMore: offset + rows.length < count,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Query failed: ${msg}` }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

/**
 * GET /api/gcd-search
 *
 * Searches the local GCD (Grand Comics Database) SQLite file.
 *
 * The GCD provides a free monthly MySQL dump at https://www.comics.org/download/
 * (registration required). Convert to SQLite with `mysql2sqlite` or use
 * the import script at scripts/gcd-import.ts.
 *
 * Expected SQLite file location: <project root>/data/gcd.db
 *
 * Query params:
 *   series=string    → search by series name (LIKE %series%)
 *   issue=string     → search by issue number
 *   publisher=string → filter by publisher name
 *   creator=string   → search by creator name (joins gcd_credit + gcd_creator)
 *   page=number      → page (default 1)
 *   per_page=number  → results per page (default 25, max 100)
 *
 * Returns:
 *   { results: GcdIssue[], count: number, page: number, hasMore: boolean }
 *
 * If the GCD database hasn't been imported yet, returns a 503 with setup instructions.
 */

const GCD_DB_PATH = path.join(process.cwd(), "data", "gcd.db");

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
  coverImageUrl: string | null;
};

/* ── DB singleton (module-level, survives hot reload in dev) ─── */

let db: ReturnType<typeof Database> | null = null;
let dbError: string | null = null;

function getDb(): ReturnType<typeof Database> {
  if (db) return db;
  if (dbError) throw new Error(dbError);
  try {
    db = new Database(GCD_DB_PATH, { readonly: true, fileMustExist: true });
    db.pragma("journal_mode = WAL");
    db.pragma("query_only = true");
    return db;
  } catch (err) {
    dbError = err instanceof Error ? err.message : String(err);
    throw new Error(dbError);
  }
}

/* ── Search logic ────────────────────────────────────────────── */

/**
 * GCD MySQL schema key tables (abbreviated):
 *
 *  gcd_series      id, name, publisher_id, year_began, year_ended, country_id
 *  gcd_issue       id, series_id, number, publication_date, on_sale_date,
 *                  cover_date, price, page_count, isbn, barcode, notes
 *  gcd_publisher   id, name, country_id
 *  gcd_story       id, issue_id, title, type_id, feature, page_count
 *  gcd_credit      id, story_id, creator_id, credit_type_id
 *  gcd_creator     id, gcd_official_name, disambiguation
 *
 * We build a flattened view joining series + issue + publisher.
 * Creator joins require joining through story → credit → creator.
 *
 * GCD cover images: https://files.comics.org/img/gcd/covers_by_id/
 *   No guaranteed URL pattern. They provide cover scans separately.
 *   We return null for coverImageUrl — the UI can show the GCD page link instead.
 */

type Row = {
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
  barcode: string | null;
  notes: string | null;
};

function rowToIssue(row: Row): GcdIssue {
  return {
    id: row.id,
    series: row.series,
    number: row.number,
    publisher: row.publisher,
    publicationDate: row.publication_date ?? null,
    onSaleDate: row.on_sale_date ?? null,
    coverDate: row.cover_date ?? null,
    pageCount: row.page_count ?? null,
    price: row.price ?? null,
    isbn: row.isbn ?? null,
    barcode: row.barcode ?? null,
    notes: row.notes ?? null,
    coverImageUrl: null, // GCD cover URLs require their own CDN mapping
  };
}

/* ── GET handler ─────────────────────────────────────────────── */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const series    = (searchParams.get("series")    ?? "").trim();
  const issue     = (searchParams.get("issue")     ?? "").trim();
  const publisher = (searchParams.get("publisher") ?? "").trim();
  const creator   = (searchParams.get("creator")   ?? "").trim();
  const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage   = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") ?? "25", 10)));
  const offset    = (page - 1) * perPage;

  if (!series && !creator && !publisher) {
    return NextResponse.json(
      { error: "Provide at least one of: series, creator, publisher" },
      { status: 400 }
    );
  }

  let database: ReturnType<typeof Database>;
  try {
    database = getDb();
  } catch {
    return NextResponse.json(
      {
        error: "GCD database not found",
        setup: [
          "1. Register at https://www.comics.org/accounts/register/",
          "2. Download the latest dump from https://www.comics.org/download/",
          "3. Run: node scripts/gcd-import.js  (converts MySQL dump → SQLite at data/gcd.db)",
          "4. Restart the dev server",
        ],
        estimatedSize: "~400-600 MB compressed, ~2-3 GB SQLite",
      },
      { status: 503 }
    );
  }

  try {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (series) {
      conditions.push("s.name LIKE ?");
      params.push(`%${series}%`);
    }
    if (publisher) {
      conditions.push("p.name LIKE ?");
      params.push(`%${publisher}%`);
    }
    if (issue) {
      conditions.push("i.number = ?");
      params.push(issue);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    if (creator) {
      // Creator search requires joining through stories and credits
      const creatorQuery = `
        SELECT DISTINCT
          i.id,
          s.name AS series,
          i.number,
          p.name AS publisher,
          i.publication_date,
          i.on_sale_date,
          i.cover_date,
          i.page_count,
          i.price,
          i.isbn,
          i.barcode,
          i.notes
        FROM gcd_issue i
        JOIN gcd_series s ON i.series_id = s.id
        JOIN gcd_publisher p ON s.publisher_id = p.id
        JOIN gcd_story st ON st.issue_id = i.id
        JOIN gcd_credit c ON c.story_id = st.id
        JOIN gcd_creator cr ON cr.id = c.creator_id
        ${whereClause ? whereClause + " AND" : "WHERE"}
          cr.gcd_official_name LIKE ?
        ORDER BY s.name, i.number
        LIMIT ? OFFSET ?
      `;

      const countQuery = `
        SELECT COUNT(DISTINCT i.id) AS cnt
        FROM gcd_issue i
        JOIN gcd_series s ON i.series_id = s.id
        JOIN gcd_publisher p ON s.publisher_id = p.id
        JOIN gcd_story st ON st.issue_id = i.id
        JOIN gcd_credit c ON c.story_id = st.id
        JOIN gcd_creator cr ON cr.id = c.creator_id
        ${whereClause ? whereClause + " AND" : "WHERE"}
          cr.gcd_official_name LIKE ?
      `;

      const creatorParam = `%${creator}%`;
      const allParams = [...params, creatorParam];

      const count = (database.prepare(countQuery).get([...allParams]) as { cnt: number }).cnt;
      const rows  = database.prepare(creatorQuery).all([...allParams, perPage, offset]) as Row[];

      return NextResponse.json({
        results: rows.map(rowToIssue),
        count,
        page,
        perPage,
        hasMore: offset + rows.length < count,
      });
    }

    // Series / publisher / issue search (no creator join)
    const mainQuery = `
      SELECT
        i.id,
        s.name AS series,
        i.number,
        p.name AS publisher,
        i.publication_date,
        i.on_sale_date,
        i.cover_date,
        i.page_count,
        i.price,
        i.isbn,
        i.barcode,
        i.notes
      FROM gcd_issue i
      JOIN gcd_series s ON i.series_id = s.id
      JOIN gcd_publisher p ON s.publisher_id = p.id
      ${whereClause}
      ORDER BY s.name, i.number
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) AS cnt
      FROM gcd_issue i
      JOIN gcd_series s ON i.series_id = s.id
      JOIN gcd_publisher p ON s.publisher_id = p.id
      ${whereClause}
    `;

    const count = (database.prepare(countQuery).get(params) as { cnt: number }).cnt;
    const rows  = database.prepare(mainQuery).all([...params, perPage, offset]) as Row[];

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

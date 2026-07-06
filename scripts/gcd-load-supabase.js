#!/usr/bin/env node
/**
 * GCD → Supabase loader
 * =====================
 * One-time bulk load of the English-language GCD comic subset into Supabase
 * Postgres. Runs the DDL migration, then COPYs the rows straight from the local
 * SQLite dump — no intermediate CSV files.
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_DB_URL = "postgresql://postgres:PASSWORD@db.xxxx.supabase.co:5432/postgres"
 *   node --experimental-sqlite scripts/gcd-load-supabase.js "C:\\Users\\EK\\Downloads\\2026-07-01.db"
 *
 * SUPABASE_DB_URL is the "Connection string (URI)" from
 *   Supabase dashboard → Project Settings → Database → Connection string.
 * It contains your DB password — it is used only for this load and never stored.
 *
 * Only English-language (language_id = 25), non-deleted rows are loaded.
 */

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { Client } = require("pg");
const copyFrom = require("pg-copy-streams").from;

const ENGLISH_LANG_ID = 25;
const SRC = process.argv[2];
const DB_URL = process.env.SUPABASE_DB_URL;
const MIGRATION = path.join(__dirname, "..", "supabase", "migrations", "20260706_gcd_comics.sql");

if (!DB_URL) {
  console.error("Set SUPABASE_DB_URL to your Supabase 'Connection string (URI)' first.");
  process.exit(1);
}
if (!SRC || !fs.existsSync(SRC)) {
  console.error("Usage: node --experimental-sqlite scripts/gcd-load-supabase.js <path-to-full.db>");
  process.exit(1);
}

/** CSV-escape one value for COPY (FORMAT csv, NULL ''). null → empty field. */
function csv(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s === "") return "";
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// table → { columns, sqliteQuery }
const LOADS = [
  {
    table: "gcd_publisher",
    columns: ["id", "name", "country_id", "year_began", "year_ended"],
    sql: `SELECT id, name, country_id, year_began, year_ended
          FROM gcd_publisher WHERE deleted = 0`,
  },
  {
    table: "gcd_series",
    columns: ["id", "name", "sort_name", "year_began", "year_ended",
              "publisher_id", "language_id", "is_comics_publication", "issue_count"],
    sql: `SELECT id, name, sort_name, year_began, year_ended,
                 publisher_id, language_id, is_comics_publication, issue_count
          FROM gcd_series WHERE deleted = 0 AND language_id = ${ENGLISH_LANG_ID}`,
  },
  {
    table: "gcd_issue",
    columns: ["id", "number", "series_id", "publication_date", "key_date",
              "on_sale_date", "price", "page_count", "isbn", "valid_isbn",
              "barcode", "title", "notes", "variant_of_id", "variant_name"],
    sql: `SELECT i.id, i.number, i.series_id, i.publication_date, i.key_date,
                 i.on_sale_date, i.price, i.page_count, i.isbn, i.valid_isbn,
                 i.barcode, i.title, i.notes, i.variant_of_id, i.variant_name
          FROM gcd_issue i
          JOIN gcd_series s ON i.series_id = s.id
          WHERE i.deleted = 0 AND s.deleted = 0 AND s.language_id = ${ENGLISH_LANG_ID}`,
  },
];

async function loadTable(pg, src, load) {
  const t0 = Date.now();
  process.stdout.write(`Loading ${load.table}… `);

  // Fresh table each run
  await pg.query(`TRUNCATE public.${load.table} CASCADE`);

  const colList = load.columns.join(", ");
  const stream = pg.query(
    copyFrom(`COPY public.${load.table} (${colList}) FROM STDIN WITH (FORMAT csv, NULL '')`)
  );

  const rows = src.prepare(load.sql).iterate();
  let n = 0;

  await new Promise((resolve, reject) => {
    stream.on("error", reject);
    stream.on("finish", resolve);

    function pump() {
      let ok = true;
      while (ok) {
        const next = rows.next();
        if (next.done) {
          stream.end();
          return;
        }
        const row = next.value;
        const line = load.columns.map((c) => csv(row[c])).join(",") + "\n";
        n += 1;
        ok = stream.write(line);
      }
      stream.once("drain", pump);
    }
    pump();
  });

  console.log(`${n.toLocaleString()} rows (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

async function main() {
  const src = new DatabaseSync(SRC, { readOnly: true });
  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();

  try {
    console.log("Running migration DDL…");
    await pg.query(fs.readFileSync(MIGRATION, "utf-8"));

    for (const load of LOADS) {
      await loadTable(pg, src, load);
    }

    console.log("\nAnalyzing tables…");
    await pg.query("ANALYZE public.gcd_publisher, public.gcd_series, public.gcd_issue");

    const sizes = await pg.query(`
      SELECT relname AS table, pg_size_pretty(pg_total_relation_size(c.oid)) AS size
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND relname IN ('gcd_publisher','gcd_series','gcd_issue')
      ORDER BY pg_total_relation_size(c.oid) DESC
    `);
    console.log("\nStored sizes:");
    for (const r of sizes.rows) console.log(`  ${r.table}: ${r.size}`);

    console.log("\n✓ Load complete. Comic search will use Supabase in production.");
  } finally {
    await pg.end();
    src.close();
  }
}

main().catch((err) => {
  console.error("\nLoad failed:", err.message);
  process.exit(1);
});

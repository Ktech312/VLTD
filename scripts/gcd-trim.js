#!/usr/bin/env node
/**
 * GCD SQLite trimmer
 * ==================
 * Reads the full GCD SQLite dump (~6.6 GB) and writes a small, deploy-ready
 * database containing only the tables + columns comic lookup needs:
 *
 *   gcd_publisher  (id, name, ...)
 *   gcd_series     (id, name, publisher_id, ...)
 *   gcd_issue      (id, number, series_id, key_date, isbn, barcode, ...)
 *
 * Creator/story search (gcd_story 4.5M rows + gcd_story_credit 11.7M rows) is
 * intentionally left OUT — those tables are what make the dump huge and aren't
 * needed to match a scanned comic to a series/issue/publisher.
 *
 * Only non-deleted rows are copied. Output goes to data/gcd.db.
 *
 * Usage:
 *   node --experimental-sqlite scripts/gcd-trim.js "C:\\path\\to\\2026-07-01.db"
 *
 * Uses Node's built-in node:sqlite (Node 22.5+/24) — no native build needed.
 */

const fs = require("fs");
const path = require("path");

let DatabaseSync;
try {
  ({ DatabaseSync } = require("node:sqlite"));
} catch {
  console.error("node:sqlite unavailable. Run with: node --experimental-sqlite scripts/gcd-trim.js <db>");
  process.exit(1);
}

const SRC = process.argv[2];
if (!SRC) {
  console.error("Usage: node --experimental-sqlite scripts/gcd-trim.js <path-to-full.db>");
  process.exit(1);
}

const OUT = path.join(__dirname, "..", "data", "gcd.db");

// Columns to keep per table (everything the search route returns, plus join keys)
const COPIES = [
  {
    table: "gcd_publisher",
    columns: ["id", "name", "country_id", "year_began", "year_ended"],
    where: "deleted = 0",
  },
  {
    table: "gcd_series",
    columns: [
      "id", "name", "sort_name", "year_began", "year_ended",
      "publisher_id", "country_id", "language_id",
      "is_comics_publication", "issue_count",
    ],
    where: "deleted = 0",
  },
  {
    table: "gcd_issue",
    columns: [
      "id", "number", "series_id", "publication_date", "key_date",
      "on_sale_date", "price", "page_count", "isbn", "valid_isbn",
      "barcode", "title", "notes", "variant_of_id", "variant_name",
    ],
    where: "deleted = 0",
  },
];

const INDEXES = [
  "CREATE INDEX idx_series_name ON gcd_series(name)",
  "CREATE INDEX idx_series_sortname ON gcd_series(sort_name)",
  "CREATE INDEX idx_series_publisher ON gcd_series(publisher_id)",
  "CREATE INDEX idx_issue_series ON gcd_issue(series_id)",
  "CREATE INDEX idx_issue_number ON gcd_issue(number)",
  "CREATE INDEX idx_issue_barcode ON gcd_issue(barcode)",
  "CREATE INDEX idx_issue_isbn ON gcd_issue(valid_isbn)",
  "CREATE INDEX idx_publisher_name ON gcd_publisher(name)",
];

function bytesToGb(n) {
  return (n / 1e9).toFixed(2) + " GB";
}
function bytesToMb(n) {
  return (n / 1e6).toFixed(0) + " MB";
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source not found: ${SRC}`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  for (const suffix of ["", "-wal", "-shm", ".bak"]) {
    const f = OUT + suffix;
    if (fs.existsSync(f)) fs.rmSync(f);
  }

  console.log(`Source: ${SRC} (${bytesToGb(fs.statSync(SRC).size)})`);
  console.log(`Output: ${OUT}\n`);

  // Open the NEW db read-write as main; attach the source read-only-ish.
  const db = new DatabaseSync(OUT);
  db.exec("PRAGMA journal_mode = OFF");
  db.exec("PRAGMA synchronous = OFF");
  const srcEscaped = SRC.replace(/'/g, "''");
  db.exec(`ATTACH DATABASE '${srcEscaped}' AS src`);

  for (const copy of COPIES) {
    const cols = copy.columns.join(", ");
    const t0 = Date.now();
    process.stdout.write(`Copying ${copy.table}… `);
    db.exec(
      `CREATE TABLE ${copy.table} AS SELECT ${cols} FROM src.${copy.table} WHERE ${copy.where}`
    );
    const count = db.prepare(`SELECT COUNT(*) AS c FROM ${copy.table}`).get().c;
    console.log(`${count.toLocaleString()} rows (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }

  console.log("\nCreating indexes…");
  for (const idx of INDEXES) {
    process.stdout.write("  " + idx.split(" ON ")[0].replace("CREATE INDEX ", "") + "… ");
    const t0 = Date.now();
    db.exec(idx);
    console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }

  db.exec("DETACH DATABASE src");
  console.log("\nCompacting (VACUUM)…");
  db.exec("VACUUM");
  db.close();

  const finalSize = fs.statSync(OUT).size;
  console.log(`\n✓ Trimmed database written: ${OUT}`);
  console.log(`  Final size: ${bytesToMb(finalSize)} (${bytesToGb(finalSize)})`);
  console.log("\nNext: upload to Turso, then set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN in Vercel.");
}

main().catch((err) => {
  console.error("\nTrim failed:", err.message);
  process.exit(1);
});

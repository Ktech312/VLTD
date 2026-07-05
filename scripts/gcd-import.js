#!/usr/bin/env node
/**
 * GCD MySQL → SQLite importer
 *
 * Usage:
 *   node scripts/gcd-import.js [path-to-dump.sql.gz]
 *
 * If no path is given, looks for the latest *.sql.gz in the ./data/ directory.
 *
 * What this does:
 *   1. Decompresses the GCD MySQL dump (gzip)
 *   2. Extracts only the tables we need (gcd_series, gcd_issue, gcd_publisher,
 *      gcd_story, gcd_credit, gcd_creator)
 *   3. Converts MySQL syntax to SQLite-compatible SQL
 *   4. Imports into data/gcd.db
 *   5. Creates indexes for fast search
 *
 * Requirements:
 *   npm install better-sqlite3
 *   (already in package.json if you ran `npm install` after adding the GCD route)
 *
 * The dump is ~400-600 MB compressed, ~2-3 GB uncompressed.
 * Import takes 5-15 minutes depending on your machine.
 * The final SQLite file is ~1-2 GB.
 *
 * GCD dump download: https://www.comics.org/download/
 * (Free account required)
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const readline = require("readline");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data");
const OUT_DB   = path.join(DATA_DIR, "gcd.db");

// Tables we actually need for search
const WANTED_TABLES = new Set([
  "gcd_series",
  "gcd_issue",
  "gcd_publisher",
  "gcd_story",
  "gcd_credit",
  "gcd_creator",
]);

// MySQL → SQLite syntax fixes
function mysqlToSqlite(line) {
  return line
    .replace(/`/g, "")                          // backtick identifiers
    .replace(/\bENGINE\s*=\s*\w+[^;]*/gi, "")  // ENGINE= clauses
    .replace(/\bDEFAULT\s+CHARSET\s*=\s*\w+/gi, "")
    .replace(/\bCOLLATE\s*=\s*\S+/gi, "")
    .replace(/\bCOLLATE\s+\S+/gi, "")
    .replace(/\bAUTO_INCREMENT\s*=\s*\d+/gi, "")
    .replace(/\bAUTO_INCREMENT\b/gi, "AUTOINCREMENT")
    .replace(/\btinyint\(\d+\)/gi, "INTEGER")
    .replace(/\bsmallint\(\d+\)/gi, "INTEGER")
    .replace(/\bmediumint\(\d+\)/gi, "INTEGER")
    .replace(/\bint\(\d+\)/gi, "INTEGER")
    .replace(/\bbigint\(\d+\)/gi, "INTEGER")
    .replace(/\bfloat\b/gi, "REAL")
    .replace(/\bdouble\b/gi, "REAL")
    .replace(/\bdecimal\([^)]+\)/gi, "REAL")
    .replace(/\bvarchar\([^)]+\)/gi, "TEXT")
    .replace(/\bmediumtext\b/gi, "TEXT")
    .replace(/\blongtext\b/gi, "TEXT")
    .replace(/\bmediumblob\b/gi, "BLOB")
    .replace(/\blongblob\b/gi, "BLOB")
    .replace(/\bdatetime\b/gi, "TEXT")
    .replace(/\btimestamp[^,)]*DEFAULT\s+CURRENT_TIMESTAMP[^,)]*/gi, "TEXT")
    .replace(/\btimestamp\b/gi, "TEXT")
    .replace(/\bUNSIGNED\b/gi, "")
    .replace(/\bZEROFILL\b/gi, "")
    .replace(/\bCOMMENT\s+'[^']*'/gi, "")
    .replace(/,\s*\)/g, ")")                    // trailing commas
    .replace(/KEY\s+\w+\s*\([^)]+\),?/g, "")   // non-PK indexes (we add manually)
    .replace(/UNIQUE\s+KEY\s+\w+/gi, "UNIQUE KEY_STRIP")
    .replace(/KEY_STRIP/g, "")
    .replace(/\bIF NOT EXISTS\b/gi, "");
}

async function main() {
  // Find dump file
  let dumpPath = process.argv[2];
  if (!dumpPath) {
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".sql.gz"));
    if (files.length === 0) {
      console.error("No .sql.gz dump found in ./data/. Download from https://www.comics.org/download/");
      process.exit(1);
    }
    dumpPath = path.join(DATA_DIR, files.sort().pop());
  }

  console.log(`Importing: ${dumpPath}`);
  console.log(`Output:    ${OUT_DB}`);
  console.log();

  if (fs.existsSync(OUT_DB)) {
    fs.renameSync(OUT_DB, OUT_DB + ".bak");
    console.log("Backed up existing gcd.db → gcd.db.bak");
  }

  const db = new Database(OUT_DB);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = OFF");  // speed: safe since we'll verify after
  db.pragma("cache_size = -131072"); // 128 MB cache

  let currentTable = null;
  let inWantedTable = false;
  let lineCount = 0;
  let insertCount = 0;
  let tableCount = 0;

  const stream = fs.createReadStream(dumpPath).pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let insertBatch = [];
  const BATCH_SIZE = 1000;

  let insertStmt = null;

  function flushBatch() {
    if (insertBatch.length === 0) return;
    const txn = db.transaction((rows) => {
      for (const row of rows) {
        try { db.exec(row); } catch { /* skip bad rows */ }
      }
    });
    txn(insertBatch);
    insertCount += insertBatch.length;
    insertBatch = [];
  }

  for await (const rawLine of rl) {
    lineCount++;
    if (lineCount % 100000 === 0) {
      process.stdout.write(`\r  ${lineCount.toLocaleString()} lines, ${insertCount.toLocaleString()} rows inserted...`);
    }

    const line = rawLine.trim();
    if (!line || line.startsWith("--") || line.startsWith("/*")) continue;
    if (line.startsWith("SET ") || line.startsWith("LOCK ") ||
        line.startsWith("UNLOCK ") || line.startsWith("DROP ")) continue;

    // Detect table start
    if (line.startsWith("CREATE TABLE")) {
      const match = line.match(/CREATE TABLE\s+`?(\w+)`?/i);
      if (match) {
        currentTable = match[1];
        inWantedTable = WANTED_TABLES.has(currentTable);
        if (inWantedTable) {
          tableCount++;
          console.log(`\n  Creating table: ${currentTable}`);
          insertStmt = null;
        }
      }
    }

    if (!inWantedTable) continue;

    // CREATE TABLE body
    if (!line.startsWith("INSERT INTO")) {
      const fixed = mysqlToSqlite(line);
      if (fixed.trim()) {
        try { db.exec(fixed); } catch { /* partial lines are expected */ }
      }
      continue;
    }

    // INSERT INTO lines — these are the bulk of the data
    const insertMatch = line.match(/INSERT INTO\s+`?(\w+)`?\s+VALUES\s+/i);
    if (insertMatch && WANTED_TABLES.has(insertMatch[1])) {
      insertBatch.push(mysqlToSqlite(line));
      if (insertBatch.length >= BATCH_SIZE) flushBatch();
    }
  }

  flushBatch();
  console.log(`\n\nDone! ${tableCount} tables, ${insertCount.toLocaleString()} total rows.`);

  // Create search indexes
  console.log("\nCreating indexes...");
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_series_name ON gcd_series(name)",
    "CREATE INDEX IF NOT EXISTS idx_issue_series ON gcd_issue(series_id)",
    "CREATE INDEX IF NOT EXISTS idx_issue_number ON gcd_issue(number)",
    "CREATE INDEX IF NOT EXISTS idx_publisher_name ON gcd_publisher(name)",
    "CREATE INDEX IF NOT EXISTS idx_story_issue ON gcd_story(issue_id)",
    "CREATE INDEX IF NOT EXISTS idx_credit_story ON gcd_credit(story_id)",
    "CREATE INDEX IF NOT EXISTS idx_credit_creator ON gcd_credit(creator_id)",
    "CREATE INDEX IF NOT EXISTS idx_creator_name ON gcd_creator(gcd_official_name)",
  ];
  for (const idx of indexes) {
    console.log(" ", idx.slice(0, 60) + "...");
    db.exec(idx);
  }

  db.close();
  console.log(`\n✓ Import complete: ${OUT_DB}`);
  console.log("  Start the dev server and try /api/gcd-search?series=Batman");
}

main().catch((err) => {
  console.error("Import failed:", err.message);
  process.exit(1);
});

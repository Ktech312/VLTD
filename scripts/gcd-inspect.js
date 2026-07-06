#!/usr/bin/env node
/**
 * GCD SQLite inspector
 * ====================
 * Reads the GCD SQLite dump and prints the tables + columns we care about,
 * plus row counts and a couple of sample rows. Used to confirm the real
 * schema before trimming/repointing the search route.
 *
 * Usage:
 *   node --experimental-sqlite scripts/gcd-inspect.js "C:\\path\\to\\2026-07-01.db"
 *
 * Node 22.5+ / 24 ships a built-in SQLite module (node:sqlite) — no native
 * build required (better-sqlite3 needs Visual Studio tooling; this does not).
 */

const path = require("path");

let DatabaseSync;
try {
  ({ DatabaseSync } = require("node:sqlite"));
} catch (err) {
  console.error(
    "node:sqlite is unavailable. Run with Node 22.5+ and the flag:\n" +
      "  node --experimental-sqlite scripts/gcd-inspect.js <db>"
  );
  process.exit(1);
}

const dbPath = process.argv[2];
if (!dbPath) {
  console.error("Usage: node --experimental-sqlite scripts/gcd-inspect.js <path-to.db>");
  process.exit(1);
}

const db = new DatabaseSync(path.resolve(dbPath), { readOnly: true });

// All tables in the file
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all()
  .map((r) => r.name);

console.log(`\n=== ${tables.length} tables in ${path.basename(dbPath)} ===\n`);

// Tables the comic search cares about (and likely GCD names)
const INTEREST = [
  "gcd_series",
  "gcd_issue",
  "gcd_publisher",
  "gcd_story",
  "gcd_story_credit",
  "gcd_credit",
  "gcd_creator",
  "gcd_creator_name_detail",
];

for (const name of tables) {
  const star = INTEREST.includes(name) ? " *" : "";
  let count = "?";
  try {
    count = db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get().c;
  } catch {
    /* ignore */
  }
  console.log(`${name}${star}  (${count} rows)`);
}

console.log("\n=== Columns for tables of interest ===");
for (const name of INTEREST) {
  if (!tables.includes(name)) continue;
  const cols = db.prepare(`PRAGMA table_info("${name}")`).all();
  console.log(`\n${name}:`);
  for (const col of cols) {
    console.log(`  ${col.name} ${col.type}${col.pk ? " PK" : ""}`);
  }
}

db.close();
console.log("\nDone.");

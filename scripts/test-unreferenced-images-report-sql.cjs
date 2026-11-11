// Local PostgreSQL (PGlite) check of supabase/validation/20261111_unreferenced_vault_images_report.sql: it is read-only, never lists a file that any item or exhibition mentions (in any column,
// including a column the report does not know), never lists a file younger than a day, and lists true leftovers.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const pgDir = process.env.PGLITE_DIR || "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/pglite";
const { PGlite } = require(path.join(pgDir, "node_modules/@electric-sql/pglite"));
const sql = fs.readFileSync(path.join(__dirname, "..", "supabase", "validation", "20261111_unreferenced_vault_images_report.sql"), "utf8");
let n = 0; const check = async (name, fn) => { await fn(); n++; console.log("PASS " + name); };
(async () => { const db = new PGlite(); try {
  await db.exec(`create schema storage; create table storage.objects (bucket_id text, name text, created_at timestamptz, metadata jsonb);
    create table public.vault_items (id text primary key, image_front_storage_path text, primary_image_key text, images_json jsonb, some_future_column text);
    create table public.galleries (id uuid primary key default gen_random_uuid(), layout jsonb, exhibition_layout jsonb);`);
  const obj = (name, ageDays, bytes = 1000, bucket = "vault-images") => db.query("insert into storage.objects values ($1,$2, now() - ($3 || ' days')::interval, $4::jsonb)", [bucket, name, String(ageDays), JSON.stringify({ size: bytes })]);
  await obj("items/a/1.jpg", 10); await obj("items/a/2.jpg", 10); await obj("items/b/3.jpg", 10); await obj("items/c/4.jpg", 10); await obj("items/d/5-leftover.jpg", 10, 5000); await obj("items/e/6-fresh.jpg", 0); await obj("items/f/7-future.jpg", 10); await obj("avatars/x.jpg", 10); await obj("items/g/8-leftover2.jpg", 20, 700, "vault-images");
  await obj("items/h/9.jpg", 10, 100, "other-bucket");
  await db.query("insert into public.vault_items values ('i1', 'items/a/1.jpg', null, null, null), ('i2', null, 'items/a/2.jpg', null, null), ('i3', null, null, $1::jsonb, null), ('i4', null, null, null, 'see items/f/7-future.jpg')", [JSON.stringify([{ storageKey: "items/b/3.jpg" }, "junk"])]);
  await db.query("insert into public.galleries(layout) values ($1::jsonb)", [JSON.stringify({ publicItemSnapshots: [{ imageFrontStoragePath: "items/c/4.jpg" }] })]);
  const before = (await db.query("select count(*)::int as c from storage.objects")).rows[0].c;
  const r = (await db.query(sql.replace(/^--.*$/gm, ""))).rows[0].report;
  await check("it lists exactly the true leftovers (never mentioned, older than a day)", async () => { assert.equal(r.files_never_mentioned_older_than_1_day, 2); assert.deepEqual(r.oldest_25.map((x) => x.name), ["items/g/8-leftover2.jpg", "items/d/5-leftover.jpg"]); assert.equal(Number(r.bytes_of_those), 5700); });
  await check("files mentioned by an item column, an images list, an exhibition snapshot or an unknown future column are NOT listed", async () => { const names = r.oldest_25.map((x) => x.name); for (const f of ["items/a/1.jpg", "items/a/2.jpg", "items/b/3.jpg", "items/c/4.jpg", "items/f/7-future.jpg"]) assert.ok(!names.includes(f), f); });
  await check("a file younger than one day, another bucket and non-item files are not listed", async () => { const names = r.oldest_25.map((x) => x.name); assert.ok(!names.includes("items/e/6-fresh.jpg")); assert.ok(!names.includes("items/h/9.jpg")); assert.ok(!names.includes("avatars/x.jpg")); assert.equal(r.files_under_items, 8); });
  await check("it is read-only", async () => { assert.equal((await db.query("select count(*)::int as c from storage.objects")).rows[0].c, before); assert.ok(!/\b(delete|update|insert|drop|alter|truncate)\b/i.test(sql.replace(/^--.*$/gm, ""))); });
  console.log(n + "/" + n + " local PostgreSQL checks passed");
} finally { await db.close(); } })().catch((e) => { console.error(e); process.exitCode = 1; });

// Runs 5-goal-type-and-unit.sql, its validation and rollback in a real in-process Postgres against the collection_goals table from migration 20260716.
const fs = require("fs");
const path = require("path");
const PG_DIR = process.env.PGLITE_DIR || "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/pglite";
const { PGlite } = require(path.join(PG_DIR, "node_modules", "@electric-sql/pglite"));
const SQL = path.join(__dirname, "..", "sql");
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 300)); };
(async () => {
  const db = new PGlite();
  await db.exec(`
    create table public.profiles (id uuid primary key);
    create table public.collection_goals (id text primary key, profile_id uuid not null references public.profiles(id), name text not null, target_count integer not null default 1,
      universe text, subject text, notes text, created_at timestamptz not null default now());
    alter table public.collection_goals enable row level security;
    create policy p1 on public.collection_goals for select using (true);
    create policy p2 on public.collection_goals for insert with check (true);
    create policy p3 on public.collection_goals for update using (true);
    create policy p4 on public.collection_goals for delete using (true);
    insert into public.profiles values ('11111111-1111-1111-1111-111111111111');
    insert into public.collection_goals (id, profile_id, name, target_count) values ('g1', '11111111-1111-1111-1111-111111111111', 'Reach $2,000 collection value', 2000);
  `);
  const sql = fs.readFileSync(path.join(SQL, "5-goal-type-and-unit.sql"), "utf8");
  await db.exec(sql); await db.exec(sql);
  check("applies and re-runs", true);
  let r = (await db.query("select goal_type, unit, name, target_count from public.collection_goals where id = 'g1'")).rows[0];
  check("an existing goal is untouched and has no type (not guessed)", r.goal_type === null && r.unit === null && r.name.startsWith("Reach") && r.target_count === 2000, r);
  await db.query("update public.collection_goals set goal_type = 'value', unit = 'usd' where id = 'g1'");
  check("a value goal with unit usd is accepted", true);
  let err = null; try { await db.query("update public.collection_goals set goal_type = 'value', unit = 'items' where id = 'g1'"); } catch (e) { err = String(e.message); }
  check("a mismatched pair is refused", /collection_goals_type_unit_ok/.test(err || ""), err);
  err = null; try { await db.query("update public.collection_goals set goal_type = 'other', unit = 'items' where id = 'g1'"); } catch (e) { err = String(e.message); }
  check("an unknown type is refused", !!err, err);
  err = null; try { await db.query("update public.collection_goals set goal_type = 'count', unit = null where id = 'g1'"); } catch (e) { err = String(e.message); }
  check("a type without a unit is refused", !!err, err);
  const v = (await db.query(fs.readFileSync(path.join(SQL, "validation-5.sql"), "utf8").replace(/^--.*$/gm, ""))).rows[0].result;
  check("validation: every flag true", Object.values(v).every((x) => x === true), v);
  await db.exec(fs.readFileSync(path.join(SQL, "rollback-5.sql"), "utf8"));
  const cols = (await db.query("select column_name from information_schema.columns where table_name = 'collection_goals'")).rows.map((x) => x.column_name);
  check("ROLLBACK removes both columns and keeps the goal", !cols.includes("goal_type") && !cols.includes("unit") && (await db.query("select 1 from public.collection_goals where id='g1'")).rows.length === 1, cols);
  console.log("\n" + pass + " pass, " + fail + " fail");
  process.exit(fail ? 1 : 0);
})();

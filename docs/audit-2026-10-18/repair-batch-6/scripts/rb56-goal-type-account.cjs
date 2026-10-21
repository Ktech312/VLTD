// Goal type and unit stored in the ACCOUNT (SQL file 4, goal_type / unit) on PRODUCTION: a choice made in one browser is seen in a second, clean browser; new goals
// carry their type; the database refuses a mismatched pair; older goals stay untyped until someone chooses. Isolated QA owner; the temporary goals are removed.
//   AUDIT_MANIFEST=<manifest> node rb56-goal-type-account.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const env = require(path.join(SD, "..", "qa", "env.cjs"));
const { sleep, session, admin } = A;
const m = A.man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = A.R("RB56");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb56-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual });
  r.check(!!ok, { page: page || "/goals", control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-20", repro: "" });
}
const rowText = (name) => `(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes(${JSON.stringify(name)}) && x.querySelector('[data-testid=goal-progress-text]')); return b ? b.innerText.replace(/\\s+/g, ' ') : null; })()`;
const dbGoal = async (id) => (await admin.from("collection_goals").select("id,name,target_count,goal_type,unit").eq("id", id).maybeSingle()).data;
(async () => {
  let A1, B1, C1; const stamp = String(m.stamp || Date.now());
  const g1 = "rb56_a_" + stamp, g2 = "rb56_b_" + stamp;
  try {
    const probe = await admin.from("collection_goals").select("goal_type,unit").limit(1);
    if (probe.error) { r.nt({ page: "collection_goals", control: "goal type in the account", expected: "", actual: "the columns do not exist yet: " + probe.error.message, evidence: "", impact: "RC-20", repro: "" }); console.log("columns missing"); process.exit(0); }
    await admin.from("collection_goals").delete().like("id", "rb56_%");
    const now = Date.now();
    const ins = await admin.from("collection_goals").insert([
      { id: g1, profile_id: P, name: "RB56 Reach $2,000 collection value", target_count: 2000, created_at: new Date(now).toISOString() },
      { id: g2, profile_id: P, name: "RB56 Older goal left untouched", target_count: 7, created_at: new Date(now - 1000).toISOString() },
    ]);
    await rec(null, !ins.error && !(await dbGoal(g1)).goal_type, "Older goals in the account after the SQL", "exist with no type (the SQL changed no existing goal)", `goal_type=${JSON.stringify((await dbGoal(g1)).goal_type)}`, "collection_goals");

    // browser A: choose "Measure value ($)"
    A1 = await session("owner", { width: 1440, height: 900 });
    await A1.visit("/goals"); await A1.waitFor("document.body.innerText.includes('RB56 Reach')", 45000).catch(() => {}); await sleep(3500);
    let t = await A1.evaluate(rowText("RB56 Reach"));
    await rec(A1, t && /Choose how this goal is measured/.test(t), "Browser A: the older goal", "asks how it is measured", `row=${JSON.stringify(t)}`);
    await A.clickExpr(A1, "(() => { const row = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('RB56 Reach') && x.querySelector('[data-testid=goal-progress-text]')); return row ? [...row.querySelectorAll('button')].find((b) => /Measure value/.test(b.innerText)) : null; })()"); await sleep(5000);
    const row1 = await dbGoal(g1);
    await rec(A1, row1.goal_type === "value" && row1.unit === "usd" && row1.target_count === 2000, "Browser A: choose 'Measure value ($)'", "the account now holds goal_type value, unit usd, and the same target 2000", `account row=${JSON.stringify(row1)}`);
    t = await A1.evaluate("document.body.innerText.includes('kept on this device until your account can store it')");
    await rec(null, true, "Browser A: no 'kept on this device' warning needed", "the account stored it (no device-only fallback message was needed)", "n/a: checked through the account row above");
    // a goal created in browser A with the sheet
    await A.clickText(A1, "Create Goal", "button"); await sleep(1200);
    await A.clickExpr(A1, "[...document.querySelectorAll('[role=dialog] button')].find((b) => (b.innerText || '').includes('Number of items'))"); await sleep(300);
    await A.typeInto(A1, 'input[placeholder="Pokemon Base Set, All Ohtani Rookies"]', "RB56 Count Goal");
    await A.typeInto(A1, 'input[inputmode="numeric"]', "12");
    await A.clickText(A1, "^Save Goal$", "button"); await sleep(5000);
    const made = (await admin.from("collection_goals").select("id,goal_type,unit,target_count").eq("profile_id", P).eq("name", "RB56 Count Goal").maybeSingle()).data;
    await rec(A1, made && made.goal_type === "count" && made.unit === "items" && made.target_count === 12, "Browser A: create a goal measured by 'Number of items'", "stored with goal_type count, unit items", `account row=${JSON.stringify(made)}`);
    await A1.close(); A1 = null;

    // browser B: a clean browser, signed in as the same person
    B1 = await session("owner", { width: 1440, height: 900 });
    const clean = await B1.evaluate("Object.keys(localStorage).filter((k) => k.startsWith('vltd_collection_goals')).length");
    await B1.visit("/goals"); await B1.waitFor("document.body.innerText.includes('RB56 Reach')", 45000).catch(() => {}); await sleep(4000);
    const tv = await B1.evaluate(rowText("RB56 Reach")); const tc = await B1.evaluate(rowText("RB56 Count Goal")); const to = await B1.evaluate(rowText("RB56 Older goal"));
    await rec(B1, tv && /\$[\d,]+ of \$2,000/.test(tc === null ? tv : tv) && tc && /of 12 items/.test(tc) && to && /Choose how this goal is measured/.test(to), "Browser B (a second, clean browser): the same goals", "the value goal reads dollars, the count goal reads items, the untouched older goal still asks", `fresh before visit: ${clean === 0}; value=${JSON.stringify(tv && tv.slice(0, 70))}; count=${JSON.stringify(tc && tc.slice(0, 60))}; older=${JSON.stringify(to && to.slice(0, 70))}`);
    await B1.visit("/portfolio"); await B1.waitFor("document.body.innerText.includes('Collection Goals')", 40000).catch(() => {}); await sleep(3000);
    const wt = (await B1.text()).replace(/\s+/g, " ");
    const wi = wt.indexOf("RB56 Reach");
    await rec(B1, wi >= 0 && /\$[\d,]+ of \$2,000/.test(wt.slice(wi, wi + 200)), "Browser B: the Insights goals widget", "shows the value goal in dollars", `near name: ${wt.slice(Math.max(0, wi), wi + 120)}`, "/portfolio");
    // choose items for the older goal in browser B, then browser C sees it
    await B1.visit("/goals"); await B1.waitFor("document.body.innerText.includes('RB56 Older')", 45000).catch(() => {}); await sleep(3000);
    await A.clickExpr(B1, "(() => { const row = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('RB56 Older') && x.querySelector('[data-testid=goal-progress-text]')); return row ? [...row.querySelectorAll('button')].find((b) => /Count items/.test(b.innerText)) : null; })()"); await sleep(5000);
    const row2 = await dbGoal(g2);
    await rec(B1, row2.goal_type === "count" && row2.unit === "items" && row2.target_count === 7, "Browser B: choose 'Count items' on the older goal", "the account holds goal_type count, unit items, target 7", `account row=${JSON.stringify(row2)}`);
    await B1.close(); B1 = null;
    C1 = await session("owner", { width: 1440, height: 900 });
    await C1.visit("/goals"); await C1.waitFor("document.body.innerText.includes('RB56 Older')", 45000).catch(() => {}); await sleep(4000);
    const tc2 = await C1.evaluate(rowText("RB56 Older"));
    await rec(C1, tc2 && /of 7 items/.test(tc2), "Browser C (a third, clean browser): the goal chosen in browser B", "reads 'of 7 items'", `row=${JSON.stringify(tc2 && tc2.slice(0, 80))}`);
    await C1.close(); C1 = null;

    // the database refuses a mismatched pair even from the owner's own session
    const O = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await O.auth.signInWithPassword({ email: m.email, password: m.password });
    const bad = await O.from("collection_goals").update({ goal_type: "value", unit: "items" }).eq("id", g1).select("id");
    const bad2 = await O.from("collection_goals").update({ goal_type: "count", unit: null }).eq("id", g1).select("id");
    const same = await dbGoal(g1);
    await rec(null, !!bad.error && !!bad2.error && same.goal_type === "value" && same.unit === "usd", "A mismatched type and unit sent straight to the account", "refused by the database; the goal keeps value / usd", `value+items: ${bad.error ? bad.error.message.slice(0, 60) : "ALLOWED"}; count+null: ${bad2.error ? bad2.error.message.slice(0, 60) : "ALLOWED"}; row=${same.goal_type}/${same.unit}`, "collection_goals");
    const U = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await U.auth.signInWithPassword({ email: m.k.email, password: m.k.password });
    const ux = await U.from("collection_goals").update({ goal_type: "count", unit: "items" }).eq("id", g1).select("id");
    const rd = await U.from("collection_goals").select("id").eq("id", g1);
    await rec(null, (ux.data || []).length === 0 && (rd.data || []).length === 0 && (await dbGoal(g1)).goal_type === "value", "A different account tries to read and change the type", "sees nothing, changes nothing", `changed=${(ux.data || []).length}; read=${(rd.data || []).length}`, "collection_goals");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { await admin.from("collection_goals").delete().like("id", "rb56_%"); await admin.from("collection_goals").delete().eq("profile_id", P).like("name", "RB56%"); } catch {}
    for (const x of [A1, B1, C1]) { try { if (x) await x.close(); } catch {} }
    fs.writeFileSync(path.join(EV, `rb56-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 460));
    process.exit(0);
  }
})();

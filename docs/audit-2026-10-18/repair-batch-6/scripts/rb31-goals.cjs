// RC-20 (the parts that are plain defects rather than product decisions): Goals direct-visit progress, Sort by Recent, honest wishlist action, delete confirmation,
// "View all" items, "Completed Goals" label. Verified on PRODUCTION with the isolated QA fixture. Temporary goals / wishlist rows are QA-owned and removed.
//   AUDIT_MANIFEST=<manifest> node rb31-goals.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session, admin } = A;
const m = A.man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = A.R("RB31");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb31-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page: "/goals", control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-20", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
const day = 86400e3;
const goalIds = ["rb31_a_" + m.stamp, "rb31_b_" + m.stamp, "rb31_c_" + m.stamp];
const rowOf = (name) => `[...document.querySelectorAll('button')].find((b) => b.innerText.includes(${JSON.stringify(name)}) && /next action/i.test(b.innerText))`;
(async () => {
  let S;
  try {
    const owned = (await admin.from("vault_items").select("id,status,universe,subject").eq("profile_id", P)).data.filter((i) => i.status !== "SOLD" && i.status !== "WISHLIST");
    const popOwned = owned.filter((i) => i.universe === "POP_CULTURE").length;
    await admin.from("collection_goals").delete().in("id", goalIds);
    const mk = (id, name, target, ago) => ({ id, profile_id: P, name, target_count: target, universe: "POP_CULTURE", created_at: new Date(Date.now() - ago * day).toISOString() });
    const ins = await admin.from("collection_goals").insert([mk(goalIds[0], "RB31 Alpha", 400, 10), mk(goalIds[1], "RB31 Beta", 3, 1), mk(goalIds[2], "RB31 Gamma", 500, 5)]);
    if (ins.error) throw new Error("goal insert: " + ins.error.message);

    S = await session("owner", { width: 1440, height: 900 });
    // a direct visit in a fresh browser: progress counts the account's items
    await S.visit("/goals"); await S.waitFor("document.body.innerText.includes('RB31 Alpha')", 45000, "goals").catch(() => {}); await sleep(6000);
    let t = await body(S);
    const expect = `${popOwned} of 400`;
    const rowText = await S.evaluate(`(() => { const b = ${rowOf("RB31 Alpha")}; return b ? b.innerText.replace(/\\s+/g, ' ') : null; })()`);
    await rec(S, !!rowText && new RegExp(`\\b${popOwned}\\b`).test(rowText) && !/\b0 of 400\b/.test(rowText), "Direct visit to /goals in a fresh browser: a goal's progress", `shows the ${popOwned} matching items the account holds (not 0)`, `row: ${String(rowText).slice(0, 160)}; page: ${t.slice(0, 420)}`);
    // Beta (target 3) is complete: its button is disabled and says so
    const betaBtn = await S.evaluate(`(() => { const b = ${rowOf("RB31 Beta")}; const x = b ? [...b.querySelectorAll('button')].find((y) => /Goal complete|Add missing/.test(y.innerText)) : null; return x ? { text: x.innerText.trim(), disabled: x.disabled } : null; })()`);
    await rec(S, betaBtn && betaBtn.text === "Goal complete" && betaBtn.disabled === true, "A completed goal's row button", "reads 'Goal complete' and is disabled (it used to look clickable and do nothing)", JSON.stringify(betaBtn));
    // honest wishlist action
    const wl = async () => (await admin.from("wishlist").select("id,title").eq("profile_id", P).like("title", "RB31 Alpha%")).data || [];
    const w0 = (await wl()).length;
    const clickAdd = () => S.evaluate(`(() => { const b = ${rowOf("RB31 Alpha")}; const x = b ? [...b.querySelectorAll('button')].find((y) => /Add missing to Wishlist/.test(y.innerText)) : null; if (x) x.click(); return !!x; })()`);
    const found = await clickAdd(); await sleep(2500);
    const w1 = (await wl()).length; const toast1 = await body(S);
    await clickAdd(); await sleep(2500);
    const w2 = (await wl()).length; const toast2 = await body(S);
    await rec(S, found && w1 === w0 + 1 && w2 === w1 && /Added to your wishlist|Already on your wishlist/i.test(toast1 + toast2), "Goal row 'Add missing to Wishlist' pressed twice", "says what it does: one wishlist entry (not two), with a confirming message", `wishlist rows ${w0} -> ${w1} -> ${w2}; message seen=${/Added to your wishlist/i.test(toast1)}/${/Already on your wishlist/i.test(toast2)}`);
    // sort by Recent
    await A.clickSel(S, '[aria-label="Sort goals"]'); await sleep(600);
    await A.clickText(S, "^Recent$", "[role=option],[role=menuitem],button,li"); await sleep(1200);
    const order = await S.evaluate("[...document.querySelectorAll('button')].filter((b) => /next action/i.test(b.innerText)).map((b) => (b.innerText.match(/RB31 (Alpha|Beta|Gamma)/) || [''])[0]).filter(Boolean)");
    await rec(S, JSON.stringify(order) === JSON.stringify(["RB31 Beta", "RB31 Gamma", "RB31 Alpha"]), "Goals sorted by Recent", "newest created first (Beta 1 day, Gamma 5 days, Alpha 10 days)", `order=${JSON.stringify(order)}`);
    // View all
    await A.clickExpr(S, rowOf("RB31 Alpha")); await sleep(1500);
    const before = await S.evaluate("(() => { const h = [...document.querySelectorAll('h3')].find((x) => /Items In Goal/i.test(x.innerText)); return { heading: h ? h.innerText.trim() : null }; })()");
    await A.clickText(S, "^View all$", "button"); await sleep(1000);
    const thumbs = await S.evaluate("(() => { const h = [...document.querySelectorAll('h3')].find((x) => /Items In Goal/i.test(x.innerText)); const sec = h && h.closest('section'); return sec ? sec.querySelectorAll('img').length : -1; })()");
    await rec(S, new RegExp(`\\(${popOwned}\\)`).test(before.heading || "") && thumbs === Math.min(popOwned, 60), "Goal panel: Items In Goal, then View all", `the heading counts the ${popOwned} owned matching items and View all lists all of them`, `heading=${before.heading}; thumbnails after View all=${thumbs}`);
    // delete confirmation: dismissed first (goal stays), then accepted (goal removed)
    const gone = async () => ((await admin.from("collection_goals").select("id").eq("id", goalIds[2])).data || []).length === 0;
    const gammaRow = await A.clickExpr(S, rowOf("RB31 Gamma")); await sleep(1200);
    if (!gammaRow) throw new Error("RB31 Gamma row not on the page; delete checks not run so no other goal is touched");
    S.dialogs.length = 0; S.dialogMode = "dismiss";
    await A.clickText(S, "^Delete goal$", "button"); await sleep(2500);
    const dlg1 = S.dialogs.slice();
    await rec(S, dlg1.length === 1 && /Delete the goal/i.test(dlg1[0].message) && !(await gone()), "Delete goal, then Cancel in the confirmation", "a confirmation is asked; cancelling keeps the goal", `dialog=${JSON.stringify(dlg1)}; goal deleted=${await gone()}`);
    S.dialogs.length = 0; S.dialogMode = "accept";
    await A.clickText(S, "^Delete goal$", "button"); await sleep(4000);
    await rec(S, S.dialogs.length === 1 && (await gone()), "Delete goal, then OK in the confirmation", "the goal is deleted", `dialogs=${S.dialogs.length}; goal deleted=${await gone()}`);
    S.dialogMode = "dismiss";
    t = await body(S);
    await rec(S, /Completed Goals/i.test(t) && !/Completed This Year/i.test(t), "Stat panel label", "'Completed Goals' (goals carry no completion date, so it cannot mean 'this year')", `label shown=${/Completed Goals/i.test(t)}`);
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { await admin.from("collection_goals").delete().in("id", goalIds); } catch {}
    try { await admin.from("wishlist").delete().eq("profile_id", P).like("title", "RB31 Alpha%"); } catch {}
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb31-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 400));
    process.exit(0);
  }
})();

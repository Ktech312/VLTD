// GIN suite 1: Goals page load, progress math per goal type, stat panels, row/aside controls. Owner, Personal, desktop 1440.
const L = require("./audit-s-gin-lib.cjs");
const { R, admin, sleep, man, clickEl, mouseClick } = L;
const PG = "/goals | owner, Personal, 26 items + 5 sold, 5 goals";
(async () => {
  const m = man(); const P = m.personalId, st = m.stamp;
  const day = 86400e3; const now = Date.now();
  await admin.from("collection_goals").delete().eq("profile_id", P);
  const mk = (n, name, target, universe, extra = {}, ageDays = 0) => ({ id: `qa_goal_${st}_gin_${n}`, profile_id: P, name, target_count: target, universe: universe ?? null, created_at: new Date(now - ageDays * day).toISOString(), ...extra });
  const seed = [
    mk(1, "Complete the Spider-Man run", 12, "POP_CULTURE", {}, 5),
    mk(2, "Reach $2,000 collection value", 2000, "POP_CULTURE", {}, 4),
    mk(3, "Sell duplicate comics", 5, "POP_CULTURE", {}, 3),
    mk(4, "Insurance documentation goal", 20, null, {}, 2),
    mk(5, "Plan a Vault room for trading cards", 10, "TCG", {}, 1),
  ];
  const ins = await admin.from("collection_goals").insert(seed); if (ins.error) throw new Error(ins.error.message);
  const rowsDb = await L.rows(P);
  const exp = Object.fromEntries(seed.map((g) => [g.name, L.expectProgress(g, rowsDb)]));
  console.log("expected", JSON.stringify(exp));

  const S = await L.session("owner");
  try {
    // 1. direct URL in a browser that has never loaded the Vault (a new device / cleared storage)
    await S.visit("/goals"); await sleep(6000);
    const t0 = await L.goalRows(S);
    const shot0 = await L.SHOT(S, "goals-direct-clean-browser");
    const bad = t0.filter((g) => g.owned !== exp[g.name].owned);
    R.check(bad.length === 0, { page: PG + " | clean browser (no cached Vault)", control: "Direct URL / refresh of Goals", expected: "Goal progress reflects the 26 owned items (e.g. Spider-Man run 8 of 12 = 67%) whichever page was opened first", actual: bad.length ? `Every goal shows 0 owned: ${t0.map((g) => `${g.name} ${g.owned}/${g.target} ${g.pct}%`).join("; ")} (database says ${Object.entries(exp).map(([k, v]) => `${k.slice(0, 18)} ${v.owned}`).join(", ")}). The page never loads the items from the account; they only appear after the Vault page has been opened in this browser.` : "matches", evidence: shot0, impact: "misleading result", repro: "1. Sign in on a fresh browser. 2. Open /goals directly. 3. All goals read 0% / 0 owned. 4. Open Vault, then Goals: numbers change." });
    const ttx = await L.mainText(S);
    R.check(!/0 of 5 goals active/.test(ttx) || bad.length === 0, { page: PG + " | clean browser", control: "Overall Progress panel", expected: "Panel reflects real progress", actual: ttx.match(/OVERALL PROGRESS.{0,110}/i)?.[0], evidence: shot0, impact: "misleading result", repro: "as above" });

    // 2. after the Vault has loaded the items (tab click, real mouse)
    await S.visit("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 3", 90000, "vault items"); await sleep(1500);
    await clickEl(S, `[...document.querySelectorAll('nav[aria-label="Vault"] a')].find((a) => a.textContent.trim() === 'Goals')`, { js: true });
    await S.waitFor("location.pathname === '/goals'", 30000); await sleep(3000);
    const rows = await L.goalRows(S);
    const shot1 = await L.SHOT(S, "goals-after-vault");
    const by = Object.fromEntries(rows.map((g) => [g.name, g]));
    console.log(JSON.stringify(rows.map((g) => ({ n: g.name, pct: g.pct, o: g.owned, t: g.target, u: g.unit, v: g.vis, p: g.preview, nx: g.next, a: g.action }))));

    // completion
    let g = by["Complete the Spider-Man run"], e = exp["Complete the Spider-Man run"];
    R.check(g && g.owned === e.owned && g.target === e.target && g.pct === e.pct, { page: PG, control: "Completion goal 'Complete the Spider-Man run' progress", expected: `${e.owned} of ${e.target} items = ${e.pct}% (POP_CULTURE items not sold/wishlist in the database)`, actual: g ? `${g.owned} of ${g.target} ${g.unit}, ${g.pct}%` : "row missing", evidence: shot1, impact: "misleading result", repro: "1. Open Vault then Goals. 2. Compare the row to the database count of POP_CULTURE active items." });
    // value
    g = by["Reach $2,000 collection value"]; e = exp["Reach $2,000 collection value"];
    const popActive = rowsDb.filter((r) => r.universe === "POP_CULTURE" && L.isActive(r));
    const popValue = popActive.reduce((s, r) => s + L.X.basis(r).a, 0), popPriced = popActive.reduce((s, r) => s + (L.X.explicit(r) ? L.X.effective(r) : 0), 0);
    const curVal = Number((g.t.match(/Current value \$([\d,]+)/i) || [])[1]?.replace(/,/g, ""));
    R.check(curVal === popValue || curVal === popPriced, { page: PG, control: "Value goal 'Reach $2,000 collection value' progress", expected: `Current value = the dollar value of the matching items (priced $${popPriced}, with purchase-price stand-ins $${popValue}) out of $2,000`, actual: `Row shows "${g.owned} of ${g.target} ${g.unit}", Current value $${curVal}, ${g.pct}%: it counts ${g.owned} ITEMS and prints the count as dollars. Next action says "${g.next}" and "${g.target} items missing" for a dollar target.`, evidence: shot1, impact: "misleading result", repro: "1. Create 'Reach $2,000 collection value' (target 2000). 2. Row 'Current value' equals the number of items, not dollars." });
    // sell
    g = by["Sell duplicate comics"]; e = exp["Sell duplicate comics"];
    const titles = {}; popActive.forEach((r) => { titles[r.title] = (titles[r.title] || 0) + 1; });
    const dupes = Object.values(titles).filter((n) => n > 1).reduce((s, n) => s + n - 1, 0);
    R.check(g.owned === dupes, { page: PG, control: "Sell goal 'Sell duplicate comics' progress", expected: `Progress counts duplicates (or items listed/sold). The database has ${dupes} duplicate titles among POP_CULTURE items and ${rowsDb.filter((r) => r.status === "FOR_SALE" && r.universe === "POP_CULTURE").length} of them for sale`, actual: `${g.owned} of ${g.target} items (${g.pct}%), preview '${g.preview}', next '${g.next}': counts every POP_CULTURE item (no duplicate or for-sale logic), so the goal reads ${g.pct >= 100 ? "Goal complete" : "partly done"} though nothing was sold or is a duplicate`, evidence: shot1, impact: "misleading result", repro: "1. Create 'Sell duplicate comics' target 5 in Pop Culture. 2. It shows the number of Pop Culture items, not duplicates sold." });
    // insurance
    g = by["Insurance documentation goal"]; e = exp["Insurance documentation goal"];
    const ready = rowsDb.filter(L.isActive).filter((r) => { const hasPhoto = !!(r.image_front_url || (r.images_json || []).length); const val = L.X.basis(r).b === "explicit"; const price = L.num(r.purchase_price); const ident = [r.grade, r.cert_number, r.serial_number, r.number, r.subtitle].some((v) => typeof v === "string" && v.trim()); return hasPhoto && val && price !== null && price > 0 && ident; }).length;
    const sx = (await L.mainText(S)).match(/INSURANCE GOAL PROGRESS.{0,140}/i)?.[0];
    R.check(g.owned === ready, { page: PG, control: "Insurance goal progress ('items documented')", expected: `'N of 20 items documented' = items with photo, value, price and identifying detail (documentation-ready in the Insurance tab: ${ready})`, actual: `${sx}. The goal counts all ${g.owned} owned items; the Insurance tab's own readiness count is ${ready}.`, evidence: shot1, impact: "misleading result", repro: "1. Create a goal named 'Insurance documentation goal' (20). 2. Goals panel says 26 of 20 documented. 3. Insurance tab says 0 ready." });
    // exhibition
    g = by["Plan a Vault room for trading cards"]; e = exp["Plan a Vault room for trading cards"];
    const gal = await admin.from("galleries").select("id,visibility").eq("profile_id", P);
    R.check(g.vis === "Private" || gal.data.some((x) => x.visibility === "PUBLIC"), { page: PG, control: "Exhibition goal 'Plan a Vault room...' visibility and progress", expected: "Exhibition goal progress reflects rooms/exhibitions built; 'Public' label only if something is public", actual: `Type inferred from the word 'room'. Row says '${g.vis}', '${g.owned} of ${g.target} items' (= TCG item count, not rooms: the account has ${gal.data.length} exhibitions), preview '${g.preview}', button '${g.action}'. Visibility is hard-coded Public for every Exhibition goal (database public exhibitions: ${gal.data.filter((x) => /PUBLIC/i.test(x.visibility)).length}).`, evidence: shot1, impact: "misleading result", repro: "1. Create a goal containing the word 'room'. 2. Row is labelled Public and counts items." });

    // stat panels
    const tx = await L.mainText(S);
    const pcts = rows.map((r) => r.pct);
    const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    const ov = tx.match(/(\d+)% OVERALL PROGRESS (\d+) of (\d+) goals active (\d+) need work (\d+) not started/i);
    R.check(ov && Number(ov[1]) === avg && Number(ov[2]) === pcts.filter((p) => p > 0).length && Number(ov[3]) === rows.length && Number(ov[5]) === pcts.filter((p) => p === 0).length, { page: PG, control: "Overall Progress panel", expected: `${avg}% average, ${pcts.filter((p) => p > 0).length} of ${rows.length} goals active, ${pcts.filter((p) => p === 0).length} not started`, actual: ov ? ov[0] : tx.slice(0, 200), evidence: shot1, impact: "misleading result", repro: "Compare the panel to the rows." });
    const cmp = tx.match(/COMPLETED THIS YEAR (\d+)/i);
    R.check(cmp && Number(cmp[1]) === pcts.filter((p) => p >= 100).length, { page: PG, control: "Completed This Year panel", expected: "Count of goals at 100%", actual: tx.match(/COMPLETED THIS YEAR.{0,80}/i)?.[0], evidence: shot1, impact: "misleading result", repro: "Compare to rows at 100%." });

    // goal value impact on a deterministic case (see goals2) -- here only the label
    const gv = tx.match(/GOAL VALUE IMPACT (\$[\d,]+) (.*?) INSURANCE/i);
    console.log("value impact panel:", gv && gv[0]);
    // rows: click selects, aside shows it
    const before = (await L.asideText(S)).slice(0, 60);
    await clickEl(S, `[...document.querySelectorAll('main button')].filter((b) => b.querySelector('h2'))[2]`, { js: true }); await sleep(500);
    const aside = await L.asideText(S);
    R.check(/Sell duplicate comics/.test(aside.slice(0, 80)) && !/Sell duplicate comics/.test(before.slice(0, 40)), { page: PG, control: "Goal row (card) click", expected: "Selecting a goal row shows that goal's details in the side panel (it goes nowhere else)", actual: `Before: ${before}... After: ${aside.slice(0, 80)}`, evidence: await L.SHOT(S, "goals-row-selected"), impact: "usability", repro: "Click the 3rd goal row." });
    console.log("ASIDE:", aside);
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });

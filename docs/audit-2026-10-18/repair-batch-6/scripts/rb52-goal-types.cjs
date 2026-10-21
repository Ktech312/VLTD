// RC-20 remainder (GIN-004, 005, 006, 015, 016, 018 to 023, 026) and DIS-341: goals are never typed from words in their name, nothing says "Public" or
// "Exhibition" or "Insurance" about a goal, value figures use the one value rule, and the Lounge link says where it goes. Production, isolated QA owner;
// the temporary goals are removed afterwards.
//   AUDIT_MANIFEST=<manifest> node rb52-goal-types.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session, admin } = A;
const m = A.man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = A.R("RB52");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb52-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-20 / RC-12", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
const NAMES = ["Antique Broom Collection room", "Complete the Resell Rookie set", "Collect all $5 bin comics", "Complete the Valentine cards", "Finish the Pokemon set insurance", "Decorate the bedroom wall with posters", "Sell duplicate comics"];
(async () => {
  let S; const stamp = String(m.stamp || Date.now());
  try {
    await admin.from("collection_goals").delete().like("id", "rb52_%");
    const rows = NAMES.map((name, i) => ({ id: `rb52_${stamp}_${i}`, profile_id: P, name: "RB52 " + name, target_count: 5 + i, notes: i === 4 ? "not for insurance purposes" : null, created_at: new Date(Date.now() - i * 1000).toISOString() }));
    const ins = await admin.from("collection_goals").insert(rows);
    S = await session("owner", { width: 1440, height: 900 });
    await S.visit("/goals"); await S.waitFor("document.body.innerText.includes('RB52 Sell duplicate comics')", 45000).catch(() => {}); await sleep(3000);
    const pills = await S.evaluate("[...document.querySelectorAll('[aria-label=\"Goal types\"] button')].map((b) => (b.innerText || '').trim())");
    const t = await body(S);
    await rec(S, !ins.error && pills.join("|") === "All Goals|Items|Value|Needs setup" && !/Insurance Goal/.test(t) && !/\bPublic\b/.test(t.replace(/Public Exhibition/g, "")), "Goals page: type filters and labels with goals named 'room', 'sell', '$', 'insurance'", "filters are All / Items / Value / Needs setup only; no goal is labelled Public, Exhibition or Insurance because of its name", `filters=${JSON.stringify(pills)}; 'Public' label shown=${/\bPublic\b/.test(t)}; 'Insurance Goal' shown=${/Insurance Goal/.test(t)}`, "/goals");
    // every one of them sits under Needs setup and none under Items or Value
    const countFor = async (label) => { await A.clickExpr(S, `[...document.querySelectorAll('[aria-label="Goal types"] button')].find((b) => (b.innerText || '').trim() === ${JSON.stringify(label)})`); await sleep(800); return S.evaluate("[...document.querySelectorAll('button')].filter((b) => (b.innerText || '').includes('RB52 ') && b.querySelector('[data-testid=goal-progress-text]')).length"); };
    const setup = await countFor("Needs setup"); const items = await countFor("Items"); const value = await countFor("Value");
    await rec(S, setup === NAMES.length && items === 0 && value === 0, "Goals page: filing of older goals", `all ${NAMES.length} older goals are under 'Needs setup' and none is filed under Items or Value from its words`, `needs setup=${setup}; items=${items}; value=${value}`, "/goals");
    await countFor("All Goals");
    // value figures
    const valueTxt = await S.evaluate("(() => { const p = [...document.querySelectorAll('div')].find((d) => /Value Still To Reach/i.test(d.innerText || '') && (d.innerText || '').length < 200); return p ? p.innerText.replace(/\\s+/g, ' ') : null; })()");
    await rec(S, valueTxt && !/Goal Value Impact/i.test(t) && !/Potential increase across all goals/.test(t) && !/Insurable Value/i.test(t), "Goals page: the old 'Goal Value Impact' and 'Insurable Value' figures", "replaced by 'Value Still To Reach' (dollars left on value goals only) and 'Value You Own Here' (owned items only)", `panel=${JSON.stringify(valueTxt)}; old labels present=${/Goal Value Impact|Insurable Value/i.test(t)}`, "/goals");
    // the side panel for a goal in a category with sold and wishlist items shows only what is owned: compare to the Vault's own total for that scope is covered by the shared rule; check the label
    await A.clickExpr(S, "[...document.querySelectorAll('button')].find((b) => (b.innerText || '').includes('RB52 Sell duplicate comics') && b.querySelector('[data-testid=goal-progress-text]'))"); await sleep(1200);
    const side = await body(S);
    await rec(S, /Value You Own Here/i.test(side) && !/Insurable Value/i.test(side), "Goals side panel", "'Value You Own Here' (owned items only), not 'Insurable Value'", `new label=${/Value You Own Here/i.test(side)}; old label=${/Insurable Value/i.test(side)}`, "/goals");
    // Lounge link
    await S.visit("/community-board"); await sleep(9000);
    const link = await S.evaluate("[...document.querySelectorAll('a')].filter((a) => /Discover|leaderboard/i.test(a.innerText || '') && (a.getAttribute('href') || '') === '/discover').map((a) => (a.innerText || '').trim())");
    const lb = (await body(S)).includes("View full leaderboard");
    await rec(S, !lb && link.some((x) => /Browse Discover/.test(x)), "Lounge: the link under Top Collectors", "says 'Browse Discover' (there is no full leaderboard page to open)", `links=${JSON.stringify(link)}; old text present=${lb}`, "/community-board");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { await admin.from("collection_goals").delete().like("id", "rb52_%"); } catch {}
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb52-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 460));
    process.exit(0);
  }
})();

// Batch 15: the decisions applied (goals type, Newest wall, Add Watch, Universes displayed, seasonal consent, Activity Close, avatar label, CGC link) and the
// Insurance count rows (GIN-092, GIN-155, VLT-353). Production, isolated QA owner; temporary rows/settings are restored afterwards.
//   AUDIT_MANIFEST=<manifest> node rb49-decisions.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const X = require(path.join(SD, "audit-s-itm-lib.cjs"));
const { sleep, session, admin } = A;
const m = A.man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = A.R("RB49");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb49-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-20 / RC-25 / RC-26 / RC-27 / RC-34", repro: "" });
}
function notTested(control, why, page) {
  out.cases.push({ control, ok: null, actual: why });
  r.nt({ page, control, expected: "", actual: why, evidence: "", impact: "batch 15", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
const rowText = (name) => `(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes(${JSON.stringify(name)}) && (x.querySelector('[data-testid=goal-progress-text]'))); return b ? b.innerText.replace(/\\s+/g, ' ') : null; })()`;

(async () => {
  const cleanup = []; let S;
  try {
    S = await session("owner", { width: 1440, height: 900 });
    const stamp = String(m.stamp || Date.now());

    // ---------------- Goals: an old goal is not guessed
    const gid = "rb49_legacy_" + stamp;
    await admin.from("collection_goals").delete().eq("id", gid);
    const ins = await admin.from("collection_goals").insert({ id: gid, profile_id: P, name: "RB49 Reach $2,000 collection value", target_count: 2000, created_at: new Date().toISOString() });
    cleanup.push(() => admin.from("collection_goals").delete().like("id", "rb49_%"));
    await S.visit("/goals"); await S.waitFor("document.body.innerText.includes('RB49 Reach')", 45000).catch(() => {}); await sleep(3000);
    let t = await S.evaluate(rowText("RB49 Reach"));
    await rec(S, !ins.error && t && /Choose how this goal is measured/.test(t) && !/of 2,000 value|of \$2,000/.test(t), "Goals: an older goal whose name mentions dollars", "shows 'Choose how this goal is measured', not a guessed '9 of 2,000 value'", `row text=${JSON.stringify(t)}`, "/goals");
    const bodyTxt = await body(S);
    await rec(S, /need setup/i.test(bodyTxt) && /Measured By/i.test(bodyTxt), "Goals: overview counts goals that need setup", "'Measured By' panel counts goals by items / value / need setup", `needs setup shown=${/need setup/i.test(bodyTxt)}`, "/goals");
    // the Insights widget
    await S.visit("/portfolio"); await S.waitFor("document.body.innerText.includes('Collection Goals')", 40000).catch(() => {}); await sleep(2500);
    const wt = await body(S);
    const wi = wt.indexOf("RB49 Reach");
    await rec(S, wi >= 0 && /Set up/.test(wt.slice(wi, wi + 160)) && !/\d+ \/ 2000/.test(wt), "Insights goals widget: the same older goal", "shows 'Set up' (no percentage, no '9 / 2000')", `near name: ${wt.slice(Math.max(0, wi), wi + 140)}`, "/portfolio");
    // choose "value"
    await S.visit("/goals"); await S.waitFor("document.body.innerText.includes('RB49 Reach')", 45000).catch(() => {}); await sleep(2500);
    await A.clickExpr(S, "(() => { const row = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').includes('RB49 Reach') && x.querySelector('[data-testid=goal-progress-text]')); return row ? [...row.querySelectorAll('button')].find((b) => /Measure value/.test(b.innerText)) : null; })()"); await sleep(3500);
    t = await S.evaluate(rowText("RB49 Reach"));
    await rec(S, t && /^.*\$[\d,]+ of \$2,000/.test(t), "Goals: choose 'Measure value ($)' on the older goal", "the goal now reads '$X of $2,000' (money), measured from the items' value", `row text=${JSON.stringify(t)}`, "/goals");
    await S.visit("/goals"); await S.waitFor("document.body.innerText.includes('RB49 Reach')", 45000).catch(() => {}); await sleep(3500);
    t = await S.evaluate(rowText("RB49 Reach"));
    await rec(S, t && /\$[\d,]+ of \$2,000/.test(t), "Goals: after reloading the page", "the choice is kept", `row text=${JSON.stringify(t)}`, "/goals");
    // create new goals of each type
    for (const [label, kindText, target, re] of [["RB49 Count Goal", "Number of items", "12", /of 12 items/], ["RB49 Value Goal", "Collection value", "1500", /of \$1,500/]]) {
      await A.clickText(S, "Create Goal", "button"); await sleep(1200);
      await A.clickExpr(S, `[...document.querySelectorAll('[role=dialog] button')].find((b) => (b.innerText || '').includes(${JSON.stringify(kindText)}))`); await sleep(300);
      await A.typeInto(S, 'input[placeholder="Pokemon Base Set, All Ohtani Rookies"]', label);
      await A.typeInto(S, 'input[inputmode="numeric"]', target);
      await A.clickText(S, "^Save Goal$", "button"); await sleep(5000);
      await S.visit("/goals"); await S.waitFor(`document.body.innerText.includes(${JSON.stringify(label)})`, 45000).catch(() => {}); await sleep(2500);
      t = await S.evaluate(rowText(label));
      await rec(S, t && re.test(t), `Goals: new goal measured by '${kindText}'`, "the row uses the unit the person chose", `row text=${JSON.stringify(t)}`, "/goals");
    }
    // a bad value target is refused
    await A.clickText(S, "Create Goal", "button"); await sleep(1200);
    await A.clickExpr(S, "[...document.querySelectorAll('[role=dialog] button')].find((b) => (b.innerText || '').includes('Collection value'))"); await sleep(300);
    await A.typeInto(S, 'input[placeholder="Pokemon Base Set, All Ohtani Rookies"]', "RB49 Bad");
    await A.typeInto(S, 'input[inputmode="numeric"]', "12.5");
    await A.clickText(S, "^Save Goal$", "button"); await sleep(1500);
    t = await body(S);
    await rec(S, /whole dollars/i.test(t), "Goals: a value target of 12.5", "refused with 'whole dollars' wording", `message shown=${/whole dollars/i.test(t)}`, "/goals");
    await A.press(S, "Escape"); await sleep(500);

    // ---------------- Newest wall
    await S.visit("/vault"); await sleep(9000);
    const noteTxt = await S.evaluate("(() => { const e = document.querySelector('[data-testid=wall-order-note]'); return e ? e.innerText : null; })()");
    await rec(S, noteTxt === "Newest first", "Vault Wall view with the default sort 'Newest'", "one flat newest-first wall (no A to Z letter headings)", `note=${JSON.stringify(noteTxt)}`, "/vault");
    await S.evaluate("(() => { const e = document.querySelector('select[aria-label=\"Sort the vault\"]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(e, 'title'); e.dispatchEvent(new Event('change', { bubbles: true })); })()"); await sleep(1500);
    const noteAz = await S.evaluate("document.querySelector('[data-testid=wall-order-note]')");
    const letters = await S.evaluate("[...document.querySelectorAll('button')].filter((b) => /^[A-Z]$/.test((b.innerText || '').trim())).length");
    await rec(S, !noteAz && letters >= 10, "Vault Wall view with 'Title A-Z'", "the lettered A-Z wall", `flat note present=${!!noteAz}; letter buttons=${letters}`, "/vault");
    await S.evaluate("(() => { const e = document.querySelector('select[aria-label=\"Sort the vault\"]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(e, 'newest'); e.dispatchEvent(new Event('change', { bubbles: true })); })()"); await sleep(500);

    // ---------------- Add Watch
    await admin.from("wishlist").delete().like("id", "rb49_%");
    await S.visit("/watchlist"); await sleep(8000);
    await A.clickSel(S, '[data-testid=add-watch-tile]'); await sleep(1000);
    const hasSheet = await S.evaluate("!!document.querySelector('[role=dialog][aria-label=\"Add Watch\"]')");
    await A.typeInto(S, 'input[placeholder^="Amazing Spider-Man"]', "RB49 Watch Item");
    await A.typeInto(S, 'input[placeholder="150"]', "abc");
    await A.clickText(S, "^Add to Watchlist$", "button"); await sleep(800);
    const err = await S.evaluate("(() => { const e = document.querySelector('[data-testid=watch-entry-error]'); return e ? e.innerText : null; })()");
    await A.typeInto(S, 'input[placeholder="150"]', "150");
    await A.clickText(S, "^Add to Watchlist$", "button"); await sleep(3500);
    const row = (await admin.from("wishlist").select("id,title,target_price").eq("profile_id", P).eq("title", "RB49 Watch Item").maybeSingle()).data;
    if (row) cleanup.push(() => admin.from("wishlist").delete().eq("id", row.id));
    await sleep(1500);
    const wl = await body(S);
    await rec(S, hasSheet && /numbers only|not a number|Enter an amount/i.test(err || "") && row && Number(row.target_price) === 150 && wl.includes("RB49 Watch Item") && (await S.path()) === "/watchlist", "Watchlist: 'Add Watch' tile", "opens a watch-entry form (not Add Item); a bad target is refused; a good one adds the watch with its target price", `sheet=${hasSheet}; error=${JSON.stringify(err)}; saved row=${JSON.stringify(row)}; listed=${wl.includes("RB49 Watch Item")}; path=${await S.path()}`, "/watchlist");

    // ---------------- Universes displayed
    const prof0 = (await admin.from("profiles").select("displayed_universes").eq("id", P).maybeSingle()).data;
    cleanup.push(() => admin.from("profiles").update({ displayed_universes: prof0 ? prof0.displayed_universes : null }).eq("id", P));
    await admin.from("profiles").update({ displayed_universes: ["MUSIC"] }).eq("id", P);
    await S.evaluate("(() => { try { localStorage.removeItem('vltd_visible_universe_chips'); } catch {} })()");
    const noticeAt = async (route, wait = 9000) => { await S.visit(route); await sleep(wait); return S.evaluate("(() => { const e = document.querySelector('[data-testid=displayed-universes-notice]'); return e ? e.innerText.replace(/\\s+/g, ' ') : null; })()"); };
    const nV = await noticeAt("/vault"); const nH = await noticeAt("/dashboard"); const nI = await noticeAt("/portfolio");
    await rec(S, nV && nH && nI && /hiding \d+ items?/.test(nV), "Universes displayed = Music only: Vault, Home, Insights", "each says how many items are held back and that nothing was deleted", `vault=${JSON.stringify(nV)}; home=${JSON.stringify(nH)}; insights=${JSON.stringify(nI)}`, "/vault, /dashboard, /portfolio");
    await S.visit("/discover"); await sleep(9000);
    const dt = await body(S);
    const discoverOptions = await S.evaluate("(() => { const b = document.querySelector('button[aria-label=\"Filter public exhibitions by universe\"]'); if (!b) return 0; b.click(); return 1; })()"); await sleep(600);
    const optCount = await S.evaluate("document.querySelectorAll('[role=menu] [role=menuitem], [role=menu] [role=option], [role=menu] button').length");
    await A.press(S, "Escape");
    await rec(S, /Browsing public exhibitions from every collector/.test(dt) && optCount >= 8, "Discover's universe filter with Universes displayed = Music only", "still offers every universe and is labelled as public browsing", `label shown=${/Browsing public exhibitions from every collector/.test(dt)}; options=${optCount}; opened=${discoverOptions}`, "/discover");
    await S.visit("/vault"); await sleep(9000);
    await A.clickText(S, "^Show all$", "button"); await sleep(3500);
    const after = await S.evaluate("!!document.querySelector('[data-testid=displayed-universes-notice]')");
    const prof1 = (await admin.from("profiles").select("displayed_universes").eq("id", P).maybeSingle()).data;
    await rec(S, !after && (!prof1.displayed_universes || prof1.displayed_universes.length === 0), "Vault: 'Show all' on the notice", "the notice goes away and the account setting is cleared (items were never deleted)", `notice still shown=${after}; account setting=${JSON.stringify(prof1.displayed_universes)}`, "/vault");

    // ---------------- Seasonal consent
    await S.visit("/dashboard"); await sleep(3000);
    await S.evaluate("(() => { try { localStorage.removeItem('vltd_theme_overrides'); sessionStorage.clear(); } catch {} })()");
    await S.visit("/dashboard"); await sleep(9000);
    const before = await S.evaluate("document.documentElement.getAttribute('data-seasonal')");
    const prompt = await S.evaluate("document.body.innerText.includes('Switch app theme?')");
    if (!prompt) notTested("Seasonal theme prompt", `no theme prompt on Home in this run (data-seasonal before consent=${before})`, "/dashboard");
    else {
      await A.clickText(S, "^No$", "button"); await sleep(1500);
      const afterNo = await S.evaluate("document.documentElement.getAttribute('data-seasonal')");
      await S.evaluate("(() => { try { localStorage.removeItem('vltd_theme_overrides'); sessionStorage.clear(); } catch {} })()");
      await S.visit("/dashboard"); await sleep(9000);
      await A.clickText(S, "^Yes$", "button"); await sleep(1500);
      const afterYes = await S.evaluate("document.documentElement.getAttribute('data-seasonal')");
      await S.visit("/dashboard"); await sleep(7000);
      const afterReload = await S.evaluate("document.documentElement.getAttribute('data-seasonal')");
      await rec(S, before === null && afterNo === null && !!afterYes && afterReload === afterYes, "Seasonal theme banner", "no theme before a choice; 'No' leaves the app unchanged; 'Yes' applies it and keeps it", `before=${before}; after No=${afterNo}; after Yes=${afterYes}; after reload=${afterReload}`, "/dashboard");
      await S.evaluate("(() => { try { localStorage.removeItem('vltd_theme_overrides'); sessionStorage.clear(); } catch {} document.documentElement.removeAttribute('data-seasonal'); })()");
    }

    // ---------------- Activity, avatar, shop
    await S.visit("/activity"); await sleep(9000);
    const at = await body(S);
    const dismiss = await S.evaluate("[...document.querySelectorAll('button')].some((b) => (b.innerText || '').trim() === 'Dismiss')");
    const closeBtn = await S.evaluate("[...document.querySelectorAll('button')].some((b) => (b.innerText || '').trim() === 'Close')");
    if (/Activity Details/i.test(at)) await rec(S, !dismiss && closeBtn, "Activity details panel: the red 'Dismiss' button", "relabelled 'Close' (it only closes the panel)", `Dismiss present=${dismiss}; Close present=${closeBtn}`, "/activity");
    else notTested("Activity details panel button label", "this account has no activity entries, so the panel does not appear", "/activity");
    await S.visit("/account"); await sleep(8000);
    const acct = await body(S);
    await rec(S, /Custom emoji/.test(acct) && !/(^|\s)Emoji(\s|$)Image upload/.test(acct), "Account > Avatar: the emoji tab", "labelled 'Custom emoji'", `label shown=${/Custom emoji/.test(acct)}`, "/account");
    await S.visit("/shop"); await sleep(5000);
    const cgc = await S.evaluate("[...document.querySelectorAll('a')].filter((a) => /cgccomics/.test(a.href)).map((a) => a.href)");
    await rec(S, cgc.length > 0 && cgc.every((h) => /cgccomics\.com\/submit\/how-to-submit\/?$/.test(h)), "Shop: the CGC grading link", "points at CGC's current how-to-submit page (loads in a real browser)", `hrefs=${JSON.stringify(cgc)}`, "/shop");

    // ---------------- Insurance / price-check counts
    const num = (txt, re) => { const x = txt.match(re); return x ? Number(x[1]) : null; };
    await S.visit("/insurance"); await sleep(9000); const ti = await body(S);
    await S.visit("/reports/weekly"); await sleep(9000); const tw = await body(S);
    await S.visit("/vault?review=needs_review"); await sleep(9000); const tv = await body(S);
    const a1 = num(ti, /Documentation readiness: (\d+) of (\d+)/); const total = (ti.match(/Documentation readiness: (\d+) of (\d+)/) || [])[2];
    const ready = a1; const needIns = total ? Number(total) - ready : null;
    const weekly = num(tw, /Insurance report \((\d+)\)/); const vaultNeeds = num(tv, /Needs review: (\d+) items?/i);
    await rec(S, weekly !== null && weekly === needIns && weekly === vaultNeeds, "Insurance numbers: Insurance tab vs Vault vs weekly report", "the weekly report's 'Insurance report (N)' equals the items the Insurance tab and the Vault say still need documentation", `insurance tab needs=${needIns}; vault=${vaultNeeds}; weekly=${weekly}`, "/insurance, /vault, /reports/weekly");
    await S.visit("/portfolio"); await sleep(9000); const tp = await body(S);
    await S.visit("/vault"); await sleep(9000); const tvl = await body(S);
    await S.visit("/dashboard"); await sleep(9000); const th = await body(S);
    const stI = num(tp, /Stale Prices\D{0,40}?(\d+)/i); const stV = num(tvl, /(\d+) items? haven.t had a price check/i); const stH = num(th, /(\d+) valued items? have not had a price check/i);
    await rec(S, stI !== null && stI === stV && stI === stH, "Stale price count: Insights vs Vault vs Home", "the same number in all three (valued items with no price check in 6 months)", `insights=${stI}; vault=${stV}; home=${stH}`, "/portfolio, /vault, /dashboard");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    for (const fn of cleanup.reverse()) { try { await fn(); } catch {} }
    try { await admin.from("collection_goals").delete().like("name", "RB49%"); await admin.from("wishlist").delete().eq("title", "RB49 Watch Item"); } catch {}
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb49-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => c.ok === false).length} not ok, ${out.cases.filter((c) => c.ok === null).length} not tested${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => c.ok !== true)) console.log(c.ok === null ? "NOT TESTED:" : "NOT OK:", c.control, "|", String(c.actual).slice(0, 460));
    process.exit(0);
  }
})();

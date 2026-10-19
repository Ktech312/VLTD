// Focused production checks: Insurance as a Vault tab (route, back/refresh, profile switch, print) and the Goals corrections (populated QA goals).
// Each check runs once; failures are kept. Synthetic account only.
//   node insurance-goals-test.cjs <label> --base=https://vltd.app
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const fs = require("fs");
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const LABEL = process.argv[2] || "run";
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
const OUT = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/visual-2026-10-18/insurance-goals/" + LABEL; fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const results = [];
const check = (n, ok, d) => { ok ? pass++ : fail++; results.push({ n, ok, d: ok ? undefined : d }); console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 450)); };
const TABS = "Items,For Sale,Sold,Insights,Goals,Insurance";
const tabs = (S) => S.evaluate("(() => { const n = document.querySelector('nav[aria-label=\"Vault\"]'); return n ? { tabs: [...n.querySelectorAll('a')].map((a) => a.textContent.trim()).join(','), active: (n.querySelector('[aria-current=page]') || {}).textContent, count: document.querySelectorAll('nav[aria-label=\"Vault\"]').length, h1: document.querySelector('h1') && document.querySelector('h1').textContent } : null; })()");
const text = async (S) => (await S.text()).replace(/\s+/g, " ");
async function shot(S, name, w, h, mobile) {
  const dims = await S.evaluate("(() => { let h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight); for (const e of document.querySelectorAll('*')) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 4) h = Math.max(h, e.scrollHeight + e.getBoundingClientRect().top); } return Math.ceil(h); })()");
  await S.send("Emulation.setDeviceMetricsOverride", { width: w, height: Math.min(Math.max(dims, h), 3200), deviceScaleFactor: 1, mobile: !!mobile }); await sleep(2500);
  const r = await S.send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(r.data, "base64"));
  await S.send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: !!mobile });
}
const imgsLoaded = (S) => S.evaluate("[...document.querySelectorAll('img')].filter((i) => i.getBoundingClientRect().width > 8 && i.getAttribute('src')).every((i) => i.complete && i.naturalWidth > 0)");

(async () => {
  const m = man(); const P = m.personalId, B = m.businessId, st = m.stamp;
  // synthetic goals on the Personal profile (exact ids, removed with the account); the Business profile stays goal-less
  await admin.from("collection_goals").delete().eq("profile_id", P);
  const goals = [
    { id: `qa_goal_${st}_1`, name: "Complete the Spider-Man run", target_count: 12, universe: "POP_CULTURE" },
    { id: `qa_goal_${st}_2`, name: "Reach $2,000 collection value", target_count: 2000, universe: "POP_CULTURE" },
    { id: `qa_goal_${st}_3`, name: "Sell duplicate comics", target_count: 5, universe: "POP_CULTURE" },
    { id: `qa_goal_${st}_4`, name: "Insurance documentation goal", target_count: 20 },
  ].map((g) => ({ ...g, profile_id: P, created_at: new Date().toISOString() }));
  const gi = await admin.from("collection_goals").insert(goals); if (gi.error) throw new Error(gi.error.message);

  const S = await browser(BASE, { width: 1440, height: 900 });
  try {
    // ---- A. the tab row on every Vault page, Insurance after Goals
    const PAGES = ["/vault", "/vault/for-sale", "/vault/sold", "/portfolio", "/goals", "/insurance"];
    for (const p of PAGES) {
      await S.go(p); await S.waitFor("document.querySelector('nav[aria-label=\"Vault\"]') && document.body.innerText.length > 200", 180000, p); await sleep(2500);
      const t = await tabs(S);
      check(`[A] ${p}: one tab row, Insurance sits after Goals (${TABS})`, t && t.count === 1 && t.tabs === TABS, t);
    }
    // ---- B. discoverable: Vault -> Insurance by the tab; shell persists
    await S.go("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 180000, "vault"); await sleep(2500);
    await S.evaluate("document.querySelector('h1').__mark = 'H'; true");
    await S.evaluate("[...document.querySelectorAll('nav[aria-label=\"Vault\"] a')].find((a) => a.textContent.trim() === 'Insurance').click(); true");
    await S.waitFor("location.pathname === '/insurance'", 30000, "to insurance"); await S.waitFor("document.querySelectorAll('tbody tr').length > 5", 120000, "inventory rows"); await sleep(2500);
    const t1 = await tabs(S); const same = await S.evaluate("document.querySelector('h1').__mark");
    check("[B] clicking the Insurance tab opens /insurance, marked current, inside the same Vault header (not rebuilt)", t1.active === "Insurance" && same === "H", { t1, same });
    const inv = await text(S);
    check("[B] the inventory lists the QA items with Per-item sheet links", (await S.evaluate("document.querySelectorAll('a[href^=\"/insurance/item?id=\"]').length")) >= 20, null);
    check("[B] documentation readiness is stated and kept distinct from coverage ('not insurance coverage' / 'does not mean an item is insured')", /Documentation readiness:/.test(inv) && /does not mean an item is insured/.test(inv) && /not insurance coverage/i.test(inv), inv.match(/Documentation readiness.{0,260}/)?.[0]);
    check("[B] nothing on the page claims the items are insured", !/\b(is|are) insured\b|insured and covered|coverage active/i.test(inv.replace(/does not mean an item is insured/gi, "")), inv.match(/.{40}insured.{40}/)?.[0]);
    await shot(S, "insurance-inventory-1440", 1440, 900, false);
    // ---- C. item details -> packet -> print
    const firstHref = await S.evaluate("document.querySelector('a[href^=\"/insurance/item?id=\"]').getAttribute('href')");
    await S.evaluate("document.querySelector('a[href^=\"/insurance/item?id=\"]').click(); true");
    await S.waitFor("location.pathname === '/insurance/item'", 30000, "item"); await sleep(3000);
    const ti = await tabs(S); const itx = await text(S);
    check("[C] the per-item sheet opens inside the Vault shell with Insurance current", ti && ti.active === "Insurance" && ti.tabs === TABS, ti);
    check("[C] the sheet shows the item (title, Identification, Financial) from the existing sheet", /Insurance Item Sheet/i.test(itx) && /Identification/i.test(itx) && /Financial/i.test(itx) && /QA /.test(itx), itx.slice(0, 200));
    await shot(S, "insurance-item-1440", 1440, 900, false);
    await S.evaluate("history.back(); true"); await S.waitFor("location.pathname === '/insurance'", 30000, "back to insurance"); await sleep(2000);
    check("[C] Back from the item sheet returns to the inventory with the list intact", (await S.evaluate("document.querySelectorAll('tbody tr').length")) > 5);
    await S.evaluate("history.forward(); true"); await S.waitFor("location.pathname === '/insurance/item'", 30000, "forward"); await sleep(1500);
    check("[C] Forward returns to the same item sheet", (await S.path()).startsWith("/insurance/item?id="));
    await S.evaluate("[...document.querySelectorAll('a,button')].find((a) => /Back to Insurance/.test(a.textContent)).click(); true"); await S.waitFor("location.pathname === '/insurance'", 30000, "back link"); await sleep(1500);
    await S.evaluate("[...document.querySelectorAll('[data-workspace-actions] a')].find((a) => /Policy Packet/.test(a.textContent)).click(); true");
    await S.waitFor("location.pathname === '/insurance/packet'", 30000, "packet"); await S.waitFor("document.querySelectorAll('tbody tr').length > 3", 120000, "packet rows"); await sleep(2500);
    const tp = await tabs(S);
    check("[C] the Policy Packet opens from the header action inside the Vault shell with Insurance current", tp && tp.active === "Insurance" && tp.tabs === TABS, tp);
    await shot(S, "insurance-packet-1440", 1440, 900, false);
    await S.go("/insurance/packet"); await S.waitFor("document.querySelector('nav[aria-label=\"Vault\"]') && document.querySelectorAll('tbody tr').length > 3", 180000, "packet refresh"); await sleep(2500);
    check("[C] refreshing the packet keeps the packet, the shell and the items", (await S.path()) === "/insurance/packet" && (await tabs(S))?.active === "Insurance", await tabs(S));
    const printHref = await S.evaluate("[...document.querySelectorAll('a')].find((a) => /Open Printable Page/.test(a.textContent))?.getAttribute('href')");
    const printTarget = await S.evaluate("[...document.querySelectorAll('a')].find((a) => /Open Printable Page/.test(a.textContent))?.getAttribute('target')");
    check("[C] 'Open Printable Page' is a link to the print-only route that opens in its own tab", (printHref || "").startsWith("/insurance/packet/print?") && printTarget === "_blank", { printHref, printTarget });
    await S.go(printHref); await S.waitFor("location.pathname === '/insurance/packet/print'", 30000, "print route"); await sleep(3000);
    const pt = await text(S);
    check("[C] the printable page opens (print-only route: no Vault shell on it) with the packet and a print control", /Insurance Policy Packet/.test(pt) && (await S.evaluate("!document.querySelector('[data-vault-chrome]')")) && /print/i.test(pt), { printHref, head: pt.slice(0, 160) });
    await S.evaluate("window.__printed = 0; window.print = () => { window.__printed++; }; [...document.querySelectorAll('button')].find((b) => /print|save/i.test(b.textContent)).click(); true");
    check("[C] the print control on the printable page calls the browser's print", (await S.evaluate("window.__printed")) === 1);
    // print media hides the shared chrome on the three shell pages
    await S.send("Emulation.setEmulatedMedia", { media: "print" });
    for (const p of ["/insurance", "/insurance/packet"]) {
      await S.go(p); await S.waitFor("document.querySelector('[data-vault-chrome]') && document.querySelectorAll('tbody tr').length > 3", 180000, "print media " + p); await sleep(1500);
      check(`[C] print layout of ${p}: the Vault header and tab row do not print`, (await S.evaluate("getComputedStyle(document.querySelector('[data-vault-chrome]')).display")) === "none");
    }
    await S.send("Emulation.setEmulatedMedia", { media: "" });
    await S.go("/insurance"); await S.waitFor("document.querySelectorAll('tbody tr').length > 5", 180000, "insurance again"); await sleep(2000);
    await S.evaluate("window.__printed = 0; window.print = () => { window.__printed++; }; [...document.querySelectorAll('[data-workspace-actions] button')].find((b) => /Print Inventory/.test(b.textContent)).click(); true");
    check("[C] 'Print Inventory PDF' (header action) calls the browser's print", (await S.evaluate("window.__printed")) === 1);

    // ---- E. profile switching while on Insurance
    await S.evaluate(`localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(B)}); window.dispatchEvent(new Event('vltd:active-profile')); true`);
    await S.waitFor("/No items to insure yet/.test(document.body.innerText)", 90000, "business empty").catch(() => {});
    const bz = await text(S);
    check("[E] switching to the Business profile on /insurance replaces the list: none of the Personal items remain", /No items to insure yet/.test(bz) && !/QA Album/.test(bz), bz.slice(0, 300));
    await S.evaluate(`localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(P)}); window.dispatchEvent(new Event('vltd:active-profile')); true`);
    await S.waitFor("document.querySelectorAll('tbody tr').length > 5", 90000, "personal back").catch(() => {});
    check("[E] switching back to Personal restores the Personal inventory", (await S.evaluate("document.querySelectorAll('tbody tr').length")) > 5, (await text(S)).slice(0, 200));
    check("[E] the tab row stays on the page through both switches", (await tabs(S))?.tabs === TABS);

    // ---- F. Goals: no goals (Business profile)
    await S.evaluate(`localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(B)}); true`);
    await S.go("/goals"); await S.waitFor("document.querySelector('nav[aria-label=\"Vault\"]') && /No goals yet/.test(document.body.innerText)", 180000, "goals empty"); await sleep(2500);
    const ge = await text(S);
    const filterBtns = await S.evaluate("[...document.querySelectorAll('[role=group][aria-label=\"Goal types\"] button')].map((b) => b.textContent.trim())");
    check("[F] with no goals the goal-type filters are hidden", filterBtns.length === 0 && !(await S.evaluate("[...document.querySelectorAll('button')].some((b) => /^(All Goals|Completion|Value|Sell|Exhibition|Insurance)$/.test(b.textContent.trim()))")), filterBtns);
    check("[F] with no goals it explains what a goal is and offers Create Goal", /A goal is something you are working toward/.test(ge) && (await S.evaluate("[...document.querySelectorAll('button')].filter((b) => /\\+ Create Goal/.test(b.textContent)).length")) >= 1, ge.slice(0, 260));
    check("[F] the development placeholder is gone everywhere on the page", !/goal due dates|goal model|Upcoming Milestones|Milestones will appear/i.test(ge), ge.match(/.{0,40}(due dates|goal model|Milestones).{0,60}/)?.[0]);
    await shot(S, "goals-empty-1440", 1440, 900, false);
    // ---- F. Goals: populated (Personal)
    await S.evaluate(`localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(P)}); true`);
    await S.go("/goals"); await S.waitFor("document.querySelectorAll('[role=group][aria-label=\"Goal types\"] button').length > 0", 180000, "goals populated"); await sleep(3000);
    const labels = await S.evaluate("[...document.querySelectorAll('[role=group][aria-label=\"Goal types\"] button')].map((b) => b.textContent.trim())");
    check("[F] with goals the filters are All Goals, Completion, Value, Sell, Exhibition - and NOT Insurance", labels.join(",") === "All Goals,Completion,Value,Sell,Exhibition", labels);
    const names = () => S.evaluate("[...document.querySelectorAll('h3, [data-goal-name]')].map((e) => e.textContent.trim()).filter((x) => /Spider-Man run|collection value|duplicate comics|Insurance documentation/.test(x))");
    const rowNames = () => S.evaluate("(() => { const t = document.body.innerText; return ['Complete the Spider-Man run', 'Reach $2,000 collection value', 'Sell duplicate comics', 'Insurance documentation goal'].filter((n) => t.includes(n)); })()");
    check("[F] All Goals lists all four goals, including the existing insurance-type goal (records intact)", (await rowNames()).length === 4, await rowNames());
    const click = (label) => S.evaluate(`[...document.querySelectorAll('[role=group][aria-label="Goal types"] button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)}).click(); true`);
    await shot(S, "goals-populated-1440", 1440, 900, false);
    await click("Completion"); await sleep(900);
    check("[F] Completion shows only the completion goal", JSON.stringify(await rowNames()) === JSON.stringify(["Complete the Spider-Man run"]), await rowNames());
    await click("Value"); await sleep(900);
    check("[F] Value shows only the value goal", JSON.stringify(await rowNames()) === JSON.stringify(["Reach $2,000 collection value"]), await rowNames());
    await click("Sell"); await sleep(900);
    check("[F] Sell shows only the sell goal", JSON.stringify(await rowNames()) === JSON.stringify(["Sell duplicate comics"]), await rowNames());
    await click("Exhibition"); await sleep(900);
    const ex = await text(S);
    check("[F] Exhibition (no such goal) shows an explicit empty state, not a blank list and not 'No goals yet'", (await S.evaluate("!!document.querySelector('[data-testid=goals-filter-empty]')")) && /No Exhibition goals/.test(ex) && !/No goals yet/.test(ex) && (await rowNames()).length === 0, ex.slice(0, 300));
    await shot(S, "goals-filter-empty-1440", 1440, 900, false);
    await S.evaluate("[...document.querySelectorAll('button')].find((b) => /Show all goals/.test(b.textContent)).click(); true"); await sleep(900);
    check("[F] 'Show all goals' from the empty state restores all four", (await rowNames()).length === 4, await rowNames());
    const gtx = await text(S);
    check("[F] the Goals stat no longer calls goal progress 'Insurance Coverage'", !/(?<!not )insurance coverage/i.test(gtx) && /Insurance Goal Progress/i.test(gtx) && /Not insurance coverage/i.test(gtx), gtx.match(/Insurance Goal.{0,120}/)?.[0]);
  } catch (e) { console.log("STOPPED", e.message); fail++; results.push({ n: "STOPPED", ok: false, d: e.message }); } finally { await S.close(); }

  // ---- G. phone widths: the tab row with six tabs
  for (const W of [390, 320]) {
    const M = await browser(BASE, { width: W, height: 800, mobile: true });
    try {
      await M.go("/insurance"); await M.waitFor("document.querySelector('nav[aria-label=\"Vault\"]') && document.querySelectorAll('tbody tr').length > 3", 180000, "phone insurance"); await sleep(3000);
      const t = await tabs(M); const ov = await M.evaluate("document.documentElement.scrollWidth <= innerWidth");
      check(`[G @${W}] Insurance is reachable in the tab row on a phone (all six tabs, no sideways scroll)`, t && t.tabs === TABS && ov, { t, ov });
      await shot(M, `insurance-${W}`, W, 800, true);
    } catch (e) { check(`[G @${W}] ran`, false, e.message); } finally { await M.close(); }
  }
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ label: LABEL, base: BASE, at: new Date().toISOString(), pass, fail, results }, null, 1));
  console.log(`\n${pass} passed, ${fail} failed -> ${OUT}/results.json`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });

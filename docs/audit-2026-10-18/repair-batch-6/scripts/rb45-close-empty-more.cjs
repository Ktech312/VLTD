// RC-29 / RC-30 remainder (commit a71052a and later): Escape closes the Edit Photo dialog, Close and Dismiss close the Activity details panel, a
// filter that matches no exhibition says so. Production, isolated QA owner; nothing is saved.
//   AUDIT_MANIFEST=<manifest> node rb45-close-empty-more.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const X = require(path.join(SD, "audit-s-itm-lib.cjs"));
const { sleep, session } = A;
const LABEL = process.argv[2] || "run";
const r = A.R("RB45");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb45-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-29 / RC-30", repro: "" });
}
function notTested(control, why, page) {
  out.cases.push({ control, ok: null, actual: why });
  r.nt({ page, control, expected: "", actual: why, evidence: "", impact: "RC-29 / RC-30", repro: "" });
}
(async () => {
  let S;
  try {
    S = await session("owner", { width: 1440, height: 900 });
    // Edit Photo dialog
    await X.openItem(S, X.ID.valued); await sleep(3500);
    const clicked = await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === 'Edit Photo'); if (!b) return false; b.click(); return true; })()");
    await sleep(2500);
    const dlg = "!!document.querySelector('[role=dialog][aria-label=\"Edit saved photo\"]')";
    const e1 = await S.evaluate(dlg);
    await A.press(S, "Escape"); await sleep(900);
    const e2 = await S.evaluate(dlg);
    if (clicked && e1) await rec(S, !e2, "Item page: Edit Photo dialog, press Escape (no changes made)", "the dialog closes", `open=${e1}; open after Escape=${e2}`, "/vault/item/[id]");
    else notTested("Item page: Edit Photo dialog, press Escape", `could not open the dialog in this run (button found=${clicked}, open=${e1})`, "/vault/item/[id]");

    // Activity panel
    await S.visit("/activity"); await sleep(9000);
    const closeSel = 'button[aria-label="Close"]';
    const hasPanel = await S.evaluate(`!!document.querySelector('${closeSel}')`);
    if (hasPanel) {
      await A.clickSel(S, closeSel); await sleep(900);
      const after = await S.evaluate(`!!document.querySelector('${closeSel}')`);
      await rec(S, !after, "Activity: Close on the details panel", "the panel closes and stays closed (another entry used to take its place)", `panel open before=true; after Close=${after}`, "/activity");
    } else notTested("Activity: Close on the details panel", "this account has no activity entries, so the details panel does not appear", "/activity");

    // Exhibitions filter with no match
    await S.visit("/museum"); await sleep(9000);
    const counts = {};
    for (const label of ["Drafts", "Public", "Private", "Invite-only"]) {
      await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === ${JSON.stringify(label)}); if (b) b.click(); })()`); await sleep(1200);
      counts[label] = await S.evaluate("!!document.querySelector('[data-testid=exhibitions-no-match]')");
    }
    const anyEmpty = Object.entries(counts).find(([, v]) => v);
    if (anyEmpty) {
      const t = await S.evaluate("document.querySelector('[data-testid=exhibitions-no-match]').innerText.replace(/\\s+/g, ' ')");
      await S.evaluate("(() => { const b = [...document.querySelectorAll('[data-testid=exhibitions-no-match] button')][0]; if (b) b.click(); })()"); await sleep(1000);
      const back = await S.evaluate("!document.querySelector('[data-testid=exhibitions-no-match]')");
      await rec(S, /No exhibitions match/i.test(t) && back, `Exhibitions: filter '${anyEmpty[0]}' (matches nothing)`, "says no exhibition matches, with a Show all button that clears it", `message=${JSON.stringify(t)}; cleared by Show all=${back}`, "/museum");
    } else notTested("Exhibitions: a filter that matches nothing", `every filter had a match for this account (${JSON.stringify(counts)})`, "/museum");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb45-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => c.ok === false).length} not ok, ${out.cases.filter((c) => c.ok === null).length} not tested of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => c.ok !== true)) console.log(c.ok === null ? "NOT TESTED:" : "NOT OK:", c.control, "|", String(c.actual).slice(0, 420));
    process.exit(0);
  }
})();

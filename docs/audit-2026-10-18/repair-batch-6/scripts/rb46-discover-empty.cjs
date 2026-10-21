// RC-30 (DIS-057, DIS-065, DIS-115): on Discover a search or universe filter that matches no room shows the empty message alone: no featured rooms,
// no carousel, no room cards underneath. Production, read-only, visitor.
//   AUDIT_MANIFEST=<manifest> node rb46-discover-empty.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session } = A;
const LABEL = process.argv[2] || "run";
const r = A.R("RB46");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb46-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-30", repro: "" });
}
const state = `JSON.stringify({ msg: /No exhibitions match/i.test(document.body.innerText), featured: !!document.querySelector('[data-testid=featured-rooms]'), carousel: /Explore featured rooms/i.test(document.body.innerText), cards: [...document.querySelectorAll('main button')].filter((b) => /\\d+ items?/i.test(b.innerText || '')).length })`;
(async () => {
  let S;
  try {
    S = await session("visitor", { width: 1440, height: 900 });
    await S.visit("/discover"); await sleep(10000);
    const full = JSON.parse(await S.evaluate(state));
    await A.typeInto(S, 'input[placeholder^="Search exhibitions"]', "zzqqxx no such room"); await sleep(1500);
    const s1 = JSON.parse(await S.evaluate(state));
    await rec(S, s1.msg && !s1.featured && !s1.carousel && s1.cards === 0, "Discover: a search that matches nothing", "the empty message alone (no featured rooms, no carousel, no room cards)", `with no search: ${JSON.stringify(full)}; with the search: ${JSON.stringify(s1)}`, "/discover");
    await A.typeInto(S, 'input[placeholder^="Search exhibitions"]', ""); await sleep(1000);
    const tabs = await S.evaluate("[...document.querySelectorAll('button')].map((b) => (b.innerText || '').trim()).filter((t) => /^(Games|Automotive|Art|Jewelry|Built|Botany)/i.test(t))");
    let found = null;
    for (const label of tabs) {
      await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === ${JSON.stringify(label)}); if (b) b.click(); })()`); await sleep(1200);
      const s2 = JSON.parse(await S.evaluate(state));
      if (s2.msg) { found = { label, s2 }; break; }
    }
    if (found) await rec(S, !found.s2.featured && !found.s2.carousel && found.s2.cards === 0, `Discover: universe filter '${found.label}' (no rooms in it)`, "the empty message alone", JSON.stringify(found.s2), "/discover");
    else { out.cases.push({ control: "Discover: universe filter with no rooms", ok: null, actual: `every candidate tab had rooms (${JSON.stringify(tabs)})` }); r.nt({ page: "/discover", control: "Discover: a universe filter with no rooms", expected: "", actual: `every candidate tab had rooms (${JSON.stringify(tabs)}); same list logic as the search case`, evidence: "", impact: "RC-30", repro: "" }); }
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb46-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => c.ok === false).length} not ok, ${out.cases.filter((c) => c.ok === null).length} not tested${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => c.ok !== true)) console.log(c.ok === null ? "NOT TESTED:" : "NOT OK:", c.control, "|", String(c.actual).slice(0, 420));
    process.exit(0);
  }
})();

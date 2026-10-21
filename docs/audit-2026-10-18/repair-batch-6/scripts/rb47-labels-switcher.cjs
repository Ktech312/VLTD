// RC-34 (ACC-851, VLT-401, VLT-423, VLT-235): the profile switcher shows pictures, category names read "TV", the category subtitle has no developer
// wording, the collection report names universes. Production, read-only, isolated QA owner.
//   AUDIT_MANIFEST=<manifest> node rb47-labels-switcher.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session } = A;
const LABEL = process.argv[2] || "run";
const r = A.R("RB47");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb47-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-34", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
(async () => {
  let S;
  try {
    S = await session("owner", { width: 1440, height: 900 });
    await S.visit("/dashboard"); await sleep(8000);
    await S.evaluate("(() => { const b = document.querySelector('button[aria-label=\"Account menu\"]'); if (b) b.click(); })()"); await sleep(1000);
    const sw = await S.evaluate("(() => { const h = [...document.querySelectorAll('div')].find((d) => (d.innerText || '').trim().toLowerCase() === 'switch profile'); if (!h) return null; const box = h.parentElement; return [...box.querySelectorAll('button')].map((b) => ({ text: (b.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 60), img: !!b.querySelector('img'), first: ((b.querySelector('span') || {}).innerText || '').trim() })); })()");
    if (sw) await rec(S, sw.length > 1 && sw.every((x) => x.first.toLowerCase() !== "key" && (x.img || x.first.length === 1)), "Account menu > Switch Profile: profile avatars", "a picture (or the profile's initial) for each profile, never the word 'key'", JSON.stringify(sw), "/dashboard");
    else { out.cases.push({ control: "Switch Profile", ok: null, actual: "the list is not shown for this account" }); r.nt({ page: "/dashboard", control: "Account menu > Switch Profile: profile avatars", expected: "", actual: "the Switch Profile list is not shown for this account in this run", evidence: "", impact: "RC-34", repro: "" }); }
    await A.press(S, "Escape");

    await S.visit("/portfolio"); await sleep(9000);
    let t = await body(S);
    await rec(S, !/Movies \/ Tv \/ Film/.test(t), "Insights: category 'Movies / TV / Film'", "TV in capitals", `'Tv' spelling present=${/Movies \/ Tv \/ Film/.test(t)}; 'TV' present=${/Movies \/ TV \/ Film/.test(t)}`, "/portfolio");

    await S.visit("/portfolio/universe/MUSIC/category/Audio%20Formats"); await sleep(9000);
    t = await body(S);
    await rec(S, !/Future DB-ready/i.test(t) && !/Fast drill-down/i.test(t), "Category page: subtitle", "no developer wording", `'Future DB-ready' present=${/Future DB-ready/i.test(t)}`, "/portfolio/universe/[key]/category/[category]");

    await S.visit("/vault/print"); await sleep(9000);
    t = await body(S);
    await rec(S, !/POP_CULTURE/.test(t) && /Pop Culture/i.test(t), "Collection report: group headings", "universe names (Pop Culture), not POP_CULTURE", `'POP_CULTURE' present=${/POP_CULTURE/.test(t)}; 'Pop Culture' present=${/Pop Culture/i.test(t)}`, "/vault/print");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb47-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => c.ok === false).length} not ok, ${out.cases.filter((c) => c.ok === null).length} not tested${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => c.ok !== true)) console.log(c.ok === null ? "NOT TESTED:" : "NOT OK:", c.control, "|", String(c.actual).slice(0, 420));
    process.exit(0);
  }
})();

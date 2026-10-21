// RC-29 / RC-30 / RC-32 / RC-34 (commit a71052a): Discover's Close really closes the panel, a search with no match says so alone, the public footer's Exhibitions link opens
// Discover, and /shop and /saved carry no emoji. Production, read-only.
//   AUDIT_MANIFEST=<manifest> node rb42-close-empty-glyphs.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session } = A;
const LABEL = process.argv[2] || "run";
const r = A.R("RB42");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb42-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-29 / RC-30 / RC-32 / RC-34", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
(async () => {
  let S;
  try {
    S = await session("visitor", { width: 1440, height: 900 });
    await S.visit("/"); await sleep(6000);
    const hv = await S.evaluate("[...document.querySelectorAll('footer a')].map((a) => a.getAttribute('href'))");
    await rec(S, !hv.includes("/museum") && hv.includes("/discover"), "Public home footer: Exhibitions / Discover", "no footer link sends a visitor to /museum (login); Discover opens /discover", `href=${JSON.stringify(hv)}`, "/");

    await S.visit("/discover"); await sleep(10000);
    const panelOpen = "[...document.querySelectorAll('div')].some((d) => (d.innerText || '').trim() === 'Public Exhibition')";
    const before = await S.evaluate(panelOpen);
    const closed = await S.evaluate("(() => { const b = document.querySelector('button[aria-label=\"Close\"]'); if (!b) return 'no-close'; b.click(); return 'clicked'; })()");
    await sleep(900);
    const after = await S.evaluate(panelOpen);
    await rec(S, before && closed === "clicked" && !after, "Discover: Close on the details panel", "the panel closes and stays closed (it used to be replaced by the first room)", `open before=${before}; close=${closed}; open after=${after}`, "/discover");

    await A.typeInto(S, 'input[placeholder^="Search exhibitions"]', "zzqqxx no such room"); await sleep(1500);
    const t = await body(S);
    await rec(S, /No exhibitions match/i.test(t) && !(await S.evaluate(panelOpen)), "Discover: a search that matches nothing", "says 'No exhibitions match' and lists no rooms underneath", `message shown=${/No exhibitions match/i.test(t)}; panel open=${await S.evaluate(panelOpen)}`, "/discover");
    await S.close();

    S = await session("owner", { width: 1440, height: 900 });
    await S.visit("/shop"); await sleep(5000);
    const st = await S.evaluate("document.body.innerText");
    const svgs = await S.evaluate("document.querySelectorAll('main svg, [class*=aspect] svg, div[aria-hidden=true] svg').length");
    await rec(S, !EMOJI.test(st) && svgs > 10, "/shop product thumbnails", "line-art glyphs, no emoji", `emoji present=${EMOJI.test(st)}; svg count=${svgs}`, "/shop");
    await S.visit("/saved"); await sleep(6000);
    const sv = await S.evaluate("document.body.innerText");
    await rec(S, !EMOJI.test(sv), "/saved link to The Flip", "no emoji in the link", `emoji present=${EMOJI.test(sv)}`, "/saved");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb42-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 420));
    process.exit(0);
  }
})();

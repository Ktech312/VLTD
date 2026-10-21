// RC-21 leftovers: a failed Upcoming SEARCH (DIS-268) and the Watchlist's explicit no-match states (DIS-159, DIS-154). Production, isolated QA owner; reads only.
//   AUDIT_MANIFEST=<manifest> node rb33-search-states.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session } = A;
const LABEL = process.argv[2] || "run";
const r = A.R("RB33");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb33-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-21", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
(async () => {
  let S;
  try {
    S = await session("owner", { width: 1440, height: 900 });
    await S.visit("/upcoming"); await sleep(8000);
    await S.send("Network.setBlockedURLs", { urls: ["*/api/comic-upcoming*"] });
    const typed = await S.evaluate("(() => { const i = [...document.querySelectorAll('main input, input')].find((x) => x.type === 'text' || x.type === 'search' || !x.type); return !!i; })()");
    await A.typeInto(S, "form input[type=text]", "Momoko");
    await A.press(S, "Enter"); await sleep(6000);
    let t = await body(S);
    await rec(S, typed && /couldn.t load the upcoming releases/i.test(t) && !/Nothing found/i.test(t), "Upcoming: search for a name while the release feed cannot be reached", "says it could not load, with Try again; never 'Nothing found'", `text: ${t.slice(0, 200)}`, "/upcoming");
    await S.send("Network.setBlockedURLs", { urls: [] });

    await S.visit("/watchlist"); await sleep(9000);
    await A.typeInto(S, 'input[placeholder="Search watchlist..."]', "zzzznomatch"); await sleep(1200);
    t = await body(S);
    await rec(S, /Nothing on your watchlist matches/i.test(t), "Watchlist: search with no match", "an explicit 'Nothing on your watchlist matches ...' message", `message shown=${/Nothing on your watchlist matches/i.test(t)}`, "/watchlist");
    await A.typeInto(S, 'input[placeholder="Search watchlist..."]', ""); await sleep(600);
    await A.clickText(S, "^Exhibitions", "button"); await sleep(1200);
    t = await body(S);
    await rec(S, /Nothing here for this filter yet/i.test(t) || /Nothing on your watchlist matches/i.test(t), "Watchlist: the Exhibitions chip when no exhibitions are watched", "an explicit 'Nothing here for this filter yet' message", `message shown=${/Nothing here for this filter yet/i.test(t)}`, "/watchlist");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb33-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 400));
    process.exit(0);
  }
})();

// RC-11 / RC-16 on PRODUCTION after SQL file 1: the scan-allowance ticker on the Bulk page for Personal AND Business profiles, no failed allowance request on Bulk, Capture
// and Quick Add, and the Bulk card's own "Scan with AI" failure message (ADD-415). AI requests are refused by the harness: nothing is sent to the AI, no credit is spent.
// Isolated QA owner; no item is saved.
//   AUDIT_MANIFEST=<manifest> node rb57-bulk-allowance-pages.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { session, sleep, clickText, chooseViaButton, mkPng, tmp, text, pickSelect, man, admin } = T;
const m = man(); const P = m.personalId, B = m.businessId;
const LABEL = process.argv[2] || "run";
const r = T.R("RB57");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(T.AUD, await S.jshot(`rb57-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(T.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-11 / RC-16", repro: "" });
}
async function watchStatus(S) {
  const seen = [];
  await S.send("Network.enable");
  seen.profiles = [];
  S.c.on((e) => {
    if (e.method === "Network.responseReceived" && /rpc\/bulk_scan_status/.test(e.params.response.url)) seen.push(e.params.response.status);
    if (e.method === "Network.requestWillBeSent" && e.params.request.method !== "OPTIONS" && /rpc\/bulk_scan_status/.test(e.params.request.url)) { try { seen.profiles.push(JSON.parse(e.params.request.postData || "{}").p_profile); } catch { /* not json */ } }
  });
  return seen;
}
(async () => {
  let S;
  try {
    S = await session("owner", { width: 1440, height: 900 });
    const calls = await watchStatus(S);
    const tickerOn = async (route) => {
      calls.length = 0; calls.profiles.length = 0;
      await S.visit(route); await sleep(4000);
      let tk = null; for (let i = 0; i < 8 && !tk; i++) { await sleep(1500); tk = (await text(S)).match(/(\d+)\s*of (\d+) AI scans left/); }
      return { tk, statuses: [...calls], profiles: [...calls.profiles] };
    };
    for (const [label, pid, id] of [["Personal", P, "personal"], ["Business", B, "business"]]) {
      await S.visit("/vault"); await sleep(2500);
      await S.evaluate(`localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(pid)}); true`);
      const truth = (await admin.rpc("bulk_scan_status", { p_profile: pid })).data; const trow = Array.isArray(truth) ? truth[0] : truth;
      const b = await tickerOn("/vault/bulk");
      await rec(S, b.tk && Number(b.tk[1]) === trow.scan_limit && Number(b.tk[2] || 0) >= 0 && b.statuses.length > 0 && b.statuses.every((s) => s === 200) && b.profiles.length > 0 && b.profiles.every((x) => x === pid), `Bulk page, ${label} profile: the AI scans ticker`, "shows the remaining and the limit the database holds; the allowance request is made for THIS profile and succeeds", `ticker=${b.tk ? b.tk[0] : "none"}; database limit=${trow.scan_limit}, remaining=${trow.remaining}; allowance request statuses=${JSON.stringify(b.statuses)}; asked about profile ${JSON.stringify(b.profiles.map((x) => String(x).slice(0, 8)))} (expected ${pid.slice(0, 8)})`, "/vault/bulk");
      for (const route of ["/capture", "/vault/quick"]) {
        calls.length = 0;
        await S.visit(route); await sleep(7000);
        await rec(S, calls.every((s) => s === 200), `${route}, ${label} profile: the allowance request`, "no failed allowance request on page load", `statuses=${JSON.stringify(calls)}`, route);
      }
    }
    // back to Personal for the card scan
    await S.visit("/vault"); await sleep(2000);
    await S.evaluate(`localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(P)}); true`);
    await S.visit("/vault/bulk"); await S.waitFor("document.querySelectorAll('select').length >= 1", 60000); await sleep(3500);
    mkPng(tmp("rb57-a.png"), 500, 400, [90, 90, 200]);
    await chooseViaButton(S, T.btnExpr("Choose photos"), tmp("rb57-a.png")); await sleep(1500);
    await pickSelect(S, "document.querySelectorAll('select')[0]", "Music"); await sleep(400);
    const cats = await S.evaluate("[...document.querySelectorAll('select')[1].options].map((o) => o.text.trim()).filter((x) => x && !/Select/.test(x))"); await pickSelect(S, "document.querySelectorAll('select')[1]", cats[0]);
    await clickText(S, "Skip — I.ll fill in by hand"); await sleep(2500);
    await S.waitFor("[...document.querySelectorAll('button')].some((b) => (b.innerText || '').trim() === 'Scan with AI')", 20000, "card button").catch(() => {}); await sleep(800);
    const aiBefore = (S.intercepted || []).filter((x) => /api\/ai/.test(x.url)).length;
    const clicked = await clickText(S, "^Scan with AI$"); await sleep(9000);
    const t = await text(S);
    const aiAfter = (S.intercepted || []).filter((x) => /api\/ai/.test(x.url)).length;
    await rec(S, clicked && /Couldn.t identify that one/i.test(t) && !/check your AI scan allowance/i.test(t) && aiAfter > aiBefore, "Bulk page: a card's own 'Scan with AI' when the allowance is readable and the AI call is refused", "the card says 'Couldn't identify that one - try again or fill it in by hand' (the allowance is no longer the problem)", `clicked=${clicked}; failure message=${/Couldn.t identify that one/i.test(t)}; says allowance unreadable=${/check your AI scan allowance/i.test(t)}; AI requests refused by the harness ${aiBefore} -> ${aiAfter}`, "/vault/bulk");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb57-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 460));
    process.exit(0);
  }
})();

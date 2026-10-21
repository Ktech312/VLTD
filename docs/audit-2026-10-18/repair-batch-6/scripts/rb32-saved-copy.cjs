// RC-21, saved-copy cases: with items saved on this device and the refresh refused, Insights / Goals / Home show the saved figures WITH the
// "Showing saved data" notice. Production, isolated QA owner; reads only.
//   AUDIT_MANIFEST=<manifest> node rb32-saved-copy.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session } = A;
const LABEL = process.argv[2] || "run";
const r = A.R("RB32");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb32-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-21", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
const BLOCK = ["*supabase.co/rest/v1/*", "*supabase.co/auth/v1/user*"];
(async () => {
  let S;
  try {
    S = await session("owner", { width: 1440, height: 900 });
    await S.visit("/vault"); await sleep(9000); // online first: the account's items are saved on this device
    const saved = await S.evaluate("(() => { try { return JSON.parse(localStorage.getItem('vltd_items') || localStorage.getItem('vltd_vault_items') || '[]').length; } catch { return -1; } })()");
    await S.visit("/goals"); await sleep(7000); // goals saved on this device too
    await S.send("Network.setBlockedURLs", { urls: BLOCK });
    for (const [url, label, figure] of [["/portfolio", "Insights", /\b(8|26)\b/], ["/goals", "Goals", /Spider-Man|collection value/i], ["/dashboard", "Home", /\b26 items|\b8 items|items/i]]) {
      await S.visit(url);
      let t = await body(S);
      for (let i = 0; i < 16 && !/Showing saved data/i.test(t); i++) { await sleep(2000); t = await body(S); }
      await rec(S, /Showing saved data/i.test(t) && figure.test(t) && !/COULD NOT LOAD/i.test(t), `${label} with saved items on this device and the refresh refused`, "the saved figures are shown with a 'Showing saved data—couldn't refresh' notice (not a load error, not silence)", `notice=${/Showing saved data/i.test(t)}; figures present=${figure.test(t)}; saved items key count=${saved}`, url);
    }
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb32-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 400));
    process.exit(0);
  }
})();

// RC-21 (a failed load is shown as an empty collection / stays on "Loading…"), verified on PRODUCTION with the isolated QA fixture.
// The failure is made by blocking the browser's requests to the data service (Network.setBlockedURLs): QA data only, nothing is written.
//   AUDIT_MANIFEST=<manifest> node rb30-failed-loads.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session } = A;
const LABEL = process.argv[2] || "run";
const r = A.R("RB30");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb30-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-21", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
const BLOCK = ["*supabase.co/rest/v1/*", "*supabase.co/auth/v1/user*"];
async function visitBlocked(S, url, ms = 9000) { await S.send("Network.setBlockedURLs", { urls: BLOCK }); await S.visit(url); await sleep(ms); }
async function unblock(S) { await S.send("Network.setBlockedURLs", { urls: [] }); }

(async () => {
  const sessions = [];
  const open = async (kind, o) => { const S = await session(kind, o || { width: 1440, height: 900 }); sessions.push(S); return S; };
  try {
    const O = await open("owner");
    // the saved copy on this browser is empty (clean browser), so a failed read must read as a failure, never as "nothing here"
    const pages = [
      ["/portfolio", /couldn.t load your insights/i, /No items yet/i, "Insights"],
      ["/activity", /couldn.t load your activity/i, /No activity yet/i, "Activity"],
      ["/notifications", /couldn.t load your alerts/i, /No activity yet/i, "Alerts"],
      ["/goals", /couldn.t load your goals/i, /No goals yet/i, "Goals"],
      ["/reports/insurance", /couldn.t load your insurance report/i, /No items to report yet/i, "Insurance report"],
      ["/portfolio/insurance", /couldn.t load your inventory schedule/i, /No items found/i, "Inventory schedule"],
      ["/reports/weekly", /couldn.t load your weekly report/i, /Collector health check[^]*0 items/i, "Weekly report"],
      ["/insurance/packet/print?page=0&images=0", /couldn.t load your insurance packet/i, /Showing 0 of 0 counted items/i, "Printable packet"],
      ["/vault/item/qa-no-such-item/present", /couldn.t load your item/i, /isn.t in your vault/i, "Stream page"],
    ];
    for (const [url, want, notWant, label] of pages) {
      await visitBlocked(O, url, 3000);
      // the pages wait up to 20 s for the data service before saying so (never for ever), so allow for that
      let t = await body(O);
      for (let i = 0; i < 16 && !want.test(t); i++) { await sleep(2000); t = await body(O); }
      await rec(O, want.test(t) && !notWant.test(t), `${label} (${url}) when the data service cannot be reached`, "says it could not load (with Retry); never presents an empty collection", `could-not-load shown=${want.test(t)}; empty claim shown=${notWant.test(t)}; text: ${t.slice(0, 110)}`, url.split("?")[0]);
    }
    // Vault: nothing saved here + failed load -> the figures are not drawn
    await visitBlocked(O, "/vault", 14000);
    const v = await O.evaluate("(() => { const s = document.querySelector('main section.mb-5'); const t = (document.querySelector('main') || document.body).innerText; return { hidden: s ? s.hidden : null, couldNot: /couldn.t load|could not load/i.test(t), zeros: /\\$0\\b/.test(t) }; })()");
    await rec(O, v.couldNot && v.hidden === true && !v.zeros, "Vault when the load failed and nothing is saved on this device", "the could-not-load card; the $0 / 0 figures and chips are not shown", JSON.stringify(v), "/vault");
    // retry works once the connection is back
    await visitBlocked(O, "/portfolio", 7000);
    await unblock(O);
    await A.clickText(O, "^Retry$", "button"); await sleep(9000);
    const pt = await body(O);
    await rec(O, !/couldn.t load your insights/i.test(pt) && /Insights|value|collection/i.test(pt), "Insights: Retry after the connection returns", "the page loads normally", `text: ${pt.slice(0, 120)}`, "/portfolio");
    // positive control: with the service reachable, Goals shows the saved goals (not a load error)
    await unblock(O);
    await O.visit("/goals"); await sleep(9000);
    const gt = await body(O);
    await rec(O, !/couldn.t load your goals/i.test(gt) && !/No goals yet/i.test(gt), "Goals with the data service reachable (control)", "the account's goals are listed", `text: ${gt.slice(0, 120)}`, "/goals");
    // Clubs: missing vs failed vs loading
    await unblock(O);
    for (const id of ["00000000-0000-4000-8000-000000000001", "not-a-uuid"]) {
      await O.visit(`/clubs/${id}`); await sleep(7000);
      const ct = await body(O);
      await rec(O, /doesn.t exist/i.test(ct) && !/Loading…/.test(ct), `/clubs/${id}: a club that does not exist`, "a plain 'club doesn't exist' message, not an endless Loading…", `text: ${ct.slice(0, 110)}`, "/clubs/[clubId]");
    }
    await visitBlocked(O, "/clubs/00000000-0000-4000-8000-000000000001", 7000);
    const cf = await body(O);
    await rec(O, /couldn.t load this club/i.test(cf), "A club page when the data service cannot be reached", "says it could not load, with Try again (not 'doesn't exist')", `text: ${cf.slice(0, 110)}`, "/clubs/[clubId]");
    await unblock(O);
    await O.visit("/vault/item/qa-no-such-item/present"); await sleep(9000);
    const pt2 = await body(O);
    await rec(O, /isn.t in your vault/i.test(pt2) && !/^Loading\.\.\.$/.test(pt2), "Stream page for an item that is not in the account", "a plain 'isn't in your vault' message, not a permanent Loading...", `text: ${pt2.slice(0, 110)}`, "/vault/item/[id]/present");
    // Upcoming
    await O.send("Network.setBlockedURLs", { urls: ["*/api/comic-upcoming*"] });
    await O.visit("/upcoming"); await sleep(9000);
    const ut = await body(O);
    await rec(O, /couldn.t load the upcoming releases/i.test(ut) && !/Nothing found/i.test(ut), "Upcoming releases when the release feed cannot be reached", "says it could not load, with Try again; never 'Nothing found'", `text: ${ut.slice(0, 110)}`, "/upcoming");
    await unblock(O);
    await A.clickText(O, "^Try again$", "button"); await sleep(9000);
    const ut2 = await body(O);
    await rec(O, !/couldn.t load the upcoming releases/i.test(ut2), "Upcoming: Try again after the feed is reachable", "the failure message goes away", `text: ${ut2.slice(0, 110)}`, "/upcoming");
    await O.close();

    // Discover as a visitor
    const V = await open("visitor");
    await visitBlocked(V, "/discover", 9000);
    const dt = await body(V);
    await rec(V, /couldn.t load the exhibitions/i.test(dt) && !/No exhibitions match/i.test(dt) && !/Query error/i.test(dt), "Discover when the exhibitions cannot be read (signed-out visitor)", "a plain could-not-load line with Try again; no 'No exhibitions match', no raw 'Query error'", `text: ${dt.slice(0, 130)}`, "/discover");
    await unblock(V);
    await A.clickText(V, "^Try again$", "button"); await sleep(8000);
    const dt2 = await body(V);
    await rec(V, !/couldn.t load the exhibitions/i.test(dt2), "Discover: Try again after the connection returns", "the failure line goes away", `text: ${dt2.slice(0, 110)}`, "/discover");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    for (const S of sessions) { try { await S.close(); } catch {} }
    fs.writeFileSync(path.join(EV, `rb30-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 400));
    process.exit(0);
  }
})();

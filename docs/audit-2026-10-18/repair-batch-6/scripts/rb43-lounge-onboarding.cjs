// RC-32: /lounge-preview shows no developer wording and no admin links to a non-admin; Lounge drops read an all-day event on the right day in a
// US Pacific browser; a person bounced to setup is told why. Production, read-only (no rows are changed).
//   AUDIT_MANIFEST=<manifest> node rb43-lounge-onboarding.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session, admin } = A;
const LABEL = process.argv[2] || "run";
const r = A.R("RB43");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb43-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-32", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
(async () => {
  let S;
  try {
    S = await session("owner", { width: 1440, height: 900 });
    await S.visit("/lounge-preview"); await sleep(9000);
    let t = await body(S);
    const adminLinks = await S.evaluate("[...document.querySelectorAll('a')].filter((a) => (a.getAttribute('href') || '').startsWith('/admin')).length");
    await rec(S, adminLinks === 0, "/lounge-preview as a non-admin: links to admin pages", "none offered", `admin links=${adminLinks}`, "/lounge-preview");
    const dev = ["activity_events", "lounge_posts", "SerpApi", "No fake", "not wired", "Future "].filter((w) => t.includes(w));
    await rec(S, dev.length === 0, "/lounge-preview wording", "customer-facing only (no table names, 'fake', 'not wired', 'Future')", `developer phrases found=${JSON.stringify(dev)}`, "/lounge-preview");

    // all-day drop in a US Pacific browser
    const ev = (await admin.from("collector_events").select("name,starts_at").eq("enabled", true).gte("starts_at", new Date().toISOString()).order("starts_at", { ascending: true }).limit(1)).data || [];
    if (ev.length) {
      const e = ev[0];
      const d = new Date(e.starts_at);
      const utcMidnight = d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
      const want = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).toUpperCase();
      await S.send("Emulation.setTimezoneOverride", { timezoneId: "America/Los_Angeles" });
      await S.visit("/community-board"); await sleep(10000);
      t = await body(S);
      const shown = t.includes(want);
      await rec(S, shown && (!utcMidnight || /All day/i.test(t)), "Lounge: Upcoming Lounge Drops in a US Pacific browser", `shows ${want}${utcMidnight ? " and 'All day'" : ""} for '${e.name}' (the Events page's own date), not the day before`, `shows ${want}=${shown}; All day shown=${/All day/i.test(t)}; start=${e.starts_at}`, "/community-board");
      await S.send("Emulation.setTimezoneOverride", { timezoneId: "" });
    } else await rec(null, false, "Lounge drops date", "an upcoming event to compare", "no upcoming enabled event exists to test with", "/community-board");
    await S.close();

    // bounced to setup
    S = await session("onboard", { width: 1440, height: 900 });
    await S.visit("/vault"); await sleep(9000);
    t = await body(S);
    await rec(S, (await S.path()) === "/onboarding" && /Finish setting up your account first/i.test(t), "A signed-in person with unfinished setup opens /vault", "lands on setup and is told why", `path=${await S.path()}; note shown=${/Finish setting up your account first/i.test(t)}`, "/vault -> /onboarding");
    await S.visit("/onboarding"); await sleep(6000);
    t = await body(S);
    await rec(S, !/Finish setting up your account first/i.test(t), "Opening /onboarding directly", "no bounce note (the person was not sent here)", `note shown=${/Finish setting up your account first/i.test(t)}`, "/onboarding");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb43-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 420));
    process.exit(0);
  }
})();

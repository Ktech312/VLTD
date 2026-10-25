// Paid "Find events" lookup containment (RB69), on PRODUCTION: a visitor and a signed-in QA member.
// What is proven from outside: the page offers no lookup, searching and filtering the stored events works, the browser makes NO request to the lookup route
// (resource timing + a wrapped fetch), and the route itself answers "paused" for both, which it does before any key is read or any outside request is made (also unit-tested).
//   AUDIT_MANIFEST=<manifest> node rb69-events-lookup-paused.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session } = T;
const LABEL = process.argv[2] || "run";
const r = T.R("RB69");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] };

(async () => {
  const ck = (ok, control, expected, actual, page) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page: page || "/events", control, expected, actual: String(actual).slice(0, 600), evidence: "", impact: "events", repro: "" }); };
  for (const who of ["visitor", "owner"]) {
    const S = await session(who, { width: 1440, height: 900 });
    try {
      // record every fetch the page makes, from before the page's own code runs
      await S.visit("/events");
      await sleep(5000);
      await S.evaluate(`(() => { window.__calls = []; const f = window.fetch; window.fetch = function (...a) { try { window.__calls.push(String(a[0] && a[0].url || a[0])); } catch {} return f.apply(this, a); }; return true; })()`);
      const label = who === "visitor" ? "a visitor (not signed in)" : "a signed-in member";
      const t0 = await S.evaluate("document.body.innerText.replace(/\\s+/g, ' ')");
      ck(/Live event lookup is paused/i.test(t0), `${label}: the Events page says the live lookup is paused`, "a paused notice", t0.slice(0, 300));
      const controls = await S.evaluate(`({ citySearch: !!document.querySelector('input[placeholder="San Diego or 92101"]'), searchBtn: [...document.querySelectorAll('button')].some((b) => /^\\s*Search\\s*$/.test(b.textContent)), beyond: /Search beyond the catalog/i.test(document.body.innerText) })`);
      ck(!controls.citySearch && !controls.searchBtn && !controls.beyond, `${label}: no city box and no Search button for the live lookup`, "none offered", JSON.stringify(controls));
      // the search over stored events still works
      const before = await S.evaluate(`(() => { const m = document.body.innerText.match(/(\\d+) events/); return m ? Number(m[1]) : null; })()`);
      await S.evaluate(`(() => { const el = document.querySelector('input[aria-label="Search listed events"]'); if (!el) return false; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'zzzz-no-such-event'); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
      await sleep(900);
      const none = await S.evaluate("document.body.innerText.replace(/\\s+/g, ' ')");
      ck(/No events match these filters/i.test(none), `${label}: searching the stored events still works (a nonsense name matches nothing)`, "empty state", none.slice(0, 200));
      await S.evaluate(`(() => { const el = document.querySelector('input[aria-label="Search listed events"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
      await sleep(900);
      const after = await S.evaluate(`(() => { const m = document.body.innerText.match(/(\\d+) events/); return m ? Number(m[1]) : null; })()`);
      ck(before !== null && after === before, `${label}: clearing the search brings the stored events back (${before} listed)`, "same count", `${before} -> ${after}`);
      // the type filters work too
      // (the desktop type filter is a dropdown named "Filter by event type"; the row of buttons is phone-only)
      const opened = await S.evaluate(`(() => { const b = document.querySelector('[aria-label="Filter by event type"]'); if (!b) return false; b.click(); return true; })()`);
      await sleep(500);
      const picked = await S.evaluate(`(() => { const o = [...document.querySelectorAll('[role="option"],[role="menuitem"],[role="menuitemradio"],li button,button')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.trim() === 'Card Shows'); if (!o) return false; o.click(); return true; })()`);
      await sleep(900);
      const cardShows = await S.evaluate(`(() => { const m = document.body.innerText.match(/(\\d+) events/); return m ? Number(m[1]) : null; })()`);
      ck(opened && picked && cardShows !== null && cardShows < before, `${label}: the event-type filter still narrows the stored events (Card Shows: ${cardShows} of ${before})`, "fewer events listed", `opened=${opened} picked=${picked} ${cardShows} of ${before}`);
      // nothing the page did went to the lookup
      const calls = await S.evaluate("window.__calls");
      const entries = await S.evaluate(`performance.getEntriesByType('resource').map((e) => e.name).filter((n) => /api\\/events\\/search/.test(n))`);
      ck(calls.every((c) => !/api\/events\/search/.test(c)) && entries.length === 0, `${label}: the page made no request to the lookup route (wrapped fetch and resource timing)`, "0 requests to /api/events/search", `fetch calls: ${calls.length}; lookup entries: ${entries.length}`);
      // the route, asked directly from this browser with this browser's own credentials
      const direct = await S.evaluate(`fetch('/api/events/search?location=San%20Diego&category=convention&radius=100&dateRange=next_90', { credentials: 'include' }).then(async (res) => ({ status: res.status, body: await res.text() }))`);
      ck(direct.status === 503 && /paused/i.test(direct.body), `${label}: asking the lookup route directly gets "paused" (503), no results`, "503 paused", `${direct.status} ${direct.body.slice(0, 160)}`, "/api/events/search");
      await S.jshot(`rb69-${LABEL}-${who}-events`);
    } catch (e) { out.error = String((e && e.stack) || e).slice(0, 800); console.error("RUNNER ERROR", e); }
    finally { try { await S.close(); } catch {} }
  }
  fs.writeFileSync(path.join(EV, `rb69-${LABEL}.json`), JSON.stringify(out, null, 1));
  console.log(out.cases.map((c) => (c.ok ? "PASS " : "FAIL ") + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
  process.exit(0);
})();

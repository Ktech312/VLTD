// RC-31 (DIS-141, DIS-036) and DIS-276: on a phone, tapping a Discover room card brings its details panel into view; on a desktop window the panel's actions
// can be reached without scrolling the whole page to the end; the Events universe menu fits on screen. Production, read-only, visitor.
//   AUDIT_MANIFEST=<manifest> node rb51-discover-panel.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const { sleep, session } = A;
const LABEL = process.argv[2] || "run";
const r = A.R("RB51");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(A.AUD, await S.jshot(`rb51-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(A.AUD, ev).replace(/\\/g, "/") : "", impact: "RC-31", repro: "" });
}
const CARD = "(() => { const cards = [...document.querySelectorAll('main button')].filter((b) => /\\d+ items?/i.test(b.innerText || '') && b.getBoundingClientRect().height > 80); return cards[1] || cards[0] || null; })()";
(async () => {
  let S;
  try {
    // phone
    S = await session("visitor", { width: 390, height: 800, mobile: true });
    await S.visit("/discover"); await sleep(10000);
    const cardInfo = await S.evaluate(`(() => { const c = ${CARD}; if (!c) return null; c.scrollIntoView({ block: 'center' }); const b = c.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
    if (cardInfo) {
      await sleep(400);
      await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cardInfo.x, y: cardInfo.y }] }); await sleep(60); await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await sleep(2500);
      const pos = await S.evaluate("(() => { const a = [...document.querySelectorAll('aside')].find((x) => /Public Exhibition/i.test(x.innerText || '')); if (!a) return null; const b = a.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), vh: window.innerHeight }; })()");
      await rec(S, pos && pos.top < pos.vh - 120 && pos.bottom > 120, "Discover on a phone: tap a room card", "the details panel comes into view (it used to sit thousands of pixels below)", `panel position=${JSON.stringify(pos)}`, "/discover");
    } else await rec(null, false, "Discover on a phone: tap a room card", "a room card to tap", "no room card found", "/discover");
    await S.close();
    // desktop
    S = await session("visitor", { width: 1440, height: 900 });
    await S.visit("/discover"); await sleep(10000);
    await S.evaluate(`(() => { const c = ${CARD}; if (c) c.click(); })()`); await sleep(1500);
    // The panel is pinned to the top of the window as the page scrolls; a short scroll (a few hundred pixels, not the whole page) is enough for it to pin.
    await S.evaluate("(document.querySelector('.vltd-content-wrap') || document.scrollingElement).scrollTop = 350;"); await sleep(800);
    const act = await S.evaluate("(() => { const a = [...document.querySelectorAll('aside')].find((x) => /Public Exhibition/i.test(x.innerText || '')); if (!a) return null; const btn = [...a.querySelectorAll('a,button')].find((x) => /View room|View exhibition|Open room/i.test(x.innerText || '')); const ab = a.getBoundingClientRect(); const bb = btn ? btn.getBoundingClientRect() : null; return { aside: { top: Math.round(ab.top), bottom: Math.round(ab.bottom) }, btn: bb ? { top: Math.round(bb.top), bottom: Math.round(bb.bottom) } : null, scrollable: a.scrollHeight > a.clientHeight, vh: window.innerHeight, btnText: btn ? btn.innerText.trim() : null }; })()");
    // Reachable: the pinned panel fits inside the window, and its action button is inside the panel (scrolling the panel itself, not the page, reaches it).
    const reach = act && act.aside.top >= 0 && act.aside.bottom <= act.vh + 1 && (act.btn ? true : false) && act.scrollable;
    await rec(S, reach, "Discover on a desktop window: the details panel", "after a short scroll the panel is pinned and fits the window; it scrolls inside itself, so 'View room' is reachable without scrolling the whole page to the end", `panel=${JSON.stringify(act)}`, "/discover");
    await S.close();
    // events menu
    S = await session("visitor", { width: 1440, height: 900 });
    await S.visit("/events"); await sleep(9000);
    await S.evaluate("(() => { const b = document.querySelector('button[aria-label=\"Filter by universe\"]'); if (b) b.click(); })()"); await sleep(800);
    const menu = await S.evaluate("(() => { const m = document.querySelector('[role=menu]'); if (!m) return null; const b = m.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), vh: window.innerHeight, scrollable: m.scrollHeight > m.clientHeight }; })()");
    await rec(S, menu && menu.bottom <= menu.vh, "Events: the universe filter menu", "fits the window; a long list scrolls inside the menu", `menu=${JSON.stringify(menu)}`, "/events");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb51-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => !c.ok).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => !c.ok)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 460));
    process.exit(0);
  }
})();

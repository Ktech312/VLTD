// RB64 follow-up: event highlight links with the Browse menu, desktop and phone. On a highlighted-event page the page scrolls the chosen event into view, which
// carries the page header (and the Browse button) off the top, so the check scrolls back up before pressing Browse, as a person would.
//   AUDIT_MANIFEST=<manifest> node rb64b-highlight.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session } = T;
const LABEL = process.argv[2] || "run";
const r = T.R("RB64");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] };
const URL_HL = "/events?highlight=freshcomics-la-comic-con-2026";
(async () => {
  let S;
  const ck = (ok, control, expected, actual) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page: "/events (highlight)", control, expected, actual: String(actual).slice(0, 600), evidence: "", impact: "navigation", repro: "" }); };
  try {
    for (const [name, w, h, mobile] of [["desktop 1440", 1440, 900, false], ["phone 390 (emulated touch)", 390, 800, true]]) {
      S = await session("owner", { width: w, height: h, mobile });
      if (mobile) await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
      await S.visit("/dashboard"); await sleep(600);
      await S.visit(URL_HL); await sleep(7000);
      const hi = await S.evaluate(`({ path: location.pathname + location.search, text: document.body.innerText.slice(0, 6000), browse: !!document.querySelector('button[aria-label="Browse"]'), scrolled: (document.querySelector('.vltd-content-wrap') || {}).scrollTop })`);
      ck(hi.path === URL_HL && /L\.A\. Comic Con/.test(hi.text) && hi.browse, `an event link (?highlight=) opens that event with Browse beside the title (${name})`, "LA Comic Con selected; Browse present", `path=${hi.path}; event shown=${/L\.A\. Comic Con/.test(hi.text)}; Browse=${hi.browse}; page scrolled by ${hi.scrolled}`);
      await S.evaluate("(() => { const c = document.querySelector('.vltd-content-wrap'); if (c) c.scrollTop = 0; window.scrollTo(0, 0); return 1; })()"); await sleep(800);
      const b = await S.evaluate(`(() => { const r = document.querySelector('button[aria-label="Browse"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      if (mobile) { await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: b.x, y: b.y }] }); await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
      else { await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: b.x, y: b.y, button: "none" }); await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: b.x, y: b.y, button: "left", clickCount: 1, buttons: 1 }); await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: b.x, y: b.y, button: "left", clickCount: 1, buttons: 0 }); }
      await sleep(900);
      const mk = await S.evaluate(`(() => { const a = [...document.querySelectorAll('[role="menu"][aria-label="Browse"] [role="menuitem"]')].find((x) => x.textContent.includes('Marketplace')); if (!a) return null; const r = a.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      ck(!!mk, `on the highlighted-event page the Browse menu opens (${name})`, "menu open with Marketplace", mk ? "open" : "menu not open after pressing Browse");
      if (mk) {
        if (mobile) { await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: mk.x, y: mk.y }] }); await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
        else { await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: mk.x, y: mk.y, button: "none" }); await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: mk.x, y: mk.y, button: "left", clickCount: 1, buttons: 1 }); await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: mk.x, y: mk.y, button: "left", clickCount: 1, buttons: 0 }); }
        await sleep(2000);
        const at = await S.evaluate("location.pathname + location.search");
        await S.evaluate("history.back()"); await sleep(2500);
        const back = await S.evaluate("location.pathname + location.search");
        ck(at === "/market" && back === URL_HL, `Marketplace opens, and browser Back returns to the highlighted event URL (${name})`, "/market, then the ?highlight= URL", `${at}, then ${back}`);
      }
      await S.close(); S = null;
    }
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String((e && e.stack) || e).slice(0, 800); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb64b-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS" : "FAIL") + " " + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
    process.exit(0);
  }
})();

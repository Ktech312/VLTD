// Wishlist / Pull List / Following on a phone (RB67d): fit (no sideways scroll), the controls reachable, screenshots of each view and the add sheet. Uses the wants already on the QA account.
//   AUDIT_MANIFEST=<manifest> node rb67d-watchlist-phone.cjs <label> [--base=...]
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session, man } = T;
const m = man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = T.R("RB67");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [], notes: {} };
(async () => {
  let S;
  const ck = (ok, control, expected, actual, page) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page: page || "/watchlist (phone)", control, expected, actual: String(actual).slice(0, 600), evidence: "", impact: "wishlist", repro: "" }); };
  const clickStart = (text, scope = "document") => S.evaluate(`(() => { const root = ${scope} || document; const el = [...root.querySelectorAll('button,a,[role="menuitem"]')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.replace(/\\s+/g, ' ').trim().startsWith(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`);
  const overflow = () => S.evaluate(`({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, bodySw: document.body.scrollWidth })`);
  try {
    for (const [w, h] of [[390, 800], [320, 700]]) {
      S = await session("owner", { width: w, height: h, mobile: true });
      await S.visit("/watchlist"); await sleep(5000);
      let o = await overflow();
      ck(o.sw <= o.iw + 1, `Wishlist fits a ${w}px phone without sideways scrolling`, "no horizontal overflow", JSON.stringify(o));
      await S.jshot(`rb67d-${LABEL}-${w}-wishlist`);
      await clickStart("Pull List", `document.querySelector('[data-testid="watchlist-controls"]')`); await sleep(900);
      o = await overflow(); ck(o.sw <= o.iw + 1, `Pull List fits ${w}px`, "no overflow", JSON.stringify(o));
      await S.jshot(`rb67d-${LABEL}-${w}-pull`);
      await clickStart("Following", `document.querySelector('[data-testid="watchlist-controls"]')`); await sleep(900);
      o = await overflow(); ck(o.sw <= o.iw + 1, `Following fits ${w}px`, "no overflow", JSON.stringify(o));
      await S.jshot(`rb67d-${LABEL}-${w}-following`);
      await clickStart("Wishlist", `document.querySelector('[data-testid="watchlist-controls"]')`); await sleep(700);
      // open the first row's details, then the add sheet
      await S.evaluate(`(() => { const r = document.querySelector('[data-testid="want-row"]'); const b = r && r.querySelector('button[aria-expanded]'); if (b) b.click(); return !!b; })()`); await sleep(900);
      o = await overflow(); ck(o.sw <= o.iw + 1, `an opened row fits ${w}px`, "no overflow", JSON.stringify(o));
      await S.jshot(`rb67d-${LABEL}-${w}-row-open`);
      await clickStart("Add"); await sleep(900);
      o = await overflow(); ck(o.sw <= o.iw + 1, `the Add sheet fits ${w}px`, "no overflow", JSON.stringify(o));
      const reach = await S.evaluate(`(() => { const d = document.querySelector('[role="dialog"]'); if (!d) return null; const btns = [...d.querySelectorAll('button')].filter((b) => /^(Add to wishlist|Cancel)$/.test(b.textContent.trim())); d.scrollTop = d.scrollHeight; return btns.map((b) => { const rr = b.getBoundingClientRect(); return [b.textContent.trim(), Math.round(rr.height), rr.bottom <= window.innerHeight + 1]; }); })()`);
      ck(reach && reach.length === 2 && reach.every((x) => x[2]), `the sheet's buttons can be scrolled to and reached on ${w}px`, "both visible after scrolling", JSON.stringify(reach));
      await S.jshot(`rb67d-${LABEL}-${w}-add-sheet`);
      await S.close(); S = null;
    }
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String((e && e.stack) || e).slice(0, 700); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb67d-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS " : "FAIL ") + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
    process.exit(0);
  }
})();

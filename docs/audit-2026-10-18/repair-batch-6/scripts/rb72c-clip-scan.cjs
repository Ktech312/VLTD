// Is anything on the Wishlist, Pull List, Following, an opened row, the Add / Follow / Checklist sheets wider than the phone screen? (RB72c)
// The page-level "sideways scroll" test cannot see this (the page hides overflow), so every visible element's right edge is compared with the viewport,
// ignoring anything inside a region that is meant to scroll sideways.
//   AUDIT_MANIFEST=<manifest> node rb72c-clip-scan.cjs <label>
const path = require("path");
const fs = require("fs");
const T = require(path.join(__dirname, "..", "..", "scripts", "audit-s-add-lib.cjs"));
const { sleep, session } = T;
const LABEL = process.argv[2] || "run";
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const SCAN = `(() => {
  const vw = innerWidth; const bad = [];
  const scrollable = (e) => { for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth) return true; } return false; };
  for (const e of document.querySelectorAll('main *, [role="dialog"] *')) {
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (r.right > vw + 1 && !scrollable(e)) bad.push({ tag: e.tagName.toLowerCase(), cls: String(e.className).slice(0, 50), text: (e.innerText || '').replace(/\s+/g, ' ').slice(0, 40), right: Math.round(r.right), width: Math.round(r.width) });
  }
  return { vw, count: bad.length, sample: bad.slice(0, 6) };
})()`;
(async () => {
  const out = { label: LABEL, results: {} };
  for (const w of [390, 360, 320]) {
    const S = await session("owner", { width: w, height: 844, mobile: true });
    await S.visit("/watchlist"); await sleep(5000);
    const click = (label) => S.evaluate(`(() => { const b = [...document.querySelectorAll('button,a,[role="tab"]')].find((x) => x.getBoundingClientRect().width > 0 && x.textContent.replace(/\\s+/g, ' ').trim().startsWith(${JSON.stringify(label)})); if (b) { b.click(); return true; } return false; })()`);
    const scan = async (name) => { await sleep(1500); out.results[`${w}:${name}`] = await S.evaluate(SCAN); };
    await scan("wishlist");
    await click("Pull List"); await scan("pull-list");
    await click("Following"); await scan("following");
    await click("Follow"); await scan("follow-sheet"); await click("Cancel"); await sleep(600);
    await click("Wishlist");
    await S.evaluate(`(() => { const r = [...document.querySelectorAll('[data-testid="want-row"]')].find((x) => x.innerText.includes('Prizm')); const b = r && (r.querySelector('button[aria-expanded]') || r.querySelector('button')); if (b) b.click(); return !!b; })()`);
    await scan("row-open");
    await S.close();
  }
  fs.writeFileSync(path.join(EV, `rb72c-${LABEL}.json`), JSON.stringify(out, null, 1));
  for (const [k, v] of Object.entries(out.results)) console.log(k, "clipped elements:", v.count, v.count ? JSON.stringify(v.sample.slice(0, 3)) : "");
  process.exit(0);
})();

// Touch-target check of the live app (vltd.app) as an isolated synthetic collector, in Chrome phone emulation (not a physical phone).
// For every on-screen control on Home, Vault, Exhibitions, Discover, Insights (scrolled end to end), plus the More sheet and the Add chooser,
// it probes with elementFromPoint how far the control really responds to a tap from its centre (up, down, left, right), so an enlarged hit area
// (the phone-compact pills draw a 44 px area behind a 32 px pill) and an area stolen by a neighbour both show up in the numbers.
//   AUDIT_MANIFEST=<qa manifest> TUT_WORK=<dir> node touch-targets.cjs [outFile]
const fs = require("fs"), path = require("path");
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, T } = require(GUIDE + "/lib.cjs");
const sleep = T.sleep;
const OUT = process.argv[2] || path.join(__dirname, "touch-targets-report.json");
const WIDTHS = (process.env.WIDTHS || "390,360,320").split(",").map(Number);
const PAGES = [["home", "/dashboard"], ["vault", "/vault"], ["exhibitions", "/museum"], ["discover", "/discover"], ["insights", "/portfolio"]];

const measure = `(() => {
  const out = [];
  const sc = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.clientHeight > 300).sort((a, b) => b.clientHeight - a.clientHeight)[0] || document.scrollingElement;
  const bar = document.querySelector('nav[aria-label="Main navigation"]');
  const els = [...document.querySelectorAll('button, a[href], select, input:not([type=hidden]), [role=button], [role=menuitem], [role=tab], summary')];
  const MAX = 40;
  for (const e of els) {
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 1 || cy < 1 || cx > innerWidth - 1 || cy > innerHeight - 1) continue;
    const hit = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === e || e.contains(t)); };
    if (!hit(cx, cy)) continue;
    let up = 0, down = 0, left = 0, right = 0;
    while (up < MAX && hit(cx, cy - up - 1)) up++;
    while (down < MAX && hit(cx, cy + down + 1)) down++;
    while (left < MAX && hit(cx - left - 1, cy)) left++;
    while (right < MAX && hit(cx + right + 1, cy)) right++;
    const label = ((e.innerText || e.getAttribute('aria-label') || e.getAttribute('title') || e.tagName) + '').trim().replace(/\\s+/g, ' ').slice(0, 34);
    out.push({
      label, tag: e.tagName, compact: /max-md:h-8/.test(String(e.className)), inBar: !!(bar && bar.contains(e)),
      visual: [Math.round(r.width), Math.round(r.height)], hit: [left + right + 1, up + down + 1],
      absTop: Math.round(r.top + (sc ? sc.scrollTop : 0)), x: Math.round(r.left),
    });
  }
  return { out, scrollTop: sc ? sc.scrollTop : 0, max: sc ? sc.scrollHeight - sc.clientHeight : 0, ch: sc ? sc.clientHeight : innerHeight };
})()`;
const scrollTo = (y) => `(() => { const sc = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.clientHeight > 300).sort((a, b) => b.clientHeight - a.clientHeight)[0] || document.scrollingElement; sc.scrollTop = ${y}; return sc.scrollTop; })()`;

(async () => {
  const R = await start({ scene: "touch-targets", phone: true, camera: false });
  const { S } = R; const all = [];
  try {
    for (const w of WIDTHS) {
      await S.send("Emulation.setDeviceMetricsOverride", { width: w, height: Math.round(w * 2.165), deviceScaleFactor: 2, mobile: true });
      for (const [name, url] of PAGES) {
        await R.goto(url); await sleep(2500);
        const seen = new Map(); let y = 0, guard = 0;
        for (;;) {
          await S.evaluate(scrollTo(y)); await sleep(450);
          const m = await S.evaluate(measure);
          for (const c of m.out) { const k = [c.label, c.tag, c.absTop, c.x].join("|"); if (!seen.has(k)) seen.set(k, c); }
          if (y >= m.max || ++guard > 30) break;
          y = Math.min(m.max, y + Math.round(m.ch * 0.7));
        }
        const rows = [...seen.values()];
        all.push({ w, page: name, rows });
        const small = rows.filter((c) => c.hit[1] < 43 || c.hit[0] < 43);
        console.log(`${w} ${name.padEnd(11)} controls=${rows.length} compact=${rows.filter((c) => c.compact).length} under44=${small.length}`);
      }
      // More sheet and Add chooser
      for (const [name, sel] of [["more-sheet", 'button[aria-label="More categories"]'], ["add-chooser", 'button[aria-label="Add item to vault"]']]) {
        await R.goto("/dashboard"); await sleep(2000);
        await S.evaluate(`document.querySelector('${sel}').click()`); await sleep(900);
        const m = await S.evaluate(measure);
        const rows = m.out.filter((c) => !c.inBar || /More|Add/.test(c.label));
        all.push({ w, page: name, rows: m.out });
        console.log(`${w} ${name.padEnd(11)} controls=${m.out.length}`);
        await S.evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await sleep(400);
      }
    }
  } catch (e) { console.log("SCRIPT ERROR:", e.message); }
  fs.writeFileSync(OUT, JSON.stringify(all, null, 1));
  await R.close();
  process.exit(0);
})();

// Phone tap targets: the EFFECTIVE tappable size of every control (what a finger actually hits, including invisible hit-area
// overlays), found by probing which element receives a tap around the control. Also reports the visible size, so a change can be
// shown to leave the visible chips alone. Synthetic QA account, 390 px emulated phone.
//   node ui-targets.cjs <label> [--base=http://localhost:3000]
const fs = require("fs");
const path = require("path");
const { session, qa, sleep } = require("./ui-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3000").slice(7);
const LABEL = process.argv[2] || "targets";
const MIN = 44;
const PAGES = [["home", "/dashboard"], ["vault", "/vault"], ["item", "/vault/item/qa_ui_" + qa.stamp + "_2"], ["capture", "/capture"], ["quick", "/vault/quick"], ["exhibitions", "/museum"], ["lounge", "/community-board"], ["discover", "/discover"], ["account", "/account"]];

const probe = `(() => {
  const out = [];
  const sel = 'a[href], button, [role=button], [role=tab], select, input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]), summary';
  const els = [...document.querySelectorAll(sel)];
  const hit = (el, x, y) => { const t = document.elementFromPoint(x, y); return !!t && (t === el || el.contains(t)); };
  for (const el of els) {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    let r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    // inline text links inside a sentence are not tap-target controls
    if (el.tagName === 'A' && cs.display === 'inline' && el.closest('p, li, span') && el.closest('p, li')) continue;
    if (el.closest('nextjs-portal') || el.closest('[data-nextjs-dev-tools-button]')) continue;
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
    if (!hit(el, cx, cy)) continue; // covered by something else at its centre
    const scan = (dx, dy) => { let n = 0; for (let s = 1; s <= 60; s++) { const x = cx + dx * s, y = cy + dy * s; if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) break; if (!hit(el, x, y)) break; n = s; } return n; };
    const up = scan(0, -1), down = scan(0, 1), left = scan(-1, 0), right = scan(1, 0);
    const w = left + right + 1, h = up + down + 1;
    // is any of the control's own visible area taken by a different control's invisible overlay?
    let stolen = '';
    for (const [fx, fy] of [[0.15, 0.2], [0.85, 0.2], [0.15, 0.8], [0.85, 0.8], [0.5, 0.2], [0.5, 0.8]]) {
      const px = r.left + r.width * fx, py = r.top + r.height * fy;
      if (px < 0 || py < 0 || px >= innerWidth || py >= innerHeight) continue;
      const top = document.elementFromPoint(px, py);
      if (top && !el.contains(top) && !top.contains(el)) { const owner = top.closest('a[href], button, input, select, [role=button]'); if (owner && owner !== el) { stolen = (owner.getAttribute('aria-label') || owner.textContent || owner.tagName).trim().slice(0, 24); break; } }
    }
    out.push({ stolen, t: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.tagName).trim().replace(/\\s+/g, ' ').slice(0, 34), tag: el.tagName.toLowerCase(), vw: Math.round(r.width), vh: Math.round(r.height), hw: w, hh: h });
  }
  return out;
})()`;

(async () => {
  const OUT = path.join(__dirname, "targets-" + LABEL + ".json"); const all = {};
  const S = await session(BASE, { width: 390, height: 844, mobile: true });
  try {
    for (const [name, p] of PAGES) {
      await S.go(p);
      await S.waitFor("document.body && document.body.innerText.length > 150", 40000, name).catch(() => {});
      await sleep(3500);
      const res = await S.evaluate(probe);
      all[name] = res;
      const small = res.filter((x) => x.hw < MIN || x.hh < MIN);
      console.log(`== ${name}: ${res.length} controls, ${small.length} with a tappable area under ${MIN}px in some direction`);
      for (const x of small) console.log(`   ${x.tag} "${x.t}" visible ${x.vw}x${x.vh} tappable ${x.hw}x${x.hh}`);
    }
  } finally { await S.close(); }
  fs.writeFileSync(OUT, JSON.stringify(all, null, 1));
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });

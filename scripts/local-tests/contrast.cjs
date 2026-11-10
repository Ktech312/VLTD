// Contrast of the text on actionable controls as RENDERED. For each visible control the background is read from the actual pixels of a screenshot (a strip just inside the control's top and bottom edges),
// so gradients, translucent fills and theme backgrounds are measured as the person sees them; the text colour is the control's own computed colour. In every appearance, 3 screens per page,
// including selected and disabled controls (disabled ones are listed but not failed, WCAG exempts them). Large text (24px, or 19px bold) needs 3:1, other text 4.5:1. Controls over photos are not measured.
// Usage: node scripts/local-tests/contrast.cjs [route,route,...]   (needs the local build + simulator; uses sharp from node_modules to read pixels)
const L = require("./lib.cjs"); const { sleep, check, sim } = L; const sharp = require("sharp");
const THEMES = ["deep-vault", "midnight-gradient", "warm-gold-haze", "steel-light", "cloud-gradient", "pearl-light"];
const ROUTES = (process.argv[2] ? process.argv[2].split(",") : ["dashboard", "vault", "vault/add", "vault/item/sim_item_1", "vault/item/sim_pub_1", "portfolio", "museum", "discover", "account", "watchlist"]).map((r) => "/" + r.replace(/^\/+/, ""));
const lum = (r, g, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const x = lum(...a), y = lum(...b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const probe = `(() => { const res = []; const els = [...document.querySelectorAll("button, a[href], [role=button], [role=tab], [role=switch], input:not([type=hidden]):not([type=file]):not([type=checkbox]), select")];
  for (const e of els) { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (r.width < 24 || r.height < 18 || cs.visibility === "hidden" || cs.display === "none" || r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const hit = document.elementFromPoint(cx, cy); if (!hit || !(e === hit || e.contains(hit))) continue;
    const text = (e.tagName === "INPUT" || e.tagName === "SELECT" ? (e.value || e.placeholder || "") : (e.innerText || "")).trim().split(String.fromCharCode(10))[0].slice(0, 28); if (!text) continue;
    const tw = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, null); let tn = null, node; while ((node = tw.nextNode())) { if ((node.nodeValue || "").trim()) { tn = node; break; } } const holder = tn ? tn.parentElement : e; const hs = getComputedStyle(holder); /* the element that actually holds the words, not the button around it */ const m = /rgba?\\(([^)]+)\\)/.exec(hs.color); if (!m) continue; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number);
    const hasPhoto = !!e.querySelector("img, picture, canvas, video") || (cs.backgroundImage && /url\\(/.test(cs.backgroundImage)); if (hasPhoto) continue;
    const px = parseFloat(hs.fontSize), bold = parseInt(hs.fontWeight, 10) >= 700;
    res.push({ text, x: r.left, y: r.top, w: r.width, h: r.height, fg: [p[0], p[1], p[2], p.length > 3 ? p[3] : 1], large: px >= 24 || (px >= 18.66 && bold), disabled: e.disabled === true || e.getAttribute("aria-disabled") === "true" || /vltd-disabled/.test(e.className), selected: e.getAttribute("aria-pressed") === "true" || e.getAttribute("aria-selected") === "true" || e.getAttribute("aria-current") === "page" || /(^| )active( |$)/.test(e.className) }); }
  return JSON.stringify(res); })()`;
function bgOf(img, w, h, ch, c) { // median colour of two thin strips just inside the top and bottom edges of the control
  const px = []; const xs = []; for (let x = Math.floor(c.x + 6); x < c.x + c.w - 6; x += Math.max(2, Math.floor(c.w / 14))) xs.push(x); const ys = c.h < 30 * 1 ? [Math.floor(c.y + 1)] : [Math.floor(c.y + 2), Math.floor(c.y + c.h - 3)]; /* short links: an underline sits in the bottom strip and would read as the text colour */
  for (const y of ys) for (const x of xs) { if (x < 0 || y < 0 || x >= w || y >= h) continue; const i = (y * w + x) * ch; px.push([img[i], img[i + 1], img[i + 2]]); }
  if (px.length < 3) return null; const med = (k) => px.map((v) => v[k]).sort((a, b) => a - b)[Math.floor(px.length / 2)]; return [med(0), med(1), med(2)];
}
(async () => {
  await sim("/__sim/reset"); /* one public item so the Public state of the visibility toggle is measured too */ { const rows = await L.dump("vault_items"); await L.seed({ vault_items: [...rows, { ...rows[1], id: "sim_pub_1", title: "Sim Public Item", is_public: true }] }); }
  const fails = {}; let measured = 0, disabledLow = 0; const dis = [];
  for (const theme of THEMES) { const s = await L.open({ width: 1280, height: 800 });
    try { await s.evaluate(`localStorage.setItem('vltd-theme', ${JSON.stringify(theme)}); true`);
      for (const r of ROUTES) { await s.go(r, 5500); await s.dismiss();
        for (let screen = 0; screen < 3; screen++) { if (screen > 0) { await s.evaluate(`(() => { const sc = document.querySelector(".vltd-content-wrap"); if (sc) sc.scrollBy(0, 700); else window.scrollBy(0, 700); return true; })()`); await sleep(500); }
          const rows = JSON.parse(await s.evaluate(probe)); if (!rows.length) continue; const shot = await s.send("Page.captureScreenshot", { format: "png" }); const { data, info } = await sharp(Buffer.from(shot.data, "base64")).raw().toBuffer({ resolveWithObject: true });
          const scale = info.width / 1280; // device pixels per css pixel
          for (const c of rows) { const bg = bgOf(data, info.width, info.height, info.channels, { x: c.x * scale, y: c.y * scale, w: c.w * scale, h: c.h * scale }); if (!bg) continue; const fgRgb = [c.fg[0], c.fg[1], c.fg[2]].map((v, i) => Math.round(v * c.fg[3] + bg[i] * (1 - c.fg[3]))); const rt = ratio(fgRgb, bg); const need = c.large ? 3 : 4.5; measured++;
            if (c.disabled) { if (rt < 3) { disabledLow++; dis.push([theme, r, c.text, Math.round(rt * 100) / 100]); } continue; }
            if (rt + 0.005 < need) { const k = theme + " " + r; (fails[k] = fails[k] || []).push({ text: c.text, ratio: Math.round(rt * 100) / 100, need, selected: c.selected, bg: bg.join(",") }); } } } }
    } finally { await s.close(); } }
  const total = Object.values(fails).reduce((a, v) => a + v.length, 0);
  console.log("measured", measured, "controls (pixel-sampled); below the limit:", total, "; disabled controls under 3:1:", disabledLow);
  for (const [k, v] of Object.entries(fails)) console.log("  FAIL", k.padEnd(40), v.slice(0, 6).map((x) => x.text + " " + x.ratio + "/" + x.need + (x.selected ? " [selected]" : "") + " bg(" + x.bg + ")").join(" ; "));
  for (const d of dis.slice(0, 8)) console.log("  disabled:", d.join(" | "));
  check("contrast: every measured non-disabled actionable control meets 4.5:1 (3:1 for large text) in all 6 appearances", total === 0, Object.keys(fails).slice(0, 8));
  require("fs").writeFileSync(require("path").join(process.env.TRAFFIC_OUT || __dirname, "contrast-result.json"), JSON.stringify({ measured, total, disabledLow, fails, dis }, null, 1));
  console.log(JSON.stringify(L.results())); process.exit(0);
})();

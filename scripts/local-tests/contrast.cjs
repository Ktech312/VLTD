// Contrast of the text on actionable controls as RENDERED: foreground colour against the colour actually behind it (layers composited), in every supported appearance, including
// disabled and selected controls. Large text (24px, or 19px bold) needs 3:1, other text 4.5:1. Controls over gradients or pictures are listed as "unmeasured", not passed.
// Usage: node scripts/local-tests/contrast.cjs [route,route,...]   (needs the local build + simulator)
const L = require("./lib.cjs"); const { sleep, NL, check, sim } = L;
const THEMES = ["deep-vault", "midnight-gradient", "warm-gold-haze", "steel-light", "cloud-gradient", "pearl-light"];
const ROUTES = (process.argv[2] ? process.argv[2].split(",") : ["dashboard", "vault", "vault/add", "vault/item/sim_item_1", "portfolio", "museum", "discover", "account", "watchlist"]).map((r) => "/" + r.replace(/^\/+/, ""));
const probe = `(() => {
  const parse = (c) => { const m = /rgba?\\(([^)]+)\\)/.exec(c); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (top, bot) => { const a = top.a + bot.a * (1 - top.a); if (a === 0) return { r: 0, g: 0, b: 0, a: 0 }; return { r: (top.r * top.a + bot.r * bot.a * (1 - top.a)) / a, g: (top.g * top.a + bot.g * bot.a * (1 - top.a)) / a, b: (top.b * top.a + bot.b * bot.a * (1 - top.a)) / a, a }; };
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const behind = (el) => { const layers = []; let unmeasured = false; for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.backgroundImage && cs.backgroundImage !== "none") { unmeasured = true; } const bg = parse(cs.backgroundColor); if (bg && bg.a > 0) { layers.push(bg); if (bg.a >= 1) break; } } let base = { r: 255, g: 255, b: 255, a: 1 }; const bodyBg = parse(getComputedStyle(document.body).backgroundColor); if (bodyBg && bodyBg.a > 0) base = bodyBg; for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base); return { color: base, unmeasured }; };
  const res = []; const els = [...document.querySelectorAll("button, a[href], [role=button], [role=tab], [role=switch], input:not([type=hidden]):not([type=file]):not([type=checkbox]), select")];
  for (const e of els) { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (r.width < 8 || r.height < 8 || cs.visibility === "hidden" || cs.display === "none" || r.bottom < 0 || r.top > innerHeight * 3) continue;
    const text = (e.tagName === "INPUT" || e.tagName === "SELECT" ? (e.value || e.placeholder || "") : (e.innerText || "")).trim().split(String.fromCharCode(10))[0].slice(0, 28); if (!text) continue;
    const fg = parse(cs.color); if (!fg) continue; const bg = behind(e); const eff = over(fg, bg.color); const ratioV = ratio(eff, bg.color); const px = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700; const large = px >= 24 || (px >= 18.66 && bold); const need = large ? 3 : 4.5;
    const disabled = e.disabled === true || e.getAttribute("aria-disabled") === "true" || /vltd-disabled/.test(e.className); const selected = e.getAttribute("aria-pressed") === "true" || e.getAttribute("aria-selected") === "true" || e.getAttribute("aria-current") === "page" || /(^| )active( |$)/.test(e.className);
    res.push({ text, ratio: Math.round(ratioV * 100) / 100, need, px, disabled, selected, unmeasured: bg.unmeasured }); }
  return JSON.stringify(res); })()`;
(async () => {
  await sim("/__sim/reset"); const fails = {}; let measured = 0, unmeasured = 0, disabledLow = 0; const sample = [];
  for (const theme of THEMES) { const s = await L.open({ width: 1280, height: 900 });
    try { await s.evaluate(`localStorage.setItem('vltd-theme', ${JSON.stringify(theme)}); true`);
      for (const r of ROUTES) { await s.go(r, 5500); await s.dismiss(); const rows = JSON.parse(await s.evaluate(probe));
        for (const x of rows) { if (x.unmeasured) { unmeasured++; continue; } measured++; if (x.disabled) { if (x.ratio < 3) { disabledLow++; sample.push([theme, r, "DISABLED", x.text, x.ratio]); } continue; } if (x.ratio + 0.005 < x.need) { const k = theme + " " + r; (fails[k] = fails[k] || []).push(x); } } }
    } finally { await s.close(); } }
  const total = Object.values(fails).reduce((a, v) => a + v.length, 0); const byText = {}; for (const [k, v] of Object.entries(fails)) for (const x of v) { const key = x.text + " @" + x.ratio + "/" + x.need; (byText[key] = byText[key] || new Set()).add(k.split(" ")[0]); }
  console.log("measured", measured, "controls; unmeasured (gradient/picture behind):", unmeasured, "; below the limit:", total, "; disabled controls under 3:1:", disabledLow);
  for (const [k, v] of Object.entries(fails)) console.log("  FAIL", k.padEnd(40), v.slice(0, 5).map((x) => x.text + " " + x.ratio + "/" + x.need + (x.selected ? " [selected]" : "")).join(" ; "));
  for (const sm of sample.slice(0, 8)) console.log("  disabled:", sm.join(" | "));
  check("contrast: every measured non-disabled actionable control meets 4.5:1 (3:1 for large text) in all 6 appearances", total === 0, Object.keys(byText).slice(0, 10));
  require("fs").writeFileSync(require("path").join(process.env.TRAFFIC_OUT || __dirname, "contrast-result.json"), JSON.stringify({ measured, unmeasured, total, disabledLow, fails }, null, 1));
  console.log(JSON.stringify(L.results())); process.exit(0);
})();

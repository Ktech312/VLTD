// VIS-01: corner radii on real screens vs the locked standard (controls 6px, cards/panels 14px, circles round).
const L = require("./lib.cjs"); const { NL, sleep } = L;
const ROUTES = (process.env.ROUTES || "").split(",").filter(Boolean).map((r) => "/" + r.replace(/^[\/]+/, ""));
const probe = `(() => { const out = []; const vw = innerWidth;
  for (const e of document.querySelectorAll("body *")) { const r = e.getBoundingClientRect(); if (r.width < 14 || r.height < 14 || r.width * r.height === 0) continue; const cs = getComputedStyle(e); if (cs.visibility === "hidden" || cs.display === "none") continue;
    const radii = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius]; if (radii.every((x) => x === "0px")) continue;
    const hasBox = (cs.backgroundColor !== "rgba(0, 0, 0, 0)" || cs.borderTopWidth !== "0px" || cs.boxShadow !== "none"); if (!hasBox && e.tagName !== "IMG") continue;
    const px = radii.map((x) => x.endsWith("%") ? -1 : parseFloat(x)); const maxr = Math.max(...px);
    const tag = e.tagName; const role = e.getAttribute("role") || ""; const control = ["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(tag) || role === "button" || role === "switch" || role === "tab" || (tag === "A" && r.height < 80);
    const isCircle = px.some((x) => x < 0 && parseFloat(radii[px.indexOf(x)]) >= 50) || (Math.abs(r.width - r.height) < 2 && maxr >= Math.min(r.width, r.height) / 2 - 1) || maxr >= 9999 || maxr >= Math.min(r.width, r.height) / 2;
    out.push({ tag, cls: (e.className && e.className.toString ? e.className.toString() : "").slice(0, 60), text: (e.innerText || e.getAttribute("aria-label") || "").trim().split(String.fromCharCode(10))[0].slice(0, 28), w: Math.round(r.width), h: Math.round(r.height), r: maxr, uniform: new Set(radii).size === 1, control, circle: isCircle }); }
  return JSON.stringify(out); })()`;
(async () => { const tally = {}; const outliers = [];
  for (const width of [1280, 390]) { const s = await L.open({ width, height: 900, mobile: width < 500 });
    try { for (const route of ROUTES) { await s.go(route, 6500); await s.dismiss(); const items = JSON.parse(await s.evaluate(probe));
      for (const it of items) { if (it.circle) continue; const kind = it.control ? "control" : (it.w >= 160 && it.h >= 90 ? "panel" : "small"); const want = kind === "control" ? 6 : kind === "panel" ? 14 : null; const key = kind + ":" + it.r; tally[key] = (tally[key] || 0) + 1;
        if (want !== null && ![6, 8, 14].includes(it.r) && it.r > 0) outliers.push({ route, width, kind, r: it.r, tag: it.tag, w: it.w, h: it.h, text: it.text, cls: it.cls }); } } } finally { await s.close(); } }
  console.log("TALLY (kind:radius -> count, circles excluded):", JSON.stringify(Object.fromEntries(Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 18))));
  const seen = new Set(); let shown = 0; for (const o of outliers) { const k = [o.route, o.kind, o.r, o.tag, o.text.slice(0, 14)].join("|"); if (seen.has(k)) continue; seen.add(k); if (shown++ < 60) console.log("OUT", o.width, o.route, o.kind, o.r + "px", o.tag, o.w + "x" + o.h, JSON.stringify(o.text), o.cls.slice(0, 50)); }
  console.log("distinct outliers:", seen.size); process.exit(0); })();

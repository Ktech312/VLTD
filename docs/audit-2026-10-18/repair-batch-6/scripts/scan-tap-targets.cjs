// Lists controls smaller than 40 px (no enlarged hit area) on the phone-size pages RC-31 names. Read-only; production, isolated QA owner.
//   AUDIT_MANIFEST=<manifest> node scan-tap-targets.cjs <label> [route ...]
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
const X = require(path.join(SD, "audit-s-itm-lib.cjs"));
const { sleep, session, admin } = A;
const m = A.man();
const LABEL = process.argv[2] || "run";
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
// With REC=1 each page becomes a result row (RB50): no control under 40 px without an enlarged hit area, and no sideways scroll at 390 px.
const r = process.env.REC ? A.R("RB50") : null;

const SCAN = `(() => {
  const out = []; const seen = new Set();
  document.querySelectorAll('main button, main a[href], main input, main select, main textarea, main [role=button], main [role=switch], main summary, header button, header a[href], nav button, nav a[href]').forEach((e) => {
    // A checkbox or radio inside a <label> is tapped through the label, so the label is what is measured.
    const target = (e.matches('input[type=checkbox], input[type=radio]') && e.closest('label')) || e;
    const r = target.getBoundingClientRect(); const cs = getComputedStyle(e);
    if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') return;
    if (e.closest('[aria-hidden=true]')) return;
    const label = (e.getAttribute('aria-label') || e.innerText || e.value || e.placeholder || e.getAttribute('title') || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
    const after = getComputedStyle(target, '::after');
    const ext = after && after.position === 'absolute' ? (parseFloat(after.height) || 0) : 0;
    const extW = after && after.position === 'absolute' ? (parseFloat(after.width) || 0) : 0;
    const h = Math.max(r.height, ext); const w = Math.max(r.width, extW);
    if (h < 40 || w < 40) {
      const k = label + '|' + Math.round(w) + 'x' + Math.round(h);
      if (!seen.has(k)) { seen.add(k); out.push({ label, w: Math.round(w), h: Math.round(h), tag: e.tagName.toLowerCase(), cls: String(e.className || '').slice(0, 90) }); }
    }
  });
  return out;
})()`;

(async () => {
  let S;
  const result = {};
  try {
    const gal = (await admin.from("galleries").select("id").eq("profile_id", m.personalId).limit(1)).data || [];
    const routes = process.argv.slice(3).length ? process.argv.slice(3) : [
      `/vault/item/${X.ID.sale[0]}`, "/sales", "/vault/for-sale", "/vault/sold", "/goals", "/insurance", "/insurance/packet",
      gal[0] ? `/museum/${gal[0].id}` : "/museum", "/discover", "/events",
    ];
    S = await session("owner", { width: 390, height: 800, mobile: true });
    for (const route of routes) {
      await S.visit(route); await sleep(9000);
      await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('aria-label') || x.innerText || '').trim() === 'Dismiss'); if (b) b.click(); })()").catch(() => {});
      const overflow = await S.evaluate("({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, wrap: (() => { const w = document.querySelector('.vltd-content-wrap'); return w ? w.scrollWidth - w.clientWidth : 0; })(), userScroll: (() => { const w = document.querySelector('.vltd-content-wrap'); if (!w) return false; const ox = getComputedStyle(w).overflowX; return (ox === 'auto' || ox === 'scroll') && w.scrollWidth - w.clientWidth > 1; })() })");
      const small = await S.evaluate(SCAN);
      result[route] = { overflow, small };
      if (r) r.check(small.length === 0 && !overflow.userScroll, { page: route + " | owner, Personal, phone 390 (browser-emulated)", control: "Tap-target size and page width", expected: "every control at least about 40 px (or with an enlarged tap area); no sideways scrolling", actual: small.length + " small controls: " + small.slice(0, 8).map((x) => (x.label || "(no label)") + " " + x.w + "x" + x.h).join("; ") + "; invisible tap area past the edge " + overflow.wrap + "px, page can be scrolled sideways by the user: " + overflow.userScroll, evidence: "", impact: "RC-31", repro: "" });
      console.log(`\n${route}  overflow ${JSON.stringify(overflow)}  small controls: ${small.length}`);
      for (const s of small) console.log(`  ${s.label || "(no label)"} ${s.w}x${s.h}  <${s.tag}> ${s.cls}`);
    }
  } catch (e) { console.error("RUNNER ERROR", e); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `scan-tap-${LABEL}.json`), JSON.stringify(result, null, 1));
    process.exit(0);
  }
})();

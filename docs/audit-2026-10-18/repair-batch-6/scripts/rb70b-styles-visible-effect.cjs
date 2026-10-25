// Does choosing a style visibly change real pages? (RB70b) For Home, Vault and Wishlist, every visible element's computed look (shadow, border, background, text colour, filter)
// is read under Minimal and again under each other style; the number of elements that differ is the visible effect. Read-only (the style is a local, per-browser choice).
//   AUDIT_MANIFEST=<manifest> node rb70b-styles-visible-effect.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session } = T;
const LABEL = process.argv[2] || "run";
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const SNAP = `(() => [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map((e, i) => { const c = getComputedStyle(e); return [i, c.boxShadow, c.borderTopColor + '|' + c.borderTopWidth, c.backgroundColor, c.color, c.filter, c.borderRadius]; }))()`;
const setStyle = (k) => `(() => { localStorage.setItem('vltd_style', '${k}'); window.dispatchEvent(new Event('vltd:style')); return true; })()`;
(async () => {
  const S = await session("owner", { width: 1440, height: 900 });
  const out = { label: LABEL, pages: {} };
  try {
    for (const p of ["/dashboard", "/vault", "/watchlist", "/museum"]) {
      await S.visit(p); await sleep(5000);
      await S.evaluate(setStyle("MINIMAL")); await sleep(600);
      const base = await S.evaluate(SNAP);
      out.pages[p] = { elements: base.length, styles: {} };
      for (const k of ["ENGRAVED", "ROYAL", "NEON_MIRROR", "NEON_PURPLE", "NOIR", "PAPER"]) {
        await S.evaluate(setStyle(k)); await sleep(600);
        const snap = await S.evaluate(SNAP);
        let diff = 0; const fields = { shadow: 0, border: 0, bg: 0, color: 0, filter: 0, radius: 0 };
        for (let i = 0; i < Math.min(base.length, snap.length); i++) {
          const a = base[i], b = snap[i]; let d = false;
          if (a[1] !== b[1]) { fields.shadow++; d = true; } if (a[2] !== b[2]) { fields.border++; d = true; } if (a[3] !== b[3]) { fields.bg++; d = true; }
          if (a[4] !== b[4]) { fields.color++; d = true; } if (a[5] !== b[5]) { fields.filter++; d = true; } if (a[6] !== b[6]) { fields.radius++; d = true; }
          if (d) diff++;
        }
        out.pages[p].styles[k] = { elementsThatChange: diff, share: Math.round((1000 * diff) / Math.max(1, base.length)) / 10 + "%", fields };
      }
      await S.evaluate(setStyle("MINIMAL"));
    }
  } catch (e) { out.error = String((e && e.stack) || e).slice(0, 600); console.error(e); }
  finally { try { await S.evaluate("localStorage.removeItem('vltd_style'); true"); await S.close(); } catch {} fs.writeFileSync(path.join(EV, `rb70b-${LABEL}.json`), JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1)); process.exit(0); }
})();

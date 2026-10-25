// Styles page (/styles): does Apply work for every style, does it persist across pages and a reload, and does Reset to Minimal restore everything? (RB70)
// Isolated QA owner, on production. Nothing is saved except this browser's own local style choice (restored at the end).
//   AUDIT_MANIFEST=<manifest> node rb70-styles-apply-reset.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session } = T;
const LABEL = process.argv[2] || "run";
const r = T.R("RB70");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [], styles: {} };

const PROBE = `(() => {
  const root = document.documentElement; const cs = getComputedStyle(root);
  const pill = [...document.querySelectorAll('button')].find((b) => b.getBoundingClientRect().width > 0);
  const h1 = document.querySelector('h1');
  return {
    cls: [...root.classList].filter((c) => c.startsWith('style-')).join(','),
    ls: localStorage.getItem('vltd_style'),
    accent: cs.getPropertyValue('--accent').trim(),
    shadowPill: cs.getPropertyValue('--shadow-pill').trim(),
    bodyBg: getComputedStyle(document.body).backgroundColor,
    h1Color: h1 ? getComputedStyle(h1).color : null,
    pillBg: pill ? getComputedStyle(pill).backgroundColor : null,
    pillColor: pill ? getComputedStyle(pill).color : null,
    applied: [...document.querySelectorAll('span')].filter((e) => /^\\s*Applied\\s*$/.test(e.textContent)).length,
    current: (document.body.innerText.match(/CURRENT\\s*\\n?\\s*([A-Za-z ]+)/) || [])[1] || null,
  };
})()`;

(async () => {
  const ck = (ok, control, expected, actual, page) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page: page || "/styles", control, expected, actual: String(actual).slice(0, 700), evidence: "", impact: "appearance", repro: "" }); };
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    const labels = { MINIMAL: "Minimal", ENGRAVED: "Engraved", ROYAL: "Royal", NEON_MIRROR: "Neon Mirror", NEON_PURPLE: "Neon Purple", NOIR: "Noir", PAPER: "Paper" };
    await S.visit("/styles"); await sleep(4000);
    const base = await S.evaluate(PROBE);
    out.styles.baseline = base;
    ck(base.cls === "style-minimal" && base.ls === null, "first visit: Minimal is the current style by default", "style-minimal, nothing saved", JSON.stringify(base));
    const clickApply = (label) => S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '') === 'Apply ${label}'); if (!b) return false; b.click(); return true; })()`);
    for (const [key, label] of Object.entries(labels)) {
      if (key === "MINIMAL") continue;
      const clicked = await clickApply(label); await sleep(900);
      const p = await S.evaluate(PROBE);
      out.styles[key] = p;
      const changed = p.accent !== base.accent || p.shadowPill !== base.shadowPill || p.bodyBg !== base.bodyBg || p.h1Color !== base.h1Color || p.pillBg !== base.pillBg;
      ck(clicked && p.cls === `style-${key.toLowerCase()}` && p.ls === key && p.applied === 1, `Apply ${label}: the page takes the style (root class, saved choice, one Applied badge)`, `style-${key.toLowerCase()}, saved ${key}, 1 Applied`, JSON.stringify(p));
      ck(p.accent !== "" && p.accent !== "initial", `Apply ${label}: the accent colour is still a real colour (not blanked)`, "non-empty --accent", JSON.stringify({ accent: p.accent, base: base.accent }));
      out.styles[key].visibleChange = changed;
    }
    // persistence: another page and a full reload
    await clickApply("Neon Mirror"); await sleep(600);
    await S.visit("/dashboard"); await sleep(4000);
    const onHome = await S.evaluate(PROBE);
    ck(onHome.cls === "style-neon_mirror" && onHome.ls === "NEON_MIRROR", "an applied style stays on another page (Home)", "style-neon_mirror", JSON.stringify(onHome));
    await S.jshot(`rb70-${LABEL}-home-neon-mirror`);
    await S.visit("/styles"); await sleep(3500);
    const back = await S.evaluate(PROBE);
    ck(back.cls === "style-neon_mirror" && back.current && /Neon Mirror/i.test(back.current), "after a full reload the Styles page shows the saved style as current", "Neon Mirror current", JSON.stringify(back));
    // Reset
    const resetClicked = await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.getAttribute('title') || '') === 'Reset to Minimal'); if (!b) return false; b.click(); return true; })()`); await sleep(900);
    const reset = await S.evaluate(PROBE);
    out.styles.afterReset = reset;
    ck(resetClicked && reset.cls === "style-minimal" && reset.ls === "MINIMAL" && reset.accent === base.accent && reset.shadowPill === base.shadowPill && reset.bodyBg === base.bodyBg && reset.pillBg === base.pillBg, "Reset to Minimal puts every measured value back to where the first visit was", "same as baseline", JSON.stringify({ reset, base }));
    await S.visit("/dashboard"); await sleep(3500);
    const afterReset = await S.evaluate(PROBE);
    ck(afterReset.cls === "style-minimal" && afterReset.accent === base.accent, "after Reset, other pages are back to normal and stay that way", "style-minimal, baseline accent", JSON.stringify(afterReset));
  } catch (e) { out.error = String((e && e.stack) || e).slice(0, 800); console.error("RUNNER ERROR", e); }
  finally {
    try { await S.evaluate("localStorage.removeItem('vltd_style'); true"); } catch {}
    try { await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb70-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS " : "FAIL ") + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
    process.exit(0);
  }
})();

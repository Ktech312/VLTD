// Do footer links on the phone landing get covered by the install banner? (synthetic beforeinstallprompt)
const A = require("./audit-s-acc-lib.cjs");
const { R } = A; const r = R("ACC");
(async () => {
  const S = await A.session("visitor", { width: 390, height: 844, mobile: true });
  try {
    await S.visit("/"); await A.sleep(1500);
    await S.evaluate("(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = async () => {}; e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); })()");
    await A.sleep(800);
    const out = [];
    for (const lab of ["TCG", "Sports", "Pop Culture"]) {
      const expr = `[...document.querySelectorAll('footer a')].find((a) => a.innerText.trim() === ${JSON.stringify(lab)})`;
      const rc = await S.evaluate(A.RECT_JS(expr)); await A.sleep(600);
      const rc2 = await S.evaluate(A.RECT_JS(expr));
      const hit = await S.evaluate(`(() => { const e = document.elementFromPoint(${rc2.x}, ${rc2.y}); const a = e && e.closest('a'); return e ? { tag: e.tagName, text: (e.innerText || e.getAttribute('aria-label') || '').slice(0, 30), isLink: !!a && a.innerText.trim() === ${JSON.stringify(lab)} } : null; })()`);
      out.push({ lab, hit });
    }
    console.log(JSON.stringify(out));
    await S.jshot("acc-landing-390-footer-banner");
    const covered = out.filter((o) => !o.hit || !o.hit.isLink);
    r.check(covered.length === 0, { page: "/ | visitor | 390 (browser-emulated touch)", control: "Footer links TCG / Sports / Pop Culture while the 'Add to Home Screen' banner is showing", expected: "every footer link can be tapped; the install banner does not sit on top of them", actual: JSON.stringify(out), evidence: "shots/acc-landing-390-footer-banner.jpg", impact: "usability", repro: "Phone, landing page, banner showing; scroll to the footer; tap TCG" });
  } finally { await S.close(); }
})();

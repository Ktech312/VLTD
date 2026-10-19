const L = require("./audit-s-gin-lib.cjs"); const { R, sleep } = L;
(async () => {
  const S = await L.session("owner", { width: 390, height: 844, mobile: true });
  try {
    await S.visit("/insurance"); await S.waitFor("document.querySelectorAll('table tbody tr').length > 5", 60000); await sleep(2000);
    const g = await S.evaluate(`(() => { const sz = (e) => { const r = e.getBoundingClientRect(); return Math.round(r.width) + 'x' + Math.round(r.height); }; const cb = document.querySelector('table input[type=checkbox]'); const lk = document.querySelector('a[href^="/insurance/item?id="]'); const incl = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Include all'); const ex = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Exclude $0 value'); const see = [...document.querySelectorAll('a')].find((a) => /See what is missing/.test(a.textContent)); return { checkbox: sz(cb), perItemLink: sz(lk), includeAll: sz(incl), exclude0: sz(ex), seeMissing: sz(see) }; })()`);
    const h = (s) => Number(s.split("x")[1]);
    R.check(h(g.checkbox) >= 44 && h(g.perItemLink) >= 44, { page: "/insurance | owner, Personal | 390x844 browser-emulated phone", control: "Row Include checkbox and 'Per-item sheet' link tap targets", expected: "At least 44x44 px (or a larger tappable row)", actual: `checkbox ${g.checkbox}, 'Per-item sheet' link ${g.perItemLink}, Include all ${g.includeAll}, Exclude $0 value ${g.exclude0}, 'See what is missing' ${g.seeMissing}`, evidence: "shots/gin-phone-insurance-inventory.jpg", impact: "usability", repro: "Measure the controls on /insurance at 390px." });
  } finally { await S.close(); }
})();

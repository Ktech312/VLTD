const V = require("./audit-s-vlt-lib.cjs");
const { sleep } = V;
const snap = (S) => S.evaluate(`(() => { const cs = (el) => el ? getComputedStyle(el) : null; const root = document.documentElement; const gold = [...document.querySelectorAll('main a span')].find((x) => /Cost breakdown/.test(x.textContent)); const h = document.querySelector('main section h2'); const q = document.querySelector('a[href="/vault/quick"]'); const dots = [...document.querySelectorAll('button[aria-label^="Slide"]')].length; return { attr: root.getAttribute('data-seasonal'), inlineVars: ['--seasonal-accent','--seasonal-accent-secondary','--seasonal-bg-tint'].map((v) => root.style.getPropertyValue(v)).join('|'), themeGold: getComputedStyle(root).getPropertyValue('--theme-gold').trim(), accent: getComputedStyle(root).getPropertyValue('--accent').trim(), costLink: gold && cs(gold).color, quickBg: q && cs(q).backgroundColor + ' / ' + cs(q).borderColor, prompt: /Switch app theme/.test(document.body.innerText), ls: localStorage.getItem('vltd_theme_overrides') }; })()`);
(async () => {
  for (const choice of ["none", "No", "Yes"]) {
    const S = await V.session("owner");
    try {
      await S.visit("/dashboard"); await S.evaluate("localStorage.removeItem('vltd_theme_overrides'); true"); await S.visit("/dashboard"); await sleep(1500);
      const before = await snap(S);
      if (choice !== "none") { await V.clickEl(S, `[...document.querySelectorAll('.vltd-dark-surface button')].find((b) => b.textContent.trim() === '${choice}')`, { js: true }); await sleep(1000); }
      const after = await snap(S);
      await S.visit("/dashboard"); await sleep(1500); const reload = await snap(S);
      console.log(choice, JSON.stringify({ before, after, reload }, null, 1));
    } finally { await S.close(); }
  }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });

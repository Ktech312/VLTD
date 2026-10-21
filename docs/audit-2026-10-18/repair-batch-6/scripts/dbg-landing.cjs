const path = require("path");
const SD = path.join(__dirname, "..", "..", "scripts");
const A = require(path.join(SD, "audit-s-acc-lib.cjs"));
(async () => {
  const S = await A.session("visitor", { width: 390, height: 844, mobile: true });
  await S.visit("/"); await A.sleep(5000);
  await S.evaluate("window.dispatchEvent(new Event('beforeinstallprompt')); true"); await A.sleep(1000);
  console.log(JSON.stringify(await S.evaluate(`(() => {
    const pill = [...document.querySelectorAll('div')].find((d) => /Add to Home Screen/.test(d.innerText||'') && getComputedStyle(d).position === 'fixed');
    const scrollers = [...document.querySelectorAll('*')].filter((e) => { const cs = getComputedStyle(e); return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && e.scrollHeight > e.clientHeight + 5; }).map((e) => e.tagName + '.' + String(e.className).slice(0,40) + ' sh=' + e.scrollHeight + ' ch=' + e.clientHeight);
    return { bodyPad: document.body.style.paddingBottom, docSH: document.documentElement.scrollHeight, winH: innerHeight, bodyH: document.body.getBoundingClientRect().height, pill: pill ? pill.getBoundingClientRect().toJSON() : null, scrollers, spaceVar: getComputedStyle(document.documentElement).getPropertyValue('--pwa-banner-space') };
  })()`)));
  await S.evaluate("window.scrollTo(0, document.documentElement.scrollHeight); true"); await A.sleep(800);
  console.log(JSON.stringify(await S.evaluate(`(() => ['TCG','Sports','Pop Culture'].map((l) => { const a = [...document.querySelectorAll('a')].filter((x) => (x.innerText||'').trim() === l).pop(); if (!a) return { l, none: true }; const r = a.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2); return { l, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), hit: t ? t.tagName + ':' + (t.innerText||'').trim().slice(0,20) : null }; }))()`)));
  await S.close(); process.exit(0);
})();

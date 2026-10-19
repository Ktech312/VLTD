const A = require("./audit-s-acc-lib.cjs");
(async () => {
  const S = await A.session("owner", { width: 1440, height: 900 });
  try {
    for (const q of ["zzzznomatch", "Album 17", "QA Album 17 - Original Motion Picture Soundtrack"]) {
      await S.visit("/vault?q=" + encodeURIComponent(q));
      for (const wait of [0, 4000, 8000]) {
        await A.sleep(wait === 0 ? 0 : 4000);
        const x = await S.evaluate(`({ url: location.href.slice(-60), cards: document.querySelectorAll('a[href^="/vault/item/"]').length, inputs: [...document.querySelectorAll('input')].filter(i=>i.getBoundingClientRect().width>1).map(i=>i.placeholder+'='+i.value), pills: [...document.querySelectorAll('main button')].filter(b=>/clear|reset|filter/i.test(b.innerText)).map(b=>b.innerText.trim()).slice(0,5), counts: (document.body.innerText.match(/\\d+ (items?|results?)[^\\n]{0,40}/g)||[]).slice(0,4) })`);
        console.log(q.slice(0, 20), wait, JSON.stringify(x));
      }
      await S.jshot("acc-dbg-vaultq-" + q.slice(0, 6).replace(/\W/g, "_"));
    }
    // account menu
    await S.visit("/dashboard");
    await A.clickSel(S, 'button[aria-label="Account menu"]', {}); await A.sleep(900);
    const t = await S.evaluate(`[...document.querySelectorAll('a[href],button')].filter(e=>e.getBoundingClientRect().width>1 && /Settings|Appearance|Invite|Sign Out|Switch/.test(e.innerText)).map(e=>e.tagName+':'+e.innerText.replace(/\\s+/g,' ').trim().slice(0,40)+'|'+(e.closest('[class*=fixed]')?'fixed':'nofixed')+'|'+e.parentElement.className.slice(0,30))`);
    console.log(t);
  } finally { await S.close(); }
})();

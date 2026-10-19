const L = require("./audit-s-gin-lib.cjs"); const { clickEl, sleep } = L;
(async () => {
  const S = await L.session("owner");
  try {
    await L.gotoGoals(S);
    await clickEl(S, `[...document.querySelectorAll('main button')].filter((b) => b.querySelector('h2')).find((b) => /Spider-Man/.test(b.textContent))`, { js: true }); await sleep(500);
    const f = () => S.evaluate(`(() => { const sec=[...document.querySelectorAll('aside section')].find(s=>/Items In Goal/i.test(s.textContent)); return { imgs: sec.querySelectorAll('img').length, tiles: [...sec.querySelectorAll('div')].map(d=>d.textContent.trim()).filter(t=>t.startsWith('+')), btn: [...sec.querySelectorAll('button')].map(b=>b.textContent.trim()), head: sec.querySelector('h3').textContent.trim() }; })()`);
    console.log("before", JSON.stringify(await f()));
    await clickEl(S, `[...document.querySelectorAll('aside button')].find((b) => /View all|Show less/.test(b.textContent))`, { js: true }); await sleep(500);
    console.log("after", JSON.stringify(await f()));
  } finally { await S.close(); }
})();

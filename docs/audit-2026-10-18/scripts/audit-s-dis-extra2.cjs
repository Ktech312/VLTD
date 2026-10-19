const C = require("./audit-s-dis-common.cjs");
const { R, sleep, clean } = C; const r = R("DIS"); const sd = C.seed(); const T = sd.titles;
(async () => {
  const O = await C.session("owner");
  await O.visit("/discover"); await sleep(4000);
  await C.typeInto(O, "main input", "Alpha Sports");
  await C.click(O, `([...document.querySelectorAll('[data-testid=featured-rooms] button')].find((x) => x.innerText.includes(${JSON.stringify(T.A)})))`); await sleep(700);
  const thumbs = await O.evaluate("[...document.querySelectorAll('aside img')].filter((i) => i.parentElement.className.indexOf('h-20') >= 0).map((i) => i.complete && i.naturalWidth > 0)");
  const t = await O.evaluate("(() => { const a = document.querySelector('aside'); const x = a.innerText.replace(/\\s+/g, ' '); const k = x.indexOf('FEATURED ITEMS'); return a.querySelector('h2').textContent + ' | ' + x.slice(k, k + 60); })()");
  r.check(thumbs.filter(Boolean).length === 4 && /\+1/.test(t), { page: "/discover | owner", control: "Detail panel 'Featured items' for the 5-item Alpha room", expected: "four item pictures that load, and '+1' for the fifth", actual: `${thumbs.filter(Boolean).length} loaded of ${thumbs.length} pictures; ${t}`, evidence: await O.jshot("dis-panel-featured-items"), impact: "misleading result", repro: "Search the Alpha room; select it" });
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });

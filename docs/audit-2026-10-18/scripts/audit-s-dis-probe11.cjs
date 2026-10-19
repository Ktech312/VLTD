const C = require("./audit-s-dis-common.cjs");
(async () => {
  const V = await C.session("visitor"); await V.visit("/styles"); await C.sleep(2500);
  console.log(JSON.stringify(await V.evaluate("[...document.querySelectorAll('main button')].filter((b) => b.textContent.trim() === 'Apply').map((b) => { const out = []; let el = b; for (let i = 0; i < 5; i++) { el = el.parentElement; out.push(el.tagName + ':' + el.innerText.replace(/\\s+/g, ' ').slice(0, 25)); } return out; })")));
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });

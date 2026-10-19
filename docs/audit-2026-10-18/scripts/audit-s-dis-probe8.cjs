const C = require("./audit-s-dis-common.cjs");
(async () => {
  const S = await C.session("visitor");
  await S.visit("/events"); await C.sleep(4000);
  console.log(await S.evaluate("[...document.querySelectorAll('section')].map((s) => s.innerText.replace(/\s+/g, ' ').slice(0, 50) + ' | len ' + s.innerText.length)"));
  const el = await S.evaluate("(() => { const d = [...document.querySelectorAll('div')].find((e) => e.children.length === 0 && /Event Highlight/.test(e.textContent)); const sec = d.closest('section'); return [sec.tagName, sec.innerText.length, sec.querySelector('h2') ? sec.querySelector('h2').textContent : null, !!sec.querySelector('h3'), sec.querySelector('h2, h3') && sec.querySelector('h2, h3').outerHTML.slice(0, 120)]; })()");
  console.log(el);
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });

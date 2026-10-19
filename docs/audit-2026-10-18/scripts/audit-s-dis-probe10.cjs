const C = require("./audit-s-dis-common.cjs");
(async () => {
  const V = await C.session("visitor"); await V.visit("/learn"); await C.sleep(2500);
  const sub = `([...document.querySelectorAll('form button')].find((b) => /Subscribe/.test(b.textContent)))`;
  const msg = () => V.evaluate("(() => { const f = document.querySelector('form input[type=email]').closest('form'); return f ? f.innerText.replace(/\s+/g, ' ') + ' | valid=' + f.querySelector('input').validity.valid + ' val=' + f.querySelector('input').value : 'noform'; })()");
  console.log("0", await msg());
  await C.click(V, sub); await C.sleep(500); console.log("1 empty", await msg());
  await C.typeInto(V, "form input[type=email]", "not-an-email"); console.log("2 typed", await msg());
  await C.click(V, sub); await C.sleep(500); console.log("3 clicked", await msg());
  console.log(await V.evaluate("document.querySelector('form').noValidate"));
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });

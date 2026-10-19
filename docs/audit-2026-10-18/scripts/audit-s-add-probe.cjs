// probe: list every field on a form page after opening all accordions
const T = require("./audit-s-add-lib.cjs");
const { session, sleep } = T;
const P = process.argv[2] || "/capture"; const kind = process.argv[3] || "owner"; const w = Number(process.argv[4] || 1440);
(async () => {
  const S = await session(kind, { width: w, height: w < 600 ? 844 : 900, mobile: w < 600 });
  try {
    await S.visit(P);
    for (const n of [2,3,4,5]) { await T.click(S, "[...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('" + n + "'))"); await sleep(300); }
    await sleep(500);
    const f = await S.evaluate(`[...document.querySelectorAll('input,select,textarea')].map((e) => { const lab = e.id && document.querySelector('label[for="' + e.id + '"]'); const prev = e.closest('div') && e.closest('div').querySelector('label'); return { tag: e.tagName.toLowerCase(), type: e.type, id: e.id, name: e.name, ph: e.placeholder, aria: e.getAttribute('aria-label'), label: (lab || prev || {}).textContent, min: e.min, max: e.max, maxlen: e.maxLength, step: e.step, req: e.required, vis: e.getBoundingClientRect().width > 0, opts: e.tagName === 'SELECT' ? [...e.options].map((o) => o.text.trim()).slice(0, 14).join('|') : undefined }; })`);
    for (const x of f) console.log(JSON.stringify(x));
    console.log((await T.text(S)).slice(0, 1500));
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });

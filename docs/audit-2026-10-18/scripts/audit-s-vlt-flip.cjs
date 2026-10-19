const X = require("./audit-s-vlt-vlib.cjs");
const { R, sleep, squash, drag } = X; const r = R("VLT");
const counter = async (S) => S.evaluate("(() => { const t = document.body.innerText.replace(/\\s+/g, ' '); const m = [...t.matchAll(/(\\d+) \\/ (\\d+)/g)].map((x) => x[0]); return m; })()");
(async () => {
  const S = await X.session("owner");
  try {
    await S.visit("/vault"); await S.evaluate("localStorage.setItem('vltd_vault_view_mode', 'flip'); sessionStorage.clear(); true"); await S.visit("/vault");
    const card = await S.evaluate("(() => { const imgs = [...document.querySelectorAll('main img')].filter((i) => i.getBoundingClientRect().width > 150); const el = imgs[0]; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, imgs: imgs.length }; })()");
    await sleep(600);
    const c0 = await counter(S); console.log("before", JSON.stringify(c0), JSON.stringify(card));
    await S.jshot("vlt-flip-before");
    await drag(S, card.x + 100, card.y, card.x - 60, card.y, 6); await sleep(1500);
    const c1 = await counter(S); console.log("after small drag left (160px)", JSON.stringify(c1)); await S.jshot("vlt-flip-after-small");
    const c2start = await S.evaluate("(() => { const imgs = [...document.querySelectorAll('main img')].filter((i) => i.getBoundingClientRect().width > 150); const r = imgs[0].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
    await drag(S, c2start.x + 100, c2start.y, c2start.x - 60, c2start.y, 6); await sleep(1500);
    console.log("after second small drag", JSON.stringify(await counter(S)));
    const kbd = async (key, code) => { await S.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key, code, windowsVirtualKeyCode: code === "ArrowRight" ? 39 : 37 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: code === "ArrowRight" ? 39 : 37 }); await sleep(800); return counter(S); };
    console.log("key right", JSON.stringify(await kbd("ArrowRight", "ArrowRight")), "key left", JSON.stringify(await kbd("ArrowLeft", "ArrowLeft")));
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });

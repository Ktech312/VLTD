const V = require("./audit-s-vlt-lib.cjs");
const { sleep, squash } = V;
(async () => {
  const S = await V.session("owner");
  try {
    await S.visit("/vault");
    console.log("WALL top:", squash(await S.text()).slice(0, 900));
    console.log("wall tiles", await S.evaluate("document.querySelectorAll('a[href^=\"/vault/item/\"]').length"));
    await V.clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Gallery')", { js: true }); await sleep(1500);
    console.log("GALLERY cards:", await S.evaluate("document.querySelectorAll('a[href^=\"/vault/item/\"]').length"));
    console.log(await S.evaluate("[...document.querySelectorAll('main a[href^=\"/vault/item/\"]')].slice(0,3).map((a) => { let c = a; for (let i = 0; i < 6 && c.parentElement && !/relative/.test(c.className); i++) c = c.parentElement; return c.innerText.replace(/\s+/g, ' ').slice(0, 300); })"));
    await S.jshot("vlt-probe-gallery");
    await V.clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Flip')", { js: true }); await sleep(1500);
    console.log("FLIP:", squash(await S.text()).slice(900, 1800));
    await S.jshot("vlt-probe-flip");
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });

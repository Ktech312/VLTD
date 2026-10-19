const X = require("./audit-s-vlt-vlib.cjs");
const { sleep, squash, clickEl } = X;
(async () => {
  const S = await X.session("owner");
  try {
    await S.visit("/portfolio"); await sleep(1500);
    console.log("BREAKDOWN", JSON.stringify(await S.evaluate("[...document.querySelectorAll('a[href^=\"/portfolio/universe/\"]')].map((a) => a.innerText.replace(/\s+/g, ' ').trim())")));
    console.log("REVIEW SECTION", JSON.stringify(await S.evaluate("(() => { const els = [...document.querySelectorAll('a[href^=\"/vault/item/\"]')]; return els.map((a) => a.innerText.replace(/\s+/g, ' ').trim() + ' | ' + a.getAttribute('href')); })()")));
    console.log("SVGS", JSON.stringify(await S.evaluate("[...document.querySelectorAll('svg')].map((s) => ({ vb: s.getAttribute('viewBox'), poly: !!s.querySelector('polyline'), t: s.querySelectorAll('text').length, hid: s.getAttribute('aria-hidden') })).filter((x) => x.poly || x.t)")));
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Collection tools')", { js: true }); await sleep(500);
    await clickEl(S, "[...document.querySelectorAll('[role=menuitem]')].find((a) => /Collection recap/.test(a.innerText))", { js: true }); await sleep(3000);
    console.log("RECAP", JSON.stringify(await S.evaluate("(() => { const cands = [...document.querySelectorAll('[role=dialog], [aria-modal=true], .fixed')].map((x) => ({ pos: getComputedStyle(x).position, z: getComputedStyle(x).zIndex, role: x.getAttribute('role'), len: x.innerText.length, text: x.innerText.replace(/\s+/g, ' ').slice(0, 300) })); return cands.filter((c) => c.len > 60).slice(0, 4); })()")));
    await S.jshot("vlt-insights-recap2");
    await S.visit("/goals"); console.log("GOALS", squash(await S.text()).slice(0, 1800));
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });

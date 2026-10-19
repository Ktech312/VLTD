const X = require("./audit-s-exh-lib.cjs");
const { session, sleep, mclick, byLabel, byLabelRe } = X;
const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
(async () => {
  const S = await session("owner");
  try {
    await S.visit("/museum/" + ex.A); await sleep(7000);
    await mclick(S, byLabel("Advanced"), { wait: 800 });
    await mclick(S, byLabelRe("Expires: Never"), { wait: 800 });
    const info = await S.evaluate(`[...document.querySelectorAll('#gallery-expiry-dropdown button')].map(b => { b.scrollIntoView({block:'nearest'}); const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2); return { t: b.textContent.trim(), y: Math.round(r.y), h: Math.round(r.height), vh: innerHeight, hit: top ? (top === b ? 'self' : top.tagName + '.' + String(top.className).slice(0,40)) : null }; })`);
    console.log(JSON.stringify(info));
    await S.jshot("exh-probe8-expiry");
  } finally { await S.close(); }
})();

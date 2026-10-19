const X = require("./audit-s-exh-lib.cjs");
const { session, sleep, mclick, byLabel, byLabelRe, admin } = X;
const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
(async () => {
  const S = await session("owner");
  try {
    await S.visit("/museum/" + ex.A); await sleep(7000);
    await mclick(S, byLabel("Advanced"), { wait: 800 });
    console.log("expires btn", await S.evaluate(`[...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => /Expires/.test(t))`));
    console.log("click expires", await mclick(S, byLabelRe("Expires: Never"), { wait: 600 }));
    console.log("opts", await S.evaluate(`[...document.querySelectorAll('#gallery-expiry-dropdown button')].map(b => b.textContent.trim())`));
    console.log("click 24h", await mclick(S, `[...document.querySelectorAll('#gallery-expiry-dropdown button')].find(b => b.textContent.trim() === '24 hours')`, { wait: 1000, scroll: false }));
    console.log("expires btn after", await S.evaluate(`[...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(t => /Expires/.test(t))`));
    for (let i = 0; i < 8; i++) { const inv = (await admin.from("gallery_invites").select("label,expires_at,permissions").eq("gallery_id", ex.A)).data; console.log(i, JSON.stringify(inv)); await sleep(1500); }
    const ls = await S.evaluate(`(() => { const g = JSON.parse(localStorage.getItem('vltd_galleries') || '[]').find(x => x.id === '${ex.A}'); return g ? JSON.stringify(g.share) : null; })()`);
    console.log("local share", String(ls).slice(0, 400));
  } finally { await S.close(); }
})();

process.env.AUDIT_MANIFEST = process.env.AUDIT_MANIFEST || __dirname + "/qa_audit_gin.json";
const X = require("./audit-s-vlt-lib.cjs");
(async () => {
  const S = await X.session("owner");
  try {
    await S.visit("/goals");
    const keys = () => S.evaluate(`Object.keys(localStorage).map(k=>k+':'+localStorage.getItem(k).length)`);
    console.log("t0", (await S.text()).replace(/\s+/g, " ").match(/OVERALL.{0,120}/)?.[0], await keys());
    await X.sleep(10000);
    console.log("t10", (await S.text()).replace(/\s+/g, " ").match(/OVERALL.{0,120}/)?.[0], await keys());
    console.log(JSON.stringify(S.reqs.filter(r=>/supabase/.test(r.host)).map(r=>r.method+" "+r.url.slice(0,80))).slice(0,1500));
    await S.visit("/vault"); await X.sleep(4000);
    await S.evaluate(`[...document.querySelectorAll('nav[aria-label="Vault"] a')].find(a=>a.textContent.trim()==='Goals').click()`);
    await S.waitFor("location.pathname==='/goals'"); await X.sleep(3000);
    console.log("after vault", (await S.text()).replace(/\s+/g, " ").match(/OVERALL.{0,120}/)?.[0]);
  } finally { await S.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

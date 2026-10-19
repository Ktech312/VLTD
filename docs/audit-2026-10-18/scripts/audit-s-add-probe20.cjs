const T = require("./audit-s-add-lib.cjs");
const { session, sleep, admin, man } = T;
(async () => {
  const P = man().personalId;
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/vault/bulk"); await S.waitFor("document.querySelectorAll('select').length >= 1", 60000);
    for (let i = 0; i < 8; i++) { await sleep(2500); const t = await S.text(); const tk = t.match(/(\d+)\s*\n?\s*of (\d+) AI scans left[^\n]*/); console.log((i + 1) * 2.5 + "s ticker:", tk ? tk[0].replace(/\n/g, " ") : "none"); if (tk) break; }
    console.log("rpc calls seen:", JSON.stringify(S.reqs.filter((r) => /bulk_scan|rpc/.test(r.url)).slice(0, 5)));
    console.log("active profile in the page:", await S.evaluate("localStorage.getItem('vltd_active_profile_id_v1')"), "expected", P);
    console.log("bad responses:", JSON.stringify(S.badResponses.slice(0, 6)));
    console.log("db status:", JSON.stringify((await admin.rpc("bulk_scan_status", { p_profile: P })).data));
    await S.jshot("probe-bulk-ticker");
  } finally { await S.close(); }
})().catch((e) => { console.error(e); process.exit(2); });

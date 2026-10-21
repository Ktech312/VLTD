// GIN-095 on PRODUCTION: an older browser-wide exclusion list is copied up even when the Insurance page opens BEFORE the profile's items are on the device (the order that
// used to lose it). A clean browser is given only the old list, then opens Insurance straight away. Isolated QA owner; the rows are removed afterwards.
//   AUDIT_MANIFEST=<manifest> node rb58-exclusions-old-list.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session, admin, man } = T;
const m = man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = T.R("RB58");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] };
(async () => {
  let S;
  try {
    await admin.from("insurance_exclusions").delete().eq("profile_id", P);
    const items = (await admin.from("vault_items").select("id").eq("profile_id", P).not("status", "in", "(SOLD,WISHLIST)").order("id").limit(2)).data;
    S = await session("owner", { width: 1440, height: 900 });
    await S.visit("/account"); await sleep(4000);
    const itemsOnDevice = await S.evaluate("(() => { try { return JSON.parse(localStorage.getItem('vltd_items_v1') || '[]').length; } catch { return -1; } })()");
    await S.evaluate(`Object.keys(localStorage).filter((k) => k.startsWith('vltd_insurance_excluded')).forEach((k) => localStorage.removeItem(k)); localStorage.setItem('vltd_insurance_excluded_item_ids_v1', JSON.stringify([${JSON.stringify(items[0].id)}])); true`);
    await S.visit("/insurance");
    let rows = [];
    for (let i = 0; i < 20; i++) { await sleep(2500); rows = ((await admin.from("insurance_exclusions").select("item_id").eq("profile_id", P)).data || []).map((x) => x.item_id); if (rows.length) break; }
    const ok = rows.length === 1 && rows[0] === items[0].id;
    out.cases.push({ ok });
    r.check(ok, { page: "/insurance (clean browser, only the older list on the device)", control: "An older on-device exclusion when Insurance opens before the items arrive", expected: "copied up to the account once the items are known (not lost)", actual: `account rows=${JSON.stringify(rows)} (expected ${items[0].id}); items on the device when the old list was set: ${itemsOnDevice}`, evidence: "", impact: "GIN-095", repro: "" });
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { await admin.from("insurance_exclusions").delete().eq("profile_id", P); } catch {}
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb58-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS" : "FAIL")).join(","), out.error ? "RUNNER ERROR" : "");
    process.exit(0);
  }
})();

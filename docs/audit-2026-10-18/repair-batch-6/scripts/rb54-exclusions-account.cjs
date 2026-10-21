// Batch 16, part 2: RUN AFTER repair-batch-15/sql/6-insurance-exclusions.sql. Exclusions follow the account: a second browser sees them, the packet agrees,
// re-including removes them, an old on-device list is copied up once, and the account refuses other people. Production, isolated QA owner and a second QA
// account; the rows are removed afterwards. (The viewer session is the second QA account.)
//   AUDIT_MANIFEST=<manifest> node rb54-exclusions-account.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session, clickText, admin, man } = T;
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const env = require(path.join(SD, "..", "qa", "env.cjs"));
const m = man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = T.R("RB54");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [] }; let n = 0;
async function rec(S, ok, control, expected, actual, page) {
  let ev = ""; if (S) { try { await sleep(250); ev = path.join(T.AUD, await S.jshot(`rb54-${LABEL}-${++n}`)); } catch {} }
  out.cases.push({ control, expected, ok: !!ok, actual, screenshot: ev });
  r.check(!!ok, { page, control, expected, actual, evidence: ev ? path.relative(T.AUD, ev).replace(/\\/g, "/") : "", impact: "GIN-095", repro: "" });
}
const body = async (S) => (await S.text().catch(() => "")).replace(/\s+/g, " ").trim();
const rowsOf = async () => ((await admin.from("insurance_exclusions").select("item_id").eq("profile_id", P)).data || []).map((x) => x.item_id).sort();
const labels = (S) => S.evaluate("[...document.querySelectorAll('input[type=checkbox][aria-label^=\"Include \"]')].map((i) => i.getAttribute('aria-label'))");
const tick = (S, label) => T.click(S, `[...document.querySelectorAll('input[type=checkbox]')].find((i) => i.getAttribute('aria-label') === ${JSON.stringify(label)})`);
(async () => {
  let S, S2, S3;
  try {
    const probe = await admin.from("insurance_exclusions").select("item_id").limit(1);
    if (probe.error) { console.log("The table does not exist yet: run 6-insurance-exclusions.sql first.", probe.error.message); r.nt({ page: "insurance_exclusions", control: "account-synced exclusions", expected: "", actual: "the table does not exist yet (" + probe.error.message + ")", evidence: "", impact: "GIN-095", repro: "" }); process.exit(0); }
    await admin.from("insurance_exclusions").delete().eq("profile_id", P);
    const items = (await admin.from("vault_items").select("id,title").eq("profile_id", P).not("status", "in", "(SOLD,WISHLIST)").order("id").limit(3)).data;

    // 1. exclude two items in browser A
    S = await session("owner", { width: 1440, height: 900 });
    await S.visit("/insurance"); await S.waitFor("document.querySelectorAll('input[type=checkbox][aria-label^=\"Include \"]').length > 1", 60000).catch(() => {}); await sleep(3500);
    let t = await body(S);
    await rec(S, !/Exclusions are saved on this device only/.test(t), "Insurance tab with the account table in place", "no 'saved on this device only' warning (the exclusions follow the account)", `warning shown=${/Exclusions are saved on this device only/.test(t)}`, "/insurance");
    const all = await labels(S);
    await tick(S, all[0]); await sleep(2000); await tick(S, all[1]); await sleep(4000);
    let rows = await rowsOf();
    await rec(S, rows.length === 2, "Untick two items in browser A", "two rows exist in the account (confirmed by the account, not just on the device)", `account rows=${JSON.stringify(rows)}`, "/insurance");
    t = await body(S);
    await rec(S, /2 excluded by you\./.test(t) && !/on this device/.test(t.slice(t.indexOf("Not counted"), t.indexOf("Not counted") + 120)), "Insurance tab not-counted line", "'2 excluded by you.' (no 'on this device')", `line=${(t.match(/Not counted[^.]*\./) || ["(none)"])[0]}`, "/insurance");
    await S.close(); S = null;

    // 2. a fresh browser (no device copy) sees them
    S2 = await session("owner", { width: 1440, height: 900 });
    await S2.visit("/insurance"); await S2.waitFor("document.querySelectorAll('input[type=checkbox][aria-label^=\"Include \"]').length > 0 || document.body.innerText.includes('Excluded from the insurance documents')", 60000).catch(() => {}); await sleep(5000);
    t = await body(S2);
    const excludedShown = (t.match(/Excluded from the insurance documents/g) || []).length;
    await rec(S2, excludedShown === 2, "Insurance tab in a second, clean browser", "the same two items show as excluded", `excluded rows shown=${excludedShown}`, "/insurance");
    await S2.visit("/insurance/packet"); await sleep(9000);
    t = await body(S2);
    await rec(S2, /2 excluded by you\./.test(t) && !/this device only/.test(t), "Policy packet in the second browser", "counts the two exclusions and has no device-only warning: the packet matches the first browser's", `line=${(t.match(/Not counted[^.]*\./) || ["(none)"])[0]}; warning=${/this device only/.test(t)}`, "/insurance/packet");
    // 3. re-include one in browser 2: the account loses that row
    await S2.visit("/insurance"); await sleep(8000);
    const labelsNow = await labels(S2);
    const excludedOnes = await S2.evaluate("[...document.querySelectorAll('tr')].filter((tr) => /Excluded from the insurance documents/.test(tr.innerText)).map((tr) => tr.querySelector('input[type=checkbox]').getAttribute('aria-label'))");
    await tick(S2, excludedOnes[0]); await sleep(4500);
    rows = await rowsOf();
    await rec(S2, rows.length === 1, "Re-include one item in the second browser", "the account row is removed", `account rows=${JSON.stringify(rows)}`, "/insurance");
    await S2.close(); S2 = null;

    // 4. an old on-device list is copied up the first time
    await admin.from("insurance_exclusions").delete().eq("profile_id", P);
    S3 = await session("owner", { width: 1440, height: 900 });
    await S3.visit("/vault"); await sleep(5000);
    // Make this browser look like one that has only ever run the older version: no per-profile list, nothing waiting, nothing seen in the account; just the old browser-wide list.
    await S3.evaluate(`Object.keys(localStorage).filter((k) => k.startsWith('vltd_insurance_excluded')).forEach((k) => localStorage.removeItem(k)); localStorage.setItem('vltd_insurance_excluded_item_ids_v1', JSON.stringify([${JSON.stringify(items[2].id)}])); true`);
    await S3.visit("/insurance"); await sleep(9000);
    rows = await rowsOf();
    await rec(S3, rows.length === 1 && rows[0] === items[2].id, "An exclusion that only existed on the device (older version)", "is copied up to the account once", `account rows=${JSON.stringify(rows)}`, "/insurance");
    // 5. another account cannot read or write them
    const U = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const sign = await U.auth.signInWithPassword({ email: m.k.email, password: m.k.password });
    if (!sign.error) {
      const rd = await U.from("insurance_exclusions").select("item_id").eq("profile_id", P);
      const wr = await U.from("insurance_exclusions").insert({ profile_id: P, item_id: "rb54-intruder" });
      const dl = await U.from("insurance_exclusions").delete().eq("profile_id", P).eq("item_id", items[2].id).select("item_id");
      const still = await rowsOf();
      await rec(null, !rd.error && (rd.data || []).length === 0 && !!wr.error && !(dl.data || []).length && still.length === 1, "A different account tries to read, add and remove this profile's exclusions", "reads nothing, cannot add, cannot remove", `read=${(rd.data || []).length} rows; add error=${wr.error ? wr.error.message.slice(0, 60) : "NONE"}; removed=${(dl.data || []).length}; rows left=${still.length}`, "api insurance_exclusions");
    } else out.cases.push({ control: "different account", ok: null, actual: "could not sign in the second QA account" });
    const V = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const vr = await V.from("insurance_exclusions").select("item_id").limit(1);
    await rec(null, !!vr.error || (vr.data || []).length === 0, "A visitor with no session reads the exclusions", "refused or nothing", vr.error ? vr.error.message.slice(0, 80) : `${(vr.data || []).length} rows`, "api insurance_exclusions");
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String(e && e.stack || e).slice(0, 600); }
  finally {
    try { await admin.from("insurance_exclusions").delete().eq("profile_id", P); } catch {}
    for (const x of [S, S2, S3]) { try { if (x) await x.close(); } catch {} }
    fs.writeFileSync(path.join(EV, `rb54-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(`\n${out.cases.filter((c) => c.ok).length} ok, ${out.cases.filter((c) => c.ok === false).length} not ok of ${out.cases.length}${out.error ? " | RUNNER ERROR" : ""}`);
    for (const c of out.cases.filter((c) => c.ok !== true)) console.log("NOT OK:", c.control, "|", String(c.actual).slice(0, 460));
    process.exit(0);
  }
})();

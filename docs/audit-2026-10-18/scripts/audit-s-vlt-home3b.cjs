// VLT suite 3b: Home stale-data notice when ONLY the vault_items request is refused (profile still loads), plus a corrected look at the first-run result VLT-080.
const V = require("./audit-s-vlt-lib.cjs");
const { R, sleep, squash, admin, clickEl, blockRest } = V; const r = R("VLT");
(async () => {
  const m = V.man(); const B = m.businessId; const bid = `qa_vlt_${m.stamp}_b1`;
  // VLT-080 detail: print what the one-item Home shows
  await admin.from("vault_items").delete().eq("id", bid);
  const ins = await admin.from("vault_items").insert({ id: bid, profile_id: B, title: "QA VLT Single Business Item", universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", status: "COLLECTION", is_public: false, created_at: Date.now(), purchase_price: 40, current_value: 100 });
  if (ins.error) throw new Error(ins.error.message);
  const S = await V.session("business");
  try {
    await S.visit("/dashboard");
    const ov = await S.evaluate("(document.querySelector('section[aria-label=\"Collection overview\"]')).innerText.replace(/\\s+/g, ' ')");
    const strip = (await S.evaluate("(document.querySelector('[data-testid=recent-count]') || {}).innerText"));
    console.log("ONE-ITEM OVERVIEW:", ov); console.log("STRIP CAPTION:", strip);
    const checks = { pill: /1 item · Open Vault/.test(ov), cost: ov.includes("PURCHASE COST $40"), value: ov.includes("ESTIMATED VALUE $100"), gain: /\+\$60 \(\+150\.0%\)/.test(ov), priced: /1 of 1 priced|All items priced/.test(ov), on: /On 1 of 1 items/.test(ov), cap: /^1 item in your Vault/.test(strip || ""), plural: /\b1 items\b/.test(ov + " " + strip) };
    console.log(JSON.stringify(checks));
    r.check(checks.pill && checks.cost && checks.value && checks.gain && checks.on && checks.cap && !checks.plural, { page: "/dashboard | owner, Business, 1 item (cost $40, value $100)", control: "Home figures with one item (re-read; first run VLT-080 asserted a caption wording I had guessed)", expected: "'1 item' singular; Purchase Cost $40; Estimated Value $100; Unrealized +$60 (+150.0%) on 1 of 1; strip caption '1 item in your Vault'; value basis 'All items priced'", actual: `${JSON.stringify(checks)} | ${ov.slice(0, 420)} | ${strip}`, evidence: await S.jshot("vlt-home-business-one-1440b"), impact: "misleading result", repro: "Business profile with one valued item; open /dashboard" });
  } finally { await S.close(); await admin.from("vault_items").delete().eq("id", bid); }

  // only vault_items refused
  const F = await V.session("owner");
  try {
    await F.visit("/dashboard");
    await blockRest(F, true, ["*supabase.co/rest/v1/vault_items*"]);
    await F.visit("/dashboard");
    for (let i = 0; i < 30 && !(await F.evaluate("!!document.querySelector('[data-testid=stale-notice]')")); i++) await sleep(1000);
    const notice = await F.evaluate("(document.querySelector('[data-testid=stale-notice]') || {}).innerText"); const txt = squash(await F.text());
    r.check(/26 items/.test(txt) && !!notice && /couldn.t refresh/i.test(notice), { page: "/dashboard | owner, Personal, saved copy on device, ONLY vault_items request refused", control: "Home stale-data notice (vault_items refused, profile loads)", expected: "Saved items shown with 'Showing saved data - couldn't refresh' + Retry", actual: `notice='${notice}'; ${txt.slice(0, 220)}`, evidence: await F.jshot("vlt-home-stale-items-only"), impact: "misleading result", repro: "Load Home once; refuse vault_items requests; reload" });
  } finally { await F.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });

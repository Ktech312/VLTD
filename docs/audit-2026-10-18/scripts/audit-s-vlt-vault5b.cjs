// VLT 8b: Vault with a saved copy while EVERY data request is refused (first run VLT-347 only waited 8 s; the notice can take longer), plus corrections.
const X = require("./audit-s-vlt-vlib.cjs");
const { R, sleep, squash, ids, blockRest } = X; const r = R("VLT");
(async () => {
  const F = await X.session("owner");
  try {
    await F.visit("/vault"); await blockRest(F, true); await F.visit("/vault");
    let notice = null, i = 0; for (; i < 60 && !notice; i++) { await sleep(1000); notice = await F.evaluate("(document.querySelector('[data-testid=stale-notice]') || {}).innerText || null"); }
    const n3 = (await ids(F)).length; const t3 = squash(await F.text());
    r.check(n3 > 0 && !!notice, { page: "/vault | saved copy, ALL data requests refused (waited up to 60 s)", control: "Vault with saved copy when every request fails (re-run)", expected: "Saved items with the 'couldn't refresh' notice within a minute", actual: `items ${n3}; notice='${notice}' after ${i}s; sync line: ${(/Could not reach the cloud[^.]*\./.exec(t3) || ["none"])[0]}`, evidence: await F.jshot("vlt-vault-allrefused2"), impact: "misleading result", repro: "Load /vault, refuse all supabase REST, reload, wait" });
    await blockRest(F, false);
    r.pass({ page: "/vault/print | owner, Business, 0 items", control: "(correction) VLT-338 empty Collection report", expected: "(improvement, not a defect) an empty vault prints a report of zeros instead of an empty-state sentence", actual: "VLT-338 is recorded FAIL by my script but it is a proposed improvement per the audit rules; no behaviour is wrong ('TOTAL ITEMS 0, $0.00')", evidence: "shots/vlt-print-empty.jpg", impact: "improvement", repro: "Business empty; /vault/print" });
  } finally { await F.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });

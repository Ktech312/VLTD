// GIN insurance suite 4: clean-browser direct URLs, load failure (vault_items refused), Business (empty), signed out / unrelated viewer, phone 390 (browser-emulated).
const L = require("./audit-s-gin-lib.cjs");
const { R, admin, sleep, man, clickEl, X } = L;
(async () => {
  const m = man(); const P = m.personalId, B = m.businessId, st = m.stamp;
  const id1 = `qa_vz_${st}_1`;
  const routes = [["/insurance", "Insurance inventory"], [`/insurance/item?id=${id1}`, "Item sheet"], ["/insurance/packet", "Policy packet"], ["/insurance/packet/print?page=0&images=0", "Printable packet"], ["/reports/insurance", "Insurance report"], ["/portfolio/insurance", "Inventory schedule"], ["/reports/weekly", "Weekly report"]];
  const probeText = (S) => S.evaluate("document.body.textContent.replace(/\\s+/g, ' ')");
  const hasRecords = (t) => /QA Album 1 - Original/.test(t) && /QA Album 2 /.test(t) || (/QA Album 1 - Original/.test(t) && /Grade: PSA 9/.test(t));
  const REFU = ["*supabase.co/rest/v1/vault_items*"];

  // ---------- A. clean browser (nothing cached), direct URL, populated account
  for (const [path, name] of (process.argv.includes("--skipA") ? [] : routes)) {
    const S = await L.session("owner");
    try {
      await S.visit(path); await sleep(7000);
      const t = await probeText(S); const rows = await S.evaluate("document.querySelectorAll('table tbody tr').length");
      const ok = path.startsWith("/reports/weekly") ? /26 items you own/.test(t) : (rows > 5 || (path.includes("/item") && /Grade: PSA 9/.test(t)));
      R.check(ok, { page: `${path} | owner, Personal, 26 owned + 5 sold, clean browser (nothing cached)`, control: `${name}: direct URL / refresh on a new browser or device`, expected: "Shows the account's items (loads them from the account)", actual: ok ? `shows the records (${rows} rows)` : `shows: "${L.squash(await S.evaluate("document.querySelector('main') ? document.querySelector('main').innerText : document.body.innerText")).slice(0, 220)}"`, evidence: ok ? "" : await L.SHOT(S, "clean-" + name.replace(/\W+/g, "-").toLowerCase()), impact: "misleading result", repro: `1. Sign in on a new browser. 2. Open ${path} directly.` });
    } finally { await S.close(); }
  }

  // ---------- B. vault_items request refused, clean browser
  for (const [path, name] of routes) {
    const S = await L.session("owner");
    try {
      await L.refuse(S, REFU);
      await S.visit(path); await sleep(26000);
      const t = L.squash(await S.evaluate("document.querySelector('main') ? document.querySelector('main').innerText : document.body.innerText"));
      const tx = await probeText(S);
      const errorShown = /couldn.t load|could not load|try again|retry|didn.t load|unable to load|failed/i.test(t);
      const falseEmpty = /No items to insure yet|No items to report yet|No items found|No collection items yet|No items selected|Showing 0 of 0|0 items you own|No new vault items/i.test(t + " " + tx.slice(0, 3000));
      R.check(errorShown && !falseEmpty, { page: `${path} | owner, Personal (26 items in the account), items request refused (CDP Fetch 503), clean browser`, control: `${name}: items cannot be loaded`, expected: "A load-error / retry state; never 'no items'", actual: `${errorShown ? "error shown" : "no error shown"}; ${falseEmpty ? "presents an EMPTY collection" : "no false empty"}: "${t.slice(0, 200)}"${path.includes("print") ? " | printable route text: " + (tx.match(/Page \d+ of \d+.{0,70}/)?.[0] || "") : ""}`, evidence: await L.SHOT(S, "refused-" + name.replace(/\W+/g, "-").toLowerCase()), impact: "misleading result", repro: `Block vault_items requests, open ${path} in a new browser.` });
    } finally { await S.close(); }
  }

  // ---------- C. Business profile (no items)
  {
    const S = await L.session("business");
    try {
      for (const [path, name] of routes) {
        const p = path.includes("/item?id=") ? `/insurance/item?id=${id1}` : path;
        await S.visit(p); await sleep(6000);
        const t = L.squash(await S.evaluate("document.querySelector('main') ? document.querySelector('main').innerText : document.body.innerText"));
        const tx = await probeText(S);
        const leak = /QA Album|QA Sold/.test(tx);
        const empty = /No items to insure yet|No items to report yet|No items found|No collection items yet|Showing 0 of 0/.test(t + tx.slice(0, 4000)) || /0 items you own/.test(t);
        R.check(!leak && empty, { page: `${path} | owner, Business profile, no items`, control: `${name}: Business empty state and isolation`, expected: "An explicit empty state; none of the Personal profile's items (even for the Personal item's id)", actual: `${leak ? "PERSONAL ITEMS VISIBLE" : "no Personal items"}; ${empty ? "empty state shown" : "no clear empty state"}: "${t.slice(0, 190)}"`, evidence: await L.SHOT(S, "business-" + name.replace(/\W+/g, "-").toLowerCase()), impact: leak ? "privacy/data loss" : "usability", repro: `Switch to Business, open ${p}.` });
      }
      await S.visit("/reports/weekly"); await sleep(3000);
      const t = L.squash(await S.evaluate("document.querySelector('main').innerText"));
      R.check(!/Great shape/.test(t) || false, { page: "/reports/weekly | owner, Business, no items", control: "Collection Health on an empty collection", expected: "No score (or n/a) for an empty collection", actual: t.match(/COLLECTION HEALTH.{0,60}/i)?.[0], evidence: await L.SHOT(S, "business-weekly-health"), impact: "misleading result", repro: "Open the weekly report with no items." });
    } finally { await S.close(); }
  }

  // ---------- D. signed out and unrelated user
  {
    const V = await L.session("visitor");
    try {
      for (const [path, name] of routes.concat([["/goals", "Goals"]])) {
        await V.visit(path); await sleep(2500);
        const p = await V.path(); const tx = L.squash(await probeText(V));
        const demo = /QA Album|Demo|Pokemon|Charizard/i.test(tx) && /Insurance|Goal/.test(tx) && !/Log in/.test(tx);
        R.check(/^\/login/.test(p) && !/QA Album/.test(tx), { page: `${path} | signed out`, control: `${name} without an account`, expected: "Redirects to log in; no private data or demo records", actual: `ends at ${p}${demo ? " (shows content)" : ""}`, evidence: "", impact: "privacy/data loss", repro: `Open ${path} signed out.` });
      }
    } finally { await V.close(); }
    const K = await L.session("viewer");
    try {
      await K.visit(`/insurance/item?id=${id1}`); await sleep(6000);
      const tx = await probeText(K);
      R.check(!/QA Album 1 - Original/.test(tx) && !/PSA 9|CERT-1234/.test(tx), { page: `/insurance/item?id=${id1} | unrelated signed-in user`, control: "Another account opening the owner's item sheet by id", expected: "Item not found / empty: no owner data", actual: L.squash(tx).slice(tx.indexOf("INSURANCE") > 0 ? tx.indexOf("INSURANCE") - 10 : 0, 260), evidence: "", impact: "privacy/data loss", repro: "Sign in as another user, open the owner's item id." });
      await K.visit("/goals"); await sleep(5000);
      const gt = await L.mainText(K);
      R.check(!/Complete the|binder|QA /.test(gt), { page: "/goals | unrelated signed-in user", control: "Another account's Goals page", expected: "Only this user's goals", actual: gt.slice(0, 160), evidence: "", impact: "privacy/data loss", repro: "Open /goals as another user." });
    } finally { await K.close(); }
  }
})().catch((e) => { console.error("ERR", e); process.exit(2); });

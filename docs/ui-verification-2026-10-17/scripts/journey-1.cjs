// Journey part 1 (LIVE): sign in -> choose profile -> add items WITHOUT AI -> edit Details.  node journey-1.cjs [--base=https://vltd.app]
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 400));
const ITEMS = [
  { title: "QA Journey Slab", price: "120" },
  { title: "QA Journey Vinyl", price: "30" },
  { title: "QA Journey Poster", price: "" }, // cost left blank on purpose: unknown, not zero
];
const rowsOf = async (profileId) => (await admin.from("vault_items").select("*").eq("profile_id", profileId).like("title", "QA Journey %")).data || [];
const waitRows = async (profileId, n, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const r = await rowsOf(profileId); if (r.length >= n) return r; await sleep(1500); } return rowsOf(profileId); };

(async () => {
  const m = man();
  const live = await (await fetch(BASE + "/")).text();
  info("deployed commit", (live.match(/name="vltd-commit" content="([^"]+)"/) || [])[1]);
  const S = await browser(BASE);
  try {
    // 1. SIGN IN: a signed-in tab (the account's real session) reaches Home as that account, not the public page
    await S.go("/"); await S.waitFor("/YOUR VAULT IS READY/i.test(document.body.innerText)", 90000, "Home for the signed-in account");
    let t = await S.text();
    check("[1 sign in] the signed-in tab lands on Home as the Personal profile", (await S.path()).startsWith("/dashboard") && /QA Journey Personal/.test(t), t.slice(0, 160));
    check("[1 sign in] Home of a brand-new account is an honest empty state (no items, no fake data)", /No items yet/i.test(t) && /No exhibitions yet/i.test(t), t.slice(0, 300));

    // 2. CHOOSE PROFILE: account menu -> Business -> back to Personal. Active profile is stored and Home follows it.
    await S.clickSel('[aria-label="Account menu"]'); await sleep(700);
    const sw = await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => /QA Journey Business/.test(x.textContent)); if (!b) return false; b.click(); return true; })()");
    check("[2 profile] the account menu lists both profiles and the Business one can be chosen", sw === true);
    await sleep(2500); await S.waitFor("/YOUR VAULT IS READY/i.test(document.body.innerText) && /QA Journey Business/.test(document.body.innerText)", 90000, "Home as Business");
    check("[2 profile] after choosing Business, Home shows the Business profile and it is the stored active profile", (await S.evaluate("localStorage.getItem('vltd_active_profile_id_v1')")) === m.businessId);
    await S.clickSel('[aria-label="Account menu"]'); await sleep(700);
    await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => /QA Journey Personal/.test(x.textContent) && !x.disabled); if (b) b.click(); return true; })()");
    await sleep(2500); await S.waitFor("/YOUR VAULT IS READY/i.test(document.body.innerText) && /QA Journey Personal/.test(document.body.innerText)", 90000, "Home as Personal");
    check("[2 profile] choosing Personal again returns to the Personal profile", (await S.evaluate("localStorage.getItem('vltd_active_profile_id_v1')")) === m.personalId);

    // 3. ADD ITEMS WITHOUT AI (manual Add page). Network is watched for any AI endpoint.
    for (const it of ITEMS) {
      await S.go("/vault/add"); await S.waitFor("document.querySelector(\"input[placeholder*='Name this item']\")", 90000, "Add page"); await sleep(2500);
      await S.setVal("input[placeholder*='Name this item']", it.title);
      if (it.price !== "") await S.evaluate("(() => { const i = [...document.querySelectorAll('input')].filter((x) => x.placeholder === '25')[0]; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, " + JSON.stringify(it.price) + "); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()");
      await sleep(400);
      await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Save'); b.click(); return true; })()");
      const rows = await waitRows(m.personalId, ITEMS.indexOf(it) + 1);
      check(`[3 add] "${it.title}" saved to the Personal profile`, rows.some((r) => r.title === it.title), rows.map((r) => r.title));
      await sleep(1500);
    }
    const rows = await rowsOf(m.personalId);
    const byTitle = Object.fromEntries(rows.map((r) => [r.title, r]));
    check("[3 add] three items, all in the Personal profile and none in the Business profile", rows.length === 3 && (await rowsOf(m.businessId)).length === 0, rows.length);
    check("[3 add] the entered costs are saved exactly (120, 30) and the blank cost is unknown (null), not 0", Number(byTitle["QA Journey Slab"]?.purchase_price) === 120 && Number(byTitle["QA Journey Vinyl"]?.purchase_price) === 30 && byTitle["QA Journey Poster"]?.purchase_price === null, rows.map((r) => [r.title, r.purchase_price]));
    const aiCalls = S.reqs.filter((r) => /\/api\/ai|\/api\/scan|openai|anthropic|\/api\/lookup|vision/i.test(r.url));
    check("[3 add] no AI request was made while adding the items", aiCalls.length === 0, aiCalls);
    const usage = await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).in("profile_id", [m.personalId, m.businessId]);
    check("[3 add] the AI usage log has no entry for this account's profiles", !usage.error && usage.count === 0, usage.error?.message || usage.count);

    // 4. EDIT DETAILS on the first item: Purchase section (cost, source, location) and Storage location
    const slab = byTitle["QA Journey Slab"];
    await S.go("/vault/item/" + slab.id); await S.waitFor("document.querySelector('[aria-label=\"Edit purchase\"]')", 120000, "item page"); await sleep(1500);
    const edit = async (section, values) => {
      await S.clickSel(`[aria-label="Edit ${section}"]`); await sleep(500);
      for (const [label, v] of Object.entries(values)) await S.setVal(`input[aria-label="${label}"]`, v);
      await S.clickSel(`[aria-label="Save ${section}"]`); await sleep(2500);
    };
    await edit("purchase", { "Purchase price": "125", Source: "QA Show", Location: "QA City" });
    await edit("storage + tracking", { "Storage location": "QA Shelf 2" });
    await sleep(3000);
    const after = (await admin.from("vault_items").select("purchase_price,purchase_source,purchase_location,storage_location").eq("id", slab.id).maybeSingle()).data || {};
    check("[4 details] the edited cost, source, location and storage location are saved to the database", Number(after.purchase_price) === 125 && after.purchase_source === "QA Show" && after.purchase_location === "QA City" && after.storage_location === "QA Shelf 2", after);
    t = await S.text();
    check("[4 details] the page shows the saved values without a reload", /\$125/.test(t) && /QA Show/.test(t) && /QA Shelf 2/.test(t), t.slice(0, 200));
    // make the first two items public so an exhibition built from them can be seen by a visitor
    for (const title of ["QA Journey Slab", "QA Journey Vinyl"]) {
      await admin.from("vault_items").update({ is_public: true }).eq("id", byTitle[title].id);
    }
    info("fixture note", "two items set public by the service key (the item Visibility toggle is covered by earlier checks); profile left PRIVATE");
  } catch (e) { console.log("STOPPED", e.message); try { await S.c.captureDiag(String(e.message), "journey1-diag"); } catch { /* ignore */ } fail++; }
  finally { await S.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });

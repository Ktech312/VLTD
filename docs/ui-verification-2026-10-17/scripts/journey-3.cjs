// Journey part 3 (LIVE): a CLEAN second browser sees everything the first one saved; Home's figures match the database; return navigation.
//   node journey-3.cjs [--base=https://vltd.app]
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 600)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 500));
const money = (s) => Number(String(s).replace(/[^0-9.\-]/g, ""));

(async () => {
  const m = man();
  const items = (await admin.from("vault_items").select("id,title,purchase_price,purchase_tax,purchase_shipping,purchase_fees,current_value").eq("profile_id", m.personalId).like("title", "QA Journey %")).data;
  const gal = (await admin.from("galleries").select("id,title,layout,public_token,visibility").eq("profile_id", m.personalId)).data[0];
  const order = ((gal.layout?.sections?.[0]?.slotLayout) || gal.layout?.itemIds || []).filter(Boolean);
  const titleOf = Object.fromEntries(items.map((i) => [i.id, i.title]));
  const expectOrder = order.map((id) => titleOf[id]);
  info("arranged order saved in the database", expectOrder);
  const costDb = items.reduce((s, i) => s + (Number(i.purchase_price) || 0) + (Number(i.purchase_tax) || 0) + (Number(i.purchase_shipping) || 0) + (Number(i.purchase_fees) || 0), 0);
  // Since 2026-10-17 (commit 21e128f) Manual Add no longer copies the cost into the value, so an unvalued item counts at what was paid (grey, never saved):
  const valDb = items.reduce((s, i) => s + (Number(i.current_value) > 0 ? Number(i.current_value) : (Number(i.purchase_price) || 0)), 0);
  const S = await browser(BASE); // a brand-new browser profile: nothing cached from the first session except the account's sign-in
  const timing = {};
  const open = async (path, ready, label) => { const t0 = Date.now(); await S.go(path); try { await S.waitFor(ready, 120000, label); } catch (e) { const d = await S.c.captureDiag(label + " did not appear", "journey3-diag"); console.log("BLANK/SLOW DIAG", JSON.stringify({ state: d.state, failures: d.failures.slice(0, 5), errors: d.errors.slice(0, 5), navs: d.navigations.slice(-5) }).slice(0, 900)); throw e; } timing[label] = Date.now() - t0; };
  try {
    // 10. HOME in the clean browser
    await open("/dashboard", "/QA Journey Slab/.test(document.body.innerText) && /COLLECTION OVERVIEW/.test(document.body.innerText)", "Home");
    await sleep(5000);
    const home = (await S.text());
    const flat = home.replace(/\n+/g, " | ");
    const pc = flat.match(/PURCHASE COST \| \$([\d,]+(?:\.\d+)?)/); const ev = flat.match(/ESTIMATED VALUE \| \$([\d,]+(?:\.\d+)?)/);
    check("[10 home] Home counts the 3 items saved by the first browser", /3 items/.test(home), home.slice(0, 300));
    check(`[10 home] Purchase cost on Home equals the database total (${costDb}); the item with no cost adds nothing`, pc && money(pc[1]) === costDb, pc);
    check(`[10 home] Estimated value on Home equals each item's value, or what was paid when it has none (${valDb}), and says so`, ev && money(ev[1]) === valDb && (/\d of 3 priced/.test(home) || /No item has a value yet/.test(home)), { ev, valDb });
    check("[10 home] the item with no cost and no value shows 'Not valued', not $0", /QA Journey Poster\s*\n?\s*Not valued/.test(home), flat.match(/QA Journey Poster[^|]*\|[^|]*/));
    check("[10 home] Sales revenue is honest for an account with no sales ('No sales yet', not $0)", /No sales yet/.test(home));
    check("[10 home] the exhibition is listed with its piece count", /QA Journey Exhibition/.test(home) && /3 pieces/.test(home));
    const chg = flat.match(/UNREALIZED CHANGE \| (-?\$[\d,]+ \([^)]*\))/);
    info("FINDING: Home 'unrealized change' after the cost was edited 120 -> 125 (the stored value stayed at 120)", { shown: chg?.[1], note: "manual Add saves current value = purchase price at entry; a later cost edit does not move it" });

    // 11. VAULT in the clean browser
    await open("/vault", "/QA Journey Slab/.test(document.body.innerText) && /QA Journey Vinyl/.test(document.body.innerText) && /QA Journey Poster/.test(document.body.innerText)", "Vault");
    await sleep(3000);
    check("[11 vault] the Vault lists all three items in the clean browser", true);
    const vt = await S.text();
    check("[11 vault] Vault total value matches Home's estimated value", new RegExp("TOTAL VALUE\\s*\\n?\\s*\\$" + valDb).test(vt), vt.match(/TOTAL VALUE[\s\S]{0,20}/));

    // 12. ITEM details saved by the first browser are what this browser sees
    const slab = items.find((i) => i.title === "QA Journey Slab");
    await open("/vault/item/" + slab.id, "/QA Show/.test(document.body.innerText)", "Item page");
    await sleep(2000);
    const it = await S.text();
    check("[12 item] the edited details (cost $125, source, location, storage) are all present in the clean browser", /\$125/.test(it) && /QA Show/.test(it) && /QA City/.test(it) && /QA Shelf 2/.test(it), it.slice(0, 300));

    // 13. EXHIBITION in the clean browser: listed, opens, arranged order intact
    await open("/museum", "/QA Journey Exhibition/.test(document.body.innerText)", "Exhibitions list");
    check("[13 exhibition] the exhibition is in the clean browser's Exhibitions list", true);
    await open("/museum/" + gal.id, "document.body.innerText.includes('Edit/Add') && document.querySelectorAll('[data-slot-idx] img, [data-slot-idx]').length > 0", "Exhibition page");
    await sleep(6000);
    const slotTitles = await S.evaluate("[...document.querySelectorAll('[data-slot-idx]')].map((e) => e.innerText).filter((x) => /QA Journey/.test(x)).map((x) => (x.match(/QA Journey \\w+/) || [''])[0])");
    check("[13 exhibition] the editor shows the arranged order (not the order they were picked)", JSON.stringify(slotTitles) === JSON.stringify(expectOrder), { slotTitles, expectOrder });

    // 14. VISITOR sees the same arranged order
    const V = await browser(BASE, { withSession: false });
    try {
      await V.go("/museum/share/" + gal.public_token); await V.waitFor("document.body.innerText.includes('QA Journey Exhibition') && /QA Journey (Slab|Vinyl|Poster)/.test(document.body.innerText)", 90000, "visitor page");
      await sleep(5000);
      const vt2 = await V.text();
      const seen = [...vt2.matchAll(/QA Journey (Slab|Vinyl|Poster)/g)].map((x) => "QA Journey " + x[1]);
      const uniq = seen.filter((x, i) => seen.indexOf(x) === i);
      check("[14 visitor] the visitor sees the pieces in the arranged order", JSON.stringify(uniq) === JSON.stringify(expectOrder), { uniq, expectOrder });
    } finally { await V.close(); }

    // 15. RETURN NAVIGATION
    await open("/museum/" + gal.id, "document.body.innerText.includes('Back to Exhibitions')", "Exhibition page (nav)");
    await S.clickText("Back to Exhibitions"); await S.waitFor("location.pathname === '/museum'", 30000, "back to /museum");
    check("[15 nav] 'Back to Exhibitions' returns to the Exhibitions list", (await S.path()) === "/museum");
    await S.clickText("Home"); await S.waitFor("location.pathname === '/dashboard'", 30000, "Home from nav");
    check("[15 nav] 'Home' returns to Home", (await S.path()).startsWith("/dashboard"));
    await open("/vault", "/QA Journey Slab/.test(document.body.innerText)", "Vault (nav)");
    const hrefOf = await S.evaluate("[...document.querySelectorAll('a')].find((a) => /QA Journey Slab/.test(a.textContent))?.getAttribute('href')");
    await S.evaluate("[...document.querySelectorAll('a')].find((a) => /QA Journey Slab/.test(a.textContent))?.click(); true");
    await S.waitFor("location.pathname.startsWith('/vault/item/')", 30000, "item page by tapping the card");
    check("[15 nav] tapping an item card in the Vault opens that item", (await S.path()).startsWith("/vault/item/"), { hrefOf, path: await S.path() });
    await S.waitFor("document.body.innerText.includes('QA Show')", 90000, "item page content");
    await S.evaluate("history.back(); true"); await S.waitFor("location.pathname === '/vault'", 30000, "browser back to /vault");
    await S.waitFor("/QA Journey Slab/.test(document.body.innerText)", 90000, "Vault after back");
    check("[15 nav] browser Back from the item returns to the Vault with the items still listed (no blank Vault)", true);
    await S.clickText("Vault"); await sleep(2500);
    info("page load times (ms), clean browser, live", timing);
    const blank = await S.c.diag.failures.filter((f) => !f.canceled).length;
    info("failed (non-cancelled) network requests during this part", blank);
  } catch (e) { console.log("STOPPED", e.message); fail++; }
  finally { await S.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });

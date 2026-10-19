// ITM interrupted connection: requests to the items table are refused (503 answered by the audit through CDP Fetch). A failed save must be visible and not silently lost.
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, byLabel, typeIn, ENTER, ESC, text, dbItem, dbWait, mkItem, sleep, admin, dismissBanner, P } = X;
const INTERCEPT = ["*/api/ai/*", "*/api/billing/*", "*/api/auth/*", "*/api/newsletter*", "*/api/waitlist*", "*/api/push/*", "*/api/clubs/notify*", "*/api/launch-access*", "*/api/admin/*", "*/api/card-lookup*", "*/api/psa-lookup*", "*/api/upc-lookup*", "*/api/comic-lookup*", "*/api/vinyl-lookup*", "*supabase.co/auth/v1/*", "*supabase.co/functions/v1/*"];
const block = (S, on) => S.send("Fetch.enable", { patterns: [...INTERCEPT, ...(on ? ["*supabase.co/rest/v1/vault_items*"] : [])].map((urlPattern) => ({ urlPattern })) });
(async () => {
  let S = await X.S_("owner", { width: 1440, height: 900 });
  const { ck, nt, out } = X.makeCk(() => S, {});
  const PG = (e = "") => `/vault/item/[id] | owner, Personal, desktop 1440, items table refused${e ? ", " + e : ""}`;
  const seen = async (re, ms = 6000) => { const t0 = Date.now(); let t = ""; while (Date.now() - t0 < ms) { t = await text(S); const extra = await S.evaluate(`[...document.querySelectorAll('[role=status],[role=alert],[aria-live]')].map(e=>e.innerText).join(' ')`); t = t + ' ' + extra; if (re.test(t)) return t; await sleep(250); } return t; };
  try {
    // ---------- A. item page: notes ----------
    let id = await mkItem("net1", { title: "QA ITM net item", purchase_price: 40, current_value: 100 });
    await X.openItem(S, id); await dismissBanner(S);
    await block(S, true); S.intercepted.length = 0;
    await mclick(S, byLabel("^Edit notes$")); await sleep(400);
    await mclick(S, `document.querySelector('textarea')`); await typeIn(S, "NET-NOTE offline edit", { clear: true });
    await mclick(S, byText("^Save$", "button"));
    const t1 = await seen(/not in your account yet|will keep trying|could not save|couldn.t save|only on this device/i, 40000);
    const refused = S.intercepted.filter((x) => /vault_items/.test(x.url)).length;
    let d = await dbItem(id);
    await ck(/not in your account yet|will keep trying|could not save|couldn.t save|only on this device/i.test(t1), { page: PG(), control: "Notes -> Save while the account refuses the save", expected: "A visible message says the edit is only on this device / not saved to the account", actual: `refused requests=${refused}; message: ${(t1.match(/(Saved on this device[^.]*\.|[^.]*not in your account[^.]*\.|[^.]*could not[^.]*\.)/i) || ["NONE visible within 40s"])[0]}; db notes=${JSON.stringify(d.notes)}`, impact: "data loss", repro: "Block requests to vault_items; edit and save a note" });
    t1.length; const shown = /NET-NOTE offline edit/.test(await text(S));
    await ck(shown, { page: PG(), control: "Unsaved edit stays on screen", expected: "The edited note is still shown (not reverted, not lost)", actual: `shown=${shown}`, repro: "As above" });
    // reload while still refused: local copy must still hold it
    await X.openItem(S, id); await sleep(1500);
    const afterReload = /NET-NOTE offline edit/.test(await text(S));
    await ck(afterReload, { page: PG("reload while still offline"), control: "Edit kept on this device after reload", expected: "After a reload the note is still there (waiting to upload)", actual: `shown=${afterReload}; db notes=${JSON.stringify((await dbItem(id)).notes)}`, impact: "data loss", repro: "Reload while the account is still refusing" });
    const pill = await S.evaluate(`(() => { const e=[...document.querySelectorAll('*')].find(x=>/waiting to upload|not saved|saving|sync/i.test(x.getAttribute('aria-label')||'') || /waiting to upload|not in your account|will keep trying/i.test(x.innerText||'') && x.children.length===0); return e ? (e.getAttribute('aria-label')||e.innerText).slice(0,120) : ''; })()`);
    nt({ page: PG("after reload"), control: "Save status indicator", expected: "Observation: whether the app keeps showing that something is waiting to upload", actual: pill || "no persistent indicator found on the item page", impact: "improvement", repro: "Reload while offline" });
    // restore connection, new page load triggers the retry
    await block(S, false);
    await X.openItem(S, id); await sleep(2500);
    d = (await dbWait(id, (r) => (r.notes || "").includes("NET-NOTE"), 60000));
    await ck(d.ok, { page: PG("connection restored"), control: "Waiting edit uploads after the connection returns", expected: "Within a minute of reopening the item with a working connection the note reaches the account", actual: `db notes=${JSON.stringify(d.row.notes)}`, impact: "data loss", repro: "Restore the connection; open the item" });

    // ---------- B. item page: header title ----------
    await block(S, true);
    await mclick(S, byLabel("^Edit title and category$")); await sleep(400);
    await mclick(S, `document.querySelector('input[aria-label=Title]')`); await typeIn(S, "QA ITM net title edit", { clear: true });
    await mclick(S, byLabel("^Save title and classification$"));
    const t2 = await seen(/not in your account yet|will keep trying|could not save|couldn.t save|only on this device/i, 40000);
    d = await dbItem(id); const h1 = await S.evaluate(`(document.querySelector('h1') ? document.querySelector('h1').innerText.trim() : (document.querySelector('input[aria-label=Title]')||{}).value || '')`);
    await ck(/not in your account yet|will keep trying|could not save|couldn.t save|only on this device/i.test(t2), { page: PG(), control: "Title Save while the account refuses the save", expected: "A visible message says it was not saved to the account (the title may stay on screen)", actual: `h1="${h1.slice(0, 40)}"; db title="${d.title}"; message: ${(t2.match(/(Saved on this device[^.]*\.|[^.]*not in your account[^.]*\.)/i) || ["NONE visible within 40s"])[0]}`, impact: "data loss", repro: "Block vault_items; rename the item" });
    // ---------- C. delete while refused ----------
    await mclick(S, byLabel("^Delete item$")); await sleep(500);
    await mclick(S, byText("^Delete Forever$", "[role=dialog] button")); await sleep(3000);
    const t3 = await text(S); d = await dbItem(id);
    await ck(!!d && /could not|try again|failed|error/i.test(t3.slice(t3.indexOf("DELETE ITEM") >= 0 ? t3.indexOf("DELETE ITEM") : 0)) && (await S.path()).includes("/vault/item/"), { page: PG(), control: "Delete Forever while the account refuses", expected: "The item is NOT removed from the account, stays on screen, and the dialog says it could not delete", actual: `path=${await S.path()}; db row still exists=${!!d}; dialog text: ${(t3.match(/(Could not[^.]*\.|[^.]*try again[^.]*\.)/i) || ["no error text"])[0]}`, impact: "data loss", repro: "Block vault_items; Delete item -> Delete Forever" });
    // close dialog if open
    await ESC(S); await sleep(300);
    await block(S, false);
    await S.close();

    // ---------- D. For Sale page: Set asking price ----------
    id = await mkItem("net2", { title: "QA ITM net sale", status: "FOR_SALE", asking_price: 60, purchase_price: 20 });
    S = await X.S_("owner", { width: 1440, height: 900 });
    await S.visit("/vault/for-sale"); await sleep(2500); await dismissBanner(S);
    const card = `[...document.querySelectorAll('article')].find(a => a.innerText.includes("QA ITM net sale"))`;
    await block(S, true);
    await mclick(S, `${card}.querySelector('input[aria-label="Asking price"]')`); await typeIn(S, "123", { clear: true });
    await mclick(S, `${card}.querySelector('button[aria-label="Set asking price"]')`); await sleep(900);
    const saved = await S.evaluate(`!!${card}.querySelector('button[aria-label="Price saved"]')`);
    const tTick0 = Date.now(); const t4 = await seen(/not in your account yet|will keep trying|could not save|couldn.t save|only on this device/i, 40000);
    d = await dbItem(id);
    await ck(!(saved && Number(d.asking_price) !== 123 && !/not in your account yet|will keep trying|could not save|couldn.t save|only on this device/i.test(t4)), { page: `/vault/for-sale | owner, Personal, desktop 1440, items table refused`, control: "Asking price -> Set while the account refuses", expected: "The green 'Price saved' tick must not be shown as if saved when the account refused; a message says it is only on this device", actual: `'Price saved' tick shown=${saved}; db asking_price=${d.asking_price} (typed 123); any warning text: ${/not in your account yet|will keep trying|could not save|couldn.t save|only on this device/i.test(t4)}`, impact: "misleading result", repro: "Block vault_items; For Sale: type a price; Set" });
    // mark sold while refused
    await S.evaluate(`(() => { window.__pq = ["55", "eBay"]; window.prompt = () => window.__pq.shift(); return true; })()`);
    await mclick(S, `[...${card}.querySelectorAll('button')].find(b=>/^Mark sold$/.test(b.innerText.trim()))`); await sleep(1500);
    const t5 = await seen(/sold for \$55|not in your account yet|will keep trying/i, 45000); d = await dbItem(id);
    await ck(!(/sold for \$55/.test(t5) && d.status !== "SOLD" && !/not in your account yet|will keep trying|could not save|couldn.t save|only on this device/i.test(t5)), { page: `/vault/for-sale | owner, Personal, desktop 1440, items table refused`, control: "Mark sold while the account refuses", expected: "If the sale did not reach the account the page says so, not only 'sold for $55'", actual: `page says: ${(t5.match(/QA ITM net sale sold for[^.]*\./) || ["no sold message"])[0]}; db status=${d.status}; warning text present=${/not in your account yet|will keep trying|could not save|couldn.t save|only on this device/i.test(t5)}`, impact: "misleading result", repro: "Block vault_items; For Sale -> Mark sold" });
    await block(S, false);
    await S.visit("/vault/for-sale"); await sleep(3000);
    d = await dbWait(id, (r) => r.status === "SOLD", 60000);
    await ck(d.ok, { page: `/vault/for-sale | owner, Personal, desktop 1440, connection restored`, control: "Sale made while refused uploads afterwards", expected: "When the connection returns the pending sale reaches the account", actual: `db status=${d.row.status}, sold_price=${d.row.sold_price}`, impact: "data loss", repro: "Restore the connection and reopen For Sale" });
  } catch (e) { console.error("SUITE ERROR", e); try { await ck(false, { page: "suite", control: "net suite runner", expected: "completes", actual: "script error (test mistake candidate): " + String(e.message).slice(0, 200), impact: "none" }); } catch {} }
  finally { console.log(JSON.stringify(X.sumRows(out))); try { await S.close(); } catch {} process.exit(0); }
})();

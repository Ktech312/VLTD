// ITM: sold item page (SALE DETAILS, Return to Vault), Delete item (cancel / confirm / refused connection / exhibit references), Business profile separation and empty states.
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, byLabel, ESC, text, dbItem, dbWait, mkItem, sleep, admin, dismissBanner, P, B, ST, m } = X;
const INTERCEPT = ["*/api/ai/*", "*/api/billing/*", "*/api/auth/*", "*/api/newsletter*", "*/api/waitlist*", "*/api/push/*", "*/api/clubs/notify*", "*/api/launch-access*", "*/api/admin/*", "*/api/card-lookup*", "*/api/psa-lookup*", "*/api/upc-lookup*", "*/api/comic-lookup*", "*/api/vinyl-lookup*", "*supabase.co/auth/v1/*", "*supabase.co/functions/v1/*"];
const block = (S, on) => S.send("Fetch.enable", { patterns: [...INTERCEPT, ...(on ? ["*supabase.co/rest/v1/vault_items*"] : [])].map((urlPattern) => ({ urlPattern })) });
const WIDTH = Number(process.argv[2] || 1440);
const MOBILE = WIDTH < 500;
const dev = MOBILE ? "phone 390 (browser-emulated)" : "desktop 1440";
const has = (S, sel) => S.evaluate(`!!document.querySelector(${JSON.stringify(sel)})`);
(async () => {
  let S = await X.S_("owner", { width: WIDTH, height: MOBILE ? 800 : 900, mobile: MOBILE });
  const { ck, nt, bl, out } = X.makeCk(() => S, {});
  const PG = (e = "") => `/vault/item/[id] | owner, Personal, ${dev}${e ? ", " + e : ""}`;
  try {
    if (!process.env.SKIP_SOLD) {
    // ---------- sold item page ----------
    const sid = await mkItem("sdp", { title: "QA ITM sold page item", status: "SOLD", sold_price: 200, sold_at: Date.now() - 2 * 86400e3, sold_platform: "eBay", purchase_price: 50, purchase_tax: 5, current_value: 90 });
    await S.visit(`/vault/item/${sid}?sold=1`); await sleep(2500); await dismissBanner(S);
    let t = await text(S);
    await ck(/SALE DETAILS/.test(t) && /Sold Price\s*\$200/.test(t) && /Profit \/ Loss\s*\+\$145/.test(t) && /Sold Date/.test(t), { page: PG("sold item (?sold=1)"), control: "SALE DETAILS card", expected: "Sold Price $200; Profit/Loss +$145 (200 - cost 55); a sold date", actual: (t.match(/SALE DETAILS.{0,140}/) || [t.slice(80, 240)])[0], repro: "Open /vault/item/<id>?sold=1" });
    await ck(!/Mark for sale/.test(t) || true, { page: PG("sold item"), control: "Sold item page tools", expected: "Observation", actual: `Mark for sale toggle present=${/Mark for sale/.test(t)}; 'Return to Vault' present=${/Return to Vault/.test(t)}; Listing copy: ${(t.match(/Available while an item is for sale\./) || ["-"])[0]}`, impact: "none", repro: "Open sold item" });
    S.dialogMode = "dismiss"; S.dialogs.length = 0;
    await mclick(S, byText("^Return to Vault$", "button")); await sleep(1200);
    let d = await dbItem(sid);
    await ck(d.status === "SOLD" && S.dialogs.some((x) => x.type === "confirm"), { page: PG("sold item"), control: "Return to Vault -> Cancel", expected: "A confirmation is asked; Cancel leaves the sale as it is", actual: `status=${d.status}; dialogs=${JSON.stringify(S.dialogs)}`, repro: "Return to Vault; dismiss" });
    S.dialogMode = "accept";
    await mclick(S, byText("^Return to Vault$", "button")); await sleep(3500);
    d = await dbWait(sid, (r) => r.status === "COLLECTION", 30000);
    t = await text(S);
    await ck(d.ok && d.row.sold_price === null && d.row.sold_at === null && !/SALE DETAILS/.test(t), { page: PG("sold item"), control: "Return to Vault -> OK", expected: "Item is a normal collection item again: sold price/date cleared, SALE DETAILS gone", actual: `status=${d.row.status} sold_price=${d.row.sold_price} sold_at=${d.row.sold_at}; SALE DETAILS still shown=${/SALE DETAILS/.test(t)}; platform=${d.row.sold_platform}`, repro: "Return to Vault; OK" });
    await ck(d.row && d.row.sold_platform === null, { page: PG("after Return to Vault"), control: "Return to Vault clears the sold platform too", expected: "sold_platform is cleared with the rest of the sale", actual: `sold_platform=${d.row && d.row.sold_platform}`, impact: "misleading result", repro: "Return a sold item; read sold_platform" });
    S.dialogMode = "dismiss";

    }
    // ---------- Delete ----------
    const target = `qa_vz_${ST}_${process.env.DEL_N || 26}`;
    const refsBefore = {
      gi: ((await admin.from("gallery_items").select("gallery_id,artifact_id").eq("artifact_id", target)).data || []),
      gal: ((await admin.from("galleries").select("id,title,layout").eq("profile_id", P)).data || []).filter((g) => JSON.stringify(g.layout).includes(target)),
      items: (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", P)).count,
    };
    await X.openItem(S, target); await dismissBanner(S);
    const title = await S.evaluate(`document.querySelector('h1').innerText.trim()`);
    await mclick(S, byLabel("^Delete item$")); await sleep(600);
    const dlg = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\\s+/g,' ') : ''; })()`);
    await ck(/DELETE ITEM/.test(dlg) && dlg.includes(title.slice(0, 20)) && /cannot be undone/.test(dlg), { page: PG("item inside an exhibit"), control: "Delete item (trash icon)", expected: "A confirmation names the item and says it cannot be undone", actual: dlg.slice(0, 200), repro: "Click the trash icon top right" });
    await ESC(S); await sleep(500);
    let d2 = await dbItem(target);
    await ck(!!d2 && !(await has(S, "[role=dialog]")), { page: PG(), control: "Delete dialog -> Escape", expected: "Escape closes it; the item stays", actual: `item exists=${!!d2}; dialog open=${await has(S, "[role=dialog]")}`, repro: "Open Delete; Escape" });
    await mclick(S, byLabel("^Delete item$")); await sleep(500);
    await mclick(S, byText("^Cancel$", "[role=dialog] button")); await sleep(500);
    d2 = await dbItem(target);
    await ck(!!d2 && !(await has(S, "[role=dialog]")), { page: PG(), control: "Delete dialog -> Cancel", expected: "Cancel closes the dialog; the item stays", actual: `item exists=${!!d2}`, repro: "Open Delete; Cancel" });
    // refused connection
    await block(S, true);
    await mclick(S, byLabel("^Delete item$")); await sleep(500);
    await mclick(S, byText("^Delete Forever$", "[role=dialog] button"));
    let dtxt = ""; for (let i = 0; i < 70; i++) { dtxt = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\\s+/g,' ') : '(no dialog)'; })()`); if (/Could not|try again|failed/i.test(dtxt) || dtxt === "(no dialog)") break; await sleep(500); }
    d2 = await dbItem(target);
    await ck(!!d2 && /Could not|try again|failed|error/i.test(dtxt) && (await S.path()).includes(target), { page: PG("account refuses"), control: "Delete Forever while the account refuses", expected: "The item stays in the account and on screen, and the dialog says it could not be deleted", actual: `db row exists=${!!d2}; path=${await S.path()}; dialog: ${dtxt.slice(0, 200)}`, impact: "data loss", repro: "Block vault_items; Delete item -> Delete Forever" });
    await block(S, false); await ESC(S); await sleep(500);
    // confirm for real
    await S.close(); S = await X.S_("owner", { width: WIDTH, height: MOBILE ? 800 : 900, mobile: MOBILE });
    await X.openItem(S, target); await dismissBanner(S);
    await mclick(S, byLabel("^Delete item$")); await sleep(500);
    await mclick(S, byText("^Delete Forever$", "[role=dialog] button")); await sleep(3500);
    const gone = await dbWait(target, (r) => r === null, 20000).catch(() => ({ ok: false }));
    const row = await admin.from("vault_items").select("id").eq("id", target).maybeSingle();
    const itemsAfter = (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", P)).count;
    await ck(!row.data && itemsAfter === refsBefore.items - 1, { page: PG("item inside an exhibit"), control: "Delete Forever", expected: `Only that item is removed (${refsBefore.items} -> ${refsBefore.items - 1} items) and the page leaves for the Vault`, actual: `row gone=${!row.data}; items now ${itemsAfter}; path=${await S.path()}`, impact: "privacy/data loss", repro: "Delete item -> Delete Forever" });
    await ck((await S.path()) === "/vault", { page: PG(), control: "After Delete Forever the page goes to the Vault", expected: "/vault", actual: await S.path(), repro: "As above" });
    const refsAfter = {
      gi: ((await admin.from("gallery_items").select("gallery_id,artifact_id").eq("artifact_id", target)).data || []),
      gal: ((await admin.from("galleries").select("id,title,layout").eq("profile_id", P)).data || []).filter((g) => JSON.stringify(g.layout).includes(target)),
    };
    nt({ page: PG(), control: "Exhibition references to the deleted item", expected: "Observation", actual: `before: ${refsBefore.gi.length} gallery_items rows, ${refsBefore.gal.length} room layouts mention it; after: ${refsAfter.gi.length} gallery_items rows, ${refsAfter.gal.length} room layouts still mention the deleted id`, impact: "none", repro: "Delete an item that is in an exhibit; read the rooms" });
    // the room still opens
    const g = refsBefore.gal[0];
    if (g) {
      await S.visit(`/gallery/${g.id}`); await sleep(3500);
      const gt = await text(S); const crashed = /Something went wrong|Application error|could not be found|Unexpected/i.test(gt);
      await ck(!crashed, { page: `/gallery/[galleryId] | owner, Personal, ${dev}, room whose item was deleted`, control: "Open the exhibit that held the deleted item", expected: "The room opens normally without the deleted item (no error page)", actual: `crashed=${crashed}; page: ${gt.slice(60, 200)}; deleted title still shown=${gt.includes(title)}`, repro: "Delete an item in an exhibit; open that exhibit" });
      await ck(!gt.includes(title), { page: `/gallery/[galleryId] | owner, Personal, ${dev}`, control: "Deleted item no longer shown in the exhibit", expected: "The deleted item's title is not shown any more", actual: `title '${title.slice(0, 30)}' shown=${gt.includes(title)}`, repro: "As above" });
    }
    await X.openItem(S, target); await sleep(800);
    t = await text(S);
    await ck(/Item not found/.test(t), { page: PG("deleted id"), control: "Open the URL of a deleted item", expected: "'Item not found.'", actual: t.slice(60, 140), repro: "Open /vault/item/<deleted id>" });
    await S.close();

    // ---------- Business profile ----------
    const bf = await mkItem("biz_fs", { title: "QA ITM biz for sale", status: "FOR_SALE", asking_price: 77, purchase_price: 20 }, B);
    S = await X.S_("business", { width: WIDTH, height: MOBILE ? 800 : 900, mobile: MOBILE });
    const PGb = (route, e = "") => `${route} | owner, Business, ${dev}${e ? ", " + e : ""}`;
    await S.visit("/vault/sold"); await sleep(2500); await dismissBanner(S);
    t = await text(S);
    await ck(/No sold items yet/.test(t) && !/QA Sold|QA ITM sold/.test(t), { page: PGb("/vault/sold", "no sales"), control: "Sold empty state (Business)", expected: "'No sold items yet.' and none of the Personal profile's sales", actual: (t.match(/No sold items yet\.|Loading sold items…/) || [t.slice(60, 160)])[0] + `; Personal sale titles shown=${/QA Sold|QA ITM sold/.test(t)}`, repro: "Switch to Business; open Sold" });
    await S.visit("/vault/for-sale"); await sleep(2500);
    t = await text(S);
    await ck(/QA ITM biz for sale/.test(t) && !/QA ITM sell item|QA ITM mark sold/.test(t) && (await S.evaluate(`document.querySelectorAll('article').length`)) === 1, { page: PGb("/vault/for-sale", "1 Business item for sale"), control: "For Sale (Business, populated)", expected: "Only the Business item is listed (1 card), none of the Personal for-sale items", actual: `cards=${await S.evaluate(`document.querySelectorAll('article').length`)}; biz item shown=${/QA ITM biz for sale/.test(t)}; personal item shown=${/QA ITM sell item|QA ITM mark sold/.test(t)}`, repro: "Business profile; open For Sale" });
    await S.visit("/sales"); await sleep(3000);
    t = await text(S);
    await ck(/No sales yet|Your sales are on the Sold page/.test(t) && !/QA Ledger|QA ITM/.test(t), { page: PGb("/sales", "empty"), control: "Sales History empty state (Business)", expected: "'No sales yet.' and none of the Personal profile's rows", actual: (t.match(/No sales yet|Your sales are on the Sold page/) || [t.slice(60, 160)])[0], repro: "Business profile; open /sales" });
    await S.visit(`/vault/item/${X.ID.valued}`); await sleep(3000);
    t = await text(S);
    await ck(/Item not found/.test(t) && !/QA Album 1/.test(t.replace(/Item not found/, "")), { page: PGb("/vault/item/[id]", "a PERSONAL item"), control: "Open a Personal item while the Business profile is active", expected: "'Item not found.' (Personal and Business are separate)", actual: t.slice(60, 160), repro: "Switch to Business; open a Personal item's URL" });
    await S.visit(`/vault/item/${bf}`); await sleep(3000);
    t = await text(S);
    await ck(/QA ITM biz for sale/.test(t) && /Listed for sale/.test(t), { page: PGb("/vault/item/[id]", "a Business item for sale"), control: "Business item page", expected: "Opens with 'Listed for sale' and its title", actual: (t.match(/QA ITM biz for sale.{0,60}/) || [t.slice(60, 160)])[0], repro: "Business profile; open the item" });
    await S.close();
    // Personal must not show the business item
    S = await X.S_("owner", { width: WIDTH, height: MOBILE ? 800 : 900, mobile: MOBILE });
    await S.visit("/vault/for-sale"); await sleep(2500);
    t = await text(S);
    await ck(!/QA ITM biz for sale/.test(t), { page: PG("/vault/for-sale (Personal)"), control: "Personal For Sale does not list Business items", expected: "The Business item is not shown", actual: `shown=${/QA ITM biz for sale/.test(t)}`, impact: "privacy/data loss", repro: "Personal profile; open For Sale" });
  } catch (e) { console.error("SUITE ERROR", e); try { await ck(false, { page: "suite", control: "del suite runner", expected: "completes", actual: "script error (test mistake candidate): " + String(e.message).slice(0, 200), impact: "none" }); } catch {} }
  finally { console.log(JSON.stringify(X.sumRows(out))); try { await S.close(); } catch {} process.exit(0); }
})();

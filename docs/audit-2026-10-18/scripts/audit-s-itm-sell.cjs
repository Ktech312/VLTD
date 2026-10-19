// ITM selling on the item page: mark for sale, asking price, listing readiness, listing copy (what it exposes), cost-to-sell maths, auction setup, documents, insurance PDF, share sheet, delete.
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, byLabel, typeIn, ENTER, ESC, text, dbItem, dbWait, mkItem, sleep, admin, dismissBanner, m } = X;
const fsx = require("fs"); const pathx = require("path");
const WIDTH = Number(process.argv[2] || 1440);
const MOBILE = WIDTH < 500;
const has = (S, sel) => S.evaluate(`!!document.querySelector(${JSON.stringify(sel)})`);
(async () => {
  const S = await X.S_("owner", { width: WIDTH, height: MOBILE ? 800 : 900, mobile: MOBILE });
  const dev = MOBILE ? "phone 390 (browser-emulated)" : "desktop 1440";
  const PG = (extra = "") => `/vault/item/[id] | owner, Personal, ${dev}${extra ? ", " + extra : ""}`;
  const { ck, nt, bl, out } = X.makeCk(() => S, {});
  const tg = MOBILE ? "m" : "d";
  const open = async (id) => { await X.openItem(S, id); await dismissBanner(S); await sleep(300); };
  try {
    // ---------- A. mark for sale + asking price ----------
    const NOTE = "PRIVATE-NOTE-SELL-QA do not publish";
    let id = await mkItem("sl" + tg, { title: "QA ITM sell item", purchase_price: 40, purchase_tax: 4, current_value: 120, grade: "CGC 9.4", cert_number: "CERT-SELL-1", notes: NOTE, description: "Public description for the listing", order_number: "ORD-SELL-SECRET", storage_location: "LOC-SELL-SECRET" });
    await open(id);
    let t = await text(S);
    await ck(/Mark for sale/.test(t) && /Mark for sale to unlock/.test(t), { page: PG("not for sale"), control: "Mark for sale toggle + 'Mark for sale to unlock' (Listing copy)", expected: "Not-for-sale item offers the toggle and a locked Listing copy block", actual: (t.match(/Mark for sale.{0,80}/) || [""])[0], repro: "Open a collection item" });
    await mclick(S, `document.querySelector('[role=switch][aria-label="Mark for sale"], button[aria-label="Mark for sale"]')`); await sleep(1800);
    let d = await dbWait(id, (r) => r.status === "FOR_SALE", 25000);
    t = await text(S);
    await ck(d.ok && /Listed for sale/.test(t), { page: PG(), control: "Mark for sale (toggle)", expected: "Status becomes FOR_SALE in the account and the card reads 'Listed for sale'", actual: `db status=${d.row.status}; page: ${(t.match(/Listed for sale.{0,60}/) || ["no 'Listed for sale'"])[0]}`, repro: "Click the Mark for sale toggle" });
    nt({ page: PG(), control: "Mark for sale pre-fills the asking price", expected: "Observation: turning on For Sale also saves an asking price equal to the item's market value when none exists (not typed by the Curator)", actual: `db asking_price=${d.row.asking_price} (value was 120, none set before)`, impact: "improvement", repro: "Mark for sale an item with a value and no asking price; read asking_price" });
    // asking price edit
    const askSel = `document.querySelector('label input[type=number]')`;
    await mclick(S, askSel); await typeIn(S, "150", { clear: true }); await X.TAB(S); await sleep(1800);
    d = await dbWait(id, (r) => Number(r.asking_price) === 150, 25000);
    await ck(d.ok, { page: PG("for sale"), control: "Asking Price (type 150, leave box)", expected: "asking_price = 150 saved", actual: `db asking_price=${d.row.asking_price}`, repro: "Mark for sale; type an asking price; click elsewhere" });
    const msgPos = await S.evaluate(`(() => { const el = [...document.querySelectorAll('#media div')].find(x=>/Asking price saved/.test(x.innerText||'')); const inp = document.querySelector('label input[type=number]'); if (!el) return { found:false }; const r = el.getBoundingClientRect(); const ir = inp.getBoundingClientRect(); return { found:true, inViewport: r.top >= 0 && r.bottom <= innerHeight, vInput: ir.top >= 0 && ir.bottom <= innerHeight, y: Math.round(r.top), iy: Math.round(ir.top) }; })()`);
    await ck(msgPos.found && msgPos.inViewport, { page: PG("for sale"), control: "Confirmation after saving the asking price", expected: "A person sees that the price was saved without scrolling (message near the field or in view)", actual: `message is in the MEDIA card (found=${msgPos.found}); on screen while the field is on screen: ${msgPos.inViewport} (message top ${msgPos.y}px, field top ${msgPos.iy}px)`, impact: "usability", repro: "For-sale item; edit asking price; look for 'Asking price saved.'" });
    // negative
    await mclick(S, askSel); await typeIn(S, "-5", { clear: true }); await X.TAB(S); await sleep(1800);
    d = await dbWait(id, (r) => r.asking_price === null, 15000);
    const shown = await S.evaluate(`document.querySelector('label input[type=number]').value`);
    await ck(d.ok && shown !== "-5", { page: PG("for sale"), control: "Asking Price (negative -5)", expected: "A negative price is refused or cleared, and the box does not keep showing -5 as if it were saved", actual: `db asking_price=${d.row.asking_price}; box still shows "${shown}"`, repro: "Type -5 in Asking Price and tab out", impact: "misleading result" });
    await mclick(S, askSel); await typeIn(S, "99", { clear: true }); await X.TAB(S); await sleep(1500);
    await dbWait(id, (r) => Number(r.asking_price) === 99, 15000);
    // ---------- B. listing readiness + listing copy ----------
    t = await text(S);
    const ready = await S.evaluate(`(() => { const s=[...document.querySelectorAll('div')].find(x=>/Ready to list|Almost ready|Not ready|Listing readiness/i.test((x.innerText||'').slice(0,60)) && x.innerText.length<900); return s ? s.innerText.replace(/\\s+/g,' ').slice(0,420) : ''; })()`);
    await ck(/Title/.test(ready) && /Asking price/.test(ready) && /\$99/.test(ready) && /Photo/.test(ready), { page: PG("for sale, price 99, photo, grade, notes"), control: "Listing readiness panel", expected: "Lists Title, Asking price ($99), Photo, Grade, Description, Subject with the item's real state", actual: ready, repro: "For-sale item: read the readiness panel" });
    // the listing copy
    const ta = await S.evaluate(`(() => { const t=[...document.querySelectorAll('textarea[readonly]')][0]; return t ? t.value : null; })()`);
    await ck(!!ta, { page: PG("for sale"), control: "Listing copy text box", expected: "A paste-ready text for the chosen marketplace", actual: ta ? ta.slice(0, 100).replace(/\n/g, " | ") : "none", repro: "For-sale item: scroll to Listing Copy" });
    if (ta) {
      const leaks = [];
      if (/Recorded cost basis/i.test(ta)) leaks.push("cost basis line (what was paid)");
      if (ta.includes("PRIVATE-NOTE-SELL-QA")) leaks.push("the private INTERNAL NOTE text");
      if (/ORD-SELL-SECRET|LOC-SELL-SECRET/.test(ta)) leaks.push("order number/storage location");
      await ck(leaks.length === 0, { page: PG("for sale; cost 40+tax 4; internal note and public description both set"), control: "Listing copy for a marketplace (what it contains)", expected: "Paste-ready text for strangers must not contain what the Curator paid or the notes labelled 'ONLY YOU SEE THESE'; it should use the PUBLIC description", actual: `copy text contains: ${leaks.join("; ") || "nothing private"}. Uses description text: ${ta.includes("Public description for the listing")}; excerpt: ${ta.replace(/\n/g, " | ").slice(0, 380)}`, impact: "privacy/data loss", repro: "Mark an item for sale that has a purchase price and an internal note; open Listing Copy; read the text / Copy Listing" });
    }
    // ---------- D. insurance ----------
    await mclick(S, byText("^Add to Insurance$", "button")); await sleep(700);
    const insDlg = await S.evaluate(`(() => { const d=[...document.querySelectorAll('div')].find(x=>/Export Insurance Documentation/.test(x.innerText||'') && x.innerText.length<500); return d ? d.innerText.replace(/\\s+/g,' ') : ''; })()`);
    await ck(/Add to Insurance|added|policy|packet/i.test(insDlg) && !/Export Insurance Documentation/.test(insDlg), { page: PG(), control: "Add to Insurance", expected: "The label promises the item is added to the insurance packet/inventory; the result should match that promise", actual: `Clicking opens: "${insDlg.slice(0, 200)}" (a print-to-PDF export dialog; nothing is added anywhere)`, impact: "misleading result", repro: "Item Summary: click Add to Insurance" });
    // ---------- E. auction ----------
    id = await mkItem("au" + tg, { title: "QA ITM auction item", purchase_price: 10, current_value: 60, is_public: false });
    await open(id);
    await mclick(S, byText("^Start Auction", "button")); await sleep(700);
    const sheet = await has(S, '[role=dialog][aria-label="Auction setup"]');
    await ck(sheet, { page: PG("private item"), control: "Start Auction", expected: "Opens the Auction setup sheet", actual: sheet ? "sheet open" : "no sheet", repro: "Click Start Auction" });
    const inputs = `document.querySelectorAll('[role=dialog][aria-label="Auction setup"] input[type=number]')`;
    await mclick(S, `${inputs}[0]`); await typeIn(S, "-5", { clear: true });
    await mclick(S, `${inputs}[1]`); await typeIn(S, "2", { clear: true });
    await mclick(S, `${inputs}[2]`); await typeIn(S, "1", { clear: true });
    await ESC(S); await sleep(500);
    const sheetAfterEsc = await has(S, '[role=dialog][aria-label="Auction setup"]');
    await ck(!sheetAfterEsc, { page: PG(), control: "Auction setup -> Escape", expected: "Escape closes the sheet without starting an auction", actual: sheetAfterEsc ? "still open" : "closed", repro: "Open Start Auction; Escape" });
    let dd = await dbItem(id);
    await ck(dd.auction_status !== "ACTIVE" && dd.is_public === false, { page: PG(), control: "Auction setup closed with Escape leaves the item untouched", expected: "No auction and still private", actual: `auction_status=${dd.auction_status}; is_public=${dd.is_public}`, repro: "Open the sheet; type values; Escape" });
    await mclick(S, byText("^Start Auction", "button")); await sleep(700);
    await mclick(S, `${inputs}[0]`); await typeIn(S, "-5", { clear: true });
    await mclick(S, `${inputs}[1]`); await typeIn(S, "2", { clear: true });
    await mclick(S, `${inputs}[2]`); await typeIn(S, "1", { clear: true });
    await mclick(S, byText("^Start Auction$", "[role=dialog] button")); await sleep(2000);
    dd = (await dbWait(id, (r) => r.auction_status === "ACTIVE", 25000)).row;
    await ck(!(Number(dd.auction_starting_bid) <= 0), { page: PG("starting bid -5, reserve 2, buy-it-now 1"), control: "Start Auction with a negative starting bid", expected: "A negative opening bid is refused or corrected", actual: `db auction_starting_bid=${dd.auction_starting_bid}; reserve_price=${dd.reserve_price}; buy_it_now_price=${dd.buy_it_now_price}`, impact: "misleading result", repro: "Start Auction; starting bid -5; Start" });
    await ck(!(Number(dd.buy_it_now_price) < Number(dd.reserve_price)) , { page: PG(), control: "Start Auction with Buy-It-Now below the reserve", expected: "Buy It Now lower than the reserve/starting bid is refused or warned", actual: `reserve=${dd.reserve_price}, buy-it-now=${dd.buy_it_now_price}`, impact: "misleading result", repro: "Reserve 2, Buy It Now 1" });
    await ck(dd.is_public === true, { page: PG("was private"), control: "Start Auction makes the item public", expected: "Observation to verify the side effect: the item is now public (is_public=true) although the Curator never used the visibility eye", actual: `is_public=${dd.is_public}, status=${dd.status}`, repro: "Start an auction on a private item; read is_public" });
    t = await text(S);
    await ck(/Manage Auction/.test(t), { page: PG(), control: "Start Auction button becomes Manage Auction", expected: "The button reads Manage Auction with a countdown", actual: (t.match(/(Manage Auction|Start Auction).{0,20}/) || [""])[0], repro: "After starting" });
    // cancel auction
    await mclick(S, byText("^Manage Auction", "button")); await sleep(700);
    await mclick(S, byText("^Cancel Auction$", "[role=dialog] button")); await sleep(2000);
    dd = (await dbWait(id, (r) => r.auction_status === "CANCELLED", 25000)).row;
    await ck(dd.auction_status === "CANCELLED" && dd.status === "COLLECTION", { page: PG(), control: "Cancel Auction", expected: "Auction cancelled and the item is back to COLLECTION", actual: `auction_status=${dd.auction_status}, status=${dd.status}`, repro: "Manage Auction -> Cancel Auction" });
    await ck(dd.is_public === false, { page: PG("item was private before the auction"), control: "Cancel Auction restores the item's privacy", expected: "After cancelling, an item that was private is private again (the Curator never made it public)", actual: `is_public=${dd.is_public} after Cancel Auction (still publicly visible: ${dd.is_public === true})`, impact: "privacy/data loss", repro: "Private item -> Start Auction -> Manage Auction -> Cancel Auction; read is_public" });
    // ---------- F. documents ----------
    id = await mkItem("dc" + tg, { title: "QA ITM docs item" });
    await open(id);
    const f = pathx.join(__dirname, "itm-doc-1.txt"); fsx.writeFileSync(f, "QA ITM document for the audit. Safe to delete.");
    const doc = await S.send("DOM.getDocument", {}); const q = await S.send("DOM.querySelectorAll", { nodeId: doc.root.nodeId, selector: "input[type=file]" });
    // the documents input is the one without accept and with multiple, after the media inputs
    let target = null;
    for (const nid of q.nodeIds) { const attrs = (await S.send("DOM.getAttributes", { nodeId: nid })).attributes; const o = {}; for (let i = 0; i < attrs.length; i += 2) o[attrs[i]] = attrs[i + 1]; if (!("accept" in o)) target = nid; }
    await S.send("DOM.setFileInputFiles", { nodeId: target, files: [f] }); await sleep(3000);
    t = await text(S);
    const docRows = await admin.from("vault_documents").select("*").eq("item_id", id);
    await ck(/itm-doc-1\.txt/.test(t) && /Saved — private/.test(t), { page: PG(), control: "Documents -> Upload file", expected: "The file is listed and the message says it is private", actual: `listed=${/itm-doc-1\.txt/.test(t)}; message=${(t.match(/Saved — private[^.]*\./) || ["none"])[0]}; db rows=${(docRows.data || []).length} (${docRows.error?.message || "ok"})`, repro: "DOCUMENTS: Upload file; choose a text file" });
    if ((docRows.data || []).length) {
      const row = docRows.data[0];
      nt({ page: PG(), control: "Document row", expected: "Observation: columns " + Object.keys(row).join(","), actual: `shared flag fields: ${JSON.stringify(Object.fromEntries(Object.entries(row).filter(([k]) => /share|public|private/i.test(k))))}`, impact: "none", repro: "n/a" });
    }
    await mclick(S, byText("^Share$", "li button")); await sleep(1500);
    look = await S.look(); t = await text(S);
    await ck((look.clip || []).some((x) => /^https?:/.test(x)) && /7 days/.test(t), { page: PG(), control: "Documents -> Share", expected: "A time-limited link is copied and the message says it works for 7 days", actual: `clip=${JSON.stringify((look.clip || []).slice(-1))}; message: ${(t.match(/Share link copied[^.]*\./) || ["none"])[0]}`, repro: "Share on a document" });
    await mclick(S, byText("^Remove$", "button")); await sleep(2000);
    const docRows2 = await admin.from("vault_documents").select("id").eq("item_id", id);
    t = await text(S);
    await ck((docRows2.data || []).length === 0 && !/itm-doc-1\.txt/.test(t), { page: PG(), control: "Documents -> Remove", expected: "The document disappears from the page and the account", actual: `db rows left=${(docRows2.data || []).length}; still listed=${/itm-doc-1\.txt/.test(t)}`, repro: "Remove a document" });
    // video clip section
    t = await text(S);
    bl({ page: PG(), control: "Video clip section", expected: "Section appears only for beta-tester accounts (isVideoEnabled(email)); the QA account is not one and no privilege may be granted", actual: `video section present: ${/video clip|add a clip|upload.*video/i.test(t)}`, impact: "none", repro: "n/a" });
  } catch (e) { console.error("SUITE ERROR", e); try { await ck(false, { page: "suite", control: "sell suite runner", expected: "completes", actual: "script error (test mistake candidate): " + String(e.message).slice(0, 200), impact: "none" }); } catch {} }
  finally { console.log(JSON.stringify(X.sumRows(out))); await S.close(); process.exit(0); }
})();

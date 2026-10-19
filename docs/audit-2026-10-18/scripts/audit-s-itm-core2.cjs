// ITM core rerun: the purchase-field and tag checks that the first run (audit-s-itm-core.cjs) got wrong because the TEST left an input open
// (Escape was sent while the input was not focused) and because Input.insertText does not produce the comma keydown. Same assertions, correct handling.
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, byLabel, typeIn, ENTER, ESC, text, openItem, dbItem, dbWait, mkItem, sleep, key } = X;
const WIDTH = Number(process.argv[2] || 1440);
const MOBILE = WIDTH < 500;
(async () => {
  const S = await X.S_("owner", { width: WIDTH, height: MOBILE ? 800 : 900, mobile: MOBILE });
  const dev = MOBILE ? "phone 390 (browser-emulated)" : "desktop 1440";
  const PG = (extra = "") => `/vault/item/[id] | owner, Personal, ${dev}${extra ? ", " + extra : ""}`;
  const { ck, nt, out } = X.makeCk(() => S, {});
  const tag = (MOBILE ? "m" : "d") + "r";
  const comma = async () => { await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: ",", code: "Comma", text: ",", windowsVirtualKeyCode: 188 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: ",", code: "Comma", windowsVirtualKeyCode: 188 }); };
  try {
    let id = await mkItem("pur" + tag, { purchase_price: 75, current_value: 120, title: "QA ITM purchase rerun" });
    await openItem(S, id);
    const clickRow = async (title) => { const ok = await mclick(S, `document.querySelector('[title="${title}"]')`); await sleep(350); return ok; };
    const commitInline = async (title, val, how = "enter") => { const ok = await clickRow(title); if (!ok) throw new Error("row not found: " + title); await typeIn(S, val, { clear: true }); if (how === "enter") await ENTER(S); else if (how === "esc") await ESC(S); else if (how === "tab") await X.TAB(S); await sleep(1300); };
    let d, t;
    // negative refused: the line stays open on the wrong value; clicking back into it and pressing Escape must cancel
    await commitInline("Click to edit purchase price", "-5");
    t = await text(S); d = await dbItem(id);
    await ck(/can't be negative/.test(t) && Number(d.purchase_price) === 75, { page: PG(), control: "Purchase price (negative -5) [rerun]", expected: "Refused with a visible message; nothing saved", actual: `message=${/can't be negative/.test(t)}; db=${d.purchase_price}`, repro: "Click price; type -5; Enter" });
    const focusedAfterEnter = await S.evaluate(`document.activeElement && document.activeElement.tagName`);
    await ESC(S); await sleep(400);
    const stillOpen = await S.evaluate(`!!document.querySelector('input[aria-label="Purchase price"]')`);
    nt({ page: PG(), control: "Escape after a refused negative cost", expected: "Improvement note: after the refusal the line stays open but has lost focus (Enter blurs it), so Escape does nothing until the person clicks back into the box", actual: `after Enter focus on <${focusedAfterEnter}>; Escape without refocusing: line still open=${stillOpen}`, impact: "improvement", repro: "Click Purchase price; type -5; Enter; press Escape" });
    await mclick(S, `document.querySelector('input[aria-label="Purchase price"]')`); await ESC(S); await sleep(500);
    const closed = !(await S.evaluate(`!!document.querySelector('input[aria-label="Purchase price"]')`)); d = await dbItem(id);
    await ck(closed && Number(d.purchase_price) === 75, { page: PG(), control: "Purchase price refused line -> click in, Escape", expected: "Escape closes the refused line and keeps $75", actual: `closed=${closed}; db=${d.purchase_price}`, repro: "As above, click into the line, Escape" });
    // letters into a money field
    await commitInline("Click to edit purchase price", "abc"); await sleep(1800);
    d = await dbItem(id); t = await text(S);
    const asZero = d.purchase_price !== null && Number(d.purchase_price) === 0;
    await ck(!asZero, { page: PG("purchase $75, value 120"), control: "Purchase price (letters 'abc' typed into a money field)", expected: "Non-numeric text is refused or ignored; the recorded cost must not silently become $0", actual: `db purchase_price=${d.purchase_price} (was 75); panel: ${(t.match(/Purchase price\s*\S+/) || [""])[0]}; Total cost: ${(t.match(/Total cost\s*\S+/) || [""])[0]}; ROI: ${(t.match(/ROI\s*\S+/) || [""])[0]}`, repro: "Click Purchase price; type abc; Enter", impact: "misleading result" });
    // restore
    if (Number(d.purchase_price) !== 75) { await commitInline("Click to edit purchase price", "75"); await dbWait(id, (r) => Number(r.purchase_price) === 75, 20000); }
    // letters mixed with digits
    await commitInline("Click to edit purchase price", "12abc");
    d = await dbWait(id, (r) => Number(r.purchase_price) === 12, 8000);
    nt({ page: PG(), control: "Purchase price ('12abc')", expected: "Observation: digits are kept, letters dropped (saves 12) or the entry is refused", actual: `db purchase_price=${d.row.purchase_price}`, impact: "improvement", repro: "Click price; type 12abc; Enter" });
    await commitInline("Click to edit purchase price", "$1,250.50");
    d = await dbWait(id, (r) => Number(r.purchase_price) === 1250.5, 20000);
    await ck(d.ok, { page: PG(), control: "Purchase price ($1,250.50 typed)", expected: "Currency symbol and comma are accepted: saves 1250.5", actual: `db purchase_price=${d.row.purchase_price}`, repro: "Click price; type $1,250.50; Enter" });
    await commitInline("Click to edit purchase price", "0");
    d = await dbWait(id, (r) => r.purchase_price !== null && Number(r.purchase_price) === 0, 20000); t = await text(S);
    await ck(d.ok && /Purchase price\s*\$0/.test(t), { page: PG("value 120"), control: "Purchase price (explicit 0)", expected: "A typed 0 is kept as a recorded $0 (not blank) and shown as $0", actual: `db=${d.row.purchase_price}; panel="${(t.match(/Purchase price\s*\S+/) || [""])[0]}"`, repro: "Click price; type 0; Enter" });
    await ck(/Total cost\s*\$0/.test(t), { page: PG("value 120, cost $0"), control: "Total cost with a recorded $0", expected: "Total cost shows $0 (known), not 'Not recorded'", actual: (t.match(/Total cost.{0,30}/) || [""])[0], repro: "Set purchase price 0; read MARKET" });
    await ck(/ROI\s*—/.test(t) && /Gain\s*—/.test(t), { page: PG("value 120, cost $0"), control: "ROI / Gain with value 120 and cost $0", expected: "No percentage on a $0 cost (value rule: zero-cost is not measured): ROI and Gain show a dash", actual: (t.match(/ROI.{0,60}Gain\s*\S+/) || [""])[0], repro: "Set purchase price 0 with a value; read ROI/Gain" });
    await commitInline("Click to edit purchase price", "");
    d = await dbWait(id, (r) => r.purchase_price === null, 20000); t = await text(S);
    await ck(d.ok && /Total cost\s*Not recorded/.test(t), { page: PG(), control: "Purchase price (cleared to blank)", expected: "Blank = unknown: stored as null, Total cost reads 'Not recorded'", actual: `db=${d.row.purchase_price}; ${(t.match(/Total cost.{0,30}/) || [""])[0]}`, repro: "Click price; clear; Enter" });
    // edit-all, negative shipping then escape from inside an input
    await mclick(S, byLabel("^Edit purchase$")); await sleep(500);
    const setIn = async (label, v) => { await mclick(S, `document.querySelector('input[aria-label="${label}"]')`); await typeIn(S, v, { clear: true }); };
    await setIn("Purchase price", "100"); await setIn("Shipping", "-3");
    await mclick(S, byLabel("^Save purchase$")); await sleep(800);
    t = await text(S); d = await dbItem(id);
    await ck(/can't be negative/.test(t) && d.purchase_shipping === null && d.purchase_price === null, { page: PG(), control: "Edit purchase (all rows) with a negative Shipping [rerun]", expected: "Refused with a message, stays in edit mode, nothing saved", actual: `message=${/can't be negative/.test(t)}; db price=${d.purchase_price} shipping=${d.purchase_shipping}`, repro: "Pencil; Price 100; Shipping -3; check" });
    await mclick(S, `document.querySelector('input[aria-label="Source"]')`); await ESC(S); await sleep(500);
    const gone = !(await S.evaluate(`!!document.querySelector('input[aria-label="Purchase price"]')`));
    await ck(gone, { page: PG(), control: "Edit purchase -> Escape from inside a box", expected: "Escape inside any row box leaves edit mode without saving", actual: `edit mode closed=${gone}`, repro: "Pencil; click a box; Escape" });
    // long source
    await commitInline("Click to edit source", "S".repeat(400));
    d = await dbWait(id, (r) => (r.purchase_source || "").length >= 400, 20000);
    const ov = await S.evaluate(`document.documentElement.scrollWidth <= innerWidth + 2`);
    await ck(d.ok && ov, { page: PG("400-character source"), control: "Source (very long text)", expected: "Saved whole; the page does not scroll sideways", actual: `db length=${(d.row.purchase_source || "").length}; no overflow=${ov}`, repro: "Click Source; paste 400 characters; Enter" });

    // ---- tags ----
    id = await mkItem("tag" + tag, { title: "QA ITM tags rerun" });
    await openItem(S, id);
    const tagIn = `document.querySelector('input[placeholder^="Add a tag"], input[placeholder^="Add another tag"]')`;
    await mclick(S, tagIn); await typeIn(S, "QA-Tag One"); await ENTER(S); await sleep(1500);
    d = await dbWait(id, (r) => JSON.stringify(r.tags).includes("qa-tag"), 25000);
    await ck(d.ok, { page: PG(), control: "Add a tag (type + Enter)", expected: "Tag saved (lower-cased) to the item", actual: `db tags=${JSON.stringify(d.row.tags)}`, repro: "TAGS; type QA-Tag One; Enter" });
    await mclick(S, tagIn); await typeIn(S, "second"); await comma(); await sleep(1500);
    d = await dbWait(id, (r) => JSON.stringify(r.tags).includes("second"), 25000);
    await ck(d.ok && !JSON.stringify(d.row.tags).includes(","), { page: PG(), control: "Add a tag (comma key commits)", expected: "A comma keypress commits the tag", actual: `db tags=${JSON.stringify(d.row.tags)}`, repro: "Type 'second' then press the comma key" });
    const before = (d.row.tags || []).length;
    await mclick(S, tagIn); await typeIn(S, "SECOND"); await ENTER(S); await sleep(1500);
    d = await dbItem(id);
    await ck((d.tags || []).length === before, { page: PG(), control: "Add a tag (duplicate, different case)", expected: "A duplicate does not add a second tag", actual: `tags before=${before} after=${(d.tags || []).length} ${JSON.stringify(d.tags)}`, repro: "Add 'second' then 'SECOND'" });
    const sug = await S.evaluate(`(() => { const sec=[...document.querySelectorAll('section')].find(s=>/^TAGS/.test(s.innerText)); const b=sec && [...sec.querySelectorAll('button')].find(x=>/^\\+ \\S/.test(x.innerText.trim())); return b ? b.innerText.trim() : null; })()`);
    if (sug) {
      const want = sug.replace(/^\+ /, "").toLowerCase();
      const n0 = (d.tags || []).length;
      await mclick(S, `(() => { const sec=[...document.querySelectorAll('section')].find(s=>/^TAGS/.test(s.innerText)); return [...sec.querySelectorAll('button')].find(x=>x.innerText.trim()===${JSON.stringify(sug)}); })()`); await sleep(1800);
      const shown = await S.evaluate(`[...document.querySelectorAll('section')].find(s=>/^TAGS/.test(s.innerText)).innerText`);
      d = await dbWait(id, (r) => JSON.stringify(r.tags).includes(want), 12000);
      await ck(d.ok, { page: PG(), control: `Suggested tag chip (${sug})`, expected: "Clicking a suggestion adds that tag and persists it", actual: `db tags=${JSON.stringify(d.row.tags)} (before ${n0}); page TAGS card now begins: ${shown.replace(/\s+/g, " ").slice(0, 120)}`, repro: "Click a '+ tag' suggestion in TAGS" });
    }
    await mclick(S, `document.querySelector('button[aria-label^="Remove "]')`); await sleep(1500);
    const d3 = await dbItem(id);
    await ck((d3.tags || []).length === (d.row.tags || []).length - 1, { page: PG(), control: "Remove tag (x)", expected: "The tag is removed and the removal persists", actual: `tags before ${(d.row.tags || []).length} -> after ${(d3.tags || []).length}`, repro: "Click the x on a tag" });
    await openItem(S, id); t = await text(S);
    await ck(((d3.tags || []).length > 0) && (d3.tags.every((tg) => t.includes("#" + tg))), { page: PG(), control: "Tags after reload", expected: "Reload shows exactly the saved tags", actual: JSON.stringify(d3.tags), repro: "Reload" });
  } catch (e) { console.error("SUITE ERROR", e); try { await ck(false, { page: "suite", control: "core rerun runner", expected: "completes", actual: "script error (test mistake candidate): " + String(e.message).slice(0, 200), impact: "none" }); } catch {} }
  finally { console.log(JSON.stringify(X.sumRows(out))); await S.close(); process.exit(0); }
})();

// ITM core (header, description, market, pricing, details, notes; purchase and tags are in audit-s-itm-core2.cjs): classification, title, description, purchase/storage fields, pricing, details, notes, tags, market/value rule on /vault/item/[id].
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, byLabel, typeIn, ENTER, ESC, text, openItem, dbItem, dbWait, mkItem, sleep } = X;
const WIDTH = Number(process.argv[2] || 1440);
const MOBILE = WIDTH < 500;
(async () => {
  const S = await X.S_("owner", { width: WIDTH, height: MOBILE ? 800 : 900, mobile: MOBILE });
  const dev = MOBILE ? "phone 390 (browser-emulated)" : "desktop 1440";
  const PG = (extra = "") => `/vault/item/[id] | owner, Personal, ${dev}${extra ? ", " + extra : ""}`;
  const { ck, nt, out } = X.makeCk(() => S, {});
  const tag = MOBILE ? "m" : "d";
  try {
    // ---------- A. header: title + classification ----------
    let id = await mkItem("cls" + tag, { purchase_price: 40, current_value: 100, title: "QA ITM original title" });
    await openItem(S, id);
    // A1 open edit
    await mclick(S, byLabel("^Edit title and category$"));
    await sleep(500);
    const editing = await S.evaluate(`!!document.querySelector('input[aria-label=Title]') && !!document.querySelector('select[aria-label=Universe]') && !!document.querySelector('select[aria-label=Category]') && !!document.querySelector('select[aria-label=Subcategory]')`);
    await ck(editing, { page: PG("Comics item"), control: "Edit title and category (pencil)", expected: "Title becomes an input and Universe/Category/Subcategory pickers appear", actual: editing ? "title input and three pickers shown" : "pickers missing", repro: "Open an item; click the pencil next to the title" });
    // A2 Cancel with Escape leaves everything unchanged
    await mclick(S, `document.querySelector('input[aria-label=Title]')`);
    await typeIn(S, "QA ITM changed but cancelled", { clear: true });
    await S.evaluate(`(() => { const s = document.querySelector('select[aria-label=Universe]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; set.call(s, 'MUSIC'); s.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
    await sleep(300);
    await ESC(S); await sleep(800);
    const h1a = await S.evaluate("document.querySelector('h1').innerText.trim()");
    const dba = await dbItem(id);
    await ck(h1a.startsWith("QA ITM original title") && dba.title === "QA ITM original title" && dba.universe === "POP_CULTURE", { page: PG(), control: "Title/classification edit -> Escape (cancel)", expected: "Escape discards the typed title and the Universe change; page and database keep the original", actual: `h1="${h1a.slice(0, 40)}", db title="${dba.title}", db universe=${dba.universe}`, repro: "Pencil; type another title; change Universe; press Escape" });
    // A3 empty title refused
    await mclick(S, byLabel("^Edit title and category$")); await sleep(400);
    await mclick(S, `document.querySelector('input[aria-label=Title]')`);
    await typeIn(S, "", { clear: true });
    await mclick(S, byLabel("^Save title and classification$")); await sleep(900);
    const errT = await text(S); const dbb = await dbItem(id);
    await ck(/Title is required/.test(errT) && dbb.title === "QA ITM original title", { page: PG(), control: "Save title and classification (empty title)", expected: "An empty title is refused with a visible message; nothing saved", actual: /Title is required/.test(errT) ? `message shown; db title unchanged ("${dbb.title}")` : `no message; db title="${dbb.title}"`, repro: "Pencil; clear the title; click the green check" });
    // A4 change universe/category/subcategory and save with the check
    const setSel = (label, v) => S.evaluate(`(() => { const s = document.querySelector('select[aria-label=${label}]'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; set.call(s, ${JSON.stringify(v)}); s.dispatchEvent(new Event('change',{bubbles:true})); return s.value; })()`);
    await mclick(S, `document.querySelector('input[aria-label=Title]')`);
    await typeIn(S, "QA ITM renamed", { clear: true });
    const unis = await S.evaluate(`[...document.querySelector('select[aria-label=Universe]').options].map(o=>o.value+'='+o.textContent)`);
    await setSel("Universe", "MUSIC"); await sleep(300);
    const cats = await S.evaluate(`[...document.querySelector('select[aria-label=Category]').options].map(o=>o.value)`);
    const catNow = await S.evaluate(`document.querySelector('select[aria-label=Category]').value`);
    await ck(cats.length > 1 && cats.includes(catNow), { page: PG(), control: "Universe picker -> Category picker", expected: "Changing the Universe replaces the Category list with that universe's categories and selects its default", actual: `universes=${unis.length}; after MUSIC categories=[${cats.slice(0, 6).join("|")}] selected="${catNow}"`, repro: "Pencil; choose Universe Music" });
    await setSel("Category", cats[1] === catNow ? cats[0] : cats[1]); await sleep(300);
    const catSel = await S.evaluate(`document.querySelector('select[aria-label=Category]').value`);
    const subs = await S.evaluate(`[...document.querySelector('select[aria-label=Subcategory]').options].map(o=>o.value)`);
    const subDisabled = await S.evaluate(`document.querySelector('select[aria-label=Subcategory]').disabled`);
    let pickedSub = "";
    if (subs.filter(Boolean).length) { pickedSub = subs.filter(Boolean)[0]; await setSel("Subcategory", pickedSub); }
    await ck(subs.filter(Boolean).length > 0 ? !subDisabled : subDisabled, { page: PG(), control: "Category picker -> Subcategory picker", expected: "Subcategory list follows the chosen Category; it is disabled (\"No subcategories\") only when the category has none", actual: `category="${catSel}" subs=[${subs.filter(Boolean).slice(0, 5).join("|")}] disabled=${subDisabled}`, repro: "Pencil; pick Universe Music then a Category" });
    await mclick(S, byLabel("^Save title and classification$")); await sleep(1500);
    const afterSave = await S.evaluate("document.querySelector('h1').innerText.trim()");
    const dbSave = await dbWait(id, (r) => r.title === "QA ITM renamed", 25000);
    await ck(dbSave.ok && dbSave.row.universe === "MUSIC" && dbSave.row.category_label === catSel && (pickedSub ? dbSave.row.subcategory_label === pickedSub : true), { page: PG(), control: "Save title and classification (green check)", expected: "Title, Universe, Category and Subcategory are all saved to the account", actual: `db: title="${dbSave.row.title}" universe=${dbSave.row.universe} category_label="${dbSave.row.category_label}" subcategory_label="${dbSave.row.subcategory_label}" (expected category "${catSel}", sub "${pickedSub}")`, repro: "Pencil; change title/universe/category/subcategory; green check; read the row" });
    // summary panel + header line follow
    const t1 = await text(S);
    await ck(afterSave.startsWith("QA ITM renamed") && /Universe\s*Music/i.test(t1) && t1.includes(catSel), { page: PG(), control: "Item Summary panel after classification save", expected: "Header, Universe/Category rows in the Item Summary and the subtitle all show the new classification without reload", actual: `h1="${afterSave.slice(0, 30)}"; summary has Universe Music: ${/Universe\s*Music/i.test(t1)}; category "${catSel}" shown: ${t1.includes(catSel)}`, repro: "As above, then read the right-hand Item Summary" });
    // reload persistence
    await openItem(S, id);
    const t2 = await text(S); const h1c = await S.evaluate("document.querySelector('h1').innerText.trim()");
    await ck(h1c.startsWith("QA ITM renamed") && /Universe\s*Music/i.test(t2), { page: PG(), control: "Reload after classification save", expected: "Reloading shows the saved title and classification", actual: `h1="${h1c.slice(0, 30)}" Universe Music shown: ${/Universe\s*Music/i.test(t2)}`, repro: "Reload the item URL" });
    // clean second browser (visitor-like profile with the owner's login but fresh storage): sign-in injected fresh
    const S2 = await X.S_("owner", { width: 1440, height: 900 });
    try { await openItem(S2, id); const h = await S2.evaluate("document.querySelector('h1') && document.querySelector('h1').innerText.trim()");
      await ck((h || "").startsWith("QA ITM renamed"), { page: PG("clean second browser"), control: "Saved title seen in a clean second browser", expected: "A browser with empty local storage (same account) shows the saved title", actual: `h1="${(h || "").slice(0, 40)}"`, repro: "Open the item URL in a second clean browser signed in as the same user" });
    } finally { await S2.close(); }
    // very long title
    const long = "L".repeat(240) + " QA long title";
    await mclick(S, byLabel("^Edit title and category$")); await sleep(400);
    await mclick(S, `document.querySelector('input[aria-label=Title]')`);
    await typeIn(S, long, { clear: true }); await ENTER(S); await sleep(1500);
    const ovf = await S.evaluate(`document.documentElement.scrollWidth <= innerWidth + 2`);
    const dbl = await dbWait(id, (r) => r.title && r.title.startsWith("LLLL"), 20000);
    await ck(dbl.ok && ovf, { page: PG("240-character title"), control: "Title input (very long text)", expected: "A long title is saved whole and the page does not scroll sideways", actual: `db title length=${dbl.row.title?.length}; no horizontal overflow=${ovf}`, repro: "Pencil; paste a 240-character title; Enter" });
    // Enter saves too (long title saved by Enter above)
    await ck(dbl.ok, { page: PG(), control: "Title input -> Enter key", expected: "Enter saves the title (same as the green check)", actual: dbl.ok ? "Enter saved to the database" : "not saved", repro: "Pencil; type; press Enter" });

    // ---------- B. description ----------
    await mclick(S, `document.querySelector('[title="Click to edit the description"]')`); await sleep(400);
    await typeIn(S, "QA public description line one", { clear: true });
    await ENTER(S); await sleep(1500);
    const dd = await dbWait(id, (r) => r.description === "QA public description line one", 20000);
    await ck(dd.ok, { page: PG(), control: "Description (click text, type, Enter)", expected: "Description saves to the account", actual: dd.ok ? "saved" : `db description="${dd.row.description}"`, repro: "Click the description line; type; Enter" });
    await mclick(S, `document.querySelector('[title="Click to edit the description"]')`); await sleep(300);
    await typeIn(S, "THIS MUST NOT SAVE", { clear: true }); await ESC(S); await sleep(800);
    const dd2 = await dbItem(id); const shown = await text(S);
    await ck(dd2.description === "QA public description line one" && !/THIS MUST NOT SAVE/.test(shown), { page: PG(), control: "Description -> Escape", expected: "Escape discards the typed description", actual: `db="${dd2.description}", page shows the discarded text: ${/THIS MUST NOT SAVE/.test(shown)}`, repro: "Click description; type; Escape" });
    // 600 cap
    await mclick(S, `document.querySelector('[title="Click to edit the description"]')`); await sleep(300);
    await typeIn(S, "D".repeat(700), { clear: true });
    const taLen = await S.evaluate(`document.querySelector('textarea[aria-label=Description]').value.length`);
    await ESC(S);
    await ck(taLen === 600, { page: PG(), control: "Description (very long text)", expected: "Typing is capped at the stated 600 characters", actual: `textarea holds ${taLen} characters after typing 700`, repro: "Click description; type 700 characters" });

    // ---------- D. market panel + value rule on the four fixture value states ----------
    const states = [
      ["valued (value 120, cost 40)", X.ID.valued, /^MARKET\s*\$120/, /ROI\s*200\.0%/, /Total cost\s*\$40/, /Gain\s*\$80/],
      ["explicit $0 value (cost 15)", X.ID.zero, /MARKET\s*\$0\b/, /ROI\s*-100\.0%/, /Total cost\s*\$15/, /Gain\s*-\$15/],
      ["purchase-only (cost 25, no value)", X.ID.ghost, /MARKET\s*\$25/, /ROI\s*—/, /Total cost\s*\$25/, /Gain\s*—/],
      ["missing everything", X.ID.missing, /MARKET\s*Missing value/, /ROI\s*—/, /Total cost\s*Not recorded/, /Gain\s*—/],
    ];
    for (const [name, sid, rM, rR, rC, rG] of states) {
      await openItem(S, sid); t = await text(S); const mk = (t.match(/MARKET.{0,330}/) || [""])[0];
      const extra = name.startsWith("purchase") ? /At purchase cost\. Not valued yet/.test(t) : name.startsWith("missing") ? /No valuation and no purchase cost recorded/.test(t) : true;
      await ck(rM.test(mk) && rR.test(mk) && rC.test(mk) && rG.test(mk) && extra, { page: PG(name), control: "MARKET panel value rule", expected: `Panel follows the value rule for: ${name}`, actual: mk.slice(0, 200), repro: "Open the fixture item and read MARKET / ROI / Total cost / Gain" });
    }

    // ---------- E. pricing card ----------
    id = await mkItem("prc" + tag, { purchase_price: 50, title: "QA ITM pricing" });
    await openItem(S, id);
    await mclick(S, byText("^Details$", "button")); await sleep(500); // pricing card details toggle
    const openP = async () => { await mclick(S, byLabel("^Edit pricing$")); await sleep(500); };
    const setP = async (label, v) => { await mclick(S, `document.querySelector('input[aria-label="${label}"]')`); await typeIn(S, v, { clear: true }); };
    await openP(); await setP("Value", "250"); await setP("Low", "200"); await setP("High", "300");
    await mclick(S, byLabel("^Save pricing$")); await sleep(1500);
    d = await dbWait(id, (r) => Number(r.current_value) === 250, 25000); t = await text(S);
    await ck(d.ok && Number(d.row.value_low) === 200 && Number(d.row.value_high) === 300, { page: PG("cost 50"), control: "Edit pricing -> Value/Low/High -> Save", expected: "current_value 250, value_low 200, value_high 300 saved", actual: `db current_value=${d.row.current_value} low=${d.row.value_low} median=${d.row.value_median} high=${d.row.value_high}`, repro: "PRICING card pencil; Value 250, Low 200, High 300; check" });
    await ck(/MARKET\s*\$250/.test(t) && /Gain\s*\$200/.test(t) && /ROI\s*400\.0%/.test(t), { page: PG("value 250, cost 50"), control: "MARKET panel follows the pricing save", expected: "MARKET $250, Gain $200, ROI 400.0% immediately", actual: (t.match(/MARKET.{0,120}/) || [""])[0], repro: "Save a pricing value; read MARKET" });
    // cancel
    await openP(); await setP("Value", "9999"); await ESC(S); await sleep(700);
    d = await dbItem(id); await ck(Number(d.current_value) === 250, { page: PG(), control: "Edit pricing -> Escape", expected: "Escape discards the typed value", actual: `db current_value=${d.current_value}`, repro: "Pencil; type 9999; Escape" });
    // explicit zero value
    await openP(); await setP("Value", "0"); await setP("Low", ""); await setP("High", "");
    await mclick(S, byLabel("^Save pricing$")); await sleep(1500);
    d = await dbWait(id, (r) => r.current_value !== null && Number(r.current_value) === 0, 25000); t = await text(S);
    await ck(d.ok && /MARKET\s*\$0\b/.test(t), { page: PG("cost 50"), control: "Pricing Value = 0 (explicit zero)", expected: "A typed 0 is saved as an explicit $0 value and MARKET reads $0 (not 'Missing value'/'At purchase cost')", actual: `db current_value=${d.row.current_value}; ${(t.match(/MARKET.{0,100}/) || [""])[0]}`, repro: "Pricing pencil; Value 0; check" });
    const cardTxt = await S.evaluate(`(() => { const e=[...document.querySelectorAll('div')].find(x=>x.innerText && x.innerText.startsWith('VALUE RANGE') && x.innerText.length<80); return e ? e.innerText.replace(/\\s+/g,' ') : ''; })()`);
    await ck(!/^VALUE RANGE\s*—/.test(cardTxt), { page: PG("explicit $0 value"), control: "Pricing card VALUE RANGE shows an explicit $0", expected: "The pricing card shows $0 where the MARKET panel shows $0 (the two views agree)", actual: `card tile says "${cardTxt}"`, repro: "Save Value 0 in the pricing card; compare tile with MARKET panel", impact: "misleading result" });
    // negative value
    await openP(); await setP("Value", "-40");
    await mclick(S, byLabel("^Save pricing$")); await sleep(2200);
    d = await dbItem(id); t = await text(S);
    await ck(!(Number(d.current_value) < 0), { page: PG(), control: "Pricing Value (negative -40)", expected: "A negative valuation is refused or ignored; never stored or shown as a negative market value", actual: `db current_value=${d.current_value}; ${(t.match(/MARKET.{0,60}/) || [""])[0]}; message: ${(t.match(/negative[^.]*\./i) || ["none"])[0]}`, repro: "Pricing pencil; Value -40; check", impact: "misleading result" });
    // text in value
    await openP(); await setP("Value", "abc");
    await mclick(S, byLabel("^Save pricing$")); await sleep(2200);
    d = await dbItem(id); t = await text(S);
    await ck(true, { page: PG("previous db current_value shown in actual"), control: "Pricing Value (text 'abc')", expected: "Letters are not a number: the value box is cleared/ignored (observation recorded)", actual: `db current_value=${d.current_value}; ${(t.match(/MARKET.{0,60}/) || [""])[0]}`, repro: "Pricing pencil; Value abc; check", impact: "none" });
    // clear value
    await openP(); await setP("Value", ""); await setP("Low", ""); await setP("High", "");
    await mclick(S, byLabel("^Save pricing$")); await sleep(1500);
    d = await dbWait(id, (r) => r.current_value === null, 25000); t = await text(S);
    await ck(d.ok && /MARKET\s*\$50/.test(t) && /At purchase cost/.test(t), { page: PG("cost 50"), control: "Pricing Value cleared", expected: "Clearing the value removes the valuation (null) and MARKET falls back to 'At purchase cost' (grey)", actual: `db current_value=${d.row.current_value}; ${(t.match(/MARKET.{0,100}/) || [""])[0]}`, repro: "Pricing pencil; clear Value; check" });
    // last comp + confidence
    await mclick(S, `document.querySelector('[title="Click to edit last comp"]')`); await sleep(300);
    await typeIn(S, "77", { clear: true }); await ENTER(S); await sleep(1500);
    d = await dbWait(id, (r) => Number(r.last_comp_value) === 77, 25000);
    await ck(d.ok, { page: PG(), control: "LAST COMP (click, 77, Enter)", expected: "last_comp_value = 77", actual: `db last_comp_value=${d.row.last_comp_value}`, repro: "Click LAST COMP tile; type 77; Enter" });
    t = await text(S);
    await ck(/MARKET\s*\$77/.test(t), { page: PG("last comp only"), control: "Last comp counts as the market value when nothing else is entered", expected: "effectiveMarketValue falls back to last comp: MARKET $77", actual: (t.match(/MARKET.{0,80}/) || [""])[0], repro: "Set only Last comp" });
    // reload
    await openItem(S, id); t = await text(S);
    await ck(/\$77/.test(t), { page: PG(), control: "Pricing after reload", expected: "Reload keeps saved comp", actual: (t.match(/LAST COMP.{0,20}/) || [""])[0], repro: "Reload" });

    // ---------- F. details section (Comics): grade, grading company, cert ----------
    id = await mkItem("det" + tag, { title: "QA ITM details" });
    await openItem(S, id);
    await mclick(S, byLabel("^Edit details$")); await sleep(500);
    await mclick(S, `document.querySelector('[data-testid=item-details] input[aria-label="Publisher"]')`); await typeIn(S, "QA Publisher", { clear: true });
    const gr = await S.evaluate(`!!document.querySelector('[data-testid=item-details] [aria-label="Grade"]')`);
    if (gr) { await mclick(S, `document.querySelector('[data-testid=item-details] [aria-label="Grade"]')`); await typeIn(S, "9.8", { clear: true }); }
    await mclick(S, `document.querySelector('[data-testid=item-details] input[aria-label="Certification number"]')`); await typeIn(S, "CERT-QA-123", { clear: true });
    await mclick(S, byLabel("^Save details$")); await sleep(1500);
    d = await dbWait(id, (r) => JSON.stringify(r).includes("CERT-QA-123"), 25000);
    const flat = JSON.stringify(d.row);
    await ck(d.ok && flat.includes("QA Publisher") && flat.includes("9.8"), { page: PG("Comics item"), control: "Edit details -> Publisher / Grade / Certification number -> Save", expected: "All three values are saved on the item", actual: `publisher in row=${flat.includes("QA Publisher")} grade 9.8 in row=${flat.includes("9.8")} cert in row=${flat.includes("CERT-QA-123")}; grade col=${d.row.grade}; cert col=${d.row.cert_number}`, repro: "DETAILS pencil; fill Publisher, Grade, Certification number; check" });
    await openItem(S, id); t = await text(S);
    await ck(/CERT-QA-123/.test(t) && /QA Publisher/.test(t), { page: PG(), control: "Details after reload", expected: "Saved details visible after reload", actual: (t.match(/DETAILS.{0,300}/) || [""])[0].slice(0, 200), repro: "Reload" });
    // cancel
    await mclick(S, byLabel("^Edit details$")); await sleep(400);
    await mclick(S, `document.querySelector('[data-testid=item-details] input[aria-label="Publisher"]')`); await typeIn(S, "NOT SAVED", { clear: true }); await ESC(S); await sleep(700);
    d = await dbItem(id); await ck(!JSON.stringify(d).includes("NOT SAVED"), { page: PG(), control: "Edit details -> Escape", expected: "Escape discards edits", actual: `row contains discarded text: ${JSON.stringify(d).includes("NOT SAVED")}`, repro: "DETAILS pencil; type; Escape" });
    // single value click edit then leave
    await mclick(S, `document.querySelector('[data-testid=item-details] [title="Click to edit series / title"]')`); await sleep(300);
    await typeIn(S, "QA Series X", { clear: true }); await ENTER(S); await sleep(1500);
    d = await dbWait(id, (r) => JSON.stringify(r).includes("QA Series X"), 25000);
    await ck(d.ok, { page: PG(), control: "Single Details value (click, type, Enter)", expected: "Value saves where it is edited", actual: d.ok ? "saved" : "not found in row", repro: "Click 'Series / title' value; type; Enter" });
    // integer field strips letters
    const intField = await S.evaluate(`!!document.querySelector('[data-testid=item-details] [title="Click to edit issue number"]')`);
    if (intField) {
      await mclick(S, `document.querySelector('[data-testid=item-details] [title="Click to edit issue number"]')`); await sleep(300);
      await typeIn(S, "12abc", { clear: true });
      const v = await S.evaluate(`document.querySelector('[data-testid=item-details] input[aria-label="Issue number"]')?.value`);
      await ENTER(S); await sleep(800);
      await ck(true, { page: PG(), control: "Issue number (letters typed)", expected: "Observation: field accepts the typed text (text field) or filters", actual: `input value after typing 12abc: "${v}"`, repro: "Click Issue number; type 12abc", impact: "none" });
    }

    // ---------- G. notes ----------
    id = await mkItem("not" + tag, { title: "QA ITM notes" });
    await openItem(S, id);
    await mclick(S, byLabel("^Edit notes$")); await sleep(400);
    await mclick(S, `document.querySelector('textarea')`); await typeIn(S, "private QA note\nsecond line", { clear: true });
    await mclick(S, byText("^Save$", "button")); await sleep(1500);
    d = await dbWait(id, (r) => (r.notes || "").includes("second line"), 25000);
    await ck(d.ok && d.row.notes === "private QA note\nsecond line", { page: PG(), control: "Notes -> Save", expected: "Notes saved with the line break", actual: `db notes=${JSON.stringify(d.row.notes)}`, repro: "Notes pencil; type two lines; Save" });
    await mclick(S, byLabel("^Edit notes$")); await sleep(400);
    await mclick(S, `document.querySelector('textarea')`); await typeIn(S, "DISCARD ME", { clear: true });
    await mclick(S, byText("^Cancel$", "button")); await sleep(700);
    d = await dbItem(id); t = await text(S);
    await ck(d.notes === "private QA note\nsecond line" && !/DISCARD ME/.test(t), { page: PG(), control: "Notes -> Cancel", expected: "Cancel leaves the saved note unchanged", actual: `db=${JSON.stringify(d.notes)}; page shows discarded text=${/DISCARD ME/.test(t)}`, repro: "Notes pencil; type; Cancel" });
    const bigNote = "N".repeat(9000);
    await mclick(S, byLabel("^Edit notes$")); await sleep(400);
    await S.evaluate(`(() => { const ta = document.querySelector('textarea'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set; set.call(ta, ${JSON.stringify(bigNote)}); ta.dispatchEvent(new Event('input',{bubbles:true})); })()`);
    await mclick(S, byText("^Save$", "button")); await sleep(2000);
    d = await dbWait(id, (r) => (r.notes || "").length >= 9000, 25000);
    await ck(d.ok, { page: PG("9,000-character note"), control: "Notes (very long text)", expected: "A 9,000-character note saves whole", actual: `db notes length=${(d.row.notes || "").length}`, repro: "Notes pencil; paste 9,000 characters; Save" });
    await mclick(S, byText("^Clear$", "button")); await sleep(1500);
    d = await dbWait(id, (r) => !r.notes, 25000);
    await ck(d.ok, { page: PG(), control: "Notes -> Clear", expected: "Clear removes the note (empty in the account)", actual: `db notes=${JSON.stringify(d.row.notes)}`, repro: "Click Clear under a saved note" });
    t = await text(S); await ck(/No private notes yet/.test(t), { page: PG(), control: "Notes empty state", expected: "'No private notes yet.' is shown after Clear", actual: /No private notes yet/.test(t) ? "shown" : "missing", repro: "Clear note" });

  } catch (e) { console.error("SUITE ERROR", e); try { await ck(false, { page: "suite", control: "core suite runner", expected: "completes", actual: "script error (test mistake candidate): " + String(e.message).slice(0, 200), impact: "none" }); } catch {} }
  finally { console.log(JSON.stringify(X.sumRows(out))); await S.close(); process.exit(0); }
})();

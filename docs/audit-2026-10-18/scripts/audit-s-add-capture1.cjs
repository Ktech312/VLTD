// ADD audit, suite 1: /capture (Add Item, guided form) - validation, save persistence (reload, direct URL, clean second browser, database),
// numbers (blank / explicit 0 / negative / long), double click, leaving an unsaved form, Business profile.
const T = require("./audit-s-add-lib.cjs");
const { alertText, session, sleep, man, admin, rec, A, click, clickText, typeInto, pickSelect, text, rowsByTitle, allCount, poll, removeItems, mine, mouseAt, rectOf } = T;
const PG = "/capture | owner, Personal, 26 items";
const PREFIX = "AUD ADD ";
const created = [];
const nameSel = "document.getElementById('capture-item-name')";
const input = (ph) => `[...document.querySelectorAll('input,textarea')].find((e) => e.placeholder === ${JSON.stringify(ph)})`;
const sel = (i) => `document.querySelectorAll('select')[${i}]`;
const labelInput = (lab) => `(() => { const l = [...document.querySelectorAll('label')].find((x) => x.textContent.trim().toLowerCase().startsWith(${JSON.stringify(lab.toLowerCase())})); return l && l.parentElement.querySelector('input,select,textarea'); })()`;
async function openSection(S, n) { await click(S, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('${n}'))`); await sleep(350); }
async function fresh(S) { await S.visit("/capture"); await S.waitFor("document.getElementById('capture-item-name')", 60000, "capture form"); await sleep(400); }
async function save(S) { return click(S, T.btnExpr("^(?:.*\\|)?(Save to Vault|Saving…)$")); }
async function waitSaved(S, ms = 45000) { try { await S.waitFor("location.pathname === '/vault'", ms, "redirect to /vault"); return true; } catch { return false; } }
async function dbRow(title, profile = man().personalId, ms = 30000) { const r = await poll(async () => { const x = await rowsByTitle(profile, title); return x.length ? x : null; }, ms, 1500); return r || []; }

(async () => {
  const m = man(); const P = m.personalId, B = m.businessId;
  await T.removeByPrefix(PREFIX);
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    const before = await allCount(P);
    // ---------------- C1 required name ----------------
    await fresh(S);
    await save(S); await sleep(1500);
    let al = await alertText(S);
    let n = await allCount(P);
    await rec(S, /Item name is required/.test(al) && n === before && (await S.path()) === "/capture", { page: PG, control: "Save to Vault (empty Item name)", expected: "Refuses: names the missing Item name, no row created, stays on the form", actual: `alert='${al}', path=${await S.path()}, items ${before}->${n}`, impact: "usability", repro: "1. Open /capture 2. Leave Item name empty 3. Click Save to Vault" });
    const focused = await S.evaluate("document.activeElement && document.activeElement.id");
    await rec(S, focused === "capture-item-name", { page: PG, control: "Save to Vault (empty Item name) focus", expected: "Focus moves to the missing field", actual: "focused element id = " + focused, impact: "usability", repro: "Click Save with an empty name" });
    // whitespace name
    await typeInto(S, nameSel, "     "); await save(S); await sleep(1500);
    al = await alertText(S); n = await allCount(P);
    await rec(S, /Item name is required/.test(al) && n === before, { page: PG, control: "Save to Vault (name = spaces only)", expected: "Refused like an empty name", actual: `alert='${al}', items ${before}->${n}`, impact: "data loss", repro: "Type 5 spaces in Item name, click Save" });

    // ---------------- C3 negative cost ----------------
    await fresh(S);
    await typeInto(S, nameSel, PREFIX + "NegCost"); await openSection(S, 4);
    await typeInto(S, "document.getElementById('capture-purchase-price')", "-5");
    await save(S); await sleep(1500);
    al = await alertText(S); n = await allCount(P);
    await rec(S, /can't be negative/.test(al) && n === before && (await S.path()) === "/capture", { page: PG, control: "Purchase price = -5 then Save to Vault", expected: "Refused with the plain negative-cost message; nothing saved", actual: `alert='${al.slice(0, 120)}', items ${before}->${n}`, impact: "misleading result", repro: "Item name AD, Value section, Purchase price -5, Save" });
    // negative current value (no stated rule; record what happens)
    await typeInto(S, "document.getElementById('capture-purchase-price')", "5");
    await typeInto(S, labelInput("Current value"), "-40");
    await save(S);
    const savedNegVal = await waitSaved(S, 40000);
    const rNeg = await dbRow(PREFIX + "NegCost"); created.push(...rNeg);
    await rec(S, !(savedNegVal && rNeg[0] && Number(rNeg[0].current_value) < 0), { page: PG, control: "Current value ($) = -40 then Save to Vault", expected: "A negative current value is refused or rejected (a collection value cannot be negative)", actual: `saved=${savedNegVal}; DB current_value=${rNeg[0] && rNeg[0].current_value}`, impact: "misleading result", repro: "Item name AD, Value, Current value -40, Purchase price 5, Save; read the row" });
    await removeItems(rNeg);

    // ---------------- C4 full save: every field ----------------
    await fresh(S);
    const T4 = PREFIX + "Full " + Date.now().toString(36);
    await typeInto(S, nameSel, T4);
    await typeInto(S, input("Optional"), "Alt-Name-Token");
    await typeInto(S, input("e.g. Nintendo, Marvel, Topps"), "Brand-Token");
    await typeInto(S, input("e.g. 1986 Fleer Basketball"), "SetSeries-Token");
    await pickSelect(S, sel(0), "PSA");
    await typeInto(S, input("Cert number"), "CERT-12345");
    await typeInto(S, input("9"), "9.5");
    await pickSelect(S, sel(1), "Near Mint");
    await typeInto(S, input("Add any details about this item…"), "Notes-Token line one");
    await openSection(S, 2);
    await pickSelect(S, sel(2), "Music"); await sleep(400);
    const catOpts = await S.evaluate("[...document.querySelectorAll('select')[3].options].map((o) => o.text.trim())");
    await pickSelect(S, sel(3), catOpts[1] || catOpts[0]); await sleep(300);
    await openSection(S, 3);
    await typeInto(S, input("e.g. Box 12 · Shelf B"), "Shelf-Token");
    await openSection(S, 4);
    await typeInto(S, labelInput("Current value"), "123.45");
    await typeInto(S, "document.getElementById('capture-purchase-price')", "67.89");
    await S.jshot("add-capture-filled");
    await save(S);
    const ok4 = await waitSaved(S, 60000);
    const r4 = await dbRow(T4); created.push(...r4); const x = r4[0] || {};
    await rec(S, ok4 && r4.length === 1, { page: PG, control: "Save to Vault (all fields filled)", expected: "Returns to the Vault and exactly one row exists in my Personal profile", actual: `redirected=${ok4}, rows=${r4.length}`, impact: "data loss", repro: "Fill every field, click Save to Vault" });
    await rec(S, x.profile_id === P && x.status === "COLLECTION" && x.added_via === "manual", { page: PG, control: "Save to Vault (profile/status)", expected: "Row belongs to the active Personal profile, status COLLECTION, added_via manual", actual: JSON.stringify({ profile: (x.profile_id || "").slice(0, 8), status: x.status, via: x.added_via }), impact: "privacy/data loss", repro: "Save a full item, read the row" });
    await rec(S, Number(x.current_value) === 123.45 && Number(x.purchase_price) === 67.89, { page: PG, control: "Current value / Purchase price persisted", expected: "123.45 and 67.89 in the row", actual: `current_value=${x.current_value}, purchase_price=${x.purchase_price}`, impact: "misleading result", repro: "Save with 123.45/67.89, read row" });
    const hay = JSON.stringify(x);
    const want = { "Alternate Name": "Alt-Name-Token", "Brand": "Brand-Token", "Set / Series": "SetSeries-Token", "Certification #": "CERT-12345", "Grade": "9.5", "Notes": "Notes-Token", "Storage location": "Shelf-Token" };
    for (const [lab, tok] of Object.entries(want)) {
      const where = Object.entries(x).filter(([, v]) => typeof v === "string" && v.includes(tok)).map(([k]) => k);
      await rec(S, where.length > 0, { page: PG, control: `${lab} (typed in the form)`, expected: "The value is stored on the saved item", actual: where.length ? `stored in column(s): ${where.join(",")}` : "NOT FOUND anywhere in the saved row", impact: "data loss", repro: `Type '${tok}' in ${lab}, Save, read the row` });
    }
    await rec(S, /PSA/.test(x.grade || "") && /9\.5/.test(x.grade || ""), { page: PG, control: "Certification Company + Grade", expected: "Both kept (e.g. 'PSA 9.5')", actual: "grade=" + x.grade, impact: "misleading result", repro: "PSA + grade 9.5, save" });
    await rec(S, (x.condition || "").toLowerCase().includes("near") || /near/i.test(hay), { page: PG, control: "Condition = Near Mint", expected: "Condition stored", actual: "condition=" + x.condition, impact: "data loss", repro: "Pick Near Mint, save" });
    await rec(S, /music/i.test(x.universe || "") && !!(x.category_label || x.category), { page: PG, control: "Universe = Music + Category", expected: "Universe MUSIC and the chosen category stored", actual: JSON.stringify({ universe: x.universe, category: x.category, category_label: x.category_label, picked: catOpts[1] }), impact: "data loss", repro: "Pick Music + second category, save" });

    // persistence: vault list after redirect, reload, direct URL, clean second browser
    await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 60000, "vault list").catch(() => {}); await sleep(1500);
    let body = await text(S);
    await rec(S, body.includes(T4), { page: "/vault | owner, Personal", control: "Vault list after Save", expected: "The new item is listed after the redirect", actual: body.includes(T4) ? "listed" : "not in the first screen of the list", impact: "misleading result", repro: "Save from /capture, look at /vault" });
    await S.visit("/vault"); body = await text(S);
    await rec(S, body.includes(T4), { page: "/vault | owner, Personal", control: "Vault list after reload", expected: "Item still listed after a reload", actual: body.includes(T4) ? "listed" : "missing after reload", impact: "data loss", repro: "Save then reload /vault" });
    await S.visit("/vault/item/" + x.id); body = await text(S);
    await rec(S, body.includes(T4) && /Brand-Token/.test(body), { page: `/vault/item/${(x.id || "").slice(0, 8)} | owner`, control: "Direct URL of the saved item", expected: "Opens the item with the title and the brand typed", actual: body.includes(T4) ? "title shown; brand " + (/Brand-Token/.test(body) ? "shown" : "NOT shown") : "title not shown: " + body.slice(0, 120), impact: "data loss", repro: "Open /vault/item/<id> directly" });
    await rec(S, /SetSeries-Token/.test(body), { page: `/vault/item/${(x.id || "").slice(0, 8)} | owner`, control: "Set / Series typed on /capture", expected: "The Set / Series value appears on the item page under a label that matches", actual: /SetSeries-Token/.test(body) ? "shown: " + (body.match(/.{0,30}SetSeries-Token.{0,10}/) || [""])[0] : "typed value is not shown on the item page", impact: "misleading result", repro: "Type Set / Series, Save, open the item" });
    await rec(S, /Alt-Name-Token/.test(body), { page: `/vault/item/${(x.id || "").slice(0, 8)} | owner`, control: "Alternate Name typed on /capture", expected: "The alternate name appears on the item page", actual: /Alt-Name-Token/.test(body) ? "shown" : "typed value is not shown on the item page", impact: "misleading result", repro: "Type Alternate Name, Save, open the item" });
    const S2 = await session("owner", { width: 1440, height: 900 });
    try {
      await S2.visit("/vault/item/" + x.id); const b2 = await text(S2);
      await rec(S2, b2.includes(T4) && /Brand-Token/.test(b2), { page: `/vault/item/${(x.id || "").slice(0, 8)} | owner, clean second browser`, control: "Saved item in a clean second browser session (same user)", expected: "Second browser (no local data) shows the item from the cloud", actual: b2.includes(T4) ? "title shown" : "NOT shown: " + b2.slice(0, 120), impact: "data loss", repro: "Save in browser 1, sign in elsewhere, open the item" });
      await S2.visit("/vault"); await S2.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 60000).catch(() => {}); await sleep(1500);
      const l2 = await text(S2);
      await rec(S2, l2.includes(T4), { page: "/vault | owner, clean second browser", control: "Vault list in a clean second browser", expected: "New item listed", actual: l2.includes(T4) ? "listed" : "missing", impact: "data loss", repro: "Save in browser 1, open /vault in browser 2" });
    } finally { await S2.close(); }

    // ---------------- C5 explicit zero / blank / decimals / huge ----------------
    const cases = [
      { t: "ZeroBoth", cur: "0", pur: "0", expCur: 0, expPur: 0 },
      { t: "BlankBoth", cur: "", pur: "", expCur: null, expPur: null },
      { t: "Decimal", cur: "0.5", pur: "1234.567", expCur: 0.5, expPur: 1234.567 },
      { t: "Huge", cur: "99999999999", pur: "123456789012", expCur: 99999999999, expPur: 123456789012 },
      { t: "Exp", cur: "1e3", pur: "2.5e1", expCur: 1000, expPur: 25 },
    ];
    for (const c of cases) {
      await fresh(S); const title = PREFIX + c.t;
      await typeInto(S, nameSel, title); await openSection(S, 4);
      if (c.cur !== "") await typeInto(S, labelInput("Current value"), c.cur);
      if (c.pur !== "") await typeInto(S, "document.getElementById('capture-purchase-price')", c.pur);
      await save(S); const ok = await waitSaved(S, 45000); const rr = await dbRow(title, P, ok ? 25000 : 8000); created.push(...rr); const y = rr[0];
      const eq = (a, b) => (b === null ? a === null : a !== null && Math.abs(Number(a) - b) < 1e-6 * Math.max(1, Math.abs(b)));
      await rec(S, !!y && eq(y.current_value, c.expCur) && eq(y.purchase_price, c.expPur), { page: PG, control: `Value fields: current='${c.cur}' purchase='${c.pur}'`, expected: `current_value=${c.expCur}, purchase_price=${c.expPur}`, actual: y ? `saved=${ok}; current_value=${y.current_value}, purchase_price=${y.purchase_price}` : `no row (redirected=${ok}, error='${await alertText(S)}')`, impact: "misleading result", repro: `Item name, Value section, type ${c.cur || "(blank)"} / ${c.pur || "(blank)"}, Save, read the row` });
    }

    // ---------------- C6 very long text ----------------
    await fresh(S);
    const longTitle = PREFIX + "Long " + "x".repeat(2400);
    await typeInto(S, nameSel, longTitle);
    await typeInto(S, input("Add any details about this item…"), "n".repeat(900));
    const noteLen = await S.evaluate("[...document.querySelectorAll('textarea')][0].value.length");
    await rec(S, noteLen <= 500, { page: PG, control: "Notes (900 characters pasted)", expected: "Capped at the 500 shown in the counter", actual: "textarea holds " + noteLen + " characters", impact: "usability", repro: "Paste 900 characters into Notes" });
    await save(S); const okL = await waitSaved(S, 60000);
    const rL = await poll(async () => { const r = await rowsByTitle(P, PREFIX + "Long"); return r.length ? r : null; }, 25000); created.push(...(rL || []));
    await rec(S, !!rL && rL[0].title.length === longTitle.length, { page: PG, control: "Item name with 2,400 characters", expected: "Saved whole, or refused with a clear message (never silently cut)", actual: rL ? `row saved; title length ${rL[0].title.length} (typed ${longTitle.length}); redirected=${okL}` : `not saved; redirected=${okL}; alert='${await alertText(S)}'`, impact: "data loss", repro: "Paste a 2,400-character name, Save" });
    if (okL) { await S.visit("/vault"); await sleep(1200); const ov = await S.evaluate("document.documentElement.scrollWidth > innerWidth + 4"); await rec(S, !ov, { page: "/vault | owner, with a 2,400-character item name", control: "Vault list layout with a very long name", expected: "No horizontal page overflow", actual: ov ? "page scrolls sideways" : "contained", impact: "cosmetic", repro: "Open /vault after saving the long-name item" }); }
    if (rL) await removeItems(rL);

    // ---------------- C8 double click ----------------
    await fresh(S);
    const t8 = PREFIX + "Double " + Date.now().toString(36);
    await typeInto(S, nameSel, t8);
    const r8 = await rectOf(S, T.btnExpr("^(?:.*\\|)?Save to Vault$"));
    await mouseAt(S, r8.x, r8.y, { clicks: 2 });
    await waitSaved(S, 45000); await sleep(6000);
    const d8 = await dbRow(t8, P, 20000); await sleep(3000); const d8b = await rowsByTitle(P, t8); created.push(...d8b);
    await rec(S, d8b.length === 1, { page: PG, control: "Save to Vault (double click)", expected: "Exactly one row", actual: `rows with that name: ${d8b.length}`, impact: "data loss", repro: "Fill a name, double-click Save to Vault, count rows" });

    // ---------------- C11 leaving an unsaved form ----------------
    await fresh(S);
    const t11 = PREFIX + "Unsaved";
    await typeInto(S, nameSel, t11); await typeInto(S, input("e.g. Nintendo, Marvel, Topps"), "keep-me");
    S.dialogMode = "dismiss"; S.dialogs.length = 0;
    await click(S, "[...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/vault')");
    await sleep(3000);
    let pth = await S.path();
    const warned = S.dialogs.length > 0;
    await rec(S, warned || pth === "/capture", { page: PG, control: "Leaving the form (Vault link) with typed data", expected: "Warns that the typed item is not saved (as /vault/add does), or keeps the draft", actual: warned ? "browser confirm shown: " + S.dialogs[0].message : `no warning; navigated to ${pth}; typed data is discarded`, impact: "data loss", repro: "Type an item name and brand in /capture, click Vault in the header" });
    if (pth !== "/capture") {
      await S.evaluate("history.back(); true"); await sleep(3000);
      const nm = await S.evaluate("(document.getElementById('capture-item-name') || {}).value");
      await rec(S, nm === t11, { page: PG, control: "Browser Back after leaving an unsaved form", expected: "Form returns with the typed name (or clearly empty with a notice)", actual: `back at ${await S.path()}; name field = '${nm}'`, impact: "usability", repro: "Type a name, go to Vault, press Back" });
    }
    await fresh(S); await typeInto(S, nameSel, t11 + " refresh");
    await S.send("Page.reload"); await sleep(2500); await S.settle().catch(() => {});
    const nmr = await S.evaluate("(document.getElementById('capture-item-name') || {}).value"); const txt = await text(S);
    await rec(S, nmr === t11 + " refresh" || /draft|restored|unsaved/i.test(txt), { page: PG, control: "Refresh the page with an unsaved name typed", expected: "Draft restored with a message, or the loss is warned about before leaving", actual: `after reload name='${nmr}'; any draft notice: ${/draft|restored|unsaved/i.test(txt)}; beforeunload prompt: ${S.dialogs.some((d) => d.type === "beforeunload")}`, impact: "data loss", repro: "Type a name, reload" });
    S.dialogs.length = 0;

    // ---------------- C14 Business profile ----------------
    const sb = await session("business", { width: 1440, height: 900 });
    try {
      await sb.visit("/capture"); await sb.waitFor("document.getElementById('capture-item-name')", 60000);
      const tb = PREFIX + "Biz " + Date.now().toString(36);
      await typeInto(sb, nameSel, tb); await click(sb, T.btnExpr("^(?:.*\\|)?Save to Vault$"));
      await waitSaved(sb, 45000);
      const inB = await dbRow(tb, B, 30000), inP = await rowsByTitle(P, tb); created.push(...inB, ...inP);
      await rec(sb, inB.length === 1 && inP.length === 0, { page: "/capture | owner, Business profile active", control: "Save to Vault (Business profile)", expected: "Row lands in the Business profile only", actual: `Business rows=${inB.length}, Personal rows=${inP.length}`, impact: "privacy/data loss", repro: "Activate Business, /capture, name, Save" });
    } finally { await sb.close(); }

    // ---------------- C16 locks ----------------
    await fresh(S);
    const lockBtn = (i) => `document.querySelectorAll('button[aria-label*="next item"]')[${i}]`;
    const nLocks = await S.evaluate("document.querySelectorAll('button[aria-label*=\"next item\"]').length");
    await typeInto(S, input("e.g. Nintendo, Marvel, Topps"), "Locked-Brand");
    // brand lock is the 3rd lock button in the Identity block (name, alternate, brand)
    const lockLabels = await S.evaluate("[...document.querySelectorAll('button[aria-label*=\"next item\"]')].map((b) => b.getAttribute('aria-label') + '|' + b.parentElement.textContent.trim().slice(0, 20))");
    const bi = lockLabels.findIndex((l) => /Brand/i.test(l));
    await click(S, lockBtn(bi));
    const lockedState = await S.evaluate(`document.querySelectorAll('button[aria-label*="next item"]')[${bi}].getAttribute('aria-label')`);
    await typeInto(S, nameSel, PREFIX + "Lock1"); await save(S); await waitSaved(S, 45000);
    const rl1 = await dbRow(PREFIX + "Lock1"); created.push(...rl1);
    await fresh(S);
    const carried = await S.evaluate("(([...document.querySelectorAll('input')].find((e) => e.placeholder === 'e.g. Nintendo, Marvel, Topps')) || {}).value");
    await rec(S, carried === "Locked-Brand", { page: PG, control: "Lock icon beside Brand (carry to next item)", expected: "A locked Brand is pre-filled on the next new item", actual: `lock aria-label after click='${lockedState}'; Brand on the next /capture = '${carried}'`, impact: "usability", repro: "Type a Brand, click its lock, save the item, open /capture again" });
    // unlock again so later suites are not affected
    if (carried === "Locked-Brand") { await click(S, lockBtn(bi)); await typeInto(S, input("e.g. Nintendo, Marvel, Topps"), ""); }
    await S.evaluate("localStorage.getItem('vltd_capture_add_state_v1')").catch(() => {});

    const after = await allCount(P);
    console.log("items before/after (before cleanup):", before, after);
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-capture1-error"); } catch {} }
  finally {
    await S.close();
    await T.removeByPrefix(PREFIX);
    await removeItems(created.filter(Boolean));
    for (const p of mine()) console.log("leftover AUD ADD rows", (await rowsByTitle(p, PREFIX)).length);
  }
})();

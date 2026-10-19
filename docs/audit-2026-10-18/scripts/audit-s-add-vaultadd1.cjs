// ADD audit, suite 3: /vault/add (manual Add) - required title, number parsing, save persistence (reload, direct URL, second browser, database),
// double click, leaving/refreshing an unsaved form (guard), Business profile.
const T = require("./audit-s-add-lib.cjs");
const { alertText, session, sleep, man, admin, rec, click, clickText, typeInto, pickSelect, text, rowsByTitle, allCount, poll, removeItems, mine, mouseAt, rectOf, fieldInput } = T;
const PG = "/vault/add | owner, Personal, 26 items";
const PREFIX = "AUD ADD ";
const created = [];
const title = "document.getElementById('scan-title')";
const saveBtn = T.btnExpr("^Save$|^Saving");
const sel = (i) => `document.querySelectorAll('select')[${i}]`;
async function fresh(S) { await S.visit("/vault/add"); await S.waitFor("document.getElementById('scan-title')", 60000, "add form"); await sleep(500); }
const saveState = (S) => rectOf(S, saveBtn);
async function dbRow(t, profile = man().personalId, ms = 30000) { return (await poll(async () => { const x = await rowsByTitle(profile, t); return x.length ? x : null; }, ms, 1500)) || []; }
const msg = async (S) => { const t = await text(S); return (t.match(/✓ Saved[^A-Z]{0,60}|Title \/ Series is required\.?|A purchase cost can't be negative[^.]*\.[^.]*\.|Failed to save[^.]*\.?|[^.]{0,80}(failed|error|limit)[^.]{0,80}/i) || [""])[0]; };

(async () => {
  const m = man(); const P = m.personalId, B = m.businessId;
  await T.removeByPrefix(PREFIX);
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    const before = await allCount(P);
    if (!process.env.SKIP_TITLE) {
    // ---------------- required title ----------------
    await fresh(S);
    let sb = await saveState(S);
    await rec(S, sb && sb.disabled, { page: PG, control: "Save (no title yet)", expected: "Disabled, with 'Title required' shown, so nothing can be saved without a title", actual: `Save disabled=${sb && sb.disabled}; page says required: ${/Title required/i.test(await text(S))}`, impact: "data loss", repro: "Open /vault/add, look at Save" });
    if (sb) await mouseAt(S, sb.x, sb.y); await sleep(1200);
    await rec(S, (await allCount(P)) === before, { page: PG, control: "Save (clicked while disabled)", expected: "Nothing created", actual: `items ${before}->${await allCount(P)}`, impact: "data loss", repro: "Click the disabled Save" });
    await typeInto(S, title, "    "); sb = await saveState(S);
    await rec(S, sb && sb.disabled, { page: PG, control: "Save (title = spaces only)", expected: "Still disabled", actual: `disabled=${sb && sb.disabled}`, impact: "data loss", repro: "Type spaces in the title" });
    await typeInto(S, title, "x"); sb = await saveState(S);
    await rec(S, sb && !sb.disabled, { page: PG, control: "Save (title typed)", expected: "Becomes enabled once a title exists", actual: `disabled=${sb && sb.disabled}`, impact: "blocked workflow", repro: "Type one letter in the title" });

    }
    // ---------------- negative cost ----------------
    await fresh(S);
    await typeInto(S, title, PREFIX + "NegCost"); await typeInto(S, fieldInput("Purchase Price"), "-5");
    await T.click(S, saveBtn); await sleep(2500);
    let mm = await msg(S); let nn = await allCount(P);
    await rec(S, /can't be negative/.test(await text(S)) && nn === before, { page: PG, control: "Purchase Price = -5 then Save", expected: "Refused with the plain negative-cost message; nothing saved", actual: `message='${mm.slice(0, 100)}'; items ${before}->${nn}`, impact: "misleading result", repro: "Title AD, Purchase Price -5, Save" });
    await typeInto(S, fieldInput("Purchase Price"), "(7.50)"); await T.click(S, saveBtn); await sleep(2500);
    await rec(S, /can't be negative/.test(await text(S)) && (await allCount(P)) === before, { page: PG, control: "Purchase Price = (7.50) then Save", expected: "Accounting-style negative refused too", actual: `items ${before}->${await allCount(P)}`, impact: "misleading result", repro: "Purchase Price (7.50), Save" });
    await typeInto(S, fieldInput("Purchase Price"), "5"); await typeInto(S, fieldInput("Current Value"), "-40");
    await T.click(S, saveBtn); await sleep(5000);
    const rNeg = await dbRow(PREFIX + "NegCost", P, 12000); created.push(...rNeg);
    await rec(S, !(rNeg[0] && Number(rNeg[0].current_value) < 0), { page: PG, control: "Current Value = -40 then Save", expected: "A negative current value is refused", actual: `DB current_value=${rNeg[0] && rNeg[0].current_value}; message='${(await msg(S)).slice(0, 60)}'`, impact: "misleading result", repro: "Title, Current Value -40, Save, read the row" });
    await removeItems(rNeg);

    // ---------------- full save ----------------
    await fresh(S);
    const T4 = PREFIX + "Full " + Date.now().toString(36);
    await typeInto(S, title, T4);
    await pickSelect(S, sel(0), "Music"); await sleep(300);
    const cats = await S.evaluate("[...document.querySelectorAll('select')[1].options].map((o) => o.text.trim())");
    await pickSelect(S, sel(1), cats[1] || cats[0]); await sleep(300);
    await typeInto(S, fieldInput("Subtitle / Set"), "Sub-Token");
    await typeInto(S, fieldInput("Number / Issue"), "No-77");
    await typeInto(S, fieldInput("Grade"), "Grade-Token");
    await typeInto(S, fieldInput("Purchase Price"), "$1,250.50");
    await typeInto(S, fieldInput("Current Value"), "2000");
    await typeInto(S, fieldInput("Storage Location"), "Loc-Token");
    await typeInto(S, fieldInput("Purchase Source"), "Src-Token");
    await typeInto(S, fieldInput("Purchase Location"), "PLoc-Token");
    await typeInto(S, fieldInput("Subject"), "Subj-Token");
    await typeInto(S, fieldInput("Serial #"), "Ser-Token");
    await typeInto(S, fieldInput("Edition"), "Ed-Token");
    await typeInto(S, fieldInput("Variant / Finish"), "Var-Token");
    await typeInto(S, fieldInput("Print Run"), "47/250");
    await typeInto(S, "document.querySelector('textarea')", "Notes-Token for the add page");
    await S.jshot("add-vaultadd-filled");
    await T.click(S, saveBtn);
    await S.waitFor("/✓ Saved/.test(document.body.innerText)", 45000, "saved status").catch(() => {});
    const savedMsg = await msg(S);
    const r4 = await dbRow(T4); created.push(...r4); const x = r4[0] || {};
    await rec(S, r4.length === 1 && /✓ Saved/.test(savedMsg), { page: PG, control: "Save (all fields filled)", expected: "'✓ Saved!' shown and one row exists", actual: `message='${savedMsg}', rows=${r4.length}`, impact: "data loss", repro: "Fill all fields, Save" });
    const checks = { subtitle: "Sub-Token", number: "No-77", grade: "Grade-Token", storage_location: "Loc-Token", purchase_source: "Src-Token", purchase_location: "PLoc-Token", subject: "Subj-Token", serial_number: "Ser-Token", edition: "Ed-Token", variant: "Var-Token", print_run: "47/250", notes: "Notes-Token" };
    for (const [col, tok] of Object.entries(checks)) {
      const where = Object.entries(x).filter(([, v]) => typeof v === "string" && v.includes(tok)).map(([k]) => k);
      await rec(S, where.length > 0, { page: PG, control: `Field '${col}' (typed '${tok}')`, expected: "The value is stored on the saved item", actual: where.length ? "stored in: " + where.join(",") : "NOT in the saved row (row keys carrying it: none)", impact: "data loss", repro: `Type ${tok}, Save, read row` });
    }
    // columns not in my COLS list (serial_number, edition ...) need a wider read
    const wide = (await admin.from("vault_items").select("*").eq("id", x.id).single()).data || {};
    const wideHits = Object.entries(wide).filter(([, v]) => typeof v === "string" && /Ser-Token|Ed-Token|Var-Token|Subj-Token|47\/250/.test(v)).map(([k, v]) => k + "=" + v);
    console.log("wide hits:", wideHits.join(" ; "));
    await rec(S, Number(x.purchase_price) === 1250.5 && Number(x.current_value) === 2000, { page: PG, control: "Purchase Price '$1,250.50' / Current Value '2000'", expected: "1250.5 and 2000", actual: `purchase_price=${x.purchase_price}, current_value=${x.current_value}`, impact: "misleading result", repro: "Type $1,250.50, Save" });
    await rec(S, x.profile_id === P && x.added_via === "manual" && /MUSIC/i.test(x.universe || ""), { page: PG, control: "Save (profile / universe / source)", expected: "Personal profile, MUSIC, added_via manual", actual: JSON.stringify({ profile: (x.profile_id || "").slice(0, 8), universe: x.universe, via: x.added_via, category_label: x.category_label }), impact: "privacy/data loss", repro: "Read the row" });
    // form reset after save, locks kept
    const afterTitle = await S.evaluate("document.getElementById('scan-title').value");
    await rec(S, afterTitle === "", { page: PG, control: "Form after '✓ Saved!'", expected: "Title and unlocked fields are cleared ready for the next item", actual: `title field='${afterTitle}'`, impact: "usability", repro: "Save, look at the form" });
    // persistence
    await S.visit("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 60000).catch(() => {}); await sleep(1500);
    let body = await text(S);
    await rec(S, body.includes(T4), { page: "/vault | owner", control: "Vault list after reload", expected: "New item listed", actual: body.includes(T4) ? "listed" : "missing", impact: "data loss", repro: "Save on /vault/add, open /vault" });
    await S.visit("/vault/item/" + x.id); body = await text(S);
    await rec(S, body.includes(T4) && /Notes-Token/.test(body) && /Loc-Token/.test(body), { page: `/vault/item/${(x.id || "").slice(0, 8)} | owner`, control: "Direct URL of the saved item", expected: "Title, notes and location shown", actual: JSON.stringify({ title: body.includes(T4), notes: /Notes-Token/.test(body), loc: /Loc-Token/.test(body) }), impact: "data loss", repro: "Open /vault/item/<id>" });
    const S2 = await session("owner", { width: 1440, height: 900 });
    try {
      await S2.visit("/vault/item/" + x.id); const b2 = await text(S2);
      await rec(S2, b2.includes(T4) && /Notes-Token/.test(b2), { page: `/vault/item/${(x.id || "").slice(0, 8)} | owner, clean second browser`, control: "Saved item in a clean second browser", expected: "Shown with its notes", actual: b2.includes(T4) ? "title shown, notes " + /Notes-Token/.test(b2) : "NOT shown", impact: "data loss", repro: "Save in browser 1, open item in browser 2" });
    } finally { await S2.close(); }

    // ---------------- number parsing ----------------
    const nums = [
      ["0", 0, "explicit zero stays 0"], ["", null, "blank stays unknown"], ["0.5", 0.5, "decimal"], ["$1,250.50", 1250.5, "currency text"],
      ["1e3", 1000, "exponent: 1000 (or refused)"], ["12abc", "refuse-or-12", "digits followed by letters"], ["1,5", "refuse-or-1.5-or-15", "comma as decimal separator"],
      ["5-3", "refuse", "two numbers with a dash"], ["abc", "blank-or-refuse", "no digits"], ["99999999999", 99999999999, "very large"],
    ];
    for (const [typed, exp, why] of nums) {
      await fresh(S); const tt = PREFIX + "Num " + Buffer.from(typed || "blank").toString("hex").slice(0, 8);
      await typeInto(S, title, tt); if (typed !== "") await typeInto(S, fieldInput("Purchase Price"), typed); if (typed !== "") await typeInto(S, fieldInput("Current Value"), typed);
      await T.click(S, saveBtn); await sleep(2500);
      const rr = await dbRow(tt, P, 12000); created.push(...rr); const y = rr[0];
      const got = y ? { pp: y.purchase_price, cv: y.current_value } : null;
      let ok;
      if (exp === null) ok = got && got.pp === null && got.cv === null;
      else if (typeof exp === "number") ok = got && Math.abs(Number(got.pp) - exp) < 1e-6 * Math.max(1, exp) && Math.abs(Number(got.cv) - exp) < 1e-6 * Math.max(1, exp);
      else if (exp === "refuse-or-12") ok = !got || (Number(got.pp) === 12 && Number(got.cv) === 12);
      else if (exp === "refuse-or-1.5-or-15") ok = !got || Number(got.pp) === 1.5;
      else if (exp === "refuse") ok = !got;
      else ok = !got || (got.pp === null && got.cv === null && /number|invalid|digits/i.test(await text(S)));
      await rec(S, ok, { page: PG, control: `Purchase Price / Current Value typed '${typed}' (${why})`, expected: exp === null ? "saved as unknown (null)" : typeof exp === "number" ? `saved as ${exp}` : "refused with a message, or stored as exactly what was typed - never a different number", actual: got ? `saved: purchase_price=${got.pp}, current_value=${got.cv}; message='${(await msg(S)).slice(0, 60)}'` : `not saved; message='${(await msg(S)).slice(0, 80)}'`, impact: "misleading result", repro: `Title, type '${typed}' in both money fields, Save, read the row` });
    }

    // ---------------- very long text ----------------
    await fresh(S);
    const longT = PREFIX + "Long " + "y".repeat(2400); const longN = "z".repeat(20000);
    await typeInto(S, title, longT); await typeInto(S, "document.querySelector('textarea')", longN);
    await T.click(S, saveBtn); await sleep(6000);
    const rL = await poll(async () => { const r = await rowsByTitle(P, PREFIX + "Long"); return r.length ? r : null; }, 25000); created.push(...(rL || []));
    await rec(S, !!rL && rL[0].title.length === longT.length && (rL[0].notes || "").length === longN.length, { page: PG, control: "Title 2,400 chars + Notes 20,000 chars", expected: "Saved whole, or refused with a message (never silently cut)", actual: rL ? `title ${rL[0].title.length}/${longT.length}; notes ${(rL[0].notes || "").length}/${longN.length}` : `not saved; message='${(await msg(S)).slice(0, 80)}'`, impact: "data loss", repro: "Paste very long text, Save" });
    if (rL) await removeItems(rL);

    // ---------------- double click ----------------
    await fresh(S);
    const t8 = PREFIX + "Double " + Date.now().toString(36);
    await typeInto(S, title, t8);
    const r8 = await rectOf(S, saveBtn); await mouseAt(S, r8.x, r8.y, { clicks: 2 });
    await sleep(9000); const d8 = await rowsByTitle(P, t8); created.push(...d8);
    await rec(S, d8.length === 1, { page: PG, control: "Save (double click)", expected: "Exactly one row", actual: `rows with that title: ${d8.length}`, impact: "data loss", repro: "Type a title, double-click Save, count rows" });

    // ---------------- leaving an unsaved form ----------------
    await fresh(S);
    const t11 = PREFIX + "Unsaved"; await typeInto(S, title, t11);
    S.dialogMode = "dismiss"; S.dialogs.length = 0;
    await click(S, "[...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/vault' && a.getBoundingClientRect().width > 0)"); await sleep(2500);
    const d1 = S.dialogs.slice();
    await rec(S, d1.length === 1 && (await S.path()) === "/vault/add", { page: PG, control: "Vault link with an unsaved title (confirm dialog, Stay)", expected: "A confirm explains the item is not saved; choosing Stay keeps the form", actual: `dialogs=${JSON.stringify(d1.map((d) => d.type + ': ' + d.message))}; path=${await S.path()}`, impact: "data loss", repro: "Type a title, click Vault, choose Cancel" });
    S.dialogMode = "accept"; S.dialogs.length = 0;
    await click(S, "[...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === '/vault' && a.getBoundingClientRect().width > 0)"); await sleep(3000);
    await rec(S, (await S.path()) === "/vault" && (await rowsByTitle(P, t11)).length === 0, { page: PG, control: "Vault link with an unsaved title (Leave)", expected: "Leaves; no row was created", actual: `path=${await S.path()}; rows=${(await rowsByTitle(P, t11)).length}`, impact: "data loss", repro: "Type a title, click Vault, choose Leave" });
    await fresh(S); await typeInto(S, title, t11 + " back"); S.dialogMode = "dismiss"; S.dialogs.length = 0;
    await S.evaluate("history.back(); true"); await sleep(2500);
    await rec(S, S.dialogs.length >= 1 && (await S.path()) === "/vault/add", { page: PG, control: "Browser Back with an unsaved title", expected: "Warns, and Stay keeps the form", actual: `dialogs=${S.dialogs.length}; path=${await S.path()}; title='${await S.evaluate("(document.getElementById('scan-title') || {}).value")}'`, impact: "data loss", repro: "Type a title, press Back, choose Cancel" });
    S.dialogs.length = 0; S.dialogMode = "accept";
    await S.send("Page.reload"); await sleep(3000); await S.settle().catch(() => {});
    const nmr = await S.evaluate("(document.getElementById('scan-title') || {}).value"); const txr = await text(S);
    await rec(S, nmr === t11 + " back" || /draft|restored/i.test(txr) || S.dialogs.some((d) => d.type === "beforeunload"), { page: PG, control: "Refresh with an unsaved title", expected: "Warned before leaving, or the draft is restored with a notice", actual: `after reload title='${nmr}'; beforeunload dialog seen: ${S.dialogs.some((d) => d.type === "beforeunload")}; draft notice: ${/draft|restored/i.test(txr)}`, impact: "data loss", repro: "Type a title, reload" });
    S.dialogs.length = 0;

    // ---------------- Business profile ----------------
    const sbz = await session("business", { width: 1440, height: 900 });
    try {
      await sbz.visit("/vault/add"); await sbz.waitFor("document.getElementById('scan-title')", 60000);
      const tb = PREFIX + "Biz " + Date.now().toString(36);
      await typeInto(sbz, title, tb); await T.click(sbz, saveBtn); await sleep(6000);
      const inB = await dbRow(tb, B, 25000), inP = await rowsByTitle(P, tb); created.push(...inB, ...inP);
      await rec(sbz, inB.length === 1 && inP.length === 0, { page: "/vault/add | owner, Business profile active", control: "Save (Business profile)", expected: "Row lands in the Business profile only", actual: `Business rows=${inB.length}, Personal rows=${inP.length}`, impact: "privacy/data loss", repro: "Activate Business, /vault/add, title, Save" });
    } finally { await sbz.close(); }
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-vaultadd1-error"); } catch {} }
  finally {
    await S.close(); await T.removeByPrefix(PREFIX); await removeItems(created.filter(Boolean));
    for (const p of mine()) console.log("leftover AUD ADD rows", (await rowsByTitle(p, PREFIX)).length);
  }
})();

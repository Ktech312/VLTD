// ADD audit, suite 3c: /vault/add re-tests whose first attempt was a test mistake: Use Full Photo, Identify with AI (INTERCEPTED), PSA Look up (INTERCEPTED), default field locks.
const T = require("./audit-s-add-lib.cjs");
const { alertText, session, sleep, man, admin, rec, click, clickText, typeInto, text, rowsByTitle, allCount, poll, removeItems, mine, rectOf, chooseViaButton, fieldInput, mkPng, tmp } = T;
const PG = "/vault/add | owner, Personal, 26 items";
const PREFIX = "AUD ADD V3 ";
const created = [];
const title = "document.getElementById('scan-title')";
const saveBtn = T.btnExpr("^Save$|^Saving");
const labelsOf = async (S) => (await T.controls(S)).filter((c) => c.visible && c.kind === "button").map((c) => c.label);
let n = 0; const uniq = () => mkPng(tmp(`v3-${++n}-${Date.now()}.png`), 600 + n, 450, [20 + n * 30, 140, 100]);
(async () => {
  const P = man().personalId;
  await T.removeByPrefix(PREFIX);
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/vault/add"); await S.waitFor("document.getElementById('scan-title')", 60000); await sleep(800);
    const up = await chooseViaButton(S, T.btnExpr("Upload a photo from a file"), uniq()); await sleep(3000);
    const l1 = await labelsOf(S);
    await rec(S, up.dialog && l1.includes("Use Full Photo") && l1.includes("Take another picture"), { page: PG, control: "Upload a photo from a file", expected: "The chosen photo is attached at once and the crop step opens over it", actual: `dialog=${up.dialog}; buttons: ${l1.filter((x) => /Use|Cancel|Take another|Identify|Crop top left/.test(x)).join(", ")}`, impact: "blocked workflow", repro: "Press Upload a photo from a file, choose an image" });
    await clickText(S, "Use Full Photo"); await sleep(2000);
    const l2 = await labelsOf(S);
    await rec(S, !l2.includes("Use Full Photo") && l2.includes("Identify with AI"), { page: PG, control: "Use Full Photo (re-test; the first attempt re-chose the same file, which never opens the crop step)", expected: "Crop step closes; photo stays; Identify with AI available", actual: `crop closed=${!l2.includes("Use Full Photo")}; Identify with AI offered=${l2.includes("Identify with AI")}`, impact: "blocked workflow", repro: "Upload, Use Full Photo" });
    await typeInto(S, title, PREFIX + "IdKeep");
    const logB = (await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("profile_id", P)).count; const itemsB = await allCount(P); const iB = S.intercepted.length;
    await clickText(S, "^Identify with AI$"); await sleep(10000);
    const idt = await text(S); const calls = S.intercepted.slice(iB).filter((x) => /api\/ai/.test(x.url)).length;
    const fail = (idt.match(/[^\n]*(couldn.t|could not|failed|try again|unavailable|by hand|manually|unable|no match)[^\n]*/i) || [""])[0];
    await S.jshot("add-vaultadd-identify-refused");
    await rec(S, calls >= 1 && !!fail, { page: PG, control: "Identify with AI (INTERCEPTED, not a successful AI result)", expected: "After the AI call is refused the page says identification did not work and the form stays usable", actual: `AI requests refused by the audit: ${calls}; failure message: '${fail.slice(0, 120) || "(none)"}'`, impact: "misleading result", repro: "Attach a photo, press Identify with AI while AI is refused" });
    await rec(S, (await S.evaluate(`(${title}).value`)) === PREFIX + "IdKeep" && (await allCount(P)) === itemsB && (await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("profile_id", P)).count === logB && !(await rectOf(S, T.btnExpr("^Identify with AI$")).then((r) => r && r.disabled)), { page: PG, control: "Identify refusal: data kept, button usable, no phantom item, no usage logged", expected: "Title kept, button usable again, no item, no AI usage row", actual: `title kept=${(await S.evaluate(`(${title}).value`)) === PREFIX + "IdKeep"}; items ${itemsB}->${await allCount(P)}`, impact: "data loss", repro: "As above" });

    // PSA Look up
    await S.visit("/vault/add"); await S.waitFor("document.getElementById('scan-title')", 60000); await sleep(800);
    const certInput = "[...document.querySelectorAll('input')].find((i) => i.placeholder === 'Certification number' || i.placeholder === 'Cert #' || i.placeholder === 'Certification #')";
    const lab = await S.evaluate("[...document.querySelectorAll('label,div')].filter((e) => e.children.length < 3 && /^Cert/i.test(e.textContent.trim())).map((e) => e.textContent.trim()).slice(0, 3)");
    await typeInto(S, certInput, "12345678"); await sleep(600);
    const lk = await rectOf(S, T.btnExpr("^Look up$")); const iB2 = S.intercepted.length;
    await click(S, T.btnExpr("^Look up$")); await sleep(8000);
    const lt = await text(S); const lcalls = S.intercepted.slice(iB2).filter((x) => /lookup|api\//.test(x.url));
    const lfail = (lt.match(/[^\n]*(couldn.t|could not|failed|unavailable|try again|not found|no result|error|not configured)[^\n]*/i) || [""])[0];
    await S.jshot("add-vaultadd-lookup");
    await rec(S, lcalls.length >= 1 && !!lfail, { page: PG, control: "Look up (PSA certificate; INTERCEPTED, not a successful lookup)", expected: "A refused lookup is reported in words", actual: `Look up enabled=${lk && !lk.disabled}; lookup requests refused: ${JSON.stringify(lcalls.map((x) => x.url))}; message: '${lfail.slice(0, 120) || "(none)"}'`, impact: "misleading result", repro: "Type a certification number, press Look up while lookups are refused" });

    // default locks
    await S.visit("/vault/add"); await S.waitFor("document.getElementById('scan-title')", 60000); await sleep(800);
    const lockOf = (labText) => `[...document.querySelectorAll('label')].find((l) => l.textContent.trim() === ${JSON.stringify(labText)}).parentElement.querySelector('button')`;
    const states = {};
    for (const l of ["Universe", "Category", "Subcategory", "Purchase Source", "Storage Location", "Purchase Price"]) states[l] = await S.evaluate(`(() => { const b = (${lockOf(l)}); return b ? (b.getAttribute('title') || b.getAttribute('aria-label')) : 'none'; })()`);
    console.log("default lock states:", JSON.stringify(states));
    await typeInto(S, fieldInput("Storage Location"), "Lock-Shelf"); await typeInto(S, fieldInput("Purchase Price"), "9");
    const tl = PREFIX + "Lock " + Date.now().toString(36);
    await typeInto(S, title, tl); await click(S, saveBtn); const rl = await poll(async () => { const r = await rowsByTitle(P, tl); return r.length ? r : null; }, 30000, 2000) || []; created.push(...rl);
    await sleep(1500);
    const afterVals = { storage: await S.evaluate(`(${fieldInput("Storage Location")}).value`), price: await S.evaluate(`(${fieldInput("Purchase Price")}).value`), title: await S.evaluate(`(${title}).value`) };
    const wasLocked = /^Locked/.test(states["Storage Location"]);
    await rec(S, wasLocked ? afterVals.storage === "Lock-Shelf" : afterVals.storage === "", { page: PG, control: "Lock icon on Storage Location (default state: " + states["Storage Location"] + ")", expected: "A locked field keeps its value for the next item; an unlocked one is cleared", actual: JSON.stringify(afterVals) + "; lock states at start " + JSON.stringify(states), impact: "usability", repro: "Type a storage location, Save, look at the next blank form" });
    await rec(S, afterVals.price === "" && afterVals.title === "", { page: PG, control: "Unlocked fields after Save (Purchase Price, title)", expected: "Cleared for the next item", actual: JSON.stringify(afterVals), impact: "usability", repro: "Save, look at the form" });
    // lock a normally-unlocked field and see it carried
    const srcLock = lockOf("Purchase Source");
    await typeInto(S, fieldInput("Purchase Source"), "Carry-Source");
    const before = await S.evaluate(`(${srcLock}).getAttribute('title')`);
    await click(S, srcLock); const after = await S.evaluate(`(${srcLock}).getAttribute('title')`);
    const t2 = PREFIX + "Lock2 " + Date.now().toString(36);
    await typeInto(S, title, t2); await click(S, saveBtn); const r2 = await poll(async () => { const r = await rowsByTitle(P, t2); return r.length ? r : null; }, 30000, 2000) || []; created.push(...r2); await sleep(1200);
    const carried = await S.evaluate(`(${fieldInput("Purchase Source")}).value`);
    await rec(S, (/^Locked/.test(after)) ? carried === "Carry-Source" : carried === "", { page: PG, control: "Lock icon on Purchase Source pressed (" + before + " -> " + after + ")", expected: "Locking carries the value to the next item; unlocking clears it", actual: "value on the next form: '" + carried + "'", impact: "usability", repro: "Type a source, press the lock, Save" });
    await clickText(S, "^Unlock All$"); await sleep(600);
    await rec(S, (await S.evaluate(`(${fieldInput("Purchase Source")}).value`)) === "" && (await S.evaluate(`(${fieldInput("Storage Location")}).value`)) === "", { page: PG, control: "Unlock All", expected: "Carried values cleared and fields unlocked", actual: `Purchase Source='${await S.evaluate(`(${fieldInput("Purchase Source")}).value`)}', Storage Location='${await S.evaluate(`(${fieldInput("Storage Location")}).value`)}'`, impact: "usability", repro: "Carry values, press Unlock All" });
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-vaultadd3-error"); } catch {} }
  finally { await S.close(); await T.removeByPrefix(PREFIX); await removeItems(created.filter(Boolean)); for (const p of mine()) console.log("leftover AUD ADD V3 rows", (await rowsByTitle(p, PREFIX)).length); }
})();

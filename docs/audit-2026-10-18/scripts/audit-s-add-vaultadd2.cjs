// ADD audit, suite 3b: /vault/add - camera with no camera, photo upload through the real button + crop step, wrong file type, AI identify (INTERCEPTED),
// Number/Serial persistence, locks, refused connection, phone width (browser-emulated touch). Corrects weak/invalid assertions from suite 3 (see notes).
const fs = require("fs");
const T = require("./audit-s-add-lib.cjs");
const { alertText, session, sleep, man, admin, rec, click, clickText, typeInto, pickSelect, text, rowsByTitle, allCount, poll, removeItems, mine, mouseAt, rectOf, block, chooseViaButton, fieldInput, mkPng, tmp } = T;
const PG = "/vault/add | owner, Personal, 26 items";
const PREFIX = "AUD ADD ";
const created = [];
const title = "document.getElementById('scan-title')";
const saveBtn = T.btnExpr("^Save$|^Saving");
async function fresh(S) { await S.visit("/vault/add"); await S.waitFor("document.getElementById('scan-title')", 60000, "add form"); await sleep(700); }
async function dbRow(t, profile = man().personalId, ms = 30000) { return (await poll(async () => { const x = await rowsByTitle(profile, t); return x.length ? x : null; }, ms, 1500)) || []; }
const photoCount = (S) => S.evaluate("document.querySelectorAll('[aria-label=\"Remove photo\"],[aria-label=\"Delete photo\"]').length");

(async () => {
  const m = man(); const P = m.personalId;
  await T.removeByPrefix(PREFIX + "V2");
  const png = mkPng(tmp("v1.png"), 640, 480, [30, 160, 90]);
  fs.writeFileSync(tmp("v-notes.txt"), "not an image\n");
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    const before = await allCount(P);
    // ---- notes on suite 3: corrected / missing rows ----
    if (!process.env.SKIP_FIRST) {
    // number + serial typed in the default category
    await fresh(S);
    const tn = PREFIX + "V2 NumSer " + Date.now().toString(36);
    await typeInto(S, title, tn); await typeInto(S, fieldInput("Number / Issue"), "No-77"); await typeInto(S, fieldInput("Serial #"), "Ser-Token");
    await T.click(S, saveBtn); const rn = await dbRow(tn); created.push(...rn); const x = (await admin.from("vault_items").select("number,serial_number").eq("id", (rn[0] || {}).id || "x").maybeSingle()).data || {};
    await rec(S, x.number === "No-77" && x.serial_number === "Ser-Token", { page: PG, control: "Number / Issue and Serial # (re-test with the default category)", expected: "Both typed values are stored", actual: JSON.stringify(x) + " (the first run typed them under Music / Audio Players, a category where these two fields are not offered, so those rows ADD-118 and ADD-124 were a test mistake)", impact: "data loss", repro: "Type No-77 and Ser-Token, Save, read the row" });
    }
    // 'abc' in a money field (ADD-143 asserted too weakly)
    await fresh(S);
    const ta = PREFIX + "V2 Abc " + Date.now().toString(36);
    await typeInto(S, title, ta); await typeInto(S, fieldInput("Purchase Price"), "abc"); await typeInto(S, fieldInput("Current Value"), "abc");
    await T.click(S, saveBtn); await sleep(3000); const ra = await dbRow(ta, P, 15000); created.push(...ra);
    const msgA = await text(S);
    await rec(S, !(ra[0] && ra[0].purchase_price === null && /✓ Saved/.test(msgA)), { page: PG, control: "Purchase Price / Current Value = 'abc' then Save (corrects ADD-143, whose check matched the word 'Number' in a field label)", expected: "Letters in a money field are refused or flagged - not saved as 'blank' under a green '✓ Saved!'", actual: `saved as purchase_price=${ra[0] && ra[0].purchase_price}, current_value=${ra[0] && ra[0].current_value}; the page said: '${(msgA.match(/✓ Saved[^\n]*/) || [""])[0]}'`, impact: "usability", repro: "Type abc in Purchase Price and Current Value, Save" });

    // ---- camera, no camera ----
    await fresh(S);
    await clickText(S, "Take a new picture"); await sleep(9000);
    const ct = await text(S); const capR = await rectOf(S, T.btnExpr("Capture photo"));
    await rec(S, /camera access is blocked|no camera|not available|allow camera|couldn.t (start|open)|permission|unavailable/i.test(ct), { page: PG, control: "Take a new picture (no camera)", expected: "After a few seconds a message explains the camera is unavailable (as /capture does)", actual: `shutter disabled=${capR && capR.disabled}; camera message after 9 s: ${/camera access is blocked|permission|unavailable/i.test(ct)}; overlay text: '${ct.slice(0, 90).replace(/\n/g, " ")}'`, impact: "usability", repro: "Open /vault/add in a browser with no camera, press Take a new picture, wait" });
    await S.jshot("add-vaultadd-nocamera");
    await click(S, T.btnExpr("^Close$")); await sleep(800);
    await rec(S, !(await rectOf(S, T.btnExpr("Capture photo")).then((r) => r && r.vis).catch(() => false)), { page: PG, control: "Close (camera overlay)", expected: "Overlay closes", actual: "overlay closed: " + !(await rectOf(S, T.btnExpr("Capture photo")).then((r) => r && r.vis).catch(() => false)), impact: "blocked workflow", repro: "Take a new picture, then X" });

    // ---- upload through the real button + crop step ----
    await fresh(S);
    const up = await chooseViaButton(S, T.btnExpr("Upload a photo from a file"), png); await sleep(3000);
    const crop = await text(S);
    await rec(S, up.dialog && /Use Full Photo/.test(crop), { page: PG, control: "Upload a photo from a file (real click + file dialog)", expected: "The chosen photo opens in the crop step", actual: `dialog=${up.dialog}; crop step shown=${/Use Full Photo/.test(crop)}`, impact: "blocked workflow", repro: "Click Upload a photo from a file, choose an image" });
    await clickText(S, "^Cancel$"); await sleep(1500);
    const afterCancel = await text(S);
    await rec(S, !/Identify with AI/.test(afterCancel) && /Take a picture first|Take a new picture/.test(afterCancel), { page: PG, control: "Cancel (crop step)", expected: "No photo is added", actual: "photo added: " + /Identify with AI/.test(afterCancel), impact: "data loss", repro: "Upload, Cancel in the crop step" });
    await chooseViaButton(S, T.btnExpr("Upload a photo from a file"), png); await sleep(2500);
    await clickText(S, "Use Full Photo"); await sleep(2500);
    const afterUse = await text(S);
    await rec(S, /Identify with AI/.test(afterUse) && /Take another picture/.test(afterUse), { page: PG, control: "Use Full Photo", expected: "Photo attached; Identify with AI becomes available", actual: "attached=" + /Take another picture/.test(afterUse), impact: "blocked workflow", repro: "Upload, Use Full Photo" });
    const t1 = PREFIX + "V2 Photo " + Date.now().toString(36);
    await typeInto(S, title, t1); await T.click(S, saveBtn);
    await S.waitFor("/✓ Saved/.test(document.body.innerText)", 60000).catch(() => {});
    const r1 = await dbRow(t1); created.push(...r1); const x1 = r1[0] || {}; const imgs = Array.isArray(x1.images_json) ? x1.images_json : [];
    await rec(S, imgs.length === 1 && !imgs[0].localOnly && /^https:/.test(x1.image_front_url || ""), { page: PG, control: "Save with an uploaded photo", expected: "Photo stored in the cloud and linked as the cover", actual: JSON.stringify({ images: imgs.length, localOnly: imgs[0] && imgs[0].localOnly, cover: !!x1.image_front_url }), impact: "data loss", repro: "Upload, Use Full Photo, title, Save" });
    if (x1.image_front_url) {
      const resp = await S.evaluate(`fetch(${JSON.stringify(x1.image_front_url)}).then(async (r) => ({ ok: r.ok, ct: r.headers.get('content-type'), size: (await r.blob()).size }))`);
      await rec(S, resp.ok && /image\//.test(resp.ct), { page: PG, control: "Stored photo retrievable", expected: "Public URL serves an image", actual: JSON.stringify(resp), impact: "data loss", repro: "Open the cover URL" });
    }
    const S2 = await session("owner", { width: 1440, height: 900 });
    try {
      await S2.visit("/vault/item/" + x1.id); await sleep(2500);
      const im2 = await S2.evaluate("[...document.querySelectorAll('img')].filter((i) => i.getBoundingClientRect().width > 60 && /supabase\\.co\\/storage/.test(i.src)).map((i) => i.naturalWidth)");
      await rec(S2, im2.length > 0 && im2.every((w) => w > 0), { page: `/vault/item/${(x1.id || "").slice(0, 8)} | clean second browser`, control: "Photo of a /vault/add item in a clean second browser", expected: "Photo shows", actual: JSON.stringify(im2), impact: "data loss", repro: "Open the item in a second browser" });
    } finally { await S2.close(); }

    // ---- wrong file type ----
    await fresh(S);
    await chooseViaButton(S, T.btnExpr("Upload a photo from a file"), tmp("v-notes.txt")); await sleep(3500);
    const wt = await text(S); const wal = await alertText(S);
    const tw = PREFIX + "V2 WrongType";
    await rec(S, /not an image|unsupported|couldn.t (read|open|load)|invalid image|choose an image|only images/i.test(wt + wal) || !/Identify with AI|Use Full Photo/.test(wt), { page: PG, control: "Upload a photo from a file (a .txt file)", expected: "Refused with a clear message, or ignored; no broken photo attached", actual: `crop step shown=${/Use Full Photo/.test(wt)}; photo attached (Identify with AI offered)=${/Identify with AI/.test(wt)}; message='${(wal || (wt.match(/(not an image|unsupported|couldn.t[^.]*)/i) || ["none"])[0]).slice(0, 80)}'`, impact: "misleading result", repro: "Upload a .txt file on /vault/add" });
    await S.jshot("add-vaultadd-wrongtype");
    if (/Use Full Photo/.test(wt)) { await clickText(S, "Use Full Photo"); await sleep(2000); }
    await typeInto(S, title, tw); await T.click(S, saveBtn); await sleep(7000);
    const rwt = await rowsByTitle(P, tw); created.push(...rwt);
    const wt2 = await text(S);
    await rec(S, rwt.length === 0 ? /Could not decode|failed|couldn.t|error/i.test(wt2) : (rwt[0].images_json || []).length === 0, { page: PG, control: "Save after choosing a .txt as the photo", expected: "Either no row with a clear reason, or a row without a broken photo", actual: `rows=${rwt.length}; images=${rwt[0] ? (rwt[0].images_json || []).length : "-"}; message='${(wt2.match(/(✓ Saved[^\n]*|[^\n]*(failed|decode|couldn.t)[^\n]*)/i) || ["(none)"])[0].slice(0, 100)}'`, impact: "data loss", repro: "Upload .txt, Use Full Photo (if offered), title, Save" });

    // ---- AI identify (intercepted) ----
    await fresh(S);
    await chooseViaButton(S, T.btnExpr("Upload a photo from a file"), png); await sleep(2500); await clickText(S, "Use Full Photo"); await sleep(2000);
    await typeInto(S, title, PREFIX + "V2 IdKeep");
    const logB = (await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("profile_id", P)).count; const iB = S.intercepted.length;
    const itemsB = await allCount(P);
    await clickText(S, "^Identify with AI$"); await sleep(12000);
    const idt = await text(S); const ai = S.intercepted.slice(iB).filter((u) => /api\/(ai|card|psa|upc|comic|vinyl)/.test(u.url)).length;
    await rec(S, /couldn.t|could not|failed|try again|unavailable|by hand|manually|no match|not identified|unable/i.test(idt), { page: PG, control: "Identify with AI (INTERCEPTED, not a successful AI result)", expected: "After the AI call is refused the page says identification did not work, and the form stays usable", actual: `requests refused by the audit: ${ai}; message: '${(idt.match(/[^\n]*(couldn.t|could not|failed|try again|unavailable|by hand|manually)[^\n]*/i) || ["(no failure message found)"])[0].slice(0, 120)}'`, impact: "misleading result", repro: "Attach a photo, press Identify with AI while AI is refused" });
    await rec(S, (await S.evaluate(`(${title}).value`)) === PREFIX + "V2 IdKeep" && (await allCount(P)) === itemsB && (await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("profile_id", P)).count === logB, { page: PG, control: "Identify refusal: title kept, no phantom item, no AI usage logged", expected: "Nothing lost, nothing created", actual: `title kept=${(await S.evaluate(`(${title}).value`)) === PREFIX + "V2 IdKeep"}; items ${itemsB}->${await allCount(P)}`, impact: "data loss", repro: "As above" });

    // ---- PSA Look up (intercepted) ----
    await fresh(S);
    const lk = await rectOf(S, T.btnExpr("^Look up$"));
    await typeInto(S, "[...document.querySelectorAll('input')].find((i) => i.placeholder === 'Certification number')", "12345678"); await sleep(400);
    const lk2 = await rectOf(S, T.btnExpr("^Look up$")); const iB2 = S.intercepted.length;
    await click(S, T.btnExpr("^Look up$")); await sleep(6000);
    const lt = await text(S);
    await rec(S, lk && lk.disabled && lk2 && !lk2.disabled, { page: PG, control: "Look up (PSA cert) enabled only with a cert number", expected: "Disabled when empty, enabled after typing a cert number", actual: `disabled before=${lk && lk.disabled}, after typing=${lk2 && lk2.disabled}`, impact: "usability", repro: "Look at Look up, type a cert number" });
    await rec(S, /couldn.t|could not|failed|unavailable|try again|not found|no result|error/i.test(lt), { page: PG, control: "Look up (INTERCEPTED, not a successful lookup)", expected: "A refused lookup is reported in words", actual: `lookup requests refused: ${S.intercepted.slice(iB2).length}; message: '${(lt.match(/[^\n]*(couldn.t|could not|failed|unavailable|try again|not found|error)[^\n]*/i) || ["(no message)"])[0].slice(0, 120)}'`, impact: "misleading result", repro: "Type a cert number, press Look up while lookups are refused" });

    // ---- locks ----
    await fresh(S);
    await typeInto(S, fieldInput("Purchase Source"), "Lock-Source");
    const lockBtns = "[...document.querySelectorAll('label')].find((l) => l.textContent.trim() === 'Purchase Source').parentElement.querySelector('button')";
    const lockBefore = await S.evaluate(`(${lockBtns}).getAttribute('title') || (${lockBtns}).getAttribute('aria-label')`);
    await click(S, lockBtns);
    const lockAfter = await S.evaluate(`(${lockBtns}).getAttribute('title') || (${lockBtns}).getAttribute('aria-label')`);
    const tl = PREFIX + "V2 Lock " + Date.now().toString(36);
    await typeInto(S, title, tl); await T.click(S, saveBtn); const rlk = await dbRow(tl); created.push(...rlk);
    await sleep(1500);
    const carried = await S.evaluate(`(${fieldInput("Purchase Source")}).value`);
    await rec(S, carried === "Lock-Source", { page: PG, control: "Lock beside Purchase Source (keep for the next item)", expected: "After Save the locked value stays for the next item", actual: `lock label ${lockBefore} -> ${lockAfter}; Purchase Source after Save = '${carried}'`, impact: "usability", repro: "Type a source, press its lock, Save" });
    await clickText(S, "^Unlock All$"); await sleep(600);
    const afterUnlock = await S.evaluate(`(${fieldInput("Purchase Source")}).value`);
    await rec(S, afterUnlock === "", { page: PG, control: "Unlock All", expected: "Clears the carried values and unlocks every field", actual: `Purchase Source after Unlock All = '${afterUnlock}'`, impact: "usability", repro: "Lock a field, Save, press Unlock All" });

    // ---- refused connection ----
    await fresh(S);
    const t9 = PREFIX + "V2 Refused " + Date.now().toString(36);
    await typeInto(S, title, t9); await block(S, true); await T.click(S, saveBtn);
    await sleep(4000);
    const m4 = (await text(S)).match(/✓ Saved[^\n]*/);
    await sleep(40000);
    const rr = await rowsByTitle(P, t9); const bt = await text(S);
    await S.jshot("add-vaultadd-refused");
    await rec(S, rr.length === 0 && /not in your account|not saved|couldn.t|failed|offline|retry|will sync|waiting|on this device/i.test(bt), { page: PG, control: "Save while the database refuses the save (40 s watch)", expected: "The page does not stop at '✓ Saved!': it says the item is not in the account yet", actual: `rows=${rr.length}; message at 4 s: '${m4 ? m4[0] : "(none)"}'; at 44 s: '${(bt.match(/[^\n]*(not in your account|couldn.t|failed|offline|retry|on this device)[^\n]*/i) || ["(no failure notice on this page)"])[0].slice(0, 110)}'`, impact: "data loss", repro: "Block vault_items, /vault/add, title, Save, watch 40 s" });
    await block(S, false);
    const gotBack = await poll(async () => { const r = await rowsByTitle(P, t9); return r.length ? r : null; }, 90000, 5000); created.push(...(gotBack || []));
    await rec(S, !!gotBack && gotBack.length === 1, { page: PG, control: "Connection returns by itself", expected: "The kept item reaches the account once, untouched", actual: gotBack ? "rows=" + gotBack.length : "no row after 90 s", impact: "data loss", repro: "Unblock, wait" });
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-vaultadd2-error"); } catch {} }
  finally { try { await block(S, false); } catch {} await S.close(); }

  // ---- phone width, browser-emulated touch ----
  try {
    const SP = await session("owner", { width: 390, height: 844, mobile: true });
    try {
      await SP.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      await SP.visit("/vault/add"); await SP.waitFor("document.getElementById('scan-title')", 60000); await sleep(1500);
      const tp = PREFIX + "V2 Phone " + Date.now().toString(36);
      await typeInto(SP, title, tp);
      const sr = await rectOf(SP, saveBtn);
      const hit = await SP.evaluate(`(() => { const e = document.elementFromPoint(${sr.x}, ${sr.y}); return e.tagName + ':' + (e.textContent.trim().slice(0, 20)); })()`);
      await rec(SP, /Save/.test(hit), { page: PG + " at 390x844 (browser-emulated phone)", control: "Save (floating button) at phone width", expected: "The Save button is what a finger hits at its centre", actual: "top element at Save centre: " + hit, impact: "blocked workflow", repro: "Open /vault/add at 390 px" });
      await SP.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: sr.x, y: sr.y }] }); await sleep(60); await SP.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      const rp = await dbRow(tp, P, 30000); created.push(...rp);
      await rec(SP, rp.length === 1, { page: PG + " at 390x844 (browser-emulated touch)", control: "Save (tap)", expected: "A tap on Save creates the item", actual: "rows=" + rp.length, impact: "blocked workflow", repro: "Type a title, tap Save" });
      const ov = await SP.evaluate("document.documentElement.scrollWidth > innerWidth + 4");
      await rec(SP, !ov, { page: PG + " at 390x844", control: "Page width", expected: "No sideways scrolling", actual: ov ? "page scrolls sideways" : "fits", impact: "cosmetic", repro: "Open /vault/add at 390 px" });
      await SP.jshot("add-vaultadd-phone");
    } finally { await SP.close(); }
  } catch (e) { console.error("PHONE ERROR", e); }
  await T.removeByPrefix(PREFIX + "V2"); await removeItems(created.filter(Boolean));
  for (const p of mine()) console.log("leftover AUD ADD V2 rows", (await rowsByTitle(p, PREFIX + "V2")).length);
})();

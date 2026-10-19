// ADD audit, suite 5: Bulk upload (/vault/bulk) - several synthetic images, quota display, queue/remove, wrong types, the 60 limit, scan (INTERCEPTED),
// review values, Add all (persistence, photos, second browser), double click, refused connection, refused photo storage + retry, Business.
const fs = require("fs");
const T = require("./audit-s-add-lib.cjs");
const { alertText, session, sleep, man, admin, rec, click, clickText, typeInto, pickSelect, text, rowsByTitle, allCount, poll, removeItems, mine, mouseAt, rectOf, block, chooseViaButton, mkPng, tmp } = T;
const PG = "/vault/bulk | owner, Personal, 26 items";
const PREFIX = "AUD ADD B ";
const created = [];
const sel = (i) => `document.querySelectorAll('select')[${i}]`;
const removeCount = (S) => S.evaluate("document.querySelectorAll('[aria-label=\"Remove photo\"]').length");
const selected = async (S) => { const t = await text(S); const m = t.match(/(\d+) photos? selected/i); return m ? Number(m[1]) : null; };
async function open(S) { await S.visit("/vault/bulk"); await S.waitFor("document.querySelectorAll('select').length >= 1", 60000, "bulk page"); await sleep(1500); }
async function setTaxonomy(S) { await pickSelect(S, sel(0), "Music"); await sleep(400); const cats = await S.evaluate("[...document.querySelectorAll('select')[1].options].map((o) => o.text.trim()).filter((x) => x && !/Select/.test(x))"); await pickSelect(S, sel(1), cats[0]); await sleep(400); return cats[0]; }
const choose = (S, files) => chooseViaButton(S, T.btnExpr("Choose photos|Add more photos"), files);
const addAll = "[...document.querySelectorAll('button')].find((b) => /^Add all \\d+ to Vault/.test(b.textContent.trim()))";
const skipBtn = T.btnExpr("fill in by hand");
const titleInputsPick = "[...document.querySelectorAll('input')].filter((i) => i.placeholder === 'Title (optional)')";
const nameInputsReview = "[...document.querySelectorAll('input')].filter((i) => i.placeholder === 'Untitled Item')";
const valueInputs = "[...document.querySelectorAll('input[type=number]')]";
async function dbRows(prefix, profile = man().personalId, n = 1, ms = 40000) { return (await poll(async () => { const r = await rowsByTitle(profile, prefix); return r.length >= n ? r : null; }, ms, 2000)) || (await rowsByTitle(profile, prefix)); }

(async () => {
  const m = man(); const P = m.personalId, B = m.businessId;
  await T.removeByPrefix(PREFIX);
  const imgs = [];
  for (let i = 0; i < 4; i++) imgs.push(mkPng(tmp(`b${i}.png`), 600 + i * 40, 400 + i * 30, [40 + i * 50, 120, 200 - i * 40]));
  fs.writeFileSync(tmp("b-notes.txt"), "not an image\n");
  const many = []; for (let i = 0; i < 62; i++) many.push(mkPng(tmp(`m${i}.png`), 40, 40, [i * 4, 100, 100]));
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    const before = await allCount(P);
    // ---------- quota ticker ----------
    await open(S);
    const status = (await admin.rpc("bulk_scan_status", { p_profile: P })).data; const row = Array.isArray(status) ? status[0] : status;
    const tk = (await text(S)).match(/(\d+)\s*of\s*(\d+) AI scans left this cycle/);
    await rec(S, !!tk && row && Number(tk[1]) === row.remaining && Number(tk[2]) === row.scan_limit, { page: PG, control: "AI scans ticker ('N of M AI scans left this cycle')", expected: "Shows the remaining and the limit the database reports for this profile", actual: `page: ${tk ? tk[0] : "no ticker"}; database: remaining=${row && row.remaining}, limit=${row && row.scan_limit}, used=${row && row.used}`, impact: "misleading result", repro: "Open /vault/bulk; compare with bulk_scan_status" });
    // ---------- photos chosen before the Universe is picked ----------
    const c1 = await choose(S, [imgs[0], imgs[1], imgs[2], imgs[3]]); await sleep(2500);
    const n1 = await selected(S);
    const t1 = await text(S);
    await rec(S, c1.dialog && n1 === 4, { page: PG, control: "Choose photos, or drag them here (4 PNGs, real click + file dialog)", expected: "4 photos are listed", actual: `file dialog opened=${c1.dialog}; text says ${n1} selected; thumbnails=${await removeCount(S)}`, impact: "blocked workflow", repro: "Click Choose photos and pick 4 images" });
    const skipR = await rectOf(S, skipBtn);
    await rec(S, skipR && skipR.disabled && /Pick a Universe and Category above first/.test(t1), { page: PG, control: "Scan with AI / Skip before Universe and Category are picked", expected: "Both held, with the reason shown", actual: `skip disabled=${skipR && skipR.disabled}; reason shown=${/Pick a Universe and Category/.test(t1)}`, impact: "usability", repro: "Choose photos without picking a Universe" });
    // ---------- wrong file types / mixed ----------
    const nBefore = await removeCount(S);
    await choose(S, [tmp("b-notes.txt")]); await sleep(1500);
    const afterTxt = await text(S); const alT = await alertText(S);
    await rec(S, (await removeCount(S)) === nBefore && /not an image|only images|unsupported|skipped|ignored|can.t use|wasn.t added/i.test(afterTxt + alT), { page: PG, control: "Choose photos (a .txt file)", expected: "Refused with a message saying the file is not an image", actual: `photos ${nBefore}->${await removeCount(S)}; message: '${(alT || "none").slice(0, 80)}'; text mentions it: ${/not an image|unsupported|skipped|ignored/i.test(afterTxt)}`, impact: "usability", repro: "Choose a .txt file in Bulk Upload" });
    await choose(S, [imgs[0], tmp("b-notes.txt")]); await sleep(1500);
    const afterMix = await text(S);
    await rec(S, /not an image|only images|unsupported|skipped|ignored|1 file|wasn.t added/i.test(afterMix), { page: PG, control: "Choose photos (one image + one .txt in the same pick)", expected: "The text file is reported as left out", actual: `photos now ${await removeCount(S)} (was ${nBefore}); any mention of the skipped file: ${/not an image|unsupported|skipped|ignored|wasn.t added/i.test(afterMix)}`, impact: "usability", repro: "Pick an image and a .txt together" });
    // remove one (the last)
    const cnt = await removeCount(S);
    await click(S, "[...document.querySelectorAll('[aria-label=\"Remove photo\"]')].pop()"); await sleep(800);
    await rec(S, (await removeCount(S)) === cnt - 1, { page: PG, control: "Remove photo (x on a queued photo)", expected: "That photo leaves the queue", actual: `photos ${cnt}->${await removeCount(S)}`, impact: "usability", repro: "Queue photos, press the x on one" });
    // titles typed in the pick step
    const tcount = await S.evaluate(`(${titleInputsPick}).length`);
    await typeInto(S, `(${titleInputsPick})[0]`, PREFIX + "One"); await typeInto(S, `(${titleInputsPick})[1]`, PREFIX + "Two");
    // taxonomy then skip
    const cat = await setTaxonomy(S);
    const skipR2 = await rectOf(S, skipBtn);
    await rec(S, skipR2 && !skipR2.disabled, { page: PG, control: "Skip — I'll fill in by hand (after Universe and Category)", expected: "Becomes available once both are picked", actual: "disabled=" + (skipR2 && skipR2.disabled), impact: "blocked workflow", repro: "Pick Music and a category" });
    await click(S, skipBtn); await sleep(2000);
    const rvt = await text(S);
    await rec(S, /Add all \d+ to Vault/.test(rvt) && /Music/.test(rvt), { page: PG, control: "Skip -> review grid", expected: "Review grid with the queued photos and an 'Add all N to Vault' button", actual: (rvt.match(/\d+ items? · all filed under[^\n]{0,60}/) || ["no review grid"])[0] + " | " + (rvt.match(/Add all \d+ to Vault/) || ["no add button"])[0], impact: "blocked workflow", repro: "Skip to hand entry" });
    const kept = await S.evaluate(`(${nameInputsReview}).map((i) => i.value)`);
    await rec(S, kept[0] === PREFIX + "One" && kept[1] === PREFIX + "Two", { page: PG, control: "Titles typed before Skip", expected: "Carried into the review grid", actual: JSON.stringify(kept), impact: "data loss", repro: "Type titles in step 2, press Skip" });
    // values
    const vi = await S.evaluate(`(${valueInputs}).length`);
    await typeInto(S, `(${valueInputs})[0]`, "0"); await typeInto(S, `(${valueInputs})[1]`, "-5");
    // back and forth keeps the queue?
    await clickText(S, "^← Back$"); await sleep(1200);
    const afterBack = await removeCount(S); const titlesBack = await S.evaluate(`(${titleInputsPick}).map((i) => i.value)`);
    await rec(S, afterBack === cnt - 1 && titlesBack[0] === PREFIX + "One", { page: PG, control: "← Back (from the review grid)", expected: "The queue and typed titles are still there", actual: `photos=${afterBack}; titles=${JSON.stringify(titlesBack)}`, impact: "data loss", repro: "Skip to the review grid, press Back" });
    await click(S, skipBtn); await sleep(1500);
    const keptVals = await S.evaluate(`(${valueInputs}).map((i) => i.value)`);
    await rec(S, keptVals[0] === "0" && keptVals[1] === "-5", { page: PG, control: "Current value typed (0, -5), Back then forward", expected: "Values kept", actual: JSON.stringify(keptVals), impact: "usability", repro: "Type values, Back, Skip again" });
    // ---------- double click on Add all ----------
    const ra = await rectOf(S, addAll); await mouseAt(S, ra.x, ra.y, { clicks: 2 });
    const okAdd = await S.waitFor("location.pathname === '/vault'", 90000).then(() => true).catch(() => false);
    const rows = await dbRows(PREFIX + "One", P, 1, 40000); const rows2 = await dbRows(PREFIX + "Two", P, 1, 20000);
    await sleep(8000);
    const all = (await rowsByTitle(P, PREFIX)).concat(await rowsByTitle(P, "Untitled Item")); created.push(...all.filter((r) => r.profile_id === P && (r.created_at ? Date.now() - new Date(r.created_at).getTime() < 3600000 : true)));
    const mine2 = await rowsByTitle(P, PREFIX);
    const untitled = (await admin.from("vault_items").select("id,title,profile_id,created_at,images_json,image_front_url,universe,category_label,current_value,purchase_price").eq("profile_id", P).eq("title", "Untitled Item").gte("created_at", (Date.now() - 20 * 60000))).data || [];
    created.push(...untitled);
    await rec(S, okAdd && mine2.length === 2 && untitled.length === (cnt - 1) - 2, { page: PG, control: "Add all N to Vault (double clicked)", expected: `Exactly ${cnt - 1} rows: the 2 titled ones and ${(cnt - 1) - 2} 'Untitled Item' - no duplicates`, actual: `redirected=${okAdd}; titled rows=${mine2.length}; Untitled Item rows made in the last 20 min=${untitled.length}`, impact: "data loss", repro: "Fill the review grid and double-click Add all" });
    const r1 = mine2.find((r) => r.title === PREFIX + "One") || {}, r2 = mine2.find((r) => r.title === PREFIX + "Two") || {};
    await rec(S, r1.current_value === 0 || Number(r1.current_value) === 0, { page: PG, control: "Current value 0 typed in the review grid", expected: "Saved as 0", actual: "current_value=" + r1.current_value, impact: "misleading result", repro: "Type 0, Add all" });
    await rec(S, r2.current_value === null, { page: PG, control: "Current value -5 typed in the review grid", expected: "Refused, or saved as unknown - never as a negative value", actual: "current_value=" + r2.current_value, impact: "misleading result", repro: "Type -5, Add all, read the row" });
    await rec(S, /MUSIC/i.test(r1.universe || "") && (r1.category_label || "") === cat, { page: PG, control: "Universe / Category chosen for the batch", expected: `Every item filed under Music / ${cat}`, actual: `universe=${r1.universe}, category=${r1.category_label}`, impact: "data loss", repro: "Pick Music + category, Add all" });
    await sleep(10000);
    const fresh1 = (await rowsByTitle(P, PREFIX + "One"))[0] || {};
    const im = Array.isArray(fresh1.images_json) ? fresh1.images_json : [];
    await rec(S, im.length === 1 && !im[0].localOnly && !!fresh1.image_front_url, { page: PG, control: "Bulk photo stored with each item", expected: "Photo uploaded and linked", actual: JSON.stringify({ images: im.length, localOnly: im[0] && im[0].localOnly, url: !!fresh1.image_front_url }), impact: "data loss", repro: "Add all; read images_json" });
    await S.visit("/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 60000).catch(() => {}); await sleep(1500);
    await rec(S, (await text(S)).includes(PREFIX + "One"), { page: "/vault | owner", control: "Vault after Add all + reload", expected: "Bulk items listed", actual: (await text(S)).includes(PREFIX + "One") ? "listed" : "missing", impact: "data loss", repro: "Reload /vault" });
    const S2 = await session("owner", { width: 1440, height: 900 });
    try {
      await S2.visit("/vault/item/" + fresh1.id); await sleep(2500); const b2 = await text(S2);
      const im2 = await S2.evaluate("[...document.querySelectorAll('img')].filter((i) => i.getBoundingClientRect().width > 60 && /supabase\\.co\\/storage/.test(i.src)).map((i) => i.naturalWidth)");
      await rec(S2, b2.includes(PREFIX + "One") && im2.length > 0 && im2.every((w) => w > 0), { page: `/vault/item/${(fresh1.id || "").slice(0, 8)} | clean second browser`, control: "Bulk item + photo in a clean second browser", expected: "Item and photo shown", actual: `title shown=${b2.includes(PREFIX + "One")}; images=${JSON.stringify(im2)}`, impact: "data loss", repro: "Open the item in a second browser" });
    } finally { await S2.close(); }
    // remove what this block created so later counts are clean
    await removeItems(created.splice(0).filter(Boolean));

    // ---------- the 60 limit ----------
    await open(S);
    await choose(S, many); await sleep(6000);
    const nMany = await removeCount(S); const tm = await text(S);
    await rec(S, nMany === 62 || /60/.test(tm) && /62|2 (photos|files)|only|limit|first 60|skipped/i.test(tm.replace(/Up to 60 at a time/, "")), { page: PG, control: "Choose photos (62 files; the page says 'Up to 60 at a time')", expected: "Either all 62 are taken, or the page says 2 were left out", actual: `queued=${nMany}; says: '${(tm.match(/\d+ photos? selected/i) || [""])[0]}'; mentions the 2 left out: ${/2 (photos|files)|first 60|skipped|left out/i.test(tm)}`, impact: "data loss", repro: "Choose 62 images" });

    // ---------- scan with AI (INTERCEPTED) ----------
    await open(S);
    await choose(S, [imgs[0], imgs[1]]); await sleep(1500); await setTaxonomy(S);
    const logB = (await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("profile_id", P)).count;
    const remB = (await admin.rpc("bulk_scan_status", { p_profile: P })).data; const remBefore = (Array.isArray(remB) ? remB[0] : remB).remaining;
    const iB = S.intercepted.length;
    await clickText(S, "Scan with AI to fill details"); await sleep(1500);
    await S.waitFor("/Add all \\d+ to Vault/.test(document.body.innerText)", 90000, "review after scan").catch(() => {});
    const sc = await text(S); const aiCalls = S.intercepted.slice(iB).filter((x) => /api\/ai/.test(x.url)).length;
    const remA = (await admin.rpc("bulk_scan_status", { p_profile: P })).data; const remAfter = (Array.isArray(remA) ? remA[0] : remA).remaining;
    await rec(S, /couldn.t|could not|failed|try again|unavailable|by hand/i.test(sc) , { page: PG, control: "Scan with AI to fill details (INTERCEPTED, not a successful AI result)", expected: "After the AI refuses, the review grid says identification did not work so the person fills in by hand", actual: `AI requests refused by the audit: ${aiCalls}; review grid shows ${(sc.match(/(\d+) items? ·[^\n]{0,70}/) || ["-"])[0]}; any failure notice: ${/couldn.t|could not|failed|try again|unavailable/i.test(sc)}`, impact: "misleading result", repro: "Queue 2 photos, pick taxonomy, press Scan with AI while AI is refused" });
    await rec(S, remAfter === remBefore && (await admin.from("ai_usage_log").select("id", { count: "exact", head: true }).eq("profile_id", P)).count === logB && (await allCount(P)) === before, { page: PG, control: "Scan refusal: quota, usage log, items", expected: "No scan consumed, nothing logged, no item created", actual: `remaining ${remBefore}->${remAfter}; items ${before}->${await allCount(P)}`, impact: "misleading result", repro: "As above, then compare quota" });
    // per-card Scan with AI
    await clickText(S, "^Scan with AI$"); await sleep(8000);
    const one = await text(S);
    await rec(S, /Couldn.t identify that one/.test(one), { page: PG, control: "Scan with AI (one card; INTERCEPTED)", expected: "'Couldn't identify that one - try again or fill it in by hand.'", actual: (one.match(/Couldn.t identify[^.]{0,60}/) || ["(no message)"])[0], impact: "misleading result", repro: "Review grid, press Scan with AI on a card" });

    // ---------- refused connection / refused photo storage ----------
    await open(S);
    await choose(S, [imgs[2]]); await sleep(1200); await setTaxonomy(S);
    await typeInto(S, `(${titleInputsPick})[0]`, PREFIX + "Refused");
    await click(S, skipBtn); await sleep(1500);
    await block(S, true);
    await click(S, addAll);
    await S.waitFor("location.pathname === '/vault'", 60000).catch(() => {}); await sleep(15000);
    const rr = await rowsByTitle(P, PREFIX + "Refused"); const bodyR = await text(S);
    await S.jshot("add-bulk-refused");
    await rec(S, rr.length === 0 && /not saved|couldn.t|failed|offline|retry|will sync|on this device|waiting/i.test(bodyR), { page: PG, control: "Add all while the database refuses the save", expected: "The page says the batch has not reached the account", actual: `rows=${rr.length}; page says: '${(bodyR.match(/Saving to your account|[^\n]*(couldn.t|failed|offline|retry|on this device)[^\n]*/i) || ["(no failure notice)"])[0].slice(0, 110)}'`, impact: "data loss", repro: "Block vault_items, Bulk upload 1 photo, Add all, wait 15 s" });
    await block(S, false);
    await S.visit("/vault/sync"); await sleep(2500); await clickText(S, "^Retry Sync$"); await sleep(10000);
    const rr2 = await dbRows(PREFIX + "Refused", P, 1, 40000); created.push(...rr2);
    await rec(S, rr2.length === 1, { page: "/vault/sync | owner", control: "Retry Sync after a refused Bulk save", expected: "Item saved once", actual: "rows=" + rr2.length, impact: "data loss", repro: "Unblock, Retry Sync" });

    // ---------- Business profile ----------
    await removeItems(created.splice(0).filter(Boolean));
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-bulk-error"); } catch {} }
  finally { try { await block(S, false); } catch {} await S.close(); }
  try {
    const SB = await session("business", { width: 1440, height: 900 });
    try {
      await open(SB); await choose(SB, [imgs[0]]); await sleep(1200); await setTaxonomy(SB);
      await typeInto(SB, `(${titleInputsPick})[0]`, PREFIX + "Biz"); await click(SB, skipBtn); await sleep(1200); await click(SB, addAll);
      const inB = await dbRows(PREFIX + "Biz", B, 1, 45000), inP = await rowsByTitle(P, PREFIX + "Biz"); created.push(...inB, ...inP);
      await rec(SB, inB.length === 1 && inP.length === 0, { page: "/vault/bulk | owner, Business profile active", control: "Add all (Business)", expected: "Row in Business only", actual: `Business=${inB.length}, Personal=${inP.length}`, impact: "privacy/data loss", repro: "Activate Business, Bulk upload one photo, Add all" });
    } finally { await SB.close(); }
  } catch (e) { console.error("BIZ ERROR", e); }
  await T.removeByPrefix(PREFIX); await removeItems(created.filter(Boolean));
  // Untitled Item rows made by this suite only (created in the last 90 minutes inside my profiles)
  for (const p of mine()) { const u = (await admin.from("vault_items").select("id,profile_id,images_json").eq("profile_id", p).eq("title", "Untitled Item").gte("created_at", (Date.now() - 90 * 60000))).data || []; await removeItems(u); }
  for (const p of mine()) console.log("leftover AUD ADD B rows", (await rowsByTitle(p, PREFIX)).length);
})();

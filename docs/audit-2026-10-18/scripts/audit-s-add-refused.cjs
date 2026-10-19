// ADD audit, suite 9: refused database connection with a 60 s watch for Quick Add, Bulk upload and Import (the first runs used 12-15 s windows, shorter than the app's ~20 s notice),
// plus the Quick Add no-camera check re-done without matching the word 'Camera' that is part of the screen's own buttons.
const fs = require("fs");
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, man, admin, rec, click, clickText, typeInto, pickSelect, text, rowsByTitle, removeItems, mine, rectOf, chooseViaButton, mkPng, tmp, block, poll } = T;
const PREFIX = "AUD ADD R ";
const FAKE = "--use-fake-device-for-media-stream --use-fake-ui-for-media-stream";
const NOTICE = /not in your account|not saved|couldn.t save|offline|retrying|on this device/i;
const noticeOf = (S) => S.evaluate("(() => { const t = document.body.innerText; const m = t.match(/[^\\n]*(Saved on this device[^\\n]*|not in your account[^\\n]*|Saving to your account[^\\n]*|could not[^\\n]*save[^\\n]*)/i); return m ? m[0].trim().slice(0, 120) : ''; })()");
async function watch(S, secs) { const tl = []; const t0 = Date.now(); for (let i = 0; i < secs / 10; i++) { await sleep(10000); tl.push([Math.round((Date.now() - t0) / 1000), await noticeOf(S)]); } return tl; }
(async () => {
  const P = man().personalId;
  await T.removeByPrefix(PREFIX);
  const created = [];
  if (!process.env.SKIP_QUICK_PART) {
  // ---- Quick Add, no camera, honest message check ----
  process.env.CHROME_EXTRA = "";
  const N = await session("owner", { width: 1440, height: 900 });
  try {
    await N.visit("/vault/quick"); await sleep(6000);
    const t = await text(N);
    const stripped = t.replace(/\b(Universe|Category|Frame|Camera|Finished|Last|Review|Home|Vault|Exhibitions|Lounge|Discover|Help|Level \d+|NOVICE|COLLECTOR|Add to Home Screen|1\.0x|\d)\b/g, "").replace(/[?⌘K]/g, "").trim();
    await rec(N, /blocked|unavailable|not available|permission|allow|no camera|couldn.t|not found|denied/i.test(stripped), { page: "/vault/quick | owner, no camera in this browser", control: "Quick Add scanner when the camera cannot start (honest check)", expected: "The screen says the camera is unavailable and what to do (the same situation on /capture says 'Camera access is blocked for this site.')", actual: "After 6 s the screen shows only the scanner controls; words other than the button names: '" + stripped.slice(0, 80) + "'. The code swallows the camera error silently. (ADD-208 and ADD-209 matched the button called 'Camera' and are void.)", impact: "usability", repro: "Open /vault/quick in a browser with no camera, wait 6 s" });
    await N.jshot("add-quick-nocamera-honest");
  } finally { await N.close(); }

  // ---- Quick Add refused ----
  process.env.CHROME_EXTRA = FAKE;
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    await S.visit("/vault/quick"); await sleep(3500);
    await click(S, "document.querySelector('button[aria-label=\"Take picture\"]')"); await sleep(1500);
    await click(S, "document.querySelector('button[aria-label=\"Review captured items\"]')"); await sleep(1500);
    await click(S, "[...document.querySelectorAll('button')].find((b) => /^Add \\d+ item/.test(b.textContent.trim()))"); await sleep(2500);
    const tq = PREFIX + "Quick " + Date.now().toString(36);
    await typeInto(S, "document.querySelectorAll('input[placeholder=\"Item name\"]')[0]", tq);
    await block(S, true);
    await click(S, "[...document.querySelectorAll('button')].find((b) => /^Save \\d+ item/.test(b.textContent.trim()))");
    const tl = await watch(S, 60); const rows = await rowsByTitle(P, tq);
    await S.jshot("add-quick-refused-60s");
    await rec(S, rows.length === 0 && tl.some(([, m]) => /Saved on this device|not in your account/i.test(m)), { page: "/vault/quick | owner, database requests refused", control: "Save 1 item while the database refuses the save (60 s watch)", expected: "Within about 20 s the page says the item is not in the account yet", actual: `database rows=${rows.length}; messages over 60 s: ${JSON.stringify(tl.map((x) => x[1]).filter((v, i, a) => a.indexOf(v) === i))}`, impact: "data loss", repro: "Block vault_items, Quick Add one photo, Save, watch 60 s (supersedes ADD-232, which watched only 15 s)" });
    await block(S, false);
    const back = await poll(async () => { const r = await rowsByTitle(P, tq); return r.length ? r : null; }, 120000, 5000); created.push(...(back || []));
    await rec(S, !!back && back.length === 1, { page: "/vault/quick | owner", control: "Connection returns by itself after a refused Quick Add save", expected: "The kept item reaches the account once", actual: back ? "rows=" + back.length : "no row after 120 s", impact: "data loss", repro: "Unblock, wait" });
  } catch (e) { console.error("QUICK ERROR", e); } finally { try { await block(S, false); } catch {} await S.close(); }

  }
  // ---- Bulk refused ----
  process.env.CHROME_EXTRA = "";
  const B = await session("owner", { width: 1440, height: 900 });
  try {
    await B.visit("/vault/bulk"); await B.waitFor("document.querySelectorAll('select').length >= 1", 60000); await sleep(1200);
    await chooseViaButton(B, T.btnExpr("Choose photos"), mkPng(tmp("r-b1.png"), 500, 400, [70, 70, 200])); await sleep(1500);
    await pickSelect(B, "document.querySelectorAll('select')[0]", "Music"); await sleep(400);
    const cats = await B.evaluate("[...document.querySelectorAll('select')[1].options].map((o) => o.text.trim()).filter((x) => x && !/Select/.test(x))"); await pickSelect(B, "document.querySelectorAll('select')[1]", cats[0]); await sleep(400);
    const tb = PREFIX + "Bulk " + Date.now().toString(36);
    await typeInto(B, "[...document.querySelectorAll('input')].filter((i) => i.placeholder === 'Title (optional)')[0]", tb);
    await click(B, T.btnExpr("fill in by hand")); await sleep(1500);
    await block(B, true);
    await click(B, "[...document.querySelectorAll('button')].find((b) => /^Add all \\d+ to Vault/.test(b.textContent.trim()))");
    const tl = await watch(B, 60); const rows = await rowsByTitle(P, tb);
    await B.jshot("add-bulk-refused-60s");
    await rec(B, rows.length === 0 && tl.some(([, m]) => /Saved on this device|not in your account/i.test(m)), { page: "/vault/bulk | owner, database requests refused", control: "Add all while the database refuses the save (60 s watch)", expected: "Within about 20 s the page says the batch is not in the account yet", actual: `database rows=${rows.length}; messages over 60 s: ${JSON.stringify(tl.map((x) => x[1]).filter((v, i, a) => a.indexOf(v) === i))}`, impact: "data loss", repro: "Block vault_items, Bulk upload one photo, Skip, Add all, watch 60 s (supersedes the 15 s check in the first run)" });
    await block(B, false);
    const back = await poll(async () => { const r = await rowsByTitle(P, tb); return r.length ? r : null; }, 120000, 5000); created.push(...(back || []));
    await rec(B, !!back && back.length === 1, { page: "/vault/bulk | owner", control: "Connection returns by itself after a refused Bulk save", expected: "The kept item reaches the account once", actual: back ? "rows=" + back.length : "no row after 120 s", impact: "data loss", repro: "Unblock, wait" });
  } catch (e) { console.error("BULK ERROR", e); } finally { try { await block(B, false); } catch {} await B.close(); }

  // ---- Import refused ----
  const I = await session("owner", { width: 1440, height: 900 });
  try {
    const ti = PREFIX + "Import " + Date.now().toString(36);
    fs.writeFileSync(tmp("r-imp.csv"), `Name,Purchase Price,Notes\n${ti},5,n\n`);
    await I.visit("/vault/import"); await I.waitFor("[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Upload Spreadsheet')", 60000); await sleep(1200);
    await chooseViaButton(I, T.btnExpr("^Upload Spreadsheet$"), tmp("r-imp.csv")); await I.waitFor("/Parsed 1 item/.test(document.body.innerText)", 25000).catch(() => {}); await sleep(800);
    await block(I, true);
    for (let k = 0; k < 2; k++) { await click(I, "[...document.querySelectorAll('button')].find((b) => /Confirm Import/.test(b.textContent))"); await sleep(1800); }
    const said = (await text(I)).match(/Imported \d+ item[^\n]*/);
    const tl = await watch(I, 60); const rows = await rowsByTitle(P, ti);
    await I.jshot("add-import-refused-60s");
    await rec(I, rows.length === 0 && tl.some(([, m]) => /Saved on this device|not in your account/i.test(m)), { page: "/vault/import | owner, database requests refused", control: "Confirm Import while the database refuses the save (60 s watch)", expected: "Besides 'Imported 1 item' the page says the item is not in the account yet", actual: `database rows=${rows.length}; import message: '${said ? said[0].slice(0, 70) : "(none)"}'; notices over 60 s: ${JSON.stringify(tl.map((x) => x[1]).filter((v, i, a) => a.indexOf(v) === i))}`, impact: "data loss", repro: "Block vault_items, import one row, confirm twice, watch 60 s (supersedes the 12 s check in the first run)" });
    await block(I, false);
    const back = await poll(async () => { const r = await rowsByTitle(P, ti); return r.length ? r : null; }, 120000, 5000); created.push(...(back || []));
    await rec(I, !!back && back.length === 1, { page: "/vault/import | owner", control: "Connection returns by itself after a refused import", expected: "The imported row reaches the account once", actual: back ? "rows=" + back.length : "no row after 120 s", impact: "data loss", repro: "Unblock, wait" });
  } catch (e) { console.error("IMPORT ERROR", e); } finally { try { await block(I, false); } catch {} await I.close(); }
  await T.removeByPrefix(PREFIX); await removeItems(created.filter(Boolean));
  for (const p of mine()) console.log("leftover AUD ADD R rows", (await rowsByTitle(p, PREFIX)).length);
})();

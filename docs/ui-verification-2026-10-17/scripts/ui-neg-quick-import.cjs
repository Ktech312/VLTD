// Negative purchase costs through the Quick Add review sheet and the Import screen (spreadsheet upload, pasted rows, eBay and Whatnot
// presets), including getting around the browser's own input limits. Blank must stay different from an explicit 0.
//   node ui-neg-quick-import.cjs <label> --base=https://vltd.app [--only=quick,import]
// Quick Add has no photo upload in the existing workflow (uploads are in Bulk, which has no cost field), so its photos come from Chrome's
// built-in synthetic camera. Synthetic QA account only; rows and any uploaded photos are removed at the end.
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/qa-chrome"; // a SHORT profile path: Chrome's IndexedDB fails to open under very long paths
process.env.CHROME_EXTRA = "--use-fake-device-for-media-stream --use-fake-ui-for-media-stream";
const fs = require("fs");
const path = require("path");
const { session, qa, admin, sleep } = require("./ui-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
const LABEL = process.argv[2] || "negqi";
const ONLY = ((process.argv.find((a) => a.startsWith("--only=")) || "--only=quick,import").slice(7)).split(",");
const OUT = path.join(__dirname, "shots-" + LABEL); fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 700)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 700));
const MSG = "can't be negative";
const byTitle = async (prefix) => (await admin.from("vault_items").select("id,title,purchase_price,purchase_tax,purchase_shipping,notes,images_json").eq("profile_id", qa.profileId).like("title", prefix + "%")).data || [];
const poll = async (fn, ms = 60000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(2000); } return null; };
const setNative = (S, selectorExpr, v) => S.evaluate("(() => { const i = " + selectorExpr + "; const proto = i.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(i, " + JSON.stringify(v) + "); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()");
const removeStored = async (rows) => { for (const r of rows) for (const x of (r.images_json || [])) { const m = /\/object\/public\/([^/]+)\/(.+)$/.exec(String(x.url || "")); if (m) await admin.storage.from(m[1]).remove([decodeURIComponent(m[2])]).catch(() => {}); } };

(async () => {
  await admin.from("vault_items").delete().eq("profile_id", qa.profileId).or("title.like.QA Quick %,title.like.QA Imp %");
  const created = [];
  try {
    // =============================== QUICK ADD REVIEW SHEET ===============================
    if (ONLY.includes("quick")) {
      const S = await session(BASE, { width: 390, height: 844, mobile: true });
      try {
        await S.go("/vault/quick"); await S.waitFor("document.querySelector('button[aria-label=\"Take picture\"]') && document.querySelector('video') && document.querySelector('video').readyState >= 2", 90000, "camera"); await sleep(1500);
        for (let i = 0; i < 4; i++) { await S.evaluate("document.querySelector('button[aria-label=\"Take picture\"]').click(); true"); await sleep(1400); }
        await S.evaluate("[...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('Finished')).click(); true"); await sleep(2500);
        // first the "Review your Drop" list, then "Add N items to Vault" opens the "Verify your Drop" sheet with the Cost boxes
        await S.evaluate("[...document.querySelectorAll('button')].find((b) => /^Add \\d+ item/.test(b.textContent.trim())).click(); true");
        await S.waitFor("document.querySelectorAll('input[aria-label=\"Cost\"]').length >= 4", 60000, "review sheet with 4 drafts"); await sleep(1500);
        const n = await S.evaluate("document.querySelectorAll('input[aria-label=\"Cost\"]').length");
        check("[quick] four photos from the camera reach the review sheet, each with its own Cost box", n === 4, n);
        const costSel = (i) => "document.querySelectorAll('input[aria-label=\"Cost\"]')[" + i + "]";
        const nameSel = (i) => "document.querySelectorAll('input[placeholder=\"Item name\"]')[" + i + "]";
        const names = ["QA Quick Neg", "QA Quick Zero", "QA Quick Blank", "QA Quick Pos"];
        for (let i = 0; i < 4; i++) await setNative(S, nameSel(i), names[i]);
        await setNative(S, costSel(0), "-5"); await setNative(S, costSel(1), "0"); await setNative(S, costSel(2), ""); await setNative(S, costSel(3), "12.5");
        await sleep(600);
        const sheet = await S.evaluate("({ alerts: [...document.querySelectorAll('[role=alert]')].map((a) => a.textContent), invalid: document.querySelectorAll('input[aria-label=\"Cost\"][aria-invalid=\"true\"]').length, saveDisabled: [...document.querySelectorAll('button')].find((b) => /Save \\d+ item/.test(b.textContent)).disabled })");
        await S.shot(OUT + "/quick-negative.png");
        check("[quick] a cost of -5 shows the plain message and flags only that box", sheet.alerts.some((a) => a.includes(MSG)) && sheet.invalid === 1, sheet);
        check("[quick] Save is held while a negative cost is there", sheet.saveDisabled === true, sheet.saveDisabled);
        // get around the page's own limit: take the disabled attribute off and press Save anyway
        await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => /Save \\d+ item/.test(x.textContent)); b.removeAttribute('disabled'); b.click(); return true; })()");
        await sleep(9000);
        let rows = await byTitle("QA Quick ");
        const neg = rows.find((r) => r.title === "QA Quick Neg");
        const stillOnSheet = await S.evaluate("document.querySelectorAll('input[aria-label=\"Cost\"]').length > 0 && location.pathname.startsWith('/vault/quick')");
        check("[quick] with the disabled limit stripped, a negative cost is STILL refused: nothing is saved and the sheet stays open", rows.length === 0 && stillOnSheet, { saved: rows.map((r) => [r.title, r.purchase_price]), stillOnSheet, path: await S.evaluate("location.pathname") });
        // The disabled-attribute trick is not a real bypass (React ignores clicks on a button whose props say disabled). The real one:
        // call the Save handler straight through React's own props, which is what a script or developer tool can do.
        const called = await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => /Save \\d+ item/.test(x.textContent)); const key = Object.keys(b).find((k) => k.startsWith('__reactProps')); const h = b[key] && b[key].onClick; if (!h) return 'no handler'; h({ preventDefault() {}, stopPropagation() {} }); return 'called'; })()");
        await sleep(9000);
        const afterCall = await byTitle("QA Quick ");
        const onSheet2 = await S.evaluate("document.querySelectorAll('input[aria-label=\"Cost\"]').length > 0 && location.pathname.startsWith('/vault/quick')");
        check("[quick] calling the Save handler directly (bypassing the disabled button) still refuses a negative cost: nothing saved, sheet stays open", called === "called" && afterCall.length === 0 && onSheet2, { called, saved: afterCall.map((r) => [r.title, r.purchase_price]), onSheet2 });
        if (afterCall.length) created.push(...afterCall);
        const msgAfter = await S.evaluate("[...document.querySelectorAll('[role=alert]')].map((a) => a.textContent).join(' | ') + ' || ' + document.body.innerText.slice(0, 0)");
        info("[quick] message shown after the forced save", msgAfter);
        if (rows.length) created.push(...rows);
        if (stillOnSheet) {
          await setNative(S, costSel(0), "3"); await sleep(500);
          const held = await S.evaluate("[...document.querySelectorAll('button')].find((b) => /Save \\d+ item/.test(b.textContent)).disabled");
          check("[quick] once the negative cost is corrected, Save is available again", held === false, held);
          await S.evaluate("[...document.querySelectorAll('button')].find((b) => /Save \\d+ item/.test(b.textContent)).click(); true");
          rows = await poll(async () => { const r = await byTitle("QA Quick "); return r.length === 4 ? r : null; }, 90000) || await byTitle("QA Quick ");
          created.push(...rows);
          const get = (t) => rows.find((r) => r.title === t);
          check("[quick] corrected -5 -> 3 saved as 3", get("QA Quick Neg") && Number(get("QA Quick Neg").purchase_price) === 3, get("QA Quick Neg"));
          check("[quick] an explicit 0 is saved as 0", get("QA Quick Zero") && get("QA Quick Zero").purchase_price === 0, get("QA Quick Zero") && get("QA Quick Zero").purchase_price);
          check("[quick] a blank cost is saved as unknown (null), different from the 0", get("QA Quick Blank") && get("QA Quick Blank").purchase_price === null, get("QA Quick Blank") && get("QA Quick Blank").purchase_price);
          check("[quick] 12.5 is saved as 12.5", get("QA Quick Pos") && Number(get("QA Quick Pos").purchase_price) === 12.5, get("QA Quick Pos") && get("QA Quick Pos").purchase_price);
        }
      } finally { await S.close(); }
    }

    // =============================== IMPORT SCREEN ===============================
    if (ONLY.includes("import")) {
      const files = {
        generic: ["Name,Purchase Price,Current Value,Notes", "QA Imp Neg,-5,10,n", "QA Imp Paren,(7.50),10,n", "QA Imp Zero,0,10,n", "QA Imp Blank,,10,n", "QA Imp Pos,12.5,10,n"].join("\n"),
        // The presets only read a file whose header row has at least three column names the importer knows, so the order files carry
        // the usual extra columns (Order date, Seller).
        ebay: ["Order date,Title,Seller,Item price,Shipping and handling,Tax", "2026-10-01,QA Imp eBay Neg,s1,-5,2,1", "2026-10-01,QA Imp eBay NegShip,s1,10,-3,0", "2026-10-01,QA Imp eBay Zero,s1,0,0,0", "2026-10-01,QA Imp eBay Blank,s1,,,", "2026-10-01,QA Imp eBay Pos,s1,12.5,1.25,0.9"].join("\n"),
        whatnot: ["Order Date,Item Name,Seller,Price,Shipping,Tax", "2026-10-01,QA Imp Whatnot Neg,s1,-5,2,1", "2026-10-01,QA Imp Whatnot Zero,s1,0,0,0", "2026-10-01,QA Imp Whatnot Blank,s1,,,", "2026-10-01,QA Imp Whatnot Pos,s1,7,1,0.5"].join("\n"),
      };
      const importOne = async (S, presetLabel, csvText, fileName) => {
        const fp = path.join(OUT, fileName); fs.writeFileSync(fp, csvText);
        await S.go("/vault/import"); await S.waitFor("[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Upload Spreadsheet')", 90000, "import page"); await sleep(1500);
        if (presetLabel) { await S.evaluate("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === " + JSON.stringify(presetLabel) + ").click(); true"); await sleep(500); }
        await S.send("DOM.enable");
        const doc = await S.send("DOM.getDocument", { depth: 1 });
        const q = await S.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input[type=file][accept*=csv]" });
        await S.send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: [fp.replace(/\\/g, "/")] });
        await S.waitFor("/Confirm Import/.test(document.body.innerText)", 60000, "preview " + fileName); await sleep(1500);
        const preview = await S.evaluate("document.body.innerText");
        await S.shot(OUT + "/" + fileName.replace(".csv", "") + "-preview.png");
        for (let k = 0; k < 2; k++) { await S.evaluate("[...document.querySelectorAll('button')].find((b) => /Confirm Import/.test(b.textContent)).click(); true"); await sleep(1500); }
        await sleep(6000);
        return preview;
      };
      const S = await session(BASE, { width: 1440, height: 900 });
      try {
        // generic file upload
        const pv = await importOne(S, null, files.generic, "generic.csv");
        info("[import generic] preview mentions", { negativeWarning: /negative/i.test(pv), missingNote: (pv.match(/Missing cost[^\n]*/g) || []).slice(0, 3) });
        let rows = await poll(async () => { const r = await byTitle("QA Imp "); return r.filter((x) => /^QA Imp (Neg|Paren|Zero|Blank|Pos)$/.test(x.title)).length >= 4 ? r : null; }, 60000) || await byTitle("QA Imp ");
        created.push(...rows);
        const g = (t) => rows.find((r) => r.title === t);
        check("[import generic] the preview warns that the negative cost is not taken", /negative/i.test(pv), pv.slice(pv.search(/Warnings/i), pv.search(/Warnings/i) + 300));
        check("[import generic] -5 is never saved as a negative cost", rows.every((r) => r.purchase_price === null || Number(r.purchase_price) >= 0) && !!g("QA Imp Neg"), rows.map((r) => [r.title, r.purchase_price]));
        check("[import generic] (7.50) in brackets is not saved as a negative cost either", g("QA Imp Paren") && (g("QA Imp Paren").purchase_price === null || Number(g("QA Imp Paren").purchase_price) >= 0), g("QA Imp Paren") && g("QA Imp Paren").purchase_price);
        check("[import generic] explicit 0 is saved as 0", g("QA Imp Zero") && g("QA Imp Zero").purchase_price === 0, g("QA Imp Zero") && g("QA Imp Zero").purchase_price);
        check("[import generic] 12.5 is saved as 12.5", g("QA Imp Pos") && Number(g("QA Imp Pos").purchase_price) === 12.5);
        check("[import generic] a BLANK cost stays unknown (null) and is different from the explicit 0", g("QA Imp Blank") && g("QA Imp Blank").purchase_price === null, g("QA Imp Blank") && g("QA Imp Blank").purchase_price);
        check("[import generic] the negative row is also not turned into an explicit 0", g("QA Imp Neg") && g("QA Imp Neg").purchase_price === null, g("QA Imp Neg") && g("QA Imp Neg").purchase_price);

        // pasted rows (tab separated, as copied from a sheet)
        await admin.from("vault_items").delete().eq("profile_id", qa.profileId).like("title", "QA Imp Paste%");
        await S.go("/vault/import"); await S.waitFor("document.querySelector('textarea')", 90000); await sleep(1500);
        await setNative(S, "document.querySelector('textarea')", ["Name\tPurchase Price\tCurrent Value", "QA Imp Paste Neg\t-5\t10", "QA Imp Paste Zero\t0\t10", "QA Imp Paste Blank\t\t10", "QA Imp Paste Pos\t12.5\t10"].join("\n"));
        await S.evaluate("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Parse Pasted Rows').click(); true");
        await S.waitFor("/Confirm Import/.test(document.body.innerText)", 60000, "paste preview"); await sleep(1500);
        for (let k = 0; k < 2; k++) { await S.evaluate("[...document.querySelectorAll('button')].find((b) => /Confirm Import/.test(b.textContent)).click(); true"); await sleep(1500); }
        const prow = await poll(async () => { const r = await byTitle("QA Imp Paste"); return r.length >= 4 ? r : null; }, 60000) || await byTitle("QA Imp Paste");
        created.push(...prow);
        const p = (t) => prow.find((r) => r.title === t);
        check("[import pasted rows] -5 is not saved as a negative, not as an explicit 0", p("QA Imp Paste Neg") && p("QA Imp Paste Neg").purchase_price === null, p("QA Imp Paste Neg") && p("QA Imp Paste Neg").purchase_price);
        check("[import pasted rows] 0 stays 0, blank stays unknown, 12.5 stays 12.5", p("QA Imp Paste Zero") && p("QA Imp Paste Zero").purchase_price === 0 && p("QA Imp Paste Blank") && p("QA Imp Paste Blank").purchase_price === null && p("QA Imp Paste Pos") && Number(p("QA Imp Paste Pos").purchase_price) === 12.5, prow.map((r) => [r.title, r.purchase_price]));

        // eBay and Whatnot presets
        await importOne(S, "eBay Purchases", files.ebay, "ebay.csv");
        const erows = await poll(async () => { const r = await byTitle("QA Imp eBay"); return r.length >= 5 ? r : null; }, 60000) || await byTitle("QA Imp eBay");
        created.push(...erows);
        const e = (t) => erows.find((r) => r.title === t);
        check("[import eBay] a negative price / negative shipping is not saved as a negative cost, and the item says why", e("QA Imp eBay Neg") && e("QA Imp eBay Neg").purchase_price === null && e("QA Imp eBay NegShip") && e("QA Imp eBay NegShip").purchase_shipping === null && /negative amount in the file was not imported/.test((e("QA Imp eBay Neg").notes || "")), erows.map((r) => [r.title, r.purchase_price, r.purchase_shipping]));
        check("[import eBay] explicit 0 stays 0, blank stays unknown, positive unchanged", e("QA Imp eBay Zero") && e("QA Imp eBay Zero").purchase_price === 0 && e("QA Imp eBay Blank") && e("QA Imp eBay Blank").purchase_price === null && e("QA Imp eBay Pos") && Number(e("QA Imp eBay Pos").purchase_price) === 12.5 && Number(e("QA Imp eBay Pos").purchase_shipping) === 1.25, erows.map((r) => [r.title, r.purchase_price]));
        await importOne(S, "Whatnot Orders", files.whatnot, "whatnot.csv").catch(async (err) => { info("[import Whatnot] preset button label not found, trying the label list", String(err).slice(0, 120)); });
        const wrows = await poll(async () => { const r = await byTitle("QA Imp Whatnot"); return r.length >= 4 ? r : null; }, 45000) || await byTitle("QA Imp Whatnot");
        created.push(...wrows);
        const w = (t) => wrows.find((r) => r.title === t);
        check("[import Whatnot] a negative price is not saved as a negative cost", w("QA Imp Whatnot Neg") && w("QA Imp Whatnot Neg").purchase_price === null, wrows.map((r) => [r.title, r.purchase_price]));
        check("[import Whatnot] explicit 0 stays 0, blank stays unknown, positive unchanged", w("QA Imp Whatnot Zero") && w("QA Imp Whatnot Zero").purchase_price === 0 && w("QA Imp Whatnot Blank") && w("QA Imp Whatnot Blank").purchase_price === null && w("QA Imp Whatnot Pos") && Number(w("QA Imp Whatnot Pos").purchase_price) === 7, wrows.map((r) => [r.title, r.purchase_price]));
      } finally { await S.close(); }
    }
  } finally {
    const all = [...(await byTitle("QA Quick ")), ...(await byTitle("QA Imp "))];
    await removeStored(all);
    await admin.from("vault_items").delete().in("id", all.map((r) => r.id));
    info("[cleanup] rows removed", all.length);
  }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });

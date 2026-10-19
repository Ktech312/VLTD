// ADD audit, suite 8: phone width (390x844, BROWSER-EMULATED touch) for /capture, /vault/bulk, /vault/import, /vault/sync, /ai/drafts, /ingest.
const fs = require("fs");
const T = require("./audit-s-add-lib.cjs");
const { alertText, session, sleep, man, admin, rec, click, clickText, typeInto, pickSelect, text, rowsByTitle, allCount, poll, removeItems, mine, rectOf, chooseViaButton, mkPng, tmp } = T;
const PREFIX = "AUD ADD P ";
const created = [];
(async () => {
  const m = man(); const P = m.personalId;
  await T.removeByPrefix(PREFIX);
  const S = await session("owner", { width: 390, height: 844, mobile: true });
  const tap = async (x, y) => { await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] }); await sleep(60); await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); };
  const tapEl = async (expr) => { const r = await rectOf(S, expr); if (!r) return null; await sleep(300); const r2 = await rectOf(S, expr); await tap(r2.x, r2.y); return r2; };
  try {
    await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    for (const [p, wait] of [["/capture", "document.getElementById('capture-item-name')"], ["/vault/bulk", "document.querySelectorAll('select').length >= 1"], ["/vault/import", "[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Upload Spreadsheet')"], ["/vault/sync", "/Offline capture queue/.test(document.body.innerText)"], ["/ai/drafts", "/AI Draft Queue/.test(document.body.innerText)"], ["/ingest", "/Add items/.test(document.body.innerText)"]]) {
      await S.visit(p); await S.waitFor(wait, 60000, p).catch(() => {}); await sleep(1200);
      const ov = await S.evaluate("({ sw: document.documentElement.scrollWidth, iw: innerWidth })");
      const small = await S.evaluate("[...document.querySelectorAll('button,a[href],select,input:not([type=file])')].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && r.top < innerHeight * 3 && (r.height < 30) && !e.closest('nav,header') && !/Unlocked|Locked/.test(e.title || '') }).map((e) => (e.getAttribute('aria-label') || e.textContent.trim() || e.placeholder || e.tagName).slice(0, 25) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)).slice(0, 8)");
      await rec(S, ov.sw <= ov.iw + 4, { page: `${p} at 390x844 (browser-emulated phone)`, control: "Page width", expected: "No sideways scrolling", actual: `scrollWidth ${ov.sw} vs viewport ${ov.iw}`, impact: "cosmetic", repro: `Open ${p} at 390 px wide` });
      await S.jshot("add-phone-" + p.replace(/\W+/g, "_"));
      console.log(p, "controls under 30px high:", JSON.stringify(small));
    }
    // /capture: fill and save by touch
    await S.visit("/capture"); await S.waitFor("document.getElementById('capture-item-name')", 60000); await sleep(1500);
    // is the Save button covered at its centre (banner / bottom nav)?
    const tt = PREFIX + "Touch " + Date.now().toString(36);
    await typeInto(S, "document.getElementById('capture-item-name')", tt);
    const sr = await rectOf(S, T.btnExpr("^Save to Vault$"));
    const hit = await S.evaluate(`(() => { const e = document.elementFromPoint(${sr.x}, ${sr.y}); return e.tagName + ':' + e.textContent.trim().slice(0, 24); })()`);
    await rec(S, /Save to Vault/.test(hit), { page: "/capture at 390x844 (browser-emulated phone)", control: "Save to Vault at the centre of the button", expected: "The Save button itself is hit (nothing floats over it)", actual: "element at the button centre: " + hit, impact: "blocked workflow", repro: "Open /capture on a phone, scroll the Save button to mid-screen, tap its centre" });
    await S.jshot("add-phone-capture-save");
    await tap(sr.x, sr.y);
    const ok = await S.waitFor("location.pathname === '/vault'", 40000).then(() => true).catch(() => false);
    const rr = await poll(async () => { const r = await rowsByTitle(P, tt); return r.length ? r : null; }, 40000, 2500) || []; created.push(...rr);
    await rec(S, ok && rr.length === 1, { page: "/capture at 390x844 (browser-emulated touch)", control: "Save to Vault (tap)", expected: "A tap saves the item", actual: `redirected=${ok}; rows=${rr.length}`, impact: "blocked workflow", repro: "Name the item, tap Save to Vault" });
    // /capture upload by touch (file chooser through a tap)
    await S.visit("/capture"); await S.waitFor("document.getElementById('capture-item-name')", 60000); await sleep(1500);
    const png = mkPng(tmp("ph1.png"), 600, 450, [90, 90, 200]);
    await S.send("Page.setInterceptFileChooserDialog", { enabled: true });
    const opened = new Promise((res) => { S.c.on((e) => { if (e.method === "Page.fileChooserOpened") res(e.params); }); setTimeout(() => res(null), 8000); });
    await tapEl(T.btnExpr("^Upload$")); const fc = await opened;
    if (fc) { await S.send("DOM.enable"); await S.send("DOM.setFileInputFiles", { files: [png], backendNodeId: fc.backendNodeId }); }
    await S.send("Page.setInterceptFileChooserDialog", { enabled: false }); await sleep(2500);
    await rec(S, !!fc && (await S.evaluate("document.querySelectorAll('[aria-label=\"Remove photo\"]').length")) === 1, { page: "/capture at 390x844 (browser-emulated touch)", control: "Upload (tap)", expected: "Tapping Upload opens the file chooser and the photo is attached", actual: `chooser opened=${!!fc}; photos=${await S.evaluate("document.querySelectorAll('[aria-label=\"Remove photo\"]').length")}`, impact: "blocked workflow", repro: "Tap Upload, choose an image" });
    // /vault/bulk by touch
    await S.visit("/vault/bulk"); await S.waitFor("document.querySelectorAll('select').length >= 1", 60000); await sleep(1200);
    await S.send("Page.setInterceptFileChooserDialog", { enabled: true });
    const opened2 = new Promise((res) => { S.c.on((e) => { if (e.method === "Page.fileChooserOpened") res(e.params); }); setTimeout(() => res(null), 8000); });
    await tapEl(T.btnExpr("Choose photos")); const fc2 = await opened2;
    if (fc2) { await S.send("DOM.setFileInputFiles", { files: [png, mkPng(tmp("ph2.png"), 500, 400)], backendNodeId: fc2.backendNodeId }); }
    await S.send("Page.setInterceptFileChooserDialog", { enabled: false }); await sleep(2000);
    const sel = (await text(S)).match(/(\d+) photos? selected/i);
    await rec(S, !!fc2 && sel && Number(sel[1]) === 2, { page: "/vault/bulk at 390x844 (browser-emulated touch)", control: "Choose photos (tap)", expected: "Two chosen photos are listed", actual: `chooser=${!!fc2}; text: ${sel ? sel[0] : "no count"}`, impact: "blocked workflow", repro: "Tap Choose photos, pick two" });
    await pickSelect(S, "document.querySelectorAll('select')[0]", "Music"); await sleep(400);
    const cats = await S.evaluate("[...document.querySelectorAll('select')[1].options].map((o) => o.text.trim()).filter((x) => x && !/Select/.test(x))"); await pickSelect(S, "document.querySelectorAll('select')[1]", cats[0]); await sleep(400);
    await tapEl(T.btnExpr("fill in by hand")); await sleep(1500);
    await S.jshot("add-phone-bulk-review");
    const addAll = "[...document.querySelectorAll('button')].find((b) => /^Add all \\d+ to Vault/.test(b.textContent.trim()))";
    const ar = await rectOf(S, addAll);
    const hit2 = ar && await S.evaluate(`(() => { const e = document.elementFromPoint(${ar.x}, ${ar.y}); return e.tagName + ':' + e.textContent.trim().slice(0, 24); })()`);
    await rec(S, hit2 && /Add all/.test(hit2), { page: "/vault/bulk review at 390x844 (browser-emulated phone)", control: "Add all N to Vault at the centre of the button", expected: "The button itself is hit", actual: "element at the centre: " + hit2, impact: "blocked workflow", repro: "Bulk upload 2 photos, Skip, look at Add all" });
    await tap(ar.x, ar.y);
    const okb = await S.waitFor("location.pathname === '/vault'", 60000).then(() => true).catch(() => false);
    await sleep(10000);
    const untitled = (await admin.from("vault_items").select("id,profile_id,images_json,title").eq("profile_id", P).eq("title", "Untitled Item").gte("created_at", new Date(Date.now() - 15 * 60000).toISOString())).data || []; created.push(...untitled);
    await rec(S, okb && untitled.length === 2, { page: "/vault/bulk at 390x844 (browser-emulated touch)", control: "Add all (tap)", expected: "Two 'Untitled Item' rows are created", actual: `redirected=${okb}; new Untitled Item rows=${untitled.length}`, impact: "blocked workflow", repro: "Bulk upload 2 photos, Skip, tap Add all" });
    // /vault/import by touch
    fs.writeFileSync(tmp("ph.csv"), `Name,Purchase Price\n${PREFIX}Imp1,3\n${PREFIX}Imp2,0\n`);
    await S.visit("/vault/import"); await S.waitFor("[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Upload Spreadsheet')", 60000); await sleep(1200);
    await S.send("Page.setInterceptFileChooserDialog", { enabled: true });
    const opened3 = new Promise((res) => { S.c.on((e) => { if (e.method === "Page.fileChooserOpened") res(e.params); }); setTimeout(() => res(null), 8000); });
    await tapEl(T.btnExpr("^Upload Spreadsheet$")); const fc3 = await opened3;
    if (fc3) await S.send("DOM.setFileInputFiles", { files: [tmp("ph.csv")], backendNodeId: fc3.backendNodeId });
    await S.send("Page.setInterceptFileChooserDialog", { enabled: false });
    await S.waitFor("/Parsed 2 items/.test(document.body.innerText)", 25000).catch(() => {}); await sleep(800);
    await tapEl("[...document.querySelectorAll('button')].find((b) => /Confirm Import/.test(b.textContent))"); await sleep(1500);
    await tapEl("[...document.querySelectorAll('button')].find((b) => /Confirm Import/.test(b.textContent))"); await sleep(4000);
    const ri = await poll(async () => { const r = await rowsByTitle(P, PREFIX + "Imp"); return r.length >= 2 ? r : null; }, 45000, 2500) || await rowsByTitle(P, PREFIX + "Imp"); created.push(...ri);
    await rec(S, ri.length === 2, { page: "/vault/import at 390x844 (browser-emulated touch)", control: "Upload Spreadsheet + Confirm Import (taps)", expected: "2 rows imported", actual: "rows=" + ri.length + "; " + ((await text(S)).match(/Imported[^\n]*/) || [""])[0].slice(0, 80), impact: "blocked workflow", repro: "Tap Upload Spreadsheet, choose a 2-row CSV, tap Confirm twice" });
    await S.jshot("add-phone-import-done");
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-phone-error"); } catch {} }
  finally { await S.close(); }
  await T.removeByPrefix(PREFIX); await removeItems(created.filter(Boolean));
  for (const p of mine()) { const u = (await admin.from("vault_items").select("id,profile_id,images_json").eq("profile_id", p).eq("title", "Untitled Item").gte("created_at", new Date(Date.now() - 90 * 60000).toISOString())).data || []; await removeItems(u); }
  for (const p of mine()) console.log("leftover AUD ADD P rows", (await rowsByTitle(p, PREFIX)).length);
})();

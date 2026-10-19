// ADD audit, suite 8b: phone width (BROWSER-EMULATED touch) - the banner over the Bulk 'Add all' button, then Bulk Add all and Import with the banner dismissed; /ingest cards.
const fs = require("fs");
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, man, admin, rec, click, clickText, typeInto, pickSelect, text, rowsByTitle, poll, removeItems, mine, rectOf, chooseViaButton, mkPng, tmp } = T;
const PREFIX = "AUD ADD S ";
const created = [];
(async () => {
  const P = man().personalId;
  await T.removeByPrefix(PREFIX);
  const S = await session("owner", { width: 390, height: 844, mobile: true });
  const tap = async (x, y) => { await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] }); await sleep(60); await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); };
  const tapEl = async (expr) => { const r = await rectOf(S, expr); if (!r) return null; await sleep(300); const r2 = await rectOf(S, expr); await tap(r2.x, r2.y); return r2; };
  const chooseTap = async (btnExpr, files) => {
    await S.send("Page.setInterceptFileChooserDialog", { enabled: true });
    const opened = new Promise((res) => { S.c.on((e) => { if (e.method === "Page.fileChooserOpened") res(e.params); }); setTimeout(() => res(null), 8000); });
    await tapEl(btnExpr); const fc = await opened;
    if (fc) { await S.send("DOM.enable"); await S.send("DOM.setFileInputFiles", { files, backendNodeId: fc.backendNodeId }); }
    await S.send("Page.setInterceptFileChooserDialog", { enabled: false }); return !!fc;
  };
  try {
    await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    // /ingest cards by tap
    for (const dest of ["/vault/quick", "/vault/import", "/capture"]) {
      await S.visit("/ingest"); await sleep(1000);
      await tapEl(`[...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === ${JSON.stringify(dest)} && a.getBoundingClientRect().height > 60)`); await sleep(3500);
      await rec(S, (await S.path()) === dest, { page: "/ingest at 390x844 (browser-emulated touch)", control: `Card -> ${dest}`, expected: `Opens ${dest}`, actual: "landed on " + (await S.path()), impact: "blocked workflow", repro: "Open /ingest, tap the card" });
    }
    // bulk with the banner showing
    const png = mkPng(tmp("s1.png"), 600, 450, [90, 90, 200]); const png2 = mkPng(tmp("s2.png"), 500, 400, [200, 90, 90]);
    await S.visit("/vault/bulk"); await S.waitFor("document.querySelectorAll('select').length >= 1", 60000); await sleep(1500);
    const okc = await chooseTap(T.btnExpr("Choose photos"), [png, png2]); await sleep(2000);
    await pickSelect(S, "document.querySelectorAll('select')[0]", "Music"); await sleep(400);
    const cats = await S.evaluate("[...document.querySelectorAll('select')[1].options].map((o) => o.text.trim()).filter((x) => x && !/Select/.test(x))"); await pickSelect(S, "document.querySelectorAll('select')[1]", cats[0]); await sleep(400);
    const t1 = PREFIX + "Bulk " + Date.now().toString(36);
    await typeInto(S, "[...document.querySelectorAll('input')].filter((i) => i.placeholder === 'Title (optional)')[0]", t1);
    await tapEl(T.btnExpr("fill in by hand")); await sleep(1800);
    const addAll = "[...document.querySelectorAll('button')].find((b) => /^Add all \\d+ to Vault/.test(b.textContent.trim()))";
    const ar = await rectOf(S, addAll);
    const top = await S.evaluate(`(() => { const e = document.elementFromPoint(${ar.x}, ${ar.y}); return e.tagName + ':' + (e.closest('button') ? e.closest('button').textContent.trim().slice(0, 24) : e.textContent.trim().slice(0, 24)); })()`);
    await S.jshot("add-phone-bulk-banner");
    await rec(S, /Add all/.test(top), { page: "/vault/bulk review at 390x844 (browser-emulated phone, banner showing)", control: "Add all N to Vault under the 'Add to Home Screen' banner", expected: "The button's centre is the button (nothing floats over it)", actual: "element at its centre: " + top + "; chose files via the real tap=" + okc, impact: "blocked workflow", repro: "Open Bulk upload on a phone with the Add to Home Screen banner showing, Skip to hand entry, tap the centre of Add all" });
    await tap(ar.x, ar.y); await sleep(3000);
    await rec(S, (await S.path()) === "/vault/bulk", { page: "/vault/bulk review at 390x844 (browser-emulated touch)", control: "Add all (tap on the centre while the banner is showing)", expected: "The tap adds the batch", actual: "after the tap the page is still " + (await S.path()) + " (the tap reached the banner, not the button)", impact: "blocked workflow", repro: "As above, tap the centre of Add all" });
    // dismiss banner like a person and add
    await click(S, "document.querySelector('button[aria-label=\"Dismiss\"]')"); await sleep(800);
    const ar2 = await rectOf(S, addAll); await tap(ar2.x, ar2.y);
    const ok = await S.waitFor("location.pathname === '/vault'", 60000).then(() => true).catch(() => false);
    const rows = await poll(async () => { const r = await rowsByTitle(P, PREFIX + "Bulk"); return r.length ? r : null; }, 45000, 2500) || []; created.push(...rows);
    await sleep(8000);
    const untitled = (await admin.from("vault_items").select("id,profile_id,images_json,title").eq("profile_id", P).eq("title", "Untitled Item").gte("created_at", new Date(Date.now() - 12 * 60000).toISOString())).data || []; created.push(...untitled);
    await rec(S, ok && rows.length === 1 && untitled.length === 1, { page: "/vault/bulk at 390x844 (browser-emulated touch, banner dismissed)", control: "Add all (tap)", expected: "One titled item and one 'Untitled Item' are created", actual: `redirected=${ok}; titled rows=${rows.length}; Untitled Item rows=${untitled.length}`, impact: "blocked workflow", repro: "Dismiss the banner, tap Add all" });
    // import by touch with a 3-column file
    fs.writeFileSync(tmp("s.csv"), `Name,Purchase Price,Notes\n${PREFIX}Imp1,3,n\n${PREFIX}Imp2,0,n\n`);
    await S.visit("/vault/import"); await S.waitFor("[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Upload Spreadsheet')", 60000); await sleep(1200);
    const okf = await chooseTap(T.btnExpr("^Upload Spreadsheet$"), [tmp("s.csv")]);
    await S.waitFor("/Parsed 2 items/.test(document.body.innerText)", 25000).catch(() => {}); await sleep(800);
    await tapEl("[...document.querySelectorAll('button')].find((b) => /Confirm Import/.test(b.textContent))"); await sleep(1500);
    await tapEl("[...document.querySelectorAll('button')].find((b) => /Confirm Import/.test(b.textContent))"); await sleep(4000);
    const ri = await poll(async () => { const r = await rowsByTitle(P, PREFIX + "Imp"); return r.length >= 2 ? r : null; }, 45000, 2500) || await rowsByTitle(P, PREFIX + "Imp"); created.push(...ri);
    await S.jshot("add-phone-import-after");
    await rec(S, okf && ri.length === 2, { page: "/vault/import at 390x844 (browser-emulated touch)", control: "Upload Spreadsheet + Confirm Import (taps, 3-column file)", expected: "2 rows imported", actual: `chooser=${okf}; rows=${ri.length}; ${((await text(S)).match(/Imported[^\n]*/) || [""])[0].slice(0, 70)}`, impact: "blocked workflow", repro: "Tap Upload Spreadsheet, choose a 3-column CSV, tap Confirm twice" });
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-phone2-error"); } catch {} }
  finally { await S.close(); await T.removeByPrefix(PREFIX); await removeItems(created.filter(Boolean)); for (const p of mine()) { const u = (await admin.from("vault_items").select("id,profile_id,images_json").eq("profile_id", p).eq("title", "Untitled Item").gte("created_at", new Date(Date.now() - 90 * 60000).toISOString())).data || []; await removeItems(u); } for (const p of mine()) console.log("leftover AUD ADD S rows", (await rowsByTitle(p, PREFIX)).length); }
})();

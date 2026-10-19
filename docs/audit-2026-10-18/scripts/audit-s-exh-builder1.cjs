// EXH suite 3: exhibition builder /museum/[galleryId] (owner): title, picker (search/filters/cap), cover, theme/shelf/background, persistence.
const X = require("./audit-s-exh-lib.cjs");
const { session, admin, sleep, man, rows, mclick, byLabel, byLabelRe, typeInto, key, gdb, gItemIds, itemsOf, uploadVia, ensurePng } = X;
const R = rows();
const m = man();
const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
const A = ex.A;
const PG = "/museum/[galleryId] | owner, Personal, empty exhibition 'QA Spare A'";
const dbWait = async (id, pred, ms = 12000) => { const t0 = Date.now(); let g; while (Date.now() - t0 < ms) { g = await gdb(id); if (g && pred(g)) return g; await sleep(500); } return g; };
const tiles = (S) => S.evaluate(`[...document.querySelectorAll('[role=dialog] button[aria-label]')].map(b => b.getAttribute('aria-label')).filter(t => /^QA /.test(t))`);
const pickerCount = (S) => S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); const t = d ? d.innerText : ''; const mm = t.match(/(\\d+)\\/18/); return mm ? Number(mm[1]) : null; })()`);
const pickerText = (S) => S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\\s+/g,' ') : ''; })()`);
const openPicker = async (S) => { await mclick(S, byLabelRe("^Edit/Add"), { wait: 1500 }); return S.evaluate(`!!document.querySelector('[role=dialog]')`); };
const addBtn = (S) => S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); const b = d && [...d.querySelectorAll('button')].filter(x => /Select items to add|Add to Exhibit|Save \\(|Empty/.test(x.textContent)).pop(); return b ? { text: b.textContent.trim(), disabled: b.disabled || b.getAttribute('aria-disabled') === 'true' } : null; })()`);
const saveBadge = (S) => S.evaluate(`(() => { const e = document.querySelector('[aria-live=polite]'); return e ? e.textContent.trim() : ''; })()`);
const tileClick = (title) => `[...document.querySelectorAll('[role=dialog] button[aria-label]')].find(b => b.getAttribute('aria-label') === ${JSON.stringify(title)})`;

(async () => {
  const all = (await admin.from("vault_items").select("id,title,universe,category_label,status,is_public").eq("profile_id", m.personalId)).data;
  const byU = (u) => all.filter((i) => i.universe === u).length;
  const S = await session("owner");
  try {
    await S.visit("/museum/" + A); await sleep(7000);
    const shot0 = await S.jshot("exh-builder-empty-1440");
    // ---- Organize with no items / no exhibit page
    await mclick(S, byLabel("Organize"), { wait: 800 });
    let dlg = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\\s+/g,' ') : null; })()`);
    R.check(!!dlg && /Organize needs an exhibit page/.test(dlg) && /no pieces yet/.test(dlg), { page: PG, control: "'Organize' on an exhibition with no pieces", expected: "Explains that arranging needs pieces and an exhibit page; creates nothing", actual: String(dlg).slice(0, 230), evidence: shot0, impact: "usability", repro: "Open an empty exhibition, click Organize" });
    await mclick(S, byLabel("Not now"), { wait: 500 });
    R.check(!(await S.evaluate(`!!document.querySelector('[role=dialog]')`)) && gItemIds(await gdb(A)).length === 0, { page: PG, control: "Organize notice 'Not now'", expected: "Closes; nothing created", actual: "closed", impact: "usability", repro: "Organize > Not now" });

    // ---- title and description editing + autosave + reload
    await mclick(S, byLabel("Edit title and description"), { wait: 500 });
    await typeInto(S, `document.querySelector('input[aria-label="Exhibit title"]')`, "QA Spare A edited");
    await typeInto(S, `document.querySelector('textarea[aria-label="Exhibit description"]')`, "Edited description from the builder");
    const early = await saveBadge(S);
    await sleep(3500);
    const badge = await saveBadge(S);
    let g = await gdb(A);
    R.check(g.title === "QA Spare A edited" && g.description === "Edited description from the builder", { page: PG, control: "Title + description edit (pencil), no Save press", expected: "Autosaves within a few seconds; database holds the new title and description", actual: `title="${g.title}" desc="${g.description}"; badge '${early}' -> '${badge}'`, impact: "data loss", repro: "Pencil, edit title, wait 3s, check" });
    R.check(/Saved/.test(badge), { page: PG, control: "Save status text after an autosave", expected: "Shows 'Saved'", actual: "'" + badge + "'", impact: "usability", repro: "Edit title, wait" });
    await mclick(S, byLabel("Done editing title and description"), { wait: 400 });
    await S.visit("/museum/" + A); await sleep(5000);
    const h1 = await S.evaluate(`document.querySelector('main h1').textContent.trim()`);
    R.check(h1 === "QA Spare A edited", { page: PG, control: "Title after reload", expected: "QA Spare A edited", actual: h1, impact: "data loss", repro: "Edit title, reload" });
    // 80-char limit while editing
    await mclick(S, byLabel("Edit title and description"), { wait: 400 });
    await typeInto(S, `document.querySelector('input[aria-label="Exhibit title"]')`, "T".repeat(100));
    await sleep(3000);
    g = await gdb(A);
    R.check(g.title.length === 80, { page: PG, control: "Title field limit", expected: "Stops at 80 characters", actual: "saved length " + g.title.length, impact: "cosmetic", repro: "Type 100 characters in the title" });
    await typeInto(S, `document.querySelector('input[aria-label="Exhibit title"]')`, "QA Spare A");
    await sleep(3000);
    await mclick(S, byLabel("Done editing title and description"), { wait: 400 });
    g = await gdb(A);
    R.check(g.title === "QA Spare A", { page: PG, control: "Title restored to 'QA Spare A' (fixture reset, not an app check)", expected: "QA Spare A", actual: g.title, impact: "none", repro: "n/a" });

    // ---- the picker: open / search / filters
    const opened = await openPicker(S);
    const t0 = await tiles(S);
    R.check(opened && t0.length === all.length, { page: PG, control: "'Edit/Add' picker lists the profile's items", expected: `All ${all.length} items of this profile (26 collection + 5 sold), none from the Business profile`, actual: `${t0.length} tiles`, evidence: await S.jshot("exh-builder-picker-1440"), impact: "misleading result", repro: "Open an exhibition, Edit/Add" });
    const soldOffered = all.filter((i) => i.status === "SOLD").every((i) => t0.some((tt) => tt.includes(i.title)));
    R.nt({ page: PG, control: "Picker offers SOLD items", expected: "Product decision: should items already sold be addable to an exhibition?", actual: soldOffered ? "Yes: all 5 'QA Sold ...' items appear in the picker and can be added to a public exhibition." : "no", impact: "improvement" });
    const ab0 = await addBtn(S);
    R.check(ab0 && /Select items to add/.test(ab0.text) && ab0.disabled, { page: PG, control: "Picker add button with nothing selected", expected: "Says 'Select items to add' and is not usable", actual: JSON.stringify(ab0), impact: "usability", repro: "Open picker, look at the bottom button" });
    // search
    await typeInto(S, `document.querySelector('[role=dialog] input[placeholder="Search vault..."]')`, "Album 2");
    await sleep(700);
    const exp2 = all.filter((i) => i.title.toLowerCase().includes("album 2")).length;
    let ts = await tiles(S);
    R.check(ts.length === exp2 && ts.every((t) => /album 2/i.test(t)), { page: PG, control: "Picker search 'Album 2'", expected: `${exp2} items whose title contains 'Album 2'`, actual: `${ts.length} tiles: ${ts.slice(0, 3).join(" / ")}...`, impact: "misleading result", repro: "Edit/Add, type Album 2" });
    await typeInto(S, `document.querySelector('[role=dialog] input[placeholder="Search vault..."]')`, "zzzz-nothing");
    await sleep(600);
    ts = await tiles(S); const empText = await pickerText(S);
    R.check(ts.length === 0 && /no (items|results|matches)|nothing/i.test(empText), { page: PG, control: "Picker search with no match", expected: "No tiles and a 'no results' message", actual: `${ts.length} tiles; ${empText.slice(0, 120)}`, evidence: await S.jshot("exh-builder-picker-nomatch-1440"), impact: "usability", repro: "Search for gibberish" });
    await typeInto(S, `document.querySelector('[role=dialog] input[placeholder="Search vault..."]')`, "");
    await sleep(600);
    ts = await tiles(S);
    R.check(ts.length === all.length, { page: PG, control: "Picker search cleared", expected: "All items return", actual: ts.length + " tiles", impact: "misleading result", repro: "Clear the search box" });
    // universe filter
    await mclick(S, `[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Sports')`, { wait: 700 });
    ts = await tiles(S);
    R.check(ts.length === byU("SPORTS"), { page: PG, control: "Picker chip 'Sports'", expected: `${byU("SPORTS")} Sports items`, actual: ts.length + " tiles", impact: "misleading result", repro: "Edit/Add, click Sports" });
    await mclick(S, `[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Music')`, { wait: 700 });
    ts = await tiles(S);
    R.check(ts.length === byU("SPORTS") + byU("MUSIC"), { page: PG, control: "Picker chips 'Sports' + 'Music' together", expected: `${byU("SPORTS") + byU("MUSIC")} (multi-select)`, actual: ts.length + " tiles", impact: "misleading result", repro: "Click Sports then Music" });
    await mclick(S, `[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Sports')`, { wait: 700 });
    ts = await tiles(S);
    R.check(ts.length === byU("MUSIC"), { page: PG, control: "Picker chip 'Sports' toggled off", expected: `${byU("MUSIC")} Music items remain`, actual: ts.length + " tiles", impact: "misleading result", repro: "Click Sports again" });
    await mclick(S, `[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Music')`, { wait: 700 });
    // choose three, count updates
    const pick3 = ["QA Album 1 - Original Motion Picture Soundtrack", "QA Album 2 - Original Motion Picture Soundtrack", "QA Album 3 - Original Motion Picture Soundtrack"];
    for (const t of pick3) await mclick(S, tileClick(t), { wait: 300 });
    let c = await pickerCount(S); let ab = await addBtn(S);
    R.check(c === 3 && /\(3\)|3 item/.test(ab.text) && !ab.disabled, { page: PG, control: "Picker tiles (real clicks) + counter + add button", expected: "3/18 and the button offers to add 3", actual: `${c}/18; button '${ab.text}'`, impact: "usability", repro: "Select three tiles" });
    await mclick(S, tileClick(pick3[2]), { wait: 300 });
    c = await pickerCount(S);
    R.check(c === 2, { page: PG, control: "Picker: tap a selected tile again", expected: "Deselects it (2/18)", actual: c + "/18", impact: "usability", repro: "Tap a picked tile" });
    await mclick(S, tileClick(pick3[2]), { wait: 300 });
    await key(S, "Escape", "Escape", 27);
    R.check(!(await S.evaluate(`!!document.querySelector('[role=dialog]')`)) && gItemIds(await gdb(A)).length === 0, { page: PG, control: "Picker closed with Escape after choosing 3", expected: "Closes without adding anything", actual: "items in DB: " + gItemIds(await gdb(A)).length, impact: "data loss", repro: "Pick tiles, press Escape" });
    await openPicker(S);
    for (const t of pick3) await mclick(S, tileClick(t), { wait: 300 });
    await mclick(S, `[...document.querySelectorAll('[role=dialog] button')].find(b => b.getAttribute('aria-label') === 'Close picker')`, { wait: 600 });
    R.check(gItemIds(await gdb(A)).length === 0 && !(await S.evaluate(`!!document.querySelector('[role=dialog]')`)), { page: PG, control: "Picker 'Close picker' (X) after choosing 3", expected: "Closes without adding", actual: "items in DB: " + gItemIds(await gdb(A)).length, impact: "data loss", repro: "Pick tiles, click X" });
    await openPicker(S);
    for (const t of pick3) await mclick(S, tileClick(t), { wait: 300 });
    await mclick(S, `[...document.querySelectorAll('[role=dialog] button')].filter(x => /Add to Exhibit|Save \\(/.test(x.textContent)).pop()`, { wait: 3500 });
    g = await dbWait(A, (x) => gItemIds(x).length === 3);
    const pageTxt = (await S.text()).replace(/\s+/g, " ");
    R.check(gItemIds(g).length === 3 && JSON.stringify(gItemIds(g)) === JSON.stringify(pick3.map((t) => all.find((i) => i.title === t).id)), { page: PG, control: "Picker 'Add to Exhibit (3)'", expected: "Exactly those 3 items in the exhibition, in the picked order (database)", actual: JSON.stringify(gItemIds(g)), impact: "data loss", repro: "Pick 3, Add" });
    R.check(/3 \/ 18 ITEMS/.test(pageTxt) && /3 ITEMS/.test(pageTxt) && /VALUE \$149|VALUE \$\d+/.test(pageTxt), { page: PG, control: "Builder counters after adding", expected: "'3 / 18 ITEMS', '3 ITEMS'", actual: (pageTxt.match(/\d+ \/ 18 ITEMS/) || [""])[0], impact: "misleading result", repro: "Add 3 items" });
    const expVal = (await itemsOf(gItemIds(g))).reduce((s, i) => s + Number(i.current_value ?? 0), 0);
    const shownVal = (pageTxt.match(/PUBLIC SHARE LINK[^$]*VALUE \$([\d,]+)/) || [])[1];
    R.check(Number((shownVal || "").replace(/,/g, "")) === Math.round(expVal), { page: PG, control: "Builder VALUE tile after adding", expected: "$" + Math.round(expVal) + " (sum of the 3 items' current values)", actual: "$" + shownVal, impact: "misleading result", repro: "Add 3 items; read VALUE" });
    await S.visit("/museum/" + A); await sleep(6000);
    const pt2 = (await S.text()).replace(/\s+/g, " ");
    R.check(/3 \/ 18 ITEMS/.test(pt2), { page: PG, control: "Items after reload", expected: "Still 3 / 18", actual: (pt2.match(/\d+ \/ 18 ITEMS/) || [""])[0], impact: "data loss", repro: "Add items, reload" });
    // second clean browser sees the same
    const S2 = await session("owner");
    try { await S2.visit("/museum/" + A); await sleep(7000); const t2 = (await S2.text()).replace(/\s+/g, " "); R.check(/3 \/ 18 ITEMS/.test(t2), { page: PG + " | second clean browser", control: "Items seen from a second browser", expected: "3 / 18", actual: (t2.match(/\d+ \/ 18 ITEMS/) || [""])[0], impact: "data loss", repro: "Open the exhibition in another browser" }); } finally { await S2.close(); }

    // ---- 18-item cap
    await openPicker(S);
    const pickedNow = await pickerCount(S);
    R.check(pickedNow === 3, { page: PG, control: "Picker reopened shows the 3 already added", expected: "3/18 pre-selected", actual: pickedNow + "/18", impact: "usability", repro: "Reopen Edit/Add" });
    const more = (await tiles(S)).filter((t) => !pick3.includes(t));
    for (const t of more.slice(0, 15)) await mclick(S, tileClick(t), { wait: 120 });
    c = await pickerCount(S);
    const fullTxt = await pickerText(S);
    R.check(c === 18 && /Exhibit is full \(18 items max\)/.test(fullTxt), { page: PG, control: "Picker at the 18-item limit", expected: "Counter 18/18 and a clear 'full' message", actual: `${c}/18; ${(fullTxt.match(/Exhibit is full[^.]*\./) || ["(no full message)"])[0]}`, evidence: await S.jshot("exh-builder-picker-full-1440"), impact: "usability", repro: "Select 18 items" });
    await mclick(S, tileClick(more[15]), { wait: 400 });
    c = await pickerCount(S);
    R.check(c === 18, { page: PG, control: "Picker: tapping a 19th tile", expected: "Not added; stays 18/18", actual: c + "/18", impact: "data loss", repro: "Select 19th tile" });
    await mclick(S, `[...document.querySelectorAll('[role=dialog] button')].filter(x => /Add to Exhibit|Save \\(/.test(x.textContent)).pop()`, { wait: 3500 });
    g = await dbWait(A, (x) => gItemIds(x).length === 18);
    R.check(gItemIds(g).length === 18 && new Set(gItemIds(g)).size === 18, { page: PG, control: "Add 18 items (limit)", expected: "18 distinct items saved", actual: gItemIds(g).length + " items", impact: "data loss", repro: "Pick 18, Add" });
    // the builder wall and hint on 18
    const t18 = (await S.text()).replace(/\s+/g, " ");
    R.check(/18 \/ 18 ITEMS/.test(t18), { page: PG, control: "Builder counter at the limit", expected: "18 / 18 ITEMS", actual: (t18.match(/\d+ \/ 18 ITEMS/) || [""])[0], impact: "misleading result", repro: "Add 18" });
    // remove items down to 2 via picker
    await openPicker(S);
    for (const t of (await tiles(S)).slice(0, 40)) { /* find picked ones: click only those in pick3-excluded set */ }
    for (const t of more.slice(0, 15)) await mclick(S, tileClick(t), { wait: 100 });
    c = await pickerCount(S);
    R.check(c === 3, { page: PG, control: "Picker: deselect 15 picked tiles", expected: "3/18 left", actual: c + "/18", impact: "usability", repro: "Tap picked tiles" });
    await mclick(S, tileClick(pick3[2]), { wait: 200 });
    await mclick(S, `[...document.querySelectorAll('[role=dialog] button')].filter(x => /Add to Exhibit|Save \\(/.test(x.textContent)).pop()`, { wait: 3500 });
    g = await dbWait(A, (x) => gItemIds(x).length === 2);
    R.check(gItemIds(g).length === 2 && !gItemIds(g).includes(all.find((i) => i.title === pick3[2]).id), { page: PG, control: "Remove items through the picker", expected: "2 items remain (Album 1 and 2); Album 3 gone from the database", actual: JSON.stringify(gItemIds(g).map((id) => id.slice(-3))), impact: "data loss", repro: "Reopen picker, untick items, Add" });
    // empty the exhibition via the picker
    await openPicker(S);
    for (const t of pick3.slice(0, 2)) await mclick(S, tileClick(t), { wait: 200 });
    const ab3 = await addBtn(S);
    await mclick(S, `[...document.querySelectorAll('[role=dialog] button')].filter(x => /Add to Exhibit|Save \\(|Empty/.test(x.textContent)).pop()`, { wait: 3500 });
    g = await dbWait(A, (x) => gItemIds(x).length === 0);
    R.check(gItemIds(g).length === 0 && /Empty/.test(ab3 ? ab3.text : ""), { page: PG, control: "Picker 'Empty this exhibit'", expected: "Offers to empty the exhibition and then it holds 0 items", actual: `button '${ab3 && ab3.text}'; DB items ${gItemIds(g).length}`, impact: "data loss", repro: "Untick everything, click the bottom button" });
    // re-add 5 items for the following checks (Album 1..5)
    await openPicker(S);
    const five = [1, 2, 3, 4, 5].map((n) => `QA Album ${n} - Original Motion Picture Soundtrack`);
    for (const t of five) await mclick(S, tileClick(t), { wait: 150 });
    await mclick(S, `[...document.querySelectorAll('[role=dialog] button')].filter(x => /Add to Exhibit|Save \\(/.test(x.textContent)).pop()`, { wait: 3500 });
    await dbWait(A, (x) => gItemIds(x).length === 5);

    // ---- cover artwork
    const png = ensurePng();
    const coverBefore = (await gdb(A)).cover_image;
    const okc = await uploadVia(S, `document.querySelector('label[for=gallery-cover-upload]')`, png);
    g = await dbWait(A, (x) => x.cover_image && x.cover_image !== coverBefore, 15000);
    R.check(okc === true && /gallery-backgrounds\/.+\/cover\//.test(g.cover_image || ""), { page: PG, control: "'Cover Artwork' upload (real image)", expected: "Cover stored and saved on the exhibition", actual: `picker ${okc}; cover ${String(g.cover_image).slice(-60)}`, evidence: await S.jshot("exh-builder-cover-1440"), impact: "data loss", repro: "Click Cover Artwork, choose an image" });
    await S.visit("/museum/" + A); await sleep(5500);
    const cov = await S.evaluate(`(() => { const i = document.querySelector('img[alt="Cover art"]'); return i ? { ok: i.complete && i.naturalWidth > 0, src: i.src.slice(-50) } : null; })()`);
    R.check(!!cov && cov.ok, { page: PG, control: "Cover after reload", expected: "Cover image loads", actual: JSON.stringify(cov), impact: "data loss", repro: "Upload cover, reload" });
    const hasRemoveCover = await S.evaluate(`!![...document.querySelectorAll('button,label')].find(b => /remove cover|delete cover|clear cover/i.test(b.textContent + (b.getAttribute('aria-label')||'')))`);
    R.nt({ page: PG, control: "Remove the cover artwork", expected: "Improvement candidate: a way to remove or replace the cover", actual: hasRemoveCover ? "present" : "No control removes a cover once set (only replacing by uploading another).", impact: "improvement" });

    // ---- theme / shelf / background
    const pickTheme = async (label) => {
      await mclick(S, byLabel("Exhibition view"), { wait: 500 });
      return mclick(S, `([...document.querySelectorAll('body div')].filter(e => e.children.length === 0 && e.textContent.trim() === ${JSON.stringify(label)}).map(e => e.closest('button,[role=option],li') || e)[0])`, { wait: 3500, scroll: false });
    };
    for (const [label, pack] of [["Walnut", "walnut"], ["Marble", "marble"], ["Cold Blue", "midnight"], ["Midnight", "cold-blue"], ["Classic", "classic"]]) {
      const okp = await pickTheme(label);
      g = await dbWait(A, (x) => x.layout && x.layout.themePack === pack && x.layout.displayMode === "shelf", 9000);
      const bg = await S.evaluate(`(() => { const w = document.querySelector('[data-slot-idx="0"]'); let p = w; while (p && !/aspect-ratio|940/.test(p.getAttribute('style') || '')) p = p.parentElement; return p ? (p.style.backgroundImage || '').slice(0, 80) : ''; })()`);
      R.check(okp && g.layout.themePack === pack && g.layout.displayMode === "shelf" && !g.layout.shelfBackground, { page: PG, control: `Theme '${label}'`, expected: `Saved as theme ${pack} on a shelf wall with that theme's own wall picture`, actual: `${g.layout.themePack}/${g.layout.displayMode}; wall bg ${bg}`, evidence: label === "Walnut" ? await S.jshot("exh-builder-theme-walnut-1440") : "", impact: "misleading result", repro: "Theme menu > " + label });
    }
    await pickTheme("Plain cards");
    g = await dbWait(A, (x) => x.layout && x.layout.displayMode === "grid", 9000);
    R.check(g.layout.displayMode === "grid", { page: PG, control: "Theme 'Plain cards'", expected: "displayMode grid saved", actual: g.layout.displayMode, impact: "misleading result", repro: "Theme menu > Plain cards" });
    await pickTheme("Walnut");
    // Shelf style: does a change save itself (the page promises every change autosaves), and does the Save button save it?
    for (const [label, val] of [["Glass", "glass"], ["Metal", "metal"]]) {
      await mclick(S, byLabel("Shelf style"), { wait: 500 });
      await mclick(S, `([...document.querySelectorAll('body div')].filter(e => e.children.length === 0 && e.textContent.trim() === ${JSON.stringify(label)}).map(e => e.closest('button,[role=option],li') || e)[0])`, { wait: 500, scroll: false });
      await sleep(6000);
      g = await gdb(A);
      const shelfShown = await S.evaluate(`[...document.querySelectorAll('button')].map(b => b.textContent.trim()).find(t => /^Shelf:/.test(t))`);
      const auto = (g.layout.shelfOverlayStyle ?? "none") === val;
      const shot = auto ? "" : await S.jshot("exh-builder-shelf-style-not-autosaved-" + val);
      R.check(auto, { page: PG, control: `Shelf style '${label}' (autosave, no Save press)`, expected: "Like every other builder change it saves itself within a few seconds (database shows " + val + ")", actual: `button shows '${shelfShown}'; database shelfOverlayStyle=${JSON.stringify(g.layout.shelfOverlayStyle)} 6s later`, evidence: shot, impact: "data loss", repro: "Builder > Shelf: choose " + label + ", wait 6s, check / reload" });
      if (!auto) {
        await S.visit("/museum/" + A); await sleep(5500);
        const afterReload = await S.evaluate(`[...document.querySelectorAll('button')].map(b => b.textContent.trim()).find(t => /^Shelf:/.test(t))`);
        const S3 = await session("owner"); let clean = "";
        try { await S3.visit("/museum/" + A); await sleep(6500); clean = await S3.evaluate(`[...document.querySelectorAll('button')].map(b => b.textContent.trim()).find(t => /^Shelf:/.test(t))`); } finally { await S3.close(); }
        R.check(clean === "Shelf: " + label, { page: PG + " | clean second browser", control: `Shelf style '${label}' as seen from a clean browser (no Save pressed)`, expected: "Shelf: " + label, actual: `clean browser shows '${clean}'; the same tab after reload shows '${afterReload}' (it keeps an unsaved copy of the edit in the tab, so the loss is invisible to the owner until they open the exhibition elsewhere)`, evidence: "", impact: "data loss", repro: "Choose the shelf style, do not press Save; open the exhibition in another browser" });
        await mclick(S, byLabel("Shelf style"), { wait: 500 });
        await mclick(S, `([...document.querySelectorAll('body div')].filter(e => e.children.length === 0 && e.textContent.trim() === ${JSON.stringify(label)}).map(e => e.closest('button,[role=option],li') || e)[0])`, { wait: 500, scroll: false });
        await mclick(S, `[...document.querySelectorAll('main button')].find(b => b.textContent.trim() === 'Save')`, { wait: 3500 });
        g = await gdb(A);
        R.check((g.layout.shelfOverlayStyle ?? "none") === val, { page: PG, control: `'Save' button after choosing shelf style '${label}'`, expected: "Saved: database shows " + val, actual: "database shelfOverlayStyle=" + JSON.stringify(g.layout.shelfOverlayStyle), impact: "data loss", repro: "Choose the style, click the Save pill" });
      }
    }
    // background upload / remove
    const okb = await uploadVia(S, `document.querySelector('label[for^="shelf-upload-"]')`, png);
    g = await dbWait(A, (x) => x.layout.shelfBackground, 15000);
    const statusTxt = (await S.text()).replace(/\s+/g, " ");
    R.check(okb === true && /gallery-backgrounds\/[0-9a-f-]{36}\/[0-9]+_/.test(g.layout.shelfBackground || "") && /Selected: exh-test-image\.png|Background applied/.test(statusTxt), { page: PG, control: "'Upload Background' with a real image", expected: "Background stored, saved in the exhibition and acknowledged on the page", actual: `picker ${okb}; shelfBackground ${String(g.layout.shelfBackground).slice(-55)}; status ${(statusTxt.match(/Selected: [^ ]+|Background applied/) || ["(no status)"])[0]}`, evidence: await S.jshot("exh-builder-background-1440"), impact: "data loss", repro: "Upload Background, choose an image" });
    await S.visit("/museum/" + A); await sleep(6000);
    const hasRemove = await S.evaluate(`!![...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Remove BG')`);
    R.check(hasRemove, { page: PG, control: "'Remove BG' after reload", expected: "Visible because a background is saved", actual: String(hasRemove), impact: "usability", repro: "Upload background, reload" });
    const wallBg = await S.evaluate(`(() => { const w = document.querySelector('[data-slot-idx="0"]').parentElement; return w.style.backgroundImage.slice(0, 120); })()`);
    R.check(/gallery-backgrounds/.test(wallBg), { page: PG, control: "Uploaded background drawn behind the wall", expected: "Wall uses the uploaded picture", actual: wallBg, impact: "misleading result", repro: "Upload background; look at the wall" });
    await mclick(S, byLabel("Remove BG"), { wait: 3500 });
    g = await dbWait(A, (x) => !x.layout.shelfBackground, 9000);
    R.check(!g.layout.shelfBackground, { page: PG, control: "'Remove BG'", expected: "Background removed in the database", actual: "shelfBackground=" + JSON.stringify(g.layout.shelfBackground), impact: "data loss", repro: "Remove BG, check" });
    await S.visit("/museum/" + A); await sleep(5500);
    R.check(!(await S.evaluate(`!![...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Remove BG')`)), { page: PG, control: "Background after Remove BG and reload", expected: "Stays removed", actual: "no Remove BG button", impact: "data loss", repro: "Remove BG, reload" });
    // choosing a theme replaces an uploaded background
    await uploadVia(S, `document.querySelector('label[for^="shelf-upload-"]')`, png);
    await dbWait(A, (x) => x.layout.shelfBackground, 15000);
    await pickTheme("Marble");
    g = await dbWait(A, (x) => !x.layout.shelfBackground && x.layout.themePack === "marble", 9000);
    R.check(!g.layout.shelfBackground && g.layout.themePack === "marble", { page: PG, control: "Theme choice after a custom background", expected: "Marble replaces the uploaded picture (as the (i) note says)", actual: `themePack ${g.layout.themePack}, shelfBackground ${JSON.stringify(g.layout.shelfBackground)}`, impact: "misleading result", repro: "Upload bg, choose a theme" });
    // info popovers
    await mclick(S, byLabel("Background picture size and format"), { wait: 400 });
    const info = await S.evaluate(`!!document.getElementById('gallery-background-info')`);
    await mclick(S, byLabel("Close background picture info"), { wait: 400 });
    R.check(info && !(await S.evaluate(`!!document.getElementById('gallery-background-info')`)), { page: PG, control: "Background (i) help and its Close", expected: "Opens a size/format note; Close hides it", actual: "opened " + info, impact: "usability", repro: "Click (i), then Close" });
    // invalid background file: not an image
    const bad = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/ui/scripts/exh-not-an-image.txt";
    require("fs").writeFileSync(bad, "not an image");
    const before = (await gdb(A)).layout.shelfBackground || "";
    await S.evaluate(`document.querySelector('input[id^="shelf-upload-"]').removeAttribute('accept'); true`);
    const okbad = await uploadVia(S, `document.querySelector('label[for^="shelf-upload-"]')`, bad);
    await sleep(5000);
    const after = (await gdb(A)).layout.shelfBackground || "";
    const stt = (await S.text()).replace(/\s+/g, " ");
    R.check(after === before, { page: PG, control: "'Upload Background' with a text file renamed as picture (accept filter removed to force it)", expected: "Refused or ignored; background unchanged", actual: `picker ${okbad}; shelfBackground changed: ${after !== before}; page says: ${(stt.match(/Selected: [^ ]+|Failed[^.]*|upload[^.]*\./i) || ["nothing"])[0]}`, impact: "misleading result", repro: "Choose a non-image file for the background" });
    R.nt({ page: PG, control: "Upload Background with a very large image", expected: "Large file handling", actual: "NOT TESTED: no multi-megabyte image available in the fixture; avoided to keep storage use small", impact: "usability" });
    console.log("DONE builder1");
  } finally { await S.close(); }
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });

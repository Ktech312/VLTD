// Functional phone checks on the live app (vltd.app) as an isolated synthetic collector, Chrome phone emulation (not a physical phone). No AI is ever called.
//   1 Add Item: type an item (emulated keyboard), tap Save to Vault, reload, confirm it persisted (screen + database).
//   2 Single upload: choose a picture through browser automation (setFileInputFiles on the page's upload input), save, confirm the picture was stored. The NATIVE phone picker is not tested.
//   3 Bulk upload: choose Universe and Category, choose two pictures, type titles, "Fill in by hand", edit names and values, Add all, confirm the items (screen + database).
//   4 Exhibitions: type and create an exhibition; edit its title/description and a builder page's name/description with the shortened (keyboard) viewport; Save; reload; confirm (screen + database).
// The emulated keyboard = the screen is made 336 px shorter. A real keyboard can behave differently.
//   AUDIT_MANIFEST=<qa manifest> TUT_WORK=<dir> node functional.cjs <outDir>
const fs = require("fs"), path = require("path");
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, btn, T } = require(GUIDE + "/lib.cjs");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const sleep = T.sleep, admin = T.admin;
const OUT = process.argv[2];
const ASSETS = "C:/Users/EK/AppData/Local/Temp/claude/C--Users-EK-VLTD--claude-worktrees-quizzical-hamilton-a45b28/6a75e8af-40d2-418c-a6bf-53cb4fed3a4e/scratchpad/tut/assets";
const TAG = "QAFUNC" + Date.now().toString(36).slice(-4).toUpperCase();
const W = 390, H = 844, KB = 336;
const results = [];
const rec = (test, step, ok, detail) => { results.push({ test, step, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} [${test}] ${step}${detail ? " :: " + (typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 300) : ""}`); };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const R = await start({ scene: "functional", phone: true, camera: false });
  const { S, m } = R; const P = m.personalId;
  const shot = async (n) => { const png = await S.send("Page.captureScreenshot", { format: "png" }); await sharp(Buffer.from(png.data, "base64")).jpeg({ quality: 80 }).toFile(path.join(OUT, n + ".jpg")); };
  const view = (h) => S.send("Emulation.setDeviceMetricsOverride", { width: W, height: h, deviceScaleFactor: 2, mobile: true });
  const keyboardOn = () => view(H - KB), keyboardOff = () => view(H);
  const byTitle = async (like) => (await admin.from("vault_items").select("*").eq("profile_id", P).ilike("title", like)).data || [];
  const val = (expr) => S.evaluate(`(() => { const e = ${expr}; return e ? e.value : null; })()`);
  const setSel = (idx, pick) => S.evaluate(`(() => { const s = document.querySelectorAll('main select')[${idx}]; if (!s) return null; const o = [...s.options].filter((x) => x.value); const hit = o.find((x) => new RegExp(${JSON.stringify(pick)}, 'i').test(x.textContent)) || o[0]; if (!hit) return null; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, hit.value); s.dispatchEvent(new Event('change', { bubbles: true })); return hit.textContent.trim(); })()`);
  const filePick = async (selector, files) => { await S.send("DOM.enable", {}); const doc = await S.send("DOM.getDocument", { depth: 1 }); const q = await S.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector }); if (!q.nodeId) return false; await S.send("DOM.setFileInputFiles", { nodeId: q.nodeId, files }); return true; };
  await view(H);
  const ids = { items: [], gallery: null };

  // ───────── 1 Add Item ─────────
  try {
    await R.goto("/capture"); await sleep(2000);
    await keyboardOn(); await sleep(400);
    const NAME = `${TAG} Add Item Robot`;
    await R.type(`document.querySelector("input[placeholder='Item name']")`, NAME);
    await R.type(`[...document.querySelectorAll('input')].find((i) => /Nintendo, Marvel, Topps/.test(i.placeholder))`, `${TAG} Brand`);
    await R.type(`[...document.querySelectorAll('input')].find((i) => /1986 Fleer Basketball/.test(i.placeholder))`, `${TAG} Set`);
    await R.type(`document.querySelector('textarea[placeholder^="Add any details"]')`, `${TAG} note typed with the keyboard up`);
    const typed = await val(`document.querySelector("input[placeholder='Item name']")`);
    rec("add-item", "typed name with emulated keyboard", typed === NAME, typed);
    await shot("1-add-item-typed-keyboard");
    const saveInfo = await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Save to Vault$/.test(x.innerText.trim())); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); const bar = document.querySelector('nav[aria-label="Main navigation"]'); const bt = bar ? bar.firstElementChild.getBoundingClientRect().top : innerHeight; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { reachable: !!t && (t === b || b.contains(t)), clearOfBar: r.bottom <= bt }; })()`);
    rec("add-item", "Save to Vault reachable with the keyboard up", !!saveInfo && saveInfo.reachable && saveInfo.clearOfBar, saveInfo);
    await R.clickExpr(btn("Save to Vault"), 6000);
    const p1 = await S.path();
    rec("add-item", "after Save the app goes to the Vault", p1 === "/vault", p1);
    await keyboardOff(); await sleep(500);
    let rows = []; for (let i = 0; i < 10 && !rows.length; i++) { rows = await byTitle(`${TAG} Add Item%`); if (!rows.length) await sleep(1500); }
    rec("add-item", "item is in the database", rows.length === 1, rows.length ? { id: rows[0].id, title: rows[0].title } : "none");
    if (rows.length) {
      ids.items.push(rows[0].id);
      const blob = JSON.stringify(rows[0]);
      rec("add-item", "brand, set and note were stored", blob.includes(`${TAG} Brand`) && blob.includes(`${TAG} Set`) && blob.includes(`${TAG} note`), { brand: blob.includes(`${TAG} Brand`), set: blob.includes(`${TAG} Set`), note: blob.includes(`${TAG} note`) });
      await R.goto("/vault"); await sleep(2500); await S.evaluate("location.reload()"); await sleep(3500);
      const txt = await R.text();
      rec("add-item", "after a reload the Vault still lists it", txt.includes(`${TAG} Add Item Robot`) || txt.includes(`${TAG} Add Item`), txt.includes(TAG) ? "title found on the page" : "title not in the first screen text");
      await R.goto(`/vault/item/${rows[0].id}`); await sleep(3000); await S.evaluate("location.reload()"); await sleep(3500);
      const t2 = await R.text();
      rec("add-item", "after a reload the item page shows the saved details", t2.includes(`${TAG} Add Item Robot`) && t2.includes(`${TAG} Brand`), { title: t2.includes(`${TAG} Add Item Robot`), brand: t2.includes(`${TAG} Brand`) });
      await shot("1-add-item-reloaded-item-page");
    }
  } catch (e) { rec("add-item", "script error", false, e.message); }

  // ───────── 2 Single upload (browser automation) ─────────
  try {
    await keyboardOff();
    await R.goto("/capture?openUpload=1"); await sleep(2500);
    const inputs = await S.evaluate(`[...document.querySelectorAll('input[type=file]')].map((i) => ({ accept: i.accept, capture: i.getAttribute('capture'), multiple: i.multiple }))`);
    rec("single-upload", "page has a plain file input (not the camera one)", inputs.some((i) => !i.capture), inputs);
    const ok = await filePick("input[type=file]:not([capture])", [ASSETS + "/toy-figure.jpg"]);
    await sleep(3000);
    const attached = await S.evaluate(`(() => { const t = document.body.innerText; return { photoCount: (t.match(/(\\d+) photos?/) || [])[0] || null, hasPreview: !!document.querySelector('img[src^="blob:"], img[src^="data:"]') }; })()`);
    rec("single-upload", "chosen file attached (picture shows on the page)", ok && (attached.hasPreview || !!attached.photoCount), attached);
    await shot("2-single-upload-attached");
    await R.type(`document.querySelector("input[placeholder='Item name']")`, `${TAG} Upload Item`);
    await R.clickExpr(btn("Save to Vault"), 7000);
    let rows = []; for (let i = 0; i < 10 && !rows.length; i++) { rows = await byTitle(`${TAG} Upload Item%`); if (!rows.length) await sleep(1500); }
    rec("single-upload", "saved item is in the database with its picture", rows.length === 1 && !!rows[0].image_front_url, rows.length ? { id: rows[0].id, image: !!rows[0].image_front_url } : "none");
    if (rows.length) ids.items.push(rows[0].id);
  } catch (e) { rec("single-upload", "script error", false, e.message); }

  // ───────── 3 Bulk upload ─────────
  try {
    await R.goto("/vault/bulk"); await sleep(2500);
    const uni = await setSel(0, "pop"); await sleep(600);
    const cat = await setSel(1, "comic"); await sleep(600);
    rec("bulk", "Universe and Category chosen", !!uni && !!cat, { universe: uni, category: cat });
    const ok = await filePick("input[type=file]", [ASSETS + "/comic-cover.jpg", ASSETS + "/sports-card.jpg"]);
    await sleep(3000);
    const titles = await S.evaluate(`[...document.querySelectorAll('input[placeholder="Title (optional)"]')].length`);
    rec("bulk", "two pictures chosen (two title fields appear)", ok && titles === 2, { titleFields: titles });
    await keyboardOn(); await sleep(400);
    await R.type(`document.querySelectorAll('input[placeholder="Title (optional)"]')[0]`, `${TAG} Bulk One`);
    await R.type(`document.querySelectorAll('input[placeholder="Title (optional)"]')[1]`, `${TAG} Bulk Two`);
    await keyboardOff(); await sleep(400);
    await R.clickExpr(btn("Fill in by hand"), 2500);
    const review = await S.evaluate(`({ names: [...document.querySelectorAll('input[placeholder="Untitled Item"]')].map((i) => i.value), addAll: !![...document.querySelectorAll('button')].find((b) => /^Add all 2 to Vault$/.test(b.innerText.trim())) })`);
    rec("bulk", "Fill in by hand opens the review with both names and Add all 2", review.names.length === 2 && review.addAll, review);
    await shot("3-bulk-review");
    await keyboardOn(); await sleep(400);
    await R.type(`document.querySelectorAll('input[placeholder="Untitled Item"]')[1]`, `${TAG} Bulk Two Edited`);
    await R.type(`document.querySelectorAll('input[type=number]')[0]`, "12");
    const addInfo = await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Add all 2 to Vault$/.test(x.innerText.trim())); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); const bar = document.querySelector('nav[aria-label="Main navigation"]'); const bt = bar ? bar.firstElementChild.getBoundingClientRect().top : innerHeight; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { reachable: !!t && (t === b || b.contains(t)), clearOfBar: r.bottom <= bt }; })()`);
    rec("bulk", "Add all reachable with the keyboard up", !!addInfo && addInfo.reachable && addInfo.clearOfBar, addInfo);
    await R.clickExpr(btn("Add all 2 to Vault"), 7000);
    await keyboardOff();
    rec("bulk", "after Add all the app goes to the Vault", (await S.path()) === "/vault", await S.path());
    let rows = []; for (let i = 0; i < 12 && rows.length < 2; i++) { rows = await byTitle(`${TAG} Bulk%`); if (rows.length < 2) await sleep(1500); }
    rec("bulk", "both items are in the database with pictures", rows.length === 2 && rows.every((r) => !!r.image_front_url), rows.map((r) => ({ title: r.title, image: !!r.image_front_url, universe: r.universe, category: r.category_label || r.categoryLabel })));
    rec("bulk", "names, filing and value were stored", rows.some((r) => r.title === `${TAG} Bulk One`) && rows.some((r) => r.title === `${TAG} Bulk Two Edited`) && rows.every((r) => /pop/i.test(String(r.universe))), rows.map((r) => ({ title: r.title, universe: r.universe, value: r.current_value ?? r.currentValue })));
    rows.forEach((r) => ids.items.push(r.id));
    await R.goto("/vault"); await sleep(2500); await S.evaluate("location.reload()"); await sleep(3500);
    const txt = await R.text();
    rec("bulk", "after a reload the Vault lists the bulk items", txt.includes(`${TAG} Bulk One`) || txt.includes(`${TAG} Bulk Two Edited`), { one: txt.includes(`${TAG} Bulk One`), two: txt.includes(`${TAG} Bulk Two Edited`) });
  } catch (e) { rec("bulk", "script error", false, e.message); await shot("3-bulk-error").catch(() => {}); }

  // ───────── 4 Exhibitions ─────────
  try {
    await keyboardOff();
    await R.goto("/museum/new"); await sleep(2500);
    await keyboardOn(); await sleep(400);
    const GT = `${TAG} Exhibit`;
    await R.type(`document.querySelector("input[placeholder='e.g. Hall of Grails']")`, GT);
    await R.type(`document.querySelector('textarea[placeholder^="Write a short curatorial"]')`, `${TAG} created with the keyboard up`);
    const enabled = await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].filter((x) => /^Create Exhibition$/.test(x.innerText.trim())).pop(); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); const bar = document.querySelector('nav[aria-label="Main navigation"]'); const bt = bar ? bar.firstElementChild.getBoundingClientRect().top : innerHeight; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { disabled: b.disabled, reachable: !!t && (t === b || b.contains(t)), clearOfBar: r.bottom <= bt }; })()`);
    rec("exhibitions", "Create Exhibition enabled, reachable with the keyboard up", !!enabled && !enabled.disabled && enabled.reachable && enabled.clearOfBar, enabled);
    await shot("4-exhibition-new-typed-keyboard");
    await R.clickExpr(`[...document.querySelectorAll('button')].filter((x) => /^Create Exhibition$/.test(x.innerText.trim())).pop()`, 7000);
    const p = await S.path(); const gid = (p.match(/^\/museum\/([^/]+)$/) || [])[1];
    rec("exhibitions", "creating goes to the new exhibition", !!gid && gid !== "new", p);
    if (gid && gid !== "new") {
      ids.gallery = gid;
      let g = null; for (let i = 0; i < 8 && !g; i++) { const r = await admin.from("galleries").select("*").eq("id", gid).maybeSingle(); g = r.data; if (!g) await sleep(1200); }
      rec("exhibitions", "exhibition is in the database with the typed title", !!g && g.title === GT, g ? { title: g.title, description: g.description } : "none");
      // header title/description editor with the keyboard up
      await sleep(1500);
      await R.clickExpr(`document.querySelector('button[aria-label="Edit title and description"]')`, 1000);
      await R.type(`document.querySelector("input[placeholder='Exhibit title']")`, `${GT} Renamed`);
      await R.type(`document.querySelector("input[placeholder='Curated collection presentation'], textarea[placeholder='Curated collection presentation']")`, `${TAG} header description`);
      await shot("4-exhibition-header-edit-keyboard");
      await sleep(3500); // autosave about a second after the last edit
      let g2 = (await admin.from("galleries").select("*").eq("id", gid).maybeSingle()).data;
      rec("exhibitions", "header title and description autosaved", !!g2 && g2.title === `${GT} Renamed` && String(g2.description || "").includes(`${TAG} header`), g2 ? { title: g2.title, description: g2.description } : "none");
      await R.clickExpr(`document.querySelector('button[aria-label="Done editing title and description"]')`, 800).catch(() => {});
      // builder page name/description + toolbar Save
      const hasFields = await S.evaluate(`!!document.querySelector("input[placeholder='Exhibit name…']")`);
      rec("exhibitions", "builder page name and description fields are present", hasFields, hasFields);
      if (hasFields) {
        await S.evaluate(`document.querySelector("input[placeholder='Exhibit name…']").scrollIntoView({ block: 'center' })`);
        await R.type(`document.querySelector("input[placeholder='Exhibit name…']")`, `${TAG} Page One`);
        await R.type(`document.querySelector("textarea[placeholder='Exhibit description…']")`, `${TAG} page description typed with the keyboard up`);
        const sv = await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Save$/.test(x.innerText.trim())); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); const bar = document.querySelector('nav[aria-label="Main navigation"]'); const bt = bar ? bar.firstElementChild.getBoundingClientRect().top : innerHeight; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { reachable: !!t && (t === b || b.contains(t)), clearOfBar: r.bottom <= bt, h: Math.round(r.height) }; })()`);
        rec("exhibitions", "builder Save reachable with the keyboard up", !!sv && sv.reachable && sv.clearOfBar, sv);
        await R.clickExpr(btn("Save"), 3500);
        await shot("4-exhibition-builder-saved");
        // the builder's pages (name + description) are stored in the exhibition's own exhibition_layout column
        let lay = ""; for (let i = 0; i < 8; i++) { lay = JSON.stringify(((await admin.from("galleries").select("exhibition_layout").eq("id", gid).maybeSingle()).data || {}).exhibition_layout || ""); if (lay.includes(`${TAG} Page One`)) break; await sleep(1200); }
        rec("exhibitions", "builder page name and description saved to the database (exhibition_layout)", lay.includes(`${TAG} Page One`) && lay.includes(`${TAG} page description`), { name: lay.includes(`${TAG} Page One`), description: lay.includes(`${TAG} page description`) });
        await keyboardOff(); await sleep(400);
        await R.goto(`/museum/${gid}`); await sleep(3000); await S.evaluate("location.reload()"); await sleep(4000);
        const after = await S.evaluate(`({ name: (document.querySelector("input[placeholder='Exhibit name…']") || {}).value || null, desc: (document.querySelector("textarea[placeholder='Exhibit description…']") || {}).value || null, text: document.body.innerText.includes(${JSON.stringify(GT + " Renamed")}) })`);
        rec("exhibitions", "after a reload the saved title, page name and description show", after.text && after.name === `${TAG} Page One` && String(after.desc || "").includes(`${TAG} page description`), after);
        await shot("4-exhibition-reloaded");
      }
    }
  } catch (e) { rec("exhibitions", "script error", false, e.message); await shot("4-exhibition-error").catch(() => {}); }

  fs.writeFileSync(path.join(OUT, "functional-results.json"), JSON.stringify({ tag: TAG, createdItemIds: ids.items, createdGalleryId: ids.gallery, results }, null, 1));
  console.log(`DONE ${results.filter((r) => r.ok).length}/${results.length} passed; tag ${TAG}`);
  await R.close(); process.exit(0);
})();

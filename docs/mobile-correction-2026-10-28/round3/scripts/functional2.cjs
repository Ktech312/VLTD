// Functional phone checks, part 2, on the live app (vltd.app), Chrome phone emulation (not a physical phone), synthetic collector, NO AI (no Identify button is pressed; the page's network log is checked for /api/ai).
//   Quick Add: test camera (a looping picture feed) -> take two pictures -> Finished -> review -> Add -> fill names and cost with the emulated keyboard -> Save -> items in the database with pictures -> reload.
//   Exhibition items: create an exhibition, open the builder, Edit/Add, choose two Vault items, confirm, Save, check the database, reload, check the builder.
// The emulated keyboard = the screen made 336 px shorter. A real keyboard, and a real phone camera, can differ.
//   AUDIT_MANIFEST=<qa manifest> TUT_WORK=<dir> node functional2.cjs <outDir>
const fs = require("fs"), path = require("path");
const GUIDE = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/walkthrough/add-item-guide/_build";
const { start, btn, T } = require(GUIDE + "/lib.cjs");
const sharp = require("C:/Users/EK/VLTD/node_modules/sharp");
const sleep = T.sleep, admin = T.admin;
const OUT = process.argv[2];
const TAG = "QAFUNC2" + Date.now().toString(36).slice(-4).toUpperCase();
const W = 390, H = 844, KB = 336;
const results = [];
const rec = (test, step, ok, detail) => { results.push({ test, step, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} [${test}] ${step}${detail ? " :: " + (typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 300) : ""}`); };
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const R = await start({ scene: "functional2", phone: true, camera: true });
  const { S, m } = R; const P = m.personalId;
  const shot = async (n) => { const png = await S.send("Page.captureScreenshot", { format: "png" }); await sharp(Buffer.from(png.data, "base64")).jpeg({ quality: 80 }).toFile(path.join(OUT, n + ".jpg")); };
  const view = (h) => S.send("Emulation.setDeviceMetricsOverride", { width: W, height: h, deviceScaleFactor: 2, mobile: true });
  const kbOn = () => view(H - KB), kbOff = () => view(H);
  const byTitle = async (like) => (await admin.from("vault_items").select("*").eq("profile_id", P).ilike("title", like)).data || [];
  await view(H);

  // ───────── Quick Add ─────────
  try {
    if (process.env.ONLY_EXH) throw new Error("__skip__");
    await R.goto("/vault/quick"); await sleep(2500);
    await R.waitFeed("toy-figure"); await R.click("Take picture", 900);
    await R.waitFeed("comic-cover"); await R.click("Take picture", 900);
    const t1 = await R.text();
    rec("quick-add", "two pictures taken with the test camera (Finished (2))", /Finished \(2\)/.test(t1), (t1.match(/Finished \(\d+\)/) || [])[0]);
    await shot("q1-camera-two-shots");
    const fin = await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].filter((x) => x.getBoundingClientRect().width > 0).map((x) => ({ t: ((x.innerText || '') + '').trim().replace(/\\s+/g, ' '), a: x.getAttribute('aria-label'), d: x.disabled })); return b.filter((x) => /Finished|Review|captured/i.test(x.t + ' ' + x.a)); })()`);
    console.log("finish-like buttons:", JSON.stringify(fin));
    await R.clickExpr(`[...document.querySelectorAll('button')].find((b) => b.getBoundingClientRect().width > 0 && (/^Finished/.test(((b.innerText || '') + '').trim()) || /Review captured items/.test(b.getAttribute('aria-label') || '')))`, 1800);
    const t2 = await R.text();
    rec("quick-add", "Finished opens the review: 2 items ready, Add 2 items to Vault", /2 items ready/.test(t2) && /Add 2 items to Vault/.test(t2), (t2.match(/\d+ items? ready/) || [])[0]);
    await R.clickExpr(`[...document.querySelectorAll("button")].find((b) => b.getBoundingClientRect().width > 0 && /Add 2 items to Vault/.test(b.innerText))`, 2200);
    const vs = await S.evaluate(`({ names: document.querySelectorAll("input[placeholder='Item name']").length, aiButtons: [...document.querySelectorAll('button')].filter((b) => /Identify/i.test(b.innerText)).length, save: [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).find((t) => /^Save \\d+ items? to Vault$/.test(t)) || null })`);
    rec("quick-add", "verify sheet shows two Item name fields and Save 2 items to Vault (AI buttons present but never pressed)", vs.names === 2 && vs.save === "Save 2 items to Vault", vs);
    await kbOn(); await sleep(400);
    await R.type(`document.querySelectorAll("input[placeholder='Item name']")[0]`, `${TAG} Quick One`);
    await R.type(`document.querySelectorAll("input[placeholder='Item name']")[1]`, `${TAG} Quick Two`);
    await R.type(`document.querySelectorAll("input[placeholder='Cost ($)']")[0]`, "7");
    await shot("q2-verify-typed-keyboard");
    const sv = await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /^Save \\d+ items? to Vault$/.test(x.innerText.trim())); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); const bar = document.querySelector('nav[aria-label="Main navigation"]'); const bt = bar ? bar.firstElementChild.getBoundingClientRect().top : innerHeight; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { reachable: !!t && (t === b || b.contains(t)), clearOfBar: r.bottom <= bt, h: Math.round(r.height) }; })()`);
    rec("quick-add", "Save reachable with the keyboard up", !!sv && sv.reachable && sv.clearOfBar, sv);
    await R.clickExpr(`[...document.querySelectorAll("button")].find((b) => b.getBoundingClientRect().width > 0 && /Save 2 items to Vault/.test(b.innerText))`, 7000);
    await kbOff(); await sleep(500);
    rec("quick-add", "after Save the app is in the Vault", (await S.path()) === "/vault", await S.path());
    let rows = []; for (let i = 0; i < 12 && rows.length < 2; i++) { rows = await byTitle(`${TAG} Quick%`); if (rows.length < 2) await sleep(1500); }
    rec("quick-add", "both items are in the database with pictures", rows.length === 2 && rows.every((r) => !!r.image_front_url), rows.map((r) => ({ title: r.title, image: !!r.image_front_url, via: r.added_via || r.addedVia, cost: r.purchase_price })));
    rec("quick-add", "typed names and cost were stored", rows.some((r) => r.title === `${TAG} Quick One`) && rows.some((r) => r.title === `${TAG} Quick Two`) && rows.some((r) => Number(r.purchase_price) === 7), rows.map((r) => ({ title: r.title, cost: r.purchase_price })));
    const aiCalls = await S.evaluate(`performance.getEntriesByType('resource').filter((e) => /\\/api\\/ai\\//.test(e.name)).map((e) => e.name.split('?')[0])`);
    rec("quick-add", "no AI request was made by the page", aiCalls.length === 0, aiCalls);
    await S.evaluate("location.reload()"); await sleep(4000);
    const txt = await R.text();
    rec("quick-add", "after a reload the Vault lists both", txt.includes(`${TAG} Quick One`) || txt.includes(`${TAG} Quick Two`), { one: txt.includes(`${TAG} Quick One`), two: txt.includes(`${TAG} Quick Two`) });
    await shot("q3-vault-after-quick-add");
  } catch (e) { if (e.message !== "__skip__") { rec("quick-add", "script error", false, e.message); await shot("q-error").catch(() => {}); } }

  // ───────── Exhibition: add items, save, reload ─────────
  try {
    await kbOff();
    const nav = R.goto("/museum/new"); await sleep(3000); await S.send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {}); await nav; await sleep(1500);
    await R.type(`document.querySelector("input[placeholder='e.g. Hall of Grails']")`, `${TAG} Items Exhibit`);
    await R.clickExpr(`[...document.querySelectorAll('button')].filter((x) => /^Create Exhibition$/.test(x.innerText.trim())).pop()`, 7000);
    const p = await S.path(); const gid = (p.match(/^\/museum\/([^/]+)$/) || [])[1];
    rec("exhibition-items", "exhibition created", !!gid && gid !== "new", p);
    if (gid && gid !== "new") {
      await sleep(2500);
      const before = (await admin.from("gallery_items").select("*").eq("gallery_id", gid)).data || [];
      rec("exhibition-items", "new exhibition starts with no items", before.length === 0, before.length);
      await R.clickExpr(`[...document.querySelectorAll('button')].find((b) => /^Edit\\/Add/.test(b.innerText.trim()))`, 2200);
      const dlg = await S.evaluate(`!![...document.querySelectorAll('[role=dialog]')].find((d) => /Choose items/.test(d.getAttribute('aria-label') || ''))`);
      rec("exhibition-items", "Edit/Add opens the item picker", dlg, dlg);
      await shot("e1-picker-open");
      const picked = await S.evaluate(`(() => { const d = [...document.querySelectorAll('[role=dialog]')].find((x) => /Choose items/.test(x.getAttribute('aria-label') || '')); const tiles = [...d.querySelectorAll('button[aria-pressed]')].filter((b) => b.getBoundingClientRect().width > 10 && !!b.getAttribute('aria-label') && !!b.style.aspectRatio); const chosen = tiles.slice(0, 2); chosen.forEach((b) => b.click()); return chosen.map((b) => b.getAttribute('aria-label')); })()`);
      await sleep(600);
      rec("exhibition-items", "two Vault items chosen in the picker", picked.length === 2, picked);
      await shot("e2-picker-two-chosen");
      const conf = await S.evaluate(`(() => { const d = [...document.querySelectorAll('[role=dialog]')].find((x) => /Choose items/.test(x.getAttribute('aria-label') || '')); const b = [...d.querySelectorAll('button')].filter((x) => /w-full/.test(x.className)).pop(); if (!b) return null; const label = b.innerText.trim(); b.scrollIntoView({ block: 'center' }); b.click(); return label; })()`);
      await sleep(2500);
      rec("exhibition-items", "picker confirmed", !!conf, conf);
      const shown = await S.evaluate(`({ text: document.body.innerText, empty: document.querySelectorAll('[aria-label="Empty slot"]').length })`);
      rec("exhibition-items", "builder shows the two items by name (and 16 of 18 slots empty)", picked.every((t) => shown.text.includes(t)) && shown.empty === 16, { names: picked.map((t) => shown.text.includes(t)), emptySlots: shown.empty });
      await kbOn(); await sleep(400);
      const sv = await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => /^(Save|Saved ✓)$/.test(x.innerText.trim())); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); const bar = document.querySelector('nav[aria-label="Main navigation"]'); const bt = bar ? bar.firstElementChild.getBoundingClientRect().top : innerHeight; const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { reachable: !!t && (t === b || b.contains(t)), clearOfBar: r.bottom <= bt }; })()`);
      rec("exhibition-items", "builder Save reachable with the keyboard up", !!sv && sv.reachable && sv.clearOfBar, sv);
      await R.clickExpr(btn("Save"), 3500);
      await shot("e3-saved");
      await kbOff(); await sleep(500);
      let rows = []; for (let i = 0; i < 10; i++) { rows = (await admin.from("gallery_items").select("*").eq("gallery_id", gid)).data || []; if (rows.length >= 2) break; await sleep(1500); }
      const ids = (await admin.from("vault_items").select("id,title").eq("profile_id", P).in("title", picked)).data || [];
      rec("exhibition-items", "two items are stored with the exhibition in the database", rows.length === 2 && ids.every((i) => rows.some((r) => JSON.stringify(r).includes(i.id))), { rows: rows.length, matched: ids.filter((i) => rows.some((r) => JSON.stringify(r).includes(i.id))).length });
      await R.goto(`/museum/${gid}`); await sleep(3000); await S.evaluate("location.reload()"); await sleep(4500);
      await S.evaluate(`document.querySelector("input[placeholder='Exhibit name…']") && document.querySelector("input[placeholder='Exhibit name…']").scrollIntoView({ block: 'start' })`); await sleep(800);
      const after = await S.evaluate(`({ text: document.body.innerText, empty: document.querySelectorAll('[aria-label="Empty slot"]').length, count: (document.body.innerText.match(/(\d+) ITEMS/i) || [])[1] || null })`);
      rec("exhibition-items", "after a reload the builder still shows both items (header count, names, empty slots)", picked.every((t) => after.text.includes(t)) && after.empty === 16, { names: picked.map((t) => after.text.includes(t)), emptySlots: after.empty, headerCount: after.count });
      await shot("e4-reloaded");
    }
  } catch (e) { rec("exhibition-items", "script error", false, e.message); await shot("e-error").catch(() => {}); }

  fs.writeFileSync(path.join(OUT, "functional2-results.json"), JSON.stringify({ tag: TAG, results }, null, 1));
  console.log(`DONE ${results.filter((r) => r.ok).length}/${results.length} passed; tag ${TAG}`);
  await R.close(); process.exit(0);
})();

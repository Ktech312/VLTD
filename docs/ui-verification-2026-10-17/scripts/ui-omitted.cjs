// The browser checks that the first audit skipped: photo reorder / crop+rotate / add, specialist Details (yes-no-unknown, explicit
// false, other-saved-details after a category change) and the Organize flow. Synthetic QA account only; every storage upload
// made by the test is removed at the end. AI / background-removal endpoints are refused and counted (must stay 0).
//   node ui-omitted.cjs <label> --base=http://localhost:3000
const fs = require("fs");
const path = require("path");
const { session, qa, admin, sleep } = require("./ui-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3000").slice(7);
const LABEL = process.argv[2] || "omitted";
const OUT = path.join(__dirname, "shots-omitted-" + LABEL); fs.mkdirSync(OUT, { recursive: true });
const PHOTO = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/public/collectibles/guitar.png";
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 600)); };
const info = (n, d) => console.log("INFO", n, JSON.stringify(d ?? "").slice(0, 600));
const row = async (id) => (await admin.from("vault_items").select("*").eq("id", id).maybeSingle()).data;
const poll = async (fn, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const v = await fn(); if (v) return v; await sleep(1500); } return null; };
const setSel = (S, label, v) => S.evaluate("(() => { const s = document.querySelector(" + JSON.stringify('select[aria-label="' + label + '"]') + "); if (!s) return false; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, " + JSON.stringify(v) + "); s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()");
const setIn = (S, label, v) => S.evaluate("(() => { const i = document.querySelector(" + JSON.stringify('input[aria-label="' + label + '"]') + "); if (!i) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, " + JSON.stringify(v) + "); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()");
const ID = (n) => `qa_ui_${qa.stamp}_${n}`;

async function guard(S) {
  const st = { ai: [] };
  await S.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/ai/*", requestStage: "Request" }, { urlPattern: "*remove.bg*", requestStage: "Request" }] });
  S.c.on(async (m) => { if (m.method !== "Fetch.requestPaused") return; st.ai.push(m.params.request.url); try { await S.send("Fetch.fulfillRequest", { requestId: m.params.requestId, responseCode: 418, body: Buffer.from("{}").toString("base64") }); } catch { /* gone */ } });
  return st;
}
const bucketPath = (url) => { const m = /\/object\/public\/([^/]+)\/(.+)$/.exec(String(url || "")); return m ? { bucket: m[1], p: decodeURIComponent(m[2]) } : null; };

(async () => {
  const uploaded = [];
  const orig1 = await row(ID(1)); const orig2 = await row(ID(2));
  if (orig2.category !== "SPORTS_CARDS" || orig2.sports_is_auto !== null || orig2.purchase_tax !== null) { console.log("FIXTURE NOT CLEAN: item 2 is not a fresh sports card; run ui-cleanup and ui-setup first", { c: orig2.category, a: orig2.sports_is_auto, t: orig2.purchase_tax }); process.exit(3); }
  const S = await session(BASE, { width: 1440, height: 900 });
  const g = await guard(S);
  try {
    // =============== PHOTOS (item 1 has two photos) ===============
    await S.go("/vault/item/" + ID(1)); await S.waitFor("document.querySelectorAll('[aria-label=\"Move down\"]').length >= 1", 120000, "photo list"); await sleep(1500);
    const urls = (r) => (Array.isArray(r.images_json) ? r.images_json : []).map((x) => x.url || x.storageKey);
    const before = urls(await row(ID(1)));
    check("[photos] the fixture item has two photos to work with", before.length === 2, before);
    await S.evaluate("[...document.querySelectorAll('[aria-label=\"Move down\"]')].find((b) => !b.disabled).click(); true"); await sleep(1500);
    const moved = await poll(async () => { const u = urls(await row(ID(1))); return u[0] === before[1] && u[1] === before[0] ? u : null; });
    check("[photos reorder] Move down swaps the two photos in the account", !!moved, urls(await row(ID(1))));
    const C = await session(BASE, { width: 1440, height: 900 });
    try {
      await C.go("/vault/item/" + ID(1)); await C.waitFor("document.querySelectorAll('[aria-label=\"Move down\"]').length >= 1", 120000, "photo list 2"); await sleep(1500);
      const order = await C.evaluate("[...document.querySelectorAll('img')].map((i) => i.getAttribute('src') || '').filter((s) => s.includes('collectibles'))");
      check("[photos reorder] a clean second browser shows the new order (first photo is now the other one)", order.length > 0 && order[0].includes(path.basename(before[1]).replace(/\\.png.*/, "")), { order: order.slice(0, 3), want: before[1] });
    } finally { await C.close(); }

    // crop / rotate + Save Photo replaces the chosen photo with an edited copy
    await S.go("/vault/item/" + ID(1)); await S.waitFor("[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Edit Photo')", 120000, "edit photo"); await sleep(1500);
    await S.evaluate("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Edit Photo').click(); true");
    await S.waitFor("document.querySelector('[role=dialog][aria-label=\"Edit saved photo\"]')", 30000, "crop dialog"); await sleep(2500);
    await S.shot(OUT + "/crop-dialog.png");
    await S.evaluate("[...document.querySelectorAll('[role=dialog] button')].find((b) => /Rotate right/.test(b.textContent)).click(); true"); await sleep(2500);
    await S.evaluate("[...document.querySelectorAll('[role=dialog] button')].find((b) => /Save Photo/.test(b.textContent)).click(); true");
    const replaced = await poll(async () => { const r = await row(ID(1)); const u = urls(r); return u.some((x) => /\/storage\/v1\/object\/public\//.test(String(x))) ? r : null; }, 60000);
    check("[photos crop] Rotate + Save Photo replaces that photo with an edited copy in storage (the other photo is untouched)", !!replaced && urls(replaced).filter((x) => /collectibles/.test(String(x))).length === 1, replaced && urls(replaced));
    for (const x of (replaced ? replaced.images_json : [])) { const b = bucketPath(x.url); if (b) uploaded.push(b); }
    check("[photos crop] other fields of the item are unchanged (title, cost, status)", replaced && replaced.title === orig1.title && replaced.purchase_price === orig1.purchase_price && replaced.status === orig1.status, replaced && { t: replaced.title, p: replaced.purchase_price });

    // add a photo by upload
    const nBefore = (await row(ID(1))).images_json.length;
    await S.send("DOM.enable");
    const doc = await S.send("DOM.getDocument", { depth: 1 });
    const q = await S.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input[type=file][accept=\"image/*\"][multiple]" });
    await S.send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: [PHOTO] });
    // one chosen photo opens the "Rotate it, use it, or retake it" step first; nothing is added until Use Photo
    await S.waitFor("[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Use Photo')", 30000, "use photo step"); await sleep(1500);
    check("[photos add] nothing is added until 'Use Photo' is pressed", (await row(ID(1))).images_json.length === nBefore);
    await S.evaluate("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Use Photo').click(); true");
    const added = await poll(async () => { const r = await row(ID(1)); return r.images_json.length === nBefore + 1 ? r : null; }, 60000);
    check("[photos add] a photo added from the device is saved with the item", !!added, nBefore);
    for (const x of (added ? added.images_json : [])) { const b = bucketPath(x.url); if (b && !uploaded.some((u) => u.p === b.p)) uploaded.push(b); }
    check("[photos] none of that made a paid AI / background-removal request", g.ai.length === 0, g.ai);

    // =============== DETAILS (sports card, item 2) ===============
    await S.go("/vault/item/" + ID(2)); await S.waitFor("document.querySelector('[aria-label=\"Edit details\"]')", 120000, "details"); await sleep(2000);
    const r0 = await row(ID(2));
    await S.evaluate("document.querySelector('[aria-label=\"Edit details\"]').click(); true"); await sleep(600);
    await setIn(S, "Player / athlete", "QA Player"); await setIn(S, "Parallel / variant", "QA Parallel");
    await setSel(S, "Autograph", "no"); await setSel(S, "Relic / patch card", "yes");
    await S.evaluate("document.querySelector('[aria-label=\"Save details\"]').click(); true"); await sleep(2500);
    const r1 = await poll(async () => { const r = await row(ID(2)); return JSON.stringify(r).includes("QA Player") ? r : null; }, 40000);
    check("[details] typed values and Yes / No choices are saved to the account", !!r1);
    const flat1 = JSON.stringify(r1);
    check("[details] 'No' is stored as an explicit false (sports_is_auto = false, not null)", r1.sports_is_auto === false, r1.sports_is_auto);
    check("[details] 'Yes' is stored as true (sports_is_relic = true)", r1.sports_is_relic === true, r1.sports_is_relic);
    const changedCols = Object.keys(r1).filter((k) => JSON.stringify(r1[k]) !== JSON.stringify(r0[k]) && k !== "updated_at");
    info("[details] columns that changed", changedCols);
    check("[details] existing values elsewhere were preserved (title, cost, value, classification)", r1.title === r0.title && r1.purchase_price === r0.purchase_price && r1.current_value === r0.current_value && r1.category === r0.category && r1.subcategory_label === r0.subcategory_label);
    const C2 = await session(BASE, { width: 1440, height: 900 });
    try {
      await C2.go("/vault/item/" + ID(2)); await C2.waitFor("/QA Player/.test(document.body.innerText)", 120000, "details clean"); await sleep(1500);
      const txt = await C2.evaluate("document.body.innerText");
      check("[details] a clean second browser shows the saved values, with Autograph = No and Relic = Yes", /QA Player/.test(txt) && /Autograph\s*\n?\s*No/.test(txt) && /Relic[^\n]*\n?\s*Yes/.test(txt), txt.slice(txt.indexOf("Player"), txt.indexOf("Player") + 300));
    } finally { await C2.close(); }
    // back to Unknown: must not stay false
    await S.go("/vault/item/" + ID(2)); await S.waitFor("document.querySelector('[aria-label=\"Edit details\"]')", 120000); await sleep(1500);
    await S.evaluate("document.querySelector('[aria-label=\"Edit details\"]').click(); true"); await sleep(600);
    await setSel(S, "Autograph", ""); await S.evaluate("document.querySelector('[aria-label=\"Save details\"]').click(); true"); await sleep(2500);
    const r2 = await poll(async () => { const r = await row(ID(2)); return r.sports_is_auto === null ? r : null; }, 40000);
    check("[details] choosing 'Unknown' again clears the answer (sports_is_auto goes back to null, it does not stay false)", !!r2, (await row(ID(2))).sports_is_auto);
    check("[details] and the other answer (Relic = Yes) is untouched by that", r2 && r2.sports_is_relic === true, r2 && r2.sports_is_relic);
    const costsBlank = (await row(ID(2)));
    check("[details] saving Details does not turn blank tax / shipping / fees into 0 or first-edition Unknown into No", costsBlank.purchase_tax === orig2.purchase_tax && costsBlank.purchase_shipping === orig2.purchase_shipping && costsBlank.purchase_fees === orig2.purchase_fees && costsBlank.is_first_edition === orig2.is_first_edition, { tax: costsBlank.purchase_tax, ship: costsBlank.purchase_shipping, fees: costsBlank.purchase_fees, fe: costsBlank.is_first_edition, was: [orig2.purchase_tax, orig2.purchase_shipping, orig2.purchase_fees, orig2.is_first_edition] });
    // zero / blank / explicit value on a numeric-like detail kept distinct is covered by the unit suite (test:details)

    // category change keeps the old values under "Other saved details"
    await S.go("/vault/item/" + ID(2)); await S.waitFor("document.querySelector('button[aria-label=\"Edit title and category\"]')", 120000); await sleep(1500);
    await S.evaluate("document.querySelector('button[aria-label=\"Edit title and category\"]').click(); true"); await sleep(700);
    const cat = await S.evaluate("(() => { const s = document.querySelector('select[aria-label=\"Category\"]'); const cur = s.value; const o = [...s.options].find((x) => x.value && x.value !== cur && /Music|Audio|Art|Games|Toys|Comics/i.test(x.text)) || [...s.options].find((x) => x.value && x.value !== cur); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, o.value); s.dispatchEvent(new Event('change', { bubbles: true })); return { from: cur, to: o.value, text: o.text }; })()");
    await sleep(500);
    await S.evaluate("document.querySelector('button[aria-label=\"Save title and classification\"]').click(); true"); await sleep(3500);
    info("[category] changed", cat);
    const r3 = await poll(async () => { const r = await row(ID(2)); return r.category !== orig2.category || r.category_label !== orig2.category_label ? r : null; }, 40000);
    check("[category] the classification change is saved", !!r3, cat);
    await S.go("/vault/item/" + ID(2)); await S.waitFor("document.querySelector('[aria-label=\"Edit details\"]')", 120000); await sleep(2500);
    await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => /More details|Other saved details/i.test(x.textContent)); if (b) b.click(); return !!b; })()"); await sleep(800);
    const txt3 = await S.evaluate("document.body.innerText");
    check("[category] the old specialist values are still there, listed as 'Other saved details'", /Other saved details/i.test(txt3) && /QA Player|QA Parallel/.test(txt3.slice(txt3.search(/Other saved details/i))), txt3.slice(txt3.search(/Other saved details/i), txt3.search(/Other saved details/i) + 200));
    const r4 = await row(ID(2));
    check("[category] and nothing was deleted from the account", JSON.stringify(r4).includes("QA Player") && JSON.stringify(r4).includes("QA Parallel"));

    // =============== ORGANIZE ===============
    const org = [...Array(25)].map((_, i) => `${ID("org")}${i}`);
    await admin.from("vault_items").insert(org.map((id, i) => ({ id, profile_id: qa.profileId, title: `QA Org ${i + 1}`, created_at: Date.now() - i, is_public: false, status: "COLLECTION", universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", purchase_price: 1 })));
    const gid = (await admin.from("galleries").insert({ profile_id: qa.profileId, title: "QA Organize 25", description: "synthetic", visibility: "LOCKED", state: "ACTIVE", cover_image: "/collectibles/guitar.png", layout: { itemIds: org, themePack: "classic", displayMode: "grid", guestViewMode: "public" }, exhibition_layout: { itemIds: org }, public_token: "qaorg" + qa.stamp, alias_enabled: false }).select("id").single()).data.id;
    // The exhibit pages are saved in exhibition_layout.
    const gl = async () => (await admin.from("galleries").select("exhibition_layout").eq("id", gid).maybeSingle()).data.exhibition_layout;
    await S.go("/museum/" + gid); await S.waitFor("[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Organize')", 120000, "organize button"); await sleep(2500);
    check("[organize] Organize is visible on an exhibition that has no exhibit page yet", true);
    await S.evaluate("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Organize').click(); true"); await sleep(1000);
    const notice = await S.evaluate("(() => { const d = document.querySelector('[role=dialog][aria-labelledby=\"organize-notice-title\"]'); return d ? d.innerText.replace(/\\s+/g, ' ') : ''; })()");
    check("[organize] it opens a notice that says 25 pieces become two exhibit pages (18 and 7), in the picked order, nothing created unless chosen", /25 pieces/.test(notice) && /2 exhibit pages/.test(notice) && /18, 7/.test(notice) && /Nothing is created unless you choose it/.test(notice), notice);
    await S.shot(OUT + "/organize-notice.png");
    const before1 = JSON.stringify(await gl());
    await S.evaluate("[...document.querySelectorAll('[role=dialog] button')].find((b) => b.textContent.trim() === 'Not now').click(); true"); await sleep(2500);
    check("[organize] 'Not now' creates nothing", JSON.stringify(await gl()) === before1 && !(await gl()).sections);
    await S.evaluate("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Organize').click(); true"); await sleep(800);
    await S.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await sleep(2500);
    check("[organize] Escape closes the notice and creates nothing", !(await S.evaluate("!!document.querySelector('[role=dialog][aria-labelledby=\"organize-notice-title\"]')")) && !(await gl()).sections);
    await S.evaluate("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Organize').click(); true"); await sleep(800);
    await S.evaluate("(() => { const b = [...document.querySelectorAll('[role=dialog] button')].find((x) => x.textContent.trim() === 'Create first exhibit'); b.click(); b.click(); b.click(); return true; })()");
    const made = await poll(async () => { const l = await gl(); return l.sections && l.sections.length ? l : null; }, 40000);
    await sleep(6000);
    const lay = await gl();
    const secs = (lay.sections || []);
    check("[organize] three quick presses of 'Create first exhibit' make exactly two exhibit pages (18 + 7), not six", secs.length === 2 && secs[0].itemIds.length === 18 && secs[1].itemIds.length === 7, secs.map((s) => s.itemIds.length));
    const flatIds = secs.flatMap((s) => s.itemIds);
    check("[organize] the pieces are in the picked order with none dropped or repeated", JSON.stringify(flatIds) === JSON.stringify(org) && new Set(flatIds).size === 25, flatIds.length);
    await S.go("/museum/" + gid); await S.waitFor("[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Organize')", 120000); await sleep(2500);
    await S.evaluate("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Organize').click(); true"); await sleep(1200);
    check("[organize] after a reload, Organize goes straight to arranging (no notice again)", !(await S.evaluate("!!document.querySelector('[role=dialog][aria-labelledby=\"organize-notice-title\"]')")));
    const lay2 = await gl();
    check("[organize] the arrangement survives the reload unchanged", JSON.stringify((lay2.sections || []).flatMap((s) => s.itemIds)) === JSON.stringify(org));
    await admin.from("galleries").delete().eq("id", gid);
    await admin.from("vault_items").delete().in("id", org);
  } finally {
    await S.close();
    // restore item 1 and 2 exactly, and remove every storage object this test uploaded
    await admin.from("vault_items").update({ images_json: orig1.images_json, image_front_url: orig1.image_front_url, image_front_storage_path: orig1.image_front_storage_path, primary_image_key: orig1.primary_image_key }).eq("id", ID(1));
    // item 2 goes back exactly as it was found (classification, details, costs, flags)
    const { id: _i, created_at: _c, updated_at: _u, ...restore2 } = orig2;
    await admin.from("vault_items").update(restore2).eq("id", ID(2));
    for (const b of uploaded) { try { await admin.storage.from(b.bucket).remove([b.p]); } catch { /* ignore */ } }
    info("[cleanup] storage objects removed", uploaded.length);
  }
  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });

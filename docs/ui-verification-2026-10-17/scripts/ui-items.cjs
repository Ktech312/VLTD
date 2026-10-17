// Queue A: item creation / editing / deletion in a real headless Chrome against the synthetic QA account.
//   node ui-items.cjs <label> --base=http://localhost:3000
// Every request to a paid AI endpoint is caught and refused (418) so no credit can be spent, and counted:
// ordinary actions must leave that count at 0. NOTE: no regex escapes inside template strings here (a single
// backslash in a template string silently becomes a plain letter: that is what broke the earlier short script).
const fs = require("fs");
const path = require("path");
const { session, qa, admin, sleep } = require("./ui-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3000").slice(7);
const LABEL = process.argv[2] || "items";
const OUT = path.join(__dirname, "shots-items-" + LABEL); fs.mkdirSync(OUT, { recursive: true });
const PHOTO = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/public/collectibles/guitar.png";
let pass = 0, fail = 0;
const check = (name, ok, detail) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(detail ?? "").slice(0, 500)); };
const info = (name, detail) => console.log("INFO", name, JSON.stringify(detail ?? "").slice(0, 400));
const rowsByTitle = async (t) => (await admin.from("vault_items").select("*").eq("profile_id", qa.profileId).eq("title", t)).data || [];
const waitRow = async (t, ms = 40000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const r = await rowsByTitle(t); if (r.length) return r; await sleep(1500); } return []; };
const setVal = (S, sel, v) => S.evaluate("(() => { const i = document.querySelector(" + JSON.stringify(sel) + "); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, " + JSON.stringify(v) + "); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()");

// Refuses every AI call (and counts it); optionally fails DELETEs on vault_items.
async function guard(S) {
  const st = { ai: [], failDelete: false, deletesFailed: 0 };
  await S.send("Fetch.enable", { patterns: [{ urlPattern: "*/api/ai/*", requestStage: "Request" }, { urlPattern: "*remove.bg*", requestStage: "Request" }, { urlPattern: "*/rest/v1/vault_items*", requestStage: "Request" }] });
  S.c.on(async (m) => {
    if (m.method !== "Fetch.requestPaused") return;
    const { requestId, request } = m.params;
    try {
      if (/\/api\/ai\/|remove\.bg/.test(request.url)) {
        st.ai.push(request.url);
        await S.send("Fetch.fulfillRequest", { requestId, responseCode: 418, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from(JSON.stringify({ error: "blocked by QA" })).toString("base64") });
      } else if (st.failDelete && request.method === "DELETE") {
        st.deletesFailed++;
        await S.send("Fetch.fulfillRequest", { requestId, responseCode: 500, responseHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: "*" }], body: Buffer.from(JSON.stringify({ message: "QA: refused" })).toString("base64") });
      } else await S.send("Fetch.continueRequest", { requestId });
    } catch { /* request gone */ }
  });
  return st;
}

async function fillAndSave(S, { title, cost, photo }) {
  await S.go("/capture");
  await S.waitFor("document.getElementById('capture-item-name')", 120000, "capture form"); await sleep(1500);
  if (photo) {
    await S.send("DOM.enable");
    const doc = await S.send("DOM.getDocument", { depth: 1 });
    const q = await S.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: "input[type=file]:not([capture])" });
    await S.send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: [PHOTO] });
    await S.waitFor("document.querySelectorAll('img[src^=blob]').length >= 1", 20000, "photo thumbnail");
  }
  await setVal(S, "#capture-item-name", title);
  if (cost !== undefined) {
    await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Pricing and market')); if (b) b.click(); return true; })()"); await sleep(500);
    await S.evaluate("(() => { const labels = [...document.querySelectorAll('label')]; const l = labels.find((x) => x.textContent.trim().startsWith('Purchase price')); const i = l.parentElement.querySelector('input'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, " + JSON.stringify(cost) + "); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()");
  }
}
const clickSave = (S) => S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Save to Vault')); b.click(); return true; })()");

(async () => {
  // earlier runs' rows (QA profile only, exact title prefix) so the counts below are about this run
  await admin.from("vault_items").delete().eq("profile_id", qa.profileId).like("title", "QA Added %");
  // ================= create =================
  const S = await session(BASE, { width: 1440, height: 900 });
  const g = await guard(S);
  try {
    const before = (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", qa.profileId)).count;

    // empty and whitespace-only titles
    await S.go("/capture"); await S.waitFor("document.getElementById('capture-item-name')", 120000, "capture"); await sleep(1500);
    await clickSave(S); await sleep(800);
    let a = await S.evaluate("({ alert: document.querySelector('[role=alert]')?.textContent || '', url: location.pathname })");
    check("[create] an empty title is refused with a plain message and stays on the form", /Item name is required/.test(a.alert) && a.url === "/capture", a);
    await setVal(S, "#capture-item-name", "     "); await clickSave(S); await sleep(800);
    a = await S.evaluate("({ alert: document.querySelector('[role=alert]')?.textContent || '', url: location.pathname })");
    check("[create] a whitespace-only title is refused the same way", /Item name is required/.test(a.alert) && a.url === "/capture", a);
    await sleep(2000);
    const afterEmpty = (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", qa.profileId)).count;
    check("[create] neither refused save created a record", afterEmpty === before, { before, afterEmpty });

    // blank cost + double tap = one record, cost unknown (null), not zero
    await fillAndSave(S, { title: "QA Added Blank Cost" });
    await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Save to Vault')); b.click(); b.click(); b.click(); return true; })()");
    let rows = await waitRow("QA Added Blank Cost"); await sleep(5000); rows = await rowsByTitle("QA Added Blank Cost");
    check("[create] three quick taps on Save make exactly one record", rows.length === 1, rows.length);
    check("[create] a blank purchase price is saved as unknown (null), not zero", rows[0] && rows[0].purchase_price === null, rows[0] && rows[0].purchase_price);

    // explicit zero, positive, negative
    await fillAndSave(S, { title: "QA Added Zero Cost", cost: "0" }); await clickSave(S);
    rows = await waitRow("QA Added Zero Cost");
    check("[create] an explicit 0 purchase price is saved as 0 (different from blank)", rows[0] && rows[0].purchase_price === 0, rows[0] && rows[0].purchase_price);
    await fillAndSave(S, { title: "QA Added Positive Cost", cost: "12.5" }); await clickSave(S);
    rows = await waitRow("QA Added Positive Cost");
    check("[create] 12.5 is saved as 12.5", rows[0] && Number(rows[0].purchase_price) === 12.5, rows[0] && rows[0].purchase_price);
    await fillAndSave(S, { title: "QA Added Negative Cost", cost: "-5" }); await clickSave(S);
    rows = await waitRow("QA Added Negative Cost");
    info("[create] what a negative purchase price does today (-5 typed)", rows[0] ? { saved: rows[0].purchase_price } : "no record");

    // photo upload: appears, saved with the item, and nothing paid ran
    await fillAndSave(S, { title: "QA Added With Photo", photo: true }); await S.shot(OUT + "/capture-with-photo.png"); await clickSave(S);
    rows = await waitRow("QA Added With Photo");
    const imgs = rows[0] && rows[0].images_json;
    check("[create] a chosen photo is saved with the item (cover set)", rows[0] && Array.isArray(imgs) && imgs.length >= 1 && !!rows[0].image_front_url, { n: imgs && imgs.length, cover: rows[0] && !!rows[0].image_front_url });
    check("[AI] adding items (typing, photo choice, save) made 0 requests to the AI endpoints", g.ai.length === 0, g.ai);

    // Quick Add and Add Item entry links exist and open
    await S.go("/vault"); await S.waitFor("document.querySelector('[data-add-item-actions]') || document.body.innerText.length > 500", 120000, "vault"); await sleep(1500);
    const links = await S.evaluate("[...document.querySelectorAll('a')].map((a) => a.getAttribute('href')).filter((h) => ['/vault/quick', '/capture', '/vault/bulk', '/capture?openUpload=1'].includes(h))");
    check("[entry] Quick Add (/vault/quick) and Add Item (/capture) links are on the Vault page", links.includes("/vault/quick") && links.includes("/capture"), links);
    await S.go("/vault/quick"); await sleep(4000);
    const q = await S.evaluate("({ url: location.pathname, text: document.body.innerText.slice(0, 400) })");
    check("[entry] Quick Add opens (no AI call on open)", q.url === "/vault/quick" && g.ai.length === 0, { q, ai: g.ai });
    await S.go("/vault/bulk"); await sleep(3000);
    const bk = await S.evaluate("({ url: location.pathname, files: document.querySelectorAll('input[type=file]').length })");
    check("[entry] Batch upload opens and has a file picker (no AI call on open)", bk.url === "/vault/bulk" && bk.files >= 1 && g.ai.length === 0, { bk, ai: g.ai });
  } finally { await S.close(); }

  // ================= edit: save then leave at once, offline, clean second browser =================
  const E = await session(BASE, { width: 1440, height: 900 });
  const ge = await guard(E);
  const target = "qa_ui_" + qa.stamp + "_8";
  const setTitle = async (t) => {
    await E.click('button[aria-label="Edit title and category"]'); await sleep(500);
    await setVal(E, 'input[aria-label="Title"]', t);
    await E.click('button[aria-label="Save title and classification"]');
  };
  try {
    await E.go("/vault/item/" + target); await E.waitFor("document.querySelector('button[aria-label=\"Edit title and category\"]')", 120000, "item page"); await sleep(1500);
    await setTitle("QA Filler 8 edited fast");
    await E.go("/vault"); // leave immediately
    let ok = false; for (let i = 0; i < 25 && !ok; i++) { await sleep(1500); ok = ((await admin.from("vault_items").select("title").eq("id", target).maybeSingle()).data || {}).title === "QA Filler 8 edited fast"; }
    check("[edit] save then leave the page at once: the new title still reaches the account", ok);

    // offline edit, then back online
    await E.go("/vault/item/" + target); await E.waitFor("document.querySelector('button[aria-label=\"Edit title and category\"]')", 120000, "item page 2"); await sleep(1500);
    await E.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await setTitle("QA Filler 8 edited offline"); await sleep(2500);
    const off = await E.evaluate("document.body.innerText");
    const stillOld = ((await admin.from("vault_items").select("title").eq("id", target).maybeSingle()).data || {}).title;
    check("[offline] while offline the account still has the previous title", stillOld === "QA Filler 8 edited fast", stillOld);
    check("[offline] the screen shows the edit and does not claim it is saved to the account", /edited offline/.test(off) && !/Saved to your account/i.test(off), off.slice(0, 300));
    await E.shot(OUT + "/offline-edit.png");
    await E.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await E.evaluate("window.dispatchEvent(new Event('online')); true");
    ok = false; for (let i = 0; i < 30 && !ok; i++) { await sleep(2000); ok = ((await admin.from("vault_items").select("title").eq("id", target).maybeSingle()).data || {}).title === "QA Filler 8 edited offline"; }
    check("[offline] back online: the edit reaches the account without a manual step", ok);
  } finally { await E.close(); }

  const C = await session(BASE, { width: 1440, height: 900 });
  try {
    await C.go("/vault/item/" + target); await C.waitFor("/edited offline|edited fast/.test(document.body.innerText)", 120000, "clean second browser").catch(() => {});
    const t = await C.evaluate("document.querySelector('h1')?.textContent || ''");
    check("[second browser] a clean browser (no local copy) shows the latest title from the account", /edited offline/.test(t), t);
  } finally { await C.close(); }

  // ================= delete: refused, then real =================
  const D = await session(BASE, { width: 1440, height: 900 });
  const gd = await guard(D);
  try {
    const victim = (await rowsByTitle("QA Added Positive Cost"))[0];
    await D.go("/vault/item/" + victim.id); await D.waitFor("document.querySelector('button[aria-label=\"Delete item\"]')", 120000, "item page for delete"); await sleep(1500);
    gd.failDelete = true;
    await D.click('button[aria-label="Delete item"]'); await sleep(800);
    await D.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Delete Forever')); b.click(); return true; })()"); await sleep(5000);
    const refused = await D.evaluate("(() => { const dl = document.querySelector('[role=dialog]'); return { url: location.pathname, dialog: dl ? dl.innerText : '', stillOffersDelete: !!(dl && dl.textContent.includes('Delete Forever')) }; })()");
    const stillThere = (await rowsByTitle("QA Added Positive Cost")).length;
    check("[delete] when the account refuses, the record is kept", stillThere === 1, stillThere);
    check("[delete] and the screen does not pretend it was deleted (dialog stays open, still on the item, the refusal message is shown in it)", refused.url.startsWith("/vault/item/") && refused.stillOffersDelete && /refused/.test(refused.dialog), refused);
    await D.shot(OUT + "/delete-refused.png");
    gd.failDelete = false;
    await D.go("/vault/item/" + victim.id); await D.waitFor("document.querySelector('button[aria-label=\"Delete item\"]')", 120000, "item page again"); await sleep(1200);
    await D.click('button[aria-label="Delete item"]'); await sleep(800);
    await D.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('Delete Forever')); b.click(); return true; })()");
    let gone = false; for (let i = 0; i < 20 && !gone; i++) { await sleep(1500); gone = (await rowsByTitle("QA Added Positive Cost")).length === 0; }
    check("[delete] a real delete removes the record from the account", gone);
    await sleep(8000);
    check("[delete] and it does not come back after the sync has had time to run", (await rowsByTitle("QA Added Positive Cost")).length === 0);
    await D.go("/vault"); await sleep(5000);
    const listText = await D.evaluate("document.body.innerText");
    check("[delete] and it is not in the Vault list after a reload", !/QA Added Positive Cost/.test(listText));
  } finally { await D.close(); }

  console.log("\n" + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });

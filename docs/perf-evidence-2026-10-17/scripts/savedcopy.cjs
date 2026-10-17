// Edits must never be lost: edit then immediately navigate / refresh / close / go offline / switch profile; final values from a clean second browser.
//   node editloss.cjs <label> [--base=http://localhost:3100]
const fs = require("fs"); const zlib = require("zlib");
const { launch } = require("./cdp.cjs");
const env = require("../qa/env.cjs");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const args = Object.fromEntries(process.argv.slice(3).map((a) => { const m = a.replace(/^--/, "").split("="); return [m[0], m[1] ?? true]; }));
const label = process.argv[2] || "savedcopy";
const BASE = args.base || "http://localhost:3100";
const qa = JSON.parse(fs.readFileSync(__dirname + "/qa_perf.json", "utf8"));
const qa2 = JSON.parse(fs.readFileSync(__dirname + "/qa_perf2.json", "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = []; let pass = 0, fail = 0;
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); if (ok) pass++; else fail++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(detail ?? "").slice(0, 400)); };
const unpack = (s) => (s ? JSON.parse(zlib.inflateSync(Buffer.from(String(s).replace(/^z64:/, ""), "base64")).toString()) : []);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stamp = Date.now().toString(36);

const SET = `
window.__setVal = (el, value) => {
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
};
localStorage.removeItem('vltd_pull_cursor_v1'); // every download is a full one, so it brings back every row
true;`;


// Cleanup order: stop every test session first (a page can still be sending a waiting edit, which would put a deleted row back), let
// anything in flight finish, delete, wait, and check that nothing came back.
async function closeAllSessions() { for (const s of global.__sessions || []) { try { await s.close(); } catch {} } global.__sessions = []; await sleep(6000); }
async function verifyGone(filters) { await sleep(8000); let again = 0; for (const f of filters) { const r = await f(admin.from("vault_items").select("id", { count: "exact", head: true })); again += r.count || 0; } console.log(again === 0 ? "cleanup check: no test rows came back" : "CLEANUP CHECK: " + again + " test rows came back"); return again; }
async function session(email, password, profileId) {
  const c = await launch(9700 + Math.floor(Math.random() * 250));
  const { send, evaluate } = c;
  await send("Page.enable"); await send("Network.enable"); await send("Runtime.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "*rest/v1/vault_items*", requestStage: "Request" }] });
  c.blockWrites = false;
  c.holdWrites = false; // the request leaves and never gets an answer: what leaving the page does to an upload in flight
  c.writes = 0;
  c.navCommits = 0;
  c.on((m) => { if (m.method === "Page.frameNavigated" && !m.params.frame.parentId) { c.navCommits++; c.holdWrites = false; /* the old page is gone: what it was holding is dropped, and the new page is never held */ } });
  c.on((m) => {
    if (m.method !== "Fetch.requestPaused") return;
    const r = m.params.request;
    if (r.method !== "GET" && r.method !== "OPTIONS" && r.method !== "HEAD") {
      if (c.holdWrites) { c.held = (c.held || 0) + 1; return; }
      if (c.blockWrites) { send("Fetch.failRequest", { requestId: m.params.requestId, errorReason: "InternetDisconnected" }).catch(() => {}); return; }
      c.writes++;
    }
    send("Fetch.continueRequest", { requestId: m.params.requestId }).catch(() => {});
  });
  await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 900, deviceScaleFactor: 1, mobile: false });
  if (args.cpu) await send("Emulation.setCPUThrottlingRate", { rate: Number(args.cpu) });
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  await send("Page.navigate", { url: BASE + "/robots.txt" }); await sleep(1200);
  await evaluate(`localStorage.setItem('vltd-auth', ${JSON.stringify(JSON.stringify(data.session))}); localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(profileId)}); true`);
  await send("Page.addScriptToEvaluateOnNewDocument", { source: SET });
  const s = {
    c, send, evaluate,
    go: async (path, wait = 4500) => { await send("Page.navigate", { url: BASE + path }); await sleep(wait * (args.filler ? 2 : 1) * (args.cpu ? 2 : 1)); await evaluate(SET); },
    store: async () => unpack(await evaluate(`localStorage.getItem('vltd_vault_items_v1')`)),
    queue: async () => JSON.parse((await evaluate(`localStorage.getItem('vltd_sync_queue_v1')`)) || "[]"),
    text: (sel) => evaluate(`document.querySelector(${JSON.stringify(sel)})?.innerText || ''`),
    pill: () => evaluate(`document.querySelector('[data-cloud-save-status]')?.innerText || ''`),
    // commit an in-place edit (Enter) and return at once: no waiting for the upload
    edit: async (labelText, value) => {
      const find = `(() => { const sp = [...document.querySelectorAll('[data-testid="item-details"] span[role="button"]')].find((x) => x.title === ${JSON.stringify("Click to edit " + labelText.toLowerCase())}); if (!sp) return 'missing'; sp.click(); return 'ok'; })()`;
      let r = await evaluate(find);
      if (r === "missing") { await evaluate(`[...document.querySelectorAll('[data-testid="item-details"] button')].find((b) => /^More details/.test(b.textContent.trim()))?.click(); true`); await sleep(300); r = await evaluate(find); }
      if (r !== "ok") return r;
      await sleep(250);
      await evaluate(`(() => { window.__setVal(document.activeElement, ${JSON.stringify(value)}); return 1; })()`);
      if (value === "yes" || value === "no" || (value === "" && /Papers|Box/.test(labelText))) return "ok"; // selects commit on change
      await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
      return "ok";
    },
    close: () => c.close(),
  };
  (global.__sessions = global.__sessions || []).push(s);
  return s;
}

async function committed(c, from, ms = 8000) { const end = Date.now() + ms; while (c.navCommits <= from && Date.now() < end) await sleep(50); c.holdWrites = false; }
const cloud = async (id) => (await admin.from("vault_items").select("id,profile_id,watch_brand,watch_papers,watch_reference,specs,title").eq("id", id).maybeSingle()).data;
async function waitCloud(id, pred, ms = 25000) { const end = Date.now() + ms; let row; while (Date.now() < end) { row = await cloud(id); if (row && pred(row)) return row; await sleep(1500); } return row; }

(async () => {
  // 1,500 filler items plus special items: a BLANK price, a price entered as 0, an explicit No (false) with specialist details, a plain one, and one for the interrupted save
  const fill = Array.from({ length: Number(args.filler || 1500) }, (_, i) => ({ id: `qa_fill_${stamp}_${i}`, profile_id: qa.profileId, title: `QA Filler ${i}`, universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", is_public: false, created_at: 1780000000000 + i * 1000, current_value: 10 + (i % 90), purchase_price: 5 + (i % 40), status: "COLLECTION" }));
  for (let i = 0; i < fill.length; i += 400) await admin.from("vault_items").insert(fill.slice(i, i + 400));
  const mk = (n, extra = {}) => ({ id: `qa_sc_${stamp}_${n}`, profile_id: qa.profileId, title: `QA Saved Copy ${n} ${stamp}`, universe: "JEWELRY_APPAREL", category: "WATCHES", category_label: "Watches", subcategory_label: "Automatic", watch_brand: "OldBrand" + n, watch_reference: "REF" + n, watch_papers: true, specs: { caliber: "OLD" + n }, is_public: false, created_at: Date.now(), current_value: 100, ...extra });
  const blank = mk(1, { purchase_price: null }), zero = mk(2, { purchase_price: 0 }), no = mk(3, { purchase_price: 40, watch_papers: false, specs: { caliber: "KEEPCAL", box: "No" } }), plain = mk(4, { purchase_price: 25 }), intr = mk(5, { purchase_price: 60 });
  const specials = [blank, zero, no, plain, intr];
  const ins = await admin.from("vault_items").insert(specials);
  if (ins.error) { console.log("seed failed", ins.error.message); process.exit(2); }
  const by = (list, id) => list.find((x) => x.id === id);
  const preserved = (list) => {
    const b = by(list, blank.id), z = by(list, zero.id), n = by(list, no.id);
    return { blank: !!b && b.purchasePrice === undefined, zero: !!z && z.purchasePrice === 0, falseKept: !!n && n.watchPapers === false, specs: !!n && !!n.specs && n.specs.caliber === "KEEPCAL" && n.specs.box === "No" };
  };
  const allOk = (p) => p.blank && p.zero && p.falseKept && p.specs;
  const rowOf = async (id) => (await admin.from("vault_items").select("id,purchase_price,watch_papers,specs,watch_brand,title").eq("id", id).maybeSingle()).data;
  try {
    const A = await session(qa.email, qa.password, qa.profileId);
    await A.go("/vault", 12000);
    let st = await A.store();
    check("[cold] 1,500+ items on the device", st.length >= 1500, st.length);
    let p = preserved(st);
    check("[cold] blank price stays blank, explicit 0 stays 0, explicit No stays No, specialist details kept", allOk(p), p);
    const mark1 = await A.evaluate(`localStorage.getItem('vltd_vault_items_repaired_v1') !== null`);
    await A.go("/vault", 6000);
    st = await A.store(); p = preserved(st);
    const mark2 = await A.evaluate(`localStorage.getItem('vltd_vault_items_repaired_v1') !== null`);
    check("[repeat] the same values after a reload that reads the marked copy", allOk(p), { p, mark1, mark2 });
    check("[repeat] the saved copy is marked as repaired", mark2 === true, { mark1, mark2 });
    const r1 = await rowOf(blank.id), r2 = await rowOf(zero.id), r3 = await rowOf(no.id);
    check("[cloud] the account still has blank = null, 0 = 0, No = false, details intact (loading rewrote nothing)", r1.purchase_price === null && Number(r2.purchase_price) === 0 && r3.watch_papers === false && r3.specs.caliber === "KEEPCAL" && r3.specs.box === "No", [r1.purchase_price, r2.purchase_price, r3.watch_papers, r3.specs]);

    // edit one item then leave at once; the other items' special values must survive
    await A.go(`/vault/item/${plain.id}`, 6000);
    A.c.holdWrites = true; const nav0 = A.c.navCommits;
    await A.edit("Brand", "EditedPlain");
    await A.send("Page.navigate", { url: BASE + "/vault" }); await committed(A.c, nav0); await sleep(12000);
    let row = await waitCloud(plain.id, (r) => r.watch_brand === "EditedPlain");
    st = await A.store(); p = preserved(st);
    check("[edit then leave at once] the edit reached the account", row?.watch_brand === "EditedPlain", row?.watch_brand);
    check("[edit then leave at once] the other items' blank / 0 / No / details are untouched on the device", allOk(p), p);
    const a1 = await rowOf(blank.id), a2 = await rowOf(zero.id), a3 = await rowOf(no.id);
    check("[edit then leave at once] ...and in the account", a1.purchase_price === null && Number(a2.purchase_price) === 0 && a3.watch_papers === false && a3.specs.caliber === "KEEPCAL", [a1.purchase_price, a2.purchase_price, a3.watch_papers]);

    // interrupted save: browser storage refuses the write of the repaired-mark while an edit is made, then a reload
    await A.go(`/vault/item/${intr.id}`, 6000);
    await A.evaluate(`(() => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'vltd_vault_items_repaired_v1') throw new Error('QuotaExceededError'); return orig.call(this, k, v); }; return 1; })()`);
    A.c.holdWrites = false;
    await A.edit("Brand", "InterruptedSave");
    await sleep(4000);
    await A.go("/vault", 8000);
    st = await A.store();
    check("[interrupted save] the edit is on the device after the mark could not be written", by(st, intr.id)?.watchBrand === "InterruptedSave", by(st, intr.id)?.watchBrand);
    row = await waitCloud(intr.id, (r) => r.watch_brand === "InterruptedSave");
    check("[interrupted save] ...and it reached the account", row?.watch_brand === "InterruptedSave", row?.watch_brand);
    p = preserved(st);
    check("[interrupted save] blank / 0 / No / details still intact", allOk(p), p);

    // another account in the same browser sees none of it
    await A.send("Page.navigate", { url: BASE + "/robots.txt" }); await sleep(600);
    const sb2 = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data: d2 } = await sb2.auth.signInWithPassword({ email: qa2.email2, password: qa2.password2 });
    await A.evaluate(`localStorage.setItem('vltd-auth', ${JSON.stringify(JSON.stringify(d2.session))}); localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(qa2.profileId2)}); true`);
    await A.go("/vault", 10000);
    const seen = await A.evaluate(`document.body.innerText.includes('QA Saved Copy') || document.body.innerText.includes('QA Filler')`);
    const otherStore = await A.store();
    check("[account switch] the other account sees none of the first account's items, on screen or on the device", !seen && !otherStore.some((x) => String(x.id).startsWith("qa_fill_") || String(x.id).startsWith("qa_sc_")), { seen, n: otherStore.length });
    await A.close();

    const B = await session(qa.email, qa.password, qa.profileId);
    check("[B] the second browser starts with no local data", (await B.store()).length === 0);
    await B.go("/vault", 14000);
    const bs = await B.store(); p = preserved(bs);
    check("[B] final values from a clean browser: blank, 0, No, details preserved", allOk(p), p);
    check("[B] the edit made before leaving and the edit made while the mark failed are both there", by(bs, plain.id)?.watchBrand === "EditedPlain" && by(bs, intr.id)?.watchBrand === "InterruptedSave", [by(bs, plain.id)?.watchBrand, by(bs, intr.id)?.watchBrand]);
    check("[B] all 1,500 filler items arrived", bs.filter((x) => String(x.id).startsWith("qa_fill_")).length === fill.length, bs.length);
    await B.close();
  } finally {
    await closeAllSessions();
    await admin.from("vault_items").delete().in("id", specials.map((i) => i.id));
    await admin.from("vault_items").delete().like("id", `qa_fill_${stamp}_%`);
    await verifyGone([(q) => q.in("id", specials.map((i) => i.id)), (q) => q.like("id", `qa_fill_${stamp}_%`)]);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  fs.writeFileSync(__dirname + `/savedcopy-${label}.json`, JSON.stringify({ results, pass, fail }, null, 1));
  process.exit(0);
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2); });

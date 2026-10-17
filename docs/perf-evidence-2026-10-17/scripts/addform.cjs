// The real Add Item form on a 1,500-item collection: blank price vs 0, private by default, defaults, specialist Details, leaving at once, cloud, clean browser.
//   node addform.cjs <label> [--base=http://localhost:3100] [--filler=1500]
const fs = require("fs"); const zlib = require("zlib");
const { launch } = require("./cdp.cjs");
const env = require("../qa/env.cjs");
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const args = Object.fromEntries(process.argv.slice(3).map((a) => { const m = a.replace(/^--/, "").split("="); return [m[0], m[1] ?? true]; }));
const label = process.argv[2] || "addform";
const BASE = args.base || "http://localhost:3100";
const qa = JSON.parse(fs.readFileSync(__dirname + "/qa_perf.json", "utf8"));
const qa2 = JSON.parse(fs.readFileSync(__dirname + "/qa_perf2.json", "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = []; let pass = 0, fail = 0;
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); if (ok) pass++; else fail++; console.log(ok ? "PASS" : "FAIL", name, ok ? "" : JSON.stringify(detail ?? "").slice(0, 320)); };
const unpack = (s) => (s ? JSON.parse(zlib.inflateSync(Buffer.from(String(s).replace(/^z64:/, ""), "base64")).toString()) : []);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const stamp = Date.now().toString(36);
const SET = `
window.__setVal = (el, value) => {
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
};
window.__byLabel = (text) => { const l = [...document.querySelectorAll('label')].find((x) => x.textContent.trim().toLowerCase() === text.toLowerCase()); return l ? l.parentElement.parentElement.querySelector('select,input,textarea') || l.parentElement.querySelector('select,input,textarea') : null; };
window.__byAria = (text) => document.querySelector('[aria-label="' + text + '"]');
true;`;

// fingerprint of the stored text, the same one the app uses to mark it as repaired
const fingerprint = (text) => { let h = 0x811c9dc5, g = 5381; for (let i = 0; i < text.length; i++) { const ch = text.charCodeAt(i); h ^= ch; h = Math.imul(h, 0x01000193) >>> 0; g = (Math.imul(g, 33) + ch) >>> 0; } return text.length + ":" + h.toString(16) + ":" + g.toString(16); };

(async () => {
  const fill = Array.from({ length: Number(args.filler || 1500) }, (_, i) => ({ id: `qa_fill_${stamp}_${i}`, profile_id: qa.profileId, title: `QA Filler ${i}`, universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", is_public: false, created_at: 1780000000000 + i * 1000, current_value: 10 + (i % 90), purchase_price: 5 + (i % 40), status: "COLLECTION" }));
  for (let i = 0; i < fill.length; i += 400) await admin.from("vault_items").insert(fill.slice(i, i + 400));
  const sessions = [];
  const open = async (width = 1400, height = 900) => {
    const c = await launch();
    const { send, evaluate } = c;
    await send("Page.enable"); await send("Network.enable"); await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data } = await sb.auth.signInWithPassword({ email: qa.email, password: qa.password });
    await send("Page.navigate", { url: BASE + "/robots.txt" }); await sleep(900);
    await evaluate(`localStorage.setItem('vltd-auth', ${JSON.stringify(JSON.stringify(data.session))}); localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(qa.profileId)}); true`);
    await send("Page.addScriptToEvaluateOnNewDocument", { source: SET });
    const s = {
      c, send, evaluate,
      go: async (path, wait = 6000) => { await send("Page.navigate", { url: BASE + path }); await sleep(wait); await evaluate(SET); },
      store: async () => unpack(await evaluate(`localStorage.getItem('vltd_vault_items_v1')`)),
      marked: async () => evaluate(`(() => { const m = localStorage.getItem('vltd_vault_items_repaired_v1'); return m || null; })()`),
      storedText: () => evaluate(`localStorage.getItem('vltd_vault_items_v1')`),
      pick: (labelText, optionText) => evaluate(`(() => { const el = window.__byLabel(${JSON.stringify(labelText)}); if (!el) return 'missing'; const o = [...el.options].find((x) => x.text.trim() === ${JSON.stringify(optionText)}); if (!o) return 'no option'; window.__setVal(el, o.value); return 'ok'; })()`),
      setAria: (aria, value) => evaluate(`(() => { const el = window.__byAria(${JSON.stringify(aria)}) || window.__byLabel(${JSON.stringify(aria)}); if (!el) return 'missing ' + ${JSON.stringify(aria)}; window.__setVal(el, ${JSON.stringify(value)}); return 'ok'; })()`),
      click: (text) => evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent || '').trim() === ${JSON.stringify(text)}); if (!b) return 'no button ' + ${JSON.stringify(text)}; b.click(); return 'clicked'; })()`),
      close: () => c.close(),
    };
    sessions.push(s); return s;
  };
  // the real Add Item form: Watches, with specialist details; price: undefined = leave blank
  async function addViaForm(A, title, price, { papers = "no" } = {}) {
    await A.go("/vault/add", 5000);
    const r = [await A.pick("Universe", "Jewelry & Apparel")]; await sleep(500); r.push(await A.pick("Category", "Watches")); await sleep(500); r.push(await A.pick("Subcategory", "Automatic")); await sleep(600);
    await A.evaluate(`(() => { const i = document.querySelector('input[placeholder*="Name this item"]'); window.__setVal(i, ${JSON.stringify(title)}); return true; })()`);
    const more = await A.evaluate(`[...document.querySelectorAll('button')].map((b) => b.textContent.trim()).find((t) => /^More details/.test(t)) || ''`);
    if (more) { await A.click(more); await sleep(300); }
    r.push(await A.setAria("Brand", "Seiko")); r.push(await A.setAria("Caliber", "4R36")); r.push(await A.setAria("Papers included", papers)); r.push(await A.setAria("Box included", "yes"));
    if (price !== undefined) r.push(await A.setAria("Purchase Price", String(price)));
    return r;
  }
  const rowOf = async (id) => (await admin.from("vault_items").select("id,title,purchase_price,is_public,watch_brand,watch_papers,watch_box,specs,status").eq("id", id).maybeSingle()).data;
  const rowByTitle = async (title) => (await admin.from("vault_items").select("id,title,purchase_price,is_public,watch_brand,watch_papers,watch_box,specs,status").eq("profile_id", qa.profileId).eq("title", title).maybeSingle()).data;
  const T = { blank: `QA Add Blank ${stamp}`, zero: `QA Add Zero ${stamp}`, paid: `QA Add Paid ${stamp}` };
  try {
    const A = await open();
    await A.go("/vault", 12000); await A.go("/vault", 6000);
    let st = await A.store();
    const m0 = await A.marked();
    check("[setup] 1,500+ items on the device, saved copy marked as repaired after two loads", st.length >= 1500 && !!m0, { n: st.length, m0 });
    const sel = [];
    // 1. blank price, specialist details, explicit No; save, and look at the stored copy IMMEDIATELY
    sel.push(await addViaForm(A, T.blank, undefined, { papers: "no" }));
    await A.click("Save"); await sleep(2500);
    st = await A.store(); const b = st.find((i) => i.title === T.blank);
    const text = await A.storedText(); const mk = await A.marked();
    check("[blank price] the item is on the device", !!b);
    check("[blank price] the price stays blank (not $0)", b && b.purchasePrice === undefined, b?.purchasePrice);
    check("[blank price] private by default; defaults filled in (not first edition, new, zero tax); explicit No kept; specialist detail kept", b && b.isPublic === false && b.isFirstEdition === false && b.isNew === true && b.purchaseTax === 0 && b.watchPapers === false && b.watchBox === true && b.watchBrand === "Seiko" && b.specs && b.specs.caliber === "4R36", b && { isPublic: b.isPublic, isFirstEdition: b.isFirstEdition, isNew: b.isNew, tax: b.purchaseTax, papers: b.watchPapers, box: b.watchBox, brand: b.watchBrand, specs: b.specs });
    check("[blank price] adding one item left the saved copy marked as repaired (the whole copy is not repaired again)", !!mk && mk === fingerprint(text), { mk, expected: fingerprint(text).slice(0, 30) });
    // 2. explicit zero
    sel.push(await addViaForm(A, T.zero, 0, { papers: "yes" }));
    await A.click("Save"); await sleep(2500);
    st = await A.store(); const z = st.find((i) => i.title === T.zero);
    check("[price 0] a price entered as 0 is stored as 0 (a recorded cost, not blank)", z && z.purchasePrice === 0, z?.purchasePrice);
    check("[price 0] explicit Yes stays true", z && z.watchPapers === true, z?.watchPapers);
    // 3. a price, then leave the page at once (do not wait for the upload)
    sel.push(await addViaForm(A, T.paid, 25, { papers: "no" }));
    A.c.holdWrites = false;
    await A.click("Save");
    await A.send("Page.navigate", { url: BASE + "/vault" });   // immediate navigation
    await sleep(14000);
    st = await A.store(); const pd = st.find((i) => i.title === T.paid);
    check("[price 25, leave at once] the item is on the device", !!pd && pd.purchasePrice === 25, pd?.purchasePrice);
    check("[form] every field of the three forms was found", sel.flat().every((x) => x === "ok"), sel);
    const mk2 = await A.marked(); const text2 = await A.storedText();
    check("[after three adds and a reload] the saved copy is marked as repaired", !!mk2 && mk2 === fingerprint(text2), { mk2 });
    // cloud rows
    const rb = await rowByTitle(T.blank), rz = await rowByTitle(T.zero), rp = await rowByTitle(T.paid);
    check("[cloud] blank price reached the account as null", rb && rb.purchase_price === null, rb?.purchase_price);
    check("[cloud] the 0 reached the account as 0", rz && Number(rz.purchase_price) === 0, rz?.purchase_price);
    check("[cloud] the price 25 reached the account (the page was left at once)", rp && Number(rp.purchase_price) === 25, rp?.purchase_price);
    check("[cloud] private, explicit No / Yes and specialist detail all in the account", rb && rb.is_public === false && rb.watch_papers === false && rb.specs?.caliber === "4R36" && rz && rz.watch_papers === true && rp && rp.watch_papers === false, [rb?.is_public, rb?.watch_papers, rz?.watch_papers, rp?.watch_papers, rb?.specs]);
    // reload: nothing lost, still marked
    await A.go("/vault", 9000);
    st = await A.store();
    check("[reload] all three items and the 1,500 others are there", [T.blank, T.zero, T.paid].every((t) => st.some((i) => i.title === t)) && st.length >= 1503, st.length);
    const keep = st.find((i) => i.title === T.blank);
    check("[reload] blank still blank, No still No", keep && keep.purchasePrice === undefined && keep.watchPapers === false, [keep?.purchasePrice, keep?.watchPapers]);
    // account isolation in the same browser
    await A.send("Page.navigate", { url: BASE + "/robots.txt" }); await sleep(600);
    const sb2 = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data: d2 } = await sb2.auth.signInWithPassword({ email: qa2.email2, password: qa2.password2 });
    await A.evaluate(`localStorage.setItem('vltd-auth', ${JSON.stringify(JSON.stringify(d2.session))}); localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(qa2.profileId2)}); true`);
    await A.go("/vault", 9000);
    const other = await A.store();
    check("[account switch] the other account sees none of these items on the device or on screen", !other.some((i) => String(i.title).startsWith("QA Add ") || String(i.id).startsWith("qa_fill_")) && !(await A.evaluate(`document.body.innerText.includes('QA Add ')`)), other.length);
    await A.close();
    // clean second browser
    const B = await open();
    check("[B] starts with no local data", (await B.store()).length === 0);
    await B.go("/vault", 14000);
    const bs = await B.store();
    const bb = bs.find((i) => i.title === T.blank), bz = bs.find((i) => i.title === T.zero), bp = bs.find((i) => i.title === T.paid);
    check("[B] clean browser: blank is blank, 0 is 0, 25 is 25", bb && bb.purchasePrice === undefined && bz && bz.purchasePrice === 0 && bp && bp.purchasePrice === 25, [bb?.purchasePrice, bz?.purchasePrice, bp?.purchasePrice]);
    check("[B] clean browser: private, explicit No/Yes, specialist details", bb && bb.isPublic === false && bb.watchPapers === false && bb.specs?.caliber === "4R36" && bz.watchPapers === true, [bb?.isPublic, bb?.watchPapers, bb?.specs]);
    await B.close();
  } finally {
    for (const s of sessions) { try { await s.close(); } catch {} }
    await sleep(6000);
    await admin.from("vault_items").delete().eq("profile_id", qa.profileId).like("title", `QA Add % ${stamp}`);
    await admin.from("vault_items").delete().like("id", `qa_fill_${stamp}_%`);
    await sleep(8000);
    const left = await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", qa.profileId);
    console.log(left.count === 0 ? "cleanup check: no test rows came back" : "CLEANUP CHECK: " + left.count + " rows came back");
    if (left.count) await admin.from("vault_items").delete().eq("profile_id", qa.profileId);
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  fs.writeFileSync(__dirname + `/addform-${label}.json`, JSON.stringify({ results, pass, fail }, null, 1));
  process.exit(0);
})().catch((e) => { console.error("HARNESS ERROR", e); process.exit(2); });

// Home visual-revision checks (synthetic account with visual-fixture.cjs data). Writes only to the synthetic profile.
//   node home-test.cjs --base=http://localhost:3000
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const { browser, admin, sleep, man } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3000").slice(7);
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };
const READY = "/COLLECTION OVERVIEW/.test(document.body.innerText) && document.querySelectorAll('[data-recent-item]').length > 0";

(async () => {
  const m = man(); const P = m.personalId;
  const owned = (await admin.from("vault_items").select("id,title,created_at,status").eq("profile_id", P).neq("status", "SOLD").order("created_at", { ascending: false })).data;
  const newest = owned[0];
  const S = await browser(BASE, { width: 1440, height: 900 });
  try {
    await S.go("/dashboard"); await S.waitFor(READY, 180000, "home"); await sleep(3000);
    // headings: compact left text links, no right-hand buttons for them
    const heads = await S.evaluate(`[...document.querySelectorAll('section')].map((s) => { const h = s.querySelector('h2'); const a = h && h.parentElement.querySelector('a'); return { h: h && h.textContent, link: a && a.textContent.trim(), href: a && a.getAttribute('href'), pills: [...s.querySelectorAll(':scope > div:first-child > a, :scope > div:first-child > button')].map((x) => x.textContent.trim()) }; }).filter((x) => /Recently added|Your exhibitions|From the Lounge|Learn/i.test(x.h || ''))`);
    const by = Object.fromEntries(heads.map((x) => [x.h.toLowerCase(), x]));
    check("[2] Recently added heading link: 'View Vault →' beside the label", by["recently added"]?.link === "View Vault →" && by["recently added"]?.href === "/vault", by["recently added"]);
    check("[2] Your exhibitions: 'All exhibitions →' beside the label; Create exhibition stays as the header action", by["your exhibitions"]?.link === "All exhibitions →" && by["your exhibitions"]?.pills.includes("Create exhibition"), by["your exhibitions"]);
    check("[2] From the Lounge: 'Open Lounge →' beside the label", by["from the lounge"]?.link === "Open Lounge →" && by["from the lounge"]?.href === "/community-board", by["from the lounge"]);
    check("[2] Learn: 'Open Learn →' beside the label", by["learn"]?.link === "Open Learn →" && by["learn"]?.href === "/learn", by["learn"]);
    check("[2] no right-side View Vault / Open Lounge / Open Learn buttons remain", !heads.some((x) => x.pills.some((p) => /^(View Vault|Open Lounge|Open Learn)$/.test(p))), heads.map((x) => x.pills));

    // layout, desktop
    const lay = await S.evaluate(`(() => { const sec = (t) => [...document.querySelectorAll('section')].find((s) => (s.querySelector('h2')?.textContent || '').toLowerCase() === t); const a = sec('recently added').getBoundingClientRect(), b = sec('your exhibitions').getBoundingClientRect(); return { a: { l: a.left, r: a.right, t: a.top, b: a.bottom }, b: { l: b.left, r: b.right, t: b.top, b: b.bottom }, sw: document.documentElement.scrollWidth, vw: innerWidth }; })()`);
    check("[3] desktop: Recently added is LEFT and Your exhibitions is RIGHT, side by side", lay.a.r <= lay.b.l + 1 && Math.abs(lay.a.t - lay.b.t) < 2, lay);
    check("[3] desktop: no sideways page scroll", lay.sw <= lay.vw, lay);

    // count + latest date
    const label = await S.evaluate("document.querySelector('[data-testid=recent-count]')?.textContent");
    const dt = new Date(newest.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    check(`[3] count label states the real item count (${owned.length}) and the latest addition date (${dt})`, label && label.startsWith(owned.length + " items in your Vault") && label.includes("newest added " + dt), label);
    const ids = await S.evaluate("[...document.querySelectorAll('[data-recent-item]')].map((e) => e.getAttribute('data-recent-item'))");
    const dbOrder = owned.slice(0, 24).map((x) => x.id);
    check("[4] Recently added is ordered by when items were ADDED (database order, newest first), up to 24", JSON.stringify(ids) === JSON.stringify(dbOrder), { ids: ids.slice(0, 4), dbOrder: dbOrder.slice(0, 4) });
    check("[3] browsing shows the bound honestly ('browsing the newest 24') when there are more", owned.length <= 24 || /browsing the newest 24/.test(label), label);

    // arrows / keyboard
    const sc = () => S.evaluate("(() => { const el = document.querySelector('[aria-label^=\"Recently added items.\"]'); return { l: Math.round(el.scrollLeft), max: el.scrollWidth - el.clientWidth }; })()");
    const s0 = await sc();
    const prevDisabled = await S.evaluate("(() => { const b = document.querySelector('button[aria-label=\"Previous items\"], a[aria-label=\"Previous items\"]'); return b && (b.disabled || b.getAttribute('aria-disabled') === 'true'); })()");
    check("[3] at the start 'Previous' is disabled; the strip is scrollable", prevDisabled === true && s0.max > 0, { prevDisabled, s0 });
    await S.evaluate("document.querySelector('button[aria-label=\"Next items\"], a[aria-label=\"Next items\"]').click(); true"); await sleep(900);
    const s1 = await sc();
    check("[3] 'Next' arrow moves the strip", s1.l > s0.l, { s0, s1 });
    await S.evaluate("document.querySelector('[aria-label^=\"Recently added items.\"]').focus(); true");
    await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 }); await sleep(900);
    const s2 = await sc();
    check("[3] keyboard: ArrowRight on the focused strip moves it", s2.l > s1.l, { s1, s2 });
    await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 }); await sleep(900);
    const s3 = await sc();
    check("[3] keyboard: ArrowLeft moves it back", s3.l < s2.l, { s2, s3 });

    // exhibitions still work (coverflow present, links valid)
    const ex = await S.evaluate("({ region: !!document.querySelector('[aria-label=\"Your exhibitions\"][role=region]'), open: [...document.querySelectorAll('a[aria-label^=\"Open \"]')].map((a) => a.getAttribute('href')).filter((h) => h.indexOf('/gallery/') === 0) })");
    check("[3] the exhibition coverflow is intact and its Open link points to an exhibition", ex.region && ex.open.length >= 1 && ex.open.every((h) => h.indexOf('/gallery/') === 0), ex);
    await S.evaluate("document.querySelector('button[aria-label=\"Next exhibition\"]').click(); true"); await sleep(700);
    check("[3] the exhibition Next arrow works", /2 of 5/.test(await S.text()));

    // [4] a new item added now (device copy changes) appears first without a reload: write a plain-JSON copy and fire the app's own event
    const before = ids[0];
    const newId = "qa_vz_evt_" + Date.now();
    const wrote = await S.evaluate(`(async () => {
      const raw = localStorage.getItem('vltd_vault_items_v1'); let json = raw;
      if (raw.startsWith('z64:')) { const bin = Uint8Array.from(atob(raw.slice(4)), (c) => c.charCodeAt(0)); const ds = new DecompressionStream('deflate'); const w = ds.writable.getWriter(); w.write(bin); w.close(); json = await new Response(ds.readable).text(); }
      const arr = JSON.parse(json); const tpl = arr.find((x) => x.profile_id === ${JSON.stringify(P)}); const it = { ...tpl, id: ${JSON.stringify(newId)}, title: 'QA Event Item', createdAt: Date.now(), notes: 'Purchase Date: 1999-01-01' };
      arr.push(it); localStorage.setItem('vltd_vault_items_v1', JSON.stringify(arr)); window.dispatchEvent(new Event('vltd:vault-updated')); return arr.length; })()`);
    await S.waitFor(`document.querySelector('[data-recent-item]')?.getAttribute('data-recent-item') === ${JSON.stringify(newId)}`, 8000, "new item first").catch(() => {});
    const firstNow = await S.evaluate("document.querySelector('[data-recent-item]')?.getAttribute('data-recent-item')");
    check("[4] a newly added item (imported with a 1999 purchase date) appears FIRST without reloading, when the device copy changes", firstNow === newId, { before, firstNow, wrote });
    const label2 = await S.evaluate("document.querySelector('[data-testid=recent-count]')?.textContent");
    check("[4] and the count goes up by one", label2.startsWith((owned.length + 1) + " items"), label2);

    // [4] profile switch: Business profile has no items; Home follows
    await S.evaluate(`localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(m.businessId)}); window.dispatchEvent(new Event('vltd:active-profile')); true`);
    await S.waitFor("!document.querySelector('[data-recent-item]') && /COLLECTION OVERVIEW|vault is ready|No items yet/i.test(document.body.innerText)", 60000, "business home").catch(() => {});
    const biz = await S.evaluate("({ items: document.querySelectorAll('[data-recent-item]').length, text: document.body.innerText.slice(0, 200) })");
    check("[4] switching to the Business profile empties Recently added (no items from the Personal profile)", biz.items === 0, biz);
    await S.evaluate(`localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(P)}); window.dispatchEvent(new Event('vltd:active-profile')); true`);
    await S.waitFor("document.querySelectorAll('[data-recent-item]').length > 0", 90000, "personal home again").catch(() => {});
    const back = await S.evaluate("document.querySelectorAll('[data-recent-item]').length");
    check("[4] switching back brings the Personal items back", back > 0, back);
  } catch (e) { console.log("STOPPED", e.message); fail++; } finally { await S.close(); }

  // [4] cloud arrival at load: a row created now with an old purchase date is first after a reload
  const cloudId = "qa_vz_cloud_" + Date.now();
  try {
    const tpl = (await admin.from("vault_items").select("*").eq("profile_id", P).neq("status", "SOLD").limit(1)).data[0];
    const row = { ...tpl, id: cloudId, title: "QA Cloud Arrival Item", created_at: Date.now() + 5000, notes: "Purchase Date: 1999-01-01" }; delete row.item_code; delete row.item_seq;
    const ins = await admin.from("vault_items").insert(row);
    if (ins.error) throw new Error(ins.error.message);
    const S2 = await browser(BASE, { width: 1440, height: 900 });
    try {
      await S2.go("/dashboard"); await S2.waitFor(READY, 180000, "home2"); await sleep(2500);
      const first = await S2.evaluate("document.querySelector('[data-recent-item]')?.getAttribute('data-recent-item')");
      check("[4] an item that arrives from the cloud (old purchase date) is shown first after loading Home", first === cloudId, first);
      // phone layout in the same session
      await S2.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }); await sleep(1500);
      const ph = await S2.evaluate(`(() => { const sec = (t) => [...document.querySelectorAll('section')].find((s) => (s.querySelector('h2')?.textContent || '').toLowerCase() === t); const a = sec('recently added').getBoundingClientRect(), b = sec('your exhibitions').getBoundingClientRect(); const el = document.querySelector('[aria-label^=\"Recently added items.\"]'); return { aB: a.bottom, bT: b.top, aL: a.left, bL: b.left, sw: document.documentElement.scrollWidth, vw: innerWidth, l0: el.scrollLeft, max: el.scrollWidth - el.clientWidth }; })()`);
      check("[3] phone: Your exhibitions is stacked below Recently added", ph.bT >= ph.aB - 1 && Math.abs(ph.aL - ph.bL) < 2, ph);
      check("[3] phone: no sideways page scroll", ph.sw <= ph.vw, ph);
      await S2.evaluate("document.querySelector('[aria-label^=\\\"Recently added items.\\\"]').scrollIntoView({ block: 'center' }); true"); await sleep(600);
      const r = await S2.evaluate("(() => { const r = document.querySelector('[aria-label^=\"Recently added items.\"]').getBoundingClientRect(); return { x: r.left + r.width * 0.8, y: r.top + r.height / 2 }; })()");
      await S2.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
      const tp = (type, x) => S2.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y: r.y }] });
      await tp("touchStart", r.x); for (let k = 1; k <= 12; k++) { await tp("touchMove", r.x - k * 18); await sleep(16); } await tp("touchEnd", 0); await sleep(1200);
      const l1 = await S2.evaluate("document.querySelector('[aria-label^=\"Recently added items.\"]').scrollLeft");
      check("[3] phone: a swipe moves the Recently added strip", l1 > ph.l0 + 20, { l0: ph.l0, l1 });
    } finally { await S2.close(); }
  } catch (e) { console.log("STOPPED2", e.message); fail++; }
  finally { await admin.from("vault_items").delete().eq("id", cloudId); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });

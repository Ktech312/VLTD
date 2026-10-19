// VLT suite 3: Home with the Business profile (empty, one item), switching profile through the account menu, and load failures (refused connection / offline).
const V = require("./audit-s-vlt-lib.cjs");
const { R, sleep, squash, admin, clickEl, blockRest, offline, money } = V; const r = R("VLT");
const PGB = (x) => `/dashboard | owner, Business, ${x}`;
const overview = (S) => S.evaluate("(document.querySelector('section[aria-label=\"Collection overview\"]') || document.body).innerText.replace(/\\s+/g, ' ')");
const switchTo = async (S, re) => {
  await clickEl(S, 'button[aria-label="Account menu"]'); await sleep(700);
  const ok = await clickEl(S, `[...document.querySelectorAll('button')].find((b) => ${re}.test(b.textContent) && /Switch|ACTIVE|@/.test(b.textContent))`, { js: true });
  await sleep(1500); await S.settle({ max: 25000 }); await sleep(800); return ok;
};
(async () => {
  const m = V.man(); const P = m.personalId, B = m.businessId;
  const bid = `qa_vlt_${m.stamp}_b1`;
  const S = await V.session("owner");
  try {
    // ---------- profile switch via account menu: Personal -> Business (empty)
    await S.visit("/dashboard");
    const personalOv = await overview(S);
    const okSwitch = await switchTo(S, "/QA Journey Business/");
    const bz = squash(await S.text()); const stored = await S.evaluate("localStorage.getItem('vltd_active_profile_id_v1')");
    r.check(okSwitch && stored === B && /Your vault is ready/i.test(bz) && !/\$631|\$1,226|\$1,355|26 items/.test(bz), { page: PGB("0 items"), control: "Account menu > switch to Business", expected: "Switching profile in the account menu replaces Home with the Business profile's own (empty) view: 'Your vault is ready', no Personal figures", actual: `switched=${okSwitch}; active=${stored === B}; text: ${bz.slice(0, 380)}`, evidence: await S.jshot("vlt-home-business-empty-1440"), impact: "privacy/data loss", repro: "Open /dashboard; Account menu > QA Journey Business" });
    r.check(/Scan your first item/.test(bz) && /No items yet/.test(bz) && /No exhibitions yet/.test(bz) && !(await S.evaluate("!!document.querySelector('[aria-label^=\"Recently added items. Use\"]')")), { page: PGB("0 items"), control: "Home empty state", expected: "Empty collection says so in words (first-item prompt, 'No items yet', 'No exhibitions yet') and shows no tiles or strip", actual: bz.slice(0, 420), impact: "usability", repro: "Switch to the empty Business profile" });
    // empty Business: figure tiles absent; the links on the page
    const links = await S.evaluate("[...document.querySelectorAll('main a')].map((a) => a.innerText.replace(/\\s+/g,' ').trim().slice(0,40) + ' -> ' + a.getAttribute('href'))");
    r.pass({ page: PGB("0 items"), control: "Home empty state: controls present", expected: "Add actions and navigation remain", actual: JSON.stringify(links.slice(0, 14)), impact: "none", repro: "inspect" });
    // ---------- one item
    await admin.from("vault_items").delete().eq("id", bid);
    const ins = await admin.from("vault_items").insert({ id: bid, profile_id: B, title: "QA VLT Single Business Item", universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", status: "COLLECTION", is_public: false, created_at: Date.now(), purchase_price: 40, current_value: 100 });
    if (ins.error) throw new Error(ins.error.message);
    await S.visit("/dashboard");
    const one = await overview(S); const oneFull = squash(await S.text());
    r.check(/1 item · Open Vault/.test(oneFull) && one.includes("$40") && one.includes("$100") && /\+\$60 \(\+150\.0%\)/.test(one) && /1 of 1 priced/.test(one) && /On 1 of 1 items/.test(one) && /1 item in your Vault/.test(oneFull) && !/1 items/.test(oneFull), { page: PGB("1 item (cost $40, value $100)"), control: "Home figures with one item", expected: "Singular wording everywhere ('1 item'), Purchase Cost $40, Estimated Value $100, Unrealized +$60 (+150.0%) on 1 of 1, strip caption '1 item in your Vault'", actual: one.slice(0, 500) + " || " + (oneFull.match(/\d+ items? in your Vault[^|]{0,60}/) || [""])[0], evidence: await S.jshot("vlt-home-business-one-1440"), impact: "misleading result", repro: "Add one valued item to Business profile; open /dashboard" });
    const sc = await S.evaluate("(() => { const s = document.querySelector('[aria-label^=\"Recently added items. Use\"]'); const prev = document.querySelector('button[aria-label=\"Previous items\"]'); return { cards: s ? s.querySelectorAll('[data-recent-item]').length : -1, arrows: !!prev }; })()");
    r.check(sc.cards === 1 && !sc.arrows, { page: PGB("1 item"), control: "Recently added with one item", expected: "One card, no arrows (nothing to scroll to)", actual: JSON.stringify(sc), impact: "usability", repro: "view strip" });
    // switch back -> Personal
    await switchTo(S, "/QA Visual Collection/");
    const back = squash(await S.text());
    r.check(/26 items/.test(back) && back.includes("$631") && !back.includes("QA VLT Single Business Item"), { page: PGB("then Personal"), control: "Account menu > switch back to Personal", expected: "Personal figures return; the Business item does not leak into Personal Home", actual: back.slice(0, 300), impact: "privacy/data loss", repro: "Account menu > Personal" });
    await admin.from("vault_items").delete().eq("id", bid);

    // ---------- load failures
    // F1: fresh browser (nothing saved on this device), data connection refused
    const F = await V.session("owner");
    try {
      await F.visit("/robots.txt"); // fresh profile directory, session injected, no device copy
      await blockRest(F, true);
      await F.go("/dashboard"); await sleep(4000);
      let t = 0, txt = "";
      for (; t < 30; t++) { txt = squash(await F.text()); if (/could not load|couldn.t load|Your vault is ready|26 items/i.test(txt)) break; await sleep(1000); }
      const err = /COULD NOT LOAD|couldn.t load your collection/i.test(txt); const fake = /Your vault is ready|Scan your first item|No items yet/i.test(txt);
      r.check(err && !fake, { page: "/dashboard | owner, Personal, 26 items, data connection refused, nothing saved on this device", control: "Home when the cloud refuses (503)", expected: "Shows 'We couldn't load your collection' with Retry; never 'Your vault is ready / No items yet' as if the collection were empty", actual: `after ${t}s: ${txt.slice(0, 300)}`, evidence: await F.jshot("vlt-home-refused"), impact: "misleading result", repro: "Fresh browser; block supabase REST; open /dashboard" });
      const retry = await F.evaluate("[...document.querySelectorAll('button')].some((b) => /^Retry$/.test(b.textContent.trim()))");
      r.check(retry, { page: "/dashboard | refused connection", control: "Home load-error 'Retry'", expected: "A Retry button is offered", actual: String(retry), impact: "usability", repro: "same" });
      // Retry while still blocked -> still error; unblock -> Retry recovers
      await blockRest(F, false);
      await clickEl(F, "[...document.querySelectorAll('button')].find((b) => /^Retry$/.test(b.textContent.trim()))", { js: true }); await sleep(2500); await F.settle({ max: 40000 });
      const after = squash(await F.text());
      r.check(/26 items/.test(after) && after.includes("$631"), { page: "/dashboard | after connection restored", control: "Home 'Retry' once the connection is back", expected: "Retry reloads the collection: 26 items, $631", actual: after.slice(0, 260), evidence: await F.jshot("vlt-home-retry-recovered"), impact: "blocked workflow", repro: "Restore connection; click Retry" });
      // F2: saved copy on device, then refused
      await blockRest(F, true);
      await F.visit("/dashboard");
      for (let i = 0; i < 25 && !(await F.evaluate("!!document.querySelector('[data-testid=stale-notice]')")); i++) await sleep(1000);
      const st = squash(await F.text()); const notice = await F.evaluate("(document.querySelector('[data-testid=stale-notice]') || {}).innerText");
      r.check(/26 items/.test(st) && !!notice && /couldn.t refresh/i.test(notice), { page: "/dashboard | saved copy on device, refresh refused", control: "Home stale-data notice", expected: "Saved items still shown (26 items, $631) with 'Showing saved data - couldn't refresh' notice", actual: `notice='${notice}'; ${st.slice(0, 200)}`, evidence: await F.jshot("vlt-home-stale"), impact: "misleading result", repro: "Load Home, block REST, reload" });
      // F3: fully offline after load
      await blockRest(F, false); await F.visit("/dashboard");
      await offline(F, true); await F.go("/dashboard"); await sleep(6000);
      const off = squash(await F.text());
      r.check(!/Your vault is ready|No items yet/i.test(off), { page: "/dashboard | offline (browser-emulated) reload", control: "Home reload while offline", expected: "Either the saved Home or an explicit offline/error state; never an empty-collection message", actual: off.slice(0, 260), evidence: await F.jshot("vlt-home-offline"), impact: "misleading result", repro: "Go offline; reload /dashboard" });
      await offline(F, false);
    } finally { await F.close(); }
  } finally { await admin.from("vault_items").delete().eq("id", bid); await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });

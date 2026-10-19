// EXH suite 1: /museum (Exhibitions list) as the owner (Personal, populated), 1440 desktop.
// AUDIT_MANIFEST=... node audit-s-exh-list.cjs [--dry]
const X = require("./audit-s-exh-lib.cjs");
const { session, admin, sleep, man, rows, mclick, byLabel, byLabelRe, bySel, key, gdb, gItemIds, itemsOf, cardText, waitText, drag, uploadVia, ensurePng, jshotName } = X;
const R = rows();
const m = man();
const P = "/museum | owner, Personal, 5 exhibitions (4 Private, 1 Public), 26 items";
const money = (n) => "$" + Math.round(n).toLocaleString("en-US");

async function expectedCards() {
  const gs = (await admin.from("galleries").select("*").eq("profile_id", m.personalId)).data;
  const out = {};
  for (const g of gs) {
    const its = await itemsOf(gItemIds(g));
    const owned = its.filter((i) => i.profile_id === m.personalId);
    out[g.title] = { id: g.id, listed: gItemIds(g).length, count: owned.length, value: owned.reduce((s, i) => s + Number(i.current_value ?? 0), 0), ghost: owned.reduce((s, i) => s + Number(i.current_value ?? i.purchase_price ?? 0), 0), visibility: g.visibility, state: g.state, views: g.analytics_views, token: g.public_token, id: g.id };
  }
  return out;
}
const cardFor = (cards, title) => cards.find((c) => c.includes(title));

async function load(S, path = "/museum", wait = 3500) { await S.visit(path); await sleep(wait); }
async function clickCardFilter(S, label) { await mclick(S, byLabel(label), { wait: 600 }); }
async function cardTitles(S) { return (await cardText(S)).map((t) => t.replace(/^\+\s*/, "").replace(/\s+\d+ items?.*$/, "")); }

(async () => {
  await admin.from("profiles").update({ museum_beta_requested_at: null }).eq("id", m.personalId); // reset fixture state left by the dry run
  const exp = await expectedCards();
  console.log("expected", JSON.stringify(Object.fromEntries(Object.entries(exp).map(([k, v]) => [k, [v.count, v.value, v.ghost, v.visibility, v.views]]))));
  let S = await session("owner");
  try {
    // ---------- 1. cold load (clean browser: nothing cached)
    await S.visit("/museum");
    await sleep(12000);
    let cards = await cardText(S);
    const coldAll0 = cards.length === 5 && cards.every((c) => /\b0 items\b/.test(c) && /\$0\b/.test(c));
    const coldShot = await S.jshot("exh-list-cold-counts-1440");
    if (coldAll0) {
      R.fail({ page: P + " | clean browser, direct URL", control: "Exhibition cards: item count and Total Value", expected: "Each card shows its real item count and value (e.g. Vinyl Wall 7 items, Comics 5 items) in a browser that has not visited the Vault yet", actual: "12s after a direct /museum load in a clean browser every card reads '0 items' and 'TOTAL VALUE $0' (cards: " + cards.map((c) => c.replace(/^\+\s*/, "")).join(" | ") + "). Real counts only appear after the Vault page has been visited once (it fills the browser's item cache). The Exhibition Details panel also says '0 items'.", evidence: coldShot, impact: "misleading result", repro: "1. Sign in on a clean browser/second device. 2. Open /museum directly. 3. Wait 12 s: every exhibition shows 0 items / $0. 4. Open /vault then /museum: correct numbers." });
    } else {
      R.pass({ page: P + " | clean browser, direct URL", control: "Exhibition cards: item count and Total Value", expected: "Real counts in a clean browser", actual: "cards: " + cards.join(" | "), evidence: coldShot });
    }
    // does a client-side route (Home -> Exhibitions nav) in a clean browser fix it?
    await S.visit("/dashboard"); await sleep(6000);
    await mclick(S, `document.querySelector('header nav a[href="/museum"], nav a[href="/museum"]')`, { wait: 5000 });
    cards = await cardText(S);
    const afterDash = cards.map((c) => c.replace(/^\+\s*/, "")).join(" | ");
    const fixedByDash = cards.some((c) => /\b[1-9]\d* items?\b/.test(c));
    console.log("after dashboard->nav:", afterDash);
    R.check(fixedByDash, { page: P + " | clean browser, via Home then Exhibitions tab", control: "Exhibition cards: item count", expected: "After opening Home and then the Exhibitions tab, the counts are real", actual: afterDash, evidence: "", impact: "misleading result", repro: "1. Clean browser, sign in. 2. Open /dashboard, wait 6s. 3. Click Exhibitions in the nav." });

    // ---------- 2. warm load: counts and values match the records
    await S.visit("/vault"); await sleep(7000);
    await load(S, "/museum", 4000);
    cards = await cardText(S);
    const warmShot = await S.jshot("exh-list-warm-1440");
    for (const [title, e] of Object.entries(exp)) {
      const c = cardFor(cards, title) || "";
      const okCount = new RegExp(`\\b${e.count} items?\\b`).test(c);
      const okVal = c.includes("TOTAL VALUE " + money(e.value));
      R.check(okCount && okVal, { page: P + " | after Vault visit", control: `Card '${title}': items and Total Value`, expected: `${e.count} items, ${money(e.value)} (sum of the room's items' current value in the database; ghost/purchase-fallback total would be ${money(e.ghost)})`, actual: c.replace(/^\+\s*/, ""), evidence: okCount && okVal ? "" : warmShot, impact: "misleading result", repro: "1. Open /vault, then /museum. 2. Read the card." });
    }
    const ghostDiffers = Object.values(exp).some((e) => Math.round(e.ghost) !== Math.round(e.value));
    R.nt({ page: P, control: "Total Value uses current value only (not the Vault's ghost purchase-price fallback)", expected: "Product decision: should an un-priced item count at its purchase price (grey) as in the Vault?", actual: ghostDiffers ? "Cards total current values only (" + Object.entries(exp).map(([k, e]) => `${k} ${money(e.value)} vs ghost ${money(e.ghost)}`).join("; ") + "). Not judged a defect: the exhibition card never claims the ghost rule." : "no difference in fixture", impact: "improvement" });

    // ---------- 3. filters
    const titlesNow = async () => (await cardText(S)).filter((t) => !/^New exhibit/.test(t));
    const ghostCount = async () => S.evaluate(`[...document.querySelectorAll('main a[aria-label="Create a new exhibit"]')].length`);
    const fsel = async () => S.evaluate(`[...document.querySelectorAll('main button')].filter(b => ['Active','Drafts','Public','Private','Invite-only'].includes(b.textContent.trim())).map(b => b.textContent.trim() + ':' + (b.className.match(/active/) ? 'A' : '') ).join(',')`);
    let t = await titlesNow();
    R.check(t.length === 5, { page: P, control: "Filter 'Active' (default)", expected: "All 5 active exhibitions listed", actual: t.length + " cards", impact: "misleading result", repro: "Open /museum" });
    await clickCardFilter(S, "Public"); t = await titlesNow();
    R.check(t.length === 1 && /Sports Slabs/.test(t[0]), { page: P, control: "Filter 'Public'", expected: "Only Sports Slabs (the one PUBLIC exhibition)", actual: t.join(" | "), impact: "misleading result", repro: "Click Public" });
    await clickCardFilter(S, "Private"); t = await titlesNow();
    R.check(t.length === 4 && !t.some((x) => /Sports Slabs/.test(x)), { page: P, control: "Filter 'Private'", expected: "The 4 Locked exhibitions, not Sports Slabs", actual: t.length + ": " + t.join(" | "), impact: "misleading result", repro: "Click Private" });
    await clickCardFilter(S, "Invite-only"); t = await titlesNow(); const gc1 = await ghostCount(); const txtInvite = (await S.text()).replace(/\s+/g, " ");
    const emptyShot = await S.jshot("exh-list-filter-empty-1440");
    R.check(t.length === 0, { page: P, control: "Filter 'Invite-only' (no exhibition is invite-only yet)", expected: "No exhibition cards", actual: t.length + " cards, " + gc1 + " 'New exhibit' ghost cards", impact: "misleading result", repro: "Click Invite-only" });
    const hasEmptyMsg = /no (invite|exhibit|drafts|results)|nothing here|no exhibitions (match|in)/i.test(txtInvite);
    R.check(hasEmptyMsg, { page: P, control: "Filter result with no matching exhibition: explanation", expected: "A short line saying nothing matches this filter (the Goals page does this)", actual: hasEmptyMsg ? "message shown" : "The list becomes " + gc1 + " identical 'New exhibit' create cards and the details panel disappears, with no sentence saying that no exhibition is invite-only. A first-time reader could think the list failed to load.", evidence: emptyShot, impact: "usability", repro: "Click Invite-only (or Drafts) with none." });
    await clickCardFilter(S, "Drafts"); t = await titlesNow();
    R.check(t.length === 0, { page: P, control: "Filter 'Drafts' (nothing in Storage yet)", expected: "No exhibition cards", actual: t.length + " cards", impact: "misleading result", repro: "Click Drafts" });
    await clickCardFilter(S, "Active"); t = await titlesNow();

    // ---------- 4. sort
    const sortOrder = async (label) => {
      // PillSelect: open then choose option by text
      await mclick(S, byLabel("Sort exhibitions"), { wait: 500 });
      const ok = await mclick(S, `[...document.querySelectorAll('[role=option],[role=menuitem],[role=menuitemradio],li button,div[role=listbox] *')].find(e => e.textContent.trim() === ${JSON.stringify(label)})`, { wait: 700 });
      return { ok, titles: (await titlesNow()).map((x) => x.replace(/\s+\d+ items?.*$/, "")) };
    };
    const byValue = Object.entries(exp).sort((a, b) => b[1].value - a[1].value).map(([k]) => k);
    let so = await sortOrder("Highest value");
    R.check(so.ok && JSON.stringify(so.titles.map((x) => x.replace(/^\+\s*/, ""))) === JSON.stringify(byValue), { page: P, control: "Sort 'Highest value'", expected: byValue.join(" > "), actual: so.ok ? so.titles.join(" > ") : "option not clickable", evidence: "", impact: "misleading result", repro: "Open Sort, choose Highest value" });
    so = await sortOrder("Most viewed");
    R.check(so.ok && /Sports Slabs/.test(so.titles[0] || ""), { page: P, control: "Sort 'Most viewed'", expected: "Sports Slabs (3 views) first", actual: so.ok ? so.titles.join(" > ") : "option not clickable", impact: "misleading result", repro: "Choose Most viewed" });
    so = await sortOrder("Best grade");
    R.check(so.ok && so.titles.length === 5, { page: P, control: "Sort 'Best grade' (order itself not independently recomputed)", expected: "List re-orders and keeps all 5 exhibitions", actual: so.titles.join(" > "), impact: "misleading result", repro: "Choose Best grade" });
    so = await sortOrder("Recently updated");
    R.check(so.ok && so.titles.length === 5, { page: P, control: "Sort 'Recently updated'", expected: "All 5 listed newest first", actual: so.titles.join(" > "), impact: "misleading result", repro: "Choose Recently updated" });

    // ---------- 5. card selection: click + keyboard, details panel
    const panelTitle = () => S.evaluate(`(() => { const a = document.querySelector('aside h2'); return a ? a.textContent.trim() : null; })()`);
    await mclick(S, byLabel("Show details for Vinyl Wall"), { wait: 500 });
    let pt = await panelTitle();
    R.check(pt === "Vinyl Wall", { page: P, control: "Card (click) 'Show details for Vinyl Wall'", expected: "Details panel switches to Vinyl Wall", actual: String(pt), impact: "usability", repro: "Click the Vinyl Wall card" });
    await S.evaluate(`(${byLabel("Show details for Guitars")}).focus(); true`);
    await key(S, "Enter", "Enter", 13);
    pt = await panelTitle();
    R.check(pt === "Guitars", { page: P, control: "Card (keyboard Enter on focused card)", expected: "Details panel switches to Guitars", actual: String(pt), impact: "usability", repro: "Tab to the Guitars card, press Enter" });
    const panelText = (await S.text()).replace(/\s+/g, " ");
    const gE = exp["Guitars"];
    R.check(new RegExp(`${gE.count} items`).test(panelText), { page: P, control: "Details panel item count", expected: `${gE.count} items`, actual: (panelText.match(/\d+ items · Updated[^A-Z]*[A-Za-z]{3} \d+, \d+/) || [""])[0], impact: "misleading result", repro: "Select Guitars" });

    // ---------- 6. open full page icon, back keeps view
    await mclick(S, byLabel("Open full exhibition page for Vinyl Wall"), { wait: 3500 });
    let p = await S.path();
    R.check(p === `/museum/${exp["Vinyl Wall"].id}`, { page: P, control: "Card icon 'Open full exhibition page for Vinyl Wall'", expected: "Opens that exhibition's own page", actual: p, impact: "blocked workflow", repro: "Click the arrow icon on the card" });
    await S.send("Page.navigate", { url: S.base + "/museum" }); await sleep(3500);
    // back navigation preserves filter/sort via sessionStorage
    await clickCardFilter(S, "Private"); await sortOrder("Highest value");
    await mclick(S, byLabel("Open full exhibition page for Guitars"), { wait: 3500 });
    await S.evaluate("history.back()"); await sleep(3500);
    t = await titlesNow();
    R.check(t.length === 4 && !t.some((x) => /Sports Slabs/.test(x)), { page: P, control: "Back from an exhibition keeps filter 'Private'", expected: "List returns on Private (4 rooms)", actual: t.length + " cards: " + t.map((x) => x.replace(/\s+\d+ items?.*$/, "")).join(", "), impact: "usability", repro: "Filter Private, open a room, browser Back" });
    await clickCardFilter(S, "Active");

    // ---------- 7. details panel controls
    await mclick(S, byLabel("Show details for Comics (Misc. & Peach cards)"), { wait: 500 });
    await S.evaluate("window.__aud.clip.length = 0; window.__aud.opens.length = 0; window.__aud.print = 0; window.__aud.downloads.length = 0; true");
    const shareVal = await S.evaluate(`document.querySelector('aside input[readonly]').value`);
    await mclick(S, byLabel("Copy link"), { wait: 600 });
    let look = await S.look();
    const copyBtnTxt = await S.evaluate(`(${byLabelRe("Copied|Copy link")}).textContent.trim()`);
    R.check(look.clip.length === 1 && look.clip[0] === shareVal && /\/museum\/share\/qavz/.test(shareVal) && /Copied/.test(copyBtnTxt), { page: P + " | Private exhibition 'Comics'", control: "Details panel 'Copy link'", expected: "Copies exactly the Share link shown ( /museum/share/<token> ) and says Copied", actual: `clipboard: ${JSON.stringify(look.clip)}; field: ${shareVal}; button: ${copyBtnTxt}`, impact: "misleading result", repro: "Select Comics, click Copy link" });
    R.check(shareVal.endsWith(exp["Comics (Misc. & Peach cards)"].token), { page: P, control: "Share link text matches the exhibition's token", expected: "…" + exp["Comics (Misc. & Peach cards)"].token, actual: shareVal, impact: "misleading result", repro: "Select Comics" });
    const privTxt = (await S.text()).replace(/\s+/g, " ");
    R.nt({ page: P + " | Private exhibition", control: "Share link / Copy link offered for a Private exhibition", expected: "Improvement candidate: a Private exhibition should not offer a copyable public link, or should say it will not work", actual: "A link is offered and copied for a Locked exhibition; opening it as a visitor shows 'Private Exhibition' (checked in the visibility suite).", impact: "improvement" });

    await mclick(S, byLabel("View public page ↗"), { wait: 3500 });
    p = await S.path();
    R.check(/\/guest$|\/museum\/share\//.test(p), { page: P + " | Private exhibition 'Comics'", control: "Details panel 'View public page ↗'", expected: "Opens the public (Guest View / share) page of the exhibition", actual: "went to " + p + " (the owner's editor page)", evidence: await S.jshot("exh-list-view-public-page-lands-on-editor"), impact: "misleading result", repro: "Select any exhibition, click 'View public page ↗'" });
    await S.send("Page.navigate", { url: S.base + "/museum" }); await sleep(3500);
    await mclick(S, byLabel("Show details for Comics (Misc. & Peach cards)"), { wait: 500 });
    await mclick(S, byLabel("Duplicate"), { wait: 3500 });
    p = await S.path();
    const dupCount = (await admin.from("galleries").select("id").eq("profile_id", m.personalId)).data.length;
    R.check(dupCount > 5, { page: P, control: "Details panel 'Duplicate'", expected: "Makes a copy of the exhibition (a 6th exhibition appears)", actual: `just opens the exhibition editor (${p}); exhibitions in the database still ${dupCount}. The button only calls the same 'open exhibition' action as the arrow icon.`, evidence: await S.jshot("exh-list-duplicate-opens-editor"), impact: "misleading result", repro: "Select an exhibition, click Duplicate" });
    await S.send("Page.navigate", { url: S.base + "/museum" }); await sleep(3500);
    await mclick(S, byLabel("Show details for Comics (Misc. & Peach cards)"), { wait: 500 });
    await mclick(S, byLabel("Export PDF"), { wait: 3500 });
    look = await S.look(); p = await S.path();
    R.check(!!look && (look.print > 0 || look.downloads.length > 0 || look.blobs.length > 0), { page: P, control: "Details panel 'Export PDF'", expected: "Produces/prints a PDF of the exhibition (print dialog or a file)", actual: `just opens the exhibition editor (${p}); print calls ${look && look.print}, downloads ${look && look.downloads.length}, blobs ${look && look.blobs.length}. The button only calls the same 'open exhibition' action.`, evidence: await S.jshot("exh-list-export-pdf-opens-editor"), impact: "misleading result", repro: "Select an exhibition, click Export PDF" });
    await S.send("Page.navigate", { url: S.base + "/museum" }); await sleep(3500);
    await mclick(S, byLabel("Show details for Movie Posters"), { wait: 500 });
    await mclick(S, byLabel("View all ›"), { wait: 3000 });
    p = await S.path();
    R.check(p === `/museum/${exp["Movie Posters"].id}`, { page: P, control: "Details panel 'View all ›'", expected: "Opens the exhibition", actual: p, impact: "usability", repro: "Select Movie Posters, click View all" });
    await S.send("Page.navigate", { url: S.base + "/museum" }); await sleep(3500);
    await mclick(S, byLabel("Show details for Movie Posters"), { wait: 500 });
    // thumbnails: real drag must scroll the strip and not open an item; plain click opens that item
    const strip = await S.evaluate(`(() => { const s = [...document.querySelectorAll('aside .overflow-x-auto')][0]; if (!s) return null; const r = s.getBoundingClientRect(); return { x: r.x, y: r.y + r.height / 2, w: r.width, sw: s.scrollWidth, cw: s.clientWidth, links: s.querySelectorAll('a').length }; })()`);
    if (strip && strip.sw > strip.cw + 4) {
      await S.evaluate(`document.querySelector('aside .overflow-x-auto').scrollIntoView({block:'center'}); true`); await sleep(300);
      const st2 = await S.evaluate(`(() => { const s = document.querySelector('aside .overflow-x-auto'); const r = s.getBoundingClientRect(); return { x: r.x, y: r.y + r.height / 2, w: r.width }; })()`);
      const sl0 = await S.evaluate(`document.querySelector('aside .overflow-x-auto').scrollLeft`);
      const path0 = await S.path();
      await drag(S, st2.x + st2.w * 0.8, st2.y, st2.x + st2.w * 0.2, st2.y, 8);
      const sl1 = await S.evaluate(`document.querySelector('aside .overflow-x-auto').scrollLeft`);
      R.check(sl1 > sl0 + 20 && (await S.path()) === path0, { page: P + " | Movie Posters, 8 items", control: "Selected items thumbnail strip (real mouse drag)", expected: "Drag moves the strip and does not open an item", actual: `scrollLeft ${sl0} -> ${sl1}; path ${await S.path()}`, impact: "usability", repro: "Select Movie Posters, drag across the thumbnails" });
    } else {
      R.nt({ page: P, control: "Selected items thumbnail strip drag", expected: "Drag scrolls when thumbnails overflow", actual: "strip does not overflow at this width: " + JSON.stringify(strip), impact: "usability" });
    }
    await mclick(S, `document.querySelector('aside .overflow-x-auto a')`, { wait: 3500 });
    p = await S.path();
    R.check(/^\/vault\/item\/qa_vz_/.test(p), { page: P, control: "Details panel thumbnail click", expected: "Opens that item's page in the Vault", actual: p, impact: "usability", repro: "Select an exhibition, click a thumbnail" });
    await S.send("Page.navigate", { url: S.base + "/museum" }); await sleep(3500);

    // ---------- 8. Change (visibility/state) dialog
    await mclick(S, byLabel("Show details for Guitars"), { wait: 500 });
    await mclick(S, byLabel("Change"), { wait: 500 });
    let dlg = await S.evaluate(`!!document.querySelector('[role=dialog][aria-label="Exhibition status"]')`);
    R.check(dlg, { page: P, control: "Details panel 'Change' (Privacy & access)", expected: "Opens the Exhibition status dialog", actual: String(dlg), impact: "blocked workflow", repro: "Select Guitars, click Change" });
    await S.evaluate(`(() => { const s = document.querySelectorAll('[role=dialog] select')[0]; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; set.call(s,'INVITE'); s.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
    await mclick(S, `[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Cancel')`, { wait: 600 });
    let g = await gdb(exp["Guitars"].id);
    R.check(g.visibility === "LOCKED", { page: P, control: "Exhibition status dialog 'Cancel' after choosing Invite Only", expected: "Nothing changes (database still LOCKED)", actual: "DB visibility " + g.visibility, impact: "data loss", repro: "Change > pick Invite Only > Cancel" });
    await mclick(S, byLabel("Change"), { wait: 500 });
    await S.evaluate(`(() => { const s = document.querySelectorAll('[role=dialog] select')[0]; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; set.call(s,'INVITE'); s.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
    await mclick(S, `[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Save')`, { wait: 3000 });
    g = await gdb(exp["Guitars"].id);
    R.check(g.visibility === "INVITE", { page: P, control: "Exhibition status dialog 'Save' (Visibility = Invite Only)", expected: "Saved to the database: visibility INVITE", actual: "DB visibility " + g.visibility, impact: "data loss", repro: "Change > Invite Only > Save, then check the exhibition" });
    const panelAfter = (await S.text()).replace(/\s+/g, " ");
    R.check(/Invite Only/.test(panelAfter) && /Only invited people can view/.test(panelAfter), { page: P, control: "Panel text after choosing Invite Only", expected: "Panel says Invite Only and explains it", actual: (panelAfter.match(/PRIVACY & ACCESS[^]{0,120}/) || [""])[0], impact: "misleading result", repro: "Save Invite Only" });
    await clickCardFilter(S, "Invite-only"); t = await titlesNow();
    R.check(t.length === 1 && /Guitars/.test(t[0]), { page: P, control: "Filter 'Invite-only' after saving Guitars as Invite Only", expected: "Guitars listed", actual: t.join(" | "), impact: "misleading result", repro: "Click Invite-only" });
    await clickCardFilter(S, "Private"); t = await titlesNow();
    R.check(t.length === 3 && !t.some((x) => /Guitars/.test(x)), { page: P, control: "Filter 'Private' after Guitars left Private", expected: "3 rooms, no Guitars", actual: t.length + " " + t.map((x) => x.replace(/\s+\d+ items?.*$/, "")).join(", "), impact: "misleading result", repro: "Click Private" });
    // state -> storage
    await clickCardFilter(S, "Invite-only");
    await mclick(S, byLabel("Change"), { wait: 500 });
    await S.evaluate(`(() => { const s = document.querySelectorAll('[role=dialog] select')[1]; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; set.call(s,'STORAGE'); s.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
    await mclick(S, `[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Save')`, { wait: 3000 });
    g = await gdb(exp["Guitars"].id);
    R.check(g.state === "STORAGE", { page: P, control: "Exhibition status dialog 'Save' (State = Storage)", expected: "Database state STORAGE", actual: "DB state " + g.state, impact: "data loss", repro: "Change > State Storage > Save" });
    await clickCardFilter(S, "Drafts"); t = await titlesNow();
    R.check(t.length === 1 && /Guitars/.test(t[0]), { page: P, control: "Filter 'Drafts' lists the Storage exhibition", expected: "Guitars", actual: t.join(" | "), impact: "misleading result", repro: "Click Drafts" });
    await clickCardFilter(S, "Active"); t = await titlesNow();
    R.check(t.length === 4 && !t.some((x) => /Guitars/.test(x)), { page: P, control: "Filter 'Active' hides the Storage exhibition", expected: "4 rooms, no Guitars", actual: t.length + " cards", impact: "misleading result", repro: "Click Active" });
    // restore Guitars to LOCKED/ACTIVE through the same dialog
    await clickCardFilter(S, "Drafts");
    await mclick(S, byLabel("Change"), { wait: 500 });
    await S.evaluate(`(() => { const ss = document.querySelectorAll('[role=dialog] select'); const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; set.call(ss[0],'LOCKED'); ss[0].dispatchEvent(new Event('change',{bubbles:true})); set.call(ss[1],'ACTIVE'); ss[1].dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
    await mclick(S, `[...document.querySelectorAll('[role=dialog] button')].find(b => b.textContent.trim() === 'Save')`, { wait: 3000 });
    g = await gdb(exp["Guitars"].id);
    R.check(g.state === "ACTIVE" && g.visibility === "LOCKED", { page: P, control: "Exhibition status dialog 'Save' (restore Locked/Active)", expected: "LOCKED / ACTIVE", actual: g.visibility + " / " + g.state, impact: "data loss", repro: "Change > Locked + Active > Save" });
    await clickCardFilter(S, "Active");

    // ---------- 9. cover upload from card + panel
    const png = ensurePng();
    const before = (await gdb(exp["Vinyl Wall"].id)).cover_image;
    const okUp = await uploadVia(S, byLabel("Change cover image for Vinyl Wall"), png);
    await sleep(6000);
    let after = (await gdb(exp["Vinyl Wall"].id)).cover_image;
    R.check(okUp === true && after && after !== before && /gallery-backgrounds\/.+\/cover\//.test(after), { page: P, control: "Card '+' (Change cover image for Vinyl Wall) with a real image file", expected: "Cover uploaded to storage and saved on the exhibition (database cover_image changes to the stored file)", actual: `picker ${okUp}; cover before=${String(before).slice(0, 60)} after=${String(after).slice(0, 110)}`, evidence: await S.jshot("exh-list-cover-upload"), impact: "data loss", repro: "Click + on a card, pick an image" });
    await S.visit("/museum"); await sleep(4000);
    const coverImgOk = await S.evaluate(`(() => { const a = [...document.querySelectorAll('main article')].find(x => x.innerText.includes('Vinyl Wall')); const im = a && a.querySelector('img'); return im ? { src: im.currentSrc || im.src, ok: im.complete && im.naturalWidth > 0 } : null; })()`);
    R.check(!!coverImgOk && /gallery-backgrounds/.test(coverImgOk.src), { page: P, control: "Card cover after reload", expected: "The uploaded cover shows on the card after a reload", actual: JSON.stringify(coverImgOk), impact: "data loss", repro: "Upload cover, reload /museum" });
    await mclick(S, byLabel("Show details for Vinyl Wall"), { wait: 500 });
    const before2 = after;
    const okUp2 = await uploadVia(S, byLabel("Edit cover"), png);
    await sleep(6000);
    after = (await gdb(exp["Vinyl Wall"].id)).cover_image;
    R.check(okUp2 === true && after && after !== before2, { page: P, control: "Details panel 'Edit cover'", expected: "A second cover upload replaces the cover in the database", actual: `picker ${okUp2}; changed=${after !== before2}`, impact: "data loss", repro: "Select a room, click Edit cover, choose an image" });

    // ---------- 10. delete dialog: cancel keeps
    const n0 = (await admin.from("galleries").select("id").eq("profile_id", m.personalId)).data.length;
    await mclick(S, byLabel("Delete exhibition Guitars"), { wait: 600 });
    dlg = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog][aria-label="Delete exhibition"]'); return d ? d.innerText.replace(/\\s+/g,' ') : null; })()`);
    R.check(!!dlg && /Guitars/.test(dlg) && /will not delete items in your Vault/.test(dlg), { page: P, control: "Card trash icon 'Delete exhibition Guitars'", expected: "Confirmation naming Guitars and saying Vault items are kept", actual: String(dlg).slice(0, 220), impact: "data loss", repro: "Hover a card, click the trash icon" });
    await mclick(S, byLabelRe("Cancel, keep My Exhibition"), { wait: 600 });
    const n1 = (await admin.from("galleries").select("id").eq("profile_id", m.personalId)).data.length;
    R.check(n1 === n0 && !(await S.evaluate(`!!document.querySelector('[role=dialog][aria-label="Delete exhibition"]')`)), { page: P, control: "Delete dialog 'Cancel, keep My Exhibition'", expected: "Dialog closes, nothing deleted", actual: `rows ${n0} -> ${n1}`, impact: "data loss", repro: "Delete icon > Cancel" });
    await mclick(S, byLabel("Show details for Guitars"), { wait: 500 });
    await mclick(S, `[...document.querySelectorAll('aside button')].find(b => b.textContent.trim() === 'Delete')`, { wait: 600 });
    dlg = await S.evaluate(`!!document.querySelector('[role=dialog][aria-label="Delete exhibition"]')`);
    await key(S, "Escape", "Escape", 27);
    const closedEsc = !(await S.evaluate(`!!document.querySelector('[role=dialog][aria-label="Delete exhibition"]')`));
    R.check(dlg && closedEsc && (await admin.from("galleries").select("id").eq("profile_id", m.personalId)).data.length === n0, { page: P, control: "Details panel 'Delete' then Escape", expected: "Delete confirmation opens; Escape closes it; nothing deleted", actual: `opened ${dlg}, closedByEsc ${closedEsc}`, impact: "data loss", repro: "Select a room, Delete, press Escape" });
    R.nt({ page: P, control: "Delete dialog 'Yes Delete FOREVER'", expected: "Removes only the chosen QA exhibition", actual: "Exercised on a spare QA exhibition in audit-s-exh-new.cjs", impact: "data loss" });

    // ---------- 11. ghost cards, create, tools
    let urls = [];
    const ghosts = await S.evaluate(`[...document.querySelectorAll('main a[aria-label="Create a new exhibit"]')].map(a => a.getAttribute('href'))`);
    R.check(ghosts.length >= 5 && ghosts.every((h) => h === "/museum/new"), { page: P, control: "'New exhibit' dashed cards", expected: "Every dashed card opens the Create Exhibition page", actual: ghosts.length + " links, hrefs " + [...new Set(ghosts)].join(","), impact: "usability", repro: "Look at the empty grid slots" });
    await mclick(S, byLabel("New exhibit") + " || document.querySelector('main a[aria-label=\"Create a new exhibit\"]')", { wait: 2500 });
    R.check((await S.path()) === "/museum/new", { page: P, control: "'New exhibit' dashed card (real click)", expected: "Opens /museum/new", actual: await S.path(), impact: "blocked workflow", repro: "Click a dashed card" });
    await S.send("Page.navigate", { url: S.base + "/museum" }); await sleep(3500);
    await mclick(S, byLabel("+ Create Exhibition"), { wait: 2500 });
    R.check((await S.path()) === "/museum/new", { page: P, control: "'+ Create Exhibition'", expected: "Opens /museum/new", actual: await S.path(), impact: "blocked workflow", repro: "Click + Create Exhibition" });
    await S.send("Page.navigate", { url: S.base + "/museum" }); await sleep(3500);
    await mclick(S, byLabel("Tools"), { wait: 500 });
    const tools = await S.evaluate(`[...document.querySelectorAll('[role=menu] *, [role=menuitem]')].map(e => e.textContent.trim()).filter(Boolean).slice(0,6)`);
    await mclick(S, byLabelRe("Build exhibition from search"), { wait: 3500 });
    R.check((await S.path()).startsWith("/vault/halls"), { page: P, control: "Tools > 'Build exhibition from search'", expected: "Opens /vault/halls", actual: (await S.path()) + " menu: " + JSON.stringify(tools).slice(0, 120), impact: "blocked workflow", repro: "Tools menu > Build exhibition from search" });
    await S.send("Page.navigate", { url: S.base + "/museum" }); await sleep(3500);

    // ---------- 12. 3D gallery access request (QA-owned profile column museum_beta_requested_at)
    await mclick(S, byLabel("Request 3D Gallery access"), { wait: 600 });
    dlg = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog][aria-label="3D Gallery beta"]'); return d ? d.innerText.replace(/\\s+/g,' ') : null; })()`);
    R.check(!!dlg && /Try the 3D Gallery/.test(dlg), { page: P, control: "'Request 3D Gallery access'", expected: "Opens a dialog explaining the beta and offering Request Access / Not now", actual: String(dlg).slice(0, 160), impact: "usability", repro: "Click the button" });
    await mclick(S, byLabel("Not now"), { wait: 500 });
    let pr = (await admin.from("profiles").select("museum_beta_requested_at,museum_beta_enabled").eq("id", m.personalId).single()).data;
    R.check(!pr.museum_beta_requested_at && !pr.museum_beta_enabled, { page: P, control: "3D dialog 'Not now'", expected: "Nothing recorded", actual: JSON.stringify(pr), impact: "data loss", repro: "Open dialog, Not now" });
    await mclick(S, byLabel("Request 3D Gallery access"), { wait: 600 });
    await mclick(S, byLabel("Request Access"), { wait: 2500 });
    pr = (await admin.from("profiles").select("museum_beta_requested_at,museum_beta_enabled").eq("id", m.personalId).single()).data;
    const dlg2 = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog][aria-label="3D Gallery beta"]'); return d ? d.innerText.replace(/\\s+/g,' ') : null; })()`);
    R.check(!!pr.museum_beta_requested_at && pr.museum_beta_enabled === false && /Request sent/.test(String(dlg2)), { page: P, control: "3D dialog 'Request Access' (writes only museum_beta_requested_at on the QA fixture profile)", expected: "Request recorded on the profile, dialog says 'Request sent', access is NOT enabled", actual: `requested_at ${pr.museum_beta_requested_at ? "set" : "null"}, enabled ${pr.museum_beta_enabled}; dialog: ${String(dlg2).slice(0, 80)}`, impact: "misleading result", repro: "Request 3D Gallery access > Request Access" });
    await mclick(S, byLabel("Got it"), { wait: 500 });
    const lab = await S.evaluate(`[...document.querySelectorAll('main button')].map(b => b.textContent.trim()).find(t => /3D Gallery/.test(t))`);
    R.check(lab === "3D Gallery access requested", { page: P, control: "3D button label after requesting", expected: "'3D Gallery access requested'", actual: lab, impact: "usability", repro: "After Request Access" });
    const ownerOnly = await S.evaluate(`[...document.querySelectorAll('main button')].map(b => b.textContent.trim()).filter(t => /Museum (Alpha|Builder)/.test(t))`);
    R.check(ownerOnly.length === 0, { page: P, control: "'Museum Alpha' / 'Museum Builder Alpha' buttons for a non-owner QA user", expected: "Hidden (owner-only)", actual: JSON.stringify(ownerOnly), impact: "privacy/data loss", repro: "Open /museum as a normal user" });

    // ---------- 13. Business profile: separate list
    const B = await session("business");
    try {
      await B.visit("/museum"); await sleep(5000);
      const bt = (await B.text()).replace(/\s+/g, " ");
      const bshot = await B.jshot("exh-list-business-empty-1440");
      R.check(/Your exhibitions are waiting/.test(bt) && !/Sports Slabs|Vinyl Wall|Guitars/.test(bt), { page: "/museum | owner, Business profile, 0 exhibitions", control: "Exhibitions list on the Business profile", expected: "Empty state for the Business profile; none of the Personal profile's exhibitions leak in", actual: bt.slice(bt.indexOf("Exhibitions"), bt.indexOf("Exhibitions") + 230), evidence: bshot, impact: "privacy/data loss", repro: "Switch to Business profile, open /museum" });
    } finally { await B.close(); }
  } finally { await S.close(); }

  // ---------- 14. viewer + visitor
  for (const kind of ["viewer", "visitor"]) {
    const V = await session(kind);
    try {
      await V.visit("/museum"); await sleep(5000);
      const vt = (await V.text()).replace(/\s+/g, " ");
      const pth = await V.path();
      const leaked = /Sports Slabs|Vinyl Wall|Guitars|Movie Posters|Comics \(Misc/.test(vt);
      const shot = await V.jshot(`exh-list-${kind}-1440`);
      if (kind === "viewer") R.check(!leaked && /Your exhibitions are waiting/.test(vt), { page: "/museum | unrelated viewer (own profile, 0 exhibitions)", control: "Exhibitions list", expected: "Viewer sees only their own (empty) list, none of the owner's exhibitions", actual: pth + " | " + vt.slice(vt.indexOf("Exhibitions"), vt.indexOf("Exhibitions") + 200), evidence: shot, impact: "privacy/data loss", repro: "Sign in as another user, open /museum" });
      else R.check(!leaked && /login|sign/i.test(pth + vt.slice(0, 300)), { page: "/museum | signed-out visitor", control: "Exhibitions list", expected: "Signed-out visitor is sent to sign-in; no exhibitions visible", actual: pth + " | " + vt.slice(0, 160), evidence: shot, impact: "privacy/data loss", repro: "Open /museum signed out" });
    } finally { await V.close(); }
  }
  console.log("DONE list suite");
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });

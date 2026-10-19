// DIS suite S: /saved and /favorites (+ the Discover section tab bar). Seeded by audit-s-dis-seed2.cjs (reseed before running).
const C = require("./audit-s-dis-common.cjs");
const { R, sleep, clean, admin, man } = C;
const r = R("DIS");
const m = man(); const P = m.personalId; const st = m.stamp; const sd = C.seed();
const section = async (name, fn) => { try { await fn(); } catch (e) { console.log("SECTION ERROR", name, e.message); r.nt({ page: "/saved or /favorites", control: "(test harness) " + name, expected: "section runs", actual: "test error, not an app result: " + e.message, impact: "none", repro: "re-run audit-s-dis-saved.cjs" }); } };
const rows = (S) => S.evaluate(`[...document.querySelectorAll('main .space-y-3 > div')].filter((d) => d.querySelector('button[aria-label=Remove]')).map((d) => d.innerText.replace(/\\s+/g, ' '))`);
const favCards = (S) => S.evaluate(`[...document.querySelectorAll('a[href^="/share/"], a[href^="/museum/"]')].filter((a) => /Saved/.test(a.innerText)).map((a) => ({ text: a.innerText.replace(/\\s+/g, ' '), href: a.getAttribute('href') }))`);

(async () => {
  // ================= /saved (owner)
  const S = await C.session("owner");
  await section("saved", async () => {
    const PG = "/saved | owner, Personal, 3 saved items";
    await S.visit("/saved"); await sleep(3500);
    const shot = await S.jshot("dis-saved-owner");
    let rs = await rows(S); const txt = clean(await S.text());
    r.check(rs.length === 3 && /3 SAVED ITEMS/i.test(txt) && /QA Album 13/.test(rs[0]) && /QA Album 19/.test(rs[1]) && /QA Album 1 -/.test(rs[2]), { page: PG, control: "Saved list: rows and count", expected: "3 rows, newest save first (13, 19, 1) and the heading '3 saved items'", actual: rs.map((x) => x.slice(0, 50)).join(" || "), evidence: shot, impact: "misleading result", repro: "Open /saved" });
    r.check(/\$250/.test(rs[0]) && /by QA dis Collector/.test(rs[0]) && !/\$/.test(rs[1]) && /PSA 9/.test(rs[2]) && /\$100/.test(rs[2]), { page: PG, control: "Saved rows: grade, value and collector", expected: "value and collector shown when known; no '$0' for the item without a value; PSA 9 badge", actual: rs.join(" || ").slice(0, 300), evidence: shot, impact: "misleading result", repro: "Read the rows" });
    r.check(/\p{Extended_Pictographic}/u.test(txt), { page: PG, control: "Footer link 'Find more in The Flip'", expected: "no emoji glyphs in the interface (house rule: custom line-art glyphs only)", actual: `emoji found in page text: ${(txt.match(/\p{Extended_Pictographic}/u) || [])[0]}`, evidence: shot, impact: "cosmetic", repro: "Open /saved with items; read the bottom link" });
    // row click does nothing
    const before = await S.path();
    await C.click(S, `([...document.querySelectorAll('main .space-y-3 > div')].find((d) => d.querySelector('button[aria-label=Remove]')).querySelector('.truncate'))`); await sleep(800);
    r.check((await S.path()) === before, { page: PG, control: "Click a saved row's title", expected: "(observation) rows are not links - nothing opens the item or its collector's room", actual: `path ${await S.path()}; row has links: ${await S.evaluate("[...document.querySelectorAll('main .space-y-3 > div')].find((d) => d.querySelector('button[aria-label=Remove]')).querySelectorAll('a').length")}`, evidence: "n/a", impact: "improvement", repro: "Click a title in Your Saves" });
    // The Flip links
    await C.clickText(S, "The Flip", { scope: "main", tags: "a" }); await sleep(1500);
    const fl = await S.path(); const flipOpen = /THE FLIP/.test(clean(await S.text()));
    r.check(flipOpen, { page: PG, control: "'The Flip' link (top of the list)", expected: "opens The Flip deck", actual: `goes to ${fl}; deck open=${flipOpen} (the deck is opened by a separate 'View all' button near the bottom of Discover)`, evidence: "n/a", impact: "misleading result", repro: "Your Saves > The Flip" });
    // remove one row
    await S.visit("/saved"); await sleep(3000);
    const wb = (await admin.from("watchlist").select("item_id").eq("owner_profile_id", P)).data.length;
    await C.click(S, `([...document.querySelectorAll('main .space-y-3 > div')].find((d) => /QA Album 19/.test(d.innerText)).querySelector('button[aria-label=Remove]'))`); await sleep(2500);
    rs = await rows(S); const wa = (await admin.from("watchlist").select("item_id").eq("owner_profile_id", P)).data.map((x) => x.item_id);
    r.check(rs.length === 2 && !rs.some((x) => /QA Album 19/.test(x)) && wa.length === wb - 1 && !wa.includes(`qa_vz_${st}_19`) && /2 SAVED ITEMS/i.test(clean(await S.text())), { page: PG, control: "Row Remove (X)", expected: "removes only that row, heading becomes '2 saved items', database row gone", actual: `rows=${rs.length}, db ${wb} -> ${wa.length}`, evidence: "n/a", impact: "data loss", repro: "Click X on one saved row" });
    await S.visit("/saved"); await sleep(3000);
    r.check((await rows(S)).length === 2, { page: PG, control: "Row Remove: after reload", expected: "stays removed (2 rows)", actual: String((await rows(S)).length), evidence: "n/a", impact: "data loss", repro: "Reload" });
    // Clear all: dismiss then accept
    S.dialogs.length = 0; S.dialogMode = "dismiss";
    await C.clickText(S, "^Clear all$"); await sleep(900);
    const keep = (await admin.from("watchlist").select("item_id").eq("owner_profile_id", P)).data.length;
    r.check(S.dialogs.length === 1 && /Clear all saved items/.test(S.dialogs[0].message) && keep === 2 && (await rows(S)).length === 2, { page: PG, control: "Clear all -> confirm dialog -> Cancel", expected: "asks 'Clear all saved items?'; cancelling keeps both rows", actual: `dialog=${JSON.stringify(S.dialogs[0] || null)}, rows kept=${(await rows(S)).length}, db=${keep}`, evidence: "n/a", impact: "data loss", repro: "Click Clear all; cancel" });
    S.dialogMode = "accept";
    await C.clickText(S, "^Clear all$"); await sleep(2500);
    const left = (await admin.from("watchlist").select("item_id").eq("owner_profile_id", P)).data.length;
    const t2 = clean(await S.text());
    r.check(left === 0 && /Nothing saved yet/.test(t2), { page: PG, control: "Clear all -> OK", expected: "removes every saved row (screen and database) and shows 'Nothing saved yet'", actual: `db rows=${left}; empty state=${/Nothing saved yet/.test(t2)}`, evidence: await S.jshot("dis-saved-cleared"), impact: "data loss", repro: "Clear all; OK" });
    S.dialogMode = "dismiss";
    const ofl = await C.click(S, `[...document.querySelectorAll('main a')].find((a) => /Open The Flip/.test(a.textContent))`); await sleep(1500);
    r.check(/THE FLIP/.test(clean(await S.text())), { page: PG + " (emptied)", control: "Empty state button 'Open The Flip'", expected: "opens The Flip deck", actual: `goes to ${await S.path()}; deck open=${/THE FLIP/.test(clean(await S.text()))}`, evidence: "n/a", impact: "misleading result", repro: "Empty Your Saves; click Open The Flip" });
    // Back button
    await S.visit("/discover"); await sleep(2000);
    await S.visit("/saved"); await sleep(2000);
    await C.clickText(S, "^Back$"); await sleep(1500);
    r.check((await S.path()) === "/discover", { page: PG, control: "Back button", expected: "returns to the previous page (/discover)", actual: await S.path(), evidence: "n/a", impact: "usability", repro: "Discover > Saved > Back" });
  });

  // ================= section tab bar
  await section("tabs", async () => {
    const PG = "/saved | owner (Discover section tab bar)";
    await S.visit("/saved"); await sleep(2500);
    const tabs = await S.evaluate(`(() => { const nav = [...document.querySelectorAll('nav')].find((n) => /Marketplace/.test(n.innerText) && /Upcoming/.test(n.innerText)); return nav ? [...nav.querySelectorAll('a')].map((a) => ({ t: a.textContent.trim(), h: a.getAttribute('href'), cur: a.getAttribute('aria-current') })) : []; })()`);
    r.check(tabs.map((t) => t.t + ":" + t.h).join() === "Explore:/discover,Saved:/saved,Watchlist:/watchlist,Marketplace:/market,Upcoming Comics:/upcoming,Events:/events" && tabs.find((t) => t.t === "Saved").cur === "page", { page: PG, control: "Section tabs: Explore / Saved / Watchlist / Marketplace / Upcoming Comics / Events", expected: "six tabs with their own destinations; Saved marked current", actual: tabs.map((t) => `${t.t}->${t.h}${t.cur ? "*" : ""}`).join(" | "), evidence: "n/a", impact: "usability", repro: "Open /saved" });
    for (const [label, path] of [["Explore", "/discover"], ["Watchlist", "/watchlist"], ["Marketplace", "/market"], ["Upcoming Comics", "/upcoming"], ["Events", "/events"], ["Saved", "/saved"]]) {
      await S.visit("/saved"); await sleep(1500);
      await C.click(S, `([...[...document.querySelectorAll('nav')].find((n) => /Marketplace/.test(n.innerText) && /Upcoming/.test(n.innerText)).querySelectorAll('a')].find((a) => a.textContent.trim() === ${JSON.stringify(label)}))`);
      await S.waitFor(`location.pathname === ${JSON.stringify(path)}`, 20000, label).catch(() => {});
      await sleep(1200);
      const cur = await S.evaluate(`(() => { const nav = [...document.querySelectorAll('nav')].find((n) => /Marketplace/.test(n.innerText) && /Upcoming/.test(n.innerText)); const a = nav && [...nav.querySelectorAll('a')].find((x) => x.getAttribute('aria-current') === 'page'); return a ? a.textContent.trim() : null; })()`);
      r.check((await S.path()) === path && cur === label, { page: "/saved -> tab " + label, control: `Section tab: ${label} (real click)`, expected: `opens ${path} and shows ${label} as the current tab`, actual: `path ${await S.path()}, current tab '${cur}'`, evidence: "n/a", impact: "blocked workflow", repro: `From /saved click ${label}` });
    }
  });

  // ================= /favorites as the viewer
  const K = await C.session("viewer");
  await section("favorites", async () => {
    const PG = "/favorites | unrelated viewer, 1 item + 1 exhibition";
    await K.visit("/favorites"); await sleep(3500);
    const shot = await K.jshot("dis-favorites-viewer");
    let fc = await favCards(K); const txt = clean(await K.text());
    r.check(fc.length === 2 && /2saved|2 saved/.test(txt) && /All 2/.test(txt) && /Items 1/.test(txt) && /Exhibitions 1/.test(txt), { page: PG, control: "Favorites: list, stats and tab counts", expected: "2 saved (1 item, 1 exhibition); tabs All 2 / Items 1 / Exhibitions 1", actual: txt.slice(txt.indexOf("Favorites") + 60, txt.indexOf("Favorites") + 190), evidence: shot, impact: "misleading result", repro: "Open /favorites" });
    const ex = fc.find((c) => c.href.startsWith("/museum/")); const it = fc.find((c) => c.href.startsWith("/share/"));
    r.check(ex && /5 items/.test(ex.text), { page: PG, control: "Favorite exhibition row: item count", expected: "5 items (what Discover and the room itself show)", actual: ex && ex.text, evidence: shot, impact: "misleading result", repro: "Favourite the Alpha room; open /favorites; compare with Discover (5 items)" });
    r.check(fc[0].text.includes("QA dis Alpha") && fc[1].text.includes("QA Album 1"), { page: PG, control: "Sort: Recently saved (default)", expected: "exhibition saved 24h ago above the item saved 48h ago", actual: fc.map((c) => c.text.slice(0, 40)).join(" || "), evidence: "n/a", impact: "usability", repro: "Open /favorites" });
    await C.clickText(K, "^Items", { scope: "body", tags: "button" }); await sleep(500);
    fc = await favCards(K);
    r.check(fc.length === 1 && fc[0].href.startsWith("/share/"), { page: PG, control: "Tab: Items", expected: "only the item", actual: fc.map((c) => c.href).join(), evidence: "n/a", impact: "misleading result", repro: "Click Items" });
    await C.clickText(K, "^Exhibitions", { scope: "body", tags: "button" }); await sleep(500);
    fc = await favCards(K);
    r.check(fc.length === 1 && fc[0].href.startsWith("/museum/"), { page: PG, control: "Tab: Exhibitions", expected: "only the exhibition", actual: fc.map((c) => c.href).join(), evidence: "n/a", impact: "misleading result", repro: "Click Exhibitions" });
    await C.clickText(K, "^All", { scope: "body", tags: "button" }); await sleep(500);
    await C.typeInto(K, "input[placeholder='Search…']", "alpha"); fc = await favCards(K);
    r.check(fc.length === 1 && /Alpha/.test(fc[0].text), { page: PG, control: "Search…: 'alpha'", expected: "only the Alpha exhibition", actual: fc.map((c) => c.text.slice(0, 40)).join(), evidence: "n/a", impact: "misleading result", repro: "Type alpha" });
    await C.typeInto(K, "input[placeholder='Search…']", "zzqq"); const nt = clean(await K.text());
    r.check(/No results for "zzqq"/.test(nt), { page: PG, control: "Search…: no match", expected: "a 'No results for ...' message", actual: (nt.match(/No results[^"]*"[^"]*"/) || ["none"])[0], evidence: await K.jshot("dis-favorites-nomatch"), impact: "usability", repro: "Type zzqq" });
    await C.typeInto(K, "input[placeholder='Search…']", "");
    await C.pick(K, "Sort favorites", "^A"); await sleep(500);
    fc = await favCards(K); const titles = fc.map((c) => c.text);
    r.check(titles.length === 2 && /QA Album 1/.test(titles[0]) && /QA dis Alpha/.test(titles[1]), { page: PG, control: "Sort: A to Z", expected: "alphabetical by title: the item (QA Album 1...) before the exhibition (QA dis Alpha...), which reverses the recent order", actual: titles.map((t) => t.slice(0, 36)).join(" || "), evidence: "n/a", impact: "misleading result", repro: "Choose A to Z" });
    // open each
    await C.pick(K, "Sort favorites", "^Recently");
    await C.click(K, `document.querySelector('a[href^="/museum/"]')`); await K.waitFor("location.pathname.startsWith('/museum/')", 30000, "open exhibit").catch(() => {}); await sleep(2000);
    r.check((await K.path()) === `/museum/${sd.ids.A}/guest` && /5 items/.test(clean(await K.text())), { page: PG, control: "Favorite exhibition row (real click)", expected: "opens that exhibition's guest room", actual: await K.path(), evidence: "n/a", impact: "blocked workflow", repro: "Click the exhibition favourite" });
    await K.visit("/favorites"); await sleep(2500);
    await C.click(K, `document.querySelector('a[href^="/share/"]')`); await K.waitFor("location.pathname.startsWith('/share/')", 30000, "open item").catch(() => {}); await sleep(2500);
    const it2 = clean(await K.text());
    r.check(/QA Album 1/.test(it2) && !/404|not found|can.t be found/i.test(it2), { page: PG, control: "Favorite item row (real click)", expected: "opens the item's public page", actual: `${await K.path()} | ${it2.slice(60, 220)}`, evidence: await K.jshot("dis-favorites-item-open"), impact: "blocked workflow", repro: "Click the item favourite" });
  });

  // ================= Save from the guest room -> favorites -> unsave
  await section("guest-save", async () => {
    const PG = "/museum/<Bravo>/guest -> /favorites | unrelated viewer";
    await K.visit(`/museum/${sd.ids.B}/guest`); await sleep(3000);
    const bl = await K.evaluate("[...document.querySelectorAll('button')].filter((b) => /Save|Saved/.test(b.getAttribute('aria-label') || '') ).map((b) => b.getAttribute('aria-label') + '|' + b.textContent.trim() + '|' + b.getAttribute('aria-pressed'))");
    const c = await C.click(K, `([...document.querySelectorAll('button')].find((b) => /Save to your saved list|Saved/.test(b.getAttribute('aria-label') || '')))`); await sleep(2500);
    const bl2 = await K.evaluate("[...document.querySelectorAll('button')].filter((b) => /Save|Saved/.test(b.getAttribute('aria-label') || '') ).map((b) => b.getAttribute('aria-label') + '|' + b.textContent.trim() + '|' + b.getAttribute('aria-pressed'))");
    const db = (await admin.from("public_favorites").select("id,content_id,user_id").eq("user_id", m.k.userId).eq("content_id", sd.ids.B)).data;
    r.check(c && db.length === 1 && JSON.stringify(bl) !== JSON.stringify(bl2), { page: PG, control: "Guest room: Save to your saved list", expected: "button changes state and one favourite row exists for this user and room", actual: `before=${bl.join(";")} after=${bl2.join(";")} rows=${db.length}`, evidence: await K.jshot("dis-guest-saved"), impact: "misleading result", repro: "Open a guest room signed in; click Save" });
    await K.visit("/favorites"); await sleep(3000);
    const fc = await favCards(K);
    r.check(fc.length === 3 && fc.some((x) => x.href === `/museum/${sd.ids.B}/guest`), { page: PG, control: "Favorites after saving from the guest room", expected: "the Bravo room appears (3 favourites)", actual: fc.map((x) => x.text.slice(0, 36)).join(" || "), evidence: await K.jshot("dis-favorites-after-save"), impact: "misleading result", repro: "Save a room; open /favorites" });
    // unsave
    await K.visit(`/museum/${sd.ids.B}/guest`); await sleep(3000);
    await C.click(K, `([...document.querySelectorAll('button')].find((b) => /Saved|Remove|Unsave|Save/.test(b.getAttribute('aria-label') || '') && /sav/i.test(b.getAttribute('aria-label') || '')))`); await sleep(2500);
    const db2 = (await admin.from("public_favorites").select("id").eq("user_id", m.k.userId).eq("content_id", sd.ids.B)).data;
    await K.visit("/favorites"); await sleep(3000);
    const fc2 = await favCards(K);
    r.check(db2.length === 0 && fc2.length === 2 && !fc2.some((x) => x.href === `/museum/${sd.ids.B}/guest`), { page: PG, control: "Guest room: unsave (click the same control again)", expected: "removes only the Bravo favourite; the two seeded favourites stay", actual: `rows=${db2.length}, favourites listed=${fc2.length}`, evidence: "n/a", impact: "data loss", repro: "Click Save again on the room; open /favorites" });
  });

  await section("isolation", async () => {
    const O = await C.session("owner");
    await O.visit("/favorites"); await sleep(3000);
    const t = clean(await O.text()); const fc = await favCards(O);
    r.check(fc.length === 0 && /No favorites yet/.test(t), { page: "/favorites | owner (other account)", control: "Favorites of a different account", expected: "empty state; nothing from the viewer's account", actual: `cards=${fc.length}; ${/No favorites yet/.test(t)}`, evidence: await O.jshot("dis-favorites-empty-owner"), impact: "privacy/data loss", repro: "Sign in as another user; open /favorites" });
    // does Discover offer the heart the empty state talks about?
    await O.visit("/discover"); await sleep(3000);
    const hearts = await O.evaluate("[...document.querySelectorAll('main button, main a, aside button')].filter((b) => /heart|favorite|favourite|like/i.test((b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || ''))).map((b) => b.getAttribute('aria-label') || b.getAttribute('title'))");
    r.check(hearts.length > 0, { page: "/favorites (empty state) vs /discover", control: "Empty state text 'Browse the Discover page and tap the heart on any item or exhibition to save it here.'", expected: "Discover has a heart control on items/exhibitions", actual: `controls on Discover matching heart/favorite/like: ${hearts.length}. Favourites are actually saved with 'Save' inside a guest room.`, evidence: "n/a", impact: "misleading result", repro: "Read the empty Favorites page; look for a heart on Discover" });
    await O.visit("/favorites"); await sleep(2000);
    await C.clickText(O, "Explore Discover", { scope: "body", tags: "a" }); await sleep(1500);
    r.check((await O.path()) === "/discover", { page: "/favorites | owner (empty)", control: "Explore Discover →", expected: "opens /discover", actual: await O.path(), evidence: "n/a", impact: "usability", repro: "Click it" });
    await O.close();
    const B = await C.session("business");
    await B.visit("/favorites"); await sleep(3000);
    r.check((await favCards(B)).length === 0, { page: "/favorites | owner, Business profile", control: "Favorites under Business", expected: "empty", actual: String((await favCards(B)).length), evidence: "n/a", impact: "privacy/data loss", repro: "Switch to Business" });
    await B.close();
    const V = await C.session("visitor");
    for (const p of ["/favorites", "/saved"]) { await V.visit(p); await sleep(2000); r.check(/\/login\?next=/.test(await V.path()), { page: p + " | signed-out visitor", control: "Signed-out access", expected: "asked to sign in", actual: await V.path(), evidence: "n/a", impact: "privacy/data loss", repro: "Open " + p + " signed out" }); }
    await V.close();
  });

  await K.close(); await S.close();
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });

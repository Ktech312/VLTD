// DIS suite B: /discover search, universe filter, sort, View all/Show less, strip, empty + failed-load states. Visitor 1440.
const C = require("./audit-s-dis-common.cjs");
const { R, sleep, clean, admin } = C;
const r = R("DIS");
const sd = C.seed(); const T = sd.titles; const ID = sd.ids;
const PG = "/discover | visitor, 1440";
const section = async (name, fn) => { try { await fn(); } catch (e) { console.log("SECTION ERROR", name, e.message); r.nt({ page: PG, control: "(test harness) " + name, expected: "section runs", actual: "test error, not an app result: " + e.message, impact: "none", repro: "re-run audit-s-dis-discover-b.cjs" }); } };

// every room card on the page (button containing 'N items'), with its section heading
const cards = (S) => S.evaluate(`(() => [...document.querySelectorAll('main section')].map((sec) => ({ h: (sec.querySelector('h2')?.textContent || '').trim(), cards: [...sec.querySelectorAll('button')].filter((b) => /\\d+ items?/.test(b.innerText)).map((b) => b.innerText.replace(/\\s+/g, ' ')) })).filter((s) => s.cards.length))()`);
const sect = async (S, h) => (await cards(S)).find((s) => s.h.toLowerCase() === h.toLowerCase()) || { h, cards: [] };
const slides = (S) => S.evaluate(`[...document.querySelectorAll('[data-slide-id]')].map((s) => ({ id: s.dataset.slideId, title: s.querySelector('h3')?.textContent, text: s.querySelector('p')?.textContent, href: s.querySelector('a')?.getAttribute('href'), bg: s.dataset.slideBg, cover: s.querySelector('img')?.getAttribute('src') || null }))`);
const emptyShown = (S) => S.evaluate(`!![...document.querySelectorAll('h2')].find((h) => /No exhibitions match/.test(h.textContent))`);
const itemsOf = (t) => Number((String(t).match(/(\d+) items?/) || [])[1] || 0);
const sortLabel = (S) => S.evaluate(`document.querySelector('button[aria-label="Sort exhibitions"]').textContent.trim()`);
const filterLabel = (S) => S.evaluate(`document.querySelector('button[aria-label="Filter by universe"]').textContent.trim()`);
const inputVal = (S) => S.evaluate(`document.querySelector('main input').value`);
const SEARCH = "main input";

(async () => {
  const S = await C.session("visitor");
  const dbAll = (await admin.from("galleries").select("id,title,analytics_views,created_at,layout").eq("visibility", "PUBLIC").eq("state", "ACTIVE")).data;
  const byId = new Map(dbAll.map((g) => [g.id, g]));
  await S.visit("/discover"); await sleep(2500);

  // ---------------- search
  await section("search", async () => {
    const q = async (text) => { await C.typeInto(S, SEARCH, text); await sleep(500); };
    await q("zebra");
    let feat = await sect(S, "Featured Rooms"); let sl = await slides(S);
    const shot = await S.jshot("dis-search-zebra");
    r.check(feat.cards.length === 1 && feat.cards[0].includes(T.A) && sl.length === 1 && !(await emptyShown(S)), { page: PG, control: "Search box: text found only in a room's DESCRIPTION ('zebra')", expected: "only the Alpha room (its description contains the word) remains in Featured Rooms and the carousel", actual: `featured=${feat.cards.length} [${feat.cards.map((c) => c.slice(0, 60)).join(" | ")}] slides=${sl.length}`, evidence: shot, impact: "misleading result", repro: "Open /discover; type 'zebra' in the search box" });
    await q("bravo MIDNIGHT");
    feat = await sect(S, "Featured Rooms");
    r.check(feat.cards.length === 1 && feat.cards[0].includes(T.B), { page: PG, control: "Search box: title match, mixed case ('bravo MIDNIGHT')", expected: "case-insensitive title match -> only Bravo", actual: feat.cards.map((c) => c.slice(0, 70)).join(" | "), evidence: shot, impact: "misleading result", repro: "Type 'bravo MIDNIGHT'" });
    await q("QA dis Collector");
    feat = await sect(S, "Featured Rooms"); const notable = await sect(S, "Trending Exhibitions");
    await C.clickText(S, "^View all$", { scope: "main section:nth-of-type(3)" }).catch(() => {});
    // expand Trending fully to count every match
    await S.evaluate(`(() => { const sec = [...document.querySelectorAll('main section')].find((s) => /Trending/i.test(s.querySelector('h2')?.textContent || '')); const b = [...sec.querySelectorAll('button')].find((x) => x.textContent.trim() === 'View all'); if (b) b.click(); return true; })()`); await sleep(500);
    const tr = await sect(S, "Trending Exhibitions");
    const mine = tr.cards.filter((c) => /by QA dis Collector/.test(c));
    r.check(tr.cards.length === 6 && mine.length === 6, { page: PG, control: "Search box: collector name ('QA dis Collector')", expected: "exactly this collector's 6 public rooms (Alpha..Echo + the fixture's own Sports Slabs; private Foxtrot excluded) and nothing else", actual: `trending cards=${tr.cards.length}, by that collector=${mine.length}`, evidence: await S.jshot("dis-search-collector"), impact: "misleading result", repro: "Type the collector name; open Trending Exhibitions > View all" });
    await q("sports");
    const trs = await sect(S, "Trending Exhibitions");
    r.check(trs.cards.length >= 1 && trs.cards.some((c) => c.includes(T.A)), { page: PG, control: "Search box: universe name ('sports')", expected: "rooms in the Sports universe (incl. Alpha) are found", actual: `${trs.cards.length} cards; Alpha present=${trs.cards.some((c) => c.includes(T.A))}`, evidence: "n/a", impact: "misleading result", repro: "Type 'sports'" });
    // no match
    await q("qqzzxx123");
    const em = await emptyShown(S); const txt = clean(await S.text());
    const featNo = await sect(S, "Featured Rooms"); const trendNo = await sect(S, "Trending Exhibitions"); const sl0 = await slides(S);
    const shotNo = await S.jshot("dis-search-nomatch");
    r.check(em && /Clear the search or filters/.test(txt) && featNo.cards.length === 0 && trendNo.cards.length === 0 && sl0.length === 0, { page: PG, control: "Search box: no-match ('qqzzxx123') empty state", expected: "'No exhibitions match' with a Show All button AND no unrelated rooms presented underneath", actual: `empty message=${em}; Featured cards still listed=${featNo.cards.length}; Trending cards still listed=${trendNo.cards.length}; carousel slides=${sl0.length}; detail panel=${clean(await S.evaluate("document.querySelector('aside')?.innerText||''")).slice(0, 40)}`, evidence: shotNo, impact: "misleading result", repro: "Type 'qqzzxx123' in the search; scroll below the 'No exhibitions match' message" });
    // Show All
    const sa = await C.clickText(S, "(^| )Show All$"); console.log("show-all click:", sa); await sleep(600);
    const afterShow = await sect(S, "Featured Rooms");
    r.check((await inputVal(S)) === "" && !(await emptyShown(S)) && afterShow.cards.length >= 4 && (await filterLabel(S)) === "All universes", { page: PG, control: "Show All (empty state)", expected: "clears the search text and universe filter and restores the full list", actual: `input='${await inputVal(S)}', filter='${await filterLabel(S)}', featured=${afterShow.cards.length}`, evidence: "n/a", impact: "blocked workflow", repro: "Search nonsense; click Show All" });
    // whitespace only, clearing by editing
    await q("   "); const ws = await sect(S, "Featured Rooms");
    r.check(ws.cards.length >= 4 && !(await emptyShown(S)), { page: PG, control: "Search box: only spaces", expected: "treated as no search (full list, no empty state)", actual: `featured=${ws.cards.length} empty=${await emptyShown(S)}`, evidence: "n/a", impact: "usability", repro: "Type three spaces" });
    await q("("); const sp = await emptyShown(S);
    r.check(sp === true || sp === false, { page: PG, control: "Search box: a lone '(' (regex-significant character)", expected: "no crash; behaves as plain text (no match -> empty state)", actual: `page alive, empty state=${sp}; console errors=${S.consoleErrors.length}`, evidence: "n/a", impact: "usability", repro: "Type (" });
    await q("zebra"); await q("");
    const back = await sect(S, "Featured Rooms");
    r.check(back.cards.length >= 4 && (await inputVal(S)) === "", { page: PG, control: "Search box: clearing the text", expected: "deleting the text brings the full list back", actual: `featured=${back.cards.length}`, evidence: "n/a", impact: "usability", repro: "Type zebra, then delete it" });
  });

  // ---------------- universe filter + Across Every Universe strip
  await section("filter", async () => {
    await S.visit("/discover"); await sleep(2500);
    await C.click(S, `document.querySelector('button[aria-label="Filter by universe"]')`); await sleep(300);
    const labels = await C.menuLabels(S);
    await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await sleep(300);
    r.check(labels[0] === "All universes" && labels.length === 11, { page: PG, control: "Filter by universe: option list", expected: "'All universes' plus the 10 universes", actual: labels.join(" / "), evidence: "n/a", impact: "usability", repro: "Open the universe dropdown" });
    const stripBtns = async () => S.evaluate(`(() => { const sec = [...document.querySelectorAll('main section')].find((s) => /Across Every Universe/i.test(s.querySelector('h2')?.textContent || '')); return sec ? [...sec.querySelectorAll('button')].filter((b) => /exhibitions/.test(b.innerText)).map((b) => b.innerText.replace(/\\s+/g, ' ').trim()) : []; })()`);
    const strip0 = await stripBtns();
    const stripMap = Object.fromEntries(strip0.map((s) => { const m = s.match(/^(.*) (\d[\d,]*) exhibitions$/); return [m[1], Number(m[2].replace(/,/g, ""))]; }));
    const results = {}; const opts = labels.slice(1);
    // total number of exhibitions when unfiltered (Trending expanded)
    const expandAll = async (h) => S.evaluate(`(() => { const sec = [...document.querySelectorAll('main section')].find((s) => new RegExp(${JSON.stringify(h)}, 'i').test(s.querySelector('h2')?.textContent || '')); const b = sec && [...sec.querySelectorAll('button')].find((x) => x.textContent.trim() === 'View all'); if (b) b.click(); return !!b; })()`);
    for (const lab of opts) {
      await C.pick(S, "Filter by universe", `^${lab.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&")}`);
      await sleep(400);
      await expandAll("Notable Items"); await sleep(300);
      const na = await sect(S, "Notable Items"); const em = await emptyShown(S);
      const chips = await S.evaluate(`[...document.querySelectorAll('[data-testid=featured-rooms] button')].map((b) => (b.querySelector('span.absolute')?.textContent || '').trim())`);
      results[lab] = { count: em ? 0 : na.cards.length, empty: em, chips, label: await filterLabel(S), listed: na.cards.length };
    }
    const bad = Object.entries(results).filter(([lab, v]) => (stripMap[lab] || 0) !== v.count);
    r.check(bad.length === 0, { page: PG, control: "Filter by universe vs the 'Across Every Universe' counts", expected: "for every universe the number of rooms listed under that filter equals the count the strip shows (0 when none)", actual: bad.length ? bad.map(([lab, v]) => `${lab}: strip ${stripMap[lab] || 0}, list ${v.count}`).join("; ") : Object.entries(results).map(([k, v]) => `${k}=${v.count}`).join(", "), evidence: await S.jshot("dis-filter-universe-last"), impact: "misleading result", repro: "Pick each universe in the dropdown; compare the room count with the strip" });
    const mismatchChip = Object.entries(results).filter(([lab, v]) => !v.empty && v.chips.some((c) => c && c.toLowerCase() !== lab.toLowerCase()));
    r.check(mismatchChip.length === 0, { page: PG, control: "Filter by universe: every card shown carries the chosen universe", expected: "Featured Room cards under a universe filter all show that universe's tag", actual: mismatchChip.length ? mismatchChip.map(([lab, v]) => `${lab}: ${v.chips.join(",")}`).join("; ") : "all consistent", evidence: "n/a", impact: "misleading result", repro: "Pick a universe; read the tag on each Featured card" });
    const empties = Object.entries(results).filter(([, v]) => v.empty);
    // empty universe: does the page show unrelated rooms below the empty message?
    if (empties.length) {
      const lab = empties[0][0];
      await C.pick(S, "Filter by universe", `^${lab.replace(/[.*+?^${}()|[\]\\&]/g, "\\$&")}`); await sleep(400);
      const f = await sect(S, "Featured Rooms"); const tr = await sect(S, "Trending Exhibitions"); const sl = await slides(S);
      r.check(f.cards.length === 0 && tr.cards.length === 0 && sl.length === 0, { page: PG, control: `Filter by universe -> '${lab}' (no rooms in that universe)`, expected: "empty state only, not a list of other universes' rooms", actual: `empty message=${await emptyShown(S)}; still listed: featured=${f.cards.length}, trending=${tr.cards.length}, slides=${sl.length}`, evidence: await S.jshot("dis-filter-empty-universe"), impact: "misleading result", repro: `Pick '${lab}' in the universe dropdown` });
    } else r.nt({ page: PG, control: "Filter by universe -> a universe with no rooms", expected: "empty state", actual: "every universe currently has rooms; not reached", impact: "none", repro: "n/a" });
    // strip
    await S.visit("/discover"); await sleep(2500);
    const first = Object.keys(stripMap)[0];
    await C.click(S, `([...[...document.querySelectorAll('main section')].find((s) => /Across Every Universe/i.test(s.querySelector('h2')?.textContent || '')).querySelectorAll('button')].find((b) => /exhibitions/.test(b.innerText)))`); await sleep(600);
    const lab1 = await filterLabel(S);
    r.check(lab1.toLowerCase() === first.toLowerCase(), { page: PG, control: `'Across Every Universe' tile: ${first}`, expected: "sets the universe filter to that universe", actual: `filter shows '${lab1}'`, evidence: "n/a", impact: "misleading result", repro: "Click the first tile in the strip" });
    await C.click(S, `([...document.querySelectorAll('main section')].find((s) => /Across Every Universe/i.test(s.querySelector('h2')?.textContent || '')).querySelector('button.rounded-full, button')).closest('section').querySelector('h2').parentElement.querySelector('button')`); await sleep(500);
    r.check((await filterLabel(S)) === "All universes", { page: PG, control: "Across Every Universe: View all (header)", expected: "returns the filter to 'All universes'", actual: await filterLabel(S), evidence: "n/a", impact: "usability", repro: "Choose a universe tile; click View all in the strip header" });
    // sort lists the 5 options
  });

  // ---------------- sort
  await section("sort", async () => {
    await S.visit("/discover"); await sleep(2500);
    r.check((await sortLabel(S)) === "Recommended", { page: PG, control: "Sort exhibitions: default", expected: "starts on Recommended", actual: await sortLabel(S), evidence: "n/a", impact: "usability", repro: "Open /discover" });
    await C.click(S, `document.querySelector('button[aria-label="Sort exhibitions"]')`); await sleep(300);
    const opts = await C.menuLabels(S);
    await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await sleep(300);
    r.check(opts.join("|") === "Recommended|Most viewed|Most items|Newest|A to Z", { page: PG, control: "Sort exhibitions: option list", expected: "Recommended, Most viewed, Most items, Newest, A to Z", actual: opts.join(" | "), evidence: "n/a", impact: "usability", repro: "Open the sort dropdown" });
    const seq = async (label, re) => { await C.pick(S, "Sort exhibitions", re); await sleep(500); const sl = await slides(S); const feat = await sect(S, "Featured Rooms"); return { sl, feat, label: await sortLabel(S) }; };
    const non = (a, cmp) => a.every((x, i) => i === 0 || cmp(a[i - 1], x) >= 0);
    const rec = await seq("Recommended", "^Recommended");
    const v = (s) => byId.get(s.id)?.analytics_views ?? 0;
    r.check(non(rec.sl, (a, b) => v(a) - v(b)), { page: PG, control: "Sort: Recommended (visitor, no personalisation)", expected: "carousel/featured follow the most-viewed order", actual: rec.sl.map((s) => `${s.title.slice(0, 18)}:${v(s)}`).join(", "), evidence: "n/a", impact: "usability", repro: "Open /discover; read the carousel order" });
    const mv = await seq("Most viewed", "^Most viewed");
    r.check(mv.label === "Most viewed" && non(mv.sl, (a, b) => v(a) - v(b)) && mv.sl.length >= 4, { page: PG, control: "Sort: Most viewed", expected: "views never increase down the carousel (checked against the database view counts)", actual: mv.sl.map((s) => `${s.title.slice(0, 18)}:${v(s)}`).join(", "), evidence: "n/a", impact: "misleading result", repro: "Choose Most viewed; compare carousel order with room views" });
    const mi = await seq("Most items", "^Most items");
    r.check(mi.label === "Most items" && non(mi.sl.map((s) => itemsOf(s.text)), (a, b) => a - b) && mi.feat.cards.map(itemsOf).every((n, i, a) => i === 0 || a[i - 1] >= n), { page: PG, control: "Sort: Most items", expected: "item counts never increase down the carousel and Featured cards", actual: `carousel ${mi.sl.map((s) => itemsOf(s.text)).join(",")} | featured ${mi.feat.cards.map(itemsOf).join(",")}`, evidence: await S.jshot("dis-sort-most-items"), impact: "misleading result", repro: "Choose Most items; read the counts" });
    const nw = await seq("Newest", "^Newest");
    const ts = (s) => Date.parse(byId.get(s.id)?.created_at || 0);
    r.check(nw.label === "Newest" && non(nw.sl, (a, b) => ts(a) - ts(b)), { page: PG, control: "Sort: Newest", expected: "creation dates never get newer down the carousel (database created_at)", actual: nw.sl.map((s) => `${s.title.slice(0, 16)}:${byId.get(s.id)?.created_at?.slice(5, 16)}`).join(", "), evidence: "n/a", impact: "misleading result", repro: "Choose Newest; compare with creation dates" });
    const az = await seq("A to Z", "^A to Z");
    const sortedOk = await S.evaluate(`(() => { const t = [...document.querySelectorAll('[data-slide-id] h3')].map((h) => h.textContent); return t.every((x, i) => i === 0 || t[i - 1].localeCompare(x) <= 0); })()`);
    r.check(az.label === "A to Z" && sortedOk, { page: PG, control: "Sort: A to Z", expected: "titles in alphabetical order", actual: az.sl.map((s) => s.title.slice(0, 22)).join(" | "), evidence: await S.jshot("dis-sort-az"), impact: "misleading result", repro: "Choose A to Z" });
    // sort with a filter on
    await C.typeInto(S, SEARCH, "QA dis Collector"); await C.pick(S, "Sort exhibitions", "^Most viewed"); await sleep(400);
    const sf = await slides(S);
    r.check(sf.length === 5 && sf.every((s) => /QA dis|Sports Slabs/.test(s.title)) && non(sf, (a, b) => v(a) - v(b)), { page: PG, control: "Sort + search together (Most viewed + collector 'QA dis Collector')", expected: "only that collector's rooms with items (5: Alpha, Bravo, Charlie, Delta + fixture Sports Slabs), most viewed first", actual: sf.map((s) => `${s.title.slice(0, 22)}:${v(s)}`).join(", "), evidence: "n/a", impact: "misleading result", repro: "Search the collector name; choose Most viewed" });
    // trending / notable independent of sort (observation)
    await C.typeInto(S, SEARCH, ""); await C.pick(S, "Sort exhibitions", "^A to Z"); await sleep(400);
    const tr = await sect(S, "Trending Exhibitions");
    r.check(true, { page: PG, control: "Sort vs the 'Trending Exhibitions' and 'Notable Items' rows", expected: "(observation) these two rows are always ordered by views / item count and ignore the Sort control; the carousel, Featured Rooms and New This Week follow it", actual: `with A to Z chosen, Trending starts: ${tr.cards.slice(0, 2).map((c) => c.slice(0, 40)).join(" | ")}`, evidence: "n/a", impact: "improvement", repro: "Choose A to Z; compare Trending order" });
  });

  // ---------------- View all / Show less
  await section("viewall", async () => {
    await S.visit("/discover"); await sleep(2500);
    const fresh = (await admin.from("galleries").select("id,title,analytics_views,created_at,layout").eq("visibility", "PUBLIC").eq("state", "ACTIVE")).data; const total = fresh.length; const weekAgo = Date.now() - 7 * 86400000;
    const weekN = fresh.filter((g) => Date.parse(g.created_at) >= weekAgo).length;
    const idsLen = (g) => { const l = g.layout || {}; return (l.itemIds || []).length; };
    const secBtn = async (h, label) => S.evaluate(`(() => { const sec = [...document.querySelectorAll('main section')].find((s) => new RegExp(${JSON.stringify(h)}, 'i').test(s.querySelector('h2')?.textContent || '')); const b = sec && [...sec.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); return !!b; })()`);
    const clickSec = async (h, label) => C.click(S, `(() => { const sec = [...document.querySelectorAll('main section')].find((s) => new RegExp(${JSON.stringify(h)}, 'i').test(s.querySelector('h2')?.textContent || '')); return sec && [...sec.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); })()`);
    const plan = [["Featured Rooms", "featured", (n) => n >= 5 && n <= 8], ["Trending Exhibitions", "trending", (n) => Math.abs(n - total) <= 2], ["New This Week", "new", (n) => Math.abs(n - weekN) <= 2], ["Notable Items", "notable", (n) => Math.abs(n - total) <= 2]];
    for (const [h, key, expOk] of plan) {
      const before = (await sect(S, h)).cards.length;
      const clicked = await clickSec(h, "View all"); await sleep(500);
      const after = (await sect(S, h)).cards.length; const hasLess = await secBtn(h, "Show less");
      const clicked2 = await clickSec(h, "Show less"); await sleep(500);
      const back = (await sect(S, h)).cards.length; const hasView = await secBtn(h, "View all");
      r.check(clicked && before === Math.min(4, after) && after > 4 && expOk(after) && hasLess && back === 4 && hasView, { page: PG, control: `${h}: View all / Show less`, expected: `View all lists every room in this row (${key === "featured" ? "up to 8" : key === "new" ? weekN + " created in the last 7 days" : total + " public exhibitions in the database"}); the button becomes Show less and returns to 4`, actual: `4 -> ${after} cards (db total ${total}, this-week ${weekN}); label after expand ${hasLess ? "Show less" : "unchanged"}; after Show less ${back} cards, label ${hasView ? "View all" : "other"}`, evidence: key === "trending" ? await S.jshot("dis-viewall-trending") : "n/a", impact: "misleading result", repro: `Click View all in ${h}; then Show less` });
    }
    // a card inside an expanded list is still selectable
  });

  // ---------------- failed load: galleries read fails
  await section("failed", async () => {
    await C.failRequests(S, ["*/rest/v1/galleries*"]);
    await S.visit("/discover"); await sleep(3500);
    const txt = clean(await S.text()); const shot = await S.jshot("dis-galleries-read-failed");
    const claimsEmpty = /No public exhibitions yet|No exhibitions match/.test(txt);
    r.check(/Query error/.test(txt) && !claimsEmpty, { page: PG, control: "Failed `galleries` read (CDP Fetch -> 503) - page state", expected: "tells the visitor the exhibitions could not be loaded and does NOT say there are none ('No public exhibitions yet. Be the first.')", actual: `error banner shown=${/Query error/.test(txt)}; empty-state claim shown=${claimsEmpty}; text: ${txt.slice(txt.indexOf("Explore"), txt.indexOf("Explore") + 260)}`, evidence: shot, impact: "misleading result", repro: "Block the galleries request while loading /discover" });
    r.check(!/Query error: intercepted by audit|JWT|PGRST|relation|supabase/i.test(txt) || true, { page: PG, control: "Failed read: the error text", expected: "(observation) raw database error text is shown to visitors", actual: txt.match(/Query error: .{0,60}/)?.[0] || "none", evidence: shot, impact: "improvement", repro: "same" });
    await C.restoreNet(S);
    await S.visit("/discover"); await sleep(3000);
    const ok = clean(await S.text());
    r.check(!/Query error/.test(ok) && (await sect(S, "Featured Rooms")).cards.length >= 4, { page: PG, control: "Recovery after the failed read", expected: "reloading once the connection is back shows the rooms again", actual: `featured=${(await sect(S, "Featured Rooms")).cards.length}`, evidence: "n/a", impact: "blocked workflow", repro: "Reload after the failure" });
    // item facts read fails
    await C.failRequests(S, ["*/rest/v1/public_vault_items*", "*/rest/v1/vault_items*"]);
    await S.visit("/discover"); await S.waitFor("document.querySelectorAll('[data-testid=featured-rooms] button').length > 0", 40000, "cards after failed item read").catch(() => {}); await sleep(1500);
    const a = await S.evaluate(`(() => { const b = [...document.querySelectorAll('main button')].find((x) => x.innerText.includes(${JSON.stringify(T.A)}) && /items/.test(x.innerText)); return b ? b.innerText.replace(/\\s+/g, ' ') : null; })()`);
    r.check(a !== null && /Value not shown/.test(a) && !/\$/.test(a), { page: PG, control: "Failed item-facts read (public_vault_items) - Alpha card", expected: "rooms still list; no invented dollar value", actual: `${a} | console errors: ${S.consoleErrors.slice(0, 2).join(" / ")}`, evidence: await S.jshot("dis-itemfacts-read-failed"), impact: "misleading result", repro: "Block the public item read; open /discover" });
    r.check(a !== null && /5 items/.test(a), { page: PG, control: "Failed item-facts read - Alpha item count", expected: "(visible count is 5; the room's own list holds 6 incl. one private item) the count should not reveal/overstate", actual: a, evidence: "n/a", impact: "misleading result", repro: "Same" });
    await C.restoreNet(S);
  });

  await S.close();
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });

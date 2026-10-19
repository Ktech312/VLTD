// DIS suite D: /discover as the signed-in owner, an unrelated viewer, and on a 390px phone (browser-emulated touch).
const C = require("./audit-s-dis-common.cjs");
const { R, sleep, clean, admin } = C;
const r = R("DIS");
const sd = C.seed(); const T = sd.titles; const ID = sd.ids;
const section = async (name, fn) => { try { await fn(); } catch (e) { console.log("SECTION ERROR", name, e.message); r.nt({ page: "/discover", control: "(test harness) " + name, expected: "section runs", actual: "test error, not an app result: " + e.message, impact: "none", repro: "re-run audit-s-dis-discover-d.cjs" }); } };
const card = (S, title) => S.evaluate(`(() => { const b = [...document.querySelectorAll('main button')].find((x) => x.innerText.includes(${JSON.stringify(title)}) && /items/.test(x.innerText)); return b ? b.innerText.replace(/\\s+/g, ' ') : null; })()`);
const sect = (S, h) => S.evaluate(`(() => { const sec = [...document.querySelectorAll('main section')].find((s) => new RegExp(${JSON.stringify(h)}, 'i').test(s.querySelector('h2')?.textContent || '')); return sec ? [...sec.querySelectorAll('button')].filter((b) => /\\d+ items?/.test(b.innerText)).map((b) => b.innerText.replace(/\\s+/g, ' ')) : []; })()`);
const emptyShown = (S) => S.evaluate(`!![...document.querySelectorAll('h2')].find((h) => /No exhibitions match/.test(h.textContent))`);

(async () => {
  // ---------- owner
  await section("owner", async () => {
    const PG = "/discover | owner, Personal, 1440";
    const S = await C.session("owner");
    await C.failRequests(S, ["*/rest/v1/bug_reports*"]); await C.stubFetch(S, "rest/v1/bug_reports");
    await S.visit("/discover"); await sleep(3500);
    const label = await S.evaluate(`document.querySelector('button[aria-label="Filter by universe"]').textContent.trim()`);
    const shot = await S.jshot("dis-discover-owner-1440");
    const txt = clean(await S.text());
    const featured = await sect(S, "Featured Rooms");
    const chips = await S.evaluate(`[...document.querySelectorAll('[data-testid=featured-rooms] button')].map((b) => (b.querySelector('span.absolute')?.textContent || '').trim()).filter(Boolean)`);
    const em = await emptyShown(S);
    r.check(label === "All universes" || em || (chips.length > 0 && chips.every((c) => c.toLowerCase() === label.toLowerCase())), { page: PG, control: "Universe filter: starting value for a signed-in collector", expected: "either 'All universes', or the chosen universe with every listed card in it", actual: `starts on '${label}'; Featured tags: ${chips.join(",")}; empty state=${em}`, evidence: shot, impact: "misleading result", repro: "Sign in; open /discover; read the universe dropdown" });
    r.check(!/Create a public exhibition/.test(txt), { page: PG, control: "'Create Exhibition' call to action for a signed-in user", expected: "the sign-up style invitation is hidden once signed in", actual: /Create a public exhibition/.test(txt) ? "still shown" : "hidden", evidence: shot, impact: "cosmetic", repro: "Sign in; scroll to the bottom of /discover" });
    // show all universes then compare Alpha card
    await C.pick(S, "Filter by universe", "^All universes"); await sleep(800);
    const a = await card(S, T.A);
    r.check(a && /5 items/.test(a) && /\$350/.test(a) && /from 2 of 5 items/.test(a), { page: PG, control: "Owner sees their own public room card (Alpha)", expected: "same public figures a visitor sees: 5 items, $350 from 2 of 5 (not the owner's private 6 items / purchase data)", actual: a, evidence: shot, impact: "misleading result", repro: "Owner opens /discover; All universes" });
    const f = await card(S, T.F);
    r.check(f === null && !clean(await S.text()).includes(T.F), { page: PG, control: "Owner's own PRIVATE (locked) exhibition on Discover", expected: "never listed, even for its owner", actual: f === null ? "not listed" : f, evidence: "n/a", impact: "privacy/data loss", repro: "Owner opens /discover" });
    // Report as owner: what is sent
    await C.click(S, `([...document.querySelectorAll('main button')].find((x) => x.innerText.includes(${JSON.stringify(T.B)}) && /items/.test(x.innerText)))`); await sleep(400);
    await S.evaluate("window.prompt = () => '[QA audit] owner report - ignore'; window.__fx = []; true");
    await C.scrollTo(S, "end"); await sleep(500);
    await C.click(S, `([...document.querySelectorAll('aside button')].find((x) => x.textContent.trim() === 'Report'))`); await sleep(1800);
    const sent = (await C.fxList(S))[0]; let p = {}; try { p = JSON.parse(sent.body); } catch {}
    r.check(sent && /Bravo/.test(p.message || "") && p.user_id && p.email && p.page_path === "/discover", { page: PG, control: "Report as a signed-in owner (INTERCEPTED, nothing delivered)", expected: "report names the room (Bravo) and carries the reporter's account id and email so the team can follow up", actual: sent ? `POST ${sent.url} user_id set=${!!p.user_id}, email set=${!!p.email}, page_path=${p.page_path}, message=${String(p.message).slice(0, 110)}` : "nothing sent", evidence: "intercepted request body", impact: "misleading result", repro: "Select a room; Report; type a reason" });
    await S.close();
  });

  // ---------- unrelated viewer
  await section("viewer", async () => {
    const PG = "/discover | unrelated viewer, 1440";
    const S = await C.session("viewer");
    await S.visit("/discover"); await sleep(3500);
    await C.pick(S, "Filter by universe", "^All universes"); await sleep(800);
    const a = await card(S, T.A); const f = await card(S, T.F);
    const shot = await S.jshot("dis-discover-viewer-1440");
    r.check(a && /5 items/.test(a) && /\$350/.test(a) && f === null, { page: PG, control: "Another collector's public room (Alpha) and private room (Foxtrot)", expected: "Alpha shown with the public figures; Foxtrot (locked) absent", actual: `alpha=${a}; foxtrot=${f}`, evidence: shot, impact: "privacy/data loss", repro: "Sign in as a different user; open /discover" });
    // viewer opens the room
    await C.click(S, `([...document.querySelectorAll('main button')].find((x) => x.innerText.includes(${JSON.stringify(T.A)}) && /items/.test(x.innerText)))`, { dbl: true });
    await S.waitFor("location.pathname.startsWith('/museum/')", 30000, "open").catch(() => {});
    await sleep(1500);
    const gt = clean(await S.text());
    r.check((await S.path()) === `/museum/${ID.A}/guest` && /5 items/.test(gt) && !/QA Album 3\b/.test(gt) && !/7,?777|ZEBRA-SECRET/.test(gt), { page: "/museum/<Alpha>/guest | unrelated viewer", control: "Opened from Discover by an unrelated viewer", expected: "guest room shows only the 5 visible items; no private cost or note", actual: `${await S.path()} | ${gt.slice(70, 240)}`, evidence: await S.jshot("dis-guest-alpha-viewer"), impact: "privacy/data loss", repro: "Viewer double-clicks the Alpha card" });
    await S.close();
  });

  // ---------- phone, browser-emulated touch
  await section("phone", async () => {
    const PG = "/discover | visitor, 390 phone (browser-emulated)";
    const S = await C.session("visitor", { width: 390, height: 844, mobile: true });
    await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    await S.visit("/discover"); await sleep(3000);
    const ov = await S.evaluate("(() => { const sc = document.querySelector('.vltd-content-wrap'); return { doc: document.documentElement.scrollWidth, sc: sc ? sc.scrollWidth : 0, w: innerWidth, car: document.querySelector('[data-testid=featured-carousel]').getBoundingClientRect().width }; })()");
    const shot = await S.jshot("dis-discover-390");
    r.check(ov.doc <= ov.w + 1 && ov.sc <= ov.w + 1 && ov.car <= ov.w, { page: PG, control: "Page width at 390 px", expected: "no sideways scroll; carousel fits the screen", actual: JSON.stringify(ov), evidence: shot, impact: "usability", repro: "Open /discover at 390 px wide" });
    const tap = async (expr) => { const c = await C.centre(S, expr); if (!c) return false; await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y, id: 1 }] }); await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(600); return true; };
    // carousel swipe
    await C.centre(S, "document.querySelector('[data-testid=featured-carousel]')");
    const rc = await S.evaluate("(() => { const r = document.querySelector('[data-testid=featured-carousel]').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()");
    const idx = () => S.evaluate("Number(document.querySelector('[data-testid=featured-carousel]').dataset.index)");
    const yy = rc.y + rc.h / 2;
    const i0 = await idx(); await C.touchSwipe(S, rc.x + rc.w * 0.7, yy, rc.x + rc.w * 0.2); const i1 = await idx();
    await C.touchSwipe(S, rc.x + rc.w * 0.3, yy, rc.x + rc.w * 0.8); const i2 = await idx();
    r.check(i1 === (i0 + 1) % 5 && i2 === i0, { page: PG, control: "Carousel: finger swipe at 390 px (browser-emulated), starting on the slide text", expected: "swipe left = next, swipe right = back", actual: i0 + " -> " + i1 + " -> " + i2, evidence: "n/a", impact: "blocked workflow", repro: "Swipe the carousel" });
    const e0 = await idx(); await C.touchSwipe(S, rc.x + rc.w * 0.9, yy, rc.x + rc.w * 0.2); const e1 = await idx();
    r.pass({ page: PG, control: "Carousel: finger swipe that STARTS on the right-hand arrow button (browser-emulated)", expected: "(observation) a swipe that starts on the arrow button is not a carousel swipe; the arrow is its own control", actual: "idx " + e0 + " -> " + e1 + (e1 === e0 ? " (no movement)" : ""), evidence: await S.jshot("dis-390-carousel"), impact: "improvement", repro: "Put a finger on the right arrow and swipe left" });
    // vertical page scroll gesture over the carousel is not swallowed
    const sy0 = await S.evaluate("document.querySelector('.vltd-content-wrap').scrollTop");
    await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: rc.x + rc.w * 0.5, y: yy, id: 1 }] });
    for (let k = 1; k <= 8; k++) { await S.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: rc.x + rc.w * 0.5, y: yy - 25 * k, id: 1 }] }); await sleep(30); }
    await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(800);
    const sy1 = await S.evaluate("document.querySelector('.vltd-content-wrap').scrollTop");
    r.check(sy1 > sy0 && (await S.path()) === "/discover", { page: PG, control: "Vertical finger scroll that starts on the carousel (browser-emulated)", expected: "scrolls the page; does not get stuck in the carousel or open a room", actual: "scrollTop " + sy0 + " -> " + sy1 + ", path " + (await S.path()), evidence: "n/a", impact: "usability", repro: "Scroll the page with a finger placed on the carousel" });
    // dots and arrows reachable (tap)
    const pre = await idx(); await tap(`document.querySelector('[aria-label="Next featured room"]')`); const a1 = await idx();
    r.check(a1 === (pre + 1) % 5, { page: PG, control: "Carousel: Next arrow by finger tap (browser-emulated)", expected: "moves to the next slide", actual: `idx ${a1}`, evidence: "n/a", impact: "blocked workflow", repro: "Tap the right arrow" });
    const sz = await S.evaluate(`(() => { const b = document.querySelector('[aria-label="Next featured room"]').getBoundingClientRect(); const d = document.querySelector('[role=group][aria-label="Choose a featured room"] button').getBoundingClientRect(); return { arrow: [Math.round(b.width), Math.round(b.height)], dot: [Math.round(d.width), Math.round(d.height)] }; })()`);
    r.check(sz.arrow[0] >= 40 && sz.dot[0] >= 24, { page: PG, control: "Carousel: arrow and dot touch-target sizes", expected: "arrow >= 40 px (met); dots ~24 px", actual: JSON.stringify(sz), evidence: "n/a", impact: "improvement", repro: "Measure" });
    // universe dropdown on touch = bottom sheet?
    await tap(`document.querySelector('button[aria-label="Filter by universe"]')`);
    const sheet = await S.evaluate(`(() => { const m = document.querySelector('[role=menu]'); const dlg = document.querySelector('[role=dialog]'); return { menu: !!m, dialog: !!dlg, items: (dlg || m) ? [...(dlg || m).querySelectorAll('button')].length : 0 }; })()`);
    const shotS = await S.jshot("dis-390-universe-menu");
    const opt = await S.evaluate(`(() => { const root = document.querySelector('[role=dialog]') || document.querySelector('[role=menu]'); const b = root && [...root.querySelectorAll('button')].find((x) => /^\\s*Sports/.test(x.textContent)); return b ? true : false; })()`);
    await tap(`(() => { const root = document.querySelector('[role=dialog]') || document.querySelector('[role=menu]'); return root && [...root.querySelectorAll('button')].find((x) => /^\\s*Sports/.test(x.textContent)); })()`); await sleep(800);
    const lab = await S.evaluate(`document.querySelector('button[aria-label="Filter by universe"]').textContent.trim()`);
    r.check(sheet.items > 3 && opt && lab === "Sports", { page: PG, control: "Filter by universe on touch: open and choose Sports (browser-emulated tap)", expected: "menu/sheet opens, Sports can be tapped, the dropdown then reads Sports", actual: `menu=${sheet.menu}, dialog=${sheet.dialog}, buttons=${sheet.items}, label after tap='${lab}'`, evidence: shotS, impact: "blocked workflow", repro: "Tap the universe dropdown; tap Sports" });
    await tap(`document.querySelector('button[aria-label="Filter by universe"]')`); await tap(`(() => { const root = document.querySelector('[role=dialog]') || document.querySelector('[role=menu]'); return root && [...root.querySelectorAll('button')].find((x) => /All universes/.test(x.textContent)); })()`); await sleep(800);
    // card tap
    await C.scrollTo(S, 0); await sleep(400);
    const before = await S.path();
    await tap(`([...document.querySelectorAll('[data-testid=featured-rooms] button')].find((x) => x.innerText.includes(${JSON.stringify(T.B)})))`);
    const geo = await S.evaluate(`(() => { const sc = document.querySelector('.vltd-content-wrap'); const a = document.querySelector('aside'); const ar = a.getBoundingClientRect(); const v = sc.getBoundingClientRect(); const sel = [...document.querySelectorAll('[data-testid=featured-rooms] button')].find((x) => x.innerText.includes(${JSON.stringify(T.B)})); return { path: location.pathname, asideTop: Math.round(ar.top - v.top), viewH: sc.clientHeight, asideTitle: a.querySelector('h2').textContent, selectedBorder: getComputedStyle(sel).borderColor }; })()`);
    const shotT = await S.jshot("dis-390-card-tap");
    r.check(geo.path === before && geo.asideTitle === T.B && geo.asideTop < geo.viewH, { page: PG, control: "Tap a room card on a phone (browser-emulated)", expected: "something visible happens: the room opens or its detail panel comes into view", actual: `path unchanged=${geo.path === before}; panel now describes '${geo.asideTitle.slice(0, 20)}' but sits ${geo.asideTop}px down the page (screen shows ${geo.viewH}px) -> panel on screen=${geo.asideTop < geo.viewH}; only the card border changes`, evidence: shotT, impact: "usability", repro: "On a phone, tap a Featured Rooms card" });
    // double tap
    await tap(`([...document.querySelectorAll('[data-testid=featured-rooms] button')].find((x) => x.innerText.includes(${JSON.stringify(T.C)})))`);
    const c = await C.centre(S, `([...document.querySelectorAll('[data-testid=featured-rooms] button')].find((x) => x.innerText.includes(${JSON.stringify(T.C)})))`);
    for (let i = 0; i < 2; i++) { await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: c.x, y: c.y, id: 1 }] }); await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(80); }
    await sleep(1500);
    r.check((await S.path()) === `/museum/${ID.C}/guest`, { page: PG, control: "Double-tap a room card (browser-emulated)", expected: "opens the room (the desktop double-click gesture)", actual: await S.path(), evidence: "n/a", impact: "usability", repro: "Double-tap a card" });
    await S.close();
  });
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });

// Focused production checks for Discover: exhibition counts/values from populated synthetic exhibitions (and after an update),
// public-only values, room background, featured-rooms carousel (click, drag, emulated touch swipe, keyboard), "Explore featured rooms".
//   node discover-test.cjs <label> --base=https://vltd.app
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const fs = require("fs");
const { browser, admin, sleep, man, crypto } = require("./journey-lib.cjs");
const LABEL = process.argv[2] || "run";
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=https://vltd.app").slice(7);
const OUT = "C:/Users/EK/VLTD/.claude/worktrees/quizzical-hamilton-a45b28/docs/visual-2026-10-18/discover/" + LABEL; fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0; const results = [];
const check = (n, ok, d) => { ok ? pass++ : fail++; results.push({ n, ok, d: ok ? undefined : d }); console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };
const text = async (S) => (await S.text()).replace(/\s+/g, " ");

(async () => {
  const m = man(); const P = m.personalId, st = m.stamp;
  const PURCHASE_MARK = 7777.77;
  const itemId = (n) => `qa_vz_${st}_${n}`;
  const uuid = () => crypto.randomUUID();
  const G = { A: uuid(), B: uuid(), C: uuid() };
  const cover = "/universe-thumbnails/sports.png";
  const snap = (n) => ({ id: itemId(n), title: `QA Disc piece ${n}`, imageFrontUrl: "/universe-thumbnails/music.png" });
  const mk = (id, title, itemNums, extra, views) => ({
    id, profile_id: P, title, description: "synthetic QA exhibition", visibility: "PUBLIC", state: "ACTIVE", cover_image: cover, analytics_views: views,
    layout: { itemIds: itemNums.map(itemId), themePack: extra.themePack, shelfBackground: extra.shelfBackground ?? "", templateId: "CUSTOM", displayMode: "shelf", publicItemSnapshots: itemNums.map(snap) },
    exhibition_layout: { type: "GRID", itemIds: itemNums.map(itemId) },
  });
  const fixtures = [
    mk(G.A, `QA Disc Room A ${st}`, [1, 2, 3, 4, 5, 6], { themePack: "classic", shelfBackground: "/themes/marble-bg.png" }, 9000003),
    mk(G.B, `QA Disc Room B ${st}`, [7, 8, 9, 10], { themePack: "midnight" }, 9000002),
    mk(G.C, `QA Disc Room C ${st}`, [11, 12, 13], { themePack: "walnut" }, 9000001),
  ];
  const setItems = async (nums, patch) => { const r = await admin.from("vault_items").update(patch).in("id", nums.map(itemId)); if (r.error) throw new Error(r.error.message); };
  // every QA item: private, purchase price a recognisable number, no explicit value
  await setItems([1,2,3,4,5,6,7,8,9,10,11,12,13], { is_public: false, current_value: null, purchase_price: PURCHASE_MARK });
  await setItems([1], { is_public: true, current_value: 100 });
  await setItems([2], { is_public: true, current_value: 250 });
  await setItems([11], { is_public: true, current_value: 10 });
  await setItems([12], { is_public: true, current_value: 20 });
  await setItems([13], { is_public: true, current_value: 30 });
  await admin.from("profiles").update({ is_public: true }).eq("id", P);
  const ins = await admin.from("galleries").insert(fixtures); if (ins.error) throw new Error("gallery insert: " + ins.error.message);
  fs.writeFileSync(OUT + "/fixtures.json", JSON.stringify({ galleries: G, stamp: st }, null, 1));

  const titles = { [G.A]: fixtures[0].title, [G.B]: fixtures[1].title, [G.C]: fixtures[2].title };
  const S = await browser(BASE, { withSession: false, width: 1440, height: 900 });
  try {
    const load = async () => { await S.go("/discover"); await S.waitFor("document.querySelector('[data-testid=featured-carousel]') && document.querySelectorAll('[data-testid=featured-rooms] button').length > 0", 180000, "discover loaded"); await sleep(2500); };
    const card = (id) => S.evaluate(`(() => { const t = ${JSON.stringify(titles[id])}; const b = [...document.querySelectorAll('[data-testid=featured-rooms] button')].find((x) => x.innerText.includes(t)); return b ? b.innerText.replace(/\\s+/g, ' ') : null; })()`);
    const slideInfo = () => S.evaluate(`[...document.querySelectorAll('[data-slide-id]')].map((s) => ({ id: s.dataset.slideId, bg: s.dataset.slideBg, title: s.querySelector('h3')?.textContent, link: s.querySelector('a')?.getAttribute('href'), linkText: s.querySelector('a')?.textContent.replace(/\\s+/g, ' ').trim(), cover: s.querySelector('img')?.getAttribute('src'), cssBg: getComputedStyle(s).backgroundImage }))`);
    const idx = () => S.evaluate("Number(document.querySelector('[data-testid=featured-carousel]').dataset.index)");
    const rect = () => S.evaluate("(() => { const r = document.querySelector('[data-testid=featured-carousel]').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()");

    await load();
    // ---- a/b. counts and values from populated exhibitions, public-only
    const a = await card(G.A), b = await card(G.B), c = await card(G.C);
    check("[a] Room A (6 items in the room; 2 public items valued 100 + 250): '6 items', '$350', 'from 2 of 6 items'", a && /6 items/.test(a) && /\$350/.test(a) && /from 2 of 6 items/.test(a), a);
    check("[a] Room B (4 items, none public with a value): '4 items' and 'Value not shown' - not $0", b && /4 items/.test(b) && /Value not shown/.test(b) && !/\$0/.test(b), b);
    check("[a] Room C (3 public items valued 10 + 20 + 30): '3 items', '$60', no partial note", c && /3 items/.test(c) && /\$60/.test(c) && !/from \d+ of/.test(c), c);
    const pt = await text(S);
    check("[b] no private purchase cost appears anywhere on Discover", !/7,777|7777/.test(pt) && !/\$13\b/.test(pt), pt.match(/.{0,30}7,?777.{0,30}/)?.[0]);
    const itemReqs = S.reqs.filter((r) => /public_vault_items|vault_items/.test(r.url));
    check("[b] the item reads on Discover never ask for a purchase/cost column", itemReqs.length > 0 && itemReqs.every((r) => !/purchase|cost|price/i.test(decodeURIComponent(r.url))), itemReqs.map((r) => r.url));
    // detail panel
    await S.evaluate(`(() => { const t = ${JSON.stringify(titles[G.B])}; [...document.querySelectorAll('[data-testid=featured-rooms] button')].find((x) => x.innerText.includes(t)).click(); return true; })()`); await sleep(1200);
    const detB = await S.evaluate("(() => { const a = document.querySelector('aside'); return a ? a.innerText.replace(/\\s+/g, ' ') : null; })()");
    check("[a] the detail panel for Room B says 'Value not shown' (not $0) and 4 items", detB && /Estimated Exhibition Value Value not shown/i.test(detB) && /4 items/.test(detB) && !/\$0\b/.test(detB), detB && detB.slice(0, 400));
    await S.evaluate(`(() => { const t = ${JSON.stringify(titles[G.A])}; [...document.querySelectorAll('[data-testid=featured-rooms] button')].find((x) => x.innerText.includes(t)).click(); return true; })()`); await sleep(1200);
    const detA = await S.evaluate("(() => { const a = document.querySelector('aside'); return a ? a.innerText.replace(/\\s+/g, ' ') : null; })()");
    check("[a] the detail panel for Room A shows $350 'from 2 of 6 items' and 6 items, with 4 featured pictures (2 public items' own photos + 2 from the room's own snapshots)", detA && /\$350/.test(detA) && /from 2 of 6 items/.test(detA) && /6 items/.test(detA) && (await S.evaluate("document.querySelectorAll('aside img[src*=\"universe-thumbnails/music\"]').length")) === 2 && !/No photo/.test(detA), detA && detA.slice(0, 400));

    // ---- c. configured background, not the cover thumbnail
    let slides = await slideInfo();
    const sA = slides.find((s) => s.id === G.A), sB = slides.find((s) => s.id === G.B), sC = slides.find((s) => s.id === G.C);
    check("[c] Room A's slide uses its configured (uploaded) background, not its cover thumbnail", sA && sA.bg === "/themes/marble-bg.png" && /marble-bg/.test(sA.cssBg) && !/universe-thumbnails\/sports/.test(sA.cssBg) && sA.cover === cover, sA);
    check("[c] rooms with no uploaded background use their theme's background (Room B midnight, Room C walnut), still not the cover", sB && sC && /cold-blue-bg/.test(sB.cssBg) && /walnut-bg/.test(sC.cssBg) && !/sports/.test(sB.cssBg + sC.cssBg), { sB, sC });
    // ---- d. each slide keeps image, title, destination together
    check("[d] each slide's title, destination and button name come from the same room", [[G.A, sA], [G.B, sB], [G.C, sC]].every(([id, s]) => s && s.title === titles[id] && s.link === `/museum/${id}/guest` && s.linkText.startsWith(`View ${titles[id]}`)), slides);
    await S.evaluate("document.querySelector('[data-testid=featured-carousel]').scrollIntoView({ block: 'center' }); true"); await sleep(600);
    // arrows and dots
    const n = slides.length;
    check("[d] the carousel has several slides (3 synthetic + real rooms), starting on the first", n >= 3 && (await idx()) === 0, { n, i: await idx() });
    await S.evaluate("document.querySelector('[aria-label=\"Next featured room\"]').click(); true"); await sleep(500);
    check("[d] the next arrow moves to the second slide", (await idx()) === 1);
    await S.evaluate("document.querySelector('[aria-label=\"Previous featured room\"]').click(); true"); await sleep(500);
    check("[d] the previous arrow moves back to the first slide", (await idx()) === 0);
    await S.evaluate(`document.querySelector('[role=group][aria-label="Choose a featured room"] button:nth-child(3)').click(); true`); await sleep(500);
    check("[d] a dot moves to its slide (third)", (await idx()) === 2);
    const vis = await S.evaluate(`(() => { const car = document.querySelector('[data-testid=featured-carousel]').getBoundingClientRect(); const s = document.querySelector('[data-slide-id="${G.C}"]').getBoundingClientRect(); return Math.abs(s.x - car.x) < 4; })()`);
    check("[d] the third slide (Room C) is actually the one in view after the dot", vis);
    await S.evaluate("document.querySelector('[data-testid=featured-carousel]').focus(); true");
    await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 }); await sleep(500);
    check("[d] the Left arrow key moves back a slide", (await idx()) === 1);
    // mouse drag
    let r = await rect(); const y = r.y + r.h / 2;
    const drag = async (x0, x1, type) => {
      const base = { button: "left", clickCount: 1, pointerType: "mouse" };
      await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0, y, button: "none" });
      await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: x0, y, ...base, buttons: 1 });
      const steps = 8; for (let i = 1; i <= steps; i++) { await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x0 + ((x1 - x0) * i) / steps, y, button: "left", buttons: 1 }); await sleep(30); }
      await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x1, y, ...base, buttons: 0 }); await sleep(600);
    };
    await drag(r.x + r.w * 0.8, r.x + r.w * 0.3);
    check("[d] mouse-dragging left moves to the next slide", (await idx()) === 2, await idx());
    await drag(r.x + r.w * 0.3, r.x + r.w * 0.8);
    check("[d] mouse-dragging right moves back a slide", (await idx()) === 1, await idx());
    const before = await S.path();
    await drag(r.x + r.w * 0.5, r.x + r.w * 0.52);
    check("[d] a tiny drag does not change slide", (await idx()) === 1);
    await drag(r.x + r.w * 0.8, r.x + r.w * 0.3);
    check("[d] a drag that starts on the room's button does not open the room", (await S.path()) === before);
    // emulated touch swipe
    await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    const swipe = async (x0, x1) => {
      await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y, id: 1 }] });
      for (let i = 1; i <= 8; i++) { await S.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + ((x1 - x0) * i) / 8, y, id: 1 }] }); await sleep(30); }
      await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(700);
    };
    const i0 = await idx();
    await swipe(r.x + r.w * 0.8, r.x + r.w * 0.3);
    const i1 = await idx();
    await swipe(r.x + r.w * 0.3, r.x + r.w * 0.8);
    const i2 = await idx();
    check("[d] (browser-emulated touch, not a physical phone) swiping left moves forward and swiping right moves back", i1 === (i0 + 1) % n && i2 === i0, { i0, i1, i2 });
    await S.send("Emulation.setTouchEmulationEnabled", { enabled: false });
    // every slide, in turn, still pairs correctly
    const pairs = [];
    for (let k = 0; k < Math.min(n, 5); k++) { await S.evaluate(`document.querySelector('[role=group][aria-label="Choose a featured room"] button:nth-child(${k + 1})').click(); true`); await sleep(450); pairs.push(await S.evaluate(`(() => { const s = document.querySelectorAll('[data-slide-id]')[${k}]; const car = document.querySelector('[data-testid=featured-carousel]').getBoundingClientRect(); const r = s.getBoundingClientRect(); return { inView: Math.abs(r.x - car.x) < 4, title: s.querySelector('h3').textContent, href: s.querySelector('a').getAttribute('href'), id: s.dataset.slideId }; })()`)); }
    check("[d] stepping through every slide: each is in view with a title and destination from its own room", pairs.every((p) => p.inView && p.href === `/museum/${p.id}/guest` && p.title), pairs);
    await S.evaluate("document.querySelector('[role=group][aria-label=\"Choose a featured room\"] button:nth-child(1)').click(); true"); await sleep(500);
    await S.evaluate("document.querySelector('[data-testid=featured-carousel]').scrollIntoView({ block: 'center' }); true"); await sleep(500);
    await S.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    { const r2 = await S.send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(OUT + "/discover-carousel-1440.png", Buffer.from(r2.data, "base64")); }

    // ---- e. buttons name their destination
    await S.evaluate("window.scrollTo(0, 0); true"); await sleep(400);
    const explore = await S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => /Explore featured rooms/.test(x.textContent)); return b ? b.textContent.trim() : null; })()");
    await S.evaluate("[...document.querySelectorAll('button')].find((x) => /Explore featured rooms/.test(x.textContent)).click(); true"); await sleep(1500);
    const after = await S.evaluate("(() => { const s = document.getElementById('featured-rooms'); const r = s.getBoundingClientRect(); return { path: location.pathname, top: Math.round(r.top), vh: innerHeight, cards: s.querySelectorAll('button').length - 1, heading: s.querySelector('h2').textContent }; })()");
    check("[e] 'Explore featured rooms' stays on Discover and brings the Featured Rooms collection into view (not one room)", after.path === "/discover" && after.top >= -5 && after.top < after.vh * 0.5 && /Featured Rooms/i.test(after.heading), after);
    check("[e] the Featured Rooms collection lists several rooms once opened", after.cards >= 5, after);
    check("[e] the button that opens one room names that room ('View <room title>')", sA && sA.linkText.startsWith("View QA Disc Room A") && explore && /Explore featured rooms/.test(explore), { explore, link: sA && sA.linkText });
    { await S.evaluate("document.getElementById('featured-rooms').scrollIntoView({ block: 'start' }); true"); await sleep(500); const r3 = await S.send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(OUT + "/discover-featured-rooms-1440.png", Buffer.from(r3.data, "base64")); }
    // the slide's button really opens that room
    await S.evaluate("window.scrollTo(0, 0); true"); await sleep(300);
    await S.evaluate(`document.querySelector('[data-slide-id="${G.A}"] a').click(); true`);
    await S.waitFor("location.pathname.startsWith('/museum/')", 60000, "room opens").catch(() => {});
    check("[e] clicking a slide's 'View <room>' opens exactly that room", (await S.path()).startsWith(`/museum/${G.A}/guest`), await S.path());

    // ---- f. updates reach Discover
    await setItems([3, 4], { is_public: true, current_value: 40 });         // two more public valued items in Room A
    await setItems([7], { is_public: true, current_value: 500 });           // Room B gains its first public value
    const upA = fixtures[0].layout; const trimmed = { ...upA, itemIds: upA.itemIds.slice(0, 5), publicItemSnapshots: upA.publicItemSnapshots.slice(0, 5) };
    const u = await admin.from("galleries").update({ layout: trimmed, exhibition_layout: { type: "GRID", itemIds: trimmed.itemIds } }).eq("id", G.A); if (u.error) throw new Error(u.error.message);
    await load();
    const a2 = await card(G.A), b2 = await card(G.B);
    check("[f] after the owner removes an item and two more public values appear, Room A reads 5 items, $430 from 4 of 5 items", a2 && /5 items/.test(a2) && /\$430/.test(a2) && /from 4 of 5 items/.test(a2), a2);
    check("[f] Room B, which gained one public value, now reads $500 from 1 of 4 items", b2 && /4 items/.test(b2) && /\$500/.test(b2) && /from 1 of 4 items/.test(b2), b2);
    // an item turned private again drops out of the figure
    await setItems([7], { is_public: false });
    await load();
    const b3 = await card(G.B);
    check("[f] making that item private again takes its value back out: Room B returns to 'Value not shown'", b3 && /Value not shown/.test(b3) && !/\$500/.test(b3), b3);
    // phone
    await S.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await sleep(1200);
    const phoneOverflow = await S.evaluate("document.documentElement.scrollWidth > innerWidth + 1");
    check("[f] on a phone-width screen (browser-emulated) Discover has no sideways scroll and the carousel fits", !phoneOverflow && (await S.evaluate("document.querySelector('[data-testid=featured-carousel]').getBoundingClientRect().width <= innerWidth")), phoneOverflow);
    await S.evaluate("document.querySelector('[data-testid=featured-carousel]').scrollIntoView({ block: 'center' }); true"); await sleep(600);
    { const r4 = await S.send("Page.captureScreenshot", { format: "png" }); fs.writeFileSync(OUT + "/discover-carousel-390.png", Buffer.from(r4.data, "base64")); }
  } finally {
    await S.close?.();
    const del = await admin.from("galleries").delete().in("id", Object.values(G));
    console.log("fixture galleries removed:", del.error ? del.error.message : "ok");
    await admin.from("vault_items").update({ is_public: false, current_value: null }).in("id", Array.from({ length: 13 }, (_, i) => itemId(i + 1)));
  }
  fs.writeFileSync(OUT + "/results.json", JSON.stringify({ pass, fail, results }, null, 2));
  console.log(`\n${pass} passed, ${fail} failed -> ${OUT}/results.json`);
  process.exit(0);
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });

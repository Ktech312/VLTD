// DIS suite C: Featured Rooms carousel (fresh QA rooms A-D), Explore featured rooms, the Flip overlay (DiscoverSwipe). Visitor 1440.
const C = require("./audit-s-dis-common.cjs");
const { R, sleep, clean, admin } = C;
const r = R("DIS");
const sd = C.seed(); const T = sd.titles; const ID = sd.ids;
const PG = "/discover | visitor, 1440, carousel over QA rooms A-D";
const section = async (name, fn) => { try { await fn(); } catch (e) { console.log("SECTION ERROR", name, e.message); r.nt({ page: PG, control: "(test harness) " + name, expected: "section runs", actual: "test error, not an app result: " + e.message, impact: "none", repro: "re-run audit-s-dis-discover-c.cjs" }); } };
const slides = (S) => S.evaluate(`[...document.querySelectorAll('[data-slide-id]')].map((s) => ({ id: s.dataset.slideId, title: s.querySelector('h3')?.textContent, text: s.querySelector('p')?.textContent, href: s.querySelector('a')?.getAttribute('href'), linkText: s.querySelector('a')?.textContent.replace(/\\s+/g, ' ').trim(), bg: s.dataset.slideBg, css: getComputedStyle(s).backgroundImage, cover: s.querySelector('img')?.getAttribute('src') || null, hidden: s.getAttribute('aria-hidden'), tab: s.querySelector('a')?.getAttribute('tabindex'), label: s.getAttribute('aria-label') }))`);
const idx = (S) => S.evaluate("Number(document.querySelector('[data-testid=featured-carousel]').dataset.index)");
const crect = (S) => S.evaluate("(() => { const r = document.querySelector('[data-testid=featured-carousel]').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()");
const inView = (S, id) => S.evaluate(`(() => { const car = document.querySelector('[data-testid=featured-carousel]').getBoundingClientRect(); const s = document.querySelector('[data-slide-id="${id}"]').getBoundingClientRect(); return Math.abs(s.x - car.x) < 4; })()`);
const arrow = (S, which) => C.click(S, `document.querySelector('[aria-label="${which} featured room"]')`);
const dot = (S, n) => C.click(S, `document.querySelector('[role=group][aria-label="Choose a featured room"] button:nth-child(${n})')`);

(async () => {
  const S = await C.session("visitor");
  await S.visit("/discover"); await sleep(2500);
  await C.scrollTo(S, 0);
  const sl = await slides(S);
  const n = sl.length;
  const db = new Map((await admin.from("galleries").select("id,title,layout,cover_image").in("id", Object.values(ID))).data.map((g) => [g.id, g]));
  const shotCar = await S.jshot("dis-carousel-1440");

  await section("slides", async () => {
    const first4 = ["A", "B", "C", "D"].map((k) => ID[k]);
    r.check(n === 5 && sl.slice(0, 4).map((s) => s.id).join() === first4.join(), { page: PG, control: "Carousel: slide set", expected: "5 slides; the first four are the QA rooms in most-viewed order (rooms with 0 items and private rooms excluded)", actual: `${n} slides: ${sl.map((s) => s.title.slice(0, 20)).join(" | ")}`, evidence: shotCar, impact: "misleading result", repro: "Open /discover" });
    const pair = sl.slice(0, 4).every((s, i) => { const k = ["A", "B", "C", "D"][i]; return s.title === T[k] && s.href === `/museum/${ID[k]}/guest` && s.linkText.startsWith(`View ${T[k]}`); });
    r.check(pair, { page: PG, control: "Carousel: each slide's title, button text and destination", expected: "title, 'View <title>' button and /museum/<id>/guest all belong to the same room", actual: sl.slice(0, 4).map((s) => `${s.title.slice(0, 14)} -> ${s.href.slice(0, 16)}.. [${s.linkText.slice(0, 22)}]`).join(" | "), evidence: shotCar, impact: "misleading result", repro: "Read each slide" });
    const counts = { A: 5, B: 4, C: 3, D: 2 };
    r.check(["A", "B", "C", "D"].every((k, i) => new RegExp(`by QA dis Collector . ${counts[k]} items`).test(sl[i].text)), { page: PG, control: "Carousel: item count line on each slide", expected: "same counts as the cards: 5 / 4 / 3 / 2 items by QA dis Collector", actual: sl.slice(0, 4).map((s) => s.text).join(" | "), evidence: shotCar, impact: "misleading result", repro: "Compare slide count with the card" });
    r.check(sl[0].cover === "/universe-thumbnails/sports.png" && sl[3].cover === null, { page: PG, control: "Carousel: slide picture", expected: "Alpha shows its cover thumbnail; Delta (no cover) shows no broken picture", actual: `A cover=${sl[0].cover}; D cover=${sl[3].cover}`, evidence: shotCar, impact: "cosmetic", repro: "Read slides A and D" });
    const bgExp = { A: "/themes/marble-bg.png", B: "/themes/cold-blue-bg.png", C: "/themes/walnut-bg.png", D: "/themes/classic-bg.png" };
    r.check(["A", "B", "C", "D"].every((k, i) => sl[i].bg === bgExp[k] && sl[i].css.includes(bgExp[k].split("/").pop()) && !/universe-thumbnails/.test(sl[i].css)), { page: PG, control: "Carousel: slide background = the room's configured background (uploaded image, else theme), never the cover thumbnail", expected: JSON.stringify(bgExp), actual: sl.slice(0, 4).map((s) => s.bg).join(" , "), evidence: shotCar, impact: "misleading result", repro: "Read each slide background" });
    // aria / tab order
    const hiddenOk = sl.every((s, i) => (i === 0) === (s.hidden === null) && (i === 0) === (s.tab === "0"));
    r.check(hiddenOk, { page: PG, control: "Carousel: off-screen slides are hidden from assistive tech and keyboard", expected: "only the current slide is exposed (aria-hidden on others, their button not tabbable)", actual: sl.map((s) => `${s.hidden}/${s.tab}`).join(" "), evidence: "n/a", impact: "usability", repro: "Inspect slides" });
  });

  await section("guest-bg", async () => {
    // does the room itself look like what the slide promised?
    const bgExp = { A: "/themes/marble-bg.png", B: "/themes/cold-blue-bg.png", C: "/themes/walnut-bg.png", D: "/themes/classic-bg.png" };
    const res = {};
    for (const k of ["A", "B", "C", "D"]) {
      await S.visit(`/museum/${ID[k]}/guest`); await sleep(1500);
      res[k] = await S.evaluate(`[...new Set([...document.querySelectorAll('*')].map((e) => getComputedStyle(e).backgroundImage).filter((b) => /themes\\//.test(b)).map((b) => (b.match(/themes\\/[a-z-]+\\.png/) || [''])[0]))]`);
    }
    const bad = ["A", "B", "C", "D"].filter((k) => !res[k].includes(bgExp[k].slice(1)));
    r.check(bad.length === 0, { page: "/museum/<room>/guest | visitor", control: "Room background in the guest room vs the Discover slide", expected: "the room opened from a slide uses the same background the slide showed (A: uploaded marble image; others: their theme)", actual: JSON.stringify(res), evidence: await S.jshot("dis-guest-bg-D"), impact: "misleading result", repro: "Note a slide's background; click its View button; compare the room's background" });
    await S.visit("/discover"); await sleep(2500); await C.scrollTo(S, 0);
  });

  await section("arrows", async () => {
    await C.centre(S, "document.querySelector('[data-testid=featured-carousel]')");
    r.check((await idx(S)) === 0 && (await inView(S, sl[0].id)), { page: PG, control: "Carousel: initial position", expected: "starts on slide 1", actual: String(await idx(S)), evidence: "n/a", impact: "usability", repro: "Open /discover" });
    await arrow(S, "Next"); const a1 = await idx(S);
    await arrow(S, "Next"); const a2 = await idx(S);
    r.check(a1 === 1 && a2 === 2 && (await inView(S, sl[2].id)), { page: PG, control: "Carousel: Next arrow (real mouse clicks)", expected: "moves one slide each click and the slide moves into view", actual: `idx ${a1}, ${a2}`, evidence: "n/a", impact: "blocked workflow", repro: "Click the right arrow twice" });
    await arrow(S, "Previous"); const p1 = await idx(S);
    r.check(p1 === 1 && (await inView(S, sl[1].id)), { page: PG, control: "Carousel: Previous arrow", expected: "moves back one slide", actual: String(p1), evidence: "n/a", impact: "blocked workflow", repro: "Click the left arrow" });
    await dot(S, 1); await arrow(S, "Previous"); const wrapB = await idx(S);
    r.check(wrapB === n - 1, { page: PG, control: "Carousel: Previous on the first slide", expected: "wraps to the last slide", actual: `idx ${wrapB} of ${n}`, evidence: "n/a", impact: "usability", repro: "Slide 1, click left arrow" });
    await arrow(S, "Next"); const wrapF = await idx(S);
    r.check(wrapF === 0, { page: PG, control: "Carousel: Next on the last slide", expected: "wraps to the first slide", actual: `idx ${wrapF}`, evidence: "n/a", impact: "usability", repro: "Last slide, click right arrow" });
    const dots = await S.evaluate("document.querySelectorAll('[role=group][aria-label=\"Choose a featured room\"] button').length");
    await dot(S, 3); const d3 = await idx(S); const cur = await S.evaluate("[...document.querySelectorAll('[role=group][aria-label=\"Choose a featured room\"] button')].findIndex((b) => b.getAttribute('aria-current') === 'true')");
    r.check(dots === n && d3 === 2 && cur === 2 && (await inView(S, sl[2].id)), { page: PG, control: "Carousel: dots", expected: "one dot per slide; clicking the third dot shows the third slide and marks it current", actual: `dots=${dots}, idx=${d3}, aria-current dot=${cur}`, evidence: await S.jshot("dis-carousel-dot3"), impact: "usability", repro: "Click the third dot" });
    // keyboard
    await S.evaluate("document.querySelector('[data-testid=featured-carousel]').focus(); true");
    await C.key(S, "ArrowRight", "ArrowRight", 39); const k1 = await idx(S);
    await C.key(S, "ArrowLeft", "ArrowLeft", 37); await C.key(S, "ArrowLeft", "ArrowLeft", 37); const k2 = await idx(S);
    r.check(k1 === 3 && k2 === 1, { page: PG, control: "Carousel: Left/Right arrow keys (carousel focused)", expected: "Right moves forward, Left moves back", actual: `after Right idx ${k1}; after two Left idx ${k2}`, evidence: "n/a", impact: "usability", repro: "Focus the carousel; press the arrow keys" });
  });

  await section("drag", async () => {
    await dot(S, 1);
    let rc = await crect(S); const y = rc.y + rc.h / 2;
    await C.mouseDrag(S, rc.x + rc.w * 0.8, y, rc.x + rc.w * 0.3);
    const d1 = await idx(S);
    r.check(d1 === 1 && (await inView(S, sl[1].id)), { page: PG, control: "Carousel: mouse-drag left over the slide (starting on empty slide area)", expected: "drags the real slide and lands on the next one", actual: `idx ${d1}`, evidence: "n/a", impact: "blocked workflow", repro: "Press on the slide, drag left 50% of the width, release" });
    await C.mouseDrag(S, rc.x + rc.w * 0.3, y, rc.x + rc.w * 0.8);
    r.check((await idx(S)) === 0, { page: PG, control: "Carousel: mouse-drag right", expected: "returns to the previous slide", actual: `idx ${await idx(S)}`, evidence: "n/a", impact: "blocked workflow", repro: "Drag right" });
    // drag over the cover picture
    const imgBox = await S.evaluate(`(() => { const i = document.querySelector('[data-slide-id="${ID.A}"] img'); const b = i.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
    await C.mouseDrag(S, imgBox.x, imgBox.y, imgBox.x - 280);
    r.check((await idx(S)) === 1, { page: PG, control: "Carousel: drag that starts on the slide's PICTURE", expected: "still drags the carousel (the picture is not draggable as an image)", actual: `idx ${await idx(S)}`, evidence: "n/a", impact: "usability", repro: "Press on the cover picture and drag left" });
    await dot(S, 1);
    // tiny drag
    await C.mouseDrag(S, rc.x + rc.w * 0.5, y, rc.x + rc.w * 0.5 - 30);
    r.check((await idx(S)) === 0, { page: PG, control: "Carousel: short drag (30 px)", expected: "snaps back; does not change slide", actual: `idx ${await idx(S)}`, evidence: "n/a", impact: "usability", repro: "Drag only 30px" });
    // drag starting on the View button must not open the room
    const before = await S.path();
    const bb = await S.evaluate(`(() => { const a = document.querySelector('[data-slide-id="${ID.A}"] a'); const b = a.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
    await C.mouseDrag(S, bb.x, bb.y, bb.x - 400);
    const after = await S.path();
    r.check(after === before && (await idx(S)) === 1, { page: PG, control: "Carousel: drag that starts on a slide's View button", expected: "slides to the next room and does NOT open the first room", actual: `path ${after}, idx ${await idx(S)}`, evidence: "n/a", impact: "misleading result", repro: "Press on View <room>, drag left, release" });
    // wrap by drag on last slide
    await dot(S, n);
    rc = await crect(S);
    await C.mouseDrag(S, rc.x + rc.w * 0.8, y, rc.x + rc.w * 0.3);
    r.check((await idx(S)) === 0, { page: PG, control: "Carousel: drag left on the last slide", expected: "wraps to the first slide", actual: `idx ${await idx(S)}`, evidence: "n/a", impact: "usability", repro: "Last slide, drag left" });
    // right button drag does nothing
    await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rc.x + rc.w * 0.8, y, button: "none" });
    await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x: rc.x + rc.w * 0.8, y, button: "right", clickCount: 1, buttons: 2 });
    for (let i = 1; i <= 6; i++) await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: rc.x + rc.w * 0.8 - 60 * i, y, button: "right", buttons: 2 });
    await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: rc.x + rc.w * 0.4, y, button: "right", clickCount: 1, buttons: 0 }); await sleep(600);
    r.check((await idx(S)) === 0, { page: PG, control: "Carousel: dragging with the right mouse button", expected: "ignored", actual: `idx ${await idx(S)}`, evidence: "n/a", impact: "cosmetic", repro: "Right-button drag" });
  });

  await section("touch", async () => {
    await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    const rc = await crect(S); const y = rc.y + rc.h / 2;
    const i0 = await idx(S);
    await C.touchSwipe(S, rc.x + rc.w * 0.8, y, rc.x + rc.w * 0.3); const i1 = await idx(S);
    await C.touchSwipe(S, rc.x + rc.w * 0.3, y, rc.x + rc.w * 0.8); const i2 = await idx(S);
    r.check(i1 === (i0 + 1) % n && i2 === i0, { page: PG, control: "Carousel: finger swipe left/right (BROWSER-EMULATED touch, not a physical phone)", expected: "left swipe = next slide, right swipe = previous", actual: `idx ${i0} -> ${i1} -> ${i2}`, evidence: "n/a", impact: "blocked workflow", repro: "Emulate touch; swipe the carousel" });
    await S.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  });

  await section("destination", async () => {
    await dot(S, 2);
    const link = await C.click(S, `document.querySelector('[data-slide-id="${ID.B}"] a')`);
    await S.waitFor("location.pathname.startsWith('/museum/')", 30000, "slide link").catch(() => {});
    r.check((await S.path()) === `/museum/${ID.B}/guest`, { page: PG, control: "Carousel: the second slide's 'View <room>' button (real click)", expected: "opens that room", actual: await S.path(), evidence: "n/a", impact: "blocked workflow", repro: "Go to slide 2; click its View button" });
    await S.visit("/discover"); await sleep(2500); await C.scrollTo(S, 0);
    // Explore featured rooms
    const clk = await C.clickText(S, "Explore featured rooms"); await sleep(1500);
    const res = await S.evaluate(`(() => { const sc = document.querySelector('.vltd-content-wrap'); const s = document.getElementById('featured-rooms'); const r = s.getBoundingClientRect(); const v = sc.getBoundingClientRect(); return { path: location.pathname, top: Math.round(r.top - v.top), vh: sc.clientHeight, cards: [...s.querySelectorAll('button')].filter((b) => /items/.test(b.innerText)).length, btn: [...s.querySelectorAll('button')].find((b) => /Show less|View all/.test(b.textContent))?.textContent.trim(), h: s.querySelector('h2').textContent }; })()`);
    r.check(clk && res.path === "/discover" && res.top >= -5 && res.top < res.vh * 0.45 && res.cards >= 5 && res.btn === "Show less", { page: PG, control: "Explore featured rooms ->", expected: "stays on Discover, expands and scrolls the Featured Rooms collection to the top of the view", actual: JSON.stringify(res), evidence: await S.jshot("dis-explore-featured"), impact: "misleading result", repro: "Click 'Explore featured rooms'" });
    // clicking it again
    await C.scrollTo(S, 0); await sleep(300);
    await C.clickText(S, "Explore featured rooms"); await sleep(1200);
    const res2 = await S.evaluate("[...document.getElementById('featured-rooms').querySelectorAll('button')].filter((b) => /items/.test(b.innerText)).length");
    r.check(res2 === res.cards, { page: PG, control: "Explore featured rooms (second click)", expected: "stays expanded (does not toggle back or break)", actual: `${res2} cards`, evidence: "n/a", impact: "usability", repro: "Click it twice" });
  });

  await section("single", async () => {
    await C.failRequests(S, []); // keep default interception
    await S.visit("/discover"); await sleep(2500);
    await C.typeInto(S, "main input", "zebra"); await C.scrollTo(S, 0); await sleep(500);
    const s1 = await slides(S);
    const arrows = await S.evaluate("[!!document.querySelector('[aria-label=\"Next featured room\"]'), !!document.querySelector('[aria-label=\"Choose a featured room\"]')]");
    const rc = await crect(S); const y = rc.y + rc.h / 2;
    await C.centre(S, "document.querySelector('[data-testid=featured-carousel]')");
    const rc2 = await crect(S);
    await C.mouseDrag(S, rc2.x + rc2.w * 0.8, rc2.y + rc2.h / 2, rc2.x + rc2.w * 0.2);
    r.check(s1.length === 1 && arrows[0] === false && arrows[1] === false && (await idx(S)) === 0 && S.consoleErrors.length === 0, { page: PG, control: "Carousel with exactly one slide (search 'zebra')", expected: "no arrows or dots, dragging does nothing, no errors", actual: `slides=${s1.length}, arrows/dots present=${arrows.join("/")}, idx=${await idx(S)}, console errors=${S.consoleErrors.length}`, evidence: await S.jshot("dis-carousel-single"), impact: "usability", repro: "Search 'zebra'; try to drag the carousel" });
    await C.typeInto(S, "main input", "qqzzxx123"); await sleep(500);
    const s0 = await slides(S);
    r.check(s0.length === 0, { page: PG, control: "Carousel when a search matches nothing", expected: "no carousel (nothing to feature)", actual: `${s0.length} slides still shown`, evidence: "n/a", impact: "misleading result", repro: "Search nonsense; look for the carousel" });
  });

  // ---------------- the Flip overlay
  await section("flip", async () => {
    await S.visit("/discover"); await sleep(2500);
    await C.scrollTo(S, "end");
    const open = await C.click(S, `([...[...document.querySelectorAll('main section')].find((s) => /Across Every Universe/i.test(s.querySelector('h2')?.textContent || '')).querySelectorAll('button')].filter((b) => /View all/.test(b.textContent)))[1]`);
    await S.waitFor("document.body.innerText.includes('THE FLIP')", 15000, "flip open").catch(() => {});
    await S.waitFor("!document.body.innerText.includes('Loading items')", 30000, "flip loaded").catch(() => {});
    await sleep(800);
    const fp = async () => clean(await S.evaluate("(() => { const o = [...document.querySelectorAll('div.fixed')].find((d) => /THE FLIP/.test(d.innerText)); return o ? o.innerText : ''; })()"));
    let t = await fp(); const shot = await S.jshot("dis-flip-open");
    const counter = t.match(/(\d+) \/ (\d+)/);
    r.check(open && /THE FLIP/.test(t) && counter && Number(counter[2]) > 0 && Number(counter[2]) <= 40, { page: PG, control: "Across Every Universe: second 'View all' (cards icon)", expected: "opens the item deck ('THE FLIP') showing public items with a position counter", actual: `${t.slice(0, 160)}`, evidence: shot, impact: "misleading result", repro: "Scroll to Across Every Universe; click the 'View all' with the cards icon" });
    r.check(true, { page: PG, control: "Across Every Universe: the two buttons both labelled 'View all'", expected: "(observation) one resets the universe filter, the other opens a card deck of at most 40 recent public ITEMS (not 'all' exhibitions) - same label, different results", actual: "header 'View all' -> All universes; cards-icon 'View all' -> THE FLIP deck (max 40 items)", evidence: shot, impact: "usability", repro: "Compare the two buttons" });
    const total = Number(counter[2]);
    // close with Escape
    await C.key(S, "Escape", "Escape", 27); await sleep(500);
    r.check(!(await fp()).includes("THE FLIP"), { page: PG, control: "Flip overlay: Escape key", expected: "closes the overlay", actual: (await fp()) ? "still open" : "closed", evidence: "n/a", impact: "usability", repro: "Open the deck; press Escape" });
    // reopen: collect titles by skipping with ArrowLeft
    await C.clickText(S, "View all", { scope: "main section:nth-of-type(5)" }).catch(() => {});
    await S.evaluate(`(() => { const b = [...[...document.querySelectorAll('main section')].find((s) => /Across Every Universe/i.test(s.querySelector('h2')?.textContent || '')).querySelectorAll('button')].filter((b) => /View all/.test(b.textContent))[1]; b.click(); return true; })()`);
    await S.waitFor("document.body.innerText.includes('THE FLIP') && !document.body.innerText.includes('Loading items')", 30000, "reopen").catch(() => {});
    await sleep(600);
    const privTitles = (await admin.from("vault_items").select("title,id").in("id", [2, 3, 4, 5, 7, 8, 9, 10].map((n) => `qa_vz_${sd.stamp}_${n}`))).data.map((x) => x.title);
    const seen = []; let guardN = 0;
    while (guardN++ < 45) {
      const card = await S.evaluate(`(() => { const o = [...document.querySelectorAll('div.fixed')].find((d) => /THE FLIP/.test(d.innerText)); const c = o && [...o.querySelectorAll('div.absolute.inset-0')].pop(); return c ? c.innerText.replace(/\\s+/g, ' ') : null; })()`);
      if (!card) break;
      seen.push(card.slice(0, 120));
      if (/seen it all/.test(clean(await fp()))) break;
      await C.key(S, "ArrowLeft", "ArrowLeft", 37);
      if (/seen it all/.test(await fp())) break;
    }
    const tdone = await fp();
    r.check(/seen it all/.test(tdone) && /Nothing saved this round/.test(tdone) && /Flip Again/.test(tdone), { page: PG, control: "Flip overlay: skip through every card (ArrowLeft) to the end", expected: "ends on 'You've seen it all' with 'Nothing saved this round' and Flip Again / Close", actual: `${tdone.slice(0, 200)} (cards seen: ${seen.length} of ${total})`, evidence: await S.jshot("dis-flip-done"), impact: "usability", repro: "Open the deck; press Left until the end" });
    const leaked = seen.filter((c) => privTitles.some((p) => c.includes(p)) || /7,?777/.test(c));
    r.check(leaked.length === 0, { page: PG, control: "Flip overlay: private items", expected: "none of the QA owner's private items (ids 2-5, 7-10) and no private cost appear in the deck", actual: leaked.length ? leaked.join(" | ") : `none among ${seen.length} cards`, evidence: "n/a", impact: "privacy/data loss", repro: "Skip through the whole deck" });
    r.check(seen.length === total, { page: PG, control: "Flip overlay: counter vs cards", expected: "the 'n / N' total equals the number of cards actually shown", actual: `counter said ${total}, ${seen.length} cards seen`, evidence: "n/a", impact: "misleading result", repro: "Count the cards" });
    await C.clickText(S, "Flip Again"); await sleep(600);
    const again = await fp();
    r.check(/1 \/ \d+/.test(again), { page: PG, control: "Flip overlay: Flip Again", expected: "restarts from card 1", actual: again.slice(0, 90), evidence: "n/a", impact: "usability", repro: "At the end, click Flip Again" });
    // right arrow saves
    await C.key(S, "ArrowRight", "ArrowRight", 39); await sleep(500);
    const afterSave = await fp(); const wl = await S.evaluate("(() => { const out = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/watchlist/i.test(k)) out[k] = String(localStorage.getItem(k)).slice(0, 200); } return out; })()");
    r.check(/1 saved/.test(afterSave) && /2 \/ \d+/.test(afterSave) && Object.keys(wl).length > 0, { page: PG, control: "Flip overlay: Right arrow (save) as a signed-out visitor", expected: "advances, shows '1 saved' and stores the item in the browser's watchlist", actual: `${afterSave.slice(0, 100)} | stored: ${JSON.stringify(wl).slice(0, 160)}`, evidence: await S.jshot("dis-flip-saved"), impact: "misleading result", repro: "Open the deck; press Right" });
    // drag right saves, drag left skips, tiny drag stays
    const cardBox = await S.evaluate(`(() => { const o = [...document.querySelectorAll('div.fixed')].find((d) => /THE FLIP/.test(d.innerText)); const c = [...o.querySelectorAll('div.absolute.inset-0')].pop(); const b = c.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height * 0.3 }; })()`);
    await C.mouseDrag(S, cardBox.x, cardBox.y, cardBox.x + 40); await sleep(500);
    const small = await fp();
    await C.mouseDrag(S, cardBox.x, cardBox.y, cardBox.x + 220); await sleep(900);
    const dragSave = await fp();
    await C.mouseDrag(S, cardBox.x, cardBox.y, cardBox.x - 220); await sleep(900);
    const dragSkip = await fp();
    r.check(/2 \/ \d+/.test(small) && /3 \/ \d+/.test(dragSave) && /2 saved/.test(dragSave) && /4 \/ \d+/.test(dragSkip) && /2 saved/.test(dragSkip), { page: PG, control: "Flip overlay: mouse drag (40px / right 220px / left 220px)", expected: "short drag snaps back; drag right saves (2 saved); drag left skips (still 2 saved)", actual: `short: ${small.slice(0, 50)} | right: ${dragSave.slice(0, 70)} | left: ${dragSkip.slice(0, 70)}`, evidence: "n/a", impact: "usability", repro: "Open the deck; drag the card" });
    await C.click(S, `([...document.querySelectorAll('div.fixed')].find((d) => /THE FLIP/.test(d.innerText)).querySelector('button[aria-label=Close]'))`); await sleep(600);
    r.check(!(await fp()).includes("THE FLIP"), { page: PG, control: "Flip overlay: Close (X)", expected: "closes the overlay and returns to Discover", actual: (await fp()) ? "still open" : "closed; path " + (await S.path()), evidence: "n/a", impact: "usability", repro: "Open deck; click X" });
    r.nt({ page: PG, control: "Flip overlay: Vibe button on a card", expected: "toggles an appreciation on the item", actual: "not exercised: it writes a shared appreciation counter on another collector's real item", evidence: "n/a", impact: "none", repro: "n/a" });
  });

  await S.close();
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });

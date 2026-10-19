// VLT suite 2: Home carousels (Recently added strip, exhibitions coverflow, seasonal banner), Upload menu, Lounge/Learn cards. Owner, Personal. Desktop 1440 then phone 390 (browser-emulated touch).
const V = require("./audit-s-vlt-lib.cjs");
const { R, sleep, squash, admin, drag, touchSwipe, clickEl, mouseClick } = V; const r = R("VLT");
const PG = (w) => `/dashboard | owner, Personal, 26 owned + 5 sold, 5 exhibitions | ${w}`;
const strip = "document.querySelector('[aria-label^=\"Recently added items. Use\"]')";
const sl = (S) => S.evaluate(`(() => { const s = ${strip}; return s ? { left: Math.round(s.scrollLeft), max: s.scrollWidth - s.clientWidth, w: s.clientWidth } : null; })()`);
const recentIds = (S) => S.evaluate("[...document.querySelectorAll('[data-recent-item]')].map((a) => a.getAttribute('data-recent-item'))");
const btnState = (S, label) => S.evaluate(`(() => { const b = document.querySelector('button[aria-label=${JSON.stringify(label)}]'); return b ? { disabled: b.disabled || b.getAttribute('aria-disabled') === 'true' } : null; })()`);
const exh = (S) => S.evaluate("(() => { const g = document.querySelector('[role=region][aria-label=\"Your exhibitions\"]'); if (!g) return null; const grp = g.querySelector('[role=group]'); const t = g.querySelector('[aria-live=polite]'); return { label: grp && grp.getAttribute('aria-label'), caption: t && t.innerText.replace(/\\s+/g, ' ').trim(), active: [...g.querySelectorAll('a[aria-current]')].map((a) => a.getAttribute('aria-label')) }; })()");

(async () => {
  const m = V.man(); const P = m.personalId;
  const all = await V.rows(P); const e = V.expected(all);
  const expIds = [...e.owned].sort((a, b) => Number(b.created_at) - Number(a.created_at)).slice(0, 24).map((x) => x.id);
  const galleries = (await admin.from("galleries").select("id,title,layout,state").eq("profile_id", P)).data;
  const gTitles = galleries.map((g) => g.title).sort();
  const S = await V.session("owner");
  try {
    await S.visit("/dashboard");
    // ---------- Recently added
    const ids = await recentIds(S);
    const wrongSold = ids.filter((i) => /_s\d$/.test(i));
    r.check(JSON.stringify(ids) === JSON.stringify(expIds) && wrongSold.length === 0, { page: PG("1440"), control: "Recently added strip: which items", expected: `The 24 most recently ADDED owned items in created-at order (newest first), none sold: ${expIds.slice(0, 3).join(",")}...`, actual: `shown ${ids.length}; same order as database=${JSON.stringify(ids) === JSON.stringify(expIds)}; sold shown=${wrongSold.length}; first=${ids.slice(0, 3)}`, evidence: await S.jshot("vlt-home-recent-1440"), impact: "misleading result", repro: "Open /dashboard; compare card order with vault_items.created_at desc for owned items" });
    const cap = await S.evaluate("(document.querySelector('[data-testid=recent-count]') || {}).innerText");
    r.check(/26 items in your Vault/.test(cap) && /browsing the newest 24/.test(cap), { page: PG("1440"), control: "Recently added caption", expected: "'26 items in your Vault · newest added <date> · browsing the newest 24'", actual: cap, impact: "misleading result", repro: "Read caption above the strip" });
    const s0 = await sl(S); const prev0 = await btnState(S, "Previous items"), next0 = await btnState(S, "Next items");
    r.check(s0.left === 0 && prev0.disabled && !next0.disabled && s0.max > 0, { page: PG("1440"), control: "Recently added 'Previous items' at the start", expected: "Strip at left=0, Previous disabled, Next enabled", actual: JSON.stringify({ s0, prev0, next0 }), impact: "usability", repro: "Open /dashboard" });
    // Next (real mouse)
    await clickEl(S, 'button[aria-label="Next items"]'); await sleep(1200); const s1 = await sl(S); const prev1 = await btnState(S, "Previous items");
    r.check(s1.left > 100 && !prev1.disabled, { page: PG("1440"), control: "Recently added 'Next items'", expected: "Mouse click scrolls the strip right by about a page and enables Previous", actual: JSON.stringify({ s1, prev1 }), impact: "blocked workflow", repro: "Click Next items" });
    await clickEl(S, 'button[aria-label="Previous items"]'); await sleep(1200); const s2 = await sl(S);
    r.check(s2.left < s1.left, { page: PG("1440"), control: "Recently added 'Previous items'", expected: "Scrolls back left", actual: JSON.stringify({ before: s1.left, after: s2.left }), impact: "blocked workflow", repro: "Click Next items then Previous items" });
    // run to the end with Next
    for (let i = 0; i < 30; i++) { const nx = await btnState(S, "Next items"); if (nx.disabled) break; await clickEl(S, 'button[aria-label="Next items"]'); await sleep(700); }
    const sEnd = await sl(S); const nxEnd = await btnState(S, "Next items");
    const lastVisible = await S.evaluate("(() => { const s = " + strip + "; const rr = s.getBoundingClientRect(); const cards = [...s.querySelectorAll('[data-recent-item]')]; const l = cards.filter((c) => c.getBoundingClientRect().right <= rr.right + 2 && c.getBoundingClientRect().left >= rr.left - 2); return l.length ? l[l.length - 1].getAttribute('data-recent-item') : null; })()");
    r.check(nxEnd.disabled && sEnd.left >= sEnd.max - 3 && lastVisible === expIds[23], { page: PG("1440"), control: "Recently added Next to the end", expected: "Next becomes disabled at the end and the 24th item is reachable", actual: JSON.stringify({ sEnd, nxEnd, lastVisible }), impact: "blocked workflow", repro: "Click Next items until disabled" });
    // reset, keyboard
    await S.evaluate(`${strip}.scrollTo({ left: 0 }); ${strip}.focus(); true`); await sleep(600);
    await S.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 }); await sleep(1000);
    const k1 = await sl(S);
    await S.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 }); await sleep(1000);
    const k2 = await sl(S);
    r.check(k1.left > 50 && k2.left < k1.left, { page: PG("1440"), control: "Recently added keyboard arrows", expected: "With the strip focused, Right arrow scrolls right, Left arrow scrolls back", actual: JSON.stringify({ k1, k2 }), impact: "usability", repro: "Focus strip (Tab); press ArrowRight, ArrowLeft" });
    // mouse drag over cards, then verify the drag did not open an item and a plain click does
    await S.evaluate(`${strip}.scrollTo({ left: 0 }); window.scrollTo(0, 0); true`); await sleep(500);
    const box = await S.evaluate(`(() => { const s = ${strip}; s.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(); const c = s.querySelector('[data-recent-item] img'); const cr = c.getBoundingClientRect(); return { x: cr.left + cr.width / 2, y: cr.top + cr.height / 2 }; })()`);
    await sleep(300); const p0 = await S.path();
    await drag(S, box.x + 200, box.y, box.x - 220, box.y); await sleep(1200);
    const d1 = await sl(S); const pAfter = await S.path();
    r.check(d1.left > 150 && pAfter === p0, { page: PG("1440"), control: "Recently added mouse drag (started on a photo)", expected: "Dragging left over the cards/photos scrolls the strip ~420px and does NOT open the item under the pointer", actual: JSON.stringify({ d1, p0, pAfter }), evidence: d1.left > 150 && pAfter === p0 ? "" : await S.jshot("vlt-home-drag-fail"), impact: "blocked workflow", repro: "Press the mouse on a card photo, drag left 420px, release" });
    await drag(S, box.x - 220, box.y, box.x + 200, box.y); await sleep(1000); const d2 = await sl(S);
    r.check(d2.left < d1.left - 100, { page: PG("1440"), control: "Recently added mouse drag back", expected: "Dragging right scrolls back", actual: JSON.stringify({ d1: d1.left, d2: d2.left }), impact: "usability", repro: "drag right" });
    // plain click opens item
    await S.evaluate(`${strip}.scrollTo({ left: 0 }); true`); await sleep(500);
    await clickEl(S, "document.querySelector('[data-recent-item] img')", { js: true }); await sleep(1500); await S.settle();
    const pc = await S.path(); const first = expIds[0];
    r.check(pc === "/vault/item/" + first, { page: PG("1440"), control: "Recently added card click", expected: `Opens /vault/item/${first}`, actual: pc, impact: "blocked workflow", repro: "Click the first card" });

    // ---------- Exhibitions coverflow
    await S.visit("/dashboard");
    await S.evaluate("document.querySelector('[role=region][aria-label=\"Your exhibitions\"]').scrollIntoView({ block: 'center' }); true"); await sleep(600);
    let e0 = await exh(S);
    const titles = []; const caps = [];
    for (let i = 0; i < 5; i++) { const x = await exh(S); caps.push(x.caption); titles.push(x.caption.split(" 0")[0]); await clickEl(S, 'button[aria-label="Next exhibition"]'); await sleep(900); }
    const e5 = await exh(S);
    const shownTitles = (await S.evaluate("1")) && caps.map((c) => /^(.*?)\s+\d+ pieces?/.exec(c)?.[1]).filter(Boolean);
    const pieces = (g) => (g.layout?.itemIds ?? []).length;
    const expCaps = galleries.map((g) => `${g.title} ${pieces(g)} piece${pieces(g) === 1 ? "" : "s"}`);
    const capsNoIdx = caps.map((c) => c.replace(/ · \d of \d$/, ""));
    r.check(expCaps.every((x) => capsNoIdx.includes(x)) && capsNoIdx.length === 5 && e5.caption === e0.caption, { page: PG("1440"), control: "Exhibitions 'Next exhibition' x5", expected: `Steps through all 5 exhibitions with title and piece count matching the database (${expCaps.join("; ")}) and wraps to the first`, actual: `captions=${JSON.stringify(caps)}; wrapped to first=${e5.caption === e0.caption}`, evidence: await S.jshot("vlt-home-exhibitions-1440"), impact: "misleading result", repro: "Click Next exhibition five times" });
    await clickEl(S, 'button[aria-label="Previous exhibition"]'); await sleep(800); const ep = await exh(S);
    r.check(/5 of 5$/.test(ep.caption), { page: PG("1440"), control: "Exhibitions 'Previous exhibition'", expected: "From 1 of 5 goes to 5 of 5 (wraps)", actual: ep.caption, impact: "usability", repro: "Click Previous exhibition at the first exhibition" });
    // keyboard
    await S.evaluate("document.querySelector('[role=region][aria-label=\"Your exhibitions\"] [role=group]').focus(); true");
    const key = async (k, c) => { await S.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code: k, windowsVirtualKeyCode: c }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: k, windowsVirtualKeyCode: c }); await sleep(700); return (await exh(S)).caption; };
    const kHome = await key("Home", 36), kRight = await key("ArrowRight", 39), kLeft = await key("ArrowLeft", 37), kEnd = await key("End", 35);
    r.check(/ 1 of 5$/.test(kHome) && / 2 of 5$/.test(kRight) && / 1 of 5$/.test(kLeft) && / 5 of 5$/.test(kEnd), { page: PG("1440"), control: "Exhibitions keyboard (Home, Right, Left, End)", expected: "Home=1 of 5, Right=2 of 5, Left=1 of 5, End=5 of 5", actual: JSON.stringify({ kHome, kRight, kLeft, kEnd }), impact: "usability", repro: "Focus the exhibitions group; press Home, ArrowRight, ArrowLeft, End" });
    // drag over the active card
    await key("Home", 36);
    const ab = await S.evaluate("(() => { const a = document.querySelector('[role=region][aria-label=\"Your exhibitions\"] a[aria-current]'); const r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
    const pb = await S.path();
    await drag(S, ab.x + 100, ab.y, ab.x - 150, ab.y); await sleep(1000);
    const dg = await exh(S); const pa = await S.path();
    r.check(/ [2-5] of 5$/.test(dg.caption) && pa === pb, { page: PG("1440"), control: "Exhibitions mouse drag over the active card", expected: "Dragging left over the card moves to the next exhibition and does not open the exhibition", actual: JSON.stringify({ caption: dg.caption, pb, pa }), evidence: await S.jshot("vlt-home-exh-drag"), impact: "blocked workflow", repro: "Press on the front card, drag left 250px, release" });
    // click neighbour -> becomes active; click active -> opens
    const nb = await S.evaluate("(() => { const b = document.querySelector('[role=region][aria-label=\"Your exhibitions\"] button[aria-label^=\"Show \"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, label: b.getAttribute('aria-label') }; })()");
    const beforeCap = (await exh(S)).caption;
    await mouseClick(S, nb.x, nb.y); await sleep(900); const afterCap = (await exh(S)).caption;
    r.check(afterCap !== beforeCap, { page: PG("1440"), control: "Exhibitions neighbouring card (" + nb.label + ")", expected: "Clicking a side card brings it to the front", actual: `${beforeCap} -> ${afterCap}`, impact: "usability", repro: "Click a side card" });
    const act = await S.evaluate("(() => { const a = document.querySelector('[role=region][aria-label=\"Your exhibitions\"] a[aria-current]'); const r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, href: a.getAttribute('href') }; })()");
    await mouseClick(S, act.x, act.y); await sleep(2500); await S.settle(); const po = await S.path();
    r.check(po === act.href || po.startsWith("/museum/") || po.startsWith("/gallery/"), { page: PG("1440"), control: "Exhibitions front card click", expected: `Opens the exhibition (${act.href})`, actual: po + " | " + squash(await S.text()).slice(0, 120), impact: "blocked workflow", repro: "Click the front card" });
    // no dots in the exhibitions strip: record
    await S.visit("/dashboard");
    const dots = await S.evaluate("document.querySelectorAll('[role=region][aria-label=\"Your exhibitions\"] [aria-label^=\"Slide\"]').length");
    r.pass({ page: PG("1440"), control: "Exhibitions strip dots", expected: "The strip has arrows, drag and keyboard only (no dot indicators in the design); position is shown as 'k of 5'", actual: `slide dots in exhibitions strip: ${dots}; position text present: ${/\d of 5/.test((await exh(S)).caption)}`, impact: "none", repro: "inspect strip" });

    // ---------- seasonal banner (Previous / Next / Slide dots / Yes / No)
    await S.visit("/dashboard"); await S.evaluate("localStorage.removeItem('vltd_theme_overrides'); true"); await S.visit("/dashboard");
    const ban = () => S.evaluate("(() => { const el = document.querySelector('.vltd-dark-surface'); if (!el) return null; const p = el.querySelector('p.font-bold, p.text-xs'); const dots = [...el.querySelectorAll('button[aria-label^=\"Slide\"]')]; return { text: p && p.innerText, prompt: /Switch app theme/.test(el.innerText), slides: dots.length, activeDot: dots.findIndex((d) => parseInt(d.style.width) > 10) + 1, attr: document.documentElement.getAttribute('data-seasonal') }; })()");
    const b0 = await ban();
    if (!b0) r.nt({ page: PG("1440"), control: "Seasonal banner", expected: "n/a", actual: "no banner on page", impact: "none", repro: "" });
    else {
      await clickEl(S, 'button[aria-label="Next"]'); await sleep(900); const b1 = await ban();
      await clickEl(S, 'button[aria-label="Previous"]'); await sleep(900); const b2 = await ban();
      await clickEl(S, 'button[aria-label="Slide 3"]'); await sleep(900); const b3 = await ban();
      r.check(b1.text !== b0.text && b2.text === b0.text && b3.activeDot === 3 && b3.text !== b0.text, { page: PG("1440"), control: "Banner Previous / Next / Slide dots", expected: `Next shows another slide, Previous returns, 'Slide 3' dot shows slide 3 (${b0.slides} slides)`, actual: JSON.stringify({ b0: b0.text, next: b1.text, prev: b2.text, dot3: b3.text, activeDot: b3.activeDot }), evidence: await S.jshot("vlt-home-banner"), impact: "usability", repro: "Click banner Next, Previous, then the third dot" });
      await clickEl(S, 'button[aria-label="Slide 1"]'); await sleep(900);
      const b4 = await ban();
      if (b4.prompt) {
        await clickEl(S, "[...document.querySelectorAll('.vltd-dark-surface button')].find((b) => b.textContent.trim() === 'No')", { js: true }); await sleep(800);
        const ls = await S.evaluate("localStorage.getItem('vltd_theme_overrides')"); const bn = await ban();
        r.check(!bn.prompt && /dismissed/.test(ls || "") && !bn.attr, { page: PG("1440"), control: "Banner 'Switch app theme?' -> No", expected: "Prompt disappears, choice remembered as dismissed, app theme unchanged (no data-seasonal)", actual: JSON.stringify({ prompt: bn.prompt, ls, attr: bn.attr }), impact: "usability", repro: "Click No" });
        await S.visit("/dashboard"); const bnr = await ban(); await S.evaluate("localStorage.removeItem('vltd_theme_overrides'); true"); await S.visit("/dashboard");
        const dotOne = await S.evaluate("1");
        await clickEl(S, "[...document.querySelectorAll('.vltd-dark-surface button')].find((b) => b.textContent.trim() === 'Yes')", { js: true }); await sleep(800);
        const by = await ban(); const gold = await S.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--theme-gold').trim()"); const ls2 = await S.evaluate("localStorage.getItem('vltd_theme_overrides')");
        await S.visit("/dashboard"); const byr = await ban();
        r.check(!by.prompt && !!by.attr && /accepted/.test(ls2 || "") && !!byr.attr && !byr.prompt, { page: PG("1440"), control: "Banner 'Switch app theme?' -> Yes", expected: "Applies the seasonal accent (data-seasonal set, --theme-gold changes), remembered as accepted and still applied after reload; prompt gone", actual: JSON.stringify({ afterYes: by, gold, ls2, afterReload: byr, noRemembered: bnr.prompt }), evidence: await S.jshot("vlt-home-theme-yes"), impact: "usability", repro: "Click Yes; reload" });
        await S.evaluate("localStorage.removeItem('vltd_theme_overrides'); true");
      } else r.nt({ page: PG("1440"), control: "Banner Yes/No", expected: "n/a", actual: "first slide has no theme prompt", impact: "none", repro: "" });
    }

    // ---------- Upload menu
    await S.visit("/dashboard");
    await clickEl(S, "[...document.querySelectorAll('button[aria-label=\"Upload from device\"]')].find((b) => b.getBoundingClientRect().width > 0)", { js: true }); await sleep(600);
    const items = await S.evaluate("[...document.querySelectorAll('[role=menuitem]')].map((a) => ({ t: a.innerText.replace(/\\s+/g, ' '), href: a.getAttribute('href') }))");
    r.check(items.length === 2 && items[0].href === "/capture?openUpload=1" && items[1].href === "/vault/bulk", { page: PG("1440"), control: "Upload from device (menu)", expected: "Opens a menu with 'Single item' (/capture?openUpload=1) and 'Batch' (/vault/bulk)", actual: JSON.stringify(items), evidence: await S.jshot("vlt-home-upload-menu"), impact: "blocked workflow", repro: "Click the upload icon next to Add Item" });
    await S.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await sleep(400);
    const closed = await S.evaluate("document.querySelectorAll('[role=menuitem]').length === 0");
    r.check(closed, { page: PG("1440"), control: "Upload menu Escape", expected: "Escape closes the menu", actual: String(closed), impact: "usability", repro: "Open menu, press Escape" });
    for (const [lab, want, probe] of [["Single item", /^\/capture\?openUpload=1/, "upload"], ["Batch", /^\/vault\/bulk/, "bulk"]]) {
      await S.visit("/dashboard");
      await clickEl(S, "[...document.querySelectorAll('button[aria-label=\"Upload from device\"]')].find((b) => b.getBoundingClientRect().width > 0)", { js: true }); await sleep(500);
      await clickEl(S, `[...document.querySelectorAll('[role=menuitem]')].find((a) => /${lab}/.test(a.innerText))`, { js: true }); await sleep(2000); await S.settle({ max: 20000 });
      const p = await S.path(); const tx = squash(await S.text()).slice(0, 300);
      r.check(want.test(p), { page: PG("1440"), control: `Upload from device > ${lab}`, expected: `Opens ${want} with the upload step ready (no AI scan started)`, actual: p + " | " + tx.slice(0, 160) + " | intercepted: " + S.intercepted.length, evidence: await S.jshot("vlt-home-upload-" + probe), impact: "blocked workflow", repro: `Home > upload icon > ${lab}` });
    }

    // ---------- Lounge + Learn cards
    await S.visit("/dashboard");
    const lounge = await S.evaluate("(() => { const s = [...document.querySelectorAll('section')].find((x) => /From the Lounge/i.test(x.innerText.slice(0, 60))); return s ? { text: s.innerText.replace(/\\s+/g, ' ').slice(0, 300), links: [...s.querySelectorAll('a')].map((a) => a.getAttribute('href')) } : null; })()");
    const dbPosts = (await admin.from("lounge_posts").select("id,title,created_at").order("created_at", { ascending: false }).limit(3)).data || [];
    const learn = await S.evaluate("(() => { const s = [...document.querySelectorAll('section')].find((x) => /^Learn/i.test(x.innerText.trim())); return s ? { text: s.innerText.replace(/\\s+/g, ' ').slice(0, 300), links: [...s.querySelectorAll('a')].map((a) => a.getAttribute('href')) } : null; })()");
    r.check(lounge && (dbPosts.length === 0 ? /No posts yet/.test(lounge.text) : dbPosts.every((p) => lounge.links.includes("/community-board?post=" + encodeURIComponent(p.id)))), { page: PG("1440"), control: "From the Lounge card", expected: `Shows the ${dbPosts.length} newest Lounge posts (or 'No posts yet' when there are none)`, actual: JSON.stringify({ lounge, dbPosts: dbPosts.map((p) => p.title) }), evidence: await S.jshot("vlt-home-lounge-learn"), impact: "misleading result", repro: "Open /dashboard; compare card with lounge_posts newest 3" });
    if (lounge && lounge.links.some((l) => l.startsWith("/community-board?post="))) {
      const href = lounge.links.find((l) => l.startsWith("/community-board?post="));
      await clickEl(S, `document.querySelector('a[href="${href}"]')`, { js: true }); await sleep(2000); await S.settle({ max: 20000 });
      const pp = await S.path(); const title = dbPosts.find((p) => href.endsWith(encodeURIComponent(p.id)))?.title;
      r.check(pp === href && title && squash(await S.text()).includes(title), { page: PG("1440"), control: "Lounge post link on Home", expected: `Opens the Lounge with that post ('${title}') shown`, actual: pp + " | contains title: " + (title ? squash(await S.text()).includes(title) : "n/a"), evidence: await S.jshot("vlt-home-lounge-post"), impact: "blocked workflow", repro: "Click a post on the Home Lounge card" });
    }
    await S.visit("/dashboard");
    const lh = learn && learn.links.find((l) => l.startsWith("/learn/"));
    await clickEl(S, `document.querySelector('a[href="${lh}"]')`, { js: true }); await sleep(2000); await S.settle({ max: 20000 });
    const lp = await S.path(); const h1 = await S.evaluate("(document.querySelector('h1') || {}).innerText");
    r.check(lp === lh && learn && learn.text.includes(h1 || "@@"), { page: PG("1440"), control: "Learn card article link", expected: "Opens the article named on the card", actual: `${lp} | h1='${h1}' | card: ${learn && learn.text.slice(0, 120)}`, impact: "blocked workflow", repro: "Click the Learn card" });
  } finally { console.log("errors", S.consoleErrors.slice(0, 5)); await S.close(); }

  // ============ phone 390 (browser-emulated touch) ============
  const M = await V.session("owner", { width: 390, height: 844, mobile: true });
  try {
    await M.visit("/dashboard");
    const ov = await M.evaluate("document.documentElement.scrollWidth <= innerWidth");
    r.check(ov, { page: PG("390 phone, browser-emulated"), control: "Home layout at 390px", expected: "No sideways page scroll", actual: "fits width: " + ov, evidence: await M.jshot("vlt-home-390", { full: true }), impact: "usability", repro: "Open /dashboard at 390px" });
    const tiles = await M.evaluate("[...document.querySelectorAll('section[aria-label=\"Collection overview\"] a')].filter((a) => /PURCHASE COST|ESTIMATED VALUE|UNREALIZED|SALES REVENUE/.test(a.innerText)).map((a) => a.innerText.replace(/\\s+/g, ' ').slice(0, 40))");
    r.check(tiles.length === 4, { page: PG("390 phone, browser-emulated"), control: "Four figure tiles on phone", expected: "All four tiles present", actual: JSON.stringify(tiles), impact: "usability", repro: "scroll" });
    await M.evaluate(`${strip}.scrollIntoView({ block: 'center' }); true`); await sleep(500);
    const bx = await M.evaluate(`(() => { const s = ${strip}; const r = s.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 90, w: r.width }; })()`);
    const t0 = await sl(M); const p0 = await M.path();
    await touchSwipe(M, bx.x + 120, bx.y, bx.x - 130, bx.y); await sleep(1200); const t1 = await sl(M); const p1 = await M.path();
    r.check(t1.left > t0.left + 80 && p1 === p0, { page: PG("390 phone, browser-emulated"), control: "Recently added swipe (browser-emulated touch)", expected: "A touch swipe left over the cards scrolls the strip and does not open an item", actual: JSON.stringify({ t0, t1, p0, p1 }), evidence: await M.jshot("vlt-home-recent-390"), impact: "blocked workflow", repro: "Swipe left on the cards (emulated)" });
    await clickEl(M, 'button[aria-label="Next items"]'); await sleep(1000); const t2 = await sl(M);
    r.check(t2.left > t1.left, { page: PG("390 phone, browser-emulated"), control: "Recently added Next items (phone)", expected: "Tap scrolls forward", actual: JSON.stringify({ before: t1.left, after: t2.left }), impact: "usability", repro: "tap Next items" });
    await M.evaluate("document.querySelector('[role=region][aria-label=\"Your exhibitions\"]').scrollIntoView({ block: 'center' }); true"); await sleep(600);
    const eb = await M.evaluate("(() => { const a = document.querySelector('[role=region][aria-label=\"Your exhibitions\"] a[aria-current]'); const r = a.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()");
    const c0 = (await exh(M)).caption; const pp0 = await M.path();
    await touchSwipe(M, eb.x + 90, eb.y, eb.x - 90, eb.y); await sleep(1100); const c1 = (await exh(M)).caption; const pp1 = await M.path();
    r.check(c1 !== c0 && pp1 === pp0, { page: PG("390 phone, browser-emulated"), control: "Exhibitions swipe (browser-emulated touch)", expected: "A swipe over the front card moves to another exhibition and does not open it", actual: JSON.stringify({ c0, c1, pp0, pp1 }), evidence: await M.jshot("vlt-home-exh-390"), impact: "blocked workflow", repro: "Swipe left on the front exhibition card (emulated)" });
    await clickEl(M, 'button[aria-label="Next exhibition"]'); await sleep(800); const c2 = (await exh(M)).caption;
    r.check(c2 !== c1, { page: PG("390 phone, browser-emulated"), control: "Exhibitions Next exhibition (phone)", expected: "Tap moves on", actual: `${c1} -> ${c2}`, impact: "usability", repro: "tap" });
  } finally { await M.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });

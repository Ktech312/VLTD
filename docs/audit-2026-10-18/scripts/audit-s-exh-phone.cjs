// EXH suite 7: phone width 390 (browser-emulated mobile viewport + touch) for /museum, /museum/new and the builder. Run audit-s-exh-guest first (shapes exhibition D).
const X = require("./audit-s-exh-lib.cjs");
const { session, admin, sleep, man, rows, mclick, byLabel, byLabelRe, key, gdb, gItemIds, typeInto } = X;
const R = rows();
const m = man();
const ex = JSON.parse(require("fs").readFileSync(__dirname + "/exh-created.json", "utf8"));
const D = ex.D;
const PH = "(browser-emulated phone, 390x844)";
const small = (S, scope = "main") => S.evaluate(`(() => { const out = []; const hit = (e, x, y) => { const t = document.elementFromPoint(x, y); return t && (t === e || e.contains(t)); }; document.querySelectorAll('${scope} button, ${scope} a[href], ${scope} [role=button], ${scope} input[type=checkbox]').forEach(e0 => { const e = (e0.tagName === 'INPUT' && e0.closest('label')) || e0; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') return; if (r.top < 0 || r.bottom > innerHeight) { e.scrollIntoView({ block: 'center' }); } const q = e.getBoundingClientRect(); const cx = q.x + q.width / 2, cy = q.y + q.height / 2; let up = 0, dn = 0, lf = 0, rt = 0; for (let d = 1; d <= 20; d++) { if (hit(e, cx, q.top - d)) up = d; else break; } for (let d = 1; d <= 20; d++) { if (hit(e, cx, q.bottom + d)) dn = d; else break; } for (let d = 1; d <= 20; d++) { if (hit(e, q.left - d, cy)) lf = d; else break; } for (let d = 1; d <= 20; d++) { if (hit(e, q.right + d, cy)) rt = d; else break; } const w = q.width + lf + rt, h = q.height + up + dn; if (h < 40 || w < 40) out.push((e.getAttribute('aria-label') || e.textContent).trim().replace(/\\s+/g, ' ').slice(0, 40) + ' ' + Math.round(w) + 'x' + Math.round(h) + ' (visible ' + Math.round(q.width) + 'x' + Math.round(q.height) + ')'); }); window.scrollTo(0, 0); return out; })()`);
const overflow = (S) => S.evaluate("({ sw: document.documentElement.scrollWidth, iw: innerWidth, over: document.documentElement.scrollWidth > innerWidth + 1 })");
async function tap(S, elExpr, wait = 700, scroll = true) {
  const r = await X.rectOf(S, elExpr, scroll); if (!r) return false; await sleep(700); const r2 = await X.rectOf(S, elExpr, false);
  await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: r2.x, y: r2.y, id: 1 }] });
  await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(wait); return true;
}

(async () => {
  const S = await session("owner", { width: 390, height: 844, mobile: true });
  try {
    await S.visit("/vault"); await sleep(6000);
    await S.visit("/museum"); await sleep(4500);
    await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
    const P = `/museum | owner, Personal ${PH}`;
    let ov = await overflow(S);
    R.check(!ov.over, { page: P, control: "Page width", expected: "No sideways scroll", actual: JSON.stringify(ov), evidence: await S.jshot("exh-phone-list-390"), impact: "cosmetic", repro: "Open /museum at 390px" });
    const filterVisible = await S.evaluate(`(() => { const b = document.querySelector('[aria-label="Filter exhibitions"]'); if (!b) return false; const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; })()`);
    const pillsHidden = await S.evaluate(`![...document.querySelectorAll('main button')].some(b => b.textContent.trim() === 'Drafts' && b.getBoundingClientRect().width > 0)`);
    R.check(filterVisible && pillsHidden, { page: P, control: "Filter control on a phone", expected: "The compact 'Filter exhibitions' dropdown shows and the desktop pills are hidden", actual: `dropdown ${filterVisible}; desktop pills hidden ${pillsHidden}`, impact: "usability", repro: "Open /museum on a phone" });
    // The page scrolls inside .vltd-content-wrap. First view: are the toolbar controls under the sheet? After scrolling one into the strip above the sheet: reachable?
    const reach = await S.evaluate(`(() => { const sc = document.querySelector('.vltd-content-wrap'); sc.style.scrollBehavior = 'auto'; sc.scrollTop = 0; const aside = document.querySelector('aside').getBoundingClientRect(); const els = { 'Filter exhibitions': document.querySelector('[aria-label="Filter exhibitions"]'), 'Sort exhibitions': document.querySelector('[aria-label="Sort exhibitions"]'), 'Tools': [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Tools'), '+ Create Exhibition': [...document.querySelectorAll('a')].find(a => /Create Exhibition/.test(a.textContent)) }; const out = {}; for (const [name, el] of Object.entries(els)) { if (!el) { out[name] = { first: 'missing', scrolled: 'missing' }; continue; } sc.scrollTop = 0; let r = el.getBoundingClientRect(); const first = (() => { const t = document.elementFromPoint(r.x + r.width / 2, Math.min(innerHeight - 1, r.y + r.height / 2)); return t && (t === el || el.contains(t)) ? 'reachable' : 'covered by ' + (t ? (t.closest('aside') ? 'the details sheet' : t.tagName) : 'nothing'); })(); sc.scrollTop = Math.max(0, r.top - 78); r = el.getBoundingClientRect(); const y = Math.max(r.top + 4, Math.min(r.bottom - 4, aside.top - 6)); const t2 = document.elementFromPoint(r.x + r.width / 2, y); out[name] = { first, scrolled: t2 && (t2 === el || el.contains(t2)) ? 'reachable (control top at ' + Math.round(r.top) + ', strip ends at ' + Math.round(aside.top) + ')' : 'still covered' }; } sc.scrollTop = 0; return out; })()`);
    for (const [name, v] of Object.entries(reach)) {
      R.check(v.first === "reachable", { page: P, control: `'${name}' in the first view (nothing scrolled)`, expected: "Visible and tappable when the page opens", actual: v.first + " (details sheet open by default)", evidence: v.first !== "reachable" ? await S.jshot("exh-phone-list-covered-" + name.replace(/\W+/g, "-")) : "", impact: "usability", repro: "Open /museum on a phone; look at the filter/sort/create controls" });
      R.check(/^reachable/.test(v.scrolled), { page: P, control: `'${name}' after scrolling it into the strip above the sheet`, expected: "Can be tapped", actual: v.scrolled, impact: "blocked workflow", repro: "Scroll the list until the control is above the sheet" });
    }
    // The details sheet is fixed over the lower part of the screen: how much of the screen does it cover, and can it be closed?
    const cover = await S.evaluate(`(() => { const a = document.querySelector('aside'); const r = a.getBoundingClientRect(); const closers = [...a.querySelectorAll('button')].filter(b => /(^|[^a-z])(close|dismiss|collapse|hide)([^a-z]|$)/i.test((b.getAttribute('aria-label') || '') + ' ' + b.textContent.trim().slice(0, 12)) || /^[x×]$/i.test(b.textContent.trim())).map(b => (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 30)); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, pct: Math.round(((Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / innerHeight) * 100), closers }; })()`);
    R.check(cover.pct <= 50 || cover.closers.length > 0, { page: P, control: "Exhibition Details sheet on a phone (open by default over the list)", expected: "Does not hide most of the list, or can be closed/collapsed", actual: `opens by itself over ${cover.pct}% of the screen height (y ${cover.top} to ${cover.bottom} of ${cover.vh}); buttons that could close it: ${JSON.stringify(cover.closers)}. The exhibition cards sit underneath it.`, evidence: await S.jshot("exh-phone-list-sheet-covers-390"), impact: "usability", repro: "Open /museum on a phone: the details sheet covers the exhibition cards" });
    // scroll the list so the SECOND row's first card sits in the strip above the sheet, then tap its visible part
    const pt = await S.evaluate(`(() => { const sc = document.querySelector('.vltd-content-wrap'); sc.style.scrollBehavior = 'auto'; sc.scrollTop = 0; const cards = [...document.querySelectorAll('main article')]; const card = cards[2]; let r = card.getBoundingClientRect(); sc.scrollTop = Math.max(0, r.top - 72); r = card.getBoundingClientRect(); const aside = document.querySelector('aside').getBoundingClientRect(); const cx = r.left + 24; for (let y = Math.max(r.top + 4, 66); y < Math.min(r.bottom - 4, aside.top - 2); y += 4) { const t = document.elementFromPoint(cx, y); if (t && card.contains(t) && !t.closest('button')) return { x: cx, y, card: card.getAttribute('aria-label').replace('Show details for ', '') }; } return { x: null, y: null, top: Math.round(r.top), bottom: Math.round(r.bottom), asideTop: Math.round(aside.top), scrollTop: sc.scrollTop, max: sc.scrollHeight - sc.clientHeight }; })()`);
    let tapped = false;
    if (pt && pt.x !== null) { await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pt.x, y: pt.y, id: 1 }] }); await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(900); tapped = true; }
    const title = await S.evaluate("(document.querySelector('aside h2') || {}).textContent");
    R.check(tapped && title === pt.card, { page: P, control: "Tap an exhibition card", expected: "Details switch to the tapped exhibition", actual: tapped ? "tapped the strip of the card above the sheet; details show '" + title + "'" : "no part of the card can be tapped: " + JSON.stringify(pt), impact: "usability", repro: "Open /museum on a phone and tap a card" });
    const tiny = await small(S, "main");
    R.check(tiny.length === 0, { page: P, control: "Tap target sizes (buttons and links under 40px)", expected: "Every control at least 40x40 on a phone (44 is the standard)", actual: tiny.length ? tiny.length + " small: " + tiny.slice(0, 8).join("; ") : "none", evidence: tiny.length ? await S.jshot("exh-phone-list-tiny-targets-390") : "", impact: "usability", repro: "Open /museum on a phone and measure the buttons" });
    // tap the open-full-page icon on the sheet
    await tap(S, `[...document.querySelectorAll('aside button')].find(b => /Open full exhibit page for/.test(b.getAttribute('aria-label') || ''))`, 3500);
    R.check((await S.path()) === `/museum/${(await admin.from("galleries").select("id").eq("title", String(title)).eq("profile_id", m.personalId).limit(1).single()).data.id}`, { page: P, control: "Sheet 'Open full exhibit page' (touch)", expected: "Opens the exhibition", actual: await S.path(), impact: "blocked workflow", repro: "Tap the arrow icon in the sheet" });
    await S.send("Page.navigate", { url: S.base + "/museum" }); await sleep(3500);
    // /museum/new
    await S.visit("/museum/new"); await sleep(2500);
    ov = await overflow(S);
    const tinyNew = await small(S, "main");
    R.check(!ov.over, { page: `/museum/new | owner ${PH}`, control: "Page width", expected: "No sideways scroll", actual: JSON.stringify(ov), evidence: await S.jshot("exh-phone-new-390"), impact: "cosmetic", repro: "Open /museum/new at 390px" });
    R.check(tinyNew.length === 0, { page: `/museum/new | owner ${PH}`, control: "Tap target sizes", expected: "Every control at least 40x40", actual: tinyNew.length ? tinyNew.join("; ") : "none", impact: "usability", repro: "Measure buttons on /museum/new" });

    // builder on exhibition D (2 exhibit pages)
    const PB = `/museum/[galleryId] | owner, Personal, 'QA Spare D' 2 exhibit pages ${PH}`;
    await S.visit("/museum/" + D); await sleep(8000);
    ov = await overflow(S);
    R.check(!ov.over, { page: PB, control: "Page width", expected: "No sideways scroll", actual: JSON.stringify(ov), evidence: await S.jshot("exh-phone-builder-390"), impact: "cosmetic", repro: "Open the exhibition at 390px" });
    const tinyB = await small(S, "main");
    R.check(tinyB.length === 0, { page: PB, control: "Tap target sizes", expected: "Every control at least 40x40", actual: tinyB.length ? tinyB.length + " small: " + tinyB.slice(0, 8).join("; ") : "none", evidence: tinyB.length ? await S.jshot("exh-phone-builder-tiny-390") : "", impact: "usability", repro: "Measure buttons in the exhibition editor on a phone" });
    // swipe the wall to the next exhibit (touch)
    const nm = () => S.evaluate(`(() => { const i = document.querySelector('input[placeholder="Exhibit name…"]'); return i ? i.value : null; })()`);
    const wallBox = await S.evaluate(`(() => { const e = document.querySelector('[data-slot-idx="0"]'); e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + r.height / 2, w: r.width }; })()`);
    const n0 = await nm();
    const swipeAt = async (x0, x1, y) => { await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y, id: 1 }] }); for (let k = 1; k <= 8; k++) { await S.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + ((x1 - x0) * k) / 8, y, id: 1 }] }); await sleep(30); } await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(700); };
    await swipeAt(330, 60, wallBox.y);
    const n1 = await nm();
    await swipeAt(60, 330, wallBox.y);
    const n2 = await nm();
    R.check(n0 === "QA Wall One" && n1 === "QA Wall Two" && n2 === "QA Wall One", { page: PB, control: "Swipe the wall left/right to change exhibit (browser-emulated touch)", expected: "Left swipe -> QA Wall Two; right swipe -> QA Wall One", actual: `${n0} -> ${n1} -> ${n2}`, impact: "blocked workflow", repro: "Swipe across the wall in the editor" });
    // Organize + touch swap in the editor
    await tap(S, byLabel("Organize"), 900);
    await X.rectOf(S, `document.querySelector('[data-slot-idx="0"]')`);
    const a = await X.rectOf(S, `document.querySelector('[data-slot-idx="0"]')`, false), b = await X.rectOf(S, `document.querySelector('[data-slot-idx="1"]')`, false);
    const before = (await gdb(D)).exhibition_layout.sections[0].itemIds.map((x) => x.slice(-2)).join(",");
    await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: a.x, y: a.y, id: 1 }] });
    for (let k = 1; k <= 8; k++) { await S.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: a.x + ((b.x - a.x) * k) / 8, y: a.y + ((b.y - a.y) * k) / 8, id: 1 }] }); await sleep(40); }
    await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(3000);
    const after = (await gdb(D)).exhibition_layout.sections[0].itemIds.map((x) => x.slice(-2)).join(",");
    R.check(after !== before && after.split(",")[0] === before.split(",")[1], { page: PB, control: "Organize: touch-drag a card onto the next one (browser-emulated)", expected: "The two cards swap and it is saved", actual: `${before} -> ${after}`, evidence: await S.jshot("exh-phone-organize-390"), impact: "blocked workflow", repro: "Organize, drag a card onto another with a finger (emulated)" });
    await tap(S, byLabel("Done"), 1500);
    // picker on a phone
    await tap(S, byLabelRe("^Edit/Add"), 1500);
    const pk = await S.evaluate(`(() => { const d = document.querySelector('[role=dialog]'); if (!d) return null; const r = d.getBoundingClientRect(); const add = [...d.querySelectorAll('button')].filter(x => /Add to Exhibit|Save \\(|Select items|Empty/.test(x.textContent)).pop(); const ar = add ? add.getBoundingClientRect() : null; return { w: Math.round(r.width), h: Math.round(r.height), vh: innerHeight, addBottom: ar ? Math.round(ar.bottom) : null, addH: ar ? Math.round(ar.height) : null }; })()`);
    R.check(!!pk && pk.w <= 390 && pk.addBottom !== null && pk.addBottom <= pk.vh + 2 && pk.addH >= 40, { page: PB, control: "Item picker on a phone", expected: "Fits the screen with its bottom button reachable and at least 40px tall", actual: JSON.stringify(pk), evidence: await S.jshot("exh-phone-picker-390"), impact: "usability", repro: "Tap Edit/Add on a phone" });
    await key(S, "Escape", "Escape", 27);
  } finally { await S.close(); }
  console.log("DONE phone");
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });

// ITM phone layout (390, browser-emulated): overflow, tap-target sizes, touch taps and swipe on the photo rail, For Sale / Sold at phone width; plus the Stream page for a missing item.
const X = require("./audit-s-itm-lib.cjs");
const { mclick, byText, byLabel, text, dbItem, dbWait, mkItem, sleep, admin, dismissBanner, P, ST } = X;
const touchTap = async (S, x, y) => { await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] }); await sleep(60); await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); };
const touchDrag = async (S, x1, y1, x2, y2, steps = 8) => { await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x1, y: y1 }] }); for (let i = 1; i <= steps; i++) { await sleep(25); await S.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x1 + ((x2 - x1) * i) / steps, y: y1 + ((y2 - y1) * i) / steps }] }); } await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); };
const SMALL = `(() => { const out = []; const seen = new Set(); document.querySelectorAll('main button, main a[href], main input, main select, main textarea, main [role=button], main [role=switch]').forEach((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (r.width < 2 || r.height < 2 || cs.visibility === 'hidden' || cs.display === 'none') return; if (e.closest('[aria-hidden=true]')) return; const label = (e.getAttribute('aria-label') || e.innerText || e.value || e.placeholder || e.getAttribute('title') || '').trim().replace(/\\s+/g, ' ').slice(0, 40); const after = getComputedStyle(e, '::after'); const ext = after && after.position === 'absolute' ? Math.abs(parseFloat(after.top) || 0) * 2 + r.height : 0; const h = Math.max(r.height, ext); if (h < 40 || r.width < 40) { const k = label + '|' + Math.round(r.width) + 'x' + Math.round(r.height); if (!seen.has(k)) { seen.add(k); out.push({ label, w: Math.round(r.width), h: Math.round(h) }); } } }); return out; })()`;
(async () => {
  let S = await X.S_("owner", { width: 390, height: 800, mobile: true });
  const { ck, nt, out } = X.makeCk(() => S, {});
  const dev = "phone 390 (browser-emulated)";
  try {
    const imgs = ["comic-slab", "sports-slab", "vinyl-record", "movie-poster", "guitar", "comic-slab"].map((n, i) => ({ id: `/collectibles/${n}.png#${i}`, storageKey: `/collectibles/${n}.png`, url: `/collectibles/${n}.png`, order: i, localOnly: false, role: i === 0 ? "primary" : "detail", isPrivateStorage: false }));
    const id = await mkItem("ph1", { title: "QA ITM phone item", purchase_price: 40, current_value: 120, images_json: imgs, image_front_url: imgs[0].url, image_front_storage_path: imgs[0].storageKey, status: "FOR_SALE", asking_price: 99 });
    await X.openItem(S, id); await dismissBanner(S); await sleep(800);
    const ov = await S.evaluate(`({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth })`);
    const wrap = await S.evaluate(`(() => { const w = document.querySelector('.vltd-content-wrap'); return w ? { sw: w.scrollWidth, cw: w.clientWidth } : null; })()`);
    await ck(ov.sw <= ov.cw + 1 && (!wrap || wrap.sw <= wrap.cw + 1), { page: `/vault/item/[id] | owner, Personal, ${dev}`, control: "Item page width", expected: "No sideways scrolling at 390 px", actual: `page ${ov.sw}/${ov.cw}; content ${wrap ? wrap.sw + "/" + wrap.cw : "n/a"}`, repro: "Open an item at 390 px" });
    const small = await S.evaluate(SMALL);
    const shotP = await S.jshot("itm-item-390");
    await ck(small.length === 0, { page: `/vault/item/[id] | owner, Personal, ${dev}, for sale`, control: "Tap-target size on the item page", expected: "Every button, link and field is at least about 40 px tall and wide (or has an enlarged tap area)", actual: `${small.length} small controls: ${small.slice(0, 14).map((s) => `${s.label || "(no label)"} ${s.w}x${s.h}`).join("; ")}`, evidence: shotP, impact: "usability", repro: "Open an item at 390 px and measure the buttons" });
    // touch tap: the Mark for sale toggle off, then Edit notes
    const tg = await S.evaluate(`(() => { const e = document.querySelector('[role=switch][aria-label="Listed for sale"], button[aria-label="Listed for sale"]'); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (tg) {
      await sleep(300);
      const tg2 = await S.evaluate(`(() => { const e = document.querySelector('[role=switch][aria-label="Listed for sale"], button[aria-label="Listed for sale"]'); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
      await touchTap(S, tg2.x, tg2.y); await sleep(2000);
      const d = await dbWait(id, (r) => r.status === "COLLECTION", 25000);
      await ck(d.ok, { page: `/vault/item/[id] | owner, Personal, ${dev}`, control: "Listed for sale toggle (touch tap)", expected: "A finger tap takes the item off sale (status COLLECTION)", actual: `db status=${d.row.status}`, repro: "Tap the Listed for sale switch" });
    }
    // swipe the photo rail
    await S.evaluate(`document.querySelector('button[aria-label="Show photo 1"]').scrollIntoView({ block: 'center' }); true`); await sleep(500);
    const rail = await S.evaluate(`(() => { const b = document.querySelector('button[aria-label="Show photo 1"]'); let p = b.parentElement; while (p && !(p.scrollWidth > p.clientWidth + 4 && /(auto|scroll)/.test(getComputedStyle(p).overflowX))) p = p.parentElement; if (!p) return null; const r = b.getBoundingClientRect(); return { sl: p.scrollLeft, sw: p.scrollWidth, cw: p.clientWidth, x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    if (rail) {
      await touchDrag(S, Math.min(rail.x + 120, 360), rail.y, 20, rail.y); await sleep(500);
      const after = await S.evaluate(`(() => { const b = document.querySelector('button[aria-label="Show photo 1"]'); let p = b.parentElement; while (p && !(p.scrollWidth > p.clientWidth + 4 && /(auto|scroll)/.test(getComputedStyle(p).overflowX))) p = p.parentElement; return p ? p.scrollLeft : -1; })()`);
      await ck(after > rail.sl, { page: `/vault/item/[id] | owner, Personal, ${dev}, 6 photos`, control: "Photo thumbnail rail (touch swipe)", expected: "Dragging a finger across the thumbnails scrolls the rail", actual: `scrollLeft ${rail.sl} -> ${after} (rail width ${rail.cw}, content ${rail.sw})`, repro: "Swipe left over the photo thumbnails" });
    } else nt({ page: `/vault/item/[id] | owner, ${dev}, 6 photos`, control: "Photo thumbnail rail", expected: "Observation: the rail does not overflow sideways at this width (thumbnails wrap or stack)", actual: "no horizontally scrollable rail found", impact: "none", repro: "n/a" });
    // For Sale and Sold at phone width
    for (const [route, sel] of [["/vault/for-sale", "article"], ["/vault/sold", "article"], ["/sales", "main"]]) {
      await S.visit(route); await sleep(2500); await dismissBanner(S);
      const o2 = await S.evaluate(`({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, wrap: (() => { const w = document.querySelector('.vltd-content-wrap'); return w ? w.scrollWidth - w.clientWidth : 0; })() })`);
      const sm = await S.evaluate(SMALL);
      const shot = await S.jshot(`itm-${route.replace(/\W+/g, "-").slice(1)}-390`);
      await ck(o2.sw <= o2.cw + 1 && o2.wrap <= 1, { page: `${route} | owner, Personal, ${dev}`, control: "Page width", expected: "No sideways scrolling at 390 px", actual: `page ${o2.sw}/${o2.cw}; content overflow ${o2.wrap}px`, evidence: shot, repro: `Open ${route} at 390 px` });
      await ck(sm.length === 0, { page: `${route} | owner, Personal, ${dev}`, control: "Tap-target size", expected: "Every control at least about 40 px", actual: `${sm.length} small controls: ${sm.slice(0, 12).map((s) => `${s.label || "(no label)"} ${s.w}x${s.h}`).join("; ")}`, evidence: shot, impact: "usability", repro: `Measure the buttons on ${route}` });
    }
    await S.close();
    // Stream page for an item that is not the signed-in collector's: does "Loading..." ever finish?
    S = await X.S_("viewer", { width: 1440, height: 900 });
    await S.visit(`/vault/item/${X.ID.valued}/present`); await sleep(1500);
    const t0 = await text(S); await sleep(9000); const t1 = await text(S);
    await ck(!/Loading\.\.\./.test(t1) || /not found|unavailable/i.test(t1), { page: `/vault/item/[id]/present | unrelated collector, desktop 1440`, control: "Stream page for an item that is not theirs", expected: "A clear 'not found' message, not a permanent 'Loading...'", actual: `after 10 s the page still says: ${(t1.match(/Loading\.\.\./) || [t1.slice(60, 140)])[0]}`, evidence: await S.jshot("itm-present-missing"), impact: "misleading result", repro: "As another collector open the /present URL of an item that is not yours" });
  } catch (e) { console.error("SUITE ERROR", e); try { await ck(false, { page: "suite", control: "phone suite runner", expected: "completes", actual: "script error: " + String(e.message).slice(0, 200), impact: "none" }); } catch {} }
  finally { console.log(JSON.stringify(X.sumRows(out))); try { await S.close(); } catch {} process.exit(0); }
})();

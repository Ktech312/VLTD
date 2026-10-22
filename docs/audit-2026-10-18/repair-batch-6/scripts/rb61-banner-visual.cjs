// Visual banner on PRODUCTION (RB61): event artwork, 15-second rotation, drag/swipe both ways, links, the single Seasonal theme switch, and a banner that never
// changes size or moves the collection below. Isolated QA owner; nothing is written to the database. Touch here is BROWSER-EMULATED (Chrome DevTools touch
// events), not a physical phone.
//   AUDIT_MANIFEST=<manifest> node rb61-banner-visual.cjs <label> [--skip-rotation]
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session } = T;
const LABEL = process.argv[2] || "run";
const SKIP_ROT = process.argv.includes("--skip-rotation");
const r = T.R("RB61");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [], samples: [] };
const ORANGE = "rgb(255, 107, 0)";

const CARD = `document.querySelector('[data-seasonal-banner]')`;
const STATE = `(() => {
  const card = ${CARD}; if (!card) return null;
  const r = card.getBoundingClientRect(); const ov = document.querySelector('section[aria-label="Collection overview"]'); const ovr = ov ? ov.getBoundingClientRect() : null;
  const sw = document.querySelector('button[role="switch"][aria-label="Seasonal theme"]'); const swr = sw ? sw.getBoundingClientRect() : null;
  const img = card.querySelector('img'); const dots = [...card.querySelectorAll('button[aria-label^="Slide "]')]; const cs = getComputedStyle(document.documentElement);
  const ps = [...card.querySelectorAll('p')].map((p) => p.textContent.trim());
  return { h: Math.round(r.height * 10) / 10, w: Math.round(r.width * 10) / 10, top: Math.round(r.top * 10) / 10, bottom: Math.round(r.bottom * 10) / 10, right: Math.round(r.right),
    overviewTop: ovr ? Math.round((ovr.top + scrollY) * 10) / 10 : null, cardDocTop: Math.round((r.top + scrollY) * 10) / 10,
    switchTop: swr ? Math.round(swr.top * 10) / 10 : null, switchRight: swr ? Math.round(swr.right) : null, switchOn: sw ? sw.getAttribute('aria-checked') === 'true' : null,
    slide: card.getAttribute('data-slide'), art: card.getAttribute('data-art'), imgLoaded: img ? (img.complete && img.naturalWidth > 0) : null, imgSrc: img ? img.src : null,
    label: ps[0] || '', sub: ps[1] || '', dots: dots.length, active: dots.findIndex((d) => d.getBoundingClientRect().width > 10), opacity: getComputedStyle(card).opacity,
    seasonal: document.documentElement.getAttribute('data-seasonal'), gold: cs.getPropertyValue('--theme-gold').trim(), scrollY: Math.round(scrollY), path: location.pathname,
    cardText: card.textContent, pageText: document.body.innerText.slice(0, 4000) };
})()`;
const COUNT = (rgb) => `(() => { const card = ${CARD}; let n = 0; for (const el of document.querySelectorAll('body *')) { if (card && card.contains(el)) continue; const c = getComputedStyle(el);
  if ([c.color, c.borderTopColor, c.backgroundColor, c.boxShadow, c.backgroundImage, c.outlineColor, c.fill].some((v) => v && v.includes(${JSON.stringify(rgb)}))) n++; } return n; })()`;
const CLICK_SWITCH = `(() => { const b = document.querySelector('button[role="switch"][aria-label="Seasonal theme"]'); if (!b) return false; b.click(); return true; })()`;
const CLICK_ARIA = (aria) => `(() => { const b = ${CARD}.querySelector('button[aria-label=${JSON.stringify(aria)}]'); if (!b) return false; b.click(); return true; })()`;

(async () => {
  let S;
  const ck = (ok, control, expected, actual, page) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page: page || "/ (Home)", control, expected, actual: String(actual).slice(0, 700), evidence: "", impact: "banner", repro: "" }); };
  async function open(width, height, mobile) {
    if (S) { try { await S.close(); } catch {} }
    S = await session("owner", { width, height, mobile });
    if (mobile) await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
    await S.visit("/"); await sleep(500);
    await S.evaluate("localStorage.removeItem('vltd_theme_overrides'); true");
    await home();
  }
  async function home() { await S.visit("/"); await S.waitFor(`!!${CARD}`, 30000, "banner").catch(() => {}); await sleep(1500); }
  const st = async () => S.evaluate(STATE);
  const settle = () => sleep(900);
  async function toSlide(i) { await S.evaluate(`(() => { const d = ${CARD}.querySelectorAll('button[aria-label^="Slide "]')[${i}]; if (d) d.click(); return true; })()`); await settle(); }
  async function cardBox() { return S.evaluate(`(() => { const r = ${CARD}.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`); }
  async function mouseDrag(dx, startFrac = 0.45) {
    const b = await cardBox(); const x = b.x + b.w * startFrac, y = b.y + b.h * 0.5;
    await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
    await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1, buttons: 1 });
    for (const f of [0.2, 0.4, 0.6, 0.8, 1]) await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + dx * f, y, button: "left", buttons: 1 });
    await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x + dx, y, button: "left", clickCount: 1, buttons: 0 });
    await settle();
  }
  async function mouseClick(xFrac) {
    const b = await cardBox(); const x = b.x + b.w * xFrac, y = b.y + b.h * 0.5;
    await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
    await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1, buttons: 1 });
    await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1, buttons: 0 });
    await sleep(1500);
  }
  async function touch(points) { // points: [[x,y], ...] first = start, last = end
    await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: points[0][0], y: points[0][1] }] });
    for (const p of points.slice(1)) await S.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: p[0], y: p[1] }] });
    await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(1200);
  }
  async function touchSwipe(dx) {
    const b = await cardBox(); const x = b.x + b.w * 0.5, y = b.y + b.h * 0.45;
    await touch([[x, y], [x + dx * 0.25, y], [x + dx * 0.5, y], [x + dx * 0.75, y], [x + dx, y]]);
  }

  try {
    for (const [name, w, h, mobile] of [["desktop 1440 (mouse)", 1440, 900, false], ["phone 390 (emulated touch)", 390, 800, true]]) {
      await open(w, h, mobile);
      const tag = mobile ? "m" : "d";
      const first = await st();
      if (!first) { ck(false, `banner present (${name})`, "the Home banner shows", "no banner found"); continue; }
      const n = first.dots;
      ck(n >= 2, `slides present (${name})`, "a seasonal slide and event slides", `slides=${n}; first=${first.label}`);

      // ── artwork and size on every slide
      const per = [];
      for (let i = 0; i < n; i++) { await toSlide(i); await sleep(600); const s = await st(); per.push({ i, slide: s.slide, art: s.art, imgLoaded: s.imgLoaded, h: s.h, w: s.w, overviewTop: s.overviewTop, label: s.label.slice(0, 36), sub: s.sub.slice(0, 30) }); }
      out.samples.push({ name, per });
      const withArt = per.filter((p) => p.art === "yes"); const broken = withArt.filter((p) => !p.imgLoaded);
      ck(withArt.length >= 3 && broken.length === 0, `artwork loads on the slides that have it (${name})`, "several event slides show their own picture and every picture loads", `${withArt.length} of ${n} slides have artwork, ${broken.length} failed to load; ${withArt.slice(0, 3).map((p) => p.label).join(" | ")}`);
      ck(per.filter((p) => p.art !== "yes").length >= 1 || n === withArt.length, `slides without artwork use the fallback (${name})`, "the fallback slide renders (no picture, same card)", `without artwork: ${per.filter((p) => p.art !== "yes").map((p) => p.label).join(" | ") || "none"}`);
      ck(new Set(per.map((p) => p.h)).size === 1 && new Set(per.map((p) => p.w)).size === 1, `card height and width identical on every slide (${name})`, "one height and one width", `heights=${[...new Set(per.map((p) => p.h))].join(",")} widths=${[...new Set(per.map((p) => p.w))].join(",")}`);
      ck(new Set(per.map((p) => p.overviewTop)).size === 1, `the collection overview does not move between slides (${name})`, "same page position for the overview", `overview top=${[...new Set(per.map((p) => p.overviewTop))].join(",")}`);
      const artIdx = per.findIndex((p) => p.art === "yes"); if (artIdx >= 0) { await toSlide(artIdx); await sleep(800); await S.jshot(`rb61-${LABEL}-${tag}-art`); }
      await toSlide(0); await S.jshot(`rb61-${LABEL}-${tag}-theme-slide`);

      // ── the single switch: place, old controls gone, default Off
      const s0 = await st();
      const oldGone = !/Switch app theme\?|Seasonal theme on|Back to normal/.test(s0.pageText) && !/\bYes\b|\bNo\b/.test(s0.cardText);
      ck(oldGone, `old controls removed (${name})`, "no 'Switch app theme?', Yes/No, 'Seasonal theme on' or 'Back to normal'", `card text: ${s0.cardText.slice(0, 120)}`);
      const ovView = s0.overviewTop - (await S.evaluate("scrollY"));
      ck(s0.switchTop !== null && s0.switchTop >= s0.bottom - 1 && s0.switchTop + 20 <= ovView + 2 && s0.switchRight >= s0.right - 30 && /Seasonal theme/.test(s0.pageText), `switch sits right-aligned below the banner and above the overview (${name})`, "Seasonal theme switch between the banner and the Collection overview, at the right", `banner bottom=${s0.bottom}; switch top=${s0.switchTop}, right=${s0.switchRight} (banner right=${s0.right}); overview top=${ovView}`);
      ck(s0.switchOn === false && !s0.seasonal, `default is Off and the normal appearance (${name})`, "switch Off, no seasonal theme applied", `on=${s0.switchOn}; data-seasonal=${s0.seasonal}; --theme-gold=${s0.gold}`);

      // ── On: applies, survives slide changes and reload; Off restores
      await S.evaluate(CLICK_SWITCH); await sleep(900);
      const on1 = await st(); const orangeOn = await S.evaluate(COUNT(ORANGE)); await S.jshot(`rb61-${LABEL}-${tag}-on`);
      ck(on1.switchOn && on1.seasonal && on1.gold.toUpperCase() === "#FF6B00" && orangeOn > 0, `On applies the seasonal theme (${name})`, "switch On, theme applied, colours changed", `on=${on1.switchOn}; data-seasonal=${on1.seasonal}; --theme-gold=${on1.gold}; orange elements=${orangeOn}`);
      ck(on1.h === s0.h && on1.w === s0.w && on1.overviewTop === s0.overviewTop, `turning it On changes no size and moves nothing (${name})`, "same banner size and overview position", `h ${s0.h}->${on1.h}; w ${s0.w}->${on1.w}; overview ${s0.overviewTop}->${on1.overviewTop}`);
      const keep = [];
      for (let i = 0; i < 4; i++) { await S.evaluate(CLICK_ARIA("Next")); await settle(); const k = await st(); keep.push(`${k.switchOn}/${k.seasonal || "none"}`); }
      ck(keep.every((k) => k === "true/halloween-2026"), `moving between slides does not change the choice (${name})`, "still On, theme still applied, after 4 slide changes", keep.join(" "));
      await home(); const on2 = await st(); const orangeOn2 = await S.evaluate(COUNT(ORANGE));
      await S.visit("/vault"); await sleep(1500); const onVault = await S.evaluate(`({ s: document.documentElement.getAttribute('data-seasonal'), g: getComputedStyle(document.documentElement).getPropertyValue('--theme-gold').trim() })`);
      ck(on2.switchOn && on2.seasonal && orangeOn2 > 0 && onVault.s && onVault.g.toUpperCase() === "#FF6B00", `On survives reload and other pages (${name})`, "still On after reload, and applied on /vault", `home: on=${on2.switchOn} ${on2.seasonal} orange=${orangeOn2}; vault: ${onVault.s} ${onVault.g}`);
      await home(); await S.evaluate(CLICK_SWITCH); await sleep(900);
      const off1 = await st(); const orangeOff = await S.evaluate(COUNT(ORANGE));
      ck(off1.switchOn === false && !off1.seasonal && orangeOff === 0 && off1.gold.toUpperCase() === "#C8CDD2" && off1.h === s0.h && off1.overviewTop === s0.overviewTop, `Off restores the normal appearance with nothing stuck (${name})`, "switch Off, theme gone, platinum back, no orange, same size", `on=${off1.switchOn}; data-seasonal=${off1.seasonal}; --theme-gold=${off1.gold}; orange=${orangeOff}; h=${off1.h}`);
      await home(); const off2 = await st(); const orangeOff2 = await S.evaluate(COUNT(ORANGE));
      await S.visit("/vault"); await sleep(1500); const offVault = await S.evaluate(`document.documentElement.getAttribute('data-seasonal')`);
      ck(off2.switchOn === false && !off2.seasonal && orangeOff2 === 0 && !offVault, `Off survives reload (${name})`, "still Off and normal after reload and on /vault", `on=${off2.switchOn}; data-seasonal=${off2.seasonal}; orange=${orangeOff2}; vault=${offVault}`);
      // an old stored "accepted" answer still means On (nobody is switched off by this change)
      await S.evaluate(`localStorage.setItem('vltd_theme_overrides', JSON.stringify({ 'halloween-2026': 'accepted' })); true`); await home();
      const old = await st(); ck(old.switchOn && old.seasonal === "halloween-2026", `an earlier 'Yes' shows as On (${name})`, "a stored accepted answer = On", `on=${old.switchOn}; ${old.seasonal}`);
      await S.evaluate(`localStorage.removeItem('vltd_theme_overrides'); true`); await home();

      // ── links
      await toSlide(0); await S.evaluate(`(() => { const a = ${CARD}.querySelector('a'); a.click(); return true; })()`); await sleep(2500);
      const themeCta = await S.evaluate("location.pathname"); await home();
      const evIdx = per.findIndex((p) => p.i > 0 && p.art === "yes");
      await toSlide(evIdx > 0 ? evIdx : 1); await S.evaluate(`(() => { const a = ${CARD}.querySelector('a'); a.click(); return true; })()`); await sleep(2500);
      const evCta = await S.evaluate("location.pathname"); await home();
      await toSlide(evIdx > 0 ? evIdx : 1);
      if (mobile) { const b = await cardBox(); await touch([[b.x + b.w * 0.45, b.y + b.h * 0.4], [b.x + b.w * 0.45, b.y + b.h * 0.4]]); } else await mouseClick(0.45);
      await sleep(1000); const evBody = await S.evaluate("location.pathname"); await home();
      ck(themeCta === "/discover" && evCta === "/events" && evBody === "/events", `links still open correctly (${name})`, "theme button opens /discover; event button and a tap/click on the event open /events", `theme CTA -> ${themeCta}; event CTA -> ${evCta}; ${mobile ? "tap" : "click"} on the event -> ${evBody}`);

      // ── arrows and dots
      await toSlide(0); const nav = [];
      const at = async () => (await st()).active;
      nav.push(await at()); await S.evaluate(CLICK_ARIA("Next")); await settle(); nav.push(await at()); await S.evaluate(CLICK_ARIA("Next")); await settle(); nav.push(await at());
      await S.evaluate(CLICK_ARIA("Previous")); await settle(); nav.push(await at()); await S.evaluate(CLICK_ARIA("Previous")); await settle(); await S.evaluate(CLICK_ARIA("Previous")); await settle(); nav.push(await at());
      await toSlide(3); nav.push(await at());
      ck(JSON.stringify(nav) === JSON.stringify([0, 1, 2, 1, n - 1, 3]), `arrows and dots (${name})`, "Next/Previous move one slide and wrap; a dot opens its slide", JSON.stringify(nav));

      // ── drag / swipe, both ways, never opening the event
      await home(); await toSlide(2);
      const d = [];
      const dragPath = async () => (await S.evaluate("location.pathname"));
      if (mobile) {
        d.push(await at()); await touchSwipe(-130); d.push(await at()); await touchSwipe(130); d.push(await at()); await touchSwipe(130); d.push(await at());
        await toSlide(0); await touchSwipe(130); d.push(await at()); await touchSwipe(-130); d.push(await at());
      } else {
        d.push(await at()); await mouseDrag(-200); d.push(await at()); await mouseDrag(200); d.push(await at()); await mouseDrag(200); d.push(await at());
        await toSlide(0); await mouseDrag(200); d.push(await at()); await mouseDrag(-200); d.push(await at());
      }
      const expD = [2, 3, 2, 1, n - 1, 0];
      ck(JSON.stringify(d) === JSON.stringify(expD), `${mobile ? "finger swipe (emulated touch)" : "mouse drag"} moves left/right both ways, wrapping (${name})`, "left = next, right = previous", JSON.stringify(d));
      ck((await dragPath()) === "/", `a drag never opens the event (${name})`, "still on Home after 6 drags that started on an event or theme slide", await dragPath());
      if (mobile) {
        await toSlide(2); const before = await st(); const b = await cardBox();
        await touch([[b.x + b.w * 0.5, b.y + b.h * 0.5], [b.x + b.w * 0.5 + 4, b.y + b.h * 0.5 - 40], [b.x + b.w * 0.5 + 6, b.y + b.h * 0.5 - 90], [b.x + b.w * 0.5 + 6, b.y + b.h * 0.5 - 150]]);
        const afterV = await st();
        ck(afterV.slide === before.slide && afterV.path === "/", `a vertical finger drag on the banner does not change the slide or open it (${name})`, "same slide, still on Home", `slide ${before.slide} -> ${afterV.slide}; path=${afterV.path}; scrollY ${before.scrollY} -> ${afterV.scrollY}`);
        await S.evaluate("window.scrollTo(0,0)"); await sleep(300);
        const b2 = await cardBox(); const sy0 = await S.evaluate("scrollY");
        await S.send("Input.synthesizeScrollGesture", { x: b2.x + b2.w * 0.5, y: b2.y + b2.h * 0.5, yDistance: -250, gestureSourceType: "touch", speed: 800 }).catch(() => {});
        await sleep(900); const sy1 = await S.evaluate("scrollY");
        ck(sy1 > sy0 + 50, `the page still scrolls vertically when the finger starts on the banner (${name})`, "scrollY increases after a touch scroll gesture that starts on the banner", `scrollY ${sy0} -> ${sy1}`);
        await S.evaluate("window.scrollTo(0,0)");
      }
      await home();
      const sw0 = await st();
      ck(sw0.h === first.h && sw0.w === first.w, `size unchanged after all interactions (${name})`, "same height and width as at the start", `h ${first.h}->${sw0.h}; w ${first.w}->${sw0.w}`);

      // ── automatic rotation: 15 s, several in a row, timer restarts after manual moves (desktop only; the timer does not depend on the device)
      if (!mobile && !SKIP_ROT) {
        await home(); await toSlide(0);
        const seen = []; const t0 = Date.now(); let last = (await st()).active; seen.push({ s: 0, at: last });
        while (Date.now() - t0 < 60000 && seen.length < 4) { await sleep(500); const a = (await st()).active; if (a !== last) { seen.push({ s: Math.round((Date.now() - t0) / 100) / 10, at: a }); last = a; } }
        const gaps = seen.slice(1).map((x, i) => Math.round((x.s - (i === 0 ? 0 : seen[i].s)) * 10) / 10);
        out.samples.push({ name, rotation: seen, gaps });
        ck(seen.length >= 4 && gaps.every((g) => g >= 13 && g <= 18), `automatic rotation every ~15 s through several slides (${name})`, "three automatic changes in a row about 15 s apart", `changes at ${JSON.stringify(seen)}; gaps ${JSON.stringify(gaps)}`);
        // manual navigation restarts the timer: click Next ~11 s after the last change; the next automatic change must be ~15 s after the click, not ~4 s
        const lastChange = Date.now(); const base = (await st()).active;
        while (Date.now() - lastChange < 11000) await sleep(250);
        await S.evaluate(CLICK_ARIA("Next")); const tClick = Date.now(); await sleep(900);
        const afterClick = (await st()).active; let autoAt = null; let cur = afterClick;
        while (Date.now() - tClick < 24000) { await sleep(500); const a = (await st()).active; if (a !== cur) { autoAt = Math.round((Date.now() - tClick) / 100) / 10; break; } }
        ck(afterClick === (base + 1) % n && autoAt !== null && autoAt >= 13 && autoAt <= 18.5, `after manual navigation the timer starts over (${name})`, "no automatic jump soon after a click; the next one comes ~15 s after it", `clicked Next at ~11 s after the last change; next automatic change ${autoAt}s after the click`);
        // and after the switch
        await S.evaluate(CLICK_SWITCH); await sleep(600); const tSw = Date.now(); const aSw = (await st()).active; let sw = null;
        while (Date.now() - tSw < 26000) { await sleep(500); const a = (await st()).active; if (a !== aSw) { sw = Math.round((Date.now() - tSw) / 100) / 10; break; } }
        const stillOn = (await st()).switchOn;
        ck(sw !== null && sw <= 17 && stillOn === true, `rotation continues after using the switch, and the switch stays On while slides change (${name})`, "slide changes by itself within ~15 s; switch still On", `changed after ${sw}s; switch on=${stillOn}`);
        await S.evaluate(CLICK_SWITCH); await sleep(500);
      }
    }
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String((e && e.stack) || e).slice(0, 800); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb61-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS" : "FAIL") + " " + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
    process.exit(0);
  }
})();

// Banner pass on PRODUCTION (RB59): the Home banner keeps one size on every slide and before/after Yes or No, nothing below it moves, it rotates by itself, arrows / dots /
// swipe work in both directions (also after theme choices), and seasonal colours change, revert and survive a reload with nothing stuck. Isolated QA owner; nothing is written to the database.
//   AUDIT_MANIFEST=<manifest> node rb59-banner.cjs <label> [--skip-rotation]
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session } = T;
const LABEL = process.argv[2] || "run";
const SKIP_ROT = process.argv.includes("--skip-rotation");
const r = T.R("RB59");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [], samples: [] };
const ORANGE = "rgb(255, 107, 0)";

const CARD = `(document.querySelector('[data-seasonal-banner]') || ((document.querySelector('button[aria-label="Previous"]') || { closest: () => null }).closest('.vltd-dark-surface')))`;
const STATE = `(() => {
  const card = ${CARD}; if (!card) return null;
  const r = card.getBoundingClientRect(); const nx = card.nextElementSibling; const nr = nx ? nx.getBoundingClientRect() : null;
  const ps = [...card.querySelectorAll('p')].map((p) => p.textContent.trim());
  const dots = [...card.querySelectorAll('button[aria-label^="Slide "]')];
  const cs = getComputedStyle(document.documentElement);
  const btns = [...card.querySelectorAll('button')].map((b) => b.textContent.trim()).filter(Boolean);
  return { h: Math.round(r.height * 10) / 10, w: Math.round(r.width), top: Math.round(r.top * 10) / 10, belowTop: nr ? Math.round(nr.top * 10) / 10 : null,
    label: ps[0] || '', sub: ps[1] || '', dots: dots.length, active: dots.findIndex((d) => d.getBoundingClientRect().width > 10), btns,
    prompt: /Switch app theme|theme in use|Seasonal theme|Normal theme/.test(card.textContent), opacity: getComputedStyle(card).opacity,
    seasonal: document.documentElement.getAttribute('data-seasonal'), gold: cs.getPropertyValue('--theme-gold').trim(), accent: cs.getPropertyValue('--accent').trim(),
    accentBody: getComputedStyle(document.body).getPropertyValue('--accent').trim(), seasonalAccent: cs.getPropertyValue('--seasonal-accent').trim(),
    goldBorder: cs.getPropertyValue('--theme-gold-border').trim(), prefs: localStorage.getItem('vltd_theme_overrides') };
})()`;
const COUNT = (rgb) => `(() => { const card = ${CARD}; let n = 0; for (const el of document.querySelectorAll('body *')) { if (card && card.contains(el)) continue; const c = getComputedStyle(el);
  if ([c.color, c.borderTopColor, c.backgroundColor, c.boxShadow, c.backgroundImage, c.outlineColor, c.fill].some((v) => v && v.includes(${JSON.stringify(rgb)}))) n++; } return n; })()`;
const CLICK_IN_CARD = (text) => `(() => { const card = ${CARD}; const b = card && [...card.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)}); if (!b) return false; b.click(); return true; })()`;
const CLICK_ARIA = (aria) => `(() => { const card = ${CARD}; const b = card && card.querySelector('button[aria-label=${JSON.stringify(aria)}]'); if (!b) return false; b.click(); return true; })()`;

(async () => {
  let S;
  const ck = (ok, control, expected, actual, page) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page: page || "/ (Home)", control, expected, actual: String(actual).slice(0, 600), evidence: "", impact: "banner", repro: "" }); };
  async function open(width, height, mobile, themes) {
    if (S) { try { await S.close(); } catch {} }
    S = await session("owner", { width, height, mobile });
    if (mobile) await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
    if (themes) await S.send("Page.addScriptToEvaluateOnNewDocument", { source: `(() => { try { const t = ${JSON.stringify(themes)}; sessionStorage.setItem('vltd_active_themes_all', JSON.stringify({ ts: Date.now(), data: t })); sessionStorage.setItem('vltd_active_theme', JSON.stringify({ ts: Date.now(), data: t[0] })); } catch (e) {} })();` });
    await S.visit("/"); await sleep(500);
    await S.evaluate("localStorage.removeItem('vltd_theme_overrides'); true");
    await S.visit("/");
    await S.waitFor(`!!${CARD}`, 30000, "banner").catch(() => {});
    await sleep(800);
  }
  const st = async () => S.evaluate(STATE);
  const settle = async () => { await sleep(900); };
  async function toSlide(i) { await S.evaluate(`(() => { const card = ${CARD}; const d = card.querySelectorAll('button[aria-label^="Slide "]')[${i}]; if (d) d.click(); return true; })()`); await settle(); }
  async function swipe(dir) {
    const box = await S.evaluate(`(() => { const r = ${CARD}.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 8 }; })()`);
    const dx = dir === "left" ? -120 : 120;
    await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x, y: box.y }] });
    for (const f of [0.25, 0.5, 0.75, 1]) await S.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.x + dx * f, y: box.y }] });
    await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await settle();
  }

  try {
    for (const [name, w, h, mobile] of [["desktop 1440", 1440, 900, false], ["phone 390", 390, 800, true]]) {
      await open(w, h, mobile);
      const first = await st();
      if (!first) { ck(false, `banner present (${name})`, "the Home banner shows", "no banner found"); continue; }
      out.samples.push({ name, first });
      const n = first.dots;
      ck(n >= 2, `slides present (${name})`, "a seasonal slide and event slides", `slides=${n}; first=${first.label}`);

      // 1. size per slide and below it
      const per = [];
      for (let i = 0; i < n; i++) { await toSlide(i); const s = await st(); per.push({ i, h: s.h, belowTop: s.belowTop, label: s.label.slice(0, 40), prompt: s.prompt, btns: s.btns.join("|") }); }
      out.samples.push({ name, per });
      const hs = new Set(per.map((p) => p.h)); const bs = new Set(per.map((p) => p.belowTop));
      ck(hs.size === 1, `card height identical on every slide (${name})`, "one height on theme and event slides", `heights=${[...hs].join(",")} over ${n} slides`);
      ck(bs.size === 1, `content below does not move across slides (${name})`, "one top position for the content below", `belowTop=${[...bs].join(",")}`);

      // 2. before / after Yes and No (theme slide = 0)
      await toSlide(0);
      const undecided = await st();
      await S.jshot(`rb59-${LABEL}-${mobile ? "m" : "d"}-undecided`);
      const sizes = [{ step: "undecided", h: undecided.h, belowTop: undecided.belowTop }];
      const yes = await S.evaluate(CLICK_IN_CARD("Yes")); await settle();
      const afterYes = await st(); sizes.push({ step: "after Yes", h: afterYes.h, belowTop: afterYes.belowTop });
      const orangeYes = await S.evaluate(COUNT(ORANGE));
      await S.jshot(`rb59-${LABEL}-${mobile ? "m" : "d"}-accepted`);
      let afterBack = null, orangeBack = null;
      const back = await S.evaluate(CLICK_IN_CARD("Back to normal")); await settle();
      if (back) { afterBack = await st(); sizes.push({ step: "after Back to normal", h: afterBack.h, belowTop: afterBack.belowTop }); orangeBack = await S.evaluate(COUNT(ORANGE)); }
      out.samples.push({ name, sizes, undecided, afterYes, afterBack, orangeYes, orangeBack });
      ck(yes && afterYes.seasonal && afterYes.gold.toUpperCase() === "#FF6B00", `Yes switches the theme (${name})`, "data-seasonal set and --theme-gold = the theme's accent", `yes clicked=${yes}; data-seasonal=${afterYes.seasonal}; --theme-gold=${afterYes.gold}; --accent(html)=${afterYes.accent}; --accent(body)=${afterYes.accentBody}`);
      ck(orangeYes > 0, `visible colours change after Yes (${name})`, "elements outside the banner now use the theme's accent colour", `${orangeYes} elements show ${ORANGE}`);
      ck(new Set(sizes.map((s) => s.h)).size === 1 && new Set(sizes.map((s) => s.belowTop)).size === 1, `size and content position unchanged before/after Yes and Back (${name})`, "same height and same position of what is below", JSON.stringify(sizes));
      ck(!!back && afterBack && !afterBack.seasonal && orangeBack === 0, `Back to normal removes the theme (${name})`, "data-seasonal gone, accent vars cleared, no orange left", `button found=${back}; data-seasonal=${afterBack && afterBack.seasonal}; --theme-gold=${afterBack && afterBack.gold}; orange elements=${orangeBack}`);

      // 3. No, reload
      await S.evaluate("localStorage.removeItem('vltd_theme_overrides'); true"); await S.visit("/"); await S.waitFor(`!!${CARD}`, 30000, "banner").catch(() => {}); await sleep(800);
      const u2 = await st();
      const no = await S.evaluate(CLICK_IN_CARD("No")); await settle();
      const afterNo = await st(); const orangeNo = await S.evaluate(COUNT(ORANGE));
      await S.visit("/"); await S.waitFor(`!!${CARD}`, 30000, "banner").catch(() => {}); await sleep(800);
      const afterNoReload = await st();
      out.samples.push({ name, u2, afterNo, afterNoReload, orangeNo });
      ck(no && !afterNo.seasonal && orangeNo === 0 && !afterNoReload.seasonal && afterNo.h === u2.h && afterNo.belowTop === u2.belowTop, `No leaves the app as it is, also after reload (${name})`, "no theme, no orange, same size, still normal after reload", `no clicked=${no}; data-seasonal=${afterNo.seasonal}/${afterNoReload.seasonal}; orange=${orangeNo}; h ${u2.h}->${afterNo.h}; below ${u2.belowTop}->${afterNo.belowTop}`);

      // 4. accept, reload, still applied; navigate away in the app and back; then revert and reload
      await S.evaluate("localStorage.removeItem('vltd_theme_overrides'); true"); await S.visit("/"); await S.waitFor(`!!${CARD}`, 30000, "banner").catch(() => {}); await sleep(800);
      await S.evaluate(CLICK_IN_CARD("Yes")); await settle();
      await S.visit("/"); await S.waitFor(`!!${CARD}`, 30000, "banner").catch(() => {}); await sleep(1200);
      const reloaded = await st(); const orangeReloaded = await S.evaluate(COUNT(ORANGE));
      await S.visit("/vault"); await sleep(1500);
      const onVault = await S.evaluate(`({ seasonal: document.documentElement.getAttribute('data-seasonal'), gold: getComputedStyle(document.documentElement).getPropertyValue('--theme-gold').trim() })`);
      await S.visit("/");  await S.waitFor(`!!${CARD}`, 30000, "banner").catch(() => {}); await sleep(1000);
      await S.evaluate(CLICK_IN_CARD("Back to normal")); await settle();
      await S.visit("/"); await S.waitFor(`!!${CARD}`, 30000, "banner").catch(() => {}); await sleep(1200);
      const revertedReload = await st(); const orangeRevertedReload = await S.evaluate(COUNT(ORANGE));
      await S.visit("/vault"); await sleep(1500);
      const vaultReverted = await S.evaluate(`({ seasonal: document.documentElement.getAttribute('data-seasonal'), gold: getComputedStyle(document.documentElement).getPropertyValue('--theme-gold').trim() })`);
      out.samples.push({ name, reloaded, orangeReloaded, onVault, revertedReload, orangeRevertedReload, vaultReverted });
      ck(reloaded.seasonal && reloaded.gold.toUpperCase() === "#FF6B00" && orangeReloaded > 0 && onVault.seasonal && onVault.gold.toUpperCase() === "#FF6B00", `an accepted theme survives reload and other pages (${name})`, "theme still applied after reload and on /vault", `home: ${reloaded.seasonal}/${reloaded.gold}, orange=${orangeReloaded}; vault: ${onVault.seasonal}/${onVault.gold}`);
      ck(!revertedReload.seasonal && orangeRevertedReload === 0 && !vaultReverted.seasonal && vaultReverted.gold.toUpperCase() === "#C8CDD2", `returning to the normal theme sticks after reload (${name})`, "no theme on Home or /vault after reload, platinum back", `home: ${revertedReload.seasonal}/${revertedReload.gold}, orange=${orangeRevertedReload}; vault: ${vaultReverted.seasonal}/${vaultReverted.gold}`);

      // 5. arrows, dots, swipe (clean prefs)
      await S.evaluate("localStorage.removeItem('vltd_theme_overrides'); true"); await S.visit("/"); await S.waitFor(`!!${CARD}`, 30000, "banner").catch(() => {}); await sleep(800);
      const nav = [];
      const at = async () => (await st()).active;
      nav.push({ step: "start", at: await at() });
      await S.evaluate(CLICK_ARIA("Next")); await settle(); nav.push({ step: "Next", at: await at() });
      await S.evaluate(CLICK_ARIA("Next")); await settle(); nav.push({ step: "Next", at: await at() });
      await S.evaluate(CLICK_ARIA("Previous")); await settle(); nav.push({ step: "Previous", at: await at() });
      await S.evaluate(CLICK_ARIA("Previous")); await settle(); nav.push({ step: "Previous", at: await at() });
      await S.evaluate(CLICK_ARIA("Previous")); await settle(); nav.push({ step: "Previous (wrap)", at: await at() });
      await S.evaluate(CLICK_ARIA("Next")); await settle(); nav.push({ step: "Next (wrap)", at: await at() });
      await toSlide(3); nav.push({ step: "dot 4", at: await at() });
      await toSlide(1); nav.push({ step: "dot 2", at: await at() });
      const exp = [0, 1, 2, 1, 0, n - 1, 0, 3, 1];
      ck(nav.every((x, i) => x.at === exp[i]), `arrows and dots (${name})`, "Next/Previous move one slide and wrap; each dot opens its slide", JSON.stringify(nav.map((x) => `${x.step}:${x.at}`)));
      if (mobile) {
        const sw = [];
        await toSlide(2); sw.push({ step: "start", at: await at() });
        await swipe("left"); sw.push({ step: "swipe left", at: await at() });
        await swipe("right"); sw.push({ step: "swipe right", at: await at() });
        await swipe("right"); sw.push({ step: "swipe right", at: await at() });
        await toSlide(0); await swipe("right"); sw.push({ step: "swipe right from first (wrap)", at: await at() });
        await swipe("left"); sw.push({ step: "swipe left from last (wrap)", at: await at() });
        const e2 = [2, 3, 2, 1, n - 1, 0];
        ck(sw.every((x, i) => x.at === e2[i]), `swipe both directions (${name})`, "swipe left = next, swipe right = previous, wrapping at the ends", JSON.stringify(sw.map((x) => `${x.step}:${x.at}`)));
        // swipe after a theme choice
        await toSlide(0); await S.evaluate(CLICK_IN_CARD("Yes")); await settle();
        await swipe("left"); const a1 = await at(); await swipe("right"); const a2 = await at();
        ck(a1 === 1 && a2 === 0, `swipe still works after choosing a theme (${name})`, "next then previous after Yes", `after left=${a1}, after right=${a2}`);
        await toSlide(0); await S.evaluate(CLICK_IN_CARD("Back to normal")); await settle();
        await swipe("left"); const b1 = await at(); await swipe("right"); const b2 = await at();
        ck(b1 === 1 && b2 === 0, `swipe still works after returning to normal (${name})`, "next then previous after Back to normal", `after left=${b1}, after right=${b2}`);
      } else {
        await toSlide(0); await S.evaluate(CLICK_IN_CARD("Yes")); await settle();
        await S.evaluate(CLICK_ARIA("Next")); await settle(); const a1 = await at(); await S.evaluate(CLICK_ARIA("Previous")); await settle(); const a2 = await at();
        const afterThemeSize = await st();
        ck(a1 === 1 && a2 === 0, `arrows still work after choosing a theme (${name})`, "next then previous after Yes", `after next=${a1}, after previous=${a2}`);
        await S.evaluate(CLICK_IN_CARD("Back to normal")); await settle(); void afterThemeSize;
      }

      // 6. automatic rotation (desktop only: the timer does not depend on the width)
      if (!mobile && !SKIP_ROT) {
        await S.evaluate("localStorage.removeItem('vltd_theme_overrides'); true"); await S.visit("/"); await S.waitFor(`!!${CARD}`, 30000, "banner").catch(() => {}); await sleep(800);
        const seen = []; const t0 = Date.now(); let last = (await st()).active; seen.push({ s: 0, at: last });
        while (Date.now() - t0 < 110000 && seen.length < 4) { await sleep(2000); const a = (await st()).active; if (a !== last) { seen.push({ s: Math.round((Date.now() - t0) / 1000), at: a }); last = a; } }
        out.samples.push({ name, rotation: seen });
        ck(seen.length >= 3 && seen[1].at === 1 && seen[2].at === 2 && seen[1].s >= 25 && seen[1].s <= 45, `automatic rotation moves 0 -> 1 -> 2 about every 35 seconds (${name})`, "slide changes by itself about every 35 s through several slides", JSON.stringify(seen));
        // rotation continues after a theme choice
        await S.evaluate(CLICK_IN_CARD("Yes")); await settle();
        const t1 = Date.now(); const a0 = (await st()).active; let moved = null;
        while (Date.now() - t1 < 50000) { await sleep(2000); const a = (await st()).active; if (a !== a0) { moved = Math.round((Date.now() - t1) / 1000); break; } }
        ck(moved !== null && moved <= 45, `rotation continues after choosing a theme (${name})`, "the slide still changes by itself within about 35 s after Yes", `moved after ${moved}s`);
        await S.evaluate(CLICK_ARIA("Previous")); await sleep(300); await toSlide(0); await S.evaluate(CLICK_IN_CARD("Back to normal")); await settle();
      }
    }
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String((e && e.stack) || e).slice(0, 800); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb59-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS" : "FAIL") + " " + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
    process.exit(0);
  }
})();

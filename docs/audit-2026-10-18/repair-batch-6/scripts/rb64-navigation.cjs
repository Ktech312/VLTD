// Discover navigation on PRODUCTION (RB64): Browse menu on the four public pages, Saved and Watchlist in the Account menu, active states, direct URLs, event highlights,
// browser Back, keyboard, dismissal, one menu at a time, touch targets and mobile scrolling. Isolated QA owner; nothing is written. Touch is browser-emulated.
//   AUDIT_MANIFEST=<manifest> node rb64-navigation.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session } = T;
const LABEL = process.argv[2] || "run";
const r = T.R("RB64");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [], samples: [] };

const PAGES = [
  { key: "discover", url: "/discover", title: "Discover", browse: "discover", inDiscover: true },
  { key: "market", url: "/market", title: "Marketplace", browse: "market", inDiscover: true },
  { key: "upcoming", url: "/upcoming", title: "Upcoming Comics", browse: "upcoming", inDiscover: true },
  { key: "events", url: "/events", title: "Events", browse: "events", inDiscover: true },
  { key: "saved", url: "/saved", title: "Saved", browse: null, inDiscover: false },
  { key: "watchlist", url: "/watchlist", title: "Watchlist", browse: null, inDiscover: false },
];
const BROWSE_EXPECT = [["Public collections", "/discover"], ["Marketplace", "/market"], ["Upcoming Comics", "/upcoming"], ["Events", "/events"]];

const INFO = `(() => {
  const h1 = document.querySelector('h1'); const mainActive = [...document.querySelectorAll('nav[aria-label="Primary"] a[aria-current="page"], nav[aria-label="Main navigation"] a[aria-current="page"]')].map((a) => a.textContent.trim());
  const browse = document.querySelector('button[aria-label="Browse"]');
  return { path: location.pathname + location.search, h1: h1 ? h1.textContent.trim() : null, mainActive, browse: !!browse, oldRow: !!document.querySelector('nav[aria-label="Discover"]'),
    localTabs: document.querySelectorAll('nav[data-local-nav] a[data-local-tab]').length, menus: document.querySelectorAll('[role="menu"]').length,
    active: document.activeElement ? (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent || '').trim().slice(0, 40) : null };
})()`;
const BROWSE_MENU = `(() => { const m = document.querySelector('[role="menu"][aria-label="Browse"]'); if (!m) return null; return [...m.querySelectorAll('[role="menuitem"]')].map((a) => { const rr = a.getBoundingClientRect(); return { label: a.querySelector('span') ? a.querySelector('span').textContent.trim() : a.textContent.trim(), href: a.getAttribute('href'), current: a.getAttribute('aria-current') === 'page', h: Math.round(rr.height), focused: document.activeElement === a }; }); })()`;
const ACCOUNT_LINKS = `(() => { const s = [...document.querySelectorAll('a')].find((a) => a.textContent.trim() === 'Settings' && a.getAttribute('href') === '/account'); if (!s) return null; return [...s.parentElement.children].map((el) => { const rr = el.getBoundingClientRect(); return { t: el.tagName === 'A' ? el.textContent.trim() : '(divider)', href: el.getAttribute('href'), h: Math.round(rr.height) }; }); })()`;

(async () => {
  let S;
  const ck = (ok, control, expected, actual, page) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page: page || "(navigation)", control, expected, actual: String(actual).slice(0, 700), evidence: "", impact: "navigation", repro: "" }); };
  const info = () => S.evaluate(INFO);
  async function open(w, h, mobile) {
    if (S) { try { await S.close(); } catch {} }
    S = await session("owner", { width: w, height: h, mobile });
    if (mobile) await S.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
    await S.visit("/dashboard"); await sleep(600);
  }
  async function goDirect(url) { await S.visit(url); await sleep(2500); }
  async function rect(sel) { return S.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const rr = e.getBoundingClientRect(); return { x: rr.x, y: rr.y, w: rr.width, h: rr.height }; })()`); }
  async function mouse(x, y) {
    await S.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y, button: "none" });
    await S.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1, buttons: 1 });
    await S.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1, buttons: 0 });
    await sleep(700);
  }
  async function tap(x, y) {
    await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(800);
  }
  async function press(selOrNull, mobile, sel) { const b = await rect(sel); if (!b) return false; const x = b.x + b.w / 2, y = b.y + b.h / 2; if (mobile) await tap(x, y); else await mouse(x, y); return true; }
  async function key(k, code, vk) {
    await S.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: k, code, windowsVirtualKeyCode: vk });
    await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code, windowsVirtualKeyCode: vk });
    await sleep(500);
  }
  const BROWSE_BTN = 'button[aria-label="Browse"]';
  const ACCOUNT_BTN = 'button[aria-label="Account menu"]';
  const back = async () => { await S.evaluate("history.back()"); await sleep(1800); return info(); };

  try {
    for (const [name, w, h, mobile] of [["desktop 1440", 1440, 900, false], ["phone 390 (emulated touch)", 390, 800, true]]) {
      await open(w, h, mobile);
      const tag = mobile ? "m" : "d";

      // A. every destination by direct URL
      for (const p of PAGES) {
        await goDirect(p.url); const i = await info();
        const mainOk = p.inDiscover ? JSON.stringify(i.mainActive) === JSON.stringify(["Discover"]) : i.mainActive.length === 0;
        ck(i.path === p.url && i.h1 === p.title && mainOk && i.browse === p.inDiscover && !i.oldRow && i.localTabs === 0,
          `${p.url}: title "${p.title}", ${p.inDiscover ? "Discover highlighted and Browse shown" : "Discover not highlighted and no Browse"}, no six-button row (${name})`,
          `title ${p.title}; main bar highlight ${p.inDiscover ? "Discover" : "none"}; Browse ${p.inDiscover ? "present" : "absent"}; no row`, `path=${i.path}; h1="${i.h1}"; highlighted=${JSON.stringify(i.mainActive)}; Browse=${i.browse}; old row=${i.oldRow}; local tabs=${i.localTabs}`, p.url);
      }

      // B. Browse menu on each of the four pages: items, current marked, focus on the current one
      for (const p of PAGES.filter((x) => x.inDiscover)) {
        await goDirect(p.url);
        await press(null, mobile, BROWSE_BTN); const items = await S.evaluate(BROWSE_MENU);
        const labels = items ? items.map((x) => [x.label, x.href]) : null;
        const cur = items ? items.filter((x) => x.current).map((x) => x.label) : null;
        const want = BROWSE_EXPECT.find((e) => e[1] === p.url)[0];
        ck(items && JSON.stringify(labels) === JSON.stringify(BROWSE_EXPECT) && JSON.stringify(cur) === JSON.stringify([want]) && items.find((x) => x.focused)?.label === want, `${p.url}: Browse opens with the four destinations, "${want}" marked and focused (${name})`, "4 items at the existing URLs, the current one marked (aria-current) and focused", `items=${JSON.stringify(labels)}; current=${JSON.stringify(cur)}; focused=${items && (items.find((x) => x.focused) || {}).label}`, p.url);
        if (p.key === "discover") await S.jshot(`rb64-${LABEL}-${tag}-browse-open`);
        if (mobile && p.key === "discover") ck(items && items.every((x) => x.h >= 44), `Browse items are at least 44 px tall on a phone (${name})`, "every row >= 44 px", JSON.stringify(items.map((x) => x.h)), p.url);
        await key("Escape", "Escape", 27);
      }

      // C. moving through Browse, then browser Back
      await goDirect("/discover");
      const trail = ["/discover"];
      for (const [lab, href] of [["Marketplace", "/market"], ["Upcoming Comics", "/upcoming"], ["Events", "/events"]]) {
        await press(null, mobile, BROWSE_BTN);
        const clicked = await S.evaluate(`(() => { const a = [...document.querySelectorAll('[role="menu"][aria-label="Browse"] [role="menuitem"]')].find((x) => x.textContent.includes(${JSON.stringify(lab)})); if (!a) return false; const rr = a.getBoundingClientRect(); return { x: rr.x + rr.width / 2, y: rr.y + rr.height / 2 }; })()`);
        if (clicked) { if (mobile) await tap(clicked.x, clicked.y); else await mouse(clicked.x, clicked.y); }
        await sleep(1800); const i = await info(); trail.push(i.path);
        ck(i.path === href && i.h1 === (lab === "Marketplace" ? "Marketplace" : lab) && i.menus === 0, `Browse > ${lab} opens ${href} and the menu closes (${name})`, `path ${href}, menu closed`, `path=${i.path}; h1=${i.h1}; open menus=${i.menus}`, href);
      }
      const b1 = await back(); const b2 = await back(); const b3 = await back();
      ck(b1.path === "/upcoming" && b2.path === "/market" && b3.path === "/discover", `browser Back retraces Events > Upcoming > Marketplace > Discover (${name})`, "/upcoming, /market, /discover", `${b1.path}, ${b2.path}, ${b3.path}`);

      // D. Account menu: Saved and Watchlist first
      await goDirect("/discover");
      await press(null, mobile, ACCOUNT_BTN); const links = await S.evaluate(ACCOUNT_LINKS);
      await S.jshot(`rb64-${LABEL}-${tag}-account-open`);
      const texts = links ? links.map((x) => x.t) : [];
      ck(links && texts[0] === "Saved" && texts[1] === "Watchlist" && links[0].href === "/saved" && links[1].href === "/watchlist" && texts.indexOf("Settings") === 3 && texts.slice(3, 6).join("|") === "Settings|Appearance|Invite Friends", `Account menu: Saved, Watchlist, then Settings, Appearance, Invite Friends (${name})`, "order Saved, Watchlist, (divider), Settings, Appearance, Invite Friends", texts.join(" | "));
      if (mobile) ck(links && links.filter((x) => x.t !== "(divider)").every((x) => x.h >= 44), `Account menu rows are at least 44 px tall on a phone (${name})`, "rows >= 44 px", JSON.stringify(links.map((x) => [x.t, x.h])));
      await key("Escape", "Escape", 27);
      // Saved, Watchlist from another page, then Back
      for (const [lab, href, title] of [["Saved", "/saved", "Saved"], ["Watchlist", "/watchlist", "Watchlist"]]) {
        await press(null, mobile, ACCOUNT_BTN);
        const pos = await S.evaluate(`(() => { const a = [...document.querySelectorAll('a')].find((x) => x.textContent.trim() === ${JSON.stringify(lab)} && x.getAttribute('href') === ${JSON.stringify(href)}); if (!a) return null; const rr = a.getBoundingClientRect(); return { x: rr.x + rr.width / 2, y: rr.y + rr.height / 2 }; })()`);
        if (pos) { if (mobile) await tap(pos.x, pos.y); else await mouse(pos.x, pos.y); }
        await sleep(2000); const i = await info();
        ck(i.path === href && i.h1 === title && i.mainActive.length === 0 && !i.browse && i.menus === 0, `Account > ${lab} opens ${href}: own title, Discover not highlighted, no Browse, menu closed (${name})`, "own page; no Discover highlight; no Browse; menu closed", `path=${i.path}; h1=${i.h1}; highlighted=${JSON.stringify(i.mainActive)}; Browse=${i.browse}; menus=${i.menus}`, href);
      }
      const bs = await back(); ck(bs.path === "/saved", `Back from Watchlist returns to Saved (${name})`, "/saved", bs.path);
      const bd = await back(); ck(bd.path === "/discover", `Back again returns to Discover (${name})`, "/discover", bd.path);

      // E. one menu at a time
      await goDirect("/market");
      await press(null, mobile, BROWSE_BTN);
      await S.evaluate(`document.querySelector(${JSON.stringify(ACCOUNT_BTN)}).click(); true`); await sleep(900);
      const m1 = await S.evaluate(`({ browse: !!document.querySelector('[role="menu"][aria-label="Browse"]'), account: !![...document.querySelectorAll('a')].find((a) => a.textContent.trim() === 'Settings' && a.getAttribute('href') === '/account') })`);
      await S.evaluate(`document.querySelector(${JSON.stringify(BROWSE_BTN)}).click(); true`); await sleep(900);
      const m2 = await S.evaluate(`({ browse: !!document.querySelector('[role="menu"][aria-label="Browse"]'), account: !![...document.querySelectorAll('a')].find((a) => a.textContent.trim() === 'Settings' && a.getAttribute('href') === '/account') })`);
      ck(m1.account && !m1.browse && m2.browse && !m2.account, `opening Account closes Browse, and opening Browse closes Account (${name})`, "never both open", `after Account opened: ${JSON.stringify(m1)}; after Browse opened: ${JSON.stringify(m2)}`);
      await key("Escape", "Escape", 27);
      if (!mobile) {
        // a real mouse click on the Account button while Browse is open
        await press(null, false, BROWSE_BTN); const ab = await rect(ACCOUNT_BTN); await mouse(ab.x + ab.w / 2, ab.y + ab.h / 2);
        const m3 = await S.evaluate(`({ browse: !!document.querySelector('[role="menu"][aria-label="Browse"]'), account: !![...document.querySelectorAll('a')].find((a) => a.textContent.trim() === 'Settings' && a.getAttribute('href') === '/account') })`);
        ck(!(m3.browse && m3.account), `a real click on the Account button while Browse is open never leaves both open (${name})`, "at most one open", JSON.stringify(m3));
        await mouse(5, 400); await key("Escape", "Escape", 27);
      }

      // F. dismissal
      await goDirect("/events");
      await press(null, mobile, BROWSE_BTN); await key("Escape", "Escape", 27);
      let d1 = await info(); ck(d1.menus === 0 && d1.active === "Browse", `Escape closes Browse and focus returns to its button (${name})`, "menu closed, focus on Browse", `menus=${d1.menus}; focus=${d1.active}`);
      await press(null, mobile, BROWSE_BTN); await (mobile ? tap(8, 420) : mouse(8, 420));
      d1 = await info(); ck(d1.menus === 0 && d1.path.startsWith("/events"), `a press outside closes Browse without navigating (${name})`, "menu closed, still on Events", `menus=${d1.menus}; path=${d1.path}`);
      await press(null, mobile, ACCOUNT_BTN); await key("Escape", "Escape", 27);
      d1 = await info(); ck(!(await S.evaluate(`!![...document.querySelectorAll('a')].find((a) => a.textContent.trim() === 'Settings' && a.getAttribute('href') === '/account')`)), `Escape closes the Account menu (${name})`, "closed", "checked");
      await press(null, mobile, BROWSE_BTN);
      await S.evaluate("history.pushState({}, '', '/events?x=1'); window.dispatchEvent(new PopStateEvent('popstate')); true"); await sleep(500);

      // G. keyboard
      await goDirect("/discover");
      await S.evaluate(`document.querySelector(${JSON.stringify(BROWSE_BTN)}).focus(); true`);
      await key("Enter", "Enter", 13);
      let it = await S.evaluate(BROWSE_MENU); const focused0 = it && (it.find((x) => x.focused) || {}).label;
      await key("ArrowDown", "ArrowDown", 40); it = await S.evaluate(BROWSE_MENU); const focused1 = it && (it.find((x) => x.focused) || {}).label;
      await key("ArrowDown", "ArrowDown", 40); await key("ArrowDown", "ArrowDown", 40); await key("ArrowDown", "ArrowDown", 40); it = await S.evaluate(BROWSE_MENU); const focused4 = it && (it.find((x) => x.focused) || {}).label;
      await key("ArrowUp", "ArrowUp", 38); it = await S.evaluate(BROWSE_MENU); const focusedUp = it && (it.find((x) => x.focused) || {}).label;
      ck(focused0 === "Public collections" && focused1 === "Marketplace" && focused4 === "Public collections" && focusedUp === "Events", `keyboard: Enter opens on the current item, arrows move and wrap (${name})`, "Public collections, Marketplace, wrap to Public collections, Up to Events", `${focused0}, ${focused1}, ${focused4}, ${focusedUp}`);
      await key("Enter", "Enter", 13); await sleep(1500); let ki = await info();
      ck(ki.path === "/events" && ki.h1 === "Events", `keyboard: Enter on "Events" opens /events (${name})`, "/events", `${ki.path} ${ki.h1}`);
      await S.evaluate(`document.querySelector(${JSON.stringify(BROWSE_BTN)}).focus(); true`); await key(" ", "Space", 32);
      it = await S.evaluate(BROWSE_MENU); ck(!!it, `keyboard: Space opens Browse (${name})`, "open", it ? "open" : "closed");
      await key("Tab", "Tab", 9); ki = await info(); ck(ki.menus === 0, `keyboard: Tab leaves and closes the menu (${name})`, "closed", `menus=${ki.menus}`);

      // I. event highlight and Back
      await goDirect("/events?highlight=freshcomics-la-comic-con-2026");
      const hi = await S.evaluate(`({ path: location.pathname + location.search, text: document.body.innerText.slice(0, 5000), browse: !!document.querySelector('button[aria-label="Browse"]') })`);
      ck(hi.path === "/events?highlight=freshcomics-la-comic-con-2026" && /L\.A\. Comic Con/.test(hi.text) && hi.browse, `an event link (?highlight=) still opens that event, with Browse beside the title (${name})`, "LA Comic Con selected; Browse present", `path=${hi.path}; event shown=${/L\.A\. Comic Con/.test(hi.text)}; Browse=${hi.browse}`);
      await press(null, mobile, BROWSE_BTN);
      const mk = await S.evaluate(`(() => { const a = [...document.querySelectorAll('[role="menu"][aria-label="Browse"] [role="menuitem"]')].find((x) => x.textContent.includes('Marketplace')); const rr = a.getBoundingClientRect(); return { x: rr.x + rr.width / 2, y: rr.y + rr.height / 2 }; })()`);
      if (mobile) await tap(mk.x, mk.y); else await mouse(mk.x, mk.y); await sleep(1800);
      const bh = await back(); ck(bh.path === "/events?highlight=freshcomics-la-comic-con-2026", `Back from Marketplace returns to the highlighted event URL (${name})`, "/events?highlight=...", bh.path);

      // J. mobile scrolling
      if (mobile) {
        await goDirect("/market");
        const SC = "document.querySelector('.vltd-content-wrap').scrollTop";
        const drag = async (x, y, dy) => { await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] }); for (let k = 1; k <= 10; k++) { await S.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + dy * k / 10 }] }); await sleep(16); } await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(900); };
        const bb = await rect(BROWSE_BTN); const s0 = await S.evaluate(SC);
        await drag(bb.x + bb.w / 2, bb.y + bb.h / 2, -260); const s1 = await S.evaluate(SC);
        const stay = await info();
        ck(s1 > s0 + 80 && stay.path === "/market" && stay.menus === 0, `a vertical finger drag that starts on the Browse button scrolls the page and opens nothing (${name})`, "page scrolls; no menu; no navigation", `scroll ${s0} -> ${s1}; menus=${stay.menus}; path=${stay.path}`, "/market");
        await S.evaluate(SC + " = 0"); await sleep(300);
        await press(null, true, BROWSE_BTN); const opened = await S.evaluate(BROWSE_MENU);
        await drag(200, 520, -240); const afterScroll = await info(); const s2 = await S.evaluate(SC);
        ck(opened && afterScroll.menus === 0 && s2 > 60, `with Browse open, scrolling the page closes the menu and the page scrolls (${name})`, "menu closed, page scrolled", `menu was open=${!!opened}; menus after=${afterScroll.menus}; scroll=${s2}`, "/market");
        await S.evaluate(SC + " = 0");
        const tb = await rect(BROWSE_BTN);
        const hitAbove = await S.evaluate(`(() => { const e = document.elementFromPoint(${tb.x + tb.w / 2}, ${tb.y - 5}); return !!e && (e.closest('button') || {}).getAttribute && (e.closest('button').getAttribute('aria-label') === 'Browse'); })()`);
        const hitBelow = await S.evaluate(`(() => { const e = document.elementFromPoint(${tb.x + tb.w / 2}, ${tb.y + tb.h + 5}); return !!e && !!e.closest('button') && e.closest('button').getAttribute('aria-label') === 'Browse'; })()`);
        ck(hitAbove && hitBelow, `the Browse button's touch area reaches 44 px (${name})`, "points 5 px above and below the button still hit it", `button ${Math.round(tb.h)} px high; above=${hitAbove}; below=${hitBelow}`, "/market");
      }
      await goDirect("/market"); await press(null, mobile, BROWSE_BTN); await S.jshot(`rb64-${LABEL}-${tag}-market-browse`);
      await key("Escape", "Escape", 27);
    }
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String((e && e.stack) || e).slice(0, 800); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb64-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS" : "FAIL") + " " + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
    process.exit(0);
  }
})();

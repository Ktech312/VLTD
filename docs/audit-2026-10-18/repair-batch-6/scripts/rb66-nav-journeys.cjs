// Navigation on PRODUCTION (RB66): the desktop header (Home, Vault, Exhibitions, Insights, More), the More menu, complete journeys from Home with clicks counted and
// destination labels checked, direct URLs, active states, browser Back, the phone bar, and public-content privacy on Discover. Isolated QA owner; nothing is written.
//   AUDIT_MANIFEST=<manifest> node rb66-nav-journeys.cjs <label>
const path = require("path");
const fs = require("fs");
const SD = path.join(__dirname, "..", "..", "scripts");
const T = require(path.join(SD, "audit-s-add-lib.cjs"));
const { sleep, session, admin, man } = T;
const m = man(); const P = m.personalId;
const LABEL = process.argv[2] || "run";
const r = T.R("RB66");
const EV = path.join(__dirname, "..", "evidence"); fs.mkdirSync(EV, { recursive: true });
const out = { label: LABEL, cases: [], journeys: {}, notes: {} };

const NAVSTATE = `(() => { const nav = document.querySelector('nav[aria-label="Primary"]'); if (!nav) return null;
  const links = [...nav.querySelectorAll('a')].map((a) => ({ label: a.textContent.trim(), href: new URL(a.href).pathname, current: a.getAttribute('aria-current') === 'page' }));
  const more = [...nav.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith('More'));
  return { links, more: !!more, moreActive: !!more && !!more.querySelector('span[class*="absolute"]') }; })()`;
const HEAD = `(() => ({ url: location.pathname + location.search, h1: (document.querySelector('h1') || {}).textContent || '', title: document.title }))()`;

(async () => {
  let S;
  const ck = (ok, control, expected, actual, page) => { out.cases.push({ ok: !!ok, control }); r.check(!!ok, { page: page || "/", control, expected, actual: String(actual).slice(0, 700), evidence: "", impact: "navigation", repro: "" }); };
  const clickText = async (text, scope = "document") => S.evaluate(`(() => { const root = ${scope}; const el = [...root.querySelectorAll('a,button,[role="menuitem"]')].find((x) => x.textContent.replace(/\\s+/g, ' ').trim().startsWith(${JSON.stringify(text)}) && x.getBoundingClientRect().width > 0); if (!el) return false; el.click(); return true; })()`);
  const waitUrl = async (re, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const u = await S.evaluate("location.pathname + location.search"); if (re.test(u)) return u; await sleep(300); } return await S.evaluate("location.pathname + location.search"); };
  const home = async () => { await S.visit("/dashboard"); await sleep(2500); };
  async function journey(name, steps, expectUrl, expectText, shot) {
    await home(); let clicks = 0; const log = [];
    for (const step of steps) {
      const ok = await step.run(); if (ok === false) { log.push({ step: step.label, ok: false }); break; }
      if (step.counts !== false) clicks += 1; await sleep(step.wait || 1500); log.push({ step: step.label, ok: true });
    }
    const url = await waitUrl(expectUrl, 12000); await sleep(1500);
    const head = await S.evaluate(HEAD); const text = await S.evaluate("document.body.innerText.replace(/\\s+/g, ' ')");
    if (shot) await S.jshot(`rb66-${LABEL}-${shot}`);
    out.journeys[name] = { clicks, url, h1: head.h1, log };
    return { clicks, url, head, text, log, ok: expectUrl.test(url) && expectText.test(text) && log.every((l) => l.ok) };
  }
  try {
    const item = (await admin.from("vault_items").select("id,title,status").eq("profile_id", P).eq("status", "COLLECTION").limit(1)).data[0];
    S = await session("owner", { width: 1440, height: 900 });
    await home();
    // A. header
    const nav = await S.evaluate(NAVSTATE);
    out.notes.headerHome = nav;
    ck(nav && JSON.stringify(nav.links.map((l) => l.label)) === JSON.stringify(["Home", "Vault", "Exhibitions", "Insights"]) && nav.more, "desktop header reads Home, Vault, Exhibitions, Insights, More", "four links and a More menu", JSON.stringify(nav), "/dashboard");
    ck(nav && nav.links.find((l) => l.label === "Home").current, "Home is marked current on Home", "aria-current on Home", JSON.stringify(nav && nav.links), "/dashboard");
    // More menu
    await clickText("More", `document.querySelector('nav[aria-label="Primary"]')`); await sleep(700);
    const menu = await S.evaluate(`[...document.querySelectorAll('[role="menuitem"], [role="menu"] a')].map((a) => a.textContent.replace(/\\s+/g, ' ').trim())`);
    await S.jshot(`rb66-${LABEL}-more-menu`);
    ck(menu.length === 5 && ["Discover", "Events", "VLT Lounge", "Activity", "Learn"].every((l, i) => menu[i] && menu[i].startsWith(l)), "More lists Discover, Events, VLT Lounge, Activity, Learn (signed in)", "five entries with a one-line description each", JSON.stringify(menu), "/dashboard");
    await S.evaluate("document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true"); await sleep(400);

    // B. journeys from Home
    let j = await journey("find an item", [
      { label: "click the header search", run: () => S.evaluate(`(() => { const i = document.querySelector('input[placeholder^="Search vault"]'); if (!i) return false; i.focus(); return true; })()`) },
      { label: "type the item name and press Enter", counts: true, run: async () => { await S.send("Input.insertText", { text: item.title }); await sleep(900); await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }); return true; }, wait: 3000 },
    ], /\/vault/, new RegExp(item.title.slice(0, 12).replace(/[^\w ]/g, ".")), "j-find-item");
    ck(j.ok && j.clicks <= 2, "find an item: header search, then Enter", "2 steps, lands in the Vault showing the item", `${j.clicks} steps → ${j.url}; h1="${j.head.h1}"`, "journey");

    j = await journey("add an item", [{ label: "click Add Item on Home", run: () => clickText("Add Item") }], /\/capture/, /Scan|Capture|Add manually|camera|Take photo/i, "j-add-item");
    ck(j.ok && j.clicks === 1, "add an item: Add Item on Home", "1 click to the add screen", `${j.clicks} click → ${j.url}; h1="${j.head.h1}"`, "journey");
    j = await journey("quick add", [{ label: "click Quick Add on Home", run: () => clickText("Quick Add") }], /\/vault\/quick/, /Quick Add|photo|Finish/i, "j-quick-add");
    ck(j.ok && j.clicks === 1, "add an item: Quick Add on Home", "1 click", `${j.clicks} click → ${j.url}`, "journey");

    const click1 = (label, pred) => ({ label, run: async () => { S.dialogs.length = 0; S.dialogMode = "dismiss"; return S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => ${pred} && x.getBoundingClientRect().width > 0); if (!b) return false; b.click(); return true; })()`); }, wait: 1500 });
    j = await journey("sell an item (Gallery view)", [
      { label: "Vault", run: () => clickText("Vault", `document.querySelector('nav[aria-label="Primary"]')`), wait: 3500 },
      { label: "Gallery view", run: () => S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Gallery'); if (!b) return false; b.click(); return true; })()`), wait: 2500 },
      click1("Sell on an item card", "x.textContent.trim() === 'Sell'"),
    ], /\/vault/, /Vault/, "j-sell");
    const prompts = S.dialogs.map((d) => d.message);
    ck(j.ok && j.clicks === 3 && prompts.some((p) => /sale price/i.test(p)), "sell one: Vault, Gallery view, Sell asks for the sale price (cancelled here, nothing sold)", "3 clicks to the sale-price question", `${j.clicks} clicks; prompts: ${JSON.stringify(prompts)}`, "journey");
    const stillCollection = (await admin.from("vault_items").select("status").eq("id", item.id).single()).data;
    ck(stillCollection && stillCollection.status === "COLLECTION", "cancelling the sale price left the item unsold", "status unchanged", JSON.stringify(stillCollection), "database");
    j = await journey("sell a listed item (For Sale)", [
      { label: "Vault", run: () => clickText("Vault", `document.querySelector('nav[aria-label="Primary"]')`), wait: 2500 },
      { label: "For Sale", run: () => clickText("For Sale", `document.querySelector('nav[aria-label="Vault"]') || document`), wait: 3000 },
      click1("Mark sold", "x.textContent.trim() === 'Mark sold'"),
    ], /\/vault\/for-sale/, /For Sale/i, "j-mark-sold");
    const prompts2 = S.dialogs.map((d) => d.message);
    ck(j.ok && j.clicks === 3 && prompts2.some((p) => /sale price/i.test(p)), "sell a listed item: Vault, For Sale, Mark sold asks for the sale price (cancelled)", "3 clicks to the sale-price question", `${j.clicks} clicks; prompts: ${JSON.stringify(prompts2)}`, "journey");
    j = await journey("for sale list", [
      { label: "Vault", run: () => clickText("Vault", `document.querySelector('nav[aria-label="Primary"]')`), wait: 2500 },
      { label: "For Sale", run: () => clickText("For Sale", `document.querySelector('nav[aria-label="Vault"]') || document`), wait: 2500 },
    ], /\/vault\/for-sale/, /For Sale/i, "j-for-sale");
    ck(j.ok && j.clicks === 2, "see what is for sale: Vault, For Sale", "2 clicks", `${j.clicks} clicks → ${j.url}`, "journey");

    j = await journey("insurance", [
      { label: "Vault", run: () => clickText("Vault", `document.querySelector('nav[aria-label="Primary"]')`), wait: 2500 },
      { label: "Insurance", run: () => clickText("Insurance", `document.querySelector('nav[aria-label="Vault"]') || document`), wait: 2500 },
    ], /\/insurance/, /Insurance/i, "j-insurance");
    const insNav = await S.evaluate(NAVSTATE);
    ck(j.ok && j.clicks === 2 && insNav.links.find((l) => l.label === "Vault").current, "open Insurance: Vault, Insurance (Vault stays highlighted)", "2 clicks", `${j.clicks} clicks → ${j.url}; current: ${insNav.links.filter((l) => l.current).map((l) => l.label)}`, "journey");

    j = await journey("insights", [{ label: "Insights", run: () => clickText("Insights", `document.querySelector('nav[aria-label="Primary"]')`), wait: 2500 }], /\/portfolio/, /Insights|TOTAL VAULT VALUE/i, "j-insights");
    const insightsNav = await S.evaluate(NAVSTATE);
    ck(j.ok && j.clicks === 1 && insightsNav.links.filter((l) => l.current).map((l) => l.label).join() === "Insights", "check Insights: one click, Insights highlighted", "1 click, only Insights current", `${j.clicks} click → ${j.url}; current: ${insightsNav.links.filter((l) => l.current).map((l) => l.label)}`, "journey");

    j = await journey("events", [
      { label: "More", run: () => clickText("More", `document.querySelector('nav[aria-label="Primary"]')`), wait: 800 },
      { label: "Events", run: () => clickText("Events", `document.querySelector('[role="menu"]') || document`), wait: 2500 },
    ], /\/events/, /Events/, "j-events");
    const evNav = await S.evaluate(NAVSTATE);
    ck(j.ok && j.clicks === 2 && evNav.moreActive, "find an event: More, Events (More highlighted)", "2 clicks to the Events page", `${j.clicks} clicks → ${j.url}; h1="${j.head.h1}"; More active: ${evNav.moreActive}`, "journey");

    j = await journey("saved via account menu", [
      { label: "open the account menu", run: () => S.evaluate(`(() => { const b = document.querySelector('button[aria-label*="ccount"], button[aria-haspopup="menu"][aria-label*="rofile"]') || [...document.querySelectorAll('header button, [data-site-chrome] button')].find((x) => /account|profile|menu/i.test(x.getAttribute('aria-label') || '')); if (!b) return false; b.click(); return true; })()`), wait: 800 },
      { label: "Saved", run: () => clickText("Saved"), wait: 2500 },
    ], /\/saved/, /Saved/, "j-saved-account");
    ck(j.ok && j.clicks === 2, "return to Saved from anywhere: account menu, Saved", "2 clicks", `${j.clicks} clicks → ${j.url}; h1="${j.head.h1}"`, "journey");

    j = await journey("saved via Discover", [
      { label: "More", run: () => clickText("More", `document.querySelector('nav[aria-label="Primary"]')`), wait: 800 },
      { label: "Discover", run: () => clickText("Discover", `document.querySelector('[role="menu"]') || document`), wait: 3500 },
      { label: "Saved (beside the search)", run: () => clickText("Saved", `document.querySelector('[aria-label="Your saved and watched"]') || document`), wait: 2500 },
    ], /\/saved/, /Saved/, "j-saved-discover");
    ck(j.ok && j.clicks === 3, "Saved from Discover: More, Discover, Saved shortcut", "3 clicks, the shortcut is visible beside the search", `${j.clicks} clicks → ${j.url}`, "journey");
    j = await journey("watchlist via Discover", [
      { label: "More", run: () => clickText("More", `document.querySelector('nav[aria-label="Primary"]')`), wait: 800 },
      { label: "Discover", run: () => clickText("Discover", `document.querySelector('[role="menu"]') || document`), wait: 3500 },
      { label: "Watchlist (beside the search)", run: () => clickText("Watchlist", `document.querySelector('[aria-label="Your saved and watched"]') || document`), wait: 2500 },
    ], /\/watchlist/, /Watchlist/, "j-watchlist-discover");
    ck(j.ok && j.clicks === 3, "Watchlist from Discover: More, Discover, Watchlist shortcut", "3 clicks", `${j.clicks} clicks → ${j.url}`, "journey");

    // C. Discover layout and links
    await S.visit("/discover"); await sleep(6000);
    const headings = await S.evaluate(`[...document.querySelectorAll('main h2')].map((h) => h.textContent.trim())`);
    out.notes.discoverHeadings = headings;
    const want = ["Collector Rooms Worth Seeing", "Trending Exhibitions", "Notable Items", "Across Every Universe", "Marketplace", "Events", "Upcoming Comics"];
    const idxs = want.map((w) => headings.indexOf(w));
    ck(idxs.every((i) => i >= 0) && idxs.every((v, i) => i === 0 || v > idxs[i - 1]) && !headings.includes("Featured Rooms"), "Discover sections in the requested order, no repeated Featured Rooms block", "spotlight, trending, (new this week), notable items, universes, marketplace, events, comics", JSON.stringify(headings), "/discover");
    const links = await S.evaluate(`(() => { const hrefOf = (sel, label) => { const a = [...document.querySelectorAll(sel + ' a')].find((x) => x.textContent.includes(label)); return a ? new URL(a.href).pathname : null; }; return { market: hrefOf('[data-testid="discover-marketplace"]', 'Open Marketplace'), events: hrefOf('[data-testid="discover-events"]', 'See all events'), comics: hrefOf('[data-testid="discover-upcoming"]', 'Open Upcoming Comics') }; })()`);
    ck(links.market === "/market" && links.events === "/events" && links.comics === "/upcoming", "Marketplace, Events and Upcoming Comics sections have clearly labelled links to their pages", "/market, /events, /upcoming", JSON.stringify(links), "/discover");
    const prevSame = await S.evaluate(`(async () => { const names = [...document.querySelectorAll('[data-testid="discover-events"] a[aria-label]')].map((a) => a.getAttribute('aria-label').split(',')[0]); return names; })()`);
    await S.visit("/events"); await sleep(5000);
    const eventsPageText = await S.evaluate("document.body.innerText");
    ck(prevSame.length > 0 && prevSame.every((n) => eventsPageText.includes(n)), "Discover's Events preview shows events that are on the Events page", "every previewed event appears on /events", `preview: ${JSON.stringify(prevSame)}`, "/discover → /events");
    const notable = await S.evaluate(`(async () => 0)()`);
    void notable;

    // D. direct URLs and the active states
    const direct = {};
    for (const p of ["/dashboard", "/vault", "/museum", "/portfolio", "/discover", "/events", "/community-board", "/activity", "/learn", "/market", "/upcoming", "/saved", "/watchlist", "/vault/for-sale", "/vault/sold", "/goals", "/insurance"]) {
      await S.visit(p); await sleep(1800);
      const st = await S.evaluate(`({ url: location.pathname, nav: ${NAVSTATE.trim()}, h1: (document.querySelector('h1') || {}).textContent || '' })`);
      direct[p] = { url: st.url, h1: st.h1, current: st.nav ? st.nav.links.filter((l) => l.current).map((l) => l.label).join("|") : null, moreActive: st.nav ? st.nav.moreActive : null };
    }
    out.notes.direct = direct;
    const expectCur = { "/dashboard": "Home", "/vault": "Vault", "/museum": "Exhibitions", "/portfolio": "Insights", "/vault/for-sale": "Vault", "/vault/sold": "Vault", "/goals": "Vault", "/insurance": "Vault" };
    const expectMore = ["/discover", "/events", "/community-board", "/activity", "/learn", "/market", "/upcoming"];
    const badCur = Object.entries(expectCur).filter(([p, l]) => direct[p].url !== p || direct[p].current !== l);
    const badMore = expectMore.filter((p) => direct[p].url !== p || direct[p].moreActive !== true || direct[p].current !== "");
    const badNone = ["/saved", "/watchlist"].filter((p) => direct[p].url !== p || direct[p].moreActive || direct[p].current !== "");
    ck(badCur.length === 0, "direct URLs open and highlight the right header link", "each URL loads and its link is current", JSON.stringify(badCur.length ? badCur.map(([p]) => [p, direct[p]]) : "all match"), "direct URLs");
    ck(badMore.length === 0, "More is highlighted on Discover, Events, Lounge, Activity, Learn, Marketplace and Upcoming Comics", "More current, no direct link current", JSON.stringify(badMore.map((p) => [p, direct[p]])), "direct URLs");
    ck(badNone.length === 0, "Saved and Watchlist highlight nothing", "no header item current", JSON.stringify(badNone.map((p) => [p, direct[p]])), "/saved, /watchlist");

    // E. Back button
    await home(); await sleep(3000);
    await clickText("Insights", `document.querySelector('nav[aria-label="Primary"]')`); const b0 = await waitUrl(/\/portfolio/); await sleep(1200);
    await clickText("More", `document.querySelector('nav[aria-label="Primary"]')`); await sleep(600);
    await clickText("Events", `document.querySelector('[role="menu"]') || document`); await waitUrl(/\/events/); await sleep(1200);
    await S.evaluate("history.back(); true"); const back1 = await waitUrl(/\/portfolio/); await sleep(800);
    const navAfterBack = await S.evaluate(NAVSTATE);
    await S.evaluate("history.back(); true"); const back2 = await waitUrl(/\/dashboard/);
    out.notes.backSteps = { afterInsights: b0, back1, back2 };
    ck(back1 === "/portfolio" && navAfterBack.links.filter((l) => l.current).map((l) => l.label).join() === "Insights" && back2 === "/dashboard", "browser Back returns through Events, Insights, Home with the right highlight", "Events → Insights → Home", `${back1}; current ${navAfterBack.links.filter((l) => l.current).map((l) => l.label)}; then ${back2}`, "history");
    await S.close();

    // F. phone: bottom bar unchanged and every More destination still reachable
    S = await session("owner", { width: 390, height: 800, mobile: true });
    await home();
    const bottom = await S.evaluate(`[...document.querySelectorAll('nav[aria-label="Main navigation"] a')].map((a) => a.textContent.trim()).filter((t) => !/^(Quick Add|Add Item)$/.test(t))`);
    ck(JSON.stringify(bottom) === JSON.stringify(["Home", "Vault", "Exhibitions", "Lounge", "Discover"]), "phone bottom bar is unchanged (Home, Vault, Exhibitions, Lounge, Discover)", "five tabs", JSON.stringify(bottom), "/dashboard 390px");
    await S.jshot(`rb66-${LABEL}-phone-home`);
    const reach = {};
    await clickText("Discover", `document.querySelector('nav[aria-label="Main navigation"]')`); await waitUrl(/\/discover/); await sleep(6000);
    await S.jshot(`rb66-${LABEL}-phone-discover`);
    reach.events = await S.evaluate(`!![...document.querySelectorAll('[data-testid="discover-events"] a')].find((a) => new URL(a.href).pathname === '/events')`);
    reach.market = await S.evaluate(`!![...document.querySelectorAll('[data-testid="discover-marketplace"] a')].find((a) => new URL(a.href).pathname === '/market')`);
    reach.comics = await S.evaluate(`!![...document.querySelectorAll('[data-testid="discover-upcoming"] a')].find((a) => new URL(a.href).pathname === '/upcoming')`);
    reach.savedWatch = await S.evaluate(`!!document.querySelector('[aria-label="Your saved and watched"]')`);
    await clickText("Vault", `document.querySelector('nav[aria-label="Main navigation"]')`); await waitUrl(/\/vault/); await sleep(2500);
    reach.insightsInVaultBar = await S.evaluate(`!![...document.querySelectorAll('nav[aria-label="Vault"] a')].find((a) => new URL(a.href).pathname === '/portfolio' && a.textContent.trim() === 'Insights')`);
    await clickText("Lounge", `document.querySelector('nav[aria-label="Main navigation"]')`); await waitUrl(/\/community-board/); await sleep(2500);
    reach.learnInLoungeBar = await S.evaluate(`!![...document.querySelectorAll('nav[aria-label="Lounge"] a')].find((a) => new URL(a.href).pathname === '/learn')`);
    await S.visit("/dashboard"); await sleep(3000);
    reach.activityOnHome = await S.evaluate(`!![...document.querySelectorAll('a')].find((a) => new URL(a.href).pathname === '/activity')`);
    out.notes.phoneReach = reach;
    ck(Object.values(reach).every(Boolean), "phone: Events, Marketplace, Upcoming Comics and the Saved/Watchlist shortcuts on Discover; Insights in the Vault bar; Learn in the Lounge bar; Activity on Home", "every More destination still reachable", JSON.stringify(reach), "phone 390px");
    await S.close();

    // G. public content on Discover (visitor)
    S = await session("visitor", { width: 1440, height: 900 });
    await S.visit("/discover"); await sleep(7000);
    const vis = await S.evaluate(`(() => { const t = document.body.innerText; const notable = [...document.querySelectorAll('[data-testid="notable-items"] a')].map((a) => ({ href: new URL(a.href).pathname, label: a.getAttribute('aria-label') })); const savedShown = !!document.querySelector('[aria-label="Your saved and watched"]'); return { notable: notable.length, allGuestRooms: notable.every((n) => /^\\/museum\\/[^/]+\\/guest$/.test(n.href)), hiddenShown: /Hidden Item/.test(document.querySelector('[data-testid="notable-items"]')?.innerText || ''), savedShown, privateWords: /purchase price|cost basis|paid \\$/i.test(t) }; })()`);
    const navVisitor = await S.evaluate(NAVSTATE);
    const moreVisitor = await S.evaluate(`(() => { const b = [...document.querySelectorAll('nav[aria-label="Primary"] button')].find((x) => x.textContent.trim().startsWith('More')); if (!b) return null; b.click(); return true; })()`); await sleep(600);
    const visitorMenu = await S.evaluate(`[...document.querySelectorAll('[role="menuitem"], [role="menu"] a')].map((a) => a.textContent.replace(/\\s+/g, ' ').trim().split(' ')[0])`);
    void moreVisitor;
    out.notes.visitor = { vis, navVisitor, visitorMenu };
    ck(vis.notable > 0 && vis.allGuestRooms && !vis.hiddenShown && !vis.savedShown && !vis.privateWords, "a visitor sees public items only (each opens a public room), no hidden items, no cost, no personal shortcuts", "public-only", JSON.stringify(vis), "/discover (visitor)");
    ck(visitorMenu.length === 4 && !visitorMenu.includes("Activity"), "a visitor's More menu leaves out Activity (it needs an account)", "Discover, Events, VLT Lounge, Learn", JSON.stringify(visitorMenu), "/discover (visitor)");
    await S.close(); S = null;
  } catch (e) { console.error("RUNNER ERROR", e); out.error = String((e && e.stack) || e).slice(0, 900); }
  finally {
    try { if (S) await S.close(); } catch {}
    fs.writeFileSync(path.join(EV, `rb66-${LABEL}.json`), JSON.stringify(out, null, 1));
    console.log(out.cases.map((c) => (c.ok ? "PASS " : "FAIL ") + c.control).join("\n"), out.error ? "\nRUNNER ERROR " + out.error : "");
    process.exit(0);
  }
})();

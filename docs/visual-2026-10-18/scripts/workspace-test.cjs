// Vault workspace checks: one persistent header + tab row across Items / For Sale / Sold / Insights / Goals; black strip gone.
//   node workspace-test.cjs --base=http://localhost:3000
process.env.CHROME_PROFILE_ROOT = process.env.CHROME_PROFILE_ROOT || "C:/Users/EK/AppData/Local/Temp/qa-c";
const { browser, sleep } = require("./journey-lib.cjs");
const BASE = (process.argv.find((a) => a.startsWith("--base=")) || "--base=http://localhost:3000").slice(7);
let pass = 0, fail = 0;
const check = (n, ok, d) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n, ok ? "" : JSON.stringify(d ?? "").slice(0, 500)); };
const TABS = [
  { path: "/vault", key: "Items", ready: "/TOTAL VALUE/.test(document.body.innerText) && document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", action: /Add Item|Quick Add/i },
  { path: "/vault/for-sale", key: "For Sale", ready: "document.querySelector('[data-vault-workspace=\"for-sale\"]') && document.body.innerText.length > 150", action: null },
  { path: "/vault/sold", key: "Sold", ready: "/Realized Profit/i.test(document.body.innerText)", action: /Sales History/ },
  { path: "/portfolio", key: "Insights", ready: "/TOTAL VAULT VALUE/i.test(document.body.innerText)", action: /Collection tools/ },
  { path: "/goals", key: "Goals", ready: "document.querySelector('[data-vault-workspace=\"goals\"]') && /Create Goal/.test(document.body.innerText)", action: /Create Goal/ },
];
(async () => {
  const S = await browser(BASE, { width: 1440, height: 900 });
  try {
    for (const t of TABS) {
      await S.go(t.path); await S.waitFor(t.ready, 180000, t.path); await sleep(1500);
      const r = await S.evaluate(`(() => { const navs = [...document.querySelectorAll('nav[aria-label="Vault"]')]; const n = navs[0]; const cur = n && n.querySelector('[aria-current="page"]'); const h1s = [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()); const hdr = document.querySelector('[data-workspace-actions]'); const bg = n ? getComputedStyle(n).backgroundColor : null; return { navCount: navs.length, active: cur && cur.textContent.trim(), tabs: n ? [...n.querySelectorAll('a')].map((a) => a.textContent.trim()) : [], h1s, actions: hdr ? hdr.innerText : null, bg, sw: document.documentElement.scrollWidth, vw: innerWidth, navLeft: n && Math.round(n.getBoundingClientRect().left), h1Left: Math.round(document.querySelector('h1').getBoundingClientRect().left) }; })()`);
      check(`[7 ${t.key}] one tab row, tabs Items/For Sale/Sold/Insights/Goals, '${t.key}' marked current`, r.navCount === 1 && r.active === t.key && r.tabs.join(",") === "Items,For Sale,Sold,Insights,Goals", r);
      check(`[7 ${t.key}] one page title 'Vault' (no second header)`, r.h1s.filter((x) => x === "Vault").length === 1 && r.h1s.length === 1, r.h1s);
      check(`[7 ${t.key}] header buttons for this tab are in the shared header`, t.action ? t.action.test(r.actions || "") : true, r.actions);
      check(`[6 ${t.key}] no black rectangle behind the tabs (transparent background)`, r.bg === "rgba(0, 0, 0, 0)" || r.bg === "transparent", r.bg);
      check(`[7 ${t.key}] title and tab row share the same left edge; no sideways scroll`, Math.abs(r.navLeft - r.h1Left) <= 1 && r.sw <= r.vw, r);
    }
    // persistence: client-side tab switching keeps the SAME header and tab row elements
    await S.go("/vault"); await S.waitFor(TABS[0].ready, 180000, "vault"); await sleep(1500);
    await S.evaluate("document.querySelector('h1').__mark = 'H'; document.querySelector('nav[aria-label=\"Vault\"]').__mark = 'N'; true");
    const same = async () => S.evaluate("({ h: document.querySelector('h1')?.__mark, n: document.querySelector('nav[aria-label=\"Vault\"]')?.__mark, p: location.pathname })");
    for (const t of [TABS[2], TABS[3], TABS[4], TABS[1], TABS[0]]) {
      await S.evaluate(`[...document.querySelectorAll('nav[aria-label="Vault"] a')].find((a) => a.textContent.trim() === ${JSON.stringify(t.key)}).click(); true`);
      await S.waitFor(`location.pathname === ${JSON.stringify(t.path)}`, 30000, "to " + t.key); await S.waitFor(t.ready, 120000, "ready " + t.key); await sleep(600);
      const x = await same();
      check(`[7] clicking ${t.key}: URL is ${t.path} and the header and tab row are the same page elements (not rebuilt)`, x.p === t.path && x.h === "H" && x.n === "N", x);
    }
    // filter kept across a tab round trip (the Items list restores its own filters)
    await S.evaluate("(() => { const i = document.querySelector('input[placeholder=\"Search...\"]'); if (!i) return false; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'Album 5'); i.dispatchEvent(new Event('input', { bubbles: true })); return true; })()");
    await sleep(900);
    const filteredCount = await S.evaluate("document.querySelectorAll('a[href^=\"/vault/item/\"]').length");
    await S.evaluate("[...document.querySelectorAll('nav[aria-label=\"Vault\"] a')].find((a) => a.textContent.trim() === 'Sold').click(); true");
    await S.waitFor("location.pathname === '/vault/sold'", 30000, "sold"); await sleep(1200);
    await S.evaluate("history.back(); true"); await S.waitFor("location.pathname === '/vault'", 30000, "back"); await S.waitFor(TABS[0].ready, 90000, "items again"); await sleep(1500);
    const afterBack = await S.evaluate("({ q: (document.querySelector('input[placeholder=\"Search...\"]') || {}).value, n: document.querySelectorAll('a[href^=\"/vault/item/\"]').length, h: document.querySelector('h1')?.__mark })");
    check("[7] Back from Sold returns to Items with the same header and the search filter still applied", afterBack.h === "H" && afterBack.q === "Album 5" && afterBack.n === filteredCount, { afterBack, filteredCount });
    await S.evaluate("history.forward(); true"); await S.waitFor("location.pathname === '/vault/sold'", 30000, "forward");
    check("[7] Forward goes to Sold again", (await same()).h === "H");
    // refresh keeps place
    await S.go("/goals"); await S.waitFor(TABS[4].ready, 180000, "goals reload"); await sleep(800);
    check("[7] refreshing on Goals stays on Goals with the tab row", (await S.path()) === "/goals" && (await S.evaluate("document.querySelector('nav[aria-label=\"Vault\"] [aria-current=page]')?.textContent.trim()")) === "Goals");
    // universe pages keep their own header (not part of the five tabs)
    await S.go("/vault/comics"); await sleep(6000);
    const uni = await S.evaluate("({ ws: !!document.querySelector('[data-vault-workspace]'), h1: document.querySelector('h1')?.textContent })");
    check("[7] a universe page (/vault/comics) is outside the workspace and keeps its own header", uni.ws === false, uni);
  } catch (e) { console.log("STOPPED", e.message); fail++; } finally { await S.close(); }
  // phone
  const P = await browser(BASE, { width: 390, height: 844, mobile: true });
  try {
    for (const t of TABS) {
      await P.go(t.path); await P.waitFor(t.ready, 180000, "phone " + t.path); await sleep(1200);
      const r = await P.evaluate("({ sw: document.documentElement.scrollWidth, vw: innerWidth, navs: document.querySelectorAll('nav[aria-label=\"Vault\"]').length, nb: getComputedStyle(document.querySelector('nav[aria-label=\"Vault\"]')).backgroundColor })");
      check(`[7 phone ${t.key}] one tab row, transparent, no sideways scroll`, r.navs === 1 && r.sw <= r.vw && r.nb === "rgba(0, 0, 0, 0)", r);
    }
  } catch (e) { console.log("STOPPED-P", e.message); fail++; } finally { await P.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("ERR", e.message || e); process.exit(2); });

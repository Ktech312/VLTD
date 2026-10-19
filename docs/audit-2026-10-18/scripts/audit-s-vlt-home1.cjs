// VLT suite 1: Home /dashboard figures, value-basis controls, drill-down links (owner, Personal, 1440). Run with AUDIT_MANIFEST=...
const V = require("./audit-s-vlt-lib.cjs");
const { R, sleep, squash, money } = V; const r = R("VLT");
const PG = "/dashboard | owner, Personal, 26 owned + 5 sold";
const tile = (S, hrefStart) => S.evaluate(`(() => { const a = [...document.querySelectorAll('section[aria-label="Collection overview"] a')].find((x) => (x.getAttribute('href') || '').startsWith(${JSON.stringify(hrefStart)})); return a ? { text: a.innerText.replace(/\\s+/g, ' ').trim(), href: a.getAttribute('href') } : null; })()`);
const overview = (S) => S.evaluate("(document.querySelector('section[aria-label=\"Collection overview\"]') || document.body).innerText.replace(/\\s+/g, ' ')");

async function follow(S, from, js, wantPath, label) {
  await S.visit(from);
  const ok = await V.clickEl(S, js, { js: true });
  if (!ok) return { ok: false, why: "element not found" };
  const t0 = Date.now(); while (Date.now() - t0 < 12000) { const p = await S.path(); if (!p.startsWith(from.split("#")[0]) || p.includes("#") || p !== from) break; await sleep(250); }
  await S.settle({ max: 20000 }); await sleep(800);
  return { ok: true, path: await S.path() };
}

(async () => {
  const m = V.man();
  const all = await V.rows(m.personalId); const e = V.expected(all);
  const S = await V.session("owner");
  try {
    await S.visit("/dashboard");
    await S.evaluate("localStorage.removeItem('vltd_value_mode_v1'); true"); await S.visit("/dashboard");
    // ---------- A. figures vs database
    const pc = await tile(S, "/portfolio#cost-breakdown"), ev = await tile(S, "/portfolio#value-history"), uc = await tile(S, "/portfolio#movers"), sr = await tile(S, "/vault/sold");
    r.check(!!pc && pc.text.includes(money(e.cost)), { page: PG, control: "Purchase Cost tile", expected: `Sum of tax+shipping+fees+price of the ${e.count} owned items = ${money(e.cost)}; sold items excluded`, actual: pc && pc.text, evidence: await S.jshot("vlt-home-figures-1440"), impact: "misleading result", repro: "Sign in as fixture owner; open /dashboard; compare Purchase Cost with the sum of owned items' purchase fields in the database" });
    const evExp = [`${e.pricedN} of ${e.count} priced`, `${e.ghost} at purchase cost`, `${e.missing} missing value, not counted`];
    r.check(!!ev && ev.text.includes(money(e.filled)) && evExp.every((x) => ev.text.includes(x)), { page: PG, control: "Estimated Value tile", expected: `Value rule: explicit values ${money(e.priced)} (${e.pricedN} items incl. one explicit $0) + purchase-cost for ${e.ghost} unpriced = ${money(e.filled)}; caption '${evExp.join(" · ")}'`, actual: ev && ev.text, evidence: "shots/vlt-home-figures-1440.jpg", impact: "misleading result", repro: "Open /dashboard; compare Estimated Value and its caption with values computed from vault_items using src/lib/vaultStats.ts" });
    const gainTxt = `${e.gain >= 0 ? "+" : "-"}${money(e.gain)} (${e.gain >= 0 ? "+" : "-"}${Math.abs(e.gainPct).toFixed(1)}%)`;
    r.check(!!uc && uc.text.includes(gainTxt) && uc.text.includes(`On ${e.gainN} of ${e.count} items · cost basis ${money(e.costBase)}`) && uc.text.includes(`Not counted: ${e.noValue} without a value`), { page: PG, control: "Unrealized Change tile", expected: `${gainTxt} on ${e.gainN} of ${e.count} items, cost basis ${money(e.costBase)}, ${e.noValue} without a value not counted`, actual: uc && uc.text, evidence: "shots/vlt-home-figures-1440.jpg", impact: "misleading result", repro: "Open /dashboard; compare Unrealized Change with value minus cost over items having both" });
    r.check(!!sr && sr.text.includes(money(e.revenue)) && sr.text.includes(`${e.soldCount} sold`) && /Not counted: 1 sold without a recorded cost/.test(sr.text), { page: PG, control: "Sales Revenue tile", expected: `${money(e.revenue)} from ${e.soldCount} sold, 1 sold without recorded cost disclosed`, actual: sr && sr.text, evidence: "shots/vlt-home-figures-1440.jpg", impact: "misleading result", repro: "Open /dashboard; compare Sales Revenue with the sum of sold_price in the database" });
    const pill = await S.evaluate("(() => { const a = [...document.querySelectorAll('a')].find((x) => /Open your Vault/i.test(x.getAttribute('aria-label') || '')); return a ? { label: a.getAttribute('aria-label'), text: a.innerText.trim(), href: a.getAttribute('href') } : null; })()");
    r.check(pill && pill.text.startsWith(`${e.count} items`) && pill.href === "/vault", { page: PG, control: "'26 items · Open Vault' pill", expected: `Says ${e.count} items (owned count, sold excluded) and links to /vault`, actual: JSON.stringify(pill), impact: "misleading result", repro: "Open /dashboard; read pill under the name" });
    const insights = await S.evaluate("(() => { const a = [...document.querySelectorAll('section[aria-label=\"Collection overview\"] a[href=\"/portfolio\"]')][0]; return a ? a.innerText.replace(/\\s+/g,' ') : null; })()");
    const byU = {}; for (const x of e.owned) { const u = ["POP_CULTURE", "SPORTS", "MUSIC", "TCG", "MISC"].includes(x.universe) ? x.universe : "MISC"; byU[u] = (byU[u] || 0) + 1; }
    r.check(!!insights && Object.values(byU).every((n) => insights.includes(` ${n} `) || insights.includes(`${n}`)) && insights.includes(`${e.count} items across ${Object.keys(byU).length} universes`), { page: PG, control: "Insights summary panel (universe bars)", expected: `Bars per universe ${JSON.stringify(byU)} and '${e.count} items across ${Object.keys(byU).length} universes'`, actual: insights, impact: "misleading result", repro: "Open /dashboard; read the Insights panel" });

    // ---------- B. value-basis controls
    const pickBtn = (re) => `[...document.querySelectorAll('section[aria-label="Collection overview"] button')].find((b) => ${re}.test(b.textContent))`;
    const beforeAll = { pc: pc.text, uc: uc.text, sr: sr.text };
    const okc = await V.clickEl(S, pickBtn("/Show priced only/"), { js: true }); await sleep(900);
    const ev2 = await tile(S, "/portfolio#value-history"), pc2 = await tile(S, "/portfolio#cost-breakdown"), uc2 = await tile(S, "/portfolio#movers"), sr2 = await tile(S, "/vault/sold"), ov2 = await overview(S);
    r.check(okc && ev2.text.includes(money(e.priced)) && /Include unpriced/.test(ov2) && /10 of 26 priced · 16 left out/.test(ev2.text) && pc2.text === beforeAll.pc && uc2.text === beforeAll.uc && sr2.text === beforeAll.sr, { page: PG, control: "Show priced only", expected: `Estimated Value becomes ${money(e.priced)} ('10 of 26 priced · 16 left out'), the button flips to 'Include unpriced', and Purchase Cost / Unrealized Change / Sales Revenue are unchanged`, actual: `EV: ${ev2 && ev2.text}; button now: ${/Include unpriced/.test(ov2)}; cost same ${pc2.text === beforeAll.pc}; gain same ${uc2.text === beforeAll.uc}; sales same ${sr2.text === beforeAll.sr}`, evidence: await S.jshot("vlt-home-priced-only"), impact: "misleading result", repro: "Open /dashboard; click 'Show priced only'; read the four tiles" });
    const stored = await S.evaluate("localStorage.getItem('vltd_value_mode_v1')");
    await S.visit("/dashboard"); const ev3 = await tile(S, "/portfolio#value-history");
    r.check(stored === "priced" && ev3.text.includes(money(e.priced)), { page: PG, control: "Show priced only (persistence)", expected: "The chosen basis is remembered on this device after reload", actual: `stored=${stored}; after reload EV tile: ${ev3 && ev3.text}`, impact: "usability", repro: "Click 'Show priced only', reload /dashboard" });
    // does the choice reach the other pages that show the value (Vault summary, Insights)? just record it
    await V.clickEl(S, pickBtn("/Include unpriced/"), { js: true }); await sleep(800);
    const ev4 = await tile(S, "/portfolio#value-history");
    r.check(ev4.text.includes(money(e.filled)) && /Show priced only/.test(await overview(S)), { page: PG, control: "Include unpriced", expected: `Switches back: Estimated Value ${money(e.filled)}, button reads 'Show priced only'`, actual: ev4.text, impact: "misleading result", repro: "After 'Show priced only', click 'Include unpriced'" });
    // What does this change?
    const wd = async () => S.evaluate("(() => { const b = [...document.querySelectorAll('button')].find((x) => /What does this change/.test(x.textContent)); const p = document.getElementById('home-basis-explainer'); return { expanded: b && b.getAttribute('aria-expanded'), shown: !!p, text: p ? p.innerText.replace(/\\s+/g, ' ').slice(0, 400) : '' }; })()");
    const w0 = await wd(); await V.clickEl(S, pickBtn("/What does this change/"), { js: true }); await sleep(500); const w1 = await wd();
    await V.clickEl(S, pickBtn("/What does this change/"), { js: true }); await sleep(500); const w2 = await wd();
    const explained = /Purchase cost.*Estimated value.*Unrealized change.*Sales revenue/.test(w1.text);
    r.check(!w0.shown && w1.shown && w1.expanded === "true" && explained && !w2.shown && w2.expanded === "false", { page: PG, control: "What does this change?", expected: "Toggles an explainer of all four figures (opens, aria-expanded true; closes again)", actual: JSON.stringify({ w0: w0.shown, w1: w1.shown, w1exp: w1.expanded, explained, w2: w2.shown }), evidence: "", impact: "usability", repro: "Open /dashboard, click 'What does this change?' twice" });
    // does the explainer claim match reality: Priced only 'leaves them out'; Purchase cost 'every item you own. The setting does not change it'
    r.check(/does not change it/.test(w1.text), { page: PG, control: "What does this change? (claims)", expected: "Explainer says setting changes only Estimated Value; verified above that cost/gain/sales stayed identical", actual: w1.text.slice(0, 300), impact: "none", repro: "see Show priced only row" });

    // ---------- C. drill-down links (real mouse click) and what they land on
    const L = [
      ["Purchase Cost tile 'Cost breakdown ›'", "a[href=\"/portfolio#cost-breakdown\"]", /^\/portfolio#cost-breakdown$/, async () => { const t = await S.evaluate("(() => { const el = document.getElementById('cost-breakdown'); if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), text: el.innerText.replace(/\\s+/g,' ').slice(0, 300) }; })()"); return t; }, "cost breakdown section present with the same total"],
      ["Estimated Value tile 'Value history ›'", "a[href=\"/portfolio#value-history\"]", /^\/portfolio#value-history$/, async () => S.evaluate("(() => { const el = document.getElementById('value-history'); if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), text: el.innerText.replace(/\\s+/g,' ').slice(0, 300) }; })()"), "value history section"],
      ["Unrealized Change tile 'Biggest movers ›'", "a[href=\"/portfolio#movers\"]", /^\/portfolio#movers$/, async () => S.evaluate("(() => { const el = document.getElementById('movers'); if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), text: el.innerText.replace(/\\s+/g,' ').slice(0, 300) }; })()"), "movers section"],
      ["Sales Revenue tile 'Sales analytics ›'", "section[aria-label=\"Collection overview\"] a[href=\"/vault/sold#sales-analytics\"]", /^\/vault\/sold#sales-analytics$/, async () => S.evaluate("(() => { const el = document.getElementById('sales-analytics'); if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top), text: el.innerText.replace(/\\s+/g,' ').slice(0, 300) }; })()"), "sales analytics section"],
      ["Activity panel 'Activity ›'", "section[aria-label=\"Collection overview\"] a[href=\"/activity\"]", /^\/activity$/, async () => ({ text: squash(await S.text()).slice(0, 200) }), "activity feed"],
      ["'View Vault →' (Recently added header)", "a[href=\"/vault\"]:not([aria-label])", /^\/vault$/, async () => ({ text: squash(await S.text()).slice(0, 200) }), "vault list"],
      ["'Open all exhibitions'", "a[aria-label=\"Open all exhibitions\"]", /^\/museum$/, async () => ({ text: squash(await S.text()).slice(0, 200) }), "exhibitions hub"],
      ["'Create exhibition'", "a[href=\"/museum/new\"]", /^\/museum\/new$/, async () => ({ text: squash(await S.text()).slice(0, 200) }), "create exhibition page"],
      ["'Open Lounge →'", "a[href=\"/community-board\"]", /^\/community-board/, async () => ({ text: squash(await S.text()).slice(0, 200) }), "Lounge"],
      ["'Open Learn →'", "a[href=\"/learn\"]", /^\/learn$/, async () => ({ text: squash(await S.text()).slice(0, 200) }), "Learn"],
      ["'Quick Add'", "a[href=\"/vault/quick\"]", /^\/vault\/quick/, async () => ({ text: squash(await S.text()).slice(0, 200) }), "quick add"],
      ["'Add Item'", "[data-add-item-actions] a[href=\"/capture\"]", /^\/capture/, async () => ({ text: squash(await S.text()).slice(0, 200) }), "capture"],
      ["'26 items · Open Vault' pill", "a[aria-label^=\"Open your Vault\"]", /^\/vault$/, async () => ({ text: squash(await S.text()).slice(0, 200) }), "vault list"],
      ["Insights panel", "section[aria-label=\"Collection overview\"] a[href=\"/portfolio\"]", /^\/portfolio$/, async () => ({ text: squash(await S.text()).slice(0, 200) }), "insights"],
      ["Price-check notice 'Open Vault'", "div[role=status] a[href=\"/vault\"]", /^\/vault$/, async () => ({ text: squash(await S.text()).slice(0, 200) }), "vault list"],
    ];
    for (const [label, sel, wantPath, probe, what] of L) {
      const res = await follow(S, "/dashboard", `document.querySelector(${JSON.stringify(sel)})`, wantPath, label);
      if (!res.ok) { r.fail({ page: PG, control: label, expected: "Click lands on " + what, actual: "control not found on the page: " + res.why, impact: "blocked workflow", repro: "Open /dashboard and look for it" }); continue; }
      const landed = await probe(); const pathOk = wantPath.test(res.path);
      let extra = "";
      if (/#/.test(res.path) && landed) extra = ` target top=${landed.top}px`;
      const anchorOk = !/#/.test(res.path) || (landed && landed.top >= 0 && landed.top < 700);
      const evid = pathOk && anchorOk ? "" : await S.jshot("vlt-home-link-" + label.replace(/[^a-z0-9]+/gi, "-").slice(0, 30).toLowerCase());
      r.check(pathOk && anchorOk && !!landed, { page: PG, control: label, expected: `Mouse click opens ${wantPath} showing ${what}; hash targets exist and are scrolled into view`, actual: `landed ${res.path}${extra}; ${landed ? (landed.text || "").slice(0, 160) : "NO TARGET ELEMENT FOUND"}`, evidence: evid, impact: "blocked workflow", repro: `Open /dashboard; click '${label}'` });
    }
    // landing numbers agree with home
    await S.visit("/portfolio");
    const pt = squash(await S.text());
    r.check(pt.includes(money(e.cost)) && pt.includes(money(e.filled)), { page: "/portfolio | owner, Personal, 26 owned + 5 sold (reached from Home tiles)", control: "Home totals vs Insights totals", expected: `Insights shows the same Purchase Cost ${money(e.cost)} and Estimated Value ${money(e.filled)} as Home`, actual: pt.slice(0, 500), evidence: await S.jshot("vlt-insights-top"), impact: "misleading result", repro: "Compare /dashboard tiles with /portfolio headline figures" });
    await S.visit("/vault/sold"); const st = squash(await S.text());
    const homeProfit = /Profit ([+-]\$[\d,]+) after estimated fees/.exec(sr.text);
    r.check(st.includes(money(e.revenue)) && homeProfit && st.includes(homeProfit[1].replace("+", "+")), { page: "/vault/sold | owner, Personal", control: "Home Sales Revenue vs Sold page", expected: `Sold page shows ${money(e.revenue)} and the same profit ${homeProfit && homeProfit[1]} as Home`, actual: st.slice(0, 500), evidence: await S.jshot("vlt-sold-top"), impact: "misleading result", repro: "Compare Home Sales tile with /vault/sold analytics" });
  } finally { console.log("errors", S.consoleErrors.slice(0, 5)); await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });

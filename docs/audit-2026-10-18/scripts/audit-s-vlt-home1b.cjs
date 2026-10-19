// VLT suite 1b: re-run of the checks whose FIRST run was a test mistake (explainer text truncated at 400 chars; hash anchors read before the page scrolled; two links matched the header nav instead of the card link; Insights top shows value only).
const V = require("./audit-s-vlt-lib.cjs");
const { R, sleep, squash, money } = V; const r = R("VLT");
const PG = "/dashboard | owner, Personal, 26 owned + 5 sold";
(async () => {
  const m = V.man(); const e = V.expected(await V.rows(m.personalId));
  const S = await V.session("owner");
  try {
    r.pass({ page: PG, control: "(test note) first run of VLT-010, VLT-012..015, VLT-027", expected: "n/a", actual: "First run failed because MY checks were wrong: explainer text was cut at 400 chars before 'Sales revenue'; hash targets were measured 0.8 s after load, before the app scrolled them into view (top=782px at 0.5 s, 168px from 2 s); Insights headline shows value not cost. First-failure rows are kept; the affected checks were re-run once below (VLT-029..).", evidence: "", impact: "none", repro: "see audit-s-vlt-home1.cjs vs audit-s-vlt-home1b.cjs" });
    // explainer
    await S.visit("/dashboard");
    await V.clickEl(S, "[...document.querySelectorAll('button')].find((x) => /What does this change/.test(x.textContent))", { js: true }); await sleep(500);
    const full = await S.evaluate("(document.getElementById('home-basis-explainer') || { innerText: '' }).innerText.replace(/\\s+/g, ' ')");
    r.check(/Purchase cost.*Estimated value.*Unrealized change.*Sales revenue/.test(full), { page: PG, control: "What does this change? (explainer covers the four figures)", expected: "Explainer describes Purchase cost, Estimated value, Unrealized change, Sales revenue", actual: full.slice(0, 700), impact: "usability", repro: "Open /dashboard; click 'What does this change?'" });
    // anchors
    for (const h of ["cost-breakdown", "value-history", "movers"]) {
      await S.visit("/dashboard"); await V.clickEl(S, `a[href="/portfolio#${h}"]`); await sleep(500);
      const t0 = await S.evaluate(`Math.round(document.getElementById(${JSON.stringify(h)})?.getBoundingClientRect().top ?? -1)`);
      await S.settle({ max: 20000 }); await sleep(3000);
      const t1 = await S.evaluate(`(() => { const el = document.getElementById(${JSON.stringify(h)}); const r = el && el.getBoundingClientRect(); return r ? { top: Math.round(r.top), text: el.innerText.replace(/\\s+/g, ' ').slice(0, 200) } : null; })()`);
      r.check(!!t1 && t1.top >= 0 && t1.top < 400, { page: PG, control: `Home tile link to /portfolio#${h}`, expected: "Lands on Insights with that section scrolled to the top of the view", actual: `after 0.5 s section top=${t0}px; after settle+3 s top=${t1 && t1.top}px; ${t1 && t1.text}`, evidence: await S.jshot("vlt-home-anchor-" + h), impact: "usability", repro: `Open /dashboard, click the tile whose link is /portfolio#${h}` });
    }
    await S.visit("/dashboard"); await V.clickEl(S, 'section[aria-label="Collection overview"] a[href="/vault/sold#sales-analytics"]'); await S.settle({ max: 20000 }); await sleep(3000);
    const sa = await S.evaluate("(() => { const el = document.getElementById('sales-analytics'); const r = el && el.getBoundingClientRect(); return r ? { top: Math.round(r.top), text: el.innerText.replace(/\\s+/g, ' ').slice(0, 200) } : null; })()");
    r.check(!!sa && sa.top >= 0 && sa.top < 400, { page: PG, control: "Home Sales Revenue tile link to /vault/sold#sales-analytics", expected: "Sold page with the analytics section in view", actual: JSON.stringify(sa), evidence: await S.jshot("vlt-home-anchor-sales"), impact: "usability", repro: "Open /dashboard, click Sales Revenue tile" });
    // text links in cards (precise)
    for (const [label, re, want] of [["'View Vault →' in the Recently added header", "View Vault", /^\/vault$/], ["'Open Lounge →' in the From the Lounge header", "Open Lounge", /^\/community-board/], ["'Open Learn →' in the Learn header", "Open Learn", /^\/learn$/]]) {
      await S.visit("/dashboard");
      const href = await S.evaluate(`[...document.querySelectorAll('main a')].find((a) => /${re}/.test(a.textContent))?.getAttribute('href')`);
      await V.clickEl(S, `[...document.querySelectorAll('main a')].find((a) => /${re}/.test(a.textContent))`, { js: true }); await sleep(1500); await S.settle();
      const p = await S.path(); const h1 = await S.evaluate("(document.querySelector('h1') || {}).innerText");
      r.check(want.test(p), { page: PG, control: label, expected: `Card link (not the header nav) opens ${want}`, actual: `href=${href}; landed ${p}; h1='${h1}'`, impact: "blocked workflow", repro: `Open /dashboard; click ${label}` });
    }
    // Insights totals
    await S.visit("/portfolio"); const pt = squash(await S.text());
    const byU = pt.match(/Cost \$[\d,]+/g) || []; const sumCost = byU.map((x) => Number(x.replace(/[^\d]/g, ""))).reduce((a, b) => a + b, 0);
    r.check(pt.includes("TOTAL VAULT VALUE") && pt.includes(money(e.filled)) && sumCost === Math.round(e.cost), { page: "/portfolio | owner, Personal, 26 owned + 5 sold", control: "Insights headline value and cost-by-universe vs Home", expected: `TOTAL VAULT VALUE ${money(e.filled)} and the per-universe Cost figures add up to ${money(e.cost)} (Home Purchase Cost)`, actual: `value shown: ${pt.includes(money(e.filled))}; sum of 'Cost $' figures=${sumCost}`, evidence: "shots/vlt-insights-top.jpg", impact: "misleading result", repro: "Open /portfolio; add the per-universe Cost figures" });
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });

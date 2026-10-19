// VLT suite 11: Insights with the empty Business profile, connection refused / offline, phone 390 (browser-emulated).
const X = require("./audit-s-vlt-vlib.cjs");
const { R, sleep, squash, clickEl, admin, blockRest, offline, touchSwipe } = X; const r = R("VLT");
(async () => {
  const m = X.man(); const P = m.personalId, B = m.businessId;
  await admin.from("vault_items").delete().eq("id", `qa_vlt_${m.stamp}_b1`);
  const bRows = (await admin.from("vault_items").select("id").eq("profile_id", B)).data;
  const BS = await X.session("business");
  try {
    await BS.visit("/portfolio"); await sleep(1500); const t = squash(await BS.text());
    const links = await BS.evaluate("[...document.querySelectorAll('main a')].map((a) => a.innerText.trim() + ' -> ' + a.getAttribute('href'))");
    r.check(bRows.length === 0 && /No items yet/.test(t) && !/QA Album|QA VLT/.test(t) && links.some((l) => /Smart Scan -> \/capture/.test(l)) && links.some((l) => /Add manually -> \/vault\/add/.test(l)), { page: "/portfolio | owner, Business, 0 items", control: "Empty Insights", expected: "'No items yet' with Smart Scan (/capture) and Add manually (/vault/add), no Personal data", actual: `${bRows.length} rows in db; ${t.slice(t.indexOf("Insights"), t.indexOf("Insights") + 300)} | ${JSON.stringify(links)}`, evidence: await BS.jshot("vlt-insights-business-empty"), impact: "misleading result", repro: "Business profile; open /portfolio" });
    for (const p of ["/portfolio/insurance", "/portfolio/universe/MUSIC", "/portfolio/universe/MUSIC/category/Audio%20Formats"]) {
      await BS.visit(p); await sleep(1000); const x = squash(await BS.text());
      r.check(!/QA Album|QA VLT|QA Sold/.test(x), { page: `${p} | owner, Business, 0 items`, control: "Empty Business profile: no Personal data", expected: "No Personal items", actual: x.slice(x.indexOf("Level 1") >= 0 ? x.indexOf("Level 1") : 40, 300), impact: "privacy/data loss", repro: `Business; open ${p}` });
    }
  } finally { await BS.close(); }

  // ---------- connection refused, nothing saved on this device
  const F = await X.session("owner");
  try {
    await F.visit("/robots.txt"); await blockRest(F, true); await F.go("/portfolio");
    let t = 0, tx = ""; for (; t < 30; t++) { await sleep(1000); tx = squash(await F.text()); if (/No items yet|could not load|couldn.t load/i.test(tx)) break; }
    const err = /could not load|couldn.t load/i.test(tx); const fake = /No items yet/.test(tx);
    r.check(err && !fake, { page: "/portfolio | owner, Personal, 44 records, data connection refused, nothing saved on this device", control: "Insights when the cloud refuses (503)", expected: "A could-not-load message with Retry; never 'No items yet' as if the collection were empty", actual: `after ${t}s: ${tx.slice(tx.indexOf("Insights") >= 0 ? tx.indexOf("Insights") : 100, 420)}`, evidence: await F.jshot("vlt-insights-refused"), impact: "misleading result", repro: "Fresh browser; refuse supabase REST; open /portfolio" });
    await F.visit("/portfolio/insurance"); await sleep(4000); const ti = squash(await F.text());
    r.check(!/(Stated value: \$0|Purchase cost: \$0)/.test(ti) || /could not load|couldn.t load/i.test(ti), { page: "/portfolio/insurance | refused connection, nothing saved on this device", control: "Insurance summary when the cloud refuses", expected: "A could-not-load message, not a summary of $0", actual: ti.slice(ti.indexOf("INSURANCE REPORT"), ti.indexOf("INSURANCE REPORT") + 260), evidence: await F.jshot("vlt-insurance-refused"), impact: "misleading result", repro: "same, open /portfolio/insurance" });
    await F.visit("/portfolio/universe/MUSIC"); await sleep(4000); const tu = squash(await F.text());
    r.check(/could not load|couldn.t load/i.test(tu) || !/No items yet/.test(tu), { page: "/portfolio/universe/MUSIC | refused connection, nothing saved on this device", control: "Universe drill-down when the cloud refuses", expected: "A could-not-load message, not 'No items yet'", actual: tu.slice(tu.indexOf("PORTFOLIO"), tu.indexOf("PORTFOLIO") + 260), evidence: await F.jshot("vlt-universe-refused"), impact: "misleading result", repro: "same, open /portfolio/universe/MUSIC" });
    await blockRest(F, false);
    // saved copy + refused
    await F.visit("/vault"); await blockRest(F, true); await F.visit("/portfolio"); await sleep(8000);
    const ts = squash(await F.text());
    r.check(/TOTAL VAULT VALUE/.test(ts) && (/couldn.t refresh|Showing saved data/i.test(ts)), { page: "/portfolio | saved copy, refresh refused", control: "Insights with a saved copy while the refresh fails", expected: "Saved figures shown with a 'saved data, couldn't refresh' notice", actual: `${/TOTAL VAULT VALUE/.test(ts) ? "figures shown" : "no figures"}; notice ${/couldn.t refresh|Showing saved data/i.test(ts)}`, evidence: await F.jshot("vlt-insights-stale"), impact: "misleading result", repro: "Load Vault, refuse REST, open /portfolio" });
    await blockRest(F, false);
    await offline(F, true); await F.go("/portfolio"); await sleep(5000); const off = squash(await F.text());
    r.check(!/No items yet/.test(off), { page: "/portfolio | offline (browser-emulated)", control: "Insights reload while offline", expected: "Saved Insights or an offline page; never 'No items yet'", actual: off.slice(0, 160), impact: "misleading result", repro: "Offline; reload" });
    await offline(F, false);
  } finally { await F.close(); }

  // ---------- phone 390 (browser-emulated)
  const M = await X.session("owner", { width: 390, height: 844, mobile: true });
  try {
    await M.visit("/portfolio"); await sleep(1500);
    const ov = await M.evaluate("document.documentElement.scrollWidth <= innerWidth");
    r.check(ov, { page: "/portfolio | owner, Personal, 390 phone (browser-emulated)", control: "Insights layout at 390px", expected: "No sideways page scroll", actual: `fits: ${ov}; overflow px: ${await M.evaluate("document.documentElement.scrollWidth - innerWidth")}`, evidence: await M.jshot("vlt-insights-390", { full: true }), impact: "usability", repro: "Open /portfolio at 390" });
    const cards = squash(await M.text());
    r.check(/TOTAL VAULT VALUE/.test(cards) && /VALUE BREAKDOWN/.test(cards) && /PORTFOLIO MOVERS/.test(cards), { page: "/portfolio | 390 phone", control: "Insights sections on a phone", expected: "All sections present", actual: "headline, breakdown and movers present", impact: "usability", repro: "scroll" });
    const ranges = await M.evaluate("[...document.querySelectorAll('button')].filter((b) => /^(7D|30D|90D|1Y)$/.test(b.textContent.trim())).map((b) => Math.round(b.getBoundingClientRect().height))");
    r.check(ranges.length === 4 && ranges.every((h) => h >= 32), { page: "/portfolio | 390 phone", control: "Range buttons tap size", expected: "Each at least 32px tall", actual: JSON.stringify(ranges), impact: "usability", repro: "measure" });
    const rev = await M.evaluate("(() => { const s = [...document.querySelectorAll('div')].find((d) => /overflow-x-auto/.test(d.className) && d.querySelector('a[href^=\"/vault/item/\"]') && /Review/.test(d.innerText)); if (!s) return null; s.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(); return { sw: s.scrollWidth, cw: s.clientWidth, x: r.left + r.width / 2, y: r.top + 60 }; })()");
    if (rev && rev.sw > rev.cw + 10) {
      await sleep(400); const l0 = await M.evaluate("[...document.querySelectorAll('div')].find((d) => /overflow-x-auto/.test(d.className) && d.querySelector('a[href^=\"/vault/item/\"]') && /Review/.test(d.innerText)).scrollLeft");
      await touchSwipe(M, rev.x + 100, rev.y, rev.x - 120, rev.y); await sleep(800);
      const l1 = await M.evaluate("[...document.querySelectorAll('div')].find((d) => /overflow-x-auto/.test(d.className) && d.querySelector('a[href^=\"/vault/item/\"]') && /Review/.test(d.innerText)).scrollLeft");
      r.check(l1 > l0 + 40, { page: "/portfolio | 390 phone (browser-emulated touch)", control: "Items Needing Review strip swipe", expected: "Swiping scrolls the review cards sideways", actual: `scrollLeft ${l0} -> ${l1}`, evidence: await M.jshot("vlt-insights-390-review"), impact: "usability", repro: "Swipe the review cards (emulated)" });
    } else r.nt({ page: "/portfolio | 390 phone", control: "Items Needing Review strip swipe", expected: "n/a", actual: "strip not found or not wider than the screen", impact: "none", repro: "" });
  } finally { await M.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });

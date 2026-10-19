// VLT suite 9b: Insights re-runs. First-run mistakes of mine (suite 9): the history check read the small card sparkline instead of the Value History chart (VLT-354, 358, 359), a date format I guessed (VLT-360), my review-card extractor found nothing (VLT-370), my recap extractor read the page header (VLT-380/381), and one expected label spelling ('TV' vs the app's 'Tv', VLT-362).
const X = require("./audit-s-vlt-vlib.cjs");
const { R, sleep, squash, clickEl, admin } = X; const r = R("VLT");
const PG = (x) => `/portfolio | owner, Personal, 36 counted | ${x}`;
const fmt = (n) => (n < 0 ? "-" : "") + "$" + Math.round(Math.abs(n)).toLocaleString("en-US");
(async () => {
  const m = X.man(); const P = m.personalId;
  const all = await X.rows(P); const cnt = all.filter(X.counted); const E = X.expected(all);
  const days = ["2026-10-01", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]; const vals = [100, 200, 1000, 1500, 2000, 3000, 4000, 4500, 5000];
  const up = await admin.from("portfolio_value_history").upsert(days.map((d, i) => ({ profile_id: P, day: d, total_value: vals[i], total_cost: 500, by_universe: {} })), { onConflict: "profile_id,day" }); if (up.error) throw new Error(up.error.message);
  const S = await X.session("owner");
  try {
    r.pass({ page: PG("test note"), control: "(test note) corrections for VLT-354, 358, 359, 360, 362, 370, 380, 381", expected: "n/a", actual: "First-run results stay. Causes on my side: the 'range' check read the sparkline on the Total Value Change card (8 points) instead of the Value History chart; the card prints its date as 2026-10-12 not 'Oct 12'; my review-card and recap extractors read the wrong elements; the breakdown label the app prints is 'Movies / Tv / Film' (see the cosmetic row below).", evidence: "", impact: "none", repro: "audit-s-vlt-insights1.cjs vs 1b" });
    await S.visit("/vault"); await S.visit("/portfolio"); await sleep(1500);
    const hist = () => S.evaluate("(() => { const svg = [...document.querySelectorAll('svg')].find((s) => s.getAttribute('viewBox') === '0 0 980 250'); if (!svg) return { none: true, text: /Not enough history/.test(document.body.innerText) }; const pts = svg.querySelector('polyline').getAttribute('points').trim().split(' ').length; const t = [...svg.querySelectorAll('text')].map((x) => x.textContent); return { pts, x: t.slice(-3), y: t.slice(0, 5) }; })()");
    const dbPts = (await admin.from("portfolio_value_history").select("day,total_value").eq("profile_id", P).order("day")).data.filter((p) => p.day >= "2026-10-12");
    const res = {};
    for (const [lab, n] of [["7D", 7], ["30D", 30], ["90D", 90], ["1Y", 999]]) {
      await clickEl(S, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '${lab}')`, { js: true }); await sleep(700); res[lab] = await hist();
      r.check(res[lab].pts === Math.min(n, dbPts.length), { page: PG("Value History"), control: `Value History range '${lab}'`, expected: `The last ${Math.min(n, dbPts.length)} recorded points (history from 2026-10-12 on: ${dbPts.length} points)`, actual: JSON.stringify(res[lab]), evidence: lab === "7D" ? await S.jshot("vlt-insights-history-7d") : "", impact: "misleading result", repro: `Click ${lab}` });
    }
    r.check(res["7D"].pts < res["30D"].pts && res["30D"].pts === res["1Y"].pts, { page: PG("Value History"), control: "Range selector changes the chart", expected: "7D shows fewer points than 30D/90D/1Y (8 points recorded)", actual: JSON.stringify({ "7D": res["7D"].pts, "30D": res["30D"].pts, "90D": res["90D"].pts, "1Y": res["1Y"].pts, x7: res["7D"].x, x30: res["30D"].x }), impact: "misleading result", repro: "Click each range" });
    r.pass({ page: PG("Value History"), control: "1Y range and earlier points", expected: "(observation) points recorded before 2026-10-12 (old value rule) are left out by design: even 1Y starts Oct 12", actual: JSON.stringify(res["1Y"].x), impact: "improvement", repro: "Click 1Y" });
    r.pass({ page: PG("Value History"), control: "Range buttons: which is selected", expected: "(observation) the selected range is shown by colour only", actual: "no aria-pressed on 7D/30D/90D/1Y", impact: "improvement", repro: "inspect buttons" });
    const tvc = squash(await S.text()); const first = dbPts[0], last = dbPts[dbPts.length - 1]; const chg = last.total_value - first.total_value;
    r.check(tvc.includes(`TOTAL VALUE CHANGE i +${fmt(chg)}`) && tvc.includes(`since 2026-10-12`), { page: PG("Total Value Change"), control: "Total Value Change card (re-run)", expected: `+${fmt(chg)} since the first recorded day (2026-10-12)`, actual: (/TOTAL VALUE CHANGE.{0,160}/.exec(tvc) || [""])[0], impact: "misleading result", repro: "read card" });
    r.pass({ page: PG("Total Value Change"), control: "Date style on the Total Value Change card", expected: "(observation) the card prints an ISO date ('since 2026-10-12'); the chart axis prints 'Oct 12'", actual: "'since 2026-10-12'", impact: "cosmetic", repro: "compare card and chart" });
    // stale snapshot claim: change an item's value, revisit in the same browser
    const albumId = `qa_vz_${m.stamp}_1`; const before = (await admin.from("vault_items").select("current_value").eq("id", albumId).single()).data.current_value;
    await admin.from("vault_items").update({ current_value: Number(before) + 1000 }).eq("id", albumId);
    await S.visit("/dashboard"); await S.visit("/portfolio"); await sleep(1500); // pulls the new value
    const t2 = squash(await S.text()); const lastNow = (await admin.from("portfolio_value_history").select("total_value").eq("profile_id", P).eq("day", "2026-10-19").single()).data.total_value;
    const tv2 = (/TOTAL VAULT VALUE i (\$[\d,]+)/.exec(t2) || [])[1];
    r.check(tv2 === fmt(E.filled + 1000) && lastNow === E.filled + 1000, { page: PG("Value History latest point"), control: "Today's chart point after the collection changes the same day", expected: `After a $1,000 re-pricing, the card reads ${fmt(E.filled + 1000)} and today's recorded value follows (${E.filled + 1000})`, actual: `Total Vault Value card ${tv2}; today's recorded point in the database ${lastNow}`, impact: "misleading result", repro: "Open Insights, change an item's value, open Insights again the same day" });
    await admin.from("vault_items").update({ current_value: before }).eq("id", albumId);
    // review cards
    await S.visit("/vault"); await S.visit("/portfolio"); await sleep(1500);
    const cards = await S.evaluate("[...document.querySelectorAll('a[href^=\"/vault/item/\"]')].filter((a) => /Review\\s*$/.test(a.innerText.trim())).map((a) => ({ id: decodeURIComponent(a.getAttribute('href').split('/').pop()), t: a.innerText.replace(/\\s+/g, ' ').trim() }))");
    const reasonOf = (x) => { if (!X.hasPhoto(x)) return "Missing photo"; if (!X.explicit(x)) return X.basis(x).b === "missing" ? "Missing value" : "Needs valuation"; return "No recent comps"; };
    const okR = cards.length > 0 && cards.every((c) => { const row = all.find((x) => x.id === c.id); return row && c.t.includes(reasonOf(row)); });
    r.check(okR && cards.length <= 5, { page: PG("Items Needing Review"), control: "Items Needing Review cards (re-run)", expected: "Up to 5 cards; each reason matches the item (photo present: 'No recent comps' when valued, 'Needs valuation' when not)", actual: JSON.stringify(cards.map((c) => c.t)), impact: "misleading result", repro: "Read cards" });
    r.pass({ page: PG("Items Needing Review"), control: "Items Needing Review: which items", expected: "(observation) the five shown are simply the first five owned items that have any reason, not the worst five; 35 items need review but only 5 are shown and 'View all' opens the whole Vault", actual: `shown ids ${cards.map((c) => c.id.slice(-2)).join(",")}`, impact: "improvement", repro: "compare with Needs Documentation 35" });
    // cosmetic label
    const lab = await S.evaluate("[...document.querySelectorAll('a[href^=\"/portfolio/universe/\"]')].map((a) => a.innerText.split('\\n')[0].trim())");
    r.check(!lab.some((l) => /Tv\b/.test(l)), { page: PG("Value Breakdown"), control: "Category name spelling", expected: "'Movies / TV / Film' as everywhere else (Vault, Insurance)", actual: JSON.stringify(lab.filter((l) => /Movies/.test(l))), impact: "cosmetic", repro: "read the legend" });
    // recap
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Collection tools')", { js: true }); await sleep(500);
    await clickEl(S, "[...document.querySelectorAll('[role=menuitem]')].find((a) => /Collection recap/.test(a.innerText))", { js: true }); await sleep(2500);
    const rc = await S.evaluate("(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\\s+/g, ' ') : null; })()");
    const gain = cnt.filter((x) => X.explicit(x) && X.cost(x) > 0).map((x) => ({ x, g: X.effective(x) - X.cost(x) })).sort((a, b) => b.g - a.g)[0];
    r.check(!!rc && rc.includes(`ITEMS ${cnt.length}`) && rc.includes(`VALUE ${fmt(E.filled)}`) && rc.includes(`ROI +${Math.round(E.gainPct)}%`) && rc.includes(gain.x.title), { page: PG("Collection recap"), control: "Collection recap figures", expected: `Items ${cnt.length}, Value ${fmt(E.filled)}, ROI +${Math.round(E.gainPct)}%, biggest gainer ${gain.x.title} +${fmt(gain.g)}`, actual: rc, evidence: await S.jshot("vlt-insights-recap2"), impact: "misleading result", repro: "Collection tools > Collection recap" });
    await S.evaluate("window.__aud.share = 0; window.__aud.downloads.length = 0; window.__aud.blobs.length = 0; true");
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => /Generate recap card/.test(b.innerText))", { js: true }); await sleep(5000);
    const lk = await S.look(); const after = await S.evaluate("(() => { const d = document.querySelector('[role=dialog]'); return d ? d.innerText.replace(/\\s+/g, ' ') : null; })()");
    r.check(lk.blobs.length > 0 || lk.share > 0 || lk.downloads.length > 0 || /image|download|share|save/i.test(after || ""), { page: PG("Collection recap"), control: "Generate recap card", expected: "Produces a card image to save or share (sharing stubbed; nothing posted)", actual: `blobs ${JSON.stringify(lk.blobs)}, share ${lk.share}, downloads ${JSON.stringify(lk.downloads)}; sheet text now: ${(after || "").slice(0, 220)}`, evidence: await S.jshot("vlt-insights-recap-card"), impact: "blocked workflow", repro: "Collection recap > Generate recap card" });
    await S.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await sleep(600);
    const stillOpen = await S.evaluate("!!document.querySelector('[role=dialog]')");
    r.check(!stillOpen, { page: PG("Collection recap"), control: "Recap sheet closes with Escape", expected: "Sheet closes", actual: `open: ${stillOpen}`, impact: "usability", repro: "Press Escape" });
  } finally { console.log("errors", S.consoleErrors.slice(0, 4)); await S.close(); await admin.from("portfolio_value_history").delete().eq("profile_id", P).neq("day", "2026-10-19"); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });

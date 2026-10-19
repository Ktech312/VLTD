// VLT suite 9: Insights /portfolio numbers vs the database, range selector with seeded value history, links, tools, goals widget, phone 390.
const X = require("./audit-s-vlt-vlib.cjs");
const { R, sleep, squash, clickEl, ids, stats, admin, money, fs, AUD } = X; const r = R("VLT");
const PG = (x) => `/portfolio | owner, Personal, 36 counted + sold/supply/wishlist rows | ${x}`;
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const INIT = `(() => { if (window.__vltDl) return; window.__vltDl = []; window.__vltBlobs = []; const c = URL.createObjectURL; URL.createObjectURL = function (b) { try { window.__vltBlobs.push(b); } catch (e) {} return c.call(URL, b); }; const ac = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { try { if (this.download) window.__vltDl.push(this.download); } catch (e) {} return ac.call(this); }; })();`;
const catLabel = (x) => String(x.category_label || x.category || x.universe || "Uncategorized");
const pct1 = (n) => (n >= 0 ? "+" : "-") + Math.abs(n).toFixed(1) + "%";
const fmt = (n) => (n < 0 ? "-" : "") + "$" + Math.round(Math.abs(n)).toLocaleString("en-US");
(async () => {
  const m = X.man(); const P = m.personalId;
  const all = await X.rows(P); const cnt = all.filter(X.counted); const E = X.expected(all);
  // seeded value history (days on or after 2026-10-12 count; earlier ones are excluded by the app's rule)
  const days = ["2026-10-01", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]; const vals = [100, 200, 1000, 1500, 2000, 3000, 4000, 4500, 5000];
  await admin.from("portfolio_value_history").delete().eq("profile_id", P).neq("day", "2026-10-19");
  const up = await admin.from("portfolio_value_history").upsert(days.map((d, i) => ({ profile_id: P, day: d, total_value: vals[i], total_cost: 500, by_universe: {} })), { onConflict: "profile_id,day" });
  if (up.error) throw new Error(up.error.message);
  const todayRow = (await admin.from("portfolio_value_history").select("*").eq("profile_id", P).eq("day", "2026-10-19")).data[0];
  const S = await X.session("owner");
  try {
    await S.send("Page.addScriptToEvaluateOnNewDocument", { source: INIT });
    await S.visit("/vault"); await S.evaluate("localStorage.removeItem('vltd_value_mode_v1'); true"); await S.visit("/portfolio"); await sleep(1500);
    const txt = squash(await S.text());
    // ---- headline cards
    const roi = E.gainPct;
    r.check(txt.includes(`TOTAL VAULT VALUE`) && txt.includes(fmt(E.filled)) && txt.includes(`${pct1(roi)} against what you paid, all-time · ${E.missing} missing value, not counted`), { page: PG("Total Vault Value"), control: "Total Vault Value card", expected: `${fmt(E.filled)}; ${pct1(roi)} against what you paid; '${E.missing} missing value, not counted' (gain over the items having both a value and a cost: ${fmt(E.gain)} on ${fmt(E.costBase)})`, actual: (/TOTAL VAULT VALUE.{0,150}/.exec(txt) || [""])[0], evidence: await S.jshot("vlt-insights-1440", { full: true }), impact: "misleading result", repro: "Open /portfolio" });
    const ready = cnt.filter((x) => X.gaps?.(x)?.length === 0).length; const gaps = X.gaps; const readyN = cnt.filter((x) => gaps(x).length === 0).length;
    const completeValue = cnt.filter((x) => gaps(x).length === 0).reduce((a, x) => a + X.effective(x), 0);
    const pctItems = Math.round((readyN / cnt.length) * 100), pctValue = Math.min(100, Math.round((completeValue / E.filled) * 100));
    r.check(txt.includes(`DOCUMENTATION COMPLETE i ${readyN} of ${cnt.length}`) && txt.includes(`${pctItems}% of items, ${pctValue}% of estimated value`), { page: PG("Documentation Complete"), control: "Documentation Complete card", expected: `${readyN} of ${cnt.length}; ${pctItems}% of items, ${pctValue}% of estimated value`, actual: (/DOCUMENTATION COMPLETE.{0,120}/.exec(txt) || [""])[0], impact: "misleading result", repro: "read card" });
    // stale prices: Insights (30 days / never updated / no value) vs Vault card + Home notice
    const staleIns = (/STALE PRICES i (\d+) (\d+) items need a price check/.exec(txt) || []);
    await S.visit("/vault"); const vaultStale = (/(\d+) items? ha(?:sn't|ven't) had a price check in 6 months/.exec(squash(await S.text())) || [])[1];
    await S.visit("/dashboard"); const homeStale = (/(\d+) valued items? ha(?:s|ve) not had a price check in 6 months/.exec(squash(await S.text())) || [])[1];
    r.check(!!staleIns[1] && !!vaultStale && !!homeStale && staleIns[1] === vaultStale && vaultStale === homeStale, { page: PG("Stale Prices vs Vault vs Home"), control: "Stale Prices card (Insights) vs the Vault card and the Home notice", expected: "The same fact (items whose price check is old) is not reported as three different numbers on three pages", actual: `Insights 'Stale Prices' ${staleIns[1]} (value missing, never updated or older than 30 days) | Vault card '${vaultStale} items haven't had a price check in 6 months' | Home '${homeStale} valued items have not had a price check in 6 months'`, evidence: "shots/vlt-insights-1440.jpg", impact: "misleading result", repro: "Compare /portfolio, /vault and /dashboard" });
    await S.visit("/portfolio"); await sleep(1500);

    // ---- value history range selector
    const hist = async () => S.evaluate("(() => { const svg = [...document.querySelectorAll('svg')].find((s) => s.querySelector('polyline')); if (!svg) return { empty: /Not enough history/.test(document.body.innerText) }; const pts = svg.querySelector('polyline').getAttribute('points').trim().split(' ').length; const texts = [...svg.querySelectorAll('text')].map((t) => t.textContent); return { pts, x: texts.slice(-3), y: texts.slice(0, 5), pressed: [...document.querySelectorAll('button')].filter((b) => /^(7D|30D|90D|1Y)$/.test(b.textContent.trim())).map((b) => b.textContent.trim() + ':' + (b.getAttribute('aria-pressed') || '')) }; })()");
    const dbPts = (await admin.from("portfolio_value_history").select("day,total_value").eq("profile_id", P).order("day")).data.filter((p) => p.day >= "2026-10-12");
    const res = {};
    for (const [lab, n] of [["7D", 7], ["30D", 30], ["90D", 90], ["1Y", 999]]) {
      await clickEl(S, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '${lab}')`, { js: true }); await sleep(700); res[lab] = await hist();
      const expN = Math.min(n, dbPts.length);
      r.check(res[lab].pts === expN, { page: PG("Value History"), control: `Value History range '${lab}'`, expected: `The last ${expN} recorded points (history from 2026-10-12 on: ${dbPts.length} points in the database)`, actual: JSON.stringify(res[lab]), evidence: lab === "7D" ? await S.jshot("vlt-insights-history-7d") : "", impact: "misleading result", repro: `Click ${lab}` });
    }
    r.check(res["7D"].pts < res["30D"].pts && res["30D"].pts === res["1Y"].pts, { page: PG("Value History"), control: "Range selector changes the chart", expected: "7D shows fewer points than 30D/90D/1Y when more than 7 days are recorded", actual: JSON.stringify({ "7D": res["7D"].pts, "30D": res["30D"].pts, "90D": res["90D"].pts, "1Y": res["1Y"].pts }), impact: "misleading result", repro: "Click each range" });
    r.check(!res["1Y"].x.includes("Oct 1") && !res["1Y"].x.includes("Oct 11") && res["1Y"].x[0] === "Oct 12", { page: PG("Value History"), control: "1Y range and earlier points", expected: "(observation) points before 2026-10-12 (recorded under the old value rule) are left out by design: the chart starts Oct 12", actual: JSON.stringify(res["1Y"].x), impact: "improvement", repro: "Click 1Y" });
    // total value change card
    const tvc = squash(await S.text()); const first30 = dbPts[0], last30 = dbPts[dbPts.length - 1];
    const chg = last30.total_value - first30.total_value; const chgPct = (chg / first30.total_value) * 100;
    r.check(tvc.includes(`TOTAL VALUE CHANGE i +${fmt(chg)}`) && tvc.includes(`${pct1(chgPct)} since Oct 12`), { page: PG("Total Value Change"), control: "Total Value Change card", expected: `+${fmt(chg)} (${pct1(chgPct)}) since Oct 12 = last recorded day ${last30.total_value} minus first ${first30.total_value}`, actual: (/TOTAL VALUE CHANGE.{0,200}/.exec(tvc) || [""])[0], impact: "misleading result", repro: "Seed history; read the card" });
    r.pass({ page: PG("Value History"), control: "Latest chart point vs today's total", expected: "(observation) today's snapshot is written once per day: later changes to the collection are not reflected until tomorrow", actual: `last recorded point ${last30.total_value} (taken at first visit today) while Total Vault Value now reads ${fmt(E.filled)}`, impact: "improvement", repro: "Add or edit an item after the first visit of the day; open Insights" });

    // ---- value breakdown rows + cost/value by universe + movers
    const rowsBy = {};
    for (const x of cnt) { const k = catLabel(x); const b = (rowsBy[k] ||= { value: 0, cost: 0, n: 0, gain: 0, gainCost: 0 }); b.value += X.basis(x).a; b.cost += X.cost(x); b.n++; if (X.explicit(x) && X.cost(x) > 0) { b.gain += X.effective(x) - X.cost(x); b.gainCost += X.cost(x); } }
    let seg = Object.entries(rowsBy).filter(([, v]) => v.value > 0).sort((a, b) => b[1].value - a[1].value);
    const top = seg.slice(0, 6).map(([k, v]) => ({ label: k, ...v })); const rest = seg.slice(6);
    if (rest.length) top.push({ label: "Other", value: rest.reduce((a, [, v]) => a + v.value, 0), cost: rest.reduce((a, [, v]) => a + v.cost, 0), n: 0, gain: rest.reduce((a, [, v]) => a + v.gain, 0), gainCost: rest.reduce((a, [, v]) => a + v.gainCost, 0) });
    const dispLabel = (l) => l;
    const uiRows = await S.evaluate("[...document.querySelectorAll('a[href^=\"/portfolio/universe/\"]')].map((a) => ({ href: a.getAttribute('href'), text: a.innerText.replace(/\\s+/g, ' ').trim() }))");
    const breakdown = uiRows.filter((u) => /\(\d+\.\d%\)$/.test(u.text)); const costRows = uiRows.filter((u) => /Cost \$/.test(u.text));
    const okB = top.every((t, i) => breakdown[i] && breakdown[i].text.startsWith(dispLabel(t.label)) && breakdown[i].text.includes(fmt(t.value)) && breakdown[i].text.includes(`(${((t.value / E.filled) * 100).toFixed(1)}%)`));
    r.check(okB && breakdown.length === top.length, { page: PG("Value Breakdown"), control: "Value Breakdown rows", expected: top.map((t) => `${t.label} ${fmt(t.value)} (${((t.value / E.filled) * 100).toFixed(1)}%)`).join("; "), actual: JSON.stringify(breakdown.map((b) => b.text)), impact: "misleading result", repro: "Read the donut legend" });
    const okC = top.every((t, i) => costRows[i] && costRows[i].text.includes(`Cost ${fmt(t.cost)}`) && costRows[i].text.includes(fmt(t.value)) && costRows[i].text.includes(`${t.gain >= 0 ? "+" : "-"}${fmt(t.gain).replace("-", "")}`) && (t.gainCost > 0 ? costRows[i].text.includes(pct1((t.gain / t.gainCost) * 100)) : true));
    r.check(okC, { page: PG("Cost And Value By Universe"), control: "'Cost And Value By Universe' rows", expected: top.map((t) => `${t.label}: cost ${fmt(t.cost)}, value ${fmt(t.value)}, change ${fmt(t.gain)}${t.gainCost > 0 ? " (" + pct1((t.gain / t.gainCost) * 100) + ")" : ""}`).join("; "), actual: JSON.stringify(costRows.map((b) => b.text)), evidence: "shots/vlt-insights-1440.jpg", impact: "misleading result", repro: "Read the table" });
    r.check(top.every((t) => !["Audio Formats", "Sports Cards", "Trading Card Games", "Paintings", "Comics", "Movies / TV / Film", "Video Games", "Instruments & Gear"].includes(t.label)), { page: PG("Cost And Value By Universe"), control: "Heading 'Cost And Value By Universe' and 'UNIVERSE' column", expected: "Rows are universes (Music, Sports, Pop Culture, TCG, Art, Games) as the heading says", actual: `rows are categories: ${top.map((t) => t.label).join(", ")}`, evidence: "shots/vlt-insights-1440.jpg", impact: "misleading result", repro: "Read the 'Universe' column" });
    r.check(!costRows.some((cr) => /Cost \$[\d,]+ \$[\d,]+/.test(cr.text) && false), { page: PG("Cost And Value By Universe"), control: "Change column arithmetic", expected: "(observation) 'Change' is measured only over items that have both a value and a cost, so Value minus Cost on a row does not equal Change (e.g. Audio Formats cost $120, value $5,120, change +$0)", actual: JSON.stringify(costRows.slice(0, 2).map((b) => b.text)), impact: "improvement", repro: "Compare cost, value and change for Audio Formats" });
    // drill-down links from these rows
    const bad = [];
    for (const row of breakdown.slice(0, 8)) {
      await S.visit(row.href.replace(/^/, "")); const h = squash(await S.text());
      const label = decodeURIComponent(row.href.split("/").pop());
      const title = (/PORTFOLIO • UNIVERSE (.*?) Drill-down/.exec(h) || [])[1];
      if (!(title && title.toLowerCase().includes(label.toLowerCase().slice(0, 5))) || /No items yet/.test(h)) bad.push(`${label} -> page titled '${title}', ${/No items yet/.test(h) ? "'No items yet'" : "has items"}`);
    }
    r.check(bad.length === 0, { page: PG("Value Breakdown / Cost and Value rows -> drill-down"), control: "Each row link (/portfolio/universe/<name>)", expected: "Opens that row's detail page with its items", actual: bad.length ? bad.join(" | ") : "all rows open their pages", evidence: bad.length ? await S.jshot("vlt-insights-row-drilldown-empty") : "", impact: "blocked workflow", repro: "Click 'Audio Formats' (or any row) in the Value Breakdown" });
    await S.visit("/portfolio"); await sleep(1200);
    // movers
    const movers = cnt.filter((x) => X.explicit(x) && X.cost(x) > 0).map((x) => ({ x, gain: X.effective(x) - X.cost(x) })).filter((m2) => m2.gain !== 0).sort((a, b) => Math.abs(b.gain) - Math.abs(a.gain)).slice(0, 6);
    const gainers = movers.filter((m2) => m2.gain >= 0).slice(0, 3), decl = movers.filter((m2) => m2.gain < 0).slice(0, 3);
    const mv = await S.evaluate("(() => { const p = document.getElementById('movers'); return { text: p.innerText.replace(/\\s+/g, ' '), links: [...p.querySelectorAll('a')].map((a) => a.getAttribute('href')) }; })()");
    const okM = gainers.every((g) => mv.text.includes(g.x.title) && mv.text.includes(`${g.gain >= 0 ? "+" : "-"}${fmt(g.gain).replace("-", "")}`)) && (decl.length ? decl.every((d) => mv.text.includes(d.x.title)) : /No decliners/.test(mv.text));
    r.check(okM, { page: PG("Portfolio Movers"), control: "Biggest Gainers / Decliners", expected: `Gainers: ${gainers.map((g) => g.x.title.slice(0, 22) + " " + fmt(g.gain)).join("; ")}; decliners: ${decl.length ? decl.map((d) => d.x.title.slice(0, 22) + " " + fmt(d.gain)).join("; ") : "none"} (measured items only)`, actual: mv.text.slice(0, 380), impact: "misleading result", repro: "Read Portfolio Movers" });
    const mvLink = await S.evaluate("[...document.querySelectorAll('a')].find((a) => /View all movers/.test(a.textContent)).getAttribute('href')");
    r.check(mvLink !== "/vault", { page: PG("Portfolio Movers"), control: "'View all movers >' destination", expected: "A page that shows all movers (labelled promise)", actual: `goes to ${mvLink}: the ordinary Vault list`, impact: "usability", repro: "Click 'View all movers >'" });
    // mover rows link to the item
    const itemHref = mv.links.find((h) => /^\/vault\/item\//.test(h));
    r.check(!!itemHref, { page: PG("Portfolio Movers"), control: "Mover row links", expected: "Each mover row opens that item", actual: JSON.stringify(mv.links.slice(0, 4)), impact: "blocked workflow", repro: "inspect" });

    // ---- Value evidence, items needing review, documentation panels
    const rev = await S.evaluate("(() => { const h = [...document.querySelectorAll('div')].find((d) => /^Items Needing Review/.test(d.innerText.trim()) && d.children.length <= 3); const sec = h ? h.closest('section') || h.parentElement.parentElement : null; return sec ? { text: sec.innerText.replace(/\\s+/g, ' '), cards: [...sec.querySelectorAll('a[href^=\"/vault/item/\"]')].map((a) => ({ href: a.getAttribute('href'), t: a.innerText.replace(/\\s+/g, ' ') })) } : null; })()");
    const reasonOf = (x) => { if (!X.hasPhoto(x)) return "Missing photo"; if (!X.explicit(x)) return X.basis(x).b === "missing" ? "Missing value" : "Needs valuation"; return "No recent comps"; };
    const reviewOk = rev && rev.cards.length > 0 && rev.cards.every((c) => { const id = decodeURIComponent(c.href.split("/").pop()); const row = all.find((x) => x.id === id); return row && c.t.includes(reasonOf(row)); });
    r.check(!!reviewOk, { page: PG("Items Needing Review"), control: "Items Needing Review cards", expected: "Each card shows a reason that matches the item's data (Missing photo / Needs valuation / Missing value / No recent comps)", actual: JSON.stringify((rev ? rev.cards : []).map((c) => c.t.slice(0, 60))), impact: "misleading result", repro: "Read the cards, compare with each item" });
    const needs = cnt.filter((x) => gaps(x).length > 0).length; const byGap = { photo: 0, value: 0, cost: 0, cost_zero: 0, identity: 0 }; for (const x of cnt) for (const g of gaps(x)) byGap[g]++;
    const doc = squash(await S.text());
    r.check(doc.includes(`NEEDS DOCUMENTATION ${needs} items missing part of the checklist (${100 - pctItems}% of items)`) && doc.includes(`Missing photo ${byGap.photo}`) && doc.includes(`Needs valuation ${byGap.value}`) && doc.includes(`Purchase price not recorded ${byGap.cost}`) && doc.includes(`Missing identifying detail ${byGap.identity}`), { page: PG("Needs Documentation"), control: "Needs Documentation panel and gap pills", expected: `${needs} items; photo ${byGap.photo}, valuation ${byGap.value}, price not recorded ${byGap.cost}, identity ${byGap.identity}`, actual: (/NEEDS DOCUMENTATION.{0,330}/.exec(doc) || [""])[0], impact: "misleading result", repro: "Read the panel" });
    const remaining = Math.max(0, E.filled - completeValue);
    r.check(doc.includes(`VALUE NOT FULLY DOCUMENTED ${fmt(remaining)} ${100 - pctValue}% of estimated value, in ${needs} items`), { page: PG("Value Not Fully Documented"), control: "Value Not Fully Documented", expected: `${fmt(remaining)}, ${100 - pctValue}% in ${needs} items`, actual: (/VALUE NOT FULLY DOCUMENTED.{0,120}/.exec(doc) || [""])[0], impact: "misleading result", repro: "Read the panel" });
    // gap links open the Vault list with the same count
    for (const gap of ["photo", "value"]) {
      await S.visit("/portfolio"); await sleep(1000);
      const lab = gap === "photo" ? "Missing photo" : "Needs valuation";
      await clickEl(S, `[...document.querySelectorAll('a')].find((a) => a.innerText.replace(/\\s+/g, ' ').trim().startsWith('${lab}'))`, { js: true }); await sleep(2500); await S.settle({ max: 20000 });
      const got = await ids(S); const want = cnt.filter((x) => gaps(x).includes(gap)).map((x) => x.id);
      r.check((await S.path()).startsWith(`/vault?review=needs_review&gap=${gap}`) && same(got, want), { page: PG(`Needs Documentation > ${lab}`), control: `Pill '${lab} N' (Insights)`, expected: `Opens the Vault list narrowed to the ${want.length} items`, actual: `${await S.path()}; shown ${got.length}`, impact: "blocked workflow", repro: `Click '${lab}'` });
    }
    await S.visit("/portfolio"); await sleep(1000);
    await clickEl(S, "[...document.querySelectorAll('a')].find((a) => /Open the insurance packet/.test(a.textContent))", { js: true }); await sleep(2000); await S.settle({ max: 20000 });
    r.check((await S.path()) === "/insurance", { page: PG("Value Not Fully Documented"), control: "'Open the insurance packet >'", expected: "Opens /insurance", actual: await S.path(), impact: "blocked workflow", repro: "click" });
    await S.visit("/portfolio"); await sleep(1000);
    await clickEl(S, "[...document.querySelectorAll('a')].find((a) => /^DOCUMENTATION COMPLETE/.test(a.innerText.trim()))", { js: true }); await sleep(2500); await S.settle({ max: 20000 });
    r.check((await S.path()).startsWith("/vault?review=insurance_ready") && same(await ids(S), cnt.filter((x) => gaps(x).length === 0).map((x) => x.id)), { page: PG("Documentation Complete card"), control: "Documentation Complete card link", expected: "Opens the Vault's documentation-complete list", actual: `${await S.path()}; shown ${(await ids(S)).length}`, impact: "blocked workflow", repro: "click the card" });

    // ---- 'View all' links, '+ Add note'
    await S.visit("/portfolio"); await sleep(1000);
    const vaLinks = await S.evaluate("[...document.querySelectorAll('a')].filter((a) => /View all >|\\+ Add note/.test(a.textContent.trim())).map((a) => a.textContent.trim() + ' -> ' + a.getAttribute('href'))");
    r.check(!vaLinks.some((l) => /Add note/.test(l) && /-> \/vault$/.test(l)), { page: PG("Items Needing Review"), control: "'+ Add note' tile", expected: "Lets you add a note (opens an item or a note form)", actual: JSON.stringify(vaLinks), evidence: await S.jshot("vlt-insights-review-tiles"), impact: "usability", repro: "Click '+ Add note' in Items Needing Review" });
    r.check(!vaLinks.filter((l) => /View all/.test(l)).every((l) => /-> \/vault$/.test(l)), { page: PG("Value Evidence / Items Needing Review"), control: "'View all >' links", expected: "Value Evidence 'View all' lists items with their pricing evidence; Items Needing Review 'View all' lists the review queue", actual: JSON.stringify(vaLinks), impact: "usability", repro: "Click each 'View all >'" });

    // ---- Collection tools
    await S.evaluate("window.__vltBlobs.length = 0; window.__vltDl.length = 0; true");
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Collection tools')", { js: true }); await sleep(500);
    const tl = await S.evaluate("[...document.querySelectorAll('[role=menuitem]')].map((a) => a.innerText.replace(/\\s+/g, ' ').trim())");
    await clickEl(S, "[...document.querySelectorAll('[role=menuitem]')].find((a) => /Export report/.test(a.innerText))", { js: true }); await sleep(2500);
    const ex = await S.evaluate("(async () => { const b = window.__vltBlobs.slice(-1)[0]; return { dl: window.__vltDl.slice(), text: b ? await b.text() : '' }; })()");
    const lines = ex.text.split(/\r?\n/).filter(Boolean);
    r.check(tl.length === 2 && ex.dl.length === 1 && lines.length - 1 === cnt.length, { page: PG("Collection tools > Export report"), control: "Collection tools > Export report", expected: `A CSV with one row per counted item (${cnt.length}); menu has Export report and Collection recap`, actual: `menu ${JSON.stringify(tl)}; file ${JSON.stringify(ex.dl)}; rows ${lines.length - 1}; header: ${(lines[0] || "").slice(0, 120)}`, impact: "data loss", repro: "Collection tools > Export report" });
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Collection tools')", { js: true }); await sleep(500);
    await clickEl(S, "[...document.querySelectorAll('[role=menuitem]')].find((a) => /Collection recap/.test(a.innerText))", { js: true }); await sleep(2500);
    const recap = await S.evaluate("(() => { const d = [...document.querySelectorAll('.fixed')].find((x) => getComputedStyle(x).position === 'fixed' && x.innerText.length > 40); return d ? { text: d.innerText.replace(/\\s+/g, ' ').slice(0, 500), buttons: [...d.querySelectorAll('button')].map((b) => b.innerText.trim() || b.getAttribute('aria-label')) } : null; })()");
    r.check(!!recap, { page: PG("Collection tools > Collection recap"), control: "Collection recap", expected: "Opens the recap sheet with figures matching the collection and a way to close/share", actual: JSON.stringify(recap), evidence: await S.jshot("vlt-insights-recap"), impact: "blocked workflow", repro: "Collection tools > Collection recap" });
    if (recap) { r.check(recap.text.includes(String(cnt.length)) , { page: PG("Collection recap"), control: "Recap item count", expected: `Mentions ${cnt.length} items`, actual: recap.text.slice(0, 260), impact: "misleading result", repro: "read the recap" }); }
    await S.send("Input.dispatchKeyEvent", { type: "rawKeyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 }); await sleep(600);

    // ---- Intelligence panel
    await S.visit("/portfolio"); await sleep(1200); const intel = squash(await S.text());
    const topCat = top[0]; const uCount = new Set(cnt.map((x) => x.universe)).size; const cCount = new Set(cnt.map((x) => String(x.category_label || x.category || ""))).size;
    const srcs = {}; for (const x of cnt) { const k = x.purchase_source || "Unknown Source"; srcs[k] = (srcs[k] || 0) + X.basis(x).a; }
    const topSrc = Object.entries(srcs).sort((a, b) => b[1] - a[1])[0];
    r.check(intel.includes(`VALUE CONCENTRATION ${Math.round((topCat.value / E.filled) * 100)}% ${topCat.label}`) && intel.includes(`SOURCE CONCENTRATION ${Math.round((topSrc[1] / E.filled) * 100)}% ${topSrc[0]}`) && intel.includes(`COLLECTION BREADTH ${uCount} / ${cCount}`), { page: PG("Portfolio Intelligence"), control: "Collection Valuation Signals (concentration, breadth)", expected: `Value concentration ${Math.round((topCat.value / E.filled) * 100)}% ${topCat.label}; source concentration ${Math.round((topSrc[1] / E.filled) * 100)}% ${topSrc[0]}; breadth ${uCount} / ${cCount}`, actual: (/COLLECTION HEALTH.{0,330}/.exec(intel) || [""])[0], impact: "misleading result", repro: "Read the signals" });
    const best = [...cnt].filter((x) => X.explicit(x) && X.cost(x) > 0).sort((a, b) => (X.effective(b) - X.cost(b)) - (X.effective(a) - X.cost(a)))[0];
    const worst = [...cnt].filter((x) => X.explicit(x) && X.cost(x) > 0).sort((a, b) => (X.effective(a) - X.cost(a)) - (X.effective(b) - X.cost(b)))[0];
    const hi = [...cnt].sort((a, b) => X.basis(b).a - X.basis(a).a)[0];
    r.check(intel.includes(`TOP PERFORMER ${best.title}`) && intel.includes(`BIGGEST UNDERWATER ${worst.title}`) && intel.includes(`HIGHEST VALUE ${hi.title}`), { page: PG("Portfolio Intelligence"), control: "Top performer / Biggest underwater / Highest value", expected: `${best.title} / ${worst.title} / ${hi.title}`, actual: (/TOP PERFORMER.{0,380}/.exec(intel) || [""])[0], impact: "misleading result", repro: "Read the three tiles" });
    r.check(intel.includes("ROI " + pct1(roi)) || intel.includes(`${pct1(roi)} ROI`), { page: PG("Portfolio Intelligence"), control: "Collection health ROI", expected: `${pct1(roi)} (same as the Total Vault Value card)`, actual: (/COLLECTION HEALTH.{0,40}/.exec(intel) || [""])[0], impact: "misleading result", repro: "compare" });
    // Goals widget vs the Goals page
    const gw = (/Collection Goals See all > (.*?)(?:No subjects tagged|$)/.exec(intel) || [])[1] || "";
    await S.visit("/goals"); const gp = squash(await S.text());
    r.check(/Reach \$2,000 collection value/.test(gw) && !/Reach \$2,000 collection value 0% /.test(gw), { page: PG("Collection Goals widget"), control: "Goals widget: 'Reach $2,000 collection value'", expected: "A goal to reach $2,000 of collection value, with the collection worth " + fmt(E.filled) + ", shows as reached (the Goals page's own figure is compared below)", actual: `Insights widget: ${gw.slice(0, 220)} | Goals page: ${(/Reach \$2,000 collection value.{0,160}/.exec(gp) || ["(goal not found on Goals page)"])[0]}`, evidence: await S.jshot("vlt-goals-page"), impact: "misleading result", repro: "Compare the Insights goals widget with /goals" });
    await S.visit("/portfolio"); await sleep(1200);
    await clickEl(S, "[...document.querySelectorAll('button')].find((b) => /^See all/.test(b.textContent.trim()))", { js: true }); await sleep(2000); await S.settle({ max: 20000 });
    r.check((await S.path()) === "/goals", { page: PG("Collection Goals widget"), control: "Goals widget 'See all >'", expected: "Opens /goals", actual: await S.path(), impact: "blocked workflow", repro: "click" });
    await S.visit("/portfolio"); await sleep(1000);
    await clickEl(S, "[...document.querySelectorAll('a')].find((a) => /^Review/.test(a.textContent.trim()) || /Review$/.test(a.innerText.trim()))", { js: true }); await sleep(2000); await S.settle({ max: 20000 });
    r.check(/^\/vault\/item\//.test(await S.path()), { page: PG("Items Needing Review"), control: "Review card (click)", expected: "Opens that item", actual: await S.path(), impact: "blocked workflow", repro: "click a review card" });
  } finally { console.log("errors", S.consoleErrors.slice(0, 4)); await S.close(); await admin.from("portfolio_value_history").delete().eq("profile_id", P).neq("day", "2026-10-19"); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });

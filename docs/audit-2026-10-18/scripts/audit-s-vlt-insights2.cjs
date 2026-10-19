// VLT suite 10: Insights drill-downs (/portfolio/universe/[key], category page) and /portfolio/insurance. Owner, Personal, 1440.
const X = require("./audit-s-vlt-vlib.cjs");
const { R, sleep, squash, clickEl, admin } = X; const r = R("VLT");
const PG = (x) => `${x} | owner, Personal, 36 counted`;
const fmt = (n) => (n < 0 ? "-" : "") + "$" + Math.round(Math.abs(n)).toLocaleString("en-US");
const INIT = `(() => { if (window.__vltDl) return; window.__vltDl = []; window.__vltBlobs = []; const c = URL.createObjectURL; URL.createObjectURL = function (b) { try { window.__vltBlobs.push(b); } catch (e) {} return c.call(URL, b); }; const ac = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { try { if (this.download) window.__vltDl.push(this.download); } catch (e) {} return ac.call(this); }; })();`;
const DAY = 86400e3;
(async () => {
  const m = X.man(); const P = m.personalId;
  const all = await X.rows(P); const cnt = all.filter(X.counted);
  const music = cnt.filter((x) => String(x.universe).toUpperCase() === "MUSIC");
  const now = Date.now();
  const within = (rows, d) => (d == null ? rows : rows.filter((x) => Number(x.created_at) >= now - d * DAY));
  const summ = (rows) => { let cost = 0, val = 0, gain = 0, gcost = 0, gn = 0; for (const x of rows) { cost += X.cost(x); val += X.basis(x).a; if (X.explicit(x) && X.cost(x) > 0) { gain += X.effective(x) - X.cost(x); gcost += X.cost(x); gn++; } } return { cost, val, gain, gcost, gn, n: rows.length }; };
  const S = await X.session("owner");
  try {
    await S.send("Page.addScriptToEvaluateOnNewDocument", { source: INIT });
    await S.visit("/vault"); await S.evaluate("localStorage.removeItem('vltd_portfolio_time_range'); localStorage.removeItem('vltd_rank_mode'); localStorage.removeItem('vltd_value_mode_v1'); true");
    // ---------- universe page
    await S.visit("/portfolio/universe/MUSIC"); await sleep(1500);
    const read = async () => { const t = squash(await S.text()); return { t, value: (/TOTAL VALUE (\$[\d,]+)/.exec(t) || [])[1], cost: (/TOTAL COST (\$[\d,]+)/.exec(t) || [])[1], unreal: (/UNREALIZED CHANGE (\S+)/.exec(t) || [])[1], onOf: (/On (\d+) of (\d+) items/.exec(t) || []).slice(1), inView: (/(\d+) items in view/.exec(t) || [])[1], range: (/CONTROLS (Last \d+ days|All time|Last 7 days)/.exec(t) || [])[1] }; };
    const setRange = async (lab) => { await clickEl(S, `[...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === '${lab}')`, { js: true }); await sleep(900); };
    let u = await read();
    let want = summ(within(music, 30));
    r.check(u.range === "Last 30 days" && u.value === fmt(want.val) && u.cost === fmt(want.cost) && u.inView === String(want.n), { page: PG("/portfolio/universe/MUSIC"), control: "Universe page default view (Last 30 days)", expected: `Defaults to 'Last 30 days' and counts only the ${want.n} Music items ADDED in the last 30 days: value ${fmt(want.val)}, cost ${fmt(want.cost)} (of ${music.length} Music items)`, actual: JSON.stringify({ range: u.range, value: u.value, cost: u.cost, inView: u.inView }), evidence: await S.jshot("vlt-universe-music-30d"), impact: "misleading result", repro: "Open /portfolio/universe/MUSIC" });
    r.check(false || u.inView === String(music.length), { page: PG("/portfolio/universe/MUSIC"), control: "Universe page default vs the universe's real size", expected: `A drill-down from a universe figure shows the whole universe (${music.length} Music items) unless you narrow it`, actual: `opens narrowed to the items added in the last 30 days: ${u.inView} of ${music.length} items; value ${u.value} against ${fmt(summ(music).val)} for the universe`, evidence: "shots/vlt-universe-music-30d.jpg", impact: "misleading result", repro: "Open the universe page and compare with the Vault Music chip count" });
    for (const [lab, d] of [["7d", 7], ["90d", 90], ["All", null]]) {
      await setRange(lab); u = await read(); want = summ(within(music, d));
      r.check(u.value === fmt(want.val) && u.cost === fmt(want.cost) && u.inView === String(want.n), { page: PG("/portfolio/universe/MUSIC"), control: `Range '${lab}'`, expected: `${want.n} items, value ${fmt(want.val)}, cost ${fmt(want.cost)}${d ? ` (items added in the last ${d} days)` : " (all Music items)"}`, actual: JSON.stringify({ range: u.range, value: u.value, cost: u.cost, inView: u.inView, onOf: u.onOf }), evidence: lab === "All" ? await S.jshot("vlt-universe-music-all") : "", impact: "misleading result", repro: `Click ${lab}` });
    }
    const gAll = summ(music);
    r.check(u.unreal && u.unreal.replace(/[+$,]/g, "") === String(Math.round(gAll.gain)) && u.onOf[0] === String(gAll.gn) && u.onOf[1] === String(gAll.n), { page: PG("/portfolio/universe/MUSIC"), control: "Universe page unrealized change (All)", expected: `${fmt(gAll.gain)} on ${gAll.gn} of ${gAll.n} items (the 'Value Without Cost' item has no cost so it is not measured)`, actual: JSON.stringify({ unreal: u.unreal, onOf: u.onOf }), impact: "misleading result", repro: "Range All" });
    await S.visit("/portfolio/universe/MUSIC"); u = await read();
    r.check(u.range === "All time" || /All/.test(u.range || ""), { page: PG("/portfolio/universe/MUSIC"), control: "Range remembered after reload", expected: "All stays selected after reload", actual: JSON.stringify(u.range), impact: "usability", repro: "Click All; reload" });
    // rank mode
    const order = () => S.evaluate("[...document.querySelectorAll('main a[href^=\"/vault/item/\"], main a[href*=\"/category/\"]')].map((a) => a.innerText.replace(/\\s+/g, ' ').trim().slice(0, 40))");
    await clickEl(S, "[...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === 'Value')", { js: true }); await sleep(800);
    const t1 = squash(await S.text()); r.check(/Ranking by value/.test(t1) && /Sorted by value/.test(t1), { page: PG("/portfolio/universe/MUSIC"), control: "Rank: Value", expected: "'Ranking by value' and tables sorted by value", actual: (/CONTROLS .{0,60}/.exec(t1) || [""])[0], impact: "usability", repro: "Click Value" });
    await clickEl(S, "[...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === 'Gain')", { js: true }); await sleep(800);
    r.check(/Ranking by gain/.test(squash(await S.text())), { page: PG("/portfolio/universe/MUSIC"), control: "Rank: Gain", expected: "'Ranking by gain'", actual: (/CONTROLS .{0,60}/.exec(squash(await S.text())) || [""])[0], impact: "usability", repro: "Click Gain" });
    // search
    await X.typeInto(S, 'input[placeholder^="Search title, grade"]', "qa album 2 "); u = await read();
    const wantS = music.filter((x) => `${x.title} ${x.subtitle || ""} ${x.number || ""} ${x.grade || ""} ${x.notes || ""} ${x.category_label || ""} ${x.subcategory_label || ""} ${x.cert_number || ""} ${x.storage_location || ""}`.toLowerCase().includes("qa album 2"));
    r.check(u.inView === String(wantS.length), { page: PG("/portfolio/universe/MUSIC"), control: "Universe page search 'qa album 2 '", expected: `${wantS.length} items in view (search is applied to the trimmed text)`, actual: u.inView, impact: "misleading result", repro: "Type in the search box" });
    await X.typeInto(S, 'input[placeholder^="Search title, grade"]', "");
    // category links
    const catLinks = await S.evaluate("[...document.querySelectorAll('main a[href*=\"/category/\"]')].map((a) => ({ href: a.getAttribute('href'), t: a.innerText.replace(/\\s+/g, ' ').trim() }))");
    const cats = [...new Set(music.map((x) => x.category_label))];
    r.check(catLinks.length === cats.length, { page: PG("/portfolio/universe/MUSIC"), control: "Category breakdown rows", expected: `One row per Music category (${cats.join(", ")}) linking to its page`, actual: JSON.stringify(catLinks), impact: "misleading result", repro: "Read 'Breakdown by category'" });
    // export
    await S.evaluate("window.__vltBlobs.length = 0; window.__vltDl.length = 0; true");
    await clickEl(S, "[...document.querySelectorAll('main button')].find((b) => /Export CSV/.test(b.textContent))", { js: true }); await sleep(1500);
    const ex = await S.evaluate("(async () => { const b = window.__vltBlobs.slice(-1)[0]; return { dl: window.__vltDl.slice(), text: b ? await b.text() : '' }; })()");
    const lines = ex.text.split(/\r?\n/).filter(Boolean);
    r.check(ex.dl.length === 1 && lines.length - 1 === music.length, { page: PG("/portfolio/universe/MUSIC"), control: "Export CSV (range All)", expected: `A CSV with the ${music.length} Music items in view`, actual: `file ${JSON.stringify(ex.dl)}; rows ${lines.length - 1}`, impact: "data loss", repro: "Range All; Export CSV" });
    // unknown / empty universe
    await S.visit("/portfolio/universe/NOPE"); const tn = squash(await S.text());
    r.check(!/PORTFOLIO • UNIVERSE Misc/.test(tn), { page: "/portfolio/universe/NOPE | owner, Personal", control: "Unknown universe key", expected: "Not found (or back to Insights), not the Misc universe", actual: (/PORTFOLIO • UNIVERSE .{0,60}/.exec(tn) || [tn.slice(0, 80)])[0], evidence: await S.jshot("vlt-portfolio-unknown-universe"), impact: "misleading result", repro: "Open /portfolio/universe/NOPE" });
    await S.visit("/portfolio/universe/JEWELRY_APPAREL"); const tj = squash(await S.text());
    r.check(/No items yet|No items match/.test(tj) && /Jewelry/.test(tj), { page: "/portfolio/universe/JEWELRY_APPAREL | owner, Personal, 0 items", control: "Empty universe drill-down", expected: "States there are no items, titled Jewelry & Apparel", actual: tj.slice(tj.indexOf("PORTFOLIO"), tj.indexOf("PORTFOLIO") + 260), impact: "usability", repro: "Open /portfolio/universe/JEWELRY_APPAREL" });
    // ---------- category page
    await S.visit("/portfolio/universe/MUSIC/category/Audio%20Formats"); await sleep(1200);
    const ct = squash(await S.text()); const af = music.filter((x) => x.category_label === "Audio Formats");
    const links = await S.evaluate("[...document.querySelectorAll('main a')].map((a) => a.innerText.replace(/\\s+/g, ' ').trim() + ' -> ' + a.getAttribute('href'))");
    r.check(/Open Exhibitions -> \/vault/.test(links.join("|")) === false, { page: PG("/portfolio/universe/MUSIC/category/Audio%20Formats"), control: "'Open Exhibitions' link", expected: "Opens the Exhibitions area (/museum)", actual: `goes to: ${links.find((l) => /Open Exhibitions/.test(l))}`, evidence: await S.jshot("vlt-category-page"), impact: "blocked workflow", repro: "Click 'Open Exhibitions' on the category page" });
    r.check(!/Future DB-ready structure/.test(ct), { page: PG("/portfolio/universe/MUSIC/category/Audio%20Formats"), control: "Page subtitle", expected: "Customer-facing wording", actual: (/Fast drill-down.{0,80}/.exec(ct) || [""])[0], evidence: "shots/vlt-category-page.jpg", impact: "cosmetic", repro: "Read the subtitle under the title" });
    r.check(/Items \d+/.test(ct) && ct.includes(`Cost ${fmt(summ(within(af, 30)).cost)}`), { page: PG("category page"), control: "Category page totals (default 30 days)", expected: `Cost ${fmt(summ(within(af, 30)).cost)} for the ${within(af, 30).length} Audio Formats items added in 30 days`, actual: (/TOTAL .{0,140}/.exec(ct) || [""])[0], impact: "misleading result", repro: "read TOTAL" });
    await S.visit("/portfolio/universe/MUSIC/category/Instruments%20%26%20Gear"); await sleep(1000);
    r.check(/Music • Instruments & Gear/.test(squash(await S.text())), { page: PG("category page with & in the name"), control: "Category name with an ampersand", expected: "Title 'Music • Instruments & Gear'", actual: (/PORTFOLIO • UNIVERSE • CATEGORY .{0,60}/.exec(squash(await S.text())) || [""])[0], impact: "cosmetic", repro: "open the URL" });
    // ---------- insurance summary page
    await S.visit("/portfolio/insurance"); await sleep(1500); const it = squash(await S.text());
    const sv = (/Stated value: (\$[\d,]+)(\*?)/.exec(it) || []); const pc = (/Purchase cost: (\$[\d,]+)/.exec(it) || [])[1]; const uc = (/Unrealized change: (\S+) On (\d+) of (\d+) items/.exec(it) || []);
    const E = X.expected(all);
    r.check(sv[1] === fmt(E.filled) && pc === fmt(E.cost), { page: PG("/portfolio/insurance"), control: "Insurance summary headline figures", expected: `Stated value ${fmt(E.filled)}*, purchase cost ${fmt(E.cost)}, unrealized ${fmt(E.gain)} on ${E.gainN} of ${E.count} items`, actual: `${sv[1]}${sv[2]} | cost ${pc} | unrealized ${uc[1]} on ${uc[2]} of ${uc[3]}`, evidence: await S.jshot("vlt-insurance-summary"), impact: "misleading result", repro: "Open /portfolio/insurance" });
    const rowsN = await S.evaluate("document.querySelectorAll('tbody tr').length");
    r.check(rowsN === cnt.length, { page: PG("/portfolio/insurance"), control: "Insurance summary item rows", expected: `${cnt.length} owned items (no sold, supply or wishlist items)`, actual: `${rowsN} rows`, impact: "misleading result", repro: "count rows" });
    const lk = await S.evaluate("[...document.querySelectorAll('main a')].map((a) => a.innerText.trim() + ' -> ' + a.getAttribute('href'))");
    r.check(!lk.some((l) => /Open Exhibitions -> \/vault$/.test(l)), { page: PG("/portfolio/insurance"), control: "'Open Exhibitions' button", expected: "Opens the Exhibitions area", actual: JSON.stringify(lk), impact: "blocked workflow", repro: "Click 'Open Exhibitions' on the insurance summary" });
    await S.evaluate("window.__aud.print = 0; true"); await clickEl(S, "[...document.querySelectorAll('button')].find((b) => /Print \\/ Save PDF/.test(b.textContent))", { js: true }); await sleep(600);
    r.check((await S.look()).print === 1, { page: PG("/portfolio/insurance"), control: "Print / Save PDF", expected: "Calls the browser's print", actual: `print calls ${(await S.look()).print}`, impact: "blocked workflow", repro: "click" });
  } finally { console.log("errors", S.consoleErrors.slice(0, 4)); await S.close(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });

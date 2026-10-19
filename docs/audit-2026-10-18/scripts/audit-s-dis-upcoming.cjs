// DIS suite U: /upcoming (Upcoming Comics). The Metron proxy /api/comic-upcoming is INTERCEPTED with a synthetic catalogue (labelled "intercepted"); /api/comic-lookup is intercepted by the audit (503).
const C = require("./audit-s-dis-common.cjs");
const { R, sleep, clean, admin, man } = C;
const r = R("DIS");
const m = man(); const P = m.personalId; const st = m.stamp;
const section = async (name, fn) => { try { await fn(); } catch (e) { console.log("SECTION ERROR", name, e.message); r.nt({ page: "/upcoming", control: "(test harness) " + name, expected: "section runs", actual: "test error, not an app result: " + e.message, impact: "none", repro: "re-run audit-s-dis-upcoming.cjs" }); } };

const DATA = (() => {
  const mk = (id, series, number, publisher, date) => ({ id, series, number, publisher, storeDate: date, coverDate: null, imageUrl: null });
  return [
    mk(990001, "QA Dis Spider", "1", "Marvel", "2026-11-04"), mk(990002, "QA Dis Bat", "2", "DC Comics", "2026-11-04"), mk(990003, "QA Dis Peach", "1B", "Image Comics", "2026-11-04"),
    mk(990004, "QA Dis Spider", "2", "Marvel", "2026-11-11"), mk(990005, "QA Dis Hell", "1", "Dark Horse Comics", "2026-11-11"),
    mk(990006, "QA Dis Bat", "3", "DC Comics", "2026-11-18"), mk(990007, "QA Dis Ghost", "1", "IDW Publishing", "2026-11-18"), mk(990008, "QA Dis Boom", "1", "BOOM! Studios", "2026-11-18"),
    mk(990009, "QA Dis Spider", "3", "Marvel", "2026-12-02"), mk(990010, "QA Dis Bat", "4", "DC Comics", "2026-12-02"),
  ];
})();
// runs in the page: pass-through never; mimics the proxy's by-date paging
const HANDLER = function (url, init, data) {
  if (window.__comicFail) return { status: 502, body: { error: "synthetic failure" } };
  const u = new URL(url, location.origin); const q = (k) => (u.searchParams.get(k) || "").trim().toLowerCase();
  let list = data.slice();
  if (q("publisher")) list = list.filter((i) => i.publisher.toLowerCase().includes(q("publisher")));
  if (q("series")) list = list.filter((i) => i.series.toLowerCase().includes(q("series")));
  let resolved = null;
  if (q("creator")) { if (q("creator") === "qa dis peach") { resolved = { id: 5, name: "QA Dis Peach" }; list = list.filter((i) => /Peach|Spider/.test(i.series)); } else list = []; }
  const page = Math.max(1, Number(u.searchParams.get("page") || 1));
  const dates = [...new Set(list.map((i) => i.storeDate))].sort();
  if (u.searchParams.get("by") === "date") {
    const d = dates[page - 1]; const results = list.filter((i) => i.storeDate === d);
    return { status: 200, body: { count: list.length, page, pageSize: 25, hasMore: page < dates.length, resolvedCreator: resolved, results } };
  }
  return { status: 200, body: { count: list.length, page, pageSize: 25, hasMore: false, resolvedCreator: resolved, results: list } };
};
const groupsOf = (S) => S.evaluate(`[...document.querySelectorAll('main .mb-7')].map((g) => ({ label: g.children[0].children[0].textContent.trim(), says: g.children[0].children[2].textContent.trim(), cards: g.querySelectorAll('a[href*="metron.cloud"]').length }))`);
const banner = (S) => S.evaluate(`(() => { const b = [...document.querySelectorAll('main div')].find((d) => /(issues? (\\(all time\\)|in next)|shown of)/.test(d.textContent) && d.className.includes('ring-1')); return b ? b.textContent.replace(/\\s+/g, ' ').trim() : null; })()`);
const wishRows = async () => (await admin.from("wishlist").select("id,title,source,external_id,status").eq("profile_id", P).eq("source", "metron")).data.filter((x) => String(x.external_id).startsWith("9900"));
const cardOf = (id) => `document.querySelector('a[href="https://metron.cloud/issue/${id}/"]')`;
const statusBtn = (id, label) => `([...${cardOf(id)}.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)}))`;

(async () => {
  const S = await C.session("owner");
  await C.stubHandler(S, "api/comic-upcoming", HANDLER, DATA);
  const PG = "/upcoming | owner, Personal, synthetic catalogue (intercepted)";
  await section("browse", async () => {
    await S.visit("/upcoming"); await sleep(3000);
    const shot = await S.jshot("dis-upcoming-owner");
    let g = await groupsOf(S); const bn = await banner(S); const lm = clean(await S.text());
    r.check(g.length === 1 && g[0].cards === 3 && /3 issues/.test(g[0].says) && /10 issues in next 90 days/.test(bn) && /Load more \(7 remaining\)/.test(lm), { page: PG, control: "Upcoming list: first release date, banner and Load more", expected: "first date row with 3 issues ('3 issues'); banner '10 issues in next 90 days'; 'Load more (7 remaining)'", actual: `${JSON.stringify(g)} | ${bn} | ${(lm.match(/Load more[^)]*\)/) || ["no load more"])[0]}`, evidence: shot, impact: "misleading result", repro: "Open /upcoming" });
    await C.clickText(S, "^Load more", { scope: "body", tags: "button" }); await sleep(1500);
    g = await groupsOf(S); const lm2 = clean(await S.text());
    r.check(g.length === 2 && g[1].cards === 2 && /Load more \(5 remaining\)/.test(lm2), { page: PG, control: "Load more", expected: "adds the next release date (2 issues) below; remaining becomes 5", actual: `${JSON.stringify(g)} | ${(lm2.match(/Load more[^)]*\)/) || ["none"])[0]}`, evidence: "n/a", impact: "misleading result", repro: "Click Load more" });
    await C.clickText(S, "^Load more", { scope: "body", tags: "button" }); await sleep(1200);
    await C.clickText(S, "^Load more", { scope: "body", tags: "button" }); await sleep(1200);
    g = await groupsOf(S);
    r.check(g.length === 4 && g.reduce((a, x) => a + x.cards, 0) === 10 && !/Load more/.test(clean(await S.text())), { page: PG, control: "Load more to the end", expected: "all 4 dates, 10 cards, button gone", actual: `${g.length} dates, ${g.reduce((a, x) => a + x.cards, 0)} cards`, evidence: "n/a", impact: "misleading result", repro: "Click Load more until it disappears" });
    const link = await S.evaluate(`(() => { const a = ${cardOf(990001)}; return { href: a.href, target: a.target, rel: a.rel }; })()`);
    r.check(link.target === "_blank" && /noopener/.test(link.rel) && link.href === "https://metron.cloud/issue/990001/", { page: PG, control: "Issue card (opens Metron in a new tab)", expected: "link to the issue page, new tab, rel noopener", actual: JSON.stringify(link), evidence: "n/a", impact: "usability", repro: "Inspect a card link (not clicked: external site)" });
  });

  await section("range-publisher", async () => {
    await S.visit("/upcoming"); await sleep(3000);
    const n0 = (await C.fx2List(S)).length;
    await C.pick(S, "Date range", "^Next 30 days"); await sleep(1500);
    const bn = await banner(S); const n1 = (await C.fx2List(S)).length;
    r.check(!(/next 30 days/.test(bn) && n1 === n0), { page: PG, control: "Date range: Next 30 days", expected: "either the list is refreshed for 30 days or the banner keeps describing what is shown (90 days) until Search is pressed", actual: `banner now '${bn}' but no new request was made (requests ${n0} -> ${n1}); the 10 issues shown were loaded for 90 days`, evidence: await S.jshot("dis-upcoming-range-30"), impact: "misleading result", repro: "Choose Next 30 days; read the banner above the list" });
    await C.pick(S, "Date range", "^Next 90 days"); await sleep(500);
    // publisher pills
    await C.clickText(S, "^Marvel$", { scope: "main", tags: "button" }); await sleep(1500);
    let g = await groupsOf(S); let bn2 = await banner(S);
    const reqs = await C.fx2List(S);
    r.check(g.reduce((a, x) => a + x.cards, 0) === 1 && /3 issues/.test(bn2) && /publisher=Marvel/.test(reqs[reqs.length - 1].url), { page: PG, control: "Publisher pill: Marvel", expected: "request for Marvel; first page of Marvel issues (1 card on the first date), banner '3 issues'", actual: `cards ${g.reduce((a, x) => a + x.cards, 0)}; ${bn2}; ${reqs[reqs.length - 1].url.slice(0, 90)}`, evidence: "n/a", impact: "misleading result", repro: "Click Marvel" });
    await C.clickText(S, "^DC$", { scope: "main", tags: "button" }); await sleep(1500);
    g = await groupsOf(S); bn2 = await banner(S);
    r.check(/shown of/.test(bn2), { page: PG, control: "Two publisher pills (Marvel + DC)", expected: "'N shown of M total' (client-side filter across the loaded page)", actual: bn2, evidence: "n/a", impact: "usability", repro: "Click Marvel then DC" });
    await C.clickText(S, "^All publishers$", { scope: "main", tags: "button" }); await sleep(1500);
    r.check(/10 issues/.test(await banner(S)), { page: PG, control: "Pill: All publishers", expected: "back to all 10 issues", actual: await banner(S), evidence: "n/a", impact: "usability", repro: "Click All publishers" });
  });

  await section("search", async () => {
    await S.visit("/upcoming"); await sleep(3000);
    await C.typeInto(S, "input[aria-label='Artist name']", "QA Dis Peach");
    await C.clickText(S, "^Search$", { scope: "main form", tags: "button" }); await sleep(1800);
    const bn = await banner(S); const g = await groupsOf(S);
    r.check(/QA Dis Peach/.test(bn) && /\d+ issues/.test(bn) && g.length >= 1, { page: PG, control: "By Artist search ('QA Dis Peach', synthetic)", expected: "banner names the resolved artist and the count; results appear", actual: `${bn} | groups ${JSON.stringify(g)}`, evidence: await S.jshot("dis-upcoming-artist"), impact: "misleading result", repro: "Type an artist; Search" });
    await C.typeInto(S, "input[aria-label='Artist name']", "Nobody Atall");
    await C.clickText(S, "^Search$", { scope: "main form", tags: "button" }); await sleep(1800);
    r.check(/Nothing found/.test(clean(await S.text())), { page: PG, control: "By Artist search with no match", expected: "'Nothing found' with a hint", actual: clean(await S.text()).slice(clean(await S.text()).indexOf("Nothing") - 5, clean(await S.text()).indexOf("Nothing") + 120), evidence: "n/a", impact: "usability", repro: "Search an unknown artist" });
    await C.clickText(S, "^By Series$", { scope: "main", tags: "button" }); await sleep(600);
    const ph = await S.evaluate("document.querySelector(\"input[aria-label='Series title']\") ? document.querySelector(\"input[aria-label='Series title']\").placeholder : null");
    await C.typeInto(S, "input[aria-label='Series title']", "Bat");
    await C.clickText(S, "^Search$", { scope: "main form", tags: "button" }); await sleep(1800);
    const g2 = await groupsOf(S); const all = g2.reduce((a, x) => a + x.cards, 0);
    r.check(ph && /Series title/.test(ph) && /3 issues|4 issues/.test(await banner(S)), { page: PG, control: "By Series tab and search ('Bat')", expected: "series search field; banner counts the 4 Bat issues (first date shows 1)", actual: `placeholder '${ph}'; ${await banner(S)}; cards on first date ${all}`, evidence: "n/a", impact: "misleading result", repro: "By Series; type Bat; Search" });
    await C.typeInto(S, "input[aria-label='Series title']", "");
    await C.clickText(S, "^Search$", { scope: "main form", tags: "button" }); await sleep(1500);
    r.check(/10 issues/.test(await banner(S)), { page: PG, control: "Search with an empty box", expected: "browses everything releasing in the window (10)", actual: await banner(S), evidence: "n/a", impact: "usability", repro: "Clear the box; Search" });
  });

  await section("status", async () => {
    await S.visit("/upcoming"); await sleep(3000);
    await admin.from("wishlist").delete().eq("profile_id", P).eq("source", "metron");
    await S.visit("/upcoming"); await sleep(3000);
    const pressed = async (id, label) => S.evaluate(`${statusBtn(id, label)}.getAttribute('aria-pressed')`);
    const before = await S.path();
    await C.click(S, statusBtn(990001, "Want")); await sleep(2500);
    let rows = await wishRows();
    r.check((await pressed(990001, "Want")) === "true" && rows.length === 1 && rows[0].status === "want" && (await S.path()) === before && /1 saved/.test(clean(await S.text())), { page: PG, control: "Card status: Want (real click on the button inside the link)", expected: "lights up, saves one 'want' row for this profile, does NOT open Metron, header says '1 saved'", actual: `pressed=${await pressed(990001, "Want")}; db rows=${rows.length} ${rows[0] ? rows[0].status : ""}; path unchanged=${(await S.path()) === before}`, evidence: await S.jshot("dis-upcoming-want"), impact: "data loss", repro: "Click Want on an issue" });
    await C.click(S, statusBtn(990001, "Ordered")); await sleep(2500);
    rows = await wishRows();
    r.check((await pressed(990001, "Ordered")) === "true" && (await pressed(990001, "Want")) === "false" && rows.length === 1 && rows[0].status === "preordered", { page: PG, control: "Card status: Ordered", expected: "switches the same row to pre-ordered (one row, not two)", actual: `Ordered=${await pressed(990001, "Ordered")}, Want=${await pressed(990001, "Want")}, rows=${rows.length} ${rows[0] ? rows[0].status : ""}`, evidence: "n/a", impact: "data loss", repro: "Click Ordered after Want" });
    // other issue + watchlist page shows
    await C.click(S, statusBtn(990002, "Want")); await sleep(2500);
    const S2 = await C.session("owner"); await S2.visit("/watchlist"); await sleep(3500);
    const wl = clean(await S2.text());
    r.check(/QA Dis Spider #1|QA Dis Spider/.test(wl) && /Pre-ordered/.test(wl) && /QA Dis Bat/.test(wl) && /Want/.test(wl), { page: "/watchlist | owner, clean second browser", control: "Comic statuses on the Watchlist", expected: "both comics listed as COMIC entries with Pre-ordered / Want and their release dates", actual: (wl.match(/COMIC[^+]{0,140}/g) || []).join(" || ").slice(0, 300), evidence: await S2.jshot("dis-upcoming-in-watchlist"), impact: "misleading result", repro: "Mark two issues; open /watchlist in a fresh browser" });
    await S2.close();
    // clear by clicking the lit one
    await S.visit("/upcoming"); await sleep(3000);
    r.check((await pressed(990001, "Ordered")) === "true", { page: PG, control: "Status persistence after reload", expected: "Ordered still lit", actual: String(await pressed(990001, "Ordered")), evidence: "n/a", impact: "data loss", repro: "Reload" });
    await C.click(S, statusBtn(990001, "Ordered")); await sleep(2500);
    rows = await wishRows();
    r.check((await pressed(990001, "Ordered")) === "false" && rows.length === 1 && rows[0].external_id === "990002", { page: PG, control: "Click the lit status again", expected: "clears that issue only (the other comic stays)", actual: `Ordered=${await pressed(990001, "Ordered")}; remaining rows=${rows.map((x) => x.external_id).join()}`, evidence: "n/a", impact: "data loss", repro: "Click the lit button again" });
    // Own -> comic-lookup intercepted
    S.intercepted.length = 0;
    await C.click(S, statusBtn(990003, "Own")); await sleep(900); const ownToast = clean(await S.text()); await sleep(2500);
    const vaultRows = (await admin.from("vault_items").select("id,title,universe").eq("profile_id", P).ilike("title", "%QA Dis Peach%")).data;
    r.check(/lookup/.test(S.intercepted.map((x) => x.url).join()) && vaultRows.length === 1 && (await pressed(990003, "Own")) === "true" && /Added .* to your vault/.test(ownToast), { page: PG, control: "Card status: Own (INTERCEPTED: /api/comic-lookup answered 503 by the audit - not a successful lookup)", expected: "when the detail lookup is unavailable the issue is still added to the vault from the list data (one item), the button lights, and the toast says 'Added ... to your vault' with Undo", actual: "lookup intercepted=" + S.intercepted.map((x) => x.url).join() + "; vault rows=" + vaultRows.length + " (" + vaultRows.map((x) => x.title + "/" + x.universe).join() + "); lit=" + (await pressed(990003, "Own")) + "; toast=" + (ownToast.match(/Added [^.]*to your vault/) || ["none"])[0], evidence: await S.jshot("dis-upcoming-own-intercepted"), impact: "data loss", repro: "Click Own on an issue while the lookup is unavailable" });
    // Own again must not delete (already in vault)
    await C.click(S, statusBtn(990003, "Own")); await sleep(900); const again = clean(await S.text());
    const vr2 = (await admin.from("vault_items").select("id").eq("profile_id", P).ilike("title", "%QA Dis Peach%")).data.length;
    r.check(/Already in your vault/.test(again) && vr2 === 1, { page: PG, control: "Click Own again on an owned issue", expected: "'Already in your vault' - never deletes the vault item from here", actual: "vault rows=" + vr2 + "; message=" + ((again.match(/Already in your vault/) || ["none"])[0]), evidence: "n/a", impact: "data loss", repro: "Click Own twice" });
    await admin.from("vault_items").delete().eq("profile_id", P).ilike("title", "%QA Dis Peach%");
    await admin.from("wishlist").delete().eq("profile_id", P).eq("source", "metron");
  });

  await section("failed", async () => {
    await S.visit("/upcoming"); await sleep(2500);
    await S.evaluate("window.__comicFail = true; true");
    await S.visit("/upcoming"); await sleep(1000); await S.evaluate("window.__comicFail = true; true");
    // __comicFail must be set before the page's first request: reload with the flag set via a new-document script
    await S.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.__comicFail = true;" });
    await S.visit("/upcoming"); await sleep(3500);
    const t = clean(await S.text()); const shot = await S.jshot("dis-upcoming-load-failed");
    r.check(!/Find what's dropping soon/.test(t) || /couldn|error|unavailable|try again/i.test(t), { page: PG, control: "Failed catalogue load (the synthetic proxy answers 502)", expected: "a message that the releases could not be loaded", actual: t.slice(t.indexOf("Search") > 0 ? t.indexOf("All publishers") : 100, (t.indexOf("All publishers") > 0 ? t.indexOf("All publishers") : 100) + 200), evidence: shot, impact: "misleading result", repro: "Make /api/comic-upcoming fail; open /upcoming" });
    await C.typeInto(S, "input[aria-label='Artist name']", "QA Dis Peach");
    await C.clickText(S, "^Search$", { scope: "main form", tags: "button" }); await sleep(2000);
    const t2 = clean(await S.text());
    r.check(!/Nothing found/.test(t2) || /couldn|error|unavailable|try again/i.test(t2), { page: PG, control: "Failed search (proxy 502)", expected: "an error message, not 'Nothing found - try the full name'", actual: /Nothing found/.test(t2) ? "says 'Nothing found'" : t2.slice(0, 120), evidence: await S.jshot("dis-upcoming-search-failed"), impact: "misleading result", repro: "Make the proxy fail; search an artist" });
  });

  await S.close();
  // phone
  const M = await C.session("visitor", { width: 390, height: 844, mobile: true });
  await C.stubHandler(M, "api/comic-upcoming", HANDLER, DATA);
  await M.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await M.visit("/upcoming"); await sleep(3000);
  const ov = await M.evaluate("(() => { const sc = document.querySelector('.vltd-content-wrap'); const b = document.querySelector('a[href*=\"metron.cloud\"] button'); const r = b.getBoundingClientRect(); return { doc: document.documentElement.scrollWidth, sc: sc.scrollWidth, w: innerWidth, btnH: Math.round(r.height), btnW: Math.round(r.width) }; })()");
  r.check(ov.sc <= ov.w + 1 && ov.btnH >= 40, { page: "/upcoming | visitor, 390 phone (browser-emulated), synthetic catalogue", control: "Phone layout and status-button size", expected: "no sideways page scroll; status buttons at least 40 px tall", actual: JSON.stringify(ov), evidence: await M.jshot("dis-upcoming-390"), impact: "usability", repro: "Open /upcoming at 390 px" });
  await C.click(M, statusBtn(990001, "Want")); await sleep(500); const visToast = clean(await M.text()); await sleep(1200);
  const vis = await M.evaluate(`${statusBtn(990001, "Want")}.getAttribute('aria-pressed')`);
  const visHeader = clean(await M.text());
  r.check(vis === "true", { page: "/upcoming | visitor (signed out)", control: "Want while signed out", expected: "either asks to sign in or clearly saves only on this device", actual: `lit=${vis}; message: ${/sign in|log in|this device/i.test(visHeader) ? "mentions sign-in/device" : "no sign-in notice; header says: " + ((visHeader.match(/Releases by artist or series[^.]*\./) || [""])[0])}`, evidence: "n/a", impact: "misleading result", repro: "Signed out, click Want" });
  await M.close();
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });

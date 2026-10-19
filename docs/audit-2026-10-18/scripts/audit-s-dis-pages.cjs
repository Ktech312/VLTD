// DIS suite X: /kickstarter, /patreon (their lookups /api/kickstarter-comics and /api/patreon-comics are INTERCEPTED with synthetic data), /shop, /styles, /redeem.
const C = require("./audit-s-dis-common.cjs");
const { R, sleep, clean, admin, man } = C;
const r = R("DIS");
const section = async (name, fn) => { try { await fn(); } catch (e) { console.log("SECTION ERROR", name, e.message); r.nt({ page: "/" + name, control: "(test harness) " + name, expected: "section runs", actual: "test error, not an app result: " + e.message, impact: "none", repro: "re-run audit-s-dis-pages.cjs" }); } };

const KS = [
  { id: 1, name: "QA Dis Live Funded", blurb: "synthetic live and funded", slug: "a", url: "https://example.invalid/ks/a", creator: "QA Maker A", creatorUrl: "https://example.invalid/c/a", imageUrl: null, pledged: 15000, goal: 10000, backers: 300, percentFunded: 150, currency: "USD", state: "live", deadline: new Date(Date.now() + 5 * 86400000).toISOString(), launchedAt: "2026-10-01T00:00:00Z", category: "Comics", subcategory: null, country: "US" },
  { id: 2, name: "QA Dis Live Low", blurb: "synthetic live 20 percent", slug: "b", url: "https://example.invalid/ks/b", creator: "QA Maker B", creatorUrl: "https://example.invalid/c/b", imageUrl: null, pledged: 2000, goal: 10000, backers: 40, percentFunded: 20, currency: "USD", state: "live", deadline: new Date(Date.now() + 20 * 86400000).toISOString(), launchedAt: "2026-10-05T00:00:00Z", category: "Comics", subcategory: null, country: "US" },
  { id: 3, name: "QA Dis Successful", blurb: "synthetic ended funded", slug: "c", url: "https://example.invalid/ks/c", creator: "QA Maker C", creatorUrl: "https://example.invalid/c/c", imageUrl: null, pledged: 30000, goal: 5000, backers: 900, percentFunded: 600, currency: "USD", state: "successful", deadline: new Date(Date.now() - 3 * 86400000).toISOString(), launchedAt: "2026-09-01T00:00:00Z", category: "Comics", subcategory: null, country: "US" },
  { id: 4, name: "QA Dis Failed", blurb: "synthetic failed", slug: "d", url: "https://example.invalid/ks/d", creator: "QA Maker D", creatorUrl: "https://example.invalid/c/d", imageUrl: null, pledged: 100, goal: 5000, backers: 4, percentFunded: 2, currency: "USD", state: "failed", deadline: new Date(Date.now() - 10 * 86400000).toISOString(), launchedAt: "2026-08-01T00:00:00Z", category: "Comics", subcategory: null, country: "US" },
];
const KS_HANDLER = function (url, init, data) {
  const u = new URL(url, location.origin); const q = (u.searchParams.get("q") || "").toLowerCase(); const page = Number(u.searchParams.get("page") || 1);
  if (q === "boom") return { status: 502, body: { error: "synthetic Kickstarter failure" } };
  if (q === "nothing") return { status: 200, body: { projects: [], total_hits: 0, hasMore: false } };
  let list = data.slice(); if (q && q !== "comics") list = list.filter((p) => (p.name + p.blurb + p.creator).toLowerCase().includes(q));
  const sort = u.searchParams.get("sort");
  if (sort === "most_funded") list.sort((a, b) => b.pledged - a.pledged);
  if (sort === "most_backed") list.sort((a, b) => b.backers - a.backers);
  if (sort === "end_date") list.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  const slice = page === 1 ? list.slice(0, 2) : list.slice(2);
  return { status: 200, body: { projects: slice, total_hits: list.length, hasMore: page === 1 && list.length > 2 } };
};
const PT = [
  { name: "QA Dis Creator One", url: "https://example.invalid/p/one", imageUrl: null, blurb: "synthetic creator one", category: "Comics", patrons: 1234, tierCount: 3, isNSFW: false, source: "patreon-search" },
  { name: "QA Dis Creator Two", url: "https://example.invalid/p/two", imageUrl: null, blurb: "synthetic creator two, patrons hidden", category: "Comics", patrons: null, tierCount: null, isNSFW: false, source: "patreon-search" },
  { name: "QA Dis Creator Adult", url: "https://example.invalid/p/adult", imageUrl: null, blurb: "synthetic flagged creator", category: "Comics", patrons: 50, tierCount: 1, isNSFW: true, source: "patreon-search" },
];
const PT_HANDLER = function (url, init, data) {
  const u = new URL(url, location.origin); const q = (u.searchParams.get("q") || "").toLowerCase(); const lk = u.searchParams.get("url");
  if (q === "boom") return { status: 502, body: { error: "synthetic Patreon failure" } };
  if (lk) return lk.includes("patreon.com/") ? { status: 200, body: { creators: [data[0]], note: "synthetic lookup note" } } : { status: 400, body: { error: "Not a Patreon URL" } };
  if (q === "nothing") return { status: 200, body: { creators: [] } };
  return { status: 200, body: { creators: data, note: "synthetic search note" } };
};

(async () => {
  // ---------------- Kickstarter
  await section("kickstarter", async () => {
    const V = await C.session("visitor");
    await C.stubHandler(V, "api/kickstarter-comics", KS_HANDLER, KS);
    const PG = "/kickstarter | visitor, synthetic campaigns (intercepted)";
    await V.visit("/kickstarter"); await sleep(2500);
    const t0 = clean(await V.text());
    r.check(/Discover crowdfunded comics/.test(t0) && (await C.fx2List(V)).length === 0, { page: PG, control: "Kickstarter: first view", expected: "a prompt (no automatic search) with 'Browse all comics campaigns'", actual: (t0.match(/Discover crowdfunded comics/) || ["none"])[0] + `; requests=${(await C.fx2List(V)).length}`, evidence: await V.jshot("dis-kickstarter"), impact: "usability", repro: "Open /kickstarter" });
    await C.clickText(V, "^Browse all comics campaigns$", { scope: "body", tags: "button" }); await sleep(1500);
    const cards = () => V.evaluate("[...document.querySelectorAll('a[target=_blank]')].filter((a) => /QA Dis/.test(a.textContent)).map((a) => ({ text: a.innerText.replace(/\\s+/g, ' '), href: a.href, rel: a.rel }))");
    let cs = await cards(); const t1 = clean(await V.text());
    r.check(cs.length === 2 && /4 campaigns found in Comics/.test(t1) && (await C.fx2List(V)).pop().url.includes("q=comics"), { page: PG, control: "Browse all comics campaigns", expected: "searches 'comics': 2 cards on page 1, '4 campaigns found in Comics', a Load more button", actual: `cards=${cs.length}; ${(t1.match(/\d+ campaigns? found in Comics/) || ["no count"])[0]}; request ${(await C.fx2List(V)).pop().url}`, evidence: await V.jshot("dis-kickstarter-results"), impact: "misleading result", repro: "Click Browse all comics campaigns" });
    r.check(/150%/.test(cs[0].text) && /LIVE/.test(cs[0].text) && /5d left|5 days left|days? left/i.test(cs[0].text) && /300 backers/.test(cs[0].text) && cs[0].rel.includes("noopener"), { page: PG, control: "Campaign card details", expected: "name, creator, LIVE badge, 150% funded, 300 backers, days left; opens in a new tab with rel noopener", actual: cs[0].text.slice(0, 200), evidence: "n/a", impact: "misleading result", repro: "Read the first card" });
    await C.clickText(V, "^Load more campaigns$", { scope: "body", tags: "button" }); await sleep(1500);
    cs = await cards();
    r.check(cs.length === 4 && /SUCCESSFUL|FUNDED|ENDED/i.test(cs[2].text) && /FAILED/i.test(cs[3].text), { page: PG, control: "Load more campaigns", expected: "2 more cards appended (4 total) with ended states (successful / failed) shown, button gone", actual: `cards=${cs.length}; states: ${cs.slice(2).map((c) => (c.text.match(/SUCCESSFUL|FAILED|LIVE|CANCELED|ENDED/i) || ["?"])[0]).join(",")}; load more still present=${/Load more campaigns/.test(clean(await V.text()))}`, evidence: "n/a", impact: "misleading result", repro: "Click Load more campaigns" });
    await C.clickText(V, "^Most funded$", { scope: "body", tags: "button" }); await sleep(1500);
    const req = (await C.fx2List(V)).pop(); cs = await cards();
    r.check(/sort=most_funded/.test(req.url) && /QA Dis Successful/.test(cs[0].text), { page: PG, control: "Sort pill: Most funded", expected: "re-runs the search sorted by most funded (the $30,000 campaign first)", actual: `${req.url}; first: ${cs[0] && cs[0].text.slice(0, 40)}`, evidence: "n/a", impact: "misleading result", repro: "Click Most funded" });
    await C.typeInto(V, "input[placeholder^='Search —']", "nothing");
    await V.evaluate("document.querySelector(\"input[placeholder^='Search —']\").closest('form').requestSubmit(); true"); await sleep(1500);
    r.check(/0 campaigns found/.test(clean(await V.text())), { page: PG, control: "Search with no results", expected: "'0 campaigns found in Comics'", actual: (clean(await V.text()).match(/\d+ campaigns? found in Comics/) || ["none"])[0], evidence: "n/a", impact: "usability", repro: "Search 'nothing'" });
    await C.typeInto(V, "input[placeholder^='Search —']", "boom");
    await V.evaluate("document.querySelector(\"input[placeholder^='Search —']\").closest('form').requestSubmit(); true"); await sleep(1500);
    const te = clean(await V.text());
    r.check(/synthetic Kickstarter failure/.test(te) && !/campaigns? found/.test(te), { page: PG, control: "Search when the service fails (synthetic 502)", expected: "an error message and no stale result line left over from the previous search", actual: (te.match(/synthetic Kickstarter failure/) || ["no message"])[0] + `; old cards cleared=${!/QA Dis Live/.test(te)}; stale count line still shown='${(te.match(/\d+ campaigns? found in Comics/) || ["none"])[0]}'`, evidence: await V.jshot("dis-kickstarter-error"), impact: "misleading result", repro: "Make the lookup fail" });
    await V.close();
  });

  // ---------------- Patreon
  await section("patreon", async () => {
    const V = await C.session("visitor");
    await C.stubHandler(V, "api/patreon-comics", PT_HANDLER, PT);
    const PG = "/patreon | visitor, synthetic creators (intercepted)";
    await V.visit("/patreon"); await sleep(2500);
    await V.evaluate("document.querySelector(\"input[placeholder^='Search Patreon']\").closest('form').requestSubmit(); true"); await sleep(600);
    r.check((await C.fx2List(V)).length === 0, { page: PG, control: "Search with an empty box", expected: "nothing is sent", actual: `requests=${(await C.fx2List(V)).length}`, evidence: await V.jshot("dis-patreon"), impact: "usability", repro: "Press Search empty" });
    await C.typeInto(V, "input[placeholder^='Search Patreon']", "peach");
    await V.evaluate("document.querySelector(\"input[placeholder^='Search Patreon']\").closest('form').requestSubmit(); true"); await sleep(1500);
    const t = clean(await V.text());
    const links = await V.evaluate("[...document.querySelectorAll('a[target=_blank]')].filter((a) => /QA Dis Creator/.test(a.textContent)).map((a) => ({ text: a.innerText.replace(/\\s+/g, ' ').slice(0, 120), rel: a.rel }))");
    r.check(/QA Dis Creator One/.test(t) && /1,234 patrons/.test(t) && /synthetic search note/.test(t) && links.every((l) => /noopener/.test(l.rel)), { page: PG, control: "Search creators ('peach', synthetic)", expected: "creators listed with patrons formatted (1,234), the note shown, links open in a new tab", actual: `${links.length} creators; patrons text=${/1,234 patrons/.test(t)}; note=${/synthetic search note/.test(t)}`, evidence: await V.jshot("dis-patreon-results"), impact: "misleading result", repro: "Search a name" });
    r.check(/Creator Two/.test(t) && !/null patrons|NaN/.test(t), { page: PG, control: "Creator with no public patron count", expected: "no 'null patrons' text", actual: /null patrons|NaN/.test(t) ? "shows null/NaN" : "count simply omitted", evidence: "n/a", impact: "cosmetic", repro: "Read the second creator" });
    const adult = links.find((l) => /Adult/.test(l.text));
    r.check(true, { page: PG, control: "Creator flagged adult (isNSFW)", expected: "(record) how a flagged creator is shown to a signed-out visitor", actual: adult ? "listed: " + adult.text.slice(0, 100) : "not listed", evidence: "n/a", impact: "improvement", repro: "Search; read the flagged creator card" });
    await C.clickText(V, "^Look Up Creator$", { scope: "body", tags: "button" }); await sleep(500);
    const urlIn = "input[placeholder*='patreon.com'], input[placeholder*='URL'], input[placeholder*='url']";
    const ph = await V.evaluate("[...document.querySelectorAll('input')].map((i) => i.placeholder).join(' | ')");
    await C.typeInto(V, "input:not([placeholder*='Search vault'])", "https://www.patreon.com/qa-dis");
    await V.evaluate("[...document.querySelectorAll('form')].pop().requestSubmit(); true"); await sleep(1500);
    const lk = clean(await V.text()); const req = (await C.fx2List(V)).pop();
    r.check(/QA Dis Creator One/.test(lk) && /url=/.test(req.url), { page: PG, control: "Look Up Creator with a Patreon URL (synthetic)", expected: "request carries the url; the creator is listed", actual: `${req.url.slice(0, 90)}; listed=${/QA Dis Creator One/.test(lk)}; placeholders: ${ph.slice(0, 120)}`, evidence: "n/a", impact: "misleading result", repro: "Look Up Creator; paste a URL" });
    await C.typeInto(V, "input:not([placeholder*='Search vault'])", "https://example.com/not-patreon");
    await V.evaluate("[...document.querySelectorAll('form')].pop().requestSubmit(); true"); await sleep(1500);
    r.check(/Not a Patreon URL/.test(clean(await V.text())), { page: PG, control: "Look Up Creator with a non-Patreon URL", expected: "a clear error", actual: (clean(await V.text()).match(/Not a Patreon URL|Lookup failed/) || ["none"])[0], evidence: await V.jshot("dis-patreon-lookup-error"), impact: "usability", repro: "Look up a non-Patreon address" });
    await V.close();
  });

  // ---------------- Shop
  await section("shop", async () => {
    const V = await C.session("visitor");
    const PG = "/shop | visitor";
    await V.visit("/shop"); await sleep(2500);
    const pills = await V.evaluate("[...document.querySelectorAll('button')].map((b) => b.textContent.trim()).filter((t) => /\\(\\d+\\)$/.test(t))");
    const counts = Object.fromEntries(pills.map((p) => { const m = p.match(/^(.*?)\s*\((\d+)\)$/); return [m[1].trim(), Number(m[2])]; }));
    const prods = () => V.evaluate("[...document.querySelectorAll('a[href^=http]')].filter((a) => /Shop/.test(a.textContent)).length");
    const total = await prods();
    const bad = [];
    for (const [k, n] of Object.entries(counts)) {
      await C.clickText(V, "^" + k.replace(/[.*+?^${}()|[\]\\&]/g, (c) => "\\" + c) + "\\s*\\(", { scope: "body", tags: "button" }); await sleep(400);
      const got = await prods(); if (got !== n) bad.push(`${k}: pill ${n}, shown ${got}`);
    }
    r.check(bad.length === 0 && total === counts["All"], { page: PG, control: "Shop category pills", expected: "each pill's number equals the products shown; All = 26", actual: bad.length ? bad.join("; ") : `All=${total}; ` + Object.entries(counts).map(([k, v]) => k + "=" + v).join(", "), evidence: await V.jshot("dis-shop"), impact: "misleading result", repro: "Click each pill" });
    await C.clickText(V, "^All\\s*\\(", { scope: "body", tags: "button" }); await sleep(300);
    await C.typeInto(V, "input[placeholder='Search products...']", "binder");
    const nb = await prods();
    await C.typeInto(V, "input[placeholder='Search products...']", "qqzzxx"); const none = await prods(); const t = clean(await V.text());
    r.check(nb >= 3 && none === 0 && /No products|no results|nothing/i.test(t), { page: PG, control: "Search products...", expected: "'binder' narrows the list (3+); nonsense shows an explicit no-results message", actual: `binder=${nb}; nonsense=${none}; message=${(t.match(/No products[^.]*\.|no results[^.]*\.|nothing[^.]*\./i) || ["none"])[0]}`, evidence: await V.jshot("dis-shop-nomatch"), impact: "usability", repro: "Type binder; then nonsense" });
    await C.typeInto(V, "input[placeholder='Search products...']", "");
    const ext = await V.evaluate("[...document.querySelectorAll('a[href^=http]')].filter((a) => /Shop/.test(a.textContent)).map((a) => ({ t: a.target, rel: a.rel, host: new URL(a.href).hostname }))");
    r.check(ext.every((e) => e.t === "_blank" && /noopener/.test(e.rel)), { page: PG, control: "Product links (external shops)", expected: "open in a new tab with rel noopener (not clicked: external sites)", actual: `${ext.length} links; hosts: ${[...new Set(ext.map((e) => e.host))].join(", ")}; rel sponsored/nofollow present=${ext.some((e) => /sponsored|nofollow/.test(e.rel))}`, evidence: "n/a", impact: "usability", repro: "Inspect the links" });
    const txt = await V.evaluate("document.body.innerText");
    const emo = (txt.match(/\p{Extended_Pictographic}/gu) || []);
    r.check(emo.length === 0, { page: PG, control: "Emoji glyphs on the page", expected: "no emoji (house rule: custom line-art glyphs only)", actual: `${emo.length} emoji, e.g. ${[...new Set(emo)].slice(0, 6).join(" ")}`, evidence: await V.jshot("dis-shop-emoji"), impact: "cosmetic", repro: "Open /shop" });
    r.check(/affiliate|commission|earn/i.test(txt), { page: PG, control: "Affiliate disclosure (links go to Amazon search pages)", expected: "(observation) a note that VLTD may earn a commission, if links are affiliate links", actual: /affiliate|commission|earn/i.test(txt) ? "disclosure present" : "no disclosure text on the page", evidence: "n/a", impact: "improvement", repro: "Read the page" });
    await V.close();
  });

  // ---------------- Styles
  await section("styles", async () => {
    const V = await C.session("visitor");
    const PG = "/styles | visitor";
    await V.visit("/styles"); await sleep(2500);
    const root = () => V.evaluate("[...document.documentElement.classList].filter((c) => c.indexOf('style-') === 0).join(',')");
    const bg = () => V.evaluate("getComputedStyle(document.body).backgroundColor + ' ' + getComputedStyle(document.documentElement).getPropertyValue('--bg')");
    const cur = () => V.evaluate("(() => { const t = document.body.innerText.replace(/\\s+/g, ' '); return (t.match(/CURRENT ([A-Za-z ]+?) Tip/) || [])[1]; })()");
    const applyBtn = (name) => "([...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === 'Apply' && b.closest('div').parentElement.innerText.indexOf('" + name + "') >= 0 && b.closest('div').parentElement.innerText.split(String.fromCharCode(10))[0].indexOf('PREVIEW') >= -1))";
    const before = await root(); const c0 = await cur(); const bg0 = await bg();
    const noirApply = await V.evaluate("(() => { const cards = [...document.querySelectorAll('main button')].filter((b) => b.textContent.trim() === 'Apply'); const names = cards.map((b) => { let el = b; el = el.parentElement; return el.innerText.replace(/\\s+/g, ' ').slice(0, 30); }); return names; })()");
    const idxNoir = noirApply.findIndex((n) => /Noir/.test(n));
    await C.click(V, "([...document.querySelectorAll('main button')].filter((b) => b.textContent.trim() === 'Apply'))[" + idxNoir + "]"); await sleep(800);
    const mid = await root(); const c1 = await cur(); const bg1 = await bg();
    r.check(mid === "style-noir" && /Noir/i.test(c1 || ""), { page: PG, control: "Apply (Noir)", expected: "the page takes the Noir style (root class style-noir) and CURRENT shows Noir", actual: "root style class '" + before + "' -> '" + mid + "'; CURRENT '" + c0 + "' -> '" + c1 + "'", evidence: await V.jshot("dis-styles-noir"), impact: "misleading result", repro: "Click Apply on Noir" });
    r.check(bg0 !== bg1, { page: PG, control: "Apply (Noir): does the look actually change?", expected: "(observation) the page background or colours change", actual: "body background/--bg before: " + bg0 + " | after: " + bg1, evidence: "n/a", impact: "improvement", repro: "Apply Noir; compare the page" });
    await V.visit("/styles"); await sleep(2000);
    r.check(/Noir/i.test((await cur()) || "") && (await root()) === "style-noir", { page: PG, control: "Style after reload (this browser)", expected: "Noir persists", actual: "CURRENT '" + (await cur()) + "'; class '" + (await root()) + "'", evidence: "n/a", impact: "data loss", repro: "Reload" });
    await V.visit("/discover"); await sleep(2500);
    r.check((await root()) === "style-noir", { page: "/discover | visitor", control: "Style on another page", expected: "Noir is applied site-wide", actual: await root(), evidence: "n/a", impact: "misleading result", repro: "Apply a style; open Discover" });
    await V.visit("/styles"); await sleep(2000);
    await C.clickText(V, "^Reset to Minimal$", { scope: "main", tags: "button" }); await sleep(800);
    r.check(/Minimal/i.test((await cur()) || "") && (await root()) === "style-minimal", { page: PG, control: "Reset to Minimal", expected: "style returns to Minimal", actual: "CURRENT '" + (await cur()) + "'; class '" + (await root()) + "'", evidence: "n/a", impact: "usability", repro: "Click Reset to Minimal" });
    const lk = await V.evaluate("[...document.querySelectorAll('main a')].map((a) => a.textContent.trim() + ' -> ' + a.getAttribute('href'))");
    r.check(lk.includes("Back to Settings -> /account?section=preferences") && !lk.some((x) => x.startsWith("Exhibitions -> /vault")), { page: PG, control: "Page links: 'Back to Settings' and 'Exhibitions'", expected: "'Exhibitions' leads to Exhibitions", actual: lk.join(" | "), evidence: "n/a", impact: "misleading result", repro: "Read the two links" });
    await V.close();
  });

  // ---------------- Redeem
  await section("redeem", async () => {
    const V = await C.session("visitor");
    await V.visit("/redeem"); await sleep(2500);
    r.check(/\/login\?next=/.test(await V.path()), { page: "/redeem | visitor", control: "Signed-out /redeem", expected: "asked to sign in", actual: await V.path(), evidence: "n/a", impact: "usability", repro: "Open /redeem signed out" });
    await V.close();
    const O = await C.session("owner");
    await O.visit("/redeem"); await sleep(3500);
    const dis0 = await O.evaluate("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Redeem').disabled");
    await C.typeInto(O, "input[placeholder='VLTD-XXXX-XXXX']", "abc");
    const dis1 = await O.evaluate("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Redeem').disabled");
    r.check((await O.path()) === "/account/billing" && dis0 === true, { page: "/redeem | owner, Personal", control: "/redeem -> Billing & Plans: Redeem code box", expected: "redirects to Billing & Plans; Redeem disabled while the box is empty", actual: `${await O.path()}; disabled empty=${dis0}; after typing 'abc' disabled=${dis1}`, evidence: await O.jshot("dis-redeem"), impact: "usability", repro: "Open /redeem signed in" });
    r.blocked({ page: "/redeem | owner", control: "Redeem (apply a gift/beta code)", expected: "applies the code", actual: "NOT EXERCISED: redeeming goes through /api/billing/* which the audit intercepts; a real or fake code cannot produce a real result and could change plan access", evidence: "n/a", impact: "none", repro: "n/a" });
    await O.close();
  });
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });

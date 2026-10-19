// DIS suite A: /discover cards, counts/values, privacy boundary, detail panel, Share/Report/Close, double click. Visitor 1440 + owner + viewer.
const C = require("./audit-s-dis-common.cjs");
const { R, sleep, clean } = C;
const r = R("DIS");
const sd = C.seed();
const T = sd.titles; const ID = sd.ids;
const PG = "/discover | visitor, 1440, QA rooms A-F";

const section = async (name, fn) => { try { await fn(); } catch (e) { console.log("SECTION ERROR", name, e.message); r.fail({ page: PG, control: "(test harness) " + name, expected: "section runs", actual: "test error: " + e.message, impact: "none", repro: "re-run audit-s-dis-discover-a.cjs" }); } };
const cardText = (S, title) => S.evaluate(`(() => { const t = ${JSON.stringify(title)}; const sec = document.querySelector('[data-testid=featured-rooms]'); const b = [...document.querySelectorAll('main button')].find((x) => x.innerText.includes(t) && x.innerText.includes('items')); return b ? b.innerText.replace(/\\s+/g, ' ') : null; })()`);
const asideBtn = async (S, txt) => { await C.scrollTo(S, 'end'); await sleep(700); return C.click(S, `([...document.querySelectorAll('aside a, aside button')].find((x) => x.textContent.trim() === ${JSON.stringify(txt)}))`); };
const panel = (S) => S.evaluate("(() => { const a = document.querySelector('aside'); return a ? a.innerText.replace(/\\s+/g, ' ') : null; })()");

(async () => {
  const S = await C.session("visitor");
  await C.failRequests(S, ["*/rest/v1/bug_reports*"]);
  await C.stubFetch(S, "rest/v1/bug_reports");
  await S.visit("/discover"); await sleep(2500);
  const shot0 = await S.jshot("dis-discover-visitor-1440");

  await section("cards", async () => {
    const a = await cardText(S, T.A), b = await cardText(S, T.B), c = await cardText(S, T.C), d = await cardText(S, T.D);
    r.check(a && /5 items/.test(a) && /\$350/.test(a) && /from 2 of 5 items/.test(a), { page: PG, control: "Room card: Alpha (3 public items, 1 private without snapshot, 2 snapshot-only)", expected: "5 items (public or snapshotted), $350 from 2 of 5 items", actual: a, evidence: shot0, impact: "misleading result", repro: "Open /discover signed out; find the Alpha card" });
    r.check(b && /4 items/.test(b) && /Value not shown/.test(b) && !/\$0/.test(b), { page: PG, control: "Room card: Bravo (4 snapshot-only items, no public value)", expected: "4 items, 'Value not shown', never $0", actual: b, evidence: shot0, impact: "misleading result", repro: "Open /discover; find the Bravo card" });
    r.check(c && /3 items/.test(c) && /\$60/.test(c) && !/from \d+ of/.test(c), { page: PG, control: "Room card: Charlie (3 public items 10+20+30)", expected: "3 items, $60, no partial note", actual: c, evidence: shot0, impact: "misleading result", repro: "Open /discover; find the Charlie card" });
    r.check(d && /2 items/.test(d) && /Value not shown/.test(d) && !/\$0/.test(d), { page: PG, control: "Room card: Delta (one explicit-zero value, one missing value, no cover image)", expected: "2 items, 'Value not shown' (explicit zero is not a value), not $0", actual: d, evidence: shot0, impact: "misleading result", repro: "Open /discover; find the Delta card" });
    const texts = clean(await S.text());
    r.check(!texts.includes(T.F), { page: PG, control: "Private (LOCKED) exhibition", expected: "never listed on Discover", actual: texts.includes(T.F) ? "listed" : "not listed", evidence: shot0, impact: "privacy/data loss", repro: "Open /discover; search the page for the private room's title" });
    // empty exhibition is listed with 0 items
    const e = await S.evaluate(`(() => { const t = ${JSON.stringify(T.E)}; const b = [...document.querySelectorAll('main button')].find((x) => x.innerText.includes(t)); return b ? b.innerText.replace(/\\s+/g,' ') : null; })()`);
    r.check(e === null || /0 items/.test(e), { page: PG, control: "Room card: Echo (public exhibition with 0 items)", expected: "either not promoted or reads '0 items' (never a fake count)", actual: e === null ? "not in the visible 4 cards of any section" : e, evidence: shot0, impact: "usability", repro: "Open /discover; Trending -> View all; look for the Echo room" });
  });

  await section("privacy", async () => {
    const pt = clean(await S.text());
    r.check(!/7,?777/.test(pt) && !/ZEBRA-SECRET/.test(pt), { page: PG, control: "Discover page text vs private purchase cost 7,777.77 and private note", expected: "no private purchase cost or note anywhere on the page", actual: /7,?777|ZEBRA-SECRET/.test(pt) ? "private data visible" : "none present", evidence: shot0, impact: "privacy/data loss", repro: "Open /discover signed out; search page text" });
    const itemReqs = S.reqs.filter((q) => /public_vault_items|\/vault_items/.test(q.url) && !/select=id&limit=1/.test(q.url));
    const dec = itemReqs.map((q) => decodeURIComponent(q.url));
    r.check(itemReqs.length > 0 && dec.every((u) => !/purchase|cost|notes|asking|paid/i.test(u.split("?")[1]?.split("&")[0] || "")) && itemReqs.every((q) => /public_vault_items/.test(q.url)), { page: PG, control: "Item reads issued by Discover (network)", expected: "reads the public view, selects no purchase/notes columns", actual: dec.map((u) => u.slice(0, 160)).join(" || ").slice(0, 500), evidence: "(network list in this row)", impact: "privacy/data loss", repro: "Open /discover with devtools network; inspect the vault item requests" });
    // anon read of the public view with select=* for an item whose private columns hold known values
    const env = C.env; const url = env.NEXT_PUBLIC_SUPABASE_URL; const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const q = async (table, id) => { const res = await fetch(`${url}/rest/v1/${table}?select=*&id=eq.${id}`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } }); const j = await res.json().catch(() => null); return { status: res.status, body: j }; };
    const v = await q("public_vault_items", `qa_vz_${sd.stamp}_1`);
    const row = Array.isArray(v.body) ? v.body[0] : null;
    const leaks = row ? Object.keys(row).filter((k) => /purchase|notes|asking|cost|paid|order/i.test(k) && row[k] !== null && row[k] !== undefined && row[k] !== "") : [];
    r.check(row && leaks.length === 0 && !JSON.stringify(row).includes("ZEBRA-SECRET") && !JSON.stringify(row).includes("7777"), { page: "public_vault_items (anonymous select=*)", control: "Public item row for a public item that has private purchase cost and a private note", expected: "private columns not exposed to an anonymous caller", actual: row ? `columns with private data: ${leaks.join(",") || "none"}; row keys: ${Object.keys(row).length}` : `no row returned (status ${v.status})`, evidence: "(anonymous REST read, node)", impact: "privacy/data loss", repro: "GET /rest/v1/public_vault_items?select=*&id=eq.<public item id> with only the anon key" });
    const v2 = await q("vault_items", `qa_vz_${sd.stamp}_1`);
    r.check((Array.isArray(v2.body) && v2.body.length === 0) || v2.status === 401 || v2.status === 403, { page: "vault_items (anonymous select=*)", control: "Base table read by an anonymous caller for a public item", expected: "no rows (the base table is not readable anonymously)", actual: `status ${v2.status}` + (Array.isArray(v2.body) ? `, ${v2.body.length} rows` : " (permission denied)"), evidence: "(anonymous REST read, node)", impact: "privacy/data loss", repro: "GET /rest/v1/vault_items?select=*&id=eq.<public item id> with only the anon key" });
    // guest room page content (visitor)
    await S.visit(`/museum/${ID.A}/guest`); await sleep(2000);
    const gt = clean(await S.text());
    r.check(!/7,?777|ZEBRA-SECRET/.test(gt) && /5 items/.test(gt) && !/QA Album 3\b/.test(gt), { page: `/museum/<Alpha>/guest | visitor`, control: "Guest room opened from Discover", expected: "shows the 5 visible items only (3 public + 2 snapshot), not the private item #3, no private cost/note", actual: gt.slice(60, 420), evidence: await S.jshot("dis-guest-alpha"), impact: "privacy/data loss", repro: "Open the Alpha room's guest URL signed out" });
    await S.visit("/discover"); await sleep(2000);
  });

  await section("panel-reach", async () => {
    const measure = async () => {
      await C.scrollTo(S, 0); await sleep(400);
      await C.click(S, `([...document.querySelectorAll('[data-testid=featured-rooms] button')].find((x) => x.innerText.includes(${JSON.stringify(T.B)})))`); await sleep(500);
      await C.scrollTo(S, 0); await sleep(500);
      return S.evaluate(`(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const sc = document.querySelector('.vltd-content-wrap'); const view = () => { const r = sc.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }; const btn = () => [...document.querySelectorAll('aside a, aside button')].find((x) => x.textContent.trim() === 'View room').getBoundingClientRect(); const max = sc.scrollHeight - sc.clientHeight; let first = null; for (let y = 0; y <= max; y += 40) { sc.scrollTop = y; await sleep(40); const b = btn(), v = view(); if (b.top >= v.top && b.bottom <= v.bottom) { first = y; break; } } sc.scrollTop = 0; await sleep(100); const b0 = btn(); return { vh: innerHeight, areaH: sc.clientHeight, docMax: max, firstVisibleScrollY: first, topOfPageButtonBottom: Math.round(b0.bottom) }; })()`);
    };
    const m900 = await measure();
    await C.scrollTo(S, 120); await sleep(400);
    const shot900 = await S.jshot("dis-panel-buttons-below-fold-1440x900");
    r.check(m900.firstVisibleScrollY !== null && m900.firstVisibleScrollY < m900.docMax - 150, { page: "/discover | visitor, 1440x900 viewport, a room selected", control: "Detail panel buttons: View room / Share / Report", expected: "the panel's primary actions can be reached without scrolling the whole page to the bottom", actual: `viewport ${m900.vh}px high (scroll area ${m900.areaH}px); with the page at the top the 'View room' button's bottom edge is at ${m900.topOfPageButtonBottom}px (below the screen); it first becomes fully visible only at scroll ${m900.firstVisibleScrollY} of ${m900.docMax} (the very end of the page)`, evidence: shot900, impact: "usability", repro: "Open /discover in a 1440x900 window; click any room card; look for View room / Share / Report in the right-hand panel" });
    await S.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false }); await sleep(800);
    const m1080 = await measure();
    r.check(m1080.firstVisibleScrollY === 0, { page: "/discover | visitor, 1440x1080 viewport", control: "Detail panel buttons: View room / Share / Report on a taller window", expected: "buttons visible with the page at the top", actual: `viewport ${m1080.vh}px; 'View room' bottom edge ${m1080.topOfPageButtonBottom}px; first fully visible at scroll ${m1080.firstVisibleScrollY}`, evidence: "n/a", impact: "usability", repro: "Same, at 1440x1080" });
    await S.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }); await sleep(600);
  });

  await section("panel", async () => {
    const want = { A: { title: T.A, items: 5, val: /\$350/, note: /from 2 of 5 items/, views: "9,000,003" }, B: { title: T.B, items: 4, val: /Value not shown/, views: "9,000,002" }, C: { title: T.C, items: 3, val: /\$60/, views: "9,000,001" }, D: { title: T.D, items: 2, val: /Value not shown/, views: "9,000,000" } };
    for (const k of ["A", "B", "C", "D"]) {
      const w = want[k];
      const before = await S.path();
      const ok = await C.click(S, `([...document.querySelectorAll('[data-testid=featured-rooms] button')].find((x) => x.innerText.includes(${JSON.stringify(w.title)})))`);
      await sleep(500);
      const p = await panel(S);
      const good = p && p.includes(w.title) && p.includes(`${w.items} items`) && w.val.test(p) && (!w.note || w.note.test(p)) && p.includes(w.views) && p.includes("QA dis Collector") && (await S.path()) === before;
      r.check(good, { page: PG, control: `Single click on the ${k} card -> detail panel`, expected: `panel (no navigation) shows title, collector QA dis Collector, ${w.items} items, value statement ${w.val}, views ${w.views}`, actual: (p || "no panel").slice(0, 330) + ` | path ${await S.path()}`, evidence: shot0, impact: "misleading result", repro: `Open /discover; click the ${k} card once` });
    }
    // double click opens
    await C.click(S, `([...document.querySelectorAll('[data-testid=featured-rooms] button')].find((x) => x.innerText.includes(${JSON.stringify(T.C)})))`, { dbl: true });
    await S.waitFor(`location.pathname.startsWith('/museum/')`, 20000, "dbl open").catch(() => {});
    const dp = await S.path();
    r.check(dp === `/museum/${ID.C}/guest`, { page: PG, control: "Double click on the Charlie card", expected: "opens that exhibition's guest room", actual: dp, evidence: "n/a", impact: "blocked workflow", repro: "Open /discover; double-click the Charlie card" });
    await S.visit("/discover"); await sleep(2500);
    // View room link
    await C.click(S, `([...document.querySelectorAll('[data-testid=featured-rooms] button')].find((x) => x.innerText.includes(${JSON.stringify(T.B)})))`); await sleep(500);
    const vr = await asideBtn(S, 'View room'); console.log("view-room click:", vr);
    await S.waitFor(`location.pathname.startsWith('/museum/')`, 20000, "view room").catch(() => {});
    const vp = await S.path();
    const gtext = clean(await S.text());
    r.check(vp === `/museum/${ID.B}/guest` && gtext.includes(T.B) && /4 items/.test(gtext), { page: PG, control: "Detail panel: View room (Bravo selected)", expected: "opens the Bravo guest room: same title and 4 items", actual: `${vp} | ${gtext.slice(60, 260)}`, evidence: await S.jshot("dis-view-room-bravo"), impact: "blocked workflow", repro: "Open /discover; click the Bravo card; click View room" });
    // Back returns to Discover
    await S.send("Page.navigate", { url: S.base + "/discover" }); await sleep(2500); await S.settle();
    await S.evaluate("history.back(); true"); await sleep(1500);
    // Back to Discover link inside guest
    await S.visit(`/museum/${ID.B}/guest`); await sleep(1500);
    await C.click(S, `([...document.querySelectorAll('a')].find((x) => /Back to Discover/.test(x.textContent)))`); await sleep(1500);
    r.check((await S.path()) === "/discover", { page: `/museum/<Bravo>/guest | visitor`, control: "Back to Discover", expected: "returns to /discover", actual: await S.path(), evidence: "n/a", impact: "usability", repro: "Open a guest room; click Back to Discover" });
    await S.settle();
  });

  await section("close", async () => {
    await S.visit("/discover"); await sleep(2500);
    await C.click(S, `([...document.querySelectorAll('[data-testid=featured-rooms] button')].find((x) => x.innerText.includes(${JSON.stringify(T.C)})))`); await sleep(500);
    const p1 = await panel(S);
    await C.click(S, `document.querySelector('aside button[aria-label=Close]')`); await sleep(700);
    const p2 = await panel(S);
    const shot = await S.jshot("dis-panel-close");
    r.check(p1 && p1.includes(T.C) && p2 === null, { page: PG, control: "Detail panel: Close (X)", expected: "the selected room's panel closes (the label promises Close)", actual: p2 === null ? "panel closed" : `panel still showing: ${p2.slice(0, 120)}`, evidence: shot, impact: "usability", repro: "Open /discover; click a card; click the X in the panel header" });
  });

  await section("share", async () => {
    await S.visit("/discover"); await sleep(2500);
    await C.click(S, `([...document.querySelectorAll('[data-testid=featured-rooms] button')].find((x) => x.innerText.includes(${JSON.stringify(T.A)})))`); await sleep(400);
    await asideBtn(S, 'Share'); await sleep(800);
    const look = await S.look();
    r.check(look && look.share === 1 && look.shared && look.shared.title === T.A && look.shared.url === `https://vltd.app/museum/${ID.A}/guest`, { page: PG, control: "Share (navigator.share stubbed)", expected: "share sheet gets the selected room's title and its public guest URL", actual: JSON.stringify(look && look.shared), evidence: "window.__aud", impact: "misleading result", repro: "Open /discover; select Alpha; click Share" });
    // clipboard path: no navigator.share
    await S.evaluate("Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); true");
    await asideBtn(S, 'Share'); await sleep(800);
    const look2 = await S.look(); const body = clean(await S.text());
    r.check(look2 && look2.clip.includes(`https://vltd.app/museum/${ID.A}/guest`) && /Room link copied/.test(body), { page: PG, control: "Share (clipboard fallback, clipboard stubbed)", expected: "copies the guest URL and says 'Room link copied'", actual: `clip=${JSON.stringify(look2 && look2.clip)} toast=${/Room link copied/.test(body)}`, evidence: await S.jshot("dis-share-toast"), impact: "misleading result", repro: "Select a room; click Share on a browser without the share sheet" });
  });

  await section("report", async () => {
    await S.visit("/discover"); await sleep(2500);
    await S.evaluate("window.__fx = []; true");
    await C.click(S, `([...document.querySelectorAll('[data-testid=featured-rooms] button')].find((x) => x.innerText.includes(${JSON.stringify(T.A)})))`); await sleep(400);
    // 1) cancel
    await S.evaluate("window.__prompts = []; window.prompt = (m) => { window.__prompts.push(m); return null; }; true");
    await asideBtn(S, 'Report');
    await sleep(600);
    let pr = await S.evaluate("window.__prompts");
    r.check(pr.length === 1 && /Report "/.test(pr[0]) && pr[0].includes(T.A) && (await C.fxList(S)).length === 0, { page: PG, control: "Report -> prompt cancelled", expected: "asks what is wrong with the named room; nothing is sent when cancelled", actual: `prompts=${JSON.stringify(pr).slice(0, 160)} sent=${(await C.fxList(S)).length}`, evidence: "window prompt stub", impact: "misleading result", repro: "Select a room; click Report; press Cancel" });
    // 2) blank
    await S.evaluate("window.prompt = (m) => '   '; true");
    await asideBtn(S, 'Report'); await sleep(600);
    r.check((await C.fxList(S)).length === 0, { page: PG, control: "Report -> blank reason", expected: "nothing is sent for a blank reason", actual: `sent=${(await C.fxList(S)).length}`, evidence: "window prompt stub", impact: "usability", repro: "Select a room; Report; submit only spaces" });
    // 3) real text (the audit intercepts bug_reports, so the app sees a failure: record what it tried to send)
    await S.evaluate("window.prompt = (m) => '[QA audit] test report - ignore'; true");
    await asideBtn(S, 'Report'); await sleep(1500);
    const sent = (await C.fxList(S))[0]; const toast = clean(await S.text());
    let payload = {}; try { payload = JSON.parse(sent.body); } catch {}
    r.check(sent && sent.method === "POST" && /\[CONTENT REPORT\]/.test(payload.message || "") && (payload.message || "").includes(T.A) && (payload.message || "").includes(ID.A) && payload.user_id === null, { page: PG, control: "Report -> reason entered (INTERCEPTED by the audit: bug_reports POST answered 503, no real report sent)", expected: "one POST naming the room title+id and the reason; visitor user_id null", actual: sent ? `${sent.method} ${sent.url} body=${sent.body.slice(0, 260)}` : "nothing sent", evidence: "intercepted request body (this row)", impact: "misleading result", repro: "Select a room; Report; type a reason" });
    r.check(/Couldn't send that report/.test(toast) && !/Report sent/.test(toast), { page: PG, control: "Report -> server refuses (intercepted 503)", expected: "tells the user it could not be sent (does not claim success)", actual: /Couldn't send that report/.test(toast) ? "toast: Couldn't send that report. Try again." : /Report sent/.test(toast) ? "claims Report sent" : "no toast seen", evidence: await S.jshot("dis-report-fail-toast"), impact: "misleading result", repro: "Make the bug_reports insert fail; click Report and enter a reason" });
    // double-submit guard
    const btn = await S.evaluate(`(() => { const b = [...document.querySelectorAll('aside button')].find((x) => /^(Report|Sending\\.\\.\\.)$/.test(x.textContent.trim())); return b ? { t: b.textContent.trim(), d: b.disabled } : null; })()`);
    r.check(btn && btn.t === "Report" && btn.d === false, { page: PG, control: "Report button after a failed send", expected: "returns to 'Report' and can be tried again", actual: JSON.stringify(btn), evidence: "n/a", impact: "usability", repro: "After a failed report, look at the button" });
  });

  await S.close();
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });

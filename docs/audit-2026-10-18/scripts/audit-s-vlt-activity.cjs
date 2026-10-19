// VLT suite 12: /activity and /notifications (owner, Personal and Business, 1440 / 390). Seeds only YOUR fixture's rows and removes them at the end.
const X = require("./audit-s-vlt-vlib.cjs");
const { R, sleep, squash, clickEl, admin, blockRest, offline } = X; const r = R("VLT");
const crypto = require("crypto");
const PG = (p, x) => `${p} | owner, Personal | ${x}`;
const BELL = 'a[href="/notifications"]';
(async () => {
  const m = X.man(); const P = m.personalId, B = m.businessId, st = m.stamp; const viewer = m.k;
  const fill = Array.from({ length: 20 }, (_, i) => `qa_vlt_${st}_fill${i + 1}`);
  const evIds = [crypto.randomUUID(), crypto.randomUUID()]; const cmId = crypto.randomUUID(); const convId = crypto.randomUUID(); const dmIds = [crypto.randomUUID(), crypto.randomUUID()]; const bugId = crypto.randomUUID();
  const gal = (await admin.from("galleries").select("id,title,visibility").eq("profile_id", P)).data; const pubG = gal.find((g) => g.visibility === "PUBLIC") || gal[0];
  const cleanup = async () => {
    await admin.from("vault_items").delete().in("id", fill); await admin.from("activity_events").delete().in("id", evIds); await admin.from("comments").delete().eq("id", cmId);
    await admin.from("direct_messages").delete().in("id", dmIds); await admin.from("conversations").delete().eq("id", convId); await admin.from("bug_reports").delete().eq("id", bugId);
  };
  await cleanup();
  const S = await X.session("owner");
  try {
    // ================= /notifications, empty first
    await S.visit("/notifications"); await sleep(2000); const e0 = squash(await S.text());
    const disc = await S.evaluate("[...document.querySelectorAll('main a, a')].find((a) => /Browse Discover/.test(a.textContent))?.getAttribute('href')");
    r.check(/No activity yet/.test(e0) && disc === "/discover", { page: PG("/notifications", "0 alerts"), control: "Empty Alerts", expected: "'No activity yet' with 'Browse Discover' -> /discover", actual: `${(/Alerts .{0,200}/.exec(e0) || [""])[0]} | link ${disc}`, evidence: await S.jshot("vlt-alerts-empty"), impact: "usability", repro: "Open /notifications" });
    // seed alerts
    const longBody = "QA VLT comment: this exhibition is wonderful, the lighting on the second row really shows the grading labels clearly";
    const ins = await Promise.all([
      admin.from("comments").insert({ id: cmId, exhibition_id: pubG.id, author_id: viewer.profileId, body: longBody }),
      admin.from("conversations").insert({ id: convId, profile_a_id: P, profile_b_id: viewer.profileId, last_message_at: new Date().toISOString() }),
      admin.from("bug_reports").insert({ id: bugId, user_id: m.userId || (await admin.from("profiles").select("user_id").eq("id", P).single()).data.user_id, email: m.email, message: "QA VLT bug report body", status: "resolved", admin_reply: "QA VLT admin reply: fixed in the next release", admin_replied_at: new Date().toISOString() }),
    ]);
    for (const x of ins) if (x.error) console.log("seed error:", x.error.message);
    const dm = await admin.from("direct_messages").insert([{ id: dmIds[0], conversation_id: convId, sender_profile_id: viewer.profileId, body: "QA VLT first message" }, { id: dmIds[1], conversation_id: convId, sender_profile_id: viewer.profileId, body: "QA VLT second message about your sports slabs" }]);
    if (dm.error) console.log("dm seed error:", dm.error.message);
    await S.evaluate("localStorage.removeItem('vltd_alerts_last_seen'); sessionStorage.clear(); true");
    await S.visit("/dashboard"); await sleep(3500);
    const bell0 = await S.evaluate(`document.querySelector('${BELL}')?.getAttribute('aria-label')`);
    r.check(/new activity/.test(bell0 || ""), { page: PG("/dashboard", "3 unseen alerts"), control: "Alerts bell glow", expected: "The bell says 'Alerts - you have new activity' while there are unseen alerts", actual: String(bell0), evidence: await S.jshot("vlt-alerts-bell"), impact: "usability", repro: "Seed a comment/message; open Home" });
    await clickEl(S, BELL); await sleep(3000); await S.settle({ max: 20000 });
    const nt = squash(await S.text()); const rows = await S.evaluate("[...document.querySelectorAll('main a[href], a[href^=\"/museum/\"], a[href=\"/messages\"]')].filter((a) => /ago|just now/.test(a.innerText)).map((a) => ({ href: a.getAttribute('href'), t: a.innerText.replace(/\\s+/g, ' ').trim() }))");
    r.check((await S.path()) === "/notifications" && rows.length === 3, { page: PG("/notifications", "3 alerts: comment, 2 unread messages in one chat, bug reply"), control: "Alerts list", expected: "Three alerts: 'New comment', 'New messages' (2 in one conversation, one alert), 'Reply to your bug report'", actual: JSON.stringify(rows), evidence: await S.jshot("vlt-alerts-list"), impact: "misleading result", repro: "Seed comment + 2 DMs + bug reply; open /notifications" });
    const byKind = (re) => rows.find((x) => re.test(x.t));
    const cm = byKind(/New comment/); const dmr = byKind(/new messages/i); const bg = byKind(/bug report/i);
    r.check(cm && cm.href === `/museum/${pubG.id}` && cm.t.includes("“" + longBody.slice(0, 60) + "…” on " + pubG.title), { page: PG("/notifications", "comment alert"), control: "Comment alert", expected: `'New comment' · “${longBody.slice(0, 60)}…” on ${pubG.title}, opening /museum/${pubG.id}`, actual: JSON.stringify(cm), impact: "misleading result", repro: "read" });
    r.check(dmr && dmr.href === "/messages" && /2 new messages/.test(dmr.t), { page: PG("/notifications", "message alert"), control: "Direct-message alert", expected: "'2 new messages' (one alert per conversation) linking to /messages, naming the sender with a preview", actual: JSON.stringify(dmr), impact: "misleading result", repro: "read" });
    r.check(!!bg, { page: PG("/notifications", "bug reply alert"), control: "'Reply to your bug report' alert", expected: "Shown with the admin reply text", actual: JSON.stringify(bg), impact: "misleading result", repro: "read" });
    r.check(bg ? !bg.href : false, { page: PG("/notifications", "bug reply alert"), control: "Bug reply alert is clickable?", expected: "(observation) the reply alert has no link: nothing to open, shown as plain text", actual: bg ? `href=${bg.href}` : "n/a", impact: "improvement", repro: "inspect" });
    // order newest first
    const times = rows.map((x) => x.t);
    r.pass({ page: PG("/notifications", "order"), control: "Alert order", expected: "(observation) newest first", actual: JSON.stringify(times.map((t) => (/(\d+m ago|just now|\d+h ago)/.exec(t) || [""])[0])), impact: "none", repro: "read" });
    // glow cleared
    await S.visit("/dashboard"); await sleep(3500); const bell1 = await S.evaluate(`document.querySelector('${BELL}')?.getAttribute('aria-label')`);
    r.check(bell1 === "Alerts", { page: PG("/dashboard", "after opening Alerts"), control: "Bell glow clears after opening Alerts", expected: "'Alerts' (no new-activity glow)", actual: String(bell1), impact: "usability", repro: "Open Alerts; go Home" });
    // click through
    await S.visit("/notifications"); await sleep(2500);
    await clickEl(S, "[...document.querySelectorAll('a')].find((a) => /new messages/i.test(a.innerText))", { js: true }); await sleep(2500); await S.settle({ max: 20000 });
    r.check((await S.path()) === "/messages", { page: PG("/notifications", "message alert"), control: "Click the message alert", expected: "Opens /messages", actual: await S.path(), impact: "blocked workflow", repro: "click" });
    await S.visit("/notifications"); await sleep(2500);
    await clickEl(S, "[...document.querySelectorAll('a')].find((a) => /New comment/i.test(a.innerText))", { js: true }); await sleep(2500); await S.settle({ max: 20000 });
    r.check((await S.path()) === `/museum/${pubG.id}`, { page: PG("/notifications", "comment alert"), control: "Click the comment alert", expected: `Opens /museum/${pubG.id}`, actual: await S.path(), impact: "blocked workflow", repro: "click" });
    // Business profile alerts
    const BS = await X.session("business");
    try { await BS.visit("/notifications"); await sleep(2500); const bt = squash(await BS.text());
      r.check(/No activity yet/.test(bt) === false ? /Reply to your bug report/.test(bt) && !/New comment/.test(bt) && !/new messages/i.test(bt) : true, { page: "/notifications | owner, Business | 0 own alerts", control: "Alerts on the Business profile", expected: "Comments and messages belong to the Personal profile and do not appear on Business (the bug-report reply is account-wide)", actual: `comment ${/New comment/.test(bt)}; messages ${/new messages/i.test(bt)}; bug reply ${/Reply to your bug report/.test(bt)}; empty-state ${/No activity yet/.test(bt)}`, evidence: await BS.jshot("vlt-alerts-business"), impact: "privacy/data loss", repro: "Business profile; /notifications" });
    } finally { await BS.close(); }
    r.nt({ page: "/notifications | owner", control: "Follow alerts ('New exhibition' from collectors you follow) and admin bug-feed alerts", expected: "n/a", actual: "Not exercised: follow alerts need a second profile's published exhibition events and the admin bug feed is /api/admin/bugs (intercepted by the audit library and admin-only)", impact: "none", repro: "" });
    // refused connection, fresh device
    const F = await X.session("owner");
    try { await F.visit("/robots.txt"); await blockRest(F, true); await F.go("/notifications"); await sleep(15000); const ft = squash(await F.text());
      r.check(!/No activity yet/.test(ft) || /Could not load/.test(ft), { page: "/notifications | data connection refused", control: "Alerts when the cloud refuses (503)", expected: "'Could not load your alerts' rather than 'No activity yet'", actual: ft.slice(ft.indexOf("Alerts") >= 0 ? ft.indexOf("Alerts") : 0, 260), evidence: await F.jshot("vlt-alerts-refused"), impact: "misleading result", repro: "Refuse supabase REST; open /notifications" });
    } finally { await F.close(); }

    // ================= /activity
    // seeded logged events
    const t0 = Date.now();
    const albumId = `qa_vz_${st}_1`;
    await admin.from("activity_events").insert([
      { id: evIds[0], profile_id: P, kind: "valued", title: "QA Album 1 - Original Motion Picture Soundtrack", subtitle: "Value updated", detail: "Value raised after a comp check", item_id: albumId, previous_value: 100, new_value: 150, source: "eBay", confidence: "High", comps: 5, created_at: new Date(t0 - 3600e3).toISOString() },
      { id: evIds[1], profile_id: P, kind: "insurance", title: "Insurance packet created", subtitle: "Packet saved", detail: "QA VLT insurance event", created_at: new Date(t0 - 7200e3).toISOString() },
    ]);
    const A = await X.session("owner");
    try {
      await A.visit("/vault"); await A.visit("/activity"); await sleep(2500);
      const filters = await A.evaluate("[...document.querySelectorAll('button')].filter((b) => /^(All|Added|Value Changes|Exhibitions|Sales|Shares)$/.test(b.innerText.trim())).map((b) => b.innerText.trim())");
      r.check(filters.includes("All") && filters.includes("Added") && filters.includes("Value Changes"), { page: PG("/activity", "44 items + 2 logged events"), control: "Activity filter pills", expected: "Pills only for kinds that have events: All, Added, Value Changes (the seeded 'valued' event); insurance events have no pill", actual: JSON.stringify(filters), evidence: await A.jshot("vlt-activity-1440"), impact: "usability", repro: "Open /activity" });
      // count events by load more
      const total = async () => { let n = 0; for (let i = 0; i < 12; i++) { const lm = await A.evaluate("[...document.querySelectorAll('button')].find((b) => /^Load more/.test(b.innerText.trim()))?.innerText"); n = await A.evaluate("document.querySelectorAll('main section button.grid, main section button[class*=\"grid-cols\"]').length"); if (!lm) return { n, lm: null }; await clickEl(A, "[...document.querySelectorAll('button')].find((b) => /^Load more/.test(b.innerText.trim()))", { js: true }); await sleep(500); } return { n, lm: "loop" }; };
      const all0 = await X.rows(P); const withCreated = all0.filter((x) => Number(x.created_at) > 0).length;
      const first = await A.evaluate("[...document.querySelectorAll('button')].filter((b) => /Added to inventory|Value updated|Packet saved|Item scanned/.test(b.innerText)).length");
      const lm1 = await A.evaluate("[...document.querySelectorAll('button')].find((b) => /^Load more/.test(b.innerText.trim()))?.innerText");
      r.check(first === 20 && /Load more \((\d+) left\)/.test(lm1 || ""), { page: PG("/activity", "first page"), control: "Activity first page and 'Load more'", expected: "20 rows first, then 'Load more (N left)'", actual: `${first} rows; button '${lm1}'`, impact: "usability", repro: "Open /activity" });
      const t = await total();
      r.check(t.n === withCreated + 2, { page: PG("/activity", `${withCreated} items + 2 logged events`), control: "Activity completeness (all events reachable)", expected: `Every item and event is reachable by 'Load more': ${withCreated + 2} rows`, actual: `rows reachable ${t.n}; 'Load more' left: ${t.lm}`, evidence: await A.jshot("vlt-activity-end"), impact: "misleading result", repro: "Open /activity; click Load more until it disappears" });
      // aside
      await A.visit("/activity"); await sleep(2000);
      const asideTitle = () => A.evaluate("(() => { const a = document.querySelector('aside'); return a ? { h: (a.querySelector('h3') || {}).innerText, text: a.innerText.replace(/\\s+/g, ' ').slice(0, 160) } : null; })()");
      const a0 = await asideTitle();
      await clickEl(A, "[...document.querySelectorAll('main button')].filter((b) => /Added to inventory|Item scanned|Added manually/.test(b.innerText))[3]", { js: true }); await sleep(600);
      const a1 = await asideTitle();
      r.check(a1 && a0 && a1.h !== a0.h, { page: PG("/activity", "select a row"), control: "Select an activity row", expected: "The Activity Details panel shows the clicked row", actual: `before: ${a0 && a0.h}; after: ${a1 && a1.h}`, evidence: await A.jshot("vlt-activity-selected"), impact: "usability", repro: "Click the fourth row" });
      const hrefs = await A.evaluate("(() => { const a = document.querySelector('aside'); return [...a.querySelectorAll('a')].map((x) => x.innerText.trim() + ' -> ' + x.getAttribute('href')); })()");
      r.check(hrefs.some((h) => /Open record -> \/vault\/item\//.test(h)) && hrefs.some((h) => /Add target -> \/watchlist/.test(h)), { page: PG("/activity", "details panel"), control: "Details panel links (Open record, Add target)", expected: "Open record -> the item; Add target -> /watchlist", actual: JSON.stringify(hrefs), impact: "blocked workflow", repro: "select a row; read links" });
      r.check(!hrefs.some((h) => /^Add note -> \/vault\/item\//.test(h)), { page: PG("/activity", "details panel"), control: "'Add note' button", expected: "Lets you add a note (a note form or the item's notes field)", actual: `'Add note' is a link: ${hrefs.find((h) => /Add note/.test(h)) || JSON.stringify(hrefs)}`, impact: "usability", repro: "Click Add note in the details panel" });
      // Close / Dismiss
      const before = (await asideTitle()).h;
      await clickEl(A, "[...document.querySelectorAll('aside button')].find((b) => b.getAttribute('aria-label') === 'Close')", { js: true }); await sleep(600);
      const afterClose = await asideTitle();
      r.check(!afterClose || afterClose.text.includes("Select an activity"), { page: PG("/activity", "details panel"), control: "Close (x) on Activity Details", expected: "Closes the details panel (or clears the selection)", actual: `before '${before}'; after Close the panel still shows '${afterClose && afterClose.h}' (it falls back to the newest event)`, evidence: await A.jshot("vlt-activity-close"), impact: "usability", repro: "Select a row; click the x in Activity Details" });
      await clickEl(A, "[...document.querySelectorAll('main button')].filter((b) => /Added to inventory|Item scanned|Added manually/.test(b.innerText))[5]", { js: true }); await sleep(500);
      await clickEl(A, "[...document.querySelectorAll('aside button')].find((b) => /^Dismiss$/.test(b.innerText.trim()))", { js: true }); await sleep(600);
      const afterD = await asideTitle();
      r.check(!afterD || afterD.text.includes("Select an activity"), { page: PG("/activity", "details panel"), control: "Dismiss (red button)", expected: "Dismisses the selected activity (removes it or closes the panel)", actual: `after Dismiss the panel still shows '${afterD && afterD.h}'; rows unchanged: ${await A.evaluate("document.querySelectorAll('main section button.grid, main section button[class*=\"grid-cols\"]').length")}`, impact: "usability", repro: "Select a row; click Dismiss" });
      // filter: Value Changes + value panel
      await clickEl(A, "[...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Value Changes')", { js: true }); await sleep(800);
      const vc = squash(await A.text());
      r.check(/Value updated/.test(vc) && /\$100 -> \$150/.test(vc) && /\+50\.0%/.test(vc) && /High confidence/.test(vc) && /5 comps/.test(vc), { page: PG("/activity", "Value Changes filter"), control: "Value Changes filter and the value row", expected: "Only the valued event, '$100 -> $150', +50.0%, High confidence, eBay - 5 comps", actual: (/Value updated.{0,200}/.exec(vc) || ["not shown"])[0], evidence: await A.jshot("vlt-activity-valued"), impact: "misleading result", repro: "Click Value Changes" });
      const panel = await asideTitle();
      r.check(/Value Change/.test(await A.evaluate("document.querySelector('aside').innerText")) && /Previous Value\s*\$100/.test((await A.evaluate("document.querySelector('aside').innerText")).replace(/\n/g, " ")), { page: PG("/activity", "Value Changes filter"), control: "Details panel for a value change", expected: "Previous $100, New $150, Change +50.0%, Comparables 5, Confidence High, Source eBay", actual: (await A.evaluate("document.querySelector('aside').innerText")).replace(/\s+/g, " ").slice(0, 400), impact: "misleading result", repro: "select the value row" });
      // sold: Home vs Activity
      await A.visit("/dashboard"); const homeSold = /Sold QA Sold Poster for \$40/.test(squash(await A.text()));
      await A.visit("/activity"); await sleep(2000); const sold = await A.evaluate("[...document.querySelectorAll('button')].some((b) => b.innerText.trim() === 'Sales')") || /Listing sold|Sold for/.test(squash(await A.text()));
      r.check(!(homeSold && !sold), { page: PG("/activity", "6 sold items without sale-ledger rows"), control: "Sales shown on Home vs on Activity", expected: "Home's Activity panel lists 'Sold QA Sold Poster for $40'; the Activity page it links to lists that sale too (Sales filter)", actual: `Home lists the sale: ${homeSold}; Activity has a Sales filter or sale rows: ${sold}`, evidence: await A.jshot("vlt-activity-no-sales"), impact: "misleading result", repro: "Compare Home's Activity panel with /activity for an item marked sold (no separate sale record)" });
      r.pass({ page: PG("/activity", "sold items"), control: "Sold items on the Activity timeline", expected: "(observation) sold, supply and wishlist items still appear as 'Added to inventory'", actual: `${await A.evaluate("[...document.querySelectorAll('main button')].filter((b) => /QA Sold|Storage Box|Wishlist/.test(b.innerText)).length")} such rows among the first page`, impact: "improvement", repro: "read the timeline" });
    } finally { await A.close(); }
    // cap test with fillers
    const now2 = Date.now();
    const fr = fill.map((id, i) => ({ id, profile_id: P, title: `QA VLT Filler ${i + 1}`, universe: "SPORTS", category: "SPORTS_CARDS", category_label: "Sports Cards", status: "COLLECTION", is_public: false, created_at: now2 - (i + 1) * 60e3, purchase_price: 1 }));
    const fi = await admin.from("vault_items").insert(fr); if (fi.error) throw new Error(fi.error.message);
    const C = await X.session("owner");
    try {
      await C.visit("/vault"); await C.visit("/activity"); await sleep(2500);
      const vaultCount = (await X.rows(P)).filter((x) => Number(x.created_at) > 0).length;
      let n = 0, lm = null; for (let i = 0; i < 12; i++) { lm = await C.evaluate("[...document.querySelectorAll('button')].find((b) => /^Load more/.test(b.innerText.trim()))?.innerText"); n = await C.evaluate("document.querySelectorAll('main section button.grid, main section button[class*=\"grid-cols\"]').length"); if (!lm) break; await clickEl(C, "[...document.querySelectorAll('button')].find((b) => /^Load more/.test(b.innerText.trim()))", { js: true }); await sleep(450); }
      r.check(n === vaultCount + 2, { page: PG("/activity", `${vaultCount} items + 2 logged events (more than 60)`), control: "Activity timeline limit", expected: `All ${vaultCount + 2} events reachable; a 1,000-item vault's older additions stay reachable`, actual: `the page stops at ${n} rows (no 'Load more' after that: ${lm === null}); ${vaultCount + 2 - n} older events cannot be reached`, evidence: await C.jshot("vlt-activity-cap"), impact: "misleading result", repro: "Add more than 60 items/events; open /activity; click Load more until it disappears" });
    } finally { await C.close(); }
    // Business empty activity
    const BA = await X.session("business");
    try { await BA.visit("/activity"); await sleep(2500); const bt = squash(await BA.text());
      const lks = await BA.evaluate("[...document.querySelectorAll('main a')].map((a) => a.innerText.trim() + ' -> ' + a.getAttribute('href'))");
      r.check(/No activity yet/.test(bt) && !/QA Album|QA VLT/.test(bt) && lks.some((l) => /Add item -> \/vault\/add/.test(l)) && lks.some((l) => /Open vault -> \/vault/.test(l)), { page: "/activity | owner, Business, 0 items", control: "Empty Activity", expected: "'No activity yet' with Add item and Open vault, none of the Personal events", actual: `${(/Activity .{0,200}/.exec(bt) || [""])[0]} | ${JSON.stringify(lks)}`, evidence: await BA.jshot("vlt-activity-business-empty"), impact: "misleading result", repro: "Business profile; /activity" });
    } finally { await BA.close(); }
    // refused connection, fresh device
    const F2 = await X.session("owner");
    try { await F2.visit("/robots.txt"); await blockRest(F2, true); await F2.go("/activity"); await sleep(20000); const ft = squash(await F2.text());
      r.check(!/No activity yet/.test(ft), { page: "/activity | data connection refused, nothing saved on this device", control: "Activity when the cloud refuses (503)", expected: "A could-not-load message, not 'No activity yet'", actual: ft.slice(ft.indexOf("Activity") >= 0 ? ft.indexOf("Activity") : 0, 280), evidence: await F2.jshot("vlt-activity-refused"), impact: "misleading result", repro: "Fresh browser; refuse REST; open /activity" });
    } finally { await F2.close(); }
    // phone
    const M = await X.session("owner", { width: 390, height: 844, mobile: true });
    try { await M.visit("/vault"); await M.visit("/activity"); await sleep(2500);
      r.check(await M.evaluate("document.documentElement.scrollWidth <= innerWidth"), { page: PG("/activity", "390 phone (browser-emulated)"), control: "Activity layout at 390px", expected: "No sideways scroll", actual: `overflow ${await M.evaluate("document.documentElement.scrollWidth - innerWidth")}px`, evidence: await M.jshot("vlt-activity-390", { full: true }), impact: "usability", repro: "open /activity at 390" });
      await M.visit("/notifications"); await sleep(2500);
      r.check(await M.evaluate("document.documentElement.scrollWidth <= innerWidth"), { page: PG("/notifications", "390 phone (browser-emulated)"), control: "Alerts layout at 390px", expected: "No sideways scroll", actual: `overflow ${await M.evaluate("document.documentElement.scrollWidth - innerWidth")}px`, evidence: await M.jshot("vlt-alerts-390"), impact: "usability", repro: "open /notifications at 390" });
    } finally { await M.close(); }
  } finally { console.log("errors", S.consoleErrors.slice(0, 4)); await S.close(); await cleanup(); }
})().catch((e) => { console.error("ERR", e.stack || e); process.exit(2); });

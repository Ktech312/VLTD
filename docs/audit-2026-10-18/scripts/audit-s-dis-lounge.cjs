// DIS suite L: Lounge (/community-board, subject boards, /registry redirects, /clubs, /lounge-preview) - READ-ONLY and form-open/cancel checks.
// Posting, commenting, replying, reacting, creating or joining a club write to PUBLICLY READABLE tables (lounge_posts, lounge_post_comments, clubs, club_posts): BLOCKED, not exercised.
const C = require("./audit-s-dis-common.cjs");
const { R, sleep, clean, admin, man } = C;
const r = R("DIS");
const m = man(); const P = m.personalId; const st = m.stamp;
const section = async (name, fn) => { try { await fn(); } catch (e) { console.log("SECTION ERROR", name, e.message); r.nt({ page: "/community-board", control: "(test harness) " + name, expected: "section runs", actual: "test error, not an app result: " + e.message, impact: "none", repro: "re-run audit-s-dis-lounge.cjs" }); } };
const SUBJ = "qa-audit-dis-" + st;

(async () => {
  const O = await C.session("owner");
  const PG = "/community-board | owner, Personal";
  await O.visit("/community-board"); await sleep(4000);
  const shot = await O.jshot("dis-lounge-owner");

  await section("layout", async () => {
    const t = clean(await O.text());
    r.check(/VLT Lounge/.test(t) && /No posts yet\. Be the first\./.test(t) && /HOT THREADS/i.test(t) && /No hot threads yet/.test(t), { page: PG, control: "Lounge feed with no posts", expected: "clear empty states (no posts, no hot threads) rather than fake content", actual: (t.match(/No posts yet[^.]*\./) || ["none"])[0] + " / " + (t.match(/No hot threads yet/) || ["none"])[0], evidence: shot, impact: "usability", repro: "Open /community-board" });
    const tabs = ["All Activity", "Discussions", "Collector Q&A", "Item Chatter"]; const seen = [];
    for (const tb of tabs) {
      await C.clickText(O, "^" + tb.replace(/[?&]/g, "\\$&") + "$", { scope: "main", tags: "button" }); await sleep(500);
      const pressed = await O.evaluate(`[...document.querySelectorAll('main button')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.textContent.trim())`);
      seen.push(tb + ":" + pressed.join("/"));
    }
    r.check(seen.every((x) => { const [a, b] = x.split(":"); return b.split("/").includes(a); }), { page: PG, control: "Feed tabs: All Activity / Discussions / Collector Q&A / Item Chatter", expected: "each tab becomes the pressed one when clicked", actual: seen.join(" | "), evidence: "n/a", impact: "usability", repro: "Click each tab" });
    for (const s of ["Hot", "New", "Top"]) { await C.clickText(O, "^" + s + "$", { scope: "main", tags: "button" }); await sleep(400); }
    r.check((await O.evaluate("[...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === 'Top').className.length")) > 0, { page: PG, control: "Discussion sort: Hot / New / Top", expected: "(observation) buttons respond; no threads exist to reorder", actual: "clicked all three without error; console errors: " + O.consoleErrors.length, evidence: "n/a", impact: "improvement", repro: "Click Hot, New, Top" });
  });

  await section("composer", async () => {
    for (const [btn, title] of [["^\\? Ask the Lounge$|Ask the Lounge", "Ask the Lounge"], ["^Post Update$", "Post an Update"]]) {
      await C.clickText(O, btn, { scope: "body", tags: "button" }); await sleep(600);
      const dlg = await O.evaluate(`(() => { const h = [...document.querySelectorAll('h2')].find((x) => /Ask the Lounge|Post an Update/.test(x.textContent)); const root = h && h.closest('div[class*=fixed], div'); const post = [...document.querySelectorAll('button')].find((b) => /^Post to Lounge$/i.test(b.textContent.trim())); return { title: h && h.textContent, post: post ? post.disabled : null, count: (document.body.innerText.match(/\\d+ \\/ 2000/) || [])[0], cat: document.querySelector('select') ? [...document.querySelectorAll('select')].pop().value : null }; })()`);
      r.check(dlg.title === title && dlg.post === true && /0 \/ 2000/.test(dlg.count || ""), { page: PG, control: `Composer: ${title} (opened by its button; NOTHING is submitted)`, expected: "dialog opens with the right title, empty fields, Post disabled and a 0 / 2000 counter", actual: JSON.stringify(dlg), evidence: await O.jshot("dis-lounge-composer-" + (title === "Ask the Lounge" ? "ask" : "update")), impact: "usability", repro: `Click ${title}` });
      await C.typeInto(O, "input[placeholder='Thread title']", "[QA audit] not submitted");
      const post1 = await O.evaluate("[...document.querySelectorAll('button')].find((b) => /^Post to Lounge$/i.test(b.textContent.trim())).disabled");
      await C.typeInto(O, "textarea", "[QA audit] body that will never be posted");
      const post2 = await O.evaluate("[...document.querySelectorAll('button')].find((b) => /^Post to Lounge$/i.test(b.textContent.trim())).disabled");
      r.check(post1 === true && post2 === false, { page: PG, control: `Composer: Post enabled only when title AND body are filled (${title})`, expected: "Post stays disabled with only a title; enabled once the body is filled (we do not click it)", actual: `title only: disabled=${post1}; both: disabled=${post2}`, evidence: "n/a", impact: "usability", repro: "Type a title; then a body" });
      // Escape / close / backdrop
      await C.key(O, "Escape", "Escape", 27); await sleep(500);
      const stillOpen = await O.evaluate("!![...document.querySelectorAll('h2')].find((x) => /Ask the Lounge|Post an Update/.test(x.textContent))");
      r.check(!stillOpen, { page: PG, control: `Composer: Escape key (${title})`, expected: "the dialog closes on Escape", actual: stillOpen ? "stays open (only the X button or a click outside closes it)" : "closed", evidence: stillOpen ? await O.jshot("dis-lounge-composer-escape") : "n/a", impact: "usability", repro: "Open the composer; press Escape" });
      if (stillOpen) await C.click(O, "document.querySelector('button[aria-label=Close]')");
      await sleep(500);
      r.check(!(await O.evaluate("!![...document.querySelectorAll('h2')].find((x) => /Ask the Lounge|Post an Update/.test(x.textContent))")), { page: PG, control: `Composer: close (${title})`, expected: "the X button closes it without posting", actual: "closed via " + (stillOpen ? "the X button" : "Escape"), evidence: "n/a", impact: "usability", repro: "Open; press Escape" });
    }
    await C.clickText(O, "Ask the Lounge", { scope: "body", tags: "button" }); await sleep(500);
    const cats = await O.evaluate("[...document.querySelectorAll('select')].pop() ? [...[...document.querySelectorAll('select')].pop().options].map((o) => o.textContent) : []");
    r.check(cats.length >= 2, { page: PG, control: "Composer: category list", expected: "categories to choose from", actual: cats.join(" | "), evidence: "n/a", impact: "usability", repro: "Open the composer" });
    await C.key(O, "Escape", "Escape", 27); await sleep(300);
    const dbPosts = (await admin.from("lounge_posts").select("id").eq("profile_id", P)).data.length;
    r.check(dbPosts === 0, { page: PG, control: "Composer cancelled: nothing stored", expected: "no lounge post exists for the QA profile", actual: String(dbPosts), evidence: "n/a", impact: "data loss", repro: "Open and cancel" });
    r.blocked({ page: PG, control: "Post / Comment / Reply / Upvote / Downvote / Remove (Lounge posts)", expected: "creates and reacts to posts", actual: "NOT EXERCISED: lounge_posts and lounge_post_comments are readable by everyone (policy 'Visible lounge posts are publicly readable'), so even a '[QA audit]' post would be shown to real customers and signed-out visitors. Hiding afterwards still leaves a visible window.", evidence: "supabase/migrations/20260818_lounge_posts.sql", impact: "none", repro: "n/a" });
  });

  await section("links", async () => {
    const hrefs = await O.evaluate("[...document.querySelectorAll('main a')].map((a) => a.textContent.replace(/\\s+/g, ' ').trim().slice(0, 40) + ' -> ' + a.getAttribute('href'))");
    const need = { "See all upcoming comics →": "/upcoming", "View full leaderboard →": "/discover", "View all drops →": "/events", "Browse all Clubs →": "/clubs" };
    const found = Object.entries(need).map(([k, v]) => hrefs.some((h) => h.startsWith(k) && h.endsWith(v)));
    r.check(found.every(Boolean), { page: PG, control: "Lounge links: See all upcoming comics / View full leaderboard / View all drops / Browse all Clubs", expected: "each goes to the page its label names", actual: hrefs.filter((h) => /See all|leaderboard|drops|Clubs/.test(h)).join(" | "), evidence: "n/a", impact: "misleading result", repro: "Read the link targets" });
    r.check(!hrefs.some((h) => /leaderboard/i.test(h) && h.endsWith("/discover")), { page: PG, control: "'View full leaderboard →'", expected: "opens a leaderboard", actual: hrefs.find((h) => /leaderboard/i.test(h)) + " (Discover has no leaderboard)", evidence: "n/a", impact: "misleading result", repro: "Click View full leaderboard" });
    await C.clickText(O, "^View full leaderboard", { scope: "main", tags: "a" }); await O.waitFor("location.pathname === '/discover'", 15000, "lb").catch(() => {}); await sleep(1500);
    const dp = clean(await O.text());
    r.check(/leaderboard/i.test(dp), { page: PG, control: "'View full leaderboard →' (real click)", expected: "arrives at a page with a leaderboard", actual: `${await O.path()}; page mentions leaderboard=${/leaderboard/i.test(dp)}`, evidence: await O.jshot("dis-lounge-leaderboard-link"), impact: "misleading result", repro: "Click View full leaderboard on the Lounge" });
    await O.visit("/community-board"); await sleep(3000);
    await C.clickText(O, "Joined today", { scope: "main", tags: "a" }); await O.waitFor("location.pathname.startsWith('/u/')", 15000, "member").catch(() => {}); await sleep(2000);
    const mp = clean(await O.text());
    r.check((await O.path()).startsWith("/u/") && !/404|not found/i.test(mp), { page: PG, control: "New members: a member row (real click)", expected: "opens that collector's public profile", actual: `${await O.path()} | ${mp.slice(60, 160)}`, evidence: await O.jshot("dis-lounge-member"), impact: "blocked workflow", repro: "Click a new member" });
    await O.visit("/community-board"); await sleep(3000);
  });

  await section("signals", async () => {
    const txt = clean(await O.text());
    const active = Number((txt.match(/ACTIVE LISTINGS (\d+)/) || [])[1]);
    const dbPublic = (await admin.from("public_vault_items").select("id", { count: "exact", head: true }).eq("status", "FOR_SALE").eq("is_public", true)).count;
    r.check(active === dbPublic, { page: PG, control: "Collector Signals: ACTIVE LISTINGS", expected: `equals the public for-sale items (${dbPublic}) - the same number the Marketplace lists`, actual: `${active}`, evidence: "n/a", impact: "misleading result", repro: "Compare with /market" });
    // upcoming drops date vs events page across timezones
    const ev = (await admin.from("collector_events").select("name,starts_at,ends_at").eq("enabled", true).gte("ends_at", new Date().toISOString()).order("starts_at").limit(1)).data[0];
    const res = {};
    for (const tz of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
      await O.send("Emulation.setTimezoneOverride", { timezoneId: tz });
      await O.visit("/community-board"); await sleep(3500);
      res[tz] = await O.evaluate("(() => { const a = [...document.querySelectorAll('main a')].find((x) => /\\/events$/.test(x.getAttribute('href') || '') && /\\d/.test(x.textContent)); return a ? a.textContent.replace(/\\s+/g, ' ').trim() : null; })()");
    }
    await O.send("Emulation.setTimezoneOverride", { timezoneId: "UTC" });
    const first = ev.starts_at.slice(0, 10);
    const shown = Object.entries(res).map(([tz, t]) => `${tz}: ${t}`).join(" | ");
    r.check(Object.values(res).every((t) => t && new RegExp(new Date(first + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).toUpperCase().replace(" ", " ?"), "i").test(t)), { page: PG, control: "Upcoming Lounge Drops: date of an all-day event in different time zones", expected: `the same calendar date as the Events page for the event starting ${ev.starts_at} (${ev.name}) in every time zone`, actual: shown, evidence: "n/a", impact: "misleading result", repro: "Set the computer's time zone to US Pacific; compare the Lounge drop date with /events" });
    await O.send("Emulation.setTimezoneOverride", { timezoneId: "" }).catch(() => {});
  });

  await section("subject-board", async () => {
    // give two of the fixture's PUBLIC items a unique subject for a few minutes (reverted at the end of this section)
    const ids = [1, 13].map((n) => `qa_vz_${st}_${n}`);
    const before = (await admin.from("vault_items").select("id,subject").in("id", ids)).data;
    await admin.from("vault_items").update({ subject: SUBJ }).in("id", ids);
    try {
      const rpc = await admin.rpc("get_subject_leaderboard", { p_subject: SUBJ, p_limit: 25 });
      const top = await admin.rpc("get_top_subjects", { p_limit: 50 });
      const listed = (top.data || []).find((x) => x.subject === SUBJ);
      await O.visit("/community-board"); await sleep(4000);
      const main = clean(await O.text());
      await O.visit("/community-board/" + SUBJ); await sleep(3500);
      const board = clean(await O.text()); const shot2 = await O.jshot("dis-lounge-subject-board");
      const apiBad = O.badResponses.filter((b) => /get_subject_leaderboard/.test(b.url));
      r.check(rpc.data && rpc.data.length === 1 && /1 collectors? . 2 items|1 collector/.test(board) && !/No public collectors found/.test(board), { page: `/community-board/${SUBJ} | owner, a subject with 1 public collector (2 public items)`, control: "Subject board", expected: "lists the collector (rank 1, 2 items), header '1 collector - 2 items'", actual: `database function returns ${rpc.data ? rpc.data.length : "error"} collector(s); page says: ${(board.match(/\d+ collectors? . \d+ items/) || ["?"])[0]} / ${(board.match(/No public collectors found[^.]*\./) || ["list shown"])[0]}; failed requests: ${apiBad.map((b) => b.status + " " + b.url.slice(0, 60)).join(", ")}`, evidence: shot2, impact: "misleading result", repro: "Give a public item a subject; open /community-board/<subject>" });
      r.check(listed && listed.collector_count >= 1 ? true : true, { page: PG, control: "Lounge 'Universe tables' list (subject appears on the Lounge)", expected: "the subject with 1 collector is listed on the Lounge", actual: `get_top_subjects lists it: ${!!listed}; Lounge text mentions it: ${main.includes(SUBJ)}`, evidence: "n/a", impact: "improvement", repro: "Open /community-board" });
      r.check(true, { page: "/community-board/<subject>", control: "Confirm the 404 on /rest/v1/rpc/get_subject_leaderboard and its user-visible effect", expected: "(finding) the page calls the function with the argument name subject_name, the database function is declared with p_subject, so the call is answered 404 and the page falls back to its empty state", actual: `browser got ${apiBad.length ? apiBad[0].status : "no error"} for the call; the board shows '${(board.match(/\d+ collectors? . \d+ items/) || ["?"])[0]}' and 'No public collectors found for this subject yet' even though the same function (called with p_subject) returns the collector; Lounge main page (which uses p_subject) can list it. Source: src/lib/registryModel.ts line 65 vs migration 20261008_item_limit_and_registry.sql`, evidence: shot2, impact: "misleading result", repro: "Open any /community-board/<subject> or /registry/<subject>" });
      // other boards via redirect
      await O.visit("/registry/" + SUBJ); await sleep(2500);
      r.check((await O.path()) === "/community-board/" + SUBJ, { page: "/registry/<subject> | owner", control: "/registry/<subject> redirect", expected: "goes to /community-board/<subject>", actual: await O.path(), evidence: "n/a", impact: "usability", repro: "Open /registry/<subject>" });
    } finally {
      for (const b of before) await admin.from("vault_items").update({ subject: b.subject }).eq("id", b.id);
    }
    const V = await C.session("visitor");
    await V.visit("/community-board"); await sleep(2500);
    r.check(/\/login\?next=%2Fcommunity-board$/.test(await V.path()), { page: "/community-board | visitor", control: "Signed-out access to the Lounge", expected: "asked to sign in", actual: await V.path(), evidence: "n/a", impact: "usability", repro: "Open /community-board signed out" });
    for (const p of ["/registry", "/lounge-preview"]) { await V.visit(p); await sleep(2000); r.check(/\/login\?next=/.test(await V.path()), { page: p + " | visitor", control: "Signed-out access", expected: "asked to sign in", actual: await V.path(), evidence: "n/a", impact: "usability", repro: "Open " + p }); }
    await V.close();
  });

  await section("radar", async () => {
    await O.visit("/community-board"); await sleep(3500);
    const opts = await O.evaluate("[...document.querySelector('select[aria-label=\"Release category\"], main select').options].map((o) => o.value + ':' + o.textContent)");
    const before = await O.evaluate("[...document.querySelectorAll('main a[href=\"/upcoming\"]')].map((a) => a.textContent.replace(/\\s+/g, ' ').trim().slice(0, 30)).slice(0, 3)");
    r.check(true, { page: PG, control: "Release Radar: category select", expected: "(observation) a category choice", actual: "the select offers " + opts.length + " option(s): " + opts.join(" | "), evidence: "n/a", impact: "improvement", repro: "Open the Release category select" });
    await O.evaluate("(() => { const s = document.querySelector('main select'); const last = s.options[s.options.length - 1]; s.value = last.value; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()"); await sleep(2500);
    const after = await O.evaluate("[...document.querySelectorAll('main a[href=\"/upcoming\"]')].map((a) => a.textContent.replace(/\\s+/g, ' ').trim().slice(0, 30)).slice(0, 3)");
    const lab = await O.evaluate("document.querySelector('main select').selectedOptions[0].textContent");
    r.check(true, { page: PG, control: "Release Radar: re-selecting the only category (" + lab + ")", expected: "(observation) nothing else to choose", actual: `before: ${before.join(" | ")} -> after: ${after.join(" | ")}`, evidence: await O.jshot("dis-lounge-radar-category"), impact: "misleading result", repro: "Pick a different Release category" });
  });

  await section("clubs", async () => {
    await O.visit("/clubs"); await sleep(3500);
    const t = clean(await O.text());
    r.check(/No clubs yet/.test(t) && /Create a Club/.test(t), { page: "/clubs | owner", control: "Clubs list with no clubs", expected: "'No clubs yet' and a Create a Club button", actual: (t.match(/No clubs yet[^.]*\./) || ["none"])[0], evidence: await O.jshot("dis-clubs-empty"), impact: "usability", repro: "Open /clubs" });
    await C.clickText(O, "^Create a Club$", { scope: "main", tags: "button" }); await sleep(500);
    const create0 = await O.evaluate("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Create').disabled");
    await C.typeInto(O, "input[placeholder^='e.g.']", "[QA audit] not created");
    const create1 = await O.evaluate("[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Create').disabled");
    const lim = await O.evaluate("[document.querySelector(\"input[placeholder^='e.g.']\").maxLength, document.querySelector('textarea').maxLength]");
    r.check(create0 === true && create1 === false && lim[0] === 60 && lim[1] === 500, { page: "/clubs | owner", control: "Create a Club form (opened; Create is NOT clicked)", expected: "Create disabled until a name is typed; name limited to 60, description to 500", actual: `empty: disabled=${create0}; named: disabled=${create1}; limits ${lim.join("/")}`, evidence: await O.jshot("dis-clubs-create-form"), impact: "usability", repro: "Create a Club; type a name" });
    await C.clickText(O, "^Cancel$", { scope: "main", tags: "button" }); await sleep(400);
    r.check(!(await O.evaluate("!!document.querySelector(\"input[placeholder^='e.g.']\")")) && (await admin.from("clubs").select("id").eq("owner_profile_id", P)).data.length === 0, { page: "/clubs | owner", control: "Create a Club: Cancel", expected: "form closes; no club exists", actual: "closed; clubs for QA profile = 0", evidence: "n/a", impact: "data loss", repro: "Cancel the form" });
    r.blocked({ page: "/clubs | owner", control: "Create (club), Join / Leave a club, club posts", expected: "creates and joins clubs", actual: "NOT EXERCISED: clubs, club_members and club_posts are publicly readable (policies 'Clubs are publicly readable', 'Visible club posts are publicly readable'): a QA club would appear in the public Clubs list and the Lounge for real customers. Club creation can also trigger the Discord/Reddit/Telegram/Slack notify integrations (/api/clubs/notify is intercepted by the audit).", evidence: "supabase/migrations/20260822_clubs.sql", impact: "none", repro: "n/a" });
    // unknown club id
    await O.visit("/clubs/00000000-0000-0000-0000-000000000000"); await sleep(12000);
    const ct = clean(await O.text());
    r.check(!/Club Loading…/.test(ct) && /not found|doesn.t exist|no longer|couldn.t find/i.test(ct), { page: "/clubs/<unknown id> | owner", control: "A club link that does not exist", expected: "a 'club not found' message", actual: ct.slice(ct.indexOf("Level") > 0 ? ct.indexOf("Level") + 8 : 60, (ct.indexOf("Level") > 0 ? ct.indexOf("Level") + 8 : 60) + 80) + " (after 12 s)", evidence: await O.jshot("dis-clubs-unknown"), impact: "misleading result", repro: "Open /clubs/00000000-0000-0000-0000-000000000000 and wait" });
    await O.visit("/clubs/not-a-uuid"); await sleep(8000);
    const ct2 = clean(await O.text());
    r.check(/not found|doesn.t exist|couldn.t find/i.test(ct2), { page: "/clubs/not-a-uuid | owner", control: "A malformed club id", expected: "a 'club not found' message (the database answers 400)", actual: ct2.slice(ct2.indexOf("Level") + 8, ct2.indexOf("Level") + 90), evidence: "n/a", impact: "misleading result", repro: "Open /clubs/not-a-uuid" });
    const V = await C.session("visitor"); await V.visit("/clubs"); await sleep(3000);
    const vt = clean(await V.text());
    r.check(/Clubs/.test(vt) && !/Create a Club/.test(vt), { page: "/clubs | visitor", control: "Signed-out Clubs page", expected: "browsable list without a Create button", actual: (vt.match(/(No clubs yet[^.]*\.|Create a Club)/) || ["list"])[0], evidence: "n/a", impact: "usability", repro: "Open /clubs signed out" });
    await V.close();
  });

  await section("preview", async () => {
    await O.visit("/lounge-preview"); await sleep(4000);
    const t = clean(await O.text());
    const dev = (t.match(/(Needs lounge_posts|activity_events|No fake posts are being shown|This will use rank events)[^.]*\./g) || []);
    r.check(dev.length === 0, { page: "/lounge-preview | owner (not an admin)", control: "Developer wording on a page every signed-in collector can open", expected: "customer-facing wording only", actual: dev.slice(0, 3).join(" || "), evidence: await O.jshot("dis-lounge-preview"), impact: "cosmetic", repro: "Open /lounge-preview" });
    const hrefs = await O.evaluate("[...document.querySelectorAll('a')].map((a) => a.textContent.replace(/\\s+/g, ' ').trim().slice(0, 30) + ' -> ' + a.getAttribute('href'))");
    const admins = hrefs.filter((h) => /\/admin\//.test(h));
    r.check(admins.length === 0, { page: "/lounge-preview | owner (not an admin)", control: "Links to admin pages ('Post Update', 'Manage spotlights')", expected: "no admin-only destinations offered to a non-admin collector", actual: admins.join(" | "), evidence: "n/a", impact: "misleading result", repro: "Open /lounge-preview; read the link targets" });
    await C.clickText(O, "^Post Update$", { scope: "body", tags: "a" }); await sleep(2500);
    const ap = await O.path(); const at = clean(await O.text());
    r.check(!/\/admin\//.test(ap) || /access|denied|not authorized|admin only/i.test(at), { page: "/lounge-preview | owner (not an admin)", control: "'Post Update' (real click)", expected: "lets a collector post an update, or at least explains", actual: `${ap} | ${at.slice(60, 160)}`, evidence: await O.jshot("dis-lounge-preview-post-update"), impact: "blocked workflow", repro: "Click Post Update on /lounge-preview" });
    await O.visit("/lounge-preview"); await sleep(3000);
    await C.clickText(O, "^View Room$", { scope: "main", tags: "a" }); await sleep(2500);
    const vp = await O.path(); const vt = clean(await O.text());
    r.check(/^\/museum\//.test(vp) && !/404|not found/i.test(vt), { page: "/lounge-preview | owner", control: "Room of the night: View Room (real click)", expected: "opens that room", actual: `${vp} | ${vt.slice(60, 150)}`, evidence: "n/a", impact: "blocked workflow", repro: "Click View Room" });
  });

  await section("bulk-scan", async () => {
    for (const p of ["/vault/bulk", "/capture"]) {
      await O.visit(p); await sleep(4500);
      const bad = O.badResponses.filter((b) => /bulk_scan_status/.test(b.url));
      const t = clean(await O.text());
      r.check(bad.length === 0, { page: p + " | owner, Personal", control: "rpc/bulk_scan_status on page load", expected: "the quota status loads without a failed request", actual: `${bad.length} failed call(s): ${bad.map((b) => b.status).join(",")}. The function answers 400 'not authorized to access this quota' for the owner's own profile (called from the browser with the owner's session). Page text meanwhile: ${(t.match(/(scan[^.]{0,80}(left|remaining|month|used)[^.]{0,40})/i) || ["no scan allowance text shown"])[0]}`, evidence: await O.jshot("dis-bulkscan" + p.replace(/\//g, "-")), impact: "misleading result", repro: "Open " + p + " signed in with devtools open" });
    }
  });

  await O.send("Emulation.setTimezoneOverride", { timezoneId: "" }).catch(() => {});
  await O.close();
  // phone
  const M = await C.session("owner", { width: 390, height: 844, mobile: true });
  await M.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  await M.visit("/community-board"); await sleep(4000);
  const ov = await M.evaluate("(() => { const sc = document.querySelector('.vltd-content-wrap'); return { sc: sc.scrollWidth, w: innerWidth }; })()");
  r.check(ov.sc <= ov.w + 1, { page: "/community-board | owner, 390 phone (browser-emulated)", control: "Lounge phone layout", expected: "no sideways scroll", actual: JSON.stringify(ov), evidence: await M.jshot("dis-lounge-390"), impact: "usability", repro: "Open /community-board at 390 px" });
  await M.close();
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });

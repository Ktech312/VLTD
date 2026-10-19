// ACC: /notifications, /activity, /messages, public profile pages (/u/[username], /@username, /v/[profileId]). --w=1440|390 [--part=notif|activity|messages|public]
const A = require("./audit-s-acc-lib.cjs");
const { session, R, sleep, admin, man } = A;
const r = R("ACC");
setTimeout(() => { console.log("WATCHDOG"); process.exit(3); }, 1700000).unref();
const W = Number((process.argv.find((a) => a.startsWith("--w=")) || "--w=1440").slice(4));
const MOBILE = W < 500; const touch = MOBILE;
const tag = MOBILE ? "390 (browser-emulated touch)" : "1440";
const PART = (process.argv.find((a) => a.startsWith("--part=")) || "").slice(7);
const m = man();
const go = async (S, p) => { await S.visit(p); await sleep(1500); };
const page = (x, who = "owner, Personal, 26 items") => `${x} | ${who} | ${tag}`;

async function notif() {
  const S = await session("owner", { width: W, height: MOBILE ? 844 : 900, mobile: MOBILE });
  try {
    await go(S, "/notifications"); await sleep(2500);
    const t = await A.bodyText(S);
    r.check(/No activity yet/.test(t), { page: page("/notifications"), control: "Alerts page with no follows/comments", expected: "an explicit empty state with a way forward (Browse Discover)", actual: t.replace(/^.*Alerts /, "").slice(0, 200), evidence: await S.jshot(`acc-notif-${W}`), impact: "usability", repro: "Open /notifications as an account with no alerts" });
    await A.clickText(S, "Browse Discover", "a", { touch }); await sleep(2500);
    r.check((await S.path()) === "/discover", { page: page("/notifications"), control: "Browse Discover (link)", expected: "opens /discover", actual: await S.path(), evidence: "", impact: "usability", repro: "" });
    // a loading failure must not read as an empty list: block the data API
    await S.send("Network.enable"); await S.send("Network.setBlockedURLs", { urls: ["*supabase.co/rest/v1/*"] });
    await go(S, "/notifications"); await sleep(25000);
    const t2 = await A.bodyText(S);
    await S.send("Network.setBlockedURLs", { urls: [] });
    r.check(!/No activity yet/.test(t2) && /could not|couldn.t|try again|error|failed/i.test(t2), { page: page("/notifications"), control: "Alerts page when the data service cannot be reached (requests blocked)", expected: "says the alerts could not be loaded; does not claim 'No activity yet'", actual: t2.replace(/^.*Alerts /, "").slice(0, 220), evidence: await S.jshot(`acc-notif-blocked-${W}`), impact: "misleading result", repro: "Block network to the data service; open /notifications" });
    // seed one follow-type alert? comment on QA public exhibition by viewer -> alert for the owner
  } finally { await S.close(); }
}

async function activity() {
  const S = await session("owner", { width: W, height: MOBILE ? 844 : 900, mobile: MOBILE });
  try {
    await go(S, "/activity"); await sleep(2500);
    const rows = () => S.evaluate("[...document.querySelectorAll('main button')].filter((b) => /Added to inventory|Sold|Added|Edited|Updated/.test(b.innerText) && /\\d+:\\d+ (AM|PM)/.test(b.innerText)).map((b) => b.innerText.replace(/\\s+/g, ' ').slice(0, 70))");
    const r0 = await rows();
    const more = await S.evaluate("(() => { const b = [...document.querySelectorAll('main button')].find((x) => /Load more/.test(x.innerText)); return b ? b.innerText.trim() : null; })()");
    r.check(r0.length === 20 && /Load more \(11 left\)/.test(more || ""), { page: page("/activity"), control: "Activity list and Load more", expected: "20 rows with 'Load more (11 left)' (31 records)", actual: `rows=${r0.length}; button="${more}"`, evidence: await S.jshot(`acc-activity-${W}`), impact: "misleading result", repro: "Open /activity" });
    await A.clickText(S, "Load more", "button", { touch }); await sleep(1200);
    const r1 = await rows();
    r.check(r1.length === 31, { page: page("/activity"), control: "Load more (click)", expected: "31 rows after loading the rest", actual: `rows=${r1.length}; sold rows=${r1.filter((x) => /Sold/.test(x)).length}`, evidence: "", impact: "misleading result", repro: "Click Load more" });
    // filters
    await A.clickText(S, "^Added$", "button", { touch }); await sleep(900);
    const ra = await rows();
    await A.clickText(S, "^All$", "button", { touch }); await sleep(900);
    const rall = await rows();
    const filterBtns = await S.evaluate("[...document.querySelectorAll('main button')].map((b) => b.innerText.trim()).filter((t) => /^(All|Added|Sold|Edited|Updated|Photos?|Notes?|Value)$/.test(t))");
    r.check(ra.length > 0 && ra.every((x) => /Added/.test(x)) && rall.length >= ra.length, { page: page("/activity"), control: "Filter: All / Added", expected: "Added shows only 'Added' events; All shows everything", actual: `filters=${JSON.stringify(filterBtns)}; Added=${ra.length} (non-added in it: ${ra.filter((x) => !/Added/.test(x)).length}); All=${rall.length}`, evidence: await S.jshot(`acc-activity-filter-${W}`), impact: "misleading result", repro: "Click Added then All" });
    // open a row
    await A.clickExpr(S, "[...document.querySelectorAll('main button')].find((b) => /Added to inventory QA Album 1 - /.test(b.innerText))", { touch }); await sleep(900);
    const panel = await S.evaluate("(() => { const links = [...document.querySelectorAll('aside a,[role=dialog] a')].map((a) => a.innerText.trim() + '->' + a.getAttribute('href')); const btns = [...document.querySelectorAll('aside button,[role=dialog] button')].map((b) => (b.getAttribute('aria-label') || b.innerText).trim()).filter(Boolean); return { links, btns }; })()");
    r.check(panel.links.some((l) => /vault\/item\/qa_vz_.*_1$/.test(l)), { page: page("/activity"), control: "Activity row (open details)", expected: "details panel with a link to that item's record", actual: JSON.stringify(panel), evidence: await S.jshot(`acc-activity-detail-${W}`), impact: "blocked workflow", repro: "Click an activity row" });
    await A.clickText(S, "View item record|Open record", "aside a,[role=dialog] a", { touch }); await sleep(3000);
    r.check(/^\/vault\/item\/qa_vz_.*_1$/.test(await S.path()) && /QA Album 1 /.test(await A.bodyText(S)), { page: page("/activity"), control: "View item record (from details)", expected: "opens the item's page (QA Album 1)", actual: `${await S.path()}`, evidence: "", impact: "blocked workflow", repro: "Click row, then View item record" });
    await S.evaluate("history.back()"); await sleep(2500);
    await A.clickExpr(S, "[...document.querySelectorAll('main button')].find((b) => /Added to inventory QA Album 2 - /.test(b.innerText))", { touch }); await sleep(800);
    await A.clickSel(S, 'button[aria-label="Close"]', { touch }); await sleep(600);
    const closed = await S.evaluate("![...document.querySelectorAll('aside a')].some((a) => /vault\\/item/.test(a.getAttribute('href') || '') && a.getBoundingClientRect().width > 1)");
    r.check(closed, { page: page("/activity"), control: "Details panel: Close (X)", expected: "details close", actual: `closed=${closed}`, evidence: "", impact: "usability", repro: "" });
    // load failure shows an error, not an empty history
    await S.send("Network.enable"); await S.send("Network.setBlockedURLs", { urls: ["*supabase.co/rest/v1/*"] });
    await S.evaluate("(() => { try { localStorage.removeItem('vltd_vault_items_v3'); Object.keys(localStorage).filter((k) => /vault_items|vltd_items/i.test(k)).forEach((k) => localStorage.removeItem(k)); } catch (e) {} })()");
    await go(S, "/activity"); await sleep(25000);
    const t = await A.bodyText(S);
    await S.send("Network.setBlockedURLs", { urls: [] });
    r.check(!/no (activity|events|history)|nothing (yet|here)|Nothing has changed/i.test(t) && /could not|couldn.t|try again|error|failed|offline/i.test(t) || /Added to inventory/.test(t), { page: page("/activity"), control: "Activity when the data service cannot be reached (requests blocked, local copy cleared)", expected: "an error, or the last known history; never a quiet 'nothing here'", actual: t.replace(/^.*Everything that changed in your vault\.?/, "").slice(0, 220), evidence: await S.jshot(`acc-activity-blocked-${W}`), impact: "misleading result", repro: "Block data service; clear local copy; open /activity" });
  } finally { await S.close(); }
}

async function messages() {
  const kProf = (await admin.from("profiles").select("display_name,username").eq("id", m.k.profileId).single()).data;
  const S = await session("owner", { width: W, height: MOBILE ? 844 : 900, mobile: MOBILE });
  try {
    await go(S, "/messages"); await sleep(2500);
    const t = await A.bodyText(S);
    r.check(/Direct messages with other collectors/.test(t) && /New Message/i.test(t), { page: page("/messages"), control: "Messages page (no conversations)", expected: "explains itself and offers '+ New Message'; empty list says so", actual: t.replace(/^.*Messages /, "").slice(0, 200), evidence: await S.jshot(`acc-messages-${W}`), impact: "usability", repro: "" });
    await A.clickText(S, "New Message", "button", { touch }); await sleep(800);
    await S.send("Input.insertText", { text: "" });
    const search = 'input[placeholder="Search collectors by name…"]';
    await A.typeInto(S, search, "zzzzznobody"); await sleep(2500);
    const none = await S.evaluate("(() => { const d = document.querySelector('input[placeholder^=\"Search collectors\"]'); const box = d ? d.closest('div[class*=\"fixed\"],[role=dialog]') || document.body : document.body; return (box.innerText.match(/(No collectors|No results|not found|no matches)[^\\n]*/i) || ['(nothing)'])[0]; })()");
    await A.typeInto(S, search, kProf.display_name.slice(0, 8)); await sleep(3000);
    const res = await S.evaluate("[...document.querySelectorAll('button')].filter((b) => /QA Audit viewer|@qa_au/i.test(b.innerText)).map((b) => b.innerText.replace(/\\s+/g, ' ').trim().slice(0, 60))");
    r.check(res.length >= 1, { page: page("/messages"), control: "New Message > search collectors", expected: `finds the other QA account by name ("${kProf.display_name.slice(0, 8)}"); a nonsense name says no one found`, actual: `results=${JSON.stringify(res)}; nonsense query says: ${none}`, evidence: await S.jshot(`acc-messages-search-${W}`), impact: "blocked workflow", repro: "Messages > New Message; type a name" });
    if (res.length) {
      await A.clickExpr(S, "[...document.querySelectorAll('button')].find((b) => /QA Audit viewer|@qa_au/i.test(b.innerText))", { touch }); await sleep(2500);
      await A.typeInto(S, 'textarea[placeholder="Write a message…"],input[placeholder="Write a message…"]', "Audit hello from owner");
      await A.clickText(S, "^Send$", "button", { touch }); await sleep(3000);
      const thread = await A.bodyText(S);
      const dbm = await admin.from("direct_messages").select("*").limit(5).order("created_at", { ascending: false });
      r.check(/Audit hello from owner/.test(thread), { page: page("/messages"), control: "Send message to another QA account", expected: "message appears in the thread", actual: thread.replace(/^.*Messages /, "").slice(0, 200) + " | db rows seen: " + (dbm.data ? dbm.data.length : dbm.error && dbm.error.message), evidence: await S.jshot(`acc-messages-sent-${W}`), impact: "blocked workflow", repro: "Pick the collector; type; Send" });
      // empty send
      const dis = await S.evaluate("(() => { const b = [...document.querySelectorAll('main button')].find((x) => /^Send$/.test(x.innerText.trim())); return b ? b.disabled : null; })()");
      r.check(dis === true, { page: page("/messages"), control: "Send with an empty message box", expected: "disabled", actual: `disabled=${dis}`, evidence: "", impact: "usability", repro: "" });
      // viewer sees it
      const V = await session("viewer", { width: W, height: MOBILE ? 844 : 900, mobile: MOBILE });
      try {
        await go(V, "/dashboard"); await sleep(3000);
        const badge = await V.evaluate("(() => { const a = document.querySelector('a[aria-label^=\"Messages\"]'); return a ? a.getAttribute('aria-label') : null; })()");
        await go(V, "/messages"); await sleep(3000);
        const vt = await A.bodyText(V);
        r.check(/Audit hello from owner/.test(vt) && /unread/i.test(badge || ""), { page: page("/messages", "unrelated viewer"), control: "Recipient sees the message and an unread count", expected: "Messages icon says 1 unread; conversation lists the message", actual: `header label="${badge}"; list shows message=${/Audit hello from owner/.test(vt)}`, evidence: await V.jshot(`acc-messages-viewer-${W}`), impact: "blocked workflow", repro: "Sign in as the recipient" });
      } finally { await V.close(); }
    }
    // clean up conversation rows created by this test (fixture accounts only)
    for (const t of ["direct_messages", "dm_messages", "messages"]) { try { await admin.from(t).delete().or(`sender_profile_id.eq.${m.personalId},sender_id.eq.${m.personalId}`); } catch {} }
  } finally { await S.close(); }
}

async function publicProfile() {
  const own = (await admin.from("profiles").select("username,display_name").eq("id", m.personalId).single()).data;
  await admin.from("profiles").update({ is_public: true, phone: "(555) 010-0777", full_name: "Private Fullname Qa", address_line1: "77 Private Lane", bio: "Public audit bio" }).eq("id", m.personalId);
  const O0 = await session("owner", { width: W, height: MOBILE ? 844 : 900, mobile: MOBILE });
  try { await go(O0, "/account"); await A.clickText(O0, "^Save changes$", "button", { touch }); await sleep(4000); } finally { await O0.close(); }
  const V = await session("visitor", { width: W, height: MOBILE ? 844 : 900, mobile: MOBILE });
  try {
    for (const p of [`/u/${own.username}`, `/@${own.username}`, `/v/${m.personalId}`]) {
      await go(V, p); await sleep(3500);
      const t = await A.bodyText(V);
      const priv = ["(555) 010-0777", "Private Fullname", "77 Private Lane", m.email, "qa_vz_"].filter((x) => t.includes(x));
      const html = await V.evaluate("document.documentElement.outerHTML");
      const privHtml = ["(555) 010-0777", "Private Fullname", "77 Private Lane", m.email].filter((x) => html.includes(x));
      const shown = await V.evaluate("({ cards: document.querySelectorAll('a[href^=\"/vault/item/\"],a[href*=\"/share/\"]').length, h1: (document.querySelector('h1') || {}).innerText })");
      r.check(/QA Visual Collection|Public audit bio/.test(t) && priv.length === 0 && privHtml.length === 0, { page: page(p, "visitor, owner profile made public"), control: "Public profile page", expected: "shows the public name/bio; no phone, full name, address, e-mail or internal ids", actual: `final=${await V.path()}; h1=${shown.h1}; leaked in text=${JSON.stringify(priv)}; leaked in page source=${JSON.stringify(privHtml)}; text="${t.slice(0, 160)}"`, evidence: await V.jshot(`acc-publicprofile-${p.replace(/\W+/g, "_").slice(0, 28)}-${W}`), impact: "privacy/data loss", repro: `Signed out, open ${p}` });
    }
    // items shown on a public profile must be public items only (2 public in the fixture)
    await go(V, `/u/${own.username}`); await sleep(3000);
    const itemsShown = await V.evaluate("[...document.querySelectorAll('a[href]')].filter((a) => /vault\\/item|\\/share\\//.test(a.getAttribute('href'))).map((a) => a.getAttribute('href'))");
    const pubIds = (await admin.from("vault_items").select("id").eq("profile_id", m.personalId).eq("is_public", true)).data.map((x) => x.id);
    r.check(itemsShown.every((h) => pubIds.some((id) => h.includes(id))), { page: page(`/u/${own.username}`, "visitor, owner profile made public"), control: "Items listed on the public profile", expected: "only items marked public (2 of 26)", actual: `links=${JSON.stringify(itemsShown.slice(0, 6))}; public ids=${JSON.stringify(pubIds)}`, evidence: "", impact: "privacy/data loss", repro: "" });
    // owner viewing own public profile
    const O = await session("owner", { width: W, height: MOBILE ? 844 : 900, mobile: MOBILE });
    try { await go(O, `/u/${own.username}`); await sleep(3000); r.check(!/could not be found/i.test(await A.bodyText(O)), { page: page(`/u/${own.username}`, "owner, profile public"), control: "View public profile (owner, profile public)", expected: "owner can open their own public page", actual: (await A.bodyText(O)).replace(/^.*Level \d+ /, "").slice(0, 120), evidence: "", impact: "usability", repro: "" }); } finally { await O.close(); }
  } finally {
    await V.close();
    await admin.from("profiles").update({ is_public: false, phone: null, full_name: null, address_line1: null, bio: null }).eq("id", m.personalId);
  }
  // private again -> 404 for a visitor
  const V2 = await session("visitor", { width: W, height: MOBILE ? 844 : 900, mobile: MOBILE });
  try { await go(V2, `/u/${own.username}`); r.check(/could not be found/i.test(await A.bodyText(V2)), { page: page(`/u/${own.username}`, "visitor, profile private"), control: "Public page of a private profile", expected: "not found, nothing shown", actual: (await A.bodyText(V2)).slice(0, 120), evidence: "", impact: "privacy/data loss", repro: "" }); } finally { await V2.close(); }
}

(async () => {
  if (!PART || PART === "notif") await notif();
  if (!PART || PART === "activity") await activity();
  if (!PART || PART === "messages") await messages();
  if (!PART || PART === "public") await publicProfile();
})().catch((e) => { console.error("ERR", e); process.exit(2); });

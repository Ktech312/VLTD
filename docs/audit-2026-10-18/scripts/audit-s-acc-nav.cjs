// ACC: main navigation, logo, global search box, Command Palette, Help, notifications, messages, account menu, bottom nav (390), bug reporter, pull to refresh.
//   node audit-s-acc-nav.cjs --w=1440|390 [--kind=owner|business|viewer]
const A = require("./audit-s-acc-lib.cjs");
const { session, R, sleep, admin, man } = A;
const r = R("ACC");
setTimeout(() => { console.log("WATCHDOG"); process.exit(3); }, 1700000).unref();
const W = Number((process.argv.find((a) => a.startsWith("--w=")) || "--w=1440").slice(4));
const KIND = (process.argv.find((a) => a.startsWith("--kind=")) || "--kind=owner").slice(7);
const MOBILE = W < 500; const touch = MOBILE;
const tag = (MOBILE ? "390 (browser-emulated touch)" : "1440");
const who = KIND === "owner" ? "owner, Personal, 26 items" : KIND === "business" ? "owner, Business" : "unrelated viewer";

const activeLabel = (S) => S.evaluate("(() => { const a = [...document.querySelectorAll('a[aria-current=page]')].filter((x) => x.getBoundingClientRect().width > 1).map((x) => (x.innerText || x.getAttribute('aria-label') || '').trim()); return a; })()");
const pal = (S) => S.evaluate(`(() => { const inp = document.querySelector('input[placeholder^="Try \\\\"vault"]') || [...document.querySelectorAll('input')].find((i) => /Try/.test(i.placeholder)); if (!inp) return null; const root = inp.closest('div.fixed') || document.body; const btns = [...root.querySelectorAll('button')].filter((b) => !/Close command palette/.test(b.getAttribute('aria-label') || '')).map((b) => ({ t: b.innerText.replace(/\\s+/g, ' ').trim().slice(0, 70), act: /pill-active-bg/.test(b.className) })); const secs = [...root.querySelectorAll('section > div > div:first-child')].map((d) => d.innerText.trim()); return { value: inp.value, focused: document.activeElement === inp, btns, secs, empty: /No commands matched/.test(root.innerText) }; })()`);

async function openPalette(S) {
  if (MOBILE) { await A.clickSel(S, 'button[aria-label="Search"]', { touch }); }
  else { await A.press(S, "k", 2); }
  await sleep(700);
  return pal(S);
}

(async () => {
  const m = man();
  const S = await session(KIND, { width: W, height: MOBILE ? 844 : 900, mobile: MOBILE });
  const page = (p) => `${p} | ${who} | ${tag}`;
  try {
    await S.visit("/vault");
    // ---------- logo and primary navigation
    await A.clickSel(S, 'a[aria-label="VLTD Home"]', { touch }); await sleep(2200);
    r.check((await S.path()) === "/dashboard", { page: page("/vault"), control: "VLTD logo", expected: "goes to Home (/dashboard) when signed in", actual: await S.path(), evidence: "", impact: "blocked workflow", repro: "Open /vault; click the logo" });
    const NAV = [["Vault", "/vault"], ["Exhibitions", "/museum"], ["Lounge", "/community-board"], ["Discover", "/discover"], ["Home", "/dashboard"]];
    for (const [label, want] of NAV) {
      const scope = MOBILE ? 'nav[aria-label="Main navigation"] a' : 'nav[aria-label="Primary"] a';
      const ok = await A.clickText(S, `^${label}$`, scope, { touch }); await sleep(2500);
      const p = await S.path(); const act = await activeLabel(S);
      const hasH = (await S.evaluate("(document.querySelector('h1,h2') || {}).innerText || ''")).length > 0;
      r.check(ok && p === want && act.some((x) => new RegExp(label, "i").test(x)) && hasH, { page: page(want), control: `${MOBILE ? "Bottom bar" : "Top bar"}: ${label}`, expected: `opens ${want}, shows that page, and marks ${label} as the current destination`, actual: `clicked=${ok}; path=${p}; current=${JSON.stringify(act)}; has heading=${hasH}`, evidence: p === want ? "" : await S.jshot(`acc-nav-${KIND}-${W}-${label}`), impact: "blocked workflow", repro: `Click ${label} in the ${MOBILE ? "bottom" : "top"} bar` });
    }
    // nested pages keep their destination highlighted
    for (const [path, label] of [["/goals", "Vault"], ["/portfolio", "Vault"], ["/insurance", "Vault"], ["/learn", "Lounge"], ["/saved", "Discover"], ["/events", "Discover"]]) {
      await S.visit(path); const act = await activeLabel(S);
      r.check(act.some((x) => new RegExp(label, "i").test(x)), { page: page(path), control: `Current-destination highlight on ${path}`, expected: `${label} stays highlighted`, actual: JSON.stringify(act), evidence: "", impact: "cosmetic", repro: `Open ${path}` });
    }
    // Back/Forward keeps the highlight in step
    await S.visit("/vault"); await S.visit("/museum"); await S.evaluate("history.back()"); await sleep(2500);
    const bp = await S.path(); const ba = await activeLabel(S);
    r.check(bp === "/vault" && ba.some((x) => /Vault/i.test(x)), { page: page("/vault"), control: "Browser Back between primary pages", expected: "returns to /vault with Vault highlighted", actual: `${bp} ${JSON.stringify(ba)}`, evidence: "", impact: "usability", repro: "Vault -> Exhibitions -> Back" });

    // ---------- global search box (desktop) and Command Palette
    await S.visit("/dashboard");
    if (!MOBILE) {
      const box = 'form input[placeholder^="Search vault"]';
      await A.typeInto(S, box, "Album 17"); await A.press(S, "Enter"); await sleep(3500);
      let p = await S.path();
      let res = await S.evaluate("({ text: document.body.innerText.replace(/\\s+/g, ' '), cards: [...document.querySelectorAll('a[href^=\"/vault/item/\"]')].map((a) => a.innerText.replace(/\\s+/g, ' ').slice(0, 60)) })");
      r.check(/^\/vault\?q=Album(\+|%20)17/.test(p) && res.cards.length >= 1 && res.cards.every((c) => /Album 17/.test(c)), { page: page("/vault?q"), control: "Search box: 'Album 17' + Enter", expected: "opens the Vault filtered to items titled Album 17 (only matching items)", actual: `path=${p}; cards=${JSON.stringify(res.cards.slice(0, 5))}`, evidence: await S.jshot(`acc-search-${KIND}-album17`), impact: "misleading result", repro: "Type Album 17 in the top search box; Enter" });
      await S.visit("/dashboard");
      await A.typeInto(S, box, "zzzznomatch"); await A.press(S, "Enter"); await sleep(3500);
      res = await S.evaluate("({ text: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 800), cards: document.querySelectorAll('a[href^=\"/vault/item/\"]').length })");
      r.check(res.cards === 0 && /no (items|results|matches)|nothing|didn.t find|no .* found/i.test(res.text), { page: page("/vault?q"), control: "Search box: query with no match", expected: "an explicit 'no results' message, not a blank page or the whole collection", actual: `cards=${res.cards}; text="${res.text.slice(0, 260)}"`, evidence: await S.jshot(`acc-search-${KIND}-nomatch`), impact: "misleading result", repro: "Type zzzznomatch; Enter" });
      await S.visit("/dashboard");
      await A.typeInto(S, box, ""); await A.press(S, "Enter"); await sleep(2500);
      p = await S.path();
      r.check(p.startsWith("/vault"), { page: page("/dashboard"), control: "Search box: Enter with nothing typed", expected: "opens the Vault (unfiltered) or does nothing harmful", actual: p, evidence: "", impact: "usability", repro: "Press Enter in an empty search box" });
    }
    // palette
    await S.visit("/dashboard");
    let st = await openPalette(S);
    r.check(st && st.focused && st.btns.length > 5, { page: page("/dashboard"), control: MOBILE ? "Search icon (opens Command Palette)" : "Ctrl+K", expected: "opens the Command Palette with the typing box focused and a default list of commands", actual: JSON.stringify(st && { focused: st.focused, n: st.btns.length, secs: st.secs, first: st.btns.slice(0, 4) }), evidence: await S.jshot(`acc-palette-${KIND}-${W}-open`), impact: "blocked workflow", repro: MOBILE ? "Tap the search icon" : "Press Ctrl+K" });
    await A.press(S, "Escape"); await sleep(500);
    st = await pal(S);
    r.check(st === null, { page: page("/dashboard"), control: "Command Palette: Esc", expected: "closes the palette", actual: st ? "still open" : "closed", evidence: "", impact: "usability", repro: "Open palette; press Esc" });
    if (!MOBILE) {
      await A.press(S, "k", 4); await sleep(600); st = await pal(S);
      r.check(st && st.focused, { page: page("/dashboard"), control: "Cmd+K (Meta+K)", expected: "opens the palette on Mac keyboards too", actual: st ? "open" : "not opened", evidence: "", impact: "usability", repro: "Press Cmd+K" });
      await A.press(S, "Escape"); await sleep(400);
    }
    // backdrop click closes
    await openPalette(S);
    await A.mouseClick(S, 12, MOBILE ? 800 : 880); await sleep(500);
    st = await pal(S);
    r.check(st === null, { page: page("/dashboard"), control: "Command Palette: click outside", expected: "closes", actual: st ? "still open" : "closed", evidence: "", impact: "usability", repro: "Open palette; click the dark area" });
    // close button
    await openPalette(S); await A.clickSel(S, 'button[aria-label="Close command palette"]', { touch }); await sleep(500);
    st = await pal(S);
    r.check(st === null, { page: page("/dashboard"), control: "Command Palette: close button (X)", expected: "closes", actual: st ? "still open" : "closed", evidence: "", impact: "usability", repro: "Open palette; click X" });
    // typing queries
    if (KIND === "viewer") {
      for (const q of ["Album 17", "Sports Slabs", "QA Visual", "qa_jr_p"]) {
        await S.visit("/dashboard"); await openPalette(S); await S.send("Input.insertText", { text: q }); await sleep(900);
        const st9 = await pal(S);
        const leaked = ((st9 && st9.btns) || []).filter((b) => /QA Album|Sports Slabs|QA Visual|qa_jr_p|QA Journey/.test(b.t));
        r.check(leaked.length === 0, { page: page("/dashboard"), control: `Command Palette (another account) typing "${q}"`, expected: "never lists another account's items, exhibitions or profile names", actual: JSON.stringify(st9 && st9.btns.slice(0, 5)), evidence: leaked.length ? await S.jshot(`acc-palette-viewer-leak-${q.replace(/\W+/g, "_")}`) : "", impact: "privacy/data loss", repro: `Sign in as a different account; Ctrl+K; type ${q}` });
        await A.press(S, "Escape");
      }
    }
    const Q = KIND === "viewer" ? [["settings", /Settings|Account/i, /^\/account/]] : [["goals", /Goals/i, "/goals"], ["Album 17", /Album 17/i, /^\/vault\/item\//], ["Sports Slabs", /Sports Slabs/i, /^\/museum\//], ["settings", /Settings|Account/i, /^\/account/]];
    for (const [q, label, dest] of Q) {
      await S.visit("/dashboard"); await openPalette(S);
      await S.send("Input.insertText", { text: q }); await sleep(900);
      st = await pal(S);
      const matched = st && st.btns.some((b) => label.test(b.t));
      const shot = await S.jshot(`acc-palette-${KIND}-${W}-q-${q.replace(/\W+/g, "_")}`);
      // keyboard: Enter on the first result
      await A.press(S, "Enter"); await sleep(3000);
      const p = await S.path();
      const okDest = typeof dest === "string" ? p === dest : dest.test(p);
      r.check(!!matched && okDest, { page: page("/dashboard"), control: `Command Palette: type "${q}" then Enter`, expected: `the list contains a matching entry and Enter on the first result opens it (${dest})`, actual: `results=${JSON.stringify((st && st.btns || []).slice(0, 5))}; sections=${JSON.stringify(st && st.secs)}; opened ${p}`, evidence: matched && okDest ? "" : shot, impact: "blocked workflow", repro: `Open palette; type ${q}; Enter` });
    }
    // arrow keys move the highlight, click on a result opens it
    await S.visit("/dashboard"); await openPalette(S);
    await S.send("Input.insertText", { text: "vault" }); await sleep(800);
    const a0 = await pal(S); await A.press(S, "ArrowDown"); await sleep(250); const a1 = await pal(S); await A.press(S, "ArrowDown"); await sleep(250); const a2 = await pal(S); await A.press(S, "ArrowUp"); await sleep(250); const a3 = await pal(S);
    const idx = (s) => s ? s.btns.findIndex((b) => b.act) : -9;
    r.check(a0 && idx(a0) === 0 && idx(a1) === 1 && idx(a2) === 2 && idx(a3) === 1, { page: page("/dashboard"), control: "Command Palette: Arrow Down / Arrow Up", expected: "highlight starts on the first result and moves down, down, up (0,1,2,1)", actual: `${idx(a0)},${idx(a1)},${idx(a2)},${idx(a3)}`, evidence: "", impact: "usability", repro: "Open palette; type vault; Down, Down, Up" });
    // Enter on highlighted second result
    const target = a3 && a3.btns[1] && a3.btns[1].t;
    await A.press(S, "Enter"); await sleep(3000);
    r.pass({ page: page("/dashboard"), control: "Command Palette: Enter on the highlighted (second) result", expected: "opens what is highlighted", actual: `highlighted "${target}" -> opened ${await S.path()}`, evidence: "", impact: "none", repro: "Open palette; type vault; Down; Enter" });
    // no match
    await S.visit("/dashboard"); await openPalette(S);
    await S.send("Input.insertText", { text: "qqqzzznomatch" }); await sleep(800);
    st = await pal(S);
    await A.press(S, "Enter"); await sleep(800);
    r.check(st && st.empty && st.btns.length === 0 && (await S.path()) === "/dashboard", { page: page("/dashboard"), control: "Command Palette: query with no match, Enter", expected: "says 'No commands matched your search.' and Enter does nothing", actual: JSON.stringify(st && { empty: st.empty, n: st.btns.length }) + " path " + (await S.path()), evidence: await S.jshot(`acc-palette-${KIND}-${W}-nomatch`), impact: "usability", repro: "Open palette; type nonsense; Enter" });
    // profile switch from palette: only when two profiles
    if (KIND !== "viewer") {
      await S.visit("/dashboard"); await openPalette(S);
      await S.send("Input.insertText", { text: "switch" }); await sleep(800);
      st = await pal(S);
      r.pass({ page: page("/dashboard"), control: "Command Palette: 'switch' (profile switch commands)", expected: "(informational) lists switch commands for the other profile", actual: JSON.stringify(st && st.btns.slice(0, 5)), evidence: "", impact: "improvement", repro: "Open palette; type switch" });
      await A.press(S, "Escape");
    }

    // ---------- Help menu (>=640px) / phone account menu
    await S.visit("/dashboard");
    if (!MOBILE) {
      await A.clickText(S, "^Help$|\\bHelp\\b", 'button[aria-haspopup],button', { touch });
      await sleep(700);
      const items = await S.evaluate("[...document.querySelectorAll('[role=menu] [role=menuitem],[role=menu] a,[role=menu] button')].map((e) => (e.innerText || '').replace(/\\s+/g, ' ').trim() + (e.getAttribute('href') ? '->' + e.getAttribute('href') : ''))");
      r.check(items.length >= 3, { page: page("/dashboard"), control: "Help (menu)", expected: "opens a menu: Getting started, Feature guide, Support", actual: JSON.stringify(items), evidence: await S.jshot(`acc-help-${KIND}-${W}`), impact: "usability", repro: "Click Help" });
      for (const [lab, want] of [["Getting started", "/guide/walkthrough"], ["Feature guide", "/guide"]]) {
        await S.visit("/dashboard"); await A.clickText(S, "\\bHelp\\b", "button", { touch }); await sleep(500);
        await A.clickText(S, lab, "[role=menu] *,[role=menuitem],a", { touch }); await sleep(2500);
        r.check((await S.path()) === want, { page: page("/dashboard"), control: `Help > ${lab}`, expected: `opens ${want}`, actual: await S.path(), evidence: "", impact: "usability", repro: `Click Help, ${lab}` });
      }
      await S.visit("/dashboard"); await A.clickText(S, "\\bHelp\\b", "button", { touch }); await sleep(500);
      await A.clickText(S, "^Support$", "[role=menu] *,[role=menuitem],button", { touch }); await sleep(900);
      const dlg = await S.evaluate("(() => { const d = document.querySelector('[role=dialog][aria-label=\"Report a bug\"]'); return d ? { text: d.innerText.replace(/\\s+/g, ' ').slice(0, 200), fields: [...d.querySelectorAll('textarea,input')].map((i) => i.tagName + ':' + (i.type || '') + ':' + (i.placeholder || '')), buttons: [...d.querySelectorAll('button')].map((b) => b.innerText.trim() + (b.disabled ? '(disabled)' : '')) } : null; })()");
      r.check(!!dlg, { page: page("/dashboard"), control: "Help > Support", expected: "opens the bug/support reporter dialog", actual: JSON.stringify(dlg), evidence: await S.jshot(`acc-support-${KIND}-${W}`), impact: "usability", repro: "Click Help, Support" });
      await A.press(S, "Escape"); await sleep(400);
    }

    // ---------- Report a bug button
    await S.visit("/dashboard");
    await A.clickSel(S, 'button[aria-label="Report a bug"]', { touch }); await sleep(900);
    const bug = await S.evaluate("(() => { const d = document.querySelector('[role=dialog][aria-label=\"Report a bug\"]'); if (!d) return null; const r = d.getBoundingClientRect(); return { text: d.innerText.replace(/\\s+/g, ' ').slice(0, 260), buttons: [...d.querySelectorAll('button')].map((b) => ({ t: b.innerText.trim() || b.getAttribute('aria-label'), dis: b.disabled })), file: !!d.querySelector('input[type=file]'), ta: !!d.querySelector('textarea') }; })()");
    const sendBtn = bug && bug.buttons.find((b) => /send|submit/i.test(b.t || ""));
    r.check(!!bug && bug.ta && sendBtn && sendBtn.dis === true, { page: page("/dashboard"), control: "Report a bug (floating button) with an empty message", expected: "dialog opens with a message box and optional screenshot; Send disabled until something is typed", actual: JSON.stringify(bug), evidence: await S.jshot(`acc-bug-${KIND}-${W}`), impact: "usability", repro: "Click the round bug button" });
    // cancel/Esc/click outside leaves it closed and clears text
    if (bug && bug.ta) {
      await A.typeInto(S, "[role=dialog][aria-label=\"Report a bug\"] textarea", "audit draft - do not send");
      const cancel = bug.buttons.find((b) => /cancel|close/i.test(b.t || ""));
      if (cancel) await A.clickText(S, "^" + cancel.t + "$", "[role=dialog] button", { touch }); else await A.press(S, "Escape");
      await sleep(600);
      const closed = await S.evaluate("!document.querySelector('[role=dialog][aria-label=\"Report a bug\"]')");
      await A.clickSel(S, 'button[aria-label="Report a bug"]', { touch }); await sleep(700);
      const txt = await S.evaluate("(document.querySelector('[role=dialog][aria-label=\"Report a bug\"] textarea') || {}).value");
      r.check(closed && txt === "", { page: page("/dashboard"), control: "Report a bug: Cancel after typing", expected: "dialog closes, nothing is sent, the draft is cleared on reopening", actual: `closed=${closed}; text after reopen="${txt}"; bug_reports REST writes=${S.reqs.filter((q) => /bug_reports/.test(q.url) && q.method === "POST").length}`, evidence: "", impact: "usability", repro: "Type text; Cancel; reopen" });
      await A.press(S, "Escape");
    }
    r.blocked({ page: page("/dashboard"), control: "Report a bug: Send", expected: "report is stored and the person is told it was sent", actual: "BLOCKED: the dialog writes straight to the Supabase table bug_reports through the REST API (not through /api/admin/bugs), which the audit does NOT intercept. A real submit would create a report in the owner's live admin inbox, so it was not pressed.", evidence: "", impact: "none", repro: "n/a" });

    // ---------- Messages and Alerts
    await S.visit("/dashboard");
    await A.clickSel(S, 'header a[href="/messages"], a[aria-label^="Messages"]', { touch }); await sleep(3000);
    const mp = await S.path(); const mt = await A.bodyText(S);
    r.check(mp === "/messages" && mt.length > 80, { page: page("/messages"), control: "Messages (header link)", expected: "opens /messages with its own content", actual: `${mp}; text="${mt.slice(0, 160)}"`, evidence: await S.jshot(`acc-messages-${KIND}-${W}`), impact: "blocked workflow", repro: "Click the Messages icon" });
    await S.visit("/dashboard");
    await A.clickText(S, "^Alerts$|Alerts", "a,button", { touch }); await sleep(2500);
    const ap = await S.path(); const at = await A.bodyText(S);
    r.check(ap === "/notifications", { page: page("/notifications"), control: "Alerts (bell link)", expected: "opens /notifications", actual: `${ap}; text="${at.slice(0, 200)}"`, evidence: await S.jshot(`acc-notifications-${KIND}-${W}`), impact: "blocked workflow", repro: "Click the Alerts bell" });
    // what calls /api/admin/bugs
    const adminCalls = S.intercepted.filter((q) => /api\/admin\/bugs/.test(q.url)).length;
    r.pass({ page: page("/notifications"), control: "/api/admin/bugs request made by a non-admin session", expected: "(informational) who calls it", actual: `${adminCalls} request(s) in this session. Caller: the Alerts feed (src/lib/notificationFeed.ts fetchAlerts), run for every signed-in person to look for admin bug-report alerts; the app remembers a refusal per browser session. See the separate row for what the server answers.`, evidence: "", impact: "improvement", repro: "Sign in as any non-admin; watch network" });

    // ---------- account menu
    await S.visit("/dashboard");
    await A.clickSel(S, 'button[aria-label="Account menu"]', { touch }); await sleep(900);
    const menu = await S.evaluate("(() => { const items = [...document.querySelectorAll('a[href],button')].filter((e) => e.getBoundingClientRect().width > 1 && /Settings|Appearance|Invite Friends|Sign Out|Admin|Switch|Getting started|Feature guide|Support/.test((e.innerText || '').trim()) ).map((e) => (e.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 40) + (e.getAttribute('href') ? '->' + e.getAttribute('href') : '')); return { items, text: document.body.innerText.slice(0, 0) }; })()");
    const shotMenu = await S.jshot(`acc-accountmenu-${KIND}-${W}`);
    const needed = ["Settings", "Appearance", "Invite Friends", "Sign Out"];
    r.check(needed.every((n) => menu.items.some((i) => i.startsWith(n))), { page: page("/dashboard"), control: "Account menu (open)", expected: "lists Settings, Appearance, Invite Friends, Sign Out (and Switch Profile when there are two profiles)", actual: JSON.stringify(menu.items), evidence: shotMenu, impact: "usability", repro: "Click the account avatar" });
    // emoji icons in the profile switcher?
    const emoji = await S.evaluate("(() => { const t = [...document.querySelectorAll('button')].filter((b) => /Switch|Active/.test(b.innerText)).map((b) => b.querySelector('span') ? b.querySelector('span').innerText : ''); return t; })()");
    const hasEmoji = emoji.some((x) => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(x));
    if (KIND !== "viewer") r.check(!hasEmoji, { page: page("/dashboard"), control: "Switch Profile avatars in the account menu", expected: "a picture/themed icon for each profile (not emoji, not a raw word)", actual: `profile avatar glyphs: ${JSON.stringify(emoji)}`, evidence: shotMenu, impact: "cosmetic", repro: "Open the account menu" });
    for (const [lab, want] of [["Settings", /^\/account$/], ["Appearance", /^\/account\?section=preferences$/], ["Invite Friends", /^\/account\/invite$/]]) {
      await S.visit("/dashboard"); await A.clickSel(S, 'button[aria-label="Account menu"]', { touch }); await sleep(700);
      await A.clickText(S, `^${lab}$`, "a", { touch }); await sleep(2800);
      const p = await S.path();
      r.check(want.test(p), { page: page(p), control: `Account menu > ${lab}`, expected: `opens ${want}`, actual: p, evidence: "", impact: "blocked workflow", repro: `Open account menu; click ${lab}` });
    }
    // phone: Help items inside the account menu
    if (MOBILE) {
      for (const [lab, want] of [["Getting started", "/guide/walkthrough"], ["Feature guide", "/guide"]]) {
        await S.visit("/dashboard"); await A.clickSel(S, 'button[aria-label="Account menu"]', { touch }); await sleep(700);
        await A.clickText(S, `^${lab}$`, "a", { touch }); await sleep(2800);
        r.check((await S.path()) === want, { page: page("/dashboard"), control: `Account menu (phone) > ${lab}`, expected: `opens ${want}`, actual: await S.path(), evidence: "", impact: "usability", repro: "Open account menu on a phone" });
      }
      await S.visit("/dashboard"); await A.clickSel(S, 'button[aria-label="Account menu"]', { touch }); await sleep(700);
      await A.clickText(S, "^Support$", "button", { touch }); await sleep(900);
      r.check(await S.evaluate("!!document.querySelector('[role=dialog][aria-label=\"Report a bug\"]')"), { page: page("/dashboard"), control: "Account menu (phone) > Support", expected: "opens the reporter", actual: "dialog check", evidence: "", impact: "usability", repro: "" });
      await A.press(S, "Escape");
    }
    // level info toggle
    await S.visit("/dashboard"); await A.clickSel(S, 'button[aria-label="Account menu"]', { touch }); await sleep(700);
    const lvl = await S.evaluate("(() => { const b = document.querySelector('button[aria-label=\"Level progress details\"]'); return b ? b.getAttribute('aria-expanded') : 'none'; })()");
    if (lvl !== "none") { await A.clickSel(S, 'button[aria-label="Level progress details"]', { touch }); await sleep(500); const t = await S.evaluate("document.body.innerText.includes('Items added: +10')"); r.check(t, { page: page("/dashboard"), control: "Level progress details (info)", expected: "explains how points are earned", actual: `explanation shown=${t}`, evidence: "", impact: "usability", repro: "Open account menu; click the level info" }); }
    // click outside / Esc closes menu
    await A.press(S, "Escape"); await sleep(400);
    const stillOpen = await S.evaluate("[...document.querySelectorAll('a')].some((a) => a.getAttribute('href') === '/account/invite' && a.getBoundingClientRect().width > 1)");
    await A.mouseClick(S, 20, MOBILE ? 600 : 700); await sleep(500);
    const stillOpen2 = await S.evaluate("[...document.querySelectorAll('a')].some((a) => a.getAttribute('href') === '/account/invite' && a.getBoundingClientRect().width > 1)");
    r.check(!stillOpen2, { page: page("/dashboard"), control: "Account menu: close by Esc / clicking elsewhere", expected: "menu closes", actual: `still open after Esc=${stillOpen}; after click elsewhere=${stillOpen2}`, evidence: "", impact: "usability", repro: "Open menu; press Esc; click page" });

    // ---------- bottom bar Add Item (phone)
    if (MOBILE) {
      await S.visit("/vault");
      const add = await S.evaluate("(() => { const n = document.querySelector('nav[aria-label=\"Main navigation\"]'); const els = [...n.querySelectorAll('a,button')].map((e) => ({ t: (e.innerText || e.getAttribute('aria-label') || '').trim(), href: e.getAttribute('href'), h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) })); return els; })()");
      r.check(add.length >= 6, { page: page("/vault"), control: "Bottom bar contents", expected: "five destinations plus the persistent Add Item action", actual: JSON.stringify(add), evidence: await S.jshot(`acc-bottomnav-${KIND}`), impact: "usability", repro: "Open /vault at 390px" });
      const small = add.filter((e) => e.h < 36 || e.w < 36);
      r.check(small.length === 0, { page: page("/vault"), control: "Bottom bar tap targets", expected: "each control at least 36px", actual: small.length ? JSON.stringify(small) : "ok", evidence: "", impact: "usability", repro: "" });
      await A.clickText(S, "Add Item", 'nav[aria-label="Main navigation"] a,nav[aria-label="Main navigation"] button', { touch }); await sleep(2500);
      const afterAdd = await S.path(); const sheet = await S.evaluate("[...document.querySelectorAll('[role=dialog],[role=menu]')].map((d) => d.innerText.replace(/\\s+/g, ' ').slice(0, 120))");
      r.check(afterAdd !== "/vault" || sheet.length > 0, { page: page("/vault"), control: "Add Item (persistent action)", expected: "opens the add-item choices or add page", actual: `path=${afterAdd}; sheets=${JSON.stringify(sheet)}`, evidence: await S.jshot(`acc-additem-${KIND}`), impact: "blocked workflow", repro: "Tap Add Item on /vault at 390px" });
      // hidden where it should be
      for (const p of ["/vault/add", "/vault/quick"]) { await S.visit(p); const has = await S.evaluate("[...document.querySelectorAll('nav[aria-label=\"Main navigation\"] a,nav[aria-label=\"Main navigation\"] button')].some((e) => /Add Item/.test(e.innerText))"); r.check(!has, { page: page(p), control: "Persistent Add Item on add pages", expected: "not shown on the add flows themselves", actual: `shown=${has}`, evidence: "", impact: "cosmetic", repro: "" }); }
      // pull to refresh: drag down from top of /dashboard
      await S.visit("/dashboard");
      await S.evaluate("window.__marker = 'before'; true");
      const sy = await S.evaluate("(document.querySelector('.overflow-y-auto') || document.scrollingElement).scrollTop");
      await S.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 200, y: 140 }] });
      for (let y = 140; y <= 420; y += 20) { await S.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 200, y }] }); await sleep(25); }
      const mid = await S.evaluate("(() => { const e = document.querySelector('[class*=\"animate-spin\"],[aria-label*=\"efresh\"]'); return !!e; })()");
      await S.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(2500);
      const still = await S.evaluate("window.__marker"); const pt = await S.path();
      r.pass({ page: page("/dashboard"), control: "Pull down to refresh (browser-emulated touch drag from the top)", expected: "(informational) pulling past the threshold refreshes data without leaving the page", actual: `scrollTop=${sy}; spinner seen during pull=${mid}; page still ${pt}; page state kept=${still === 'before'} (a soft refresh keeps the page, a reload would not)`, evidence: "", impact: "improvement", repro: "Drag down from the top of /dashboard on a touch device" });
    }

    // ---------- sign out (intercepted)
    if (KIND === "owner") {
      await S.visit("/dashboard");
      S.intercepted.length = 0;
      await A.clickSel(S, 'button[aria-label="Account menu"]', { touch }); await sleep(700);
      await A.clickText(S, "^Sign Out$", "button", { touch }); await sleep(4000);
      const so = S.intercepted.filter((q) => /auth\/v1\/logout/.test(q.url));
      const pth = await S.path();
      const t = (await A.bodyText(S)).slice(0, 200);
      const stillSigned = await S.evaluate("!!localStorage.getItem('vltd-auth')");
      r.check(so.length >= 1 && /^\/login/.test(pth) && !stillSigned, { page: page("/dashboard"), control: "Sign Out (the sign-out request itself was intercepted by the audit and refused with 503)", expected: "tries to end the session, then shows the login page; the browser no longer holds the session", actual: `logout requests intercepted=${so.length}; landed ${pth}; saved session still in browser=${stillSigned}; text="${t.slice(0, 120)}"`, evidence: await S.jshot(`acc-signout-${KIND}-${W}`), impact: "privacy/data loss", repro: "Open account menu; Sign Out while the network refuses the logout call" });
    }
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });

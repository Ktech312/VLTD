// ADD audit, suite 7: /ingest hub, the Vault's add entry points, /ai/drafts + /ai/review (drafts seeded directly into the browser store: no app flow creates drafts),
// /vault/sync, signed-out and unfinished-onboarding access to the add routes.
const T = require("./audit-s-add-lib.cjs");
const { alertText, session, sleep, man, admin, rec, click, clickText, typeInto, text, rowsByTitle, allCount, poll, removeItems, mine, rectOf, controls, fieldInput } = T;
const PREFIX = "AUD ADD M ";
const created = [];
const goto = async (S, p) => { await S.visit(p); };
const KEY = "vltd_ai_drafts_v1";
const draft = (i, status, extra = {}) => ({ id: "aud_draft_" + i, workspaceId: "w", createdByLabel: "audit seed", status, confidenceLabel: "Good", confidenceScore: 70 + i, title: PREFIX + "Draft " + i, subtitle: "sub " + i, missingFields: ["Grade"], createdAt: new Date().toISOString(), categoryLabel: "Comics", currentValue: 50 + i, ...extra });

(async () => {
  const m = man(); const P = m.personalId, B = m.businessId;
  await T.removeByPrefix(PREFIX);
  const S = await session("owner", { width: 1440, height: 900 });
  try {
    // ---------------- /ingest hub ----------------
    await goto(S, "/ingest");
    const cards = [["Quick Add One-step", "/vault/quick"], ["Spreadsheet Import Upload", "/vault/import"], ["Capture Guided", "/capture"]];
    for (const [lab, dest] of cards) {
      await goto(S, "/ingest");
      const cr = await click(S, `[...document.querySelectorAll('a')].find((a) => a.getAttribute('href') === ${JSON.stringify(dest)} && a.getBoundingClientRect().height > 60)`); await sleep(3500);
      if (!cr) console.log("card link not found for", dest);
      await rec(S, (await S.path()) === dest, { page: "/ingest | owner", control: `Card '${lab.split(" ")[0]} ${lab.split(" ")[1]}...'`, expected: `Opens ${dest}`, actual: "landed on " + (await S.path()), impact: "blocked workflow", repro: `Open /ingest, click the card` });
    }
    for (const [lab, dest] of [["Home", "/dashboard"], ["Vault", "/vault"], ["Exhibitions", "/museum"], ["Insights", "/portfolio"]]) {
      await goto(S, "/ingest");
      await click(S, `[...document.querySelectorAll('main a, a')].filter((a) => a.getBoundingClientRect().top > 70 && a.textContent.trim() === ${JSON.stringify(lab)})[0]`); await sleep(3000);
      await rec(S, (await S.path()) === dest, { page: "/ingest | owner", control: `Header button '${lab}'`, expected: `Opens ${dest}`, actual: "landed on " + (await S.path()), impact: "blocked workflow", repro: "Open /ingest, press the header button" });
    }
    // ---------------- the Vault's add controls ----------------
    await goto(S, "/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 60000).catch(() => {}); await sleep(1500);
    await click(S, T.btnExpr("^Quick Add$")); await sleep(3000);
    await rec(S, (await S.path()) === "/vault/quick", { page: "/vault | owner", control: "Quick Add (Vault header)", expected: "Opens /vault/quick", actual: "landed on " + (await S.path()), impact: "blocked workflow", repro: "Vault, press Quick Add" });
    await goto(S, "/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 60000).catch(() => {}); await sleep(1500);
    await click(S, T.btnExpr("ADD ITEM")); await sleep(1500);
    const menu = await S.evaluate("[...document.querySelectorAll('[role=menuitem],[role=menu] a,[role=menu] button,[role=dialog] a,[role=dialog] button')].map((e) => e.textContent.trim().replace(/\\s+/g, ' ') + '->' + (e.getAttribute('href') || '')).filter((x) => x.length > 2)");
    console.log("ADD ITEM menu:", JSON.stringify(menu));
    const afterAdd = await S.path();
    await rec(S, menu.length > 0 || afterAdd !== "/vault", { page: "/vault | owner", control: "ADD ITEM +", expected: "Opens a choice of ways to add, or goes to an add page", actual: `menu entries: ${JSON.stringify(menu).slice(0, 300)}; path now ${afterAdd}`, impact: "blocked workflow", repro: "Vault, press ADD ITEM" });
    for (const entry of menu.slice(0, 8)) {
      const [lab, href] = entry.split("->");
      if (!href) continue;
      await goto(S, "/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 60000).catch(() => {}); await sleep(1000);
      await click(S, T.btnExpr("ADD ITEM")); await sleep(1000);
      await click(S, `[...document.querySelectorAll('[role=menuitem],[role=menu] a,[role=menu] button,[role=dialog] a,[role=dialog] button')].find((e) => e.textContent.trim().replace(/\\s+/g, ' ') === ${JSON.stringify(lab)})`); await sleep(3000);
      const dest = await S.path();
      await rec(S, dest.split("?")[0] === href.split("?")[0], { page: "/vault | owner", control: `ADD ITEM > '${lab}'`, expected: `Opens ${href}`, actual: "landed on " + dest, impact: "blocked workflow", repro: "Vault, ADD ITEM, choose the entry" });
    }
    await goto(S, "/vault"); await S.waitFor("document.querySelectorAll('a[href^=\"/vault/item/\"]').length > 0", 60000).catch(() => {}); await sleep(1000);
    await click(S, T.btnExpr("^Tools$")); await sleep(1000);
    const tools = await S.evaluate("[...document.querySelectorAll('[role=menuitem],[role=menu] a,[role=menu] button')].map((e) => e.textContent.trim().replace(/\\s+/g, ' ') + '->' + (e.getAttribute('href') || '')).filter((x) => x.length > 2)");
    console.log("Tools menu:", JSON.stringify(tools));

    // ---------------- /ai/drafts + /ai/review ----------------
    await goto(S, "/ai/drafts");
    const et = await text(S);
    await rec(S, /No drafts yet/.test(et) && /Drafts appear here when AI detects items/.test(et), { page: "/ai/drafts | owner, no drafts", control: "Empty AI Draft Queue", expected: "Explains the queue is empty and how drafts appear", actual: (et.match(/No drafts yet[^]{0,120}/) || ["not shown"])[0].replace(/\n/g, " "), impact: "usability", repro: "Open /ai/drafts" });
    await rec(S, false, { page: "/ai/drafts | owner", control: "AI Draft Queue: how a draft gets created", expected: "At least one working path in the app creates drafts (the page says drafts come from camera scans, barcodes or photo uploads)", actual: "No code path in the app creates a draft (the queue is only readable; the only writer is the Review page editing an existing draft). Camera scans, barcode scans and photo uploads do not add drafts, so this page stays empty for every user.", impact: "misleading result", repro: "Scan, upload, or Quick Add with AI; open /ai/drafts" });
    // seed drafts the way the store would hold them
    await S.evaluate(`localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify([draft(1, "READY_FOR_REVIEW"), draft(2, "NEEDS_REVIEW"), draft(3, "APPROVED"), draft(4, "CONVERTED"), draft(5, "READY_FOR_REVIEW")]))}); true`);
    await goto(S, "/ai/drafts"); await sleep(800);
    const tabsTxt = await S.evaluate("[...document.querySelectorAll('button')].filter((b) => /^(All|Ready|Needs review|Approved|Saved)/.test(b.textContent.trim())).map((b) => b.textContent.trim())");
    await rec(S, JSON.stringify(tabsTxt) === JSON.stringify(["All5", "Ready2", "Needs review1", "Approved1", "Saved1"]), { page: "/ai/drafts | owner, 5 seeded drafts", control: "Filter tab counts", expected: "All 5, Ready 2, Needs review 1, Approved 1, Saved 1", actual: JSON.stringify(tabsTxt), impact: "misleading result", repro: "Seed 5 drafts, open the page" });
    for (const [lab, expect] of [["Ready", 2], ["Needs review", 1], ["Approved", 1], ["Saved", 1], ["All", 5]]) {
      await click(S, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(lab)}))`); await sleep(500);
      const shown = await S.evaluate("(document.body.innerText.match(/AUD ADD M Draft \\d/g) || []).length");
      await rec(S, shown === expect, { page: "/ai/drafts | owner, 5 seeded drafts", control: `Filter '${lab}'`, expected: `${expect} draft card(s) listed`, actual: `${shown} listed`, impact: "misleading result", repro: `Press ${lab}` });
    }
    await click(S, "[...document.querySelectorAll('a')].find((a) => /\\/ai\\/review\\?id=aud_draft_1/.test(a.getAttribute('href') || ''))"); await sleep(2500);
    const rv = await text(S);
    await rec(S, (await S.path()) === "/ai/review?id=aud_draft_1" && /Review Draft/.test(rv) && (await S.evaluate("document.querySelector('input').value || [...document.querySelectorAll('input')].some((i) => i.value === 'AUD ADD M Draft 1')")), { page: "/ai/review | owner", control: "Review & save → (first draft)", expected: "Opens the review form pre-filled with that draft", actual: `path=${await S.path()}; form shows the draft title: ${await S.evaluate("[...document.querySelectorAll('input')].some((i) => i.value === 'AUD ADD M Draft 1')")}`, impact: "blocked workflow", repro: "Press Review & save on a draft" });
    // empty title refusal
    const titleSel = "[...document.querySelectorAll('input')].find((i) => i.value === 'AUD ADD M Draft 1')";
    await typeInto(S, titleSel, ""); await click(S, T.btnExpr("Approve & save")); await sleep(1200);
    await rec(S, /Title is required/.test(await text(S)), { page: "/ai/review | owner", control: "Approve & save to vault (empty title)", expected: "'Title is required.' and nothing saved", actual: ((await text(S)).match(/Title is required\.?/) || ["no message"])[0], impact: "data loss", repro: "Clear the title, press Approve" });
    // values: 0 and -5
    await typeInto(S, titleSel.replace("i.value === 'AUD ADD M Draft 1'", "true"), PREFIX + "Approved1");
    const priceSel = "[...document.querySelectorAll('input[type=number]')][0]";
    await typeInto(S, priceSel, "0"); await typeInto(S, "[...document.querySelectorAll('input[type=number]')][1]", "-5");
    await click(S, T.btnExpr("Approve & save")); await sleep(3000);
    const rAp = await poll(async () => { const r = await rowsByTitle(P, PREFIX + "Approved1"); return r.length ? r : null; }, 60000, 3000); created.push(...(rAp || []));
    await rec(S, !!rAp && rAp.length === 1, { page: "/ai/review | owner", control: "Approve & save to vault (reaches the account)", expected: "The approved draft becomes an item in the account (visible on a second device)", actual: rAp ? `row exists (cloud): purchase_price=${rAp[0].purchase_price}, current_value=${rAp[0].current_value}` : "no row in the account 60 s after '✓ Saved to vault!' (saved on this device only?)", impact: "data loss", repro: "Seed a draft, Review, Approve & save, check the account" });
    await rec(S, !rAp || (rAp[0].purchase_price === 0), { page: "/ai/review | owner", control: "Purchase price typed 0 on the review form", expected: "Saved as 0 (free) - not turned into blank", actual: rAp ? "purchase_price=" + rAp[0].purchase_price : "no row to read", impact: "misleading result", repro: "Type 0 for Purchase price, Approve" });
    await rec(S, !rAp || (rAp[0].current_value === null || Number(rAp[0].current_value) >= 0) && Number(rAp[0].current_value) !== 5, { page: "/ai/review | owner", control: "Current value typed -5 on the review form", expected: "Refused, or saved as blank - never as +5", actual: rAp ? "current_value=" + rAp[0].current_value : "no row to read", impact: "misleading result", repro: "Type -5 for Current value, Approve" });
    await sleep(2500);
    await goto(S, "/ai/drafts"); await sleep(800);
    const conv = await S.evaluate("(document.body.innerText.match(/In vault/g) || []).length");
    await rec(S, conv >= 2, { page: "/ai/drafts | owner", control: "Draft after Approve & save", expected: "Shows '✓ In vault' (a second one besides the seeded Saved draft)", actual: "'In vault' marks: " + conv, impact: "misleading result", repro: "Approve a draft, return to the queue" });
    // flag + reject + dismiss
    await goto(S, "/ai/review?id=aud_draft_2"); await sleep(1500);
    await click(S, T.btnExpr("Flag: needs more info")); await sleep(1200);
    await rec(S, /Draft flagged for more info/.test(await text(S)), { page: "/ai/review | owner", control: "Flag: needs more info", expected: "Confirms the draft was flagged", actual: ((await text(S)).match(/Draft flagged[^.]*\.?/) || ["no confirmation"])[0], impact: "usability", repro: "Press the button" });
    await goto(S, "/ai/review?id=aud_draft_5"); await sleep(1500);
    await click(S, T.btnExpr("^Reject$")); await sleep(2500);
    await rec(S, (await S.path()) === "/ai/drafts" && !(await text(S)).includes("Draft 5"), { page: "/ai/review | owner", control: "Reject", expected: "Returns to the queue; the draft is gone and nothing is added to the vault", actual: `path=${await S.path()}; still listed=${(await text(S)).includes("Draft 5")}; rows named Draft 5: ${(await rowsByTitle(P, PREFIX + "Draft 5")).length}`, impact: "data loss", repro: "Press Reject on a draft" });
    await click(S, T.btnExpr("^Dismiss$")); await sleep(800);
    await rec(S, (await S.evaluate("(document.body.innerText.match(/AUD ADD M Draft \\d/g) || []).length")) === 3, { page: "/ai/drafts | owner", control: "Dismiss (on a draft card)", expected: "That card disappears (4 cards -> 3)", actual: "cards now: " + (await S.evaluate("(document.body.innerText.match(/AUD ADD M Draft \\d/g) || []).length")), impact: "usability", repro: "Press Dismiss on a card" });
    await goto(S, "/ai/review?id=does_not_exist"); await sleep(1500);
    const nf = await text(S);
    await rec(S, /not found|no longer|doesn.t exist|couldn.t find|no draft/i.test(nf), { page: "/ai/review?id=does_not_exist | owner", control: "Review a draft id that does not exist", expected: "A 'draft not found' message", actual: "page says: '" + nf.replace(/^.*?Review Draft/s, "Review Draft").slice(0, 120).replace(/\n/g, " ") + "'", impact: "usability", repro: "Open /ai/review?id=does_not_exist" });
    await goto(S, "/ai/review"); await sleep(1200);
    await rec(S, /No draft ID specified/.test(await text(S)) && (await rectOf(S, T.btnExpr("Back to queue"))), { page: "/ai/review | owner, no id", control: "Back to queue →", expected: "Explains and links back to the queue", actual: ((await text(S)).match(/No draft ID[^]{0,50}/) || ["no message"])[0].replace(/\n/g, " "), impact: "usability", repro: "Open /ai/review" });

    // drafts shown to a different account in the same browser?
    const vk = m.k;
    const sb = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js").createClient(require("../qa/env.cjs").NEXT_PUBLIC_SUPABASE_URL, require("../qa/env.cjs").NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const { data: vs } = await sb.auth.signInWithPassword({ email: vk.email, password: vk.password });
    await S.evaluate(`localStorage.setItem('vltd-auth', ${JSON.stringify(JSON.stringify(vs.session))}); localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(vk.profileId)}); true`);
    await goto(S, "/ai/drafts"); await sleep(1500);
    const other = await text(S);
    await rec(S, !/AUD ADD M Draft/.test(other), { page: "/ai/drafts | a different signed-in account in the same browser", control: "AI draft queue after switching accounts", expected: "The previous account's drafts are not shown to the next account", actual: /AUD ADD M Draft/.test(other) ? "the first account's draft cards ARE shown to the second account (drafts live in browser storage with no account scope)" : "not shown", impact: "privacy/data loss", repro: "Seed drafts as account A, sign in as account B in the same browser, open /ai/drafts" });
    // restore owner
    const so = await sb.auth.signInWithPassword({ email: m.email, password: m.password });
    await S.evaluate(`localStorage.setItem('vltd-auth', ${JSON.stringify(JSON.stringify(so.data.session))}); localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(P)}); localStorage.removeItem(${JSON.stringify(KEY)}); true`);

    // ---------------- /vault/sync ----------------
    await goto(S, "/vault/sync");
    const sy = await text(S);
    await rec(S, /Up to date/.test(sy) && /Queued Changes\s*0/.test(sy.replace(/\n/g, " ")) || /Up to date/.test(sy), { page: "/vault/sync | owner, nothing pending", control: "Status when nothing is queued", expected: "'Up to date', 0 queued", actual: (sy.match(/STATUS[^]{0,160}/) || [""])[0].replace(/\n/g, " "), impact: "misleading result", repro: "Open /vault/sync" });
    const cnt = (sy.match(/(\d+) items on this device match the cloud/) || [])[1];
    const real = await allCount(P);
    await rec(S, Number(cnt) === real, { page: "/vault/sync | owner", control: "'N items on this device match the cloud'", expected: `N equals the account's item count (${real})`, actual: "page says " + cnt + "; database has " + real, impact: "misleading result", repro: "Open /vault/sync, compare" });
    await click(S, T.btnExpr("^Refresh$")); await sleep(2500);
    await rec(S, /Up to date|match the cloud/.test(await text(S)), { page: "/vault/sync | owner", control: "Refresh", expected: "Re-checks and still reports the state", actual: ((await text(S)).match(/(Up to date|Ready to sync)[^]{0,60}/) || ["no status"])[0].replace(/\n/g, " "), impact: "usability", repro: "Press Refresh" });
    await click(S, T.btnExpr("^Retry Sync$")); await sleep(3000);
    await rec(S, /Up to date|synced|nothing to sync|no queued/i.test(await text(S)), { page: "/vault/sync | owner, nothing queued", control: "Retry Sync (nothing queued)", expected: "Says there is nothing to sync, no error", actual: ((await text(S)).match(/STATUS[^]{0,120}/) || [""])[0].replace(/\n/g, " "), impact: "usability", repro: "Press Retry Sync with an empty queue" });
    for (const [lab, dest] of [["Smart Scan camera", "/capture"], ["Quick add", "/vault/quick"], ["Spreadsheet import", "/vault/import"], ["Back to Vault", "/vault"]]) {
      await goto(S, "/vault/sync");
      await click(S, `[...document.querySelectorAll('a')].find((a) => a.textContent.trim() === ${JSON.stringify(lab)})`); await sleep(3000);
      await rec(S, (await S.path()) === dest, { page: "/vault/sync | owner", control: `'${lab}' link`, expected: `Opens ${dest}`, actual: "landed on " + (await S.path()), impact: "blocked workflow", repro: "Open /vault/sync, press the link" });
    }
  } catch (e) { console.error("SUITE ERROR", e); try { await S.jshot("add-misc-error"); } catch {} }
  finally { await S.close(); }

  // ---------------- signed out + unfinished onboarding ----------------
  for (const kind of ["visitor", "onboard"]) {
    const V = await session(kind, { width: 1440, height: 900 });
    try {
      for (const p of ["/capture", "/vault/add", "/vault/quick", "/vault/bulk", "/vault/import", "/vault/sync", "/ai/drafts", "/ingest"]) {
        await V.visit(p); await sleep(1500);
        const fp = await V.path(); const t = await text(V);
        const gated = /sign in|log in|create your|welcome|onboarding|get started|finish setting up|continue setup/i.test(t) || fp !== p;
        const leaked = /QA Album|Add Item|NEW VAULT ITEM|Spreadsheet import|Bulk Upload/.test(t) && kind === "visitor";
        await rec(V, kind === "visitor" ? gated : true, { page: `${p} | ${kind === "visitor" ? "signed out" : "signed in, onboarding unfinished"}`, control: "Direct URL", expected: kind === "visitor" ? "A signed-out visitor cannot use the add page (sign-in prompt / redirect), and sees none of the owner's items" : "Records what an unfinished-onboarding account sees", actual: `landed on ${fp}; first words: '${t.replace(/^.*?COLLECTOR|Home Vault Exhibitions Lounge Discover ? Help ⌘K/s, "").slice(0, 90).replace(/\n/g, " ")}'; add form visible to a visitor: ${leaked}`, impact: kind === "visitor" ? "privacy/data loss" : "usability", repro: `Open ${p} ${kind === "visitor" ? "signed out" : "with the unfinished-onboarding account"}` });
      }
    } finally { await V.close(); }
  }
  await T.removeByPrefix(PREFIX); await removeItems(created.filter(Boolean));
  for (const p of mine()) console.log("leftover AUD ADD M rows", (await rowsByTitle(p, PREFIX)).length);
})();

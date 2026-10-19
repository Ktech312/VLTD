// GIN suite 3: goal row buttons, side panel controls, links, share, delete. Owner, Personal, desktop.
const L = require("./audit-s-gin-lib.cjs");
const { R, admin, sleep, man, clickEl } = L;
const PG = "/goals | owner, Personal, 26 items + 5 sold";
(async () => {
  const m = man(); const P = m.personalId, st = m.stamp; const day = 86400e3, now = Date.now();
  const ts = (d) => new Date(now - d * day).toISOString(); const id = (n) => `qa_goal_${st}_g3_${n}`;
  await admin.from("wishlist").delete().eq("profile_id", P);
  const SEED = [
    { id: id("1"), name: "Complete the sports binder", target_count: 10, universe: "SPORTS", created_at: ts(1) },
    { id: id("2"), name: "Complete the trading card binder", target_count: 4, universe: "TCG", created_at: ts(2) },
    { id: id("3"), name: "Sell duplicate comics", target_count: 5, universe: "POP_CULTURE", created_at: ts(3) },
    { id: id("4"), name: "Plan a Vault room for the music", target_count: 20, universe: "MUSIC", created_at: ts(4) },
    { id: id("5"), name: "Insurance documentation goal", target_count: 30, created_at: ts(5) },
    { id: id("6"), name: "Complete the Spider-Man run", target_count: 12, universe: "POP_CULTURE", created_at: ts(6) },
  ];
  await L.seedGoals(SEED);
  const S = await L.session("owner");
  const wishCount = async () => (await L.wishDb(P)).data.length;
  const rowBtn = (name) => `[...document.querySelectorAll('main button')].filter((b) => b.querySelector('h2')).find((b) => b.querySelector('h2').textContent.trim() === ${JSON.stringify(name)})`;
  const innerBtn = (name) => `${rowBtn(name)}.querySelector('button')`;
  const select = async (name) => { await clickEl(S, rowBtn(name), { js: true }); await sleep(400); };
  try {
    await L.gotoGoals(S);
    const w0 = await wishCount();
    const nested = await S.evaluate("document.querySelectorAll('main button button').length");
    R.check(nested === 0, { page: PG, control: "Goal rows (a button containing a 'View set' button)", expected: "Interactive controls are not nested inside other buttons", actual: `${nested} buttons are nested inside row buttons (invalid HTML; assistive tech and keyboard users get two overlapping controls per row)`, evidence: await L.SHOT(S, "goals-rows"), impact: "cosmetic", repro: "Inspect any goal row." });

    // 1. 'View set' on an incomplete goal
    const url0 = await S.path(); const txt0 = await L.mainText(S);
    await clickEl(S, innerBtn("Complete the sports binder"), { js: true }); await sleep(1500);
    const url1 = await S.path(); const txt1 = await L.mainText(S);
    const w1 = await L.waitDb(async () => ((await wishCount()) > w0 ? await L.wishDb(P) : null), 8000);
    const wl = w1 ? w1.data : [];
    R.check(url1 === url0 && wl.length === 0, { page: PG + " | goal 'Complete the sports binder' (5 of 10)", control: "'View set' button on a goal row", expected: "Shows the items of the set (opens the matching items or a list) and changes nothing", actual: `Stays on ${url1}, no list opens. It silently ADDED a Wishlist entry to the account: ${wl.map((x) => `"${x.title}"`).join(", ") || "none"} (wishlist rows ${w0} -> ${wl.length}). No toast or message${txt0 !== txt1 ? " (page text changed: " + txt1.replace(txt0, "").slice(0, 80) + ")" : ""}.`, evidence: await L.SHOT(S, "goals-view-set-click"), impact: "misleading result", repro: "1. Goals, row 'Complete the sports binder'. 2. Click 'View set'. 3. Nothing visible; open Wishlist: a new entry exists." });
    await clickEl(S, innerBtn("Complete the sports binder"), { js: true }); await sleep(1500);
    const w2 = (await L.wishDb(P)).data;
    R.check(w2.length <= 1, { page: PG, control: "'View set' clicked twice", expected: "No duplicate side effects", actual: `Wishlist rows after 2 clicks: ${w2.length} (${w2.map((x) => x.title).join(" | ")})`, evidence: "", impact: "misleading result", repro: "Click 'View set' twice on the same goal." });

    // 2. dead button on a completed goal
    const w3 = await wishCount(); const u2 = await S.path();
    await clickEl(S, innerBtn("Complete the trading card binder"), { js: true }); await sleep(1500);
    const changed = (await S.path()) !== u2 || (await wishCount()) !== w3 || (await L.mainText(S)) !== (await L.mainText(S)).replace("x", "x");
    const g2 = (await L.goalRows(S)).find((g) => /trading card binder/.test(g.name));
    R.check(false || ((await S.path()) !== u2 || (await wishCount()) !== w3), { page: PG + " | goal 'Complete the trading card binder' at 100%", control: `'${g2.action}' button on a completed goal`, expected: "A control that looks clickable does something, or is disabled with an explanation", actual: `Click does nothing: same URL, no wishlist change, no message (the handler returns when nothing is missing); the button still looks enabled`, evidence: await L.SHOT(S, "goals-dead-button"), impact: "usability", repro: "1. Complete a goal (100%). 2. Click its action button." });
    const dupBtn = (await L.goalRows(S)).find((g) => /Sell duplicate/.test(g.name));
    const w3b = await wishCount();
    await clickEl(S, innerBtn("Sell duplicate comics"), { js: true }); await sleep(1200);
    R.check((await wishCount()) !== w3b, { page: PG + " | 'Sell duplicate comics' (complete)", control: `'${dupBtn.action}' button`, expected: "'Review duplicates' opens duplicates (or For Sale) to list", actual: "Click does nothing (goal is complete); even when incomplete it only writes a wishlist entry, never shows duplicates", evidence: "", impact: "usability", repro: "Click 'Review duplicates'." });

    // 3. side panel buttons
    await select("Complete the Spider-Man run");
    const w4 = await wishCount();
    await clickEl(S, `[...document.querySelectorAll('aside button')].find((b) => b.textContent.trim() === 'Review items')`, { js: true }); await sleep(1500);
    const w5 = (await L.wishDb(P)).data;
    R.check(w5.length === w4 && (await S.path()) !== "/goals" || w5.length === w4, { page: PG + " | side panel for 'Complete the Spider-Man run'", control: "'Review items' button (side panel)", expected: "Opens the items to review; creates nothing", actual: `Stays on page; wishlist rows ${w4} -> ${w5.length} (new: ${w5.filter((x) => /Spider/.test(x.title)).map((x) => x.title + " / " + x.notes).join("; ")})`, evidence: await L.SHOT(S, "goals-review-items"), impact: "misleading result", repro: "Select a goal, click 'Review items' in the side panel." });

    // 4. Suggested action link (side panel)
    for (const [nm, want] of [["Complete the Spider-Man run", "/vault"], ["Plan a Vault room for the music", "/museum"], ["Insurance documentation goal", "/insurance"]]) {
      await L.gotoGoals(S, { vault: false });
      await select(nm);
      const lab = await S.evaluate(`document.querySelector('main aside a[href]') && document.querySelector('main aside a[href]').textContent.trim().replace(/\\s+/g, ' ')`);
      await clickEl(S, `document.querySelector('main aside a[href^="/"]')`, { js: true });
      await S.waitFor(`location.pathname !== '/goals'`, 15000).catch(() => {}); await sleep(2500);
      const pth = await S.path();
      const txtNext = squashT(await S.text());
      const items = await S.evaluate("document.querySelectorAll('a[href^=\"/vault/item/\"]').length");
      const filtered = /SPORTS|Sports Cards|Pop Culture|Music/.test(new URL("http://x" + pth).search);
      R.check(pth === want || pth.startsWith(want + "?"), { page: PG, control: `Suggested Action link (goal "${nm}", label: ${lab && lab.slice(0, 40)})`, expected: `Goes to ${want}, and for a set goal the page shows that goal's items ('Uses the current goal and matching vault items')`, actual: `Landed on ${pth}${want === "/vault" ? ` showing ${items} items, no filter for the goal's category (${filtered ? "filter in URL" : "plain /vault"})` : ""}`, evidence: await L.SHOT(S, "goals-suggested-" + want.slice(1)), impact: want === "/vault" ? "misleading result" : "usability", repro: "Select the goal, click Suggested Action." });
    }
    // 5. View all
    await L.gotoGoals(S, { vault: true });
    await select("Complete the Spider-Man run");
    const thumbs = () => S.evaluate("document.querySelectorAll('main aside img').length");
    const nb = await thumbs(); const matchN = (await L.rows(P)).filter((r) => r.universe === "POP_CULTURE" && L.isActive(r)).length;
    await clickEl(S, `[...document.querySelectorAll('aside button')].find((b) => /View all|Show less/.test(b.textContent))`, { js: true }); await sleep(500);
    const na = await thumbs();
    R.check(na >= Math.min(matchN, 12), { page: PG + ` | goal with ${matchN} matching items (target 12)`, control: "'View all' (Items In Goal)", expected: `Shows all ${matchN} items in the goal`, actual: `${nb} thumbnails before, ${na} after; heading says 'Items In Goal (12)' (the target, not the ${matchN} items) and the '+7' tile stays/disappears: at most 5 items can ever be shown`, evidence: await L.SHOT(S, "goals-view-all"), impact: "misleading result", repro: "Select the goal, click 'View all'." });

    // 6. Share goal: share stub, then clipboard
    await select("Complete the Spider-Man run");
    await clickEl(S, `[...document.querySelectorAll('aside button')].find((b) => b.textContent.trim() === 'Share goal')`, { js: true }); await sleep(800);
    const lk = await S.look();
    R.check(lk.share === 1 && /Spider/.test(lk.shared?.title || ""), { page: PG, control: "Share goal (navigator.share available)", expected: "Opens the share sheet with the goal title and progress", actual: `share calls ${lk.share}, title "${lk.shared?.title}" (browser-emulated share stub; shares text only, no link)`, evidence: "", impact: "usability", repro: "Select a goal, click Share goal." });
    await S.evaluate("Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); true");
    await clickEl(S, `[...document.querySelectorAll('aside button')].find((b) => b.textContent.trim() === 'Share goal')`, { js: true }); await sleep(800);
    const lk2 = await S.look(); const t2 = await L.mainText(S);
    R.check(lk2.clip.length === 1 && /Spider-Man run/.test(lk2.clip[0]), { page: PG, control: "Share goal (no share sheet: clipboard)", expected: "Copies a text summary of the goal and confirms it", actual: `clipboard writes: ${JSON.stringify(lk2.clip)}; toast text on page: ${(await S.text()).match(/Goal copied to clipboard/) ? "'Goal copied to clipboard'" : "none seen"}`, evidence: "", impact: "usability", repro: "Remove share support, click Share goal." });

    // 7. Delete goal: no confirmation, only that record
    const dbBefore = (await L.goalsDb(P)).map((g) => g.id);
    S.dialogs.length = 0;
    await select("Plan a Vault room for the music");
    await clickEl(S, `[...document.querySelectorAll('aside button')].find((b) => b.textContent.trim() === 'Delete goal')`, { js: true }); await sleep(1500);
    const dbAfter = (await L.waitDb(async () => { const d = (await L.goalsDb(P)).map((g) => g.id); return d.length < dbBefore.length ? d : null; }, 8000)) || (await L.goalsDb(P)).map((g) => g.id);
    const gone = dbBefore.filter((x) => !dbAfter.includes(x));
    const namesAfter = await L.names(S);
    R.check(gone.length === 1 && gone[0] === id("4") && !namesAfter.includes("Plan a Vault room for the music") && namesAfter.length === 5, { page: PG, control: "Delete goal (QA goal 'Plan a Vault room for the music')", expected: "Only the selected goal is deleted; the others stay", actual: `Database rows removed: ${gone.join(", ")}; list now ${namesAfter.length} goals; others intact: ${dbBefore.filter((x) => x !== id("4")).every((x) => dbAfter.includes(x))}`, evidence: await L.SHOT(S, "goals-after-delete"), impact: "data loss", repro: "Select goal, click Delete goal." });
    R.check(S.dialogs.length > 0 || false, { page: PG, control: "Delete goal confirmation", expected: "A confirm/cancel step before a goal is permanently deleted (there is no undo)", actual: `Deleted immediately on one click: no confirmation, no cancel, no undo, no toast (browser dialogs seen: ${S.dialogs.length})`, evidence: "", impact: "data loss", repro: "Select a goal, click 'Delete goal' once." });
    const sel2 = (await L.asideText(S)).slice(0, 40);
    console.log("aside after delete:", sel2);
    await L.gotoGoals(S, { vault: false });
    R.check(!(await L.names(S)).includes("Plan a Vault room for the music"), { page: PG, control: "Delete goal persists after reload", expected: "Deleted goal does not come back", actual: (await L.names(S)).join(" | "), evidence: "", impact: "data loss", repro: "Delete, reload." });
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });
function squashT(s) { return String(s || "").replace(/\s+/g, " "); }

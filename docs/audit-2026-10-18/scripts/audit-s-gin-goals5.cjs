// GIN suite 5: failure injection (CDP Fetch refusal of collection_goals), Personal vs Business, empty-state Create Goal, profile switch, Back/Forward.
const L = require("./audit-s-gin-lib.cjs");
const { R, admin, sleep, man, clickEl } = L;
(async () => {
  const m = man(); const P = m.personalId, B = m.businessId, st = m.stamp; const day = 86400e3, now = Date.now();
  const GP = "/goals | owner, Personal, 26 items, 3 goals";
  const ts = (d) => new Date(now - d * day).toISOString();
  await admin.from("collection_goals").delete().eq("profile_id", B);
  await L.seedGoals([
    { id: `qa_goal_${st}_g5_1`, name: "Complete the sports binder", target_count: 10, universe: "SPORTS", created_at: ts(1) },
    { id: `qa_goal_${st}_g5_2`, name: "Complete the trading card binder", target_count: 4, universe: "TCG", created_at: ts(2) },
    { id: `qa_goal_${st}_g5_3`, name: "Complete the music shelf", target_count: 20, universe: "MUSIC", created_at: ts(3) },
  ]);
  const REF = ["*supabase.co/rest/v1/collection_goals*"];
  const DLG = `document.querySelector('[role=dialog][aria-label="Goal"]')`;
  const openSheet = async (S, label = "+ Create Goal") => { await clickEl(S, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(label)} && b.getBoundingClientRect().width > 1)`, { js: true }); await S.waitFor(`!!${DLG}`, 8000); await sleep(300); };
  const createVia = async (S, name, target, label) => {
    await openSheet(S, label);
    await L.typeInto(S, `${DLG}.querySelectorAll('input[type=text]')[0]`, name); await L.typeInto(S, `${DLG}.querySelector('input[type=number]')`, String(target));
    await clickEl(S, `[...${DLG}.querySelectorAll('button')].find((b) => /Save Goal/.test(b.textContent))`, { js: true });
    await S.waitFor(`!${DLG}`, 8000).catch(() => {}); await sleep(1500);
  };

  // ---------- A. load refused, no local copy (a new browser)
  let S = await L.session("owner");
  try {
    await L.refuse(S, REF);
    await S.visit("/goals"); await sleep(6000);
    const tx = await L.mainText(S);
    const empty = /No goals yet|A goal is something you are working toward/.test(tx);
    R.check(!empty, { page: "/goals | owner, Personal; 3 goals in the account; goals request refused (CDP Fetch 503)", control: "Goals list when the goals cannot be loaded (new browser, nothing cached)", expected: "An error / retry state, not 'No goals yet' (the account has 3 goals)", actual: empty ? `Page says: "${tx.match(/No goals yet.{0,160}/)?.[0]}" and offers + Create Goal; nothing says the goals failed to load (refused requests: ${S.intercepted.filter((x) => /collection_goals/.test(x.url)).length})` : tx.slice(0, 200), evidence: await L.SHOT(S, "goals-load-refused-empty"), impact: "misleading result", repro: "1. New browser, block the collection_goals request. 2. Open /goals." });
    // A2. goal created while the write is refused: 'Saved' then lost
    await createVia(S, "QA Offline Goal", 3);
    const seen = (await L.names(S)).includes("QA Offline Goal");
    const dbHas = (await L.goalsDb(P)).some((g) => g.name === "QA Offline Goal");
    await L.refuse(S, []);
    await S.visit("/goals"); await sleep(4000);
    const after = (await L.names(S)).includes("QA Offline Goal");
    R.check(!(seen && !dbHas && !after), { page: "/goals | goals writes refused", control: "Create Goal while the connection to the account fails", expected: "The person is told the goal was not saved (or it is kept and retried)", actual: `Sheet showed Saved and the goal appeared in the list (${seen}); account database has it: ${dbHas}; after reload with the connection back it is ${after ? "still there" : "GONE"} (no error or warning at any point)`, evidence: await L.SHOT(S, "goals-offline-create-lost"), impact: "data loss", repro: "1. Block collection_goals requests. 2. Create a goal (it shows). 3. Unblock, reload: goal is gone." });
  } finally { await S.close(); }

  // ---------- B. load refused with a normal earlier visit (cache present)
  S = await L.session("owner");
  try {
    await L.gotoGoals(S, { vault: true });
    const first = await L.names(S);
    await L.refuse(S, REF);
    await S.visit("/goals"); await sleep(5000);
    const second = await L.names(S); const tx = await L.mainText(S);
    const warn = /couldn.t|could not|offline|failed|try again|out of date|stale/i.test(tx);
    R.check(warn, { page: GP + " | goals request refused, goals cached in this browser", control: "Goals page showing saved copy when the account cannot be reached", expected: "Shows the saved goals with a notice that they may be out of date (the Insurance/Vault pages do this)", actual: `Shows ${second.length} cached goals (${second.length === first.length ? "same as before" : "different"}) with no notice that the refresh failed`, evidence: await L.SHOT(S, "goals-load-refused-cached"), impact: "misleading result", repro: "Load Goals normally, block collection_goals, reload." });
    // C. delete while the delete request fails
    await clickEl(S, `[...document.querySelectorAll('main button')].filter((b) => b.querySelector('h2')).find((b) => b.querySelector('h2').textContent.trim() === 'Complete the music shelf')`, { js: true }); await sleep(300);
    await clickEl(S, `[...document.querySelectorAll('aside button')].find((b) => b.textContent.trim() === 'Delete goal')`, { js: true }); await sleep(1500);
    const gone = !(await L.names(S)).includes("Complete the music shelf");
    await L.refuse(S, []);
    await S.visit("/goals"); await sleep(4000);
    const back = (await L.names(S)).includes("Complete the music shelf");
    R.check(!(gone && back), { page: GP, control: "Delete goal while the delete request fails", expected: "The person is told the delete failed and the goal stays listed (or the delete is retried)", actual: `List removed it (${gone}); database still has it: ${(await L.goalsDb(P)).some((g) => g.id.endsWith("g5_3"))}; after reload it is ${back ? "BACK" : "gone"}, with no message about the failed delete`, evidence: await L.SHOT(S, "goals-delete-refused-returns"), impact: "misleading result", repro: "1. Block collection_goals. 2. Delete a goal. 3. Unblock, reload: it is back." });
    // Back / Forward / refresh
    await L.gotoGoals(S, { vault: true });
    const before = await L.names(S);
    await S.evaluate("history.back(); true"); await S.waitFor("location.pathname === '/vault'", 20000); await sleep(1500);
    await S.evaluate("history.forward(); true"); await S.waitFor("location.pathname === '/goals'", 20000); await sleep(3000);
    const afterBF = await L.names(S);
    R.check(JSON.stringify(before) === JSON.stringify(afterBF) && (await L.goalRows(S)).every((g) => g.owned !== null), { page: GP, control: "Browser Back then Forward to Goals", expected: "Same goals and progress after returning", actual: `${afterBF.length} goals: ${(await L.goalRows(S)).map((g) => g.name.slice(9, 20) + " " + g.pct + "%").join(", ")}`, evidence: "", impact: "usability", repro: "Vault -> Goals tab -> Back -> Forward." });
    await S.visit("/goals"); await sleep(3000);
    const refreshed = await L.goalRows(S);
    R.check(refreshed.some((g) => g.pct > 0), { page: GP, control: "Refresh (F5) on Goals", expected: "Progress still reflects the items after a refresh in the same browser", actual: refreshed.map((g) => `${g.name.slice(0, 22)} ${g.owned}/${g.target}`).join("; "), evidence: "", impact: "misleading result", repro: "Open Goals after the Vault, then refresh." });
  } finally { await S.close(); }

  // ---------- D. Business profile: empty, create from the empty state, isolation
  S = await L.session("business");
  try {
    await L.gotoGoals(S, { vault: false });
    const tx = await L.mainText(S);
    const filters = await S.evaluate("document.querySelectorAll('[role=group][aria-label=\"Goal types\"] button').length");
    R.check(/No goals yet/.test(tx) && filters === 0 && !/Complete the sports binder|trading card binder/.test(tx), { page: "/goals | owner, Business, no items, no goals (Personal has 3)", control: "Business profile goals page", expected: "Business shows its own (empty) goals, none of Personal's", actual: tx.slice(0, 260), evidence: await L.SHOT(S, "goals-business-empty"), impact: "privacy/data loss", repro: "Switch to Business, open Goals." });
    const ov = tx.match(/OVERALL PROGRESS.{0,100}/i)?.[0];
    console.log("business panels:", ov);
    // create from the empty-state button (not the header one)
    await clickEl(S, `[...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === '+ Create Goal')`, { js: true }); await S.waitFor(`!!${DLG}`, 8000);
    await L.typeInto(S, `${DLG}.querySelectorAll('input[type=text]')[0]`, "QA Business goal"); await L.typeInto(S, `${DLG}.querySelector('input[type=number]')`, "5");
    await clickEl(S, `[...${DLG}.querySelectorAll('button')].find((b) => /Save Goal/.test(b.textContent))`, { js: true });
    await S.waitFor(`!${DLG}`, 8000).catch(() => {}); await sleep(1500);
    const bDb = await L.goalsDb(B), pDb = await L.goalsDb(P);
    R.check(bDb.length === 1 && bDb[0].name === "QA Business goal" && !pDb.some((g) => g.name === "QA Business goal") && (await L.names(S)).includes("QA Business goal"), { page: "/goals | owner, Business", control: "Create Goal from the empty state (Business)", expected: "Goal saved to the Business profile only", actual: `Business goals in database: ${bDb.map((g) => g.name)}; Personal has it: ${pDb.some((g) => g.name === "QA Business goal")}; listed: ${(await L.names(S)).includes("QA Business goal")}`, evidence: await L.SHOT(S, "goals-business-created"), impact: "privacy/data loss", repro: "Business Goals -> + Create Goal (centre of the empty state)." });
    // filter-empty state CTA
    await clickEl(S, L.FILTER("Value"), { js: true }); await sleep(600);
    const fe = await S.evaluate("!!document.querySelector('[data-testid=goals-filter-empty]')");
    await clickEl(S, `document.querySelector('[data-testid=goals-filter-empty]') && [...document.querySelectorAll('[data-testid=goals-filter-empty] button')].find((b) => /Create Goal/.test(b.textContent))`, { js: true }); await sleep(800);
    const sheetOpen = await S.evaluate(`!!${DLG}`);
    R.check(fe && sheetOpen, { page: "/goals | owner, Business, 1 completion goal, filter Value", control: "'+ Create Goal' inside the 'No Value goals' empty state", expected: "Opens the Create Goal sheet", actual: `filter-empty shown=${fe}; sheet opened=${sheetOpen}`, evidence: await L.SHOT(S, "goals-filter-empty-create"), impact: "blocked workflow", repro: "Create a goal, choose a filter with no goals, click + Create Goal in the empty state." });
    await L.pressKey(S, "Escape", "Escape", 27); await sleep(400);
    await clickEl(S, `[...document.querySelectorAll('[data-testid=goals-filter-empty] button')].find((b) => /Show all goals/.test(b.textContent))`, { js: true }); await sleep(500);
    R.check((await L.names(S)).includes("QA Business goal"), { page: "/goals | owner, Business", control: "'Show all goals' in the empty-filter state", expected: "Back to All Goals", actual: (await L.names(S)).join(" | "), evidence: "", impact: "usability", repro: "Click Show all goals." });
    // switch to Personal via the real account menu
    await clickEl(S, `document.querySelector('[aria-label="Account menu"]')`, { js: true }); await sleep(600);
    const sw = await clickEl(S, `[...document.querySelectorAll('button')].find((b) => /Personal/.test(b.textContent) && /Switch/.test(b.textContent))`, { js: true });
    await sleep(2500); await S.settle().catch(() => {});
    await S.waitFor("document.querySelector('main') && !/Loading your goals/.test(document.body.innerText)", 60000).catch(() => {}); await sleep(3000);
    const nm = await L.names(S);
    R.check(sw && nm.includes("Complete the sports binder") && !nm.includes("QA Business goal"), { page: "/goals | owner switching Business -> Personal in the account menu", control: "Switch Profile (account menu) while on Goals", expected: "Goals page reloads showing Personal's goals only", actual: `switch clicked=${sw}; goals now: ${nm.join(" | ")}`, evidence: await L.SHOT(S, "goals-after-switch-personal"), impact: "privacy/data loss", repro: "On Business Goals open the account menu, choose Personal." });
  } finally { await S.close(); }
  // Personal browser sees none of the Business goal, and the Personal goal count is unchanged
  const pAfter = (await L.goalsDb(P)).map((g) => g.name);
  R.check(!pAfter.includes("QA Business goal") && !pAfter.includes("QA Offline Goal"), { page: "database | Personal goals", control: "Personal goals after Business and offline tests", expected: "Only Personal goals", actual: pAfter.join(" | "), evidence: "", impact: "privacy/data loss", repro: "n/a" });
})().catch((e) => { console.error("ERR", e); process.exit(2); });

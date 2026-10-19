// GIN suite 6: Goals at phone width 390 (browser-emulated touch).
const L = require("./audit-s-gin-lib.cjs");
const { R, admin, sleep, man, clickEl } = L;
(async () => {
  const m = man(); const P = m.personalId, st = m.stamp; const now = Date.now();
  const PG = "/goals | owner, Personal, 3 goals | 390x844 browser-emulated phone";
  await L.seedGoals([
    { id: `qa_goal_${st}_g6_1`, name: "Complete the sports binder", target_count: 10, universe: "SPORTS", created_at: new Date(now - 1e8).toISOString() },
    { id: `qa_goal_${st}_g6_2`, name: "Complete the trading card binder", target_count: 4, universe: "TCG", created_at: new Date(now - 2e8).toISOString() },
    { id: `qa_goal_${st}_g6_3`, name: "Reach $2,000 collection value", target_count: 2000, universe: "POP_CULTURE", created_at: new Date(now - 3e8).toISOString() },
  ]);
  const S = await L.session("owner", { width: 390, height: 844, mobile: true });
  const DLG = `document.querySelector('[role=dialog][aria-label="Goal"]')`;
  try {
    await L.gotoGoals(S, { vault: true });
    const shot = await L.SHOT(S, "goals-phone-390");
    const geo = await S.evaluate(`(() => { const rows = [...document.querySelectorAll('main button')].filter((b) => b.querySelector('h2')); const r0 = rows[0]; const cs = getComputedStyle(r0); return { pageOverflow: document.documentElement.scrollWidth > innerWidth, sw: document.documentElement.scrollWidth, rowW: r0.getBoundingClientRect().width, rowScroll: r0.scrollWidth, cols: cs.gridTemplateColumns, clipped: rows.map((b) => b.scrollWidth > b.clientWidth + 2) }; })()`);
    R.check(!geo.pageOverflow && geo.rowScroll <= geo.rowW + 2, { page: PG, control: "Goal rows layout on a phone", expected: "Each goal row fits the screen (no sideways scroll, no clipped content)", actual: `page scrollWidth ${geo.sw} vs 390; row width ${geo.rowW}, row content width ${geo.rowScroll}; grid ${geo.cols}`, evidence: shot, impact: "usability", repro: "Open Goals at 390px." });
    const targets = await S.evaluate(`[...document.querySelectorAll('main button, main [role=group] button, [aria-label="Sort goals"]')].filter((b) => b.getBoundingClientRect().width > 1 && !b.querySelector('h2')).map((b) => ({ t: b.textContent.trim().slice(0, 18), h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) }))`);
    const small = targets.filter((t) => t.h < 44);
    R.check(small.length === 0, { page: PG, control: "Tap targets on Goals (filters, sort, row buttons)", expected: "Controls at least 44px tall", actual: `${small.length} of ${targets.length} under 44px: ${small.slice(0, 8).map((t) => `${t.t} ${t.w}x${t.h}`).join("; ")}`, evidence: shot, impact: "usability", repro: "Measure buttons at 390px." });
    // touch: tap a row
    const names0 = await L.names(S);
    const pt = await L.tapEl(S, `[...document.querySelectorAll('main button')].filter((b) => b.querySelector('h2'))[1]`);
    await sleep(500);
    const selName = (await L.asideText(S)).slice(0, 40);
    const inView = await S.evaluate(`(() => { const a = document.querySelector('main aside'); if (!a) return null; const r = a.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, below: r.top > innerHeight }; })()`);
    R.check(inView && !inView.below, { page: PG, control: "Tap a goal row (touch)", expected: "Tapping a goal shows its details where the person can see them", actual: `Aside now says "${selName}" but it sits at y=${inView && inView.top} (screen height ${inView && inView.vh}): details are far below the list, so a tap appears to do nothing`, evidence: await L.SHOT(S, "goals-phone-row-tapped"), impact: "usability", repro: "Tap a row at 390px; nothing visible changes above the fold." });
    // sheet on phone
    await L.tapEl(S, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '+ Create Goal' && b.getBoundingClientRect().width > 1)`);
    await S.waitFor(`!!${DLG}`, 8000).catch(() => {}); await sleep(500);
    const sheet = await S.evaluate(`(() => { const d = ${DLG}; if (!d) return null; const r = d.getBoundingClientRect(); const sv = [...d.querySelectorAll('button')].find((b) => /Save Goal/.test(b.textContent)).getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, saveBottom: Math.round(sv.bottom), saveTop: Math.round(sv.top), w: Math.round(r.width) }; })()`);
    const shotS = await L.SHOT(S, "goals-phone-sheet");
    R.check(sheet && sheet.top >= 0 && sheet.saveBottom <= sheet.vh, { page: PG, control: "Create Goal sheet on a phone", expected: "Whole sheet (all fields and Save Goal) visible without the keyboard", actual: sheet ? `sheet y ${sheet.top}-${sheet.bottom} of ${sheet.vh}; Save Goal y ${sheet.saveTop}-${sheet.saveBottom}; width ${sheet.w}` : "sheet did not open", evidence: shotS, impact: "usability", repro: "Tap + Create Goal at 390px." });
    // create by touch
    for (const [selJs, text] of [[`${DLG}.querySelectorAll('input[type=text]')[0]`, "QA Phone Goal"], [`${DLG}.querySelector('input[type=number]')`, "6"]]) { await L.tapEl(S, selJs); await sleep(200); await S.send("Input.insertText", { text }); await sleep(150); }
    await L.tapEl(S, `[...${DLG}.querySelectorAll('button')].find((b) => /Save Goal/.test(b.textContent))`);
    await S.waitFor(`!${DLG}`, 8000).catch(() => {}); await sleep(1500);
    const row = (await L.goalsDb(P)).find((g) => g.name === "QA Phone Goal");
    R.check(!!row && row.target_count === 6 && (await L.names(S)).includes("QA Phone Goal"), { page: PG, control: "Create a goal by touch (browser-emulated)", expected: "Goal saved to the account and listed", actual: `database: ${row ? JSON.stringify({ name: row.name, t: row.target_count }) : "none"}; listed: ${(await L.names(S)).includes("QA Phone Goal")}`, evidence: await L.SHOT(S, "goals-phone-created"), impact: "blocked workflow", repro: "Tap + Create Goal, type name and target, tap Save." });
    // delete by touch
    await L.tapEl(S, `[...document.querySelectorAll('main button')].filter((b) => b.querySelector('h2')).find((b) => b.querySelector('h2').textContent.trim() === 'QA Phone Goal')`); await sleep(400);
    await L.tapEl(S, `[...document.querySelectorAll('aside button')].find((b) => b.textContent.trim() === 'Delete goal')`); await sleep(1500);
    const gone = !(await L.goalsDb(P)).some((g) => g.name === "QA Phone Goal");
    R.check(gone, { page: PG, control: "Delete goal by touch (QA phone goal)", expected: "Selected goal deleted", actual: `deleted=${gone}`, evidence: "", impact: "usability", repro: "Tap row, scroll to the panel, tap Delete goal." });
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });

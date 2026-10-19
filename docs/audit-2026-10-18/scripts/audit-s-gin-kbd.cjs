// GIN keyboard checks on Goals: sheet focus handling, row selection by keyboard, sort menu by keyboard. Owner, Personal, desktop.
const L = require("./audit-s-gin-lib.cjs");
const { R, admin, sleep, man, clickEl } = L;
(async () => {
  const m = man(); const P = m.personalId, st = m.stamp; const now = Date.now();
  await L.seedGoals([
    { id: `qa_goal_${st}_kb_1`, name: "Complete the sports binder", target_count: 10, universe: "SPORTS", created_at: new Date(now - 1e8).toISOString() },
    { id: `qa_goal_${st}_kb_2`, name: "Complete the trading card binder", target_count: 4, universe: "TCG", created_at: new Date(now - 2e8).toISOString() },
    { id: `qa_goal_${st}_kb_3`, name: "Complete the music shelf", target_count: 20, universe: "MUSIC", created_at: new Date(now - 3e8).toISOString() },
  ]);
  const S = await L.session("owner");
  const DLG = `document.querySelector('[role=dialog][aria-label="Goal"]')`;
  const focusInfo = () => S.evaluate(`(() => { const a = document.activeElement; return { tag: a && a.tagName, label: a && (a.getAttribute('aria-label') || a.textContent.trim().slice(0, 30)), inDialog: !!(a && a.closest('[role=dialog]')) }; })()`);
  try {
    await L.gotoGoals(S);
    // open the sheet with the keyboard: focus the button, press Enter
    await S.evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '+ Create Goal' && b.getBoundingClientRect().width > 1).focus(); true`);
    await L.pressKey(S, "Enter", "Enter", 13); await sleep(800);
    const f1 = await focusInfo();
    R.check(f1.inDialog, { page: "/goals | owner, Personal", control: "Keyboard: Enter on '+ Create Goal' moves focus into the sheet", expected: "Focus is inside the dialog", actual: JSON.stringify(f1), evidence: "", impact: "usability", repro: "Focus + Create Goal, press Enter." });
    // Tab cycle stays inside the dialog
    let escaped = false; for (let i = 0; i < 12; i++) { await L.pressKey(S, "Tab", "Tab", 9); const f = await focusInfo(); if (!f.inDialog) { escaped = true; break; } }
    R.check(!escaped, { page: "/goals | owner, Personal", control: "Keyboard: Tab inside the open sheet (aria-modal)", expected: "Focus stays inside the sheet", actual: escaped ? "focus left the dialog within 12 Tab presses" : "stayed inside for 12 Tab presses", evidence: "", impact: "usability", repro: "Open sheet, press Tab repeatedly." });
    await L.pressKey(S, "Escape", "Escape", 27); await sleep(600);
    const f2 = await focusInfo();
    R.check(!(await S.evaluate(`!!${DLG}`)) && /Create Goal/.test(f2.label || ""), { page: "/goals | owner, Personal", control: "Keyboard: Escape closes the sheet and returns focus to '+ Create Goal'", expected: "Sheet closed, focus back on the opening button", actual: `dialog open=${await S.evaluate(`!!${DLG}`)}; focus ${JSON.stringify(f2)}`, evidence: "", impact: "usability", repro: "Open, press Escape." });
    // row by keyboard
    await S.evaluate(`[...document.querySelectorAll('main button')].filter((b) => b.querySelector('h2'))[1].focus(); true`);
    const name1 = await S.evaluate(`document.activeElement.querySelector('h2').textContent.trim()`);
    await L.pressKey(S, "Enter", "Enter", 13); await sleep(500);
    const asideName = (await L.asideText(S)).slice(0, 40);
    R.check(asideName.startsWith(name1), { page: "/goals | owner, Personal", control: "Keyboard: Enter on a goal row selects it", expected: `Side panel shows '${name1}'`, actual: asideName, evidence: "", impact: "usability", repro: "Tab to a row, press Enter." });
    // sort menu by keyboard
    await S.evaluate(`document.querySelector('[aria-label="Sort goals"]').focus(); true`);
    await L.pressKey(S, "Enter", "Enter", 13); await sleep(500);
    const opts = await S.evaluate(`[...document.querySelectorAll('[role=menu] button, [role=menuitem], [role=option]')].map((b) => b.textContent.trim())`);
    await L.pressKey(S, "ArrowDown", "ArrowDown", 40); await L.pressKey(S, "ArrowDown", "ArrowDown", 40); await L.pressKey(S, "Enter", "Enter", 13); await sleep(600);
    const sortLabel = L.squash(await S.evaluate(`document.querySelector('[aria-label="Sort goals"]').textContent`));
    R.check(opts.length >= 3 && sortLabel !== "Priority", { page: "/goals | owner, Personal", control: "Keyboard: Sort menu (Enter, arrow keys, Enter)", expected: "Menu opens, arrows move, Enter picks a different sort", actual: `options ${JSON.stringify(opts)}; sort shows '${sortLabel}'`, evidence: "", impact: "usability", repro: "Focus Sort goals, Enter, Down Down, Enter." });
    // filter pills pressed state
    await clickEl(S, L.FILTER("Completion"), { js: true }); await sleep(400);
    const pressed = await S.evaluate(`[...document.querySelectorAll('[role=group][aria-label="Goal types"] button')].map((b) => b.textContent.trim() + ':' + b.getAttribute('aria-pressed')).join(', ')`);
    R.check(/Completion:true/.test(pressed) && /All Goals:false/.test(pressed), { page: "/goals | owner, Personal", control: "Goal type filters expose their selected state (aria-pressed)", expected: "Selected filter reports pressed", actual: pressed, evidence: "", impact: "usability", repro: "Click Completion; inspect pressed state." });
  } finally { await S.close(); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });

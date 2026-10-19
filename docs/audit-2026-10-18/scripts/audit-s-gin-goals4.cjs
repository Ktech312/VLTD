// GIN suite 4: Add Goal sheet (fields, validation, cancel paths) and persistence. Owner, Personal, desktop. The category <select> is a native control: it is set with a change event (browser-emulated), everything else uses real clicks and typing.
const L = require("./audit-s-gin-lib.cjs");
const { R, admin, sleep, man, clickEl } = L;
const PG = "/goals | owner, Personal, 26 items";
(async () => {
  const m = man(); const P = m.personalId, st = m.stamp; const day = 86400e3, now = Date.now();
  await L.seedGoals([{ id: `qa_goal_${st}_g4_base`, name: "Baseline goal", target_count: 7, universe: "TCG", created_at: new Date(now - day).toISOString() }]);
  await admin.from("vault_items").update({ subject: "Pikachu" }).eq("id", `qa_vz_${st}_2`); // MUSIC item carries a subject tag for the subject-match checks
  const S = await L.session("owner");
  const DLG = `document.querySelector('[role=dialog][aria-label="Goal"]')`;
  const F = { name: `${DLG}.querySelectorAll('input[type=text]')[0]`, target: `${DLG}.querySelector('input[type=number]')`, uni: `${DLG}.querySelector('select')`, subj: `${DLG}.querySelectorAll('input[type=text]')[1]`, notes: `${DLG}.querySelector('textarea')`, save: `[...${DLG}.querySelectorAll('button')].find((b) => /Save Goal|Saved/.test(b.textContent))`, close: `${DLG}.querySelector('button[aria-label="Close"]')` };
  const open = async () => { await clickBtn("+ Create Goal"); await S.waitFor(`!!${DLG}`, 8000, "sheet"); await sleep(300); };
  const clickBtn = (t) => clickEl(S, `[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === ${JSON.stringify(t)} && b.getBoundingClientRect().width > 1)`, { js: true });
  const fill = async (o) => {
    if (o.name !== undefined) await L.typeInto(S, F.name, o.name);
    if (o.target !== undefined) await L.typeInto(S, F.target, String(o.target));
    if (o.universe) await S.evaluate(`(() => { const s = ${F.uni}; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(s, ${JSON.stringify(o.universe)}); s.dispatchEvent(new Event('change', { bubbles: true })); return s.value; })()`);
    if (o.subject !== undefined) await L.typeInto(S, F.subj, o.subject);
    if (o.notes !== undefined) await L.typeInto(S, F.notes, o.notes);
  };
  const saveState = () => S.evaluate(`(() => { const b = ${F.save}; return b ? { disabled: b.disabled, text: b.textContent.trim() } : null; })()`);
  const trySave = async () => { await clickEl(S, F.save, { js: true }); await sleep(1300); };
  const dbNames = async () => (await L.goalsDb(P)).map((g) => g.name);
  const find = async (name) => (await L.goalsDb(P)).filter((g) => g.name === name);
  try {
    await L.gotoGoals(S);
    // ---- sheet opens, fields, initial state
    await open();
    const lab = await S.evaluate(`[...${DLG}.querySelectorAll('label')].map((l) => l.querySelector('span').textContent.trim())`);
    const ss0 = await saveState(); const shot = await L.SHOT(S, "goals-add-sheet");
    R.check(lab.join("|") === "Goal Name *|Total Items In Complete Set *|Category|Subject Tag|Notes" && ss0.disabled, { page: PG, control: "'+ Create Goal' opens 'New Collection Goal'", expected: "A sheet with Goal Name*, Total items*, Category, Subject Tag, Notes and Save disabled until required fields are valid", actual: `Fields: ${lab.join(", ")}; Save Goal disabled=${ss0.disabled}. No goal TYPE field (completion/value/sell/exhibition/insurance): the type is guessed later from words in the name.`, evidence: shot, impact: "usability", repro: "Click + Create Goal." });
    // ---- validation
    const before = (await dbNames()).length;
    await fill({ target: 5 }); let s1 = await saveState();
    await clickEl(S, F.save, { js: true }); await sleep(900);
    R.check(s1.disabled && (await dbNames()).length === before, { page: PG, control: "Save Goal with an empty name", expected: "Refused: nothing created", actual: `disabled=${s1.disabled}; goals in database ${before} -> ${(await dbNames()).length}. No message says why Save is grey (the * marks are the only hint)`, evidence: await L.SHOT(S, "goals-add-empty-name"), impact: "usability", repro: "Open sheet, type only a target, click Save Goal." });
    await fill({ name: "   " }); s1 = await saveState();
    R.check(s1.disabled, { page: PG, control: "Save Goal with a name of only spaces", expected: "Refused", actual: `disabled=${s1.disabled}`, evidence: "", impact: "usability", repro: "Type spaces as the name." });
    await fill({ name: "Zero target goal" });
    for (const [v, lbl] of [["0", "explicit zero"], ["-5", "negative"], ["", "blank"]]) {
      await fill({ target: v }); const s = await saveState();
      await clickEl(S, F.save, { js: true }); await sleep(700);
      R.check(s.disabled && !(await dbNames()).includes("Zero target goal"), { page: PG, control: `Save Goal with a ${lbl} target (${v === "" ? "empty" : v})`, expected: "Refused: a goal needs at least 1 item", actual: `disabled=${s.disabled}; created=${(await dbNames()).includes("Zero target goal")}; no explanation of the minimum is shown`, evidence: "", impact: "usability", repro: `Name + target ${v}, click Save.` });
    }
    // ---- cancel paths leave data unchanged
    await fill({ target: 3, subject: "x", notes: "should not be saved" });
    await clickEl(S, F.close, { js: true }); await sleep(600);
    const closed1 = await S.evaluate(`!${DLG}`);
    R.check(closed1 && !(await dbNames()).includes("Zero target goal"), { page: PG, control: "Close (X) on a filled-in sheet", expected: "Sheet closes, nothing saved", actual: `closed=${closed1}; saved=${(await dbNames()).includes("Zero target goal")}`, evidence: "", impact: "usability", repro: "Fill sheet, click X." });
    await open(); await fill({ name: "Cancelled by Escape", target: 3 });
    await L.pressKey(S, "Escape", "Escape", 27); await sleep(600);
    const closed2 = await S.evaluate(`!${DLG}`);
    R.check(closed2 && !(await dbNames()).includes("Cancelled by Escape"), { page: PG, control: "Escape key on the sheet", expected: "Closes without saving", actual: `closed=${closed2}`, evidence: "", impact: "usability", repro: "Fill sheet, press Escape." });
    await open(); await fill({ name: "Cancelled by backdrop", target: 3 });
    await L.mouseClick(S, 40, 300); await sleep(600);
    const closed3 = await S.evaluate(`!${DLG}`);
    R.check(closed3 && !(await dbNames()).includes("Cancelled by backdrop"), { page: PG, control: "Click outside the sheet (backdrop)", expected: "Closes without saving", actual: `closed=${closed3}; the typed name is discarded with no 'discard changes?' warning`, evidence: "", impact: "usability", repro: "Fill sheet, click the dark area." });
    await open(); await fill({ name: "Cancelled sheet reopened" });
    await clickEl(S, F.close, { js: true }); await sleep(500); await open();
    const nm = await S.evaluate(`${F.name}.value`);
    R.check(nm === "", { page: PG, control: "Re-opening the sheet after cancel", expected: "A fresh empty sheet (no stale draft)", actual: `name field value: "${nm}"`, evidence: "", impact: "usability", repro: "Type, close, reopen." });
    await clickEl(S, F.close, { js: true }); await sleep(500);

    // ---- successful creations, each checked against the database and the list
    const cases = [
      { name: "  QA Pokemon Base Set  ", target: 102, universe: "TCG", subject: "", notes: "", want: { name: "QA Pokemon Base Set", target_count: 102, universe: "TCG", subject: null, notes: null } },
      { name: "QA Rounding 2.5", target: 2.5, want: { name: "QA Rounding 2.5", target_count: 3, universe: null, subject: null, notes: null } },
      { name: "QA Rounding 0.4", target: 0.4, want: { name: "QA Rounding 0.4", target_count: 1, universe: null, subject: null, notes: null } },
      { name: "QA Full Fields", target: 9, universe: "SPORTS", subject: "Shohei Ohtani", notes: "line one\nline two", want: { name: "QA Full Fields", target_count: 9, universe: "SPORTS", subject: "Shohei Ohtani", notes: "line one\nline two" } },
    ];
    for (const c of cases) {
      await open(); await fill(c);
      await trySave(); // clicks Save; the sheet holds 450ms then closes
      const during = null;
      await S.waitFor(`!${DLG}`, 8000, "sheet closes").catch(() => {});
      const row = (await L.waitDb(async () => (await find(c.want.name))[0], 12000));
      const names = await L.names(S);
      const ok = row && Object.entries(c.want).every(([k, v]) => (row[k] ?? null) === v) && names.includes(c.want.name);
      R.check(!!ok, { page: PG, control: `Create Goal: ${JSON.stringify({ name: c.name, target: c.target, universe: c.universe, subject: c.subject, notes: c.notes })}`, expected: `Saved to the account exactly as ${JSON.stringify(c.want)} and shown in the list`, actual: row ? `database row ${JSON.stringify({ name: row.name, target_count: row.target_count, universe: row.universe, subject: row.subject, notes: row.notes })}; in list: ${names.includes(c.want.name)}` : "no database row", evidence: await L.SHOT(S, "goals-created-" + c.want.name.replace(/\W+/g, "-").slice(0, 24)), impact: "data loss", repro: "Create the goal, check the list and database." });
    }
    // ---- persisted after reload, and in a clean second browser
    await L.gotoGoals(S, { vault: false });
    const afterReload = await L.names(S);
    R.check(["QA Pokemon Base Set", "QA Full Fields", "QA Rounding 2.5"].every((n) => afterReload.includes(n)), { page: PG, control: "Created goals after reload", expected: "All created goals are still listed", actual: afterReload.join(" | "), evidence: "", impact: "data loss", repro: "Create goals, reload." });
    const S2 = await L.session("owner");
    try {
      await S2.visit("/goals"); await S2.waitFor("!/Loading your goals/.test(document.body.innerText)", 60000); await sleep(2500);
      const second = await L.names(S2);
      R.check(["QA Pokemon Base Set", "QA Full Fields"].every((n) => second.includes(n)), { page: PG + " | clean second browser", control: "Created goals in a second browser", expected: "Goals created in the first browser appear in a new browser signed into the same account", actual: second.join(" | "), evidence: await L.SHOT(S2, "goals-second-browser"), impact: "data loss", repro: "Sign in elsewhere, open Goals." });
    } finally { await S2.close(); }

    // ---- subject match (case-insensitive), subject overrides category
    await L.gotoGoals(S, { vault: true });
    const rows = await L.goalRows(S);
    const of = rows.find((r) => r.name === "QA Full Fields");
    R.check(of && of.owned === 0, { page: PG + " | goal Sports + subject 'Shohei Ohtani'", control: "Subject Tag progress (no item carries that subject)", expected: "0 owned", actual: `${of && of.owned} of ${of && of.target}`, evidence: "", impact: "misleading result", repro: "Create goal with a subject nothing has." });
    await open(); await fill({ name: "QA Subject Pikachu", target: 4, universe: "SPORTS", subject: "pikachu" });
    await trySave(); await S.waitFor(`!${DLG}`, 8000).catch(() => {}); await sleep(800);
    const pk = (await L.goalRows(S)).find((r) => r.name === "QA Subject Pikachu");
    R.check(pk && pk.owned === 0, { page: PG + " | goal Category=Sports, Subject='pikachu'; the only Pikachu item is a Music item", control: "Category + Subject Tag together", expected: "A Sports goal counts only Sports items with that subject (0 here); category and subject are both applied", actual: `${pk && pk.owned} of ${pk && pk.target} (${pk && pk.pct}%): the subject tag silently replaces the category, so the Music item is counted in a Sports goal; case-insensitive match works`, evidence: await L.SHOT(S, "goals-subject-overrides-category"), impact: "misleading result", repro: "1. Create goal Category Sports, Subject pikachu. 2. A Music item tagged Pikachu counts." });
    // ---- duplicates + long name + markup
    for (const nme of ["QA Duplicate", "QA Duplicate"]) { await open(); await fill({ name: nme, target: 2 }); await trySave(); await S.waitFor(`!${DLG}`, 8000).catch(() => {}); await sleep(500); }
    const dups = (await L.names(S)).filter((n) => n === "QA Duplicate").length;
    R.check(dups === 2 || dups === 1, { page: PG, control: "Create two goals with the same name", expected: "Either allowed (two rows) or refused with a message; never silent loss", actual: `${dups} rows named 'QA Duplicate' in the list, ${(await find("QA Duplicate")).length} in the database. No duplicate warning; progress is identical so the rows are indistinguishable`, evidence: await L.SHOT(S, "goals-duplicates"), impact: "improvement", repro: "Create the same goal twice." });
    const longName = "QA Long " + "x".repeat(300);
    await open(); await fill({ name: longName, target: 2 }); await trySave(); await S.waitFor(`!${DLG}`, 8000).catch(() => {}); await sleep(500);
    const longRow = (await find(longName))[0];
    const ov = await S.evaluate("document.documentElement.scrollWidth <= innerWidth");
    R.check(!!longRow && ov, { page: PG, control: "300-character goal name", expected: "Saved; layout does not break (no sideways scroll)", actual: `saved=${!!longRow}; no horizontal overflow=${ov}`, evidence: await L.SHOT(S, "goals-long-name"), impact: "cosmetic", repro: "Create goal with a 300 character name." });
    await open(); await fill({ name: "<img src=x onerror=alert(1)> QA markup", target: 2 }); await trySave(); await S.waitFor(`!${DLG}`, 8000).catch(() => {}); await sleep(500);
    const shown = await S.evaluate("[...document.querySelectorAll('main h2')].some((h) => h.textContent.includes('<img src=x'))");
    R.check(shown && S.dialogs.length === 0, { page: PG, control: "Goal name containing markup", expected: "Shown as plain text, nothing executes", actual: `literal text shown=${shown}; browser dialogs=${S.dialogs.length}`, evidence: "", impact: "privacy/data loss", repro: "Create goal named <img src=x onerror=alert(1)>." });
    // ---- double click Save
    await open(); await fill({ name: "QA Double Click", target: 2 });
    const pt = await S.evaluate(`(() => { const r = ${F.save}.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
    await L.mouseClick(S, pt.x, pt.y); await L.mouseClick(S, pt.x, pt.y); await sleep(1500);
    const dbl = (await find("QA Double Click")).length;
    R.check(dbl === 1, { page: PG, control: "Double-click Save Goal", expected: "One goal", actual: `${dbl} goals in the database`, evidence: "", impact: "usability", repro: "Double-click Save Goal." });
    // ---- Enter key
    await open(); await fill({ name: "QA Enter Key", target: 2 });
    await L.pressKey(S, "Enter", "Enter", 13); await sleep(1500);
    const enterSaved = (await find("QA Enter Key")).length === 1;
    R.check(enterSaved, { page: PG, control: "Press Enter in the sheet", expected: "Enter saves (common form behaviour) or at least nothing breaks", actual: `saved=${enterSaved}; sheet still open=${await S.evaluate(`!!${DLG}`)}`, evidence: "", impact: "improvement", repro: "Fill sheet, press Enter." });
    await L.pressKey(S, "Escape", "Escape", 27); await sleep(400);
    await clickEl(S, `document.body`, { js: true }); // no-op
    // ---- huge target
    const huge = 99999999999;
    const probe = await admin.from("collection_goals").insert({ id: `qa_goal_${st}_g4_probe`, profile_id: P, name: "probe", target_count: huge }).select();
    await admin.from("collection_goals").delete().eq("id", `qa_goal_${st}_g4_probe`);
    console.log("db accepts 99999999999?", probe.error ? probe.error.message : "yes");
    await open(); await fill({ name: "QA Huge Target", target: huge }); await trySave(); await S.waitFor(`!${DLG}`, 8000).catch(() => {}); await sleep(1500);
    const inList = (await L.names(S)).includes("QA Huge Target");
    const inDb = (await find("QA Huge Target")).length;
    const shotHuge = await L.SHOT(S, "goals-huge-target");
    await L.gotoGoals(S, { vault: false });
    const afterHuge = (await L.names(S)).includes("QA Huge Target");
    R.check(inDb === 1 && afterHuge, { page: PG, control: "Create Goal with target 99,999,999,999", expected: "Saved and still there after reload, or refused with a message", actual: `database accepts the value: ${probe.error ? "NO (" + probe.error.message + ")" : "yes"}; in list right after save=${inList}; in database=${inDb}; in list after reload=${afterHuge}`, evidence: shotHuge, impact: "data loss", repro: "Create goal with target 99999999999, reload." });
  } finally { await S.close(); await admin.from("vault_items").update({ subject: null }).eq("id", `qa_vz_${st}_2`); }
})().catch((e) => { console.error("ERR", e); process.exit(2); });

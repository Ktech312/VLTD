// D-03, D-04, D-05 (Goals) on PRODUCTION, synthetic fixture.
//   AUDIT_MANIFEST=<manifest> node rb6-goals.cjs <label>
const L = require("./rb6-lib.cjs");
const { r, admin, sleep, man, session, body, click, typeInto, poll, btn, blockTables, lostAnswer, endLostAnswer, refuseWrites, endRefuse, shot, save } = L;
const LABEL = process.argv[2] || "run";
const out = { label: LABEL, fixtureOnly: true, cases: [] };
const NAMES = `[...document.querySelectorAll('main button')].filter((b) => b.querySelector('h2')).map((b) => b.querySelector('h2').textContent.trim())`;
const DLG = `document.querySelector('[role=dialog][aria-label="Goal"]')`;

(async () => {
  const m = man(); const P = m.personalId; const B = m.businessId; const st = m.stamp;
  const dbGoals = async (name) => (await admin.from("collection_goals").select("id,name,target_count,profile_id").eq("profile_id", P).eq("name", name)).data || [];
  const created = new Set();
  const open = async (S) => { await S.visit("/goals"); await S.waitFor(`document.body.innerText.length > 300`, 60000, "goals").catch(() => {}); await sleep(3500); };
  const names = (S) => S.evaluate(NAMES);
  const openSheet = async (S) => { await click(S, btn(/\+ Create Goal/)); await S.waitFor(`!!${DLG}`, 8000, "sheet").catch(() => {}); await sleep(600); };
  const fill = async (S, name, target) => { await typeInto(S, `${DLG}.querySelector('input[type=text]')`, name); await typeInto(S, `${DLG}.querySelector('input[type=number]')`, String(target)); await sleep(300); };
  const saveBtn = `(${DLG} ? [...${DLG}.querySelectorAll('button')].find((b) => /^(Save Goal|Saving|Saved)/.test(b.textContent.trim())) : null)`;
  const sheetState = (S) => S.evaluate(`(() => { const d = ${DLG}; if (!d) return { open: false }; return { open: true, name: d.querySelector('input[type=text]').value, target: d.querySelector('input[type=number]').value, error: (d.querySelector('[data-testid=goal-error]') || {}).innerText || '', button: ${saveBtn}.textContent.trim() }; })()`);
  const waiting = (S) => S.evaluate(`(document.querySelector('[data-testid=goals-waiting]') || {}).innerText || ''`);
  const toasts = async (S) => (await body(S)).match(/(Saved on this device[^.]*\.[^.]*\.|Deleted on this device[^.]*\.[^.]*\.|The goal was not (?:saved|deleted)[^.]*\.[^.]*\.)/)?.[0] || "";
  const track = async (name) => { for (const g of await dbGoals(name)) created.add(g.id); };
  const record = (c) => out.cases.push(c);
  // Messages and the sheet's button label change within seconds (the sheet closes itself): sample them while waiting.
  const MSG = /(Saved on this device[^.]*\.(?:[^.]*\.)?|Deleted on this device[^.]*\.(?:[^.]*\.)?|The goal was not (?:saved|deleted)[^.]*\.(?:[^.]*\.)?)/;
  const watch = async (S, ms) => {
    const seen = { buttons: new Set(), toasts: new Set() };
    for (let t = 0; t < ms; t += 300) {
      const b = await S.evaluate(`(() => { const d = ${DLG}; const bt = d ? [...d.querySelectorAll('button')].find((x) => /^(Save Goal|Saving|Saved)/.test(x.textContent.trim())) : null; return bt ? bt.textContent.trim() : ''; })()`).catch(() => "");
      if (b) seen.buttons.add(b);
      const m = (await body(S)).match(MSG); if (m) seen.toasts.add(m[0].trim());
      await sleep(300);
    }
    return { buttons: [...seen.buttons], toasts: [...seen.toasts] };
  };
  // start from a clean slate for this fixture (a failed earlier run may have left its own synthetic goals)
  for (const g of (await admin.from("collection_goals").select("id").like("name", "QA RB6 goal%").eq("profile_id", P)).data || []) await admin.from("collection_goals").delete().eq("id", g.id);

  // ------------------------------------------------------------ D-05 validation (form preserved, nothing stored)
  {
    const S = await session("owner", { width: 1440, height: 900 }); await open(S);
    const results = [];
    for (const [label, value] of [["99999999999", 99999999999], ["2147483648", 2147483648], ["2.5", 2.5], ["1e3", "1e3"], ["0", 0], ["-4", -4]]) {
      const name = `QA RB6 goal bad ${label}`;
      await openSheet(S); await fill(S, name, value);
      await click(S, saveBtn); await sleep(1500);
      const stt = await sheetState(S); const dbRows = await dbGoals(name); const inList = (await names(S)).includes(name);
      results.push({ label, error: stt.error, sheetOpen: stt.open, formKept: stt.open && stt.name === name && String(stt.target).length > 0, dbRows: dbRows.length, inList });
      await track(name);
      if (stt.open) await click(S, `${DLG}.querySelector('button[aria-label="Close"]')`); await sleep(600);
    }
    const okAll = results.every((x) => x.error && x.sheetOpen && x.formKept && x.dbRows === 0 && !x.inList);
    const sh = await shot(S, "goals-validation");
    record({ case: "D-05 invalid targets", results });
    r.check(okAll, { page: "/goals", control: "D-05 Create Goal with target 99,999,999,999 / 2,147,483,648 / 2.5 / 1e3 / 0 / -4", expected: "Each is refused with a plain message, the sheet stays open with the form as typed, nothing stored, nothing listed", actual: results.map((x) => `${x.label}: error "${(x.error || "").slice(0, 60)}", kept ${x.formKept}, db ${x.dbRows}, listed ${x.inList}`).join(" | "), evidence: sh, impact: "D-05 / GIN-066" });
    // the maximum is accepted
    const maxName = `QA RB6 goal max ${st}`;
    await openSheet(S); await fill(S, maxName, 2147483647); await click(S, saveBtn); await sleep(4000);
    const maxRows = await dbGoals(maxName); await track(maxName);
    r.check(maxRows.length === 1 && maxRows[0].target_count === 2147483647, { page: "/goals", control: "D-05 target exactly 2,147,483,647", expected: "Accepted and stored", actual: `db rows ${maxRows.length}, target ${maxRows[0]?.target_count}`, impact: "D-05" });
    await S.close();
  }

  // ------------------------------------------------------------ D-03 normal create (+ repeated clicks, reload, clean second browser)
  {
    const S = await session("owner", { width: 1440, height: 900 }); await open(S);
    const name = `QA RB6 goal normal ${st}`;
    await openSheet(S); await fill(S, name, 12);
    for (let i = 0; i < 3; i++) { await click(S, saveBtn); await sleep(100); }
    await sleep(3500);
    const rows = await dbGoals(name); await track(name);
    await open(S); const afterReload = (await names(S)).includes(name);
    const sh = await shot(S, "goals-create-normal");
    await S.close();
    const S2 = await session("owner", { width: 1440, height: 900 }); await open(S2); const second = (await names(S2)).includes(name); await S2.close();
    const Sb = await session("business", { width: 1440, height: 900 }); await open(Sb); const onBusiness = (await names(Sb)).includes(name); await Sb.close();
    record({ case: "create normal", dbRows: rows.length, afterReload, second, onBusiness });
    r.check(rows.length === 1 && rows[0].target_count === 12 && afterReload && second && !onBusiness, { page: "/goals", control: "D-03 Create Goal (3 rapid clicks)", expected: "One goal in the account; still there after reload and in a clean second browser; not visible in the Business profile", actual: `rows ${rows.length}; after reload ${afterReload}; second browser ${second}; Business profile lists it ${onBusiness}`, evidence: sh, impact: "D-03 / GIN-068" });
  }

  // ------------------------------------------------------------ D-03 account unreachable: kept, said, retried
  {
    const S = await session("owner", { width: 1440, height: 900 }); await open(S);
    const name = `QA RB6 goal offline ${st}`;
    await blockTables(S, ["collection_goals"], true);
    await openSheet(S); await fill(S, name, 9); await click(S, saveBtn); const seenOff = await watch(S, 4200);
    const stt = { button: seenOff.buttons.join(' | ') }; const tt = seenOff.toasts.join(' | '); const w1 = await waiting(S);
    await sleep(2500);
    const inList = (await names(S)).includes(name); const during = await dbGoals(name);
    const sh = await shot(S, "goals-create-offline");
    await S.visit("/goals"); await sleep(4000); // reload while still blocked
    const afterReloadBlocked = (await names(S)).includes(name); const w2 = await waiting(S);
    await blockTables(S, ["collection_goals"], false);
    await click(S, btn(/^Retry now$/)); await sleep(5000);
    const after = await dbGoals(name); await track(name); const w3 = await waiting(S);
    await open(S); const afterReload = (await names(S)).includes(name);
    await S.close();
    const S2 = await session("owner", { width: 1440, height: 900 }); await open(S2); const second = (await names(S2)).includes(name); await S2.close();
    const ok = (/Sync pending|saved on this device/i.test(stt.button + tt)) && inList && during.length === 0 && afterReloadBlocked && /Sync pending/.test(w1) && /Sync pending/.test(w2) && after.length === 1 && !w3 && afterReload && second;
    record({ case: "create while unreachable", sheetButton: stt.button, toast: tt, waitingNotice: w1, listed: inList, rowsWhileBlocked: during.length, afterReloadBlocked, afterRetryRows: after.length, noticeAfterRetry: w3, second });
    r.check(ok, { page: "/goals", control: "D-03 Create Goal while the account is unreachable (collection_goals blocked: SIMULATED)", expected: "Says saved on this device / sync pending (never plain Saved), goal stays listed and survives a reload, notice with Retry now; after the connection returns Retry now uploads it exactly once, notice clears, a clean browser sees it", actual: `button "${stt.button}"; toast "${tt}"; notice "${w1.slice(0, 80)}"; rows while blocked ${during.length}; after reload (blocked) listed ${afterReloadBlocked}; after retry rows ${after.length}, notice after "${w3}"; second browser ${second}`, evidence: sh, impact: "D-03 / GIN-068" });
  }

  // ------------------------------------------------------------ D-03 answer lost (the account applied it)
  {
    const S = await session("owner", { width: 1440, height: 900 }); await open(S);
    const name = `QA RB6 goal lost ${st}`;
    await lostAnswer(S, /collection_goals/, ["POST"], 1);
    await openSheet(S); await fill(S, name, 7); await click(S, saveBtn); const seenLost = await watch(S, 4500);
    const stt = { button: seenLost.buttons.join(' | ') }; const tt = seenLost.toasts.join(' | ');
    const during = await dbGoals(name); await track(name);
    await endLostAnswer(S);
    await open(S); await click(S, btn(/^Retry now$/)); await sleep(4500);
    const after = await dbGoals(name); const w = await waiting(S); const inList = (await names(S)).filter((n) => n === name).length;
    await S.close();
    record({ case: "create, answer lost", button: stt.button, toast: tt, rowsBeforeRetry: during.length, rowsAfterRetry: after.length, listedTimes: inList, noticeAfter: w });
    r.check((/Sync pending|saved on this device/i.test(stt.button + tt)) && after.length === 1 && inList === 1 && !w, { page: "/goals", control: "D-03 Create Goal, answer lost (SIMULATED connection reset after the account applied it)", expected: "Does not claim account-saved; after the retry exactly one goal (no duplicate), notice cleared", actual: `button "${stt.button}"; rows before retry ${during.length}, after ${after.length}; listed ${inList}x; notice "${w}"`, impact: "D-03" });
  }

  // ------------------------------------------------------------ D-03 refused: not kept, form preserved
  {
    const S = await session("owner", { width: 1440, height: 900 }); await open(S);
    const name = `QA RB6 goal refused ${st}`;
    await refuseWrites(S, /collection_goals/, ["POST", "PATCH"]);
    await openSheet(S); await fill(S, name, 5); await click(S, saveBtn); await sleep(3500);
    const stt = await sheetState(S); const inList = (await names(S)).includes(name); const rows = await dbGoals(name);
    const sh = await shot(S, "goals-create-refused");
    await endRefuse(S); await S.close();
    record({ case: "create refused", sheet: stt, listed: inList, rows: rows.length });
    r.check(stt.open && /not saved/i.test(stt.error) && stt.name === name && !inList && rows.length === 0, { page: "/goals", control: "D-03 Create Goal refused by the account (403: SIMULATED)", expected: "Message in the sheet, form kept as typed, nothing listed, nothing stored", actual: `open ${stt.open}; error "${(stt.error || "").slice(0, 90)}"; name kept ${stt.name === name}; listed ${inList}; rows ${rows.length}`, evidence: sh, impact: "D-03" });
  }

  // ------------------------------------------------------------ D-04 delete: normal
  const mkGoal = async (name, target = 4) => { const id = `qa_goal_${st}_${name.replace(/\W+/g, "").slice(-12)}`; await admin.from("collection_goals").upsert({ id, profile_id: P, name, target_count: target, created_at: new Date().toISOString() }); created.add(id); return id; };
  const selectGoal = (S, name) => click(S, `[...document.querySelectorAll('main button')].find((b) => b.querySelector('h2') && b.querySelector('h2').textContent.trim() === ${JSON.stringify(name)})`);
  {
    const name = `QA RB6 goal delete ${st}`; const id = await mkGoal(name);
    const S = await session("owner", { width: 1440, height: 900 }); await open(S);
    await selectGoal(S, name); await sleep(900); await click(S, btn(/^Delete goal$/)); await sleep(3500);
    const rows = await dbGoals(name); const listed = (await names(S)).includes(name);
    await open(S); const afterReload = (await names(S)).includes(name);
    await S.close();
    const S2 = await session("owner", { width: 1440, height: 900 }); await open(S2); const second = (await names(S2)).includes(name); await S2.close();
    record({ case: "delete normal", rows: rows.length, listed, afterReload, second });
    r.check(rows.length === 0 && !listed && !afterReload && !second, { page: "/goals", control: "D-04 Delete goal", expected: "Gone from the account, the list, after reload and in a clean second browser", actual: `rows ${rows.length}; listed ${listed}; after reload ${afterReload}; second browser ${second}`, impact: "D-04 / GIN-070" });
    created.delete(id);
  }
  // ------------------------------------------------------------ D-04 delete while unreachable: hidden, remembered, retried, never silently back
  {
    const name = `QA RB6 goal delete offline ${st}`; const id = await mkGoal(name);
    const S = await session("owner", { width: 1440, height: 900 }); await open(S);
    await blockTables(S, ["collection_goals"], true);
    await selectGoal(S, name); await sleep(900); await click(S, btn(/^Delete goal$/)); const seenDel = await watch(S, 3800);
    const tt = seenDel.toasts.join(' | '); const w1 = await waiting(S); const listed = (await names(S)).includes(name); const during = await dbGoals(name);
    const sh = await shot(S, "goals-delete-offline");
    await S.visit("/goals"); await sleep(4500); // reload while blocked: must NOT reappear silently
    const afterReloadBlocked = (await names(S)).includes(name); const w2 = await waiting(S);
    await blockTables(S, ["collection_goals"], false);
    await click(S, btn(/^Retry now$/)); await sleep(5000);
    const after = await dbGoals(name); const w3 = await waiting(S);
    await open(S); const finalListed = (await names(S)).includes(name);
    await S.close();
    const S2 = await session("owner", { width: 1440, height: 900 }); await open(S2); const second = (await names(S2)).includes(name); await S2.close();
    const ok = /Sync pending|on this device/i.test(tt + w1) && !listed && during.length === 1 && !afterReloadBlocked && /Sync pending/.test(w1 + w2) && after.length === 0 && !w3 && !finalListed && !second;
    record({ case: "delete while unreachable", toast: tt, notice: w1, listedAfterDelete: listed, rowStillInAccountWhileBlocked: during.length, reappearedAfterReloadBlocked: afterReloadBlocked, rowsAfterRetry: after.length, noticeAfterRetry: w3, finalListed, second });
    r.check(ok, { page: "/goals", control: "D-04 Delete goal while the account is unreachable (collection_goals blocked: SIMULATED)", expected: "Removed here with a sync-pending message and notice; does not silently reappear after a reload; Retry now deletes it in the account; gone for good, also in a clean browser", actual: `toast "${tt}"; notice "${(w1 || w2).slice(0, 80)}"; row in account while blocked ${during.length}; back after reload while blocked ${afterReloadBlocked}; rows after retry ${after.length}; notice after "${w3}"; final listed ${finalListed}; second browser ${second}`, evidence: sh, impact: "D-04 / GIN-070" });
    created.delete(id); await admin.from("collection_goals").delete().eq("id", id);
  }
  // ------------------------------------------------------------ D-04 delete refused: back in the list with a message
  {
    const name = `QA RB6 goal delete refused ${st}`; const id = await mkGoal(name);
    const S = await session("owner", { width: 1440, height: 900 }); await open(S);
    await refuseWrites(S, /collection_goals/, ["DELETE"]);
    await selectGoal(S, name); await sleep(900); await click(S, btn(/^Delete goal$/)); const seenRef = await watch(S, 4500);
    const tt = seenRef.toasts.find((x) => /not deleted/.test(x)) || ""; const listed = (await names(S)).includes(name); const rows = await dbGoals(name);
    const sh = await shot(S, "goals-delete-refused");
    await endRefuse(S); await open(S); const afterReload = (await names(S)).includes(name);
    await S.close();
    record({ case: "delete refused", toast: tt, listed, rows: rows.length, afterReload });
    r.check(/not deleted/.test(tt) && listed && rows.length === 1 && afterReload, { page: "/goals", control: "D-04 Delete goal refused by the account (403: SIMULATED)", expected: "Message shown, the goal is back in the list and stays after reload, still in the account", actual: `toast "${tt.slice(0, 100)}"; listed ${listed}; rows ${rows.length}; after reload ${afterReload}`, evidence: sh, impact: "D-04" });
    await admin.from("collection_goals").delete().eq("id", id); created.delete(id);
  }
  // cleanup (exact ids of this run)
  for (const id of created) await admin.from("collection_goals").delete().eq("id", id).eq("profile_id", P);
  const left = (await admin.from("collection_goals").select("id").like("name", "QA RB6 goal%").eq("profile_id", P)).data || [];
  for (const g of left) await admin.from("collection_goals").delete().eq("id", g.id);
  save(`rb6-goals-${LABEL}`, out); console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(2); });

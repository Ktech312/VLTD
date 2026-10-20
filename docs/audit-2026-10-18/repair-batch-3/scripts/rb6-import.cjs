// D-06 (import Undo) and D-07 (skip existing titles) on PRODUCTION, synthetic fixture.
//   AUDIT_MANIFEST=<manifest> node rb6-import.cjs <label> [only=d06|d07]
const L = require("./rb6-lib.cjs");
const { r, admin, sleep, man, fs, session, body, click, poll, btn, blockTables, refuseWrites, endRefuse, shot, save, T } = L;
const LABEL = process.argv[2] || "run";
const ONLY = process.argv[3] || "";
const out = { label: LABEL, fixtureOnly: true, d06: [], d07: [] };
const PFX = "QA RB6 imp";

(async () => {
  const m = man(); const P = m.personalId; const B = m.businessId; const st = m.stamp;
  const rowsOf = async (prefix) => (await admin.from("vault_items").select("id,title,profile_id,purchase_price").eq("profile_id", P).like("title", prefix + "%")).data || [];
  const count = async (title) => (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", P).eq("title", title)).count || 0;
  const csv = (name, titles) => { fs.writeFileSync(T.tmp(name), "Name,Purchase Price,Notes\n" + titles.map((t, i) => `${t},${5 + i},rb6 note`).join("\n") + "\n"); return T.tmp(name); };
  const openImport = async (S) => { await S.visit("/vault/import"); await S.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Upload Spreadsheet')`, 60000, "import").catch(() => {}); await sleep(3500); };
  const load = async (S, file, n) => { await T.chooseViaButton(S, T.btnExpr("^Upload Spreadsheet$"), file); await S.waitFor(`/Parsed ${n} item/.test(document.body.innerText)`, 25000, "parsed").catch(() => {}); await sleep(1000); };
  const mode = (S, re) => click(S, `[...document.querySelectorAll('label')].find((l) => ${re}.test(l.textContent))`);
  const confirmImport = async (S) => { for (let k = 0; k < 2; k++) { await click(S, btn(/Confirm Import/)); await sleep(2500); } await sleep(2500); };
  const said = async (S) => (await body(S)).match(/(Imported|Undid|Removed|Nothing|No import)[^]*?(?= Review newest| Import All| Skip exact|$)/)?.[0]?.slice(0, 420) || "";
  const STATUS_RE = '^(Imported|Undid|Removed|Nothing parsed|No import history to undo|Review the import summary|Import failed|Import verification)';
  const statusNow = (S) => S.evaluate(`(() => { const e = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && new RegExp(${JSON.stringify(STATUS_RE)}).test((d.textContent || '').trim())); return e ? e.textContent.trim() : ''; })()`);
  // the status line changes with each step: wait briefly for one that differs from `previous`
  // the result of an import that first re-checks an unreachable account can take a minute: wait for the RESULT line, not the confirm prompt
  const resultStatus = async (S, notIn, ms = 120000) => { let t = ''; for (let k = 0; k < ms / 500; k++) { t = await statusNow(S); if (/^(Imported|Nothing parsed|Import failed|Import verification)/.test(t) && !notIn.includes(t)) return t; await sleep(500); } return t; };
  let lastStatus = '';
  const statusLine = async (S, previous = lastStatus) => { let t = ''; for (let k = 0; k < 24; k++) { t = await statusNow(S); if (t && t !== previous) { lastStatus = t; return t; } await sleep(500); } lastStatus = t; return t; };
  const created = [];

  if (!ONLY || ONLY === "d07") {
    // ---- D-07 a: clean second browser, existing title skipped, "Recent vault items" filled from the account
    {
      const existing = "QA Album 2 - Original Motion Picture Soundtrack"; const fresh = `${PFX} d07 new ${st}`;
      const before = await count(existing);
      const S = await session("owner", { width: 1440, height: 900 });
      await openImport(S);
      const recentText = (await body(S)).match(/RECENT VAULT ITEMS[^]{0,160}/i)?.[0] || "";
      const file = csv("rb6-d07a.csv", [existing, fresh]);
      await load(S, file, 2); await mode(S, "/Skip exact titles already in vault/"); await sleep(400);
      await confirmImport(S);
      const msg = await statusLine(S);
      await poll(async () => (await count(fresh)) > 0, 60000, 3000);
      await sleep(8000);
      const afterExisting = await count(existing), afterFresh = await count(fresh);
      (await rowsOf(PFX)).forEach((x) => created.push(x.id));
      const sh = await shot(S, "d07-clean-browser"); await S.close();
      const ok = afterExisting === before && afterFresh === 1 && /Skipped 1 exact duplicate/.test(msg) && !/Vault is empty/i.test(recentText);
      out.d07.push({ case: "clean browser skip existing", before, afterExisting, afterFresh, msg, recentText: recentText.slice(0, 120) });
      r.check(ok, { page: "/vault/import", control: "D-07 Skip exact titles already in vault, clean second browser (existing title + a new one)", expected: "The existing title is skipped (no second copy after 60 s), the new one is imported once, 'Recent vault items' is not 'Vault is empty'", actual: `copies of existing before ${before} / after ${afterExisting}; new ${afterFresh}; message "${msg.slice(0, 160)}"; recent list "${recentText.slice(0, 80)}"`, evidence: sh, impact: "D-07 / ADD-365, ADD-267, ADD-272" });
    }
    // ---- D-07 b: the account cannot be read: say so, never treat it as empty
    {
      const existing = "QA Album 3 - Original Motion Picture Soundtrack";
      const before = await count(existing);
      const S = await session("owner", { width: 1440, height: 900 });
      await blockTables(S, ["vault_items"], true);
      await openImport(S);
      let banner = ''; for (let k = 0; k < 90 && !banner; k++) { banner = await S.evaluate(`(document.querySelector('[data-testid=account-check-failed]') || {}).innerText || ''`); if (!banner) await sleep(500); }
      await load(S, csv("rb6-d07b.csv", [existing]), 1); await mode(S, "/Skip exact titles already in vault/"); await sleep(400);
      await click(S, btn(/Confirm Import/)); await sleep(1500);
      const firstConfirm = await statusLine(S);
      await click(S, btn(/Confirm Import/)); await sleep(1000);
      const final = await resultStatus(S, [firstConfirm]);
      const sh = await shot(S, "d07-account-unreadable");
      await blockTables(S, ["vault_items"], false);
      await sleep(6000);
      const afterRows = await poll(async () => ((await count(existing)) > before ? true : null), 90000, 3000);
      const after = await count(existing);
      (await rowsOf(PFX)).forEach((x) => created.push(x.id));
      // the extra copy this test deliberately allowed is removed by exact id below
      const extra = (await admin.from("vault_items").select("id,created_at").eq("profile_id", P).eq("title", existing).order("created_at", { ascending: false })).data || [];
      if (extra.length > before) created.push(extra[0].id);
      await S.close();
      const ok = /could not be checked/.test(banner) && /could not be checked|incomplete/.test(firstConfirm) && /Duplicate check incomplete/.test(final);
      out.d07.push({ case: "account unreadable", banner, firstConfirm, final, copiesBefore: before, copiesAfter: after, uploaded: !!afterRows });
      r.check(ok, { page: "/vault/import", control: "D-07 Skip exact titles while the account cannot be read (vault_items blocked: SIMULATED)", expected: "A banner says duplicate detection is incomplete; the confirm step and the result say so (not 'skipped' or silence); the account is never treated as empty without saying", actual: `banner "${banner.slice(0, 110)}"; confirm "${firstConfirm.slice(0, 120)}"; result "${final.slice(0, 160)}"`, evidence: sh, impact: "D-07 / ADD-365" });
    }
    // ---- D-07 c: items added here but not uploaded yet count as existing
    {
      const t = `${PFX} d07 pending ${st}`;
      const S = await session("owner", { width: 1440, height: 900 });
      await openImport(S);
      await blockTables(S, ["vault_items"], true);
      await load(S, csv("rb6-d07c1.csv", [t]), 1); await mode(S, "/Import all parsed rows/"); await sleep(300); await confirmImport(S);
      const first = await statusLine(S);
      await load(S, csv("rb6-d07c2.csv", [t]), 1); await mode(S, "/Skip exact titles already in vault/"); await sleep(300); await click(S, btn(/Confirm Import/)); await sleep(1500); await click(S, btn(/Confirm Import/)); await sleep(1000);
      const second = await resultStatus(S, [first, 'Review the import summary, then click Confirm Import again.']);
      await blockTables(S, ["vault_items"], false);
      await S.visit("/vault"); await sleep(6000);
      await poll(async () => ((await count(t)) >= 1 ? true : null), 90000, 3000); await sleep(8000);
      const copies = await count(t);
      (await rowsOf(PFX)).forEach((x) => created.push(x.id));
      await S.close();
      const ok = /Imported 1 item/.test(first) && /Skipped 1 exact duplicate/.test(second) && copies === 1;
      out.d07.push({ case: "pending local additions", first, second, copiesInAccount: copies });
      r.check(ok, { page: "/vault/import", control: "D-07 an item imported here but not yet uploaded, then the same title with 'Skip exact titles' (account unreachable: SIMULATED)", expected: "The not-yet-uploaded copy counts as existing: the second import skips it; after the connection returns the account holds exactly one copy", actual: `first "${first.slice(0, 80)}"; second "${second.slice(0, 120)}"; copies in account ${copies}`, impact: "D-07" });
    }
  }

  if (!ONLY || ONLY === "d06") {
    const importAndUpload = async (S, tag, n) => {
      const titles = Array.from({ length: n }, (_, i) => `${PFX} ${tag} ${i + 1} ${st}`);
      await openImport(S); await load(S, csv(`rb6-${tag}.csv`, titles), n); await mode(S, "/Import all parsed rows/"); await sleep(300); await confirmImport(S);
      await poll(async () => ((await rowsOf(`${PFX} ${tag}`)).length >= n ? true : null), 90000, 3000);
      await sleep(4000);
      lastStatus = await statusNow(S);
      return titles;
    };
    const undoClick = async (S) => { await click(S, btn(/^Undo last$/)); await sleep(5000); };
    // ---- D-06 a: normal undo of uploaded items (+ a same-title item that was not imported stays), reload, clean browser
    {
      const S = await session("owner", { width: 1440, height: 900 });
      const titles = await importAndUpload(S, "u1", 2);
      // an item with the SAME title that this import did not create
      const sameId = `qa_rb6_${st}_same`; await admin.from("vault_items").insert({ id: sameId, profile_id: P, title: titles[0], status: "COLLECTION", universe: "POP_CULTURE", category: "comics", created_at: Date.now() }); created.push(sameId);
      const importedBefore = (await rowsOf(`${PFX} u1`)).filter((x) => x.id !== sameId).map((x) => x.id);
      await undoClick(S);
      const msg = await statusLine(S);
      const left = await poll(async () => { const rows = (await rowsOf(`${PFX} u1`)).filter((x) => importedBefore.includes(x.id)); return rows.length === 0 ? true : null; }, 30000, 2000);
      const sameStill = (await admin.from("vault_items").select("id").eq("id", sameId)).data?.length === 1;
      const sh = await shot(S, "d06-undo-normal");
      await openImport(S); const afterReload = (await body(S));
      await S.close();
      const S2 = await session("owner", { width: 1440, height: 900 });
      await S2.visit("/vault"); await S2.waitFor(`document.querySelectorAll('a[href^="/vault/item/"]').length > 3`, 90000, "vault").catch(() => {}); await sleep(3500);
      const second = (await body(S2)).includes(titles[1]);
      await S2.close();
      const ok = /Undid 2 of 2 items/.test(msg) && !!left && sameStill && !second;
      out.d06.push({ case: "normal undo", msg, rowsLeft: !left, sameTitleStillThere: sameStill, secondBrowserShowsImported: second });
      r.check(ok, { page: "/vault/import", control: "D-06 Undo last after the items reached the account (plus a same-title item the import did not create)", expected: "'Undid 2 of 2 items'; the 2 imported rows are gone from the account within 20 s and from a clean second browser; the same-title item that was not imported is untouched", actual: `message "${msg.slice(0, 100)}"; imported rows gone ${!!left}; same-title item still there ${sameStill}; clean browser still shows one ${second}`, evidence: sh, impact: "D-06 / ADD-357" });
    }
    // ---- D-06 b: an edited record is named first; keep it, remove the rest
    {
      const S = await session("owner", { width: 1440, height: 900 });
      const titles = await importAndUpload(S, "u2", 2);
      const rows = await rowsOf(`${PFX} u2`); const edited = rows.find((x) => x.title === titles[0]); const untouched = rows.find((x) => x.title === titles[1]);
      await admin.from("vault_items").update({ purchase_price: 999 }).eq("id", edited.id);
      await S.visit("/vault"); await S.waitFor(`document.querySelectorAll('a[href^="/vault/item/"]').length > 3`, 90000, "vault").catch(() => {}); await sleep(5000);
      await openImport(S); await click(S, btn(/^Undo last$/)); await sleep(2500);
      const prompt = await S.evaluate(`(document.querySelector('[data-testid=undo-prompt]') || {}).innerText || ''`);
      const shP = await shot(S, "d06-undo-prompt");
      await click(S, btn(/^Keep the changed ones, remove 1$/)); await sleep(6000);
      const msg = await statusLine(S);
      const e = (await admin.from("vault_items").select("id").eq("id", edited.id)).data?.length || 0; const u = (await admin.from("vault_items").select("id").eq("id", untouched.id)).data?.length || 0;
      await S.close();
      const ok = /edited since the import/.test(prompt) && e === 1 && u === 0 && /1 you had changed was kept/.test(msg);
      out.d06.push({ case: "edited record flagged", prompt, msg, editedStillThere: e, untouchedStillThere: u });
      r.check(ok, { page: "/vault/import", control: "D-06 Undo last when one imported item was edited since", expected: "A prompt names the edited item before anything is removed; 'Keep the changed ones' removes only the untouched one and says one was kept", actual: `prompt "${prompt.slice(0, 160)}"; message "${msg.slice(0, 120)}"; edited still in account ${e}; untouched ${u}`, evidence: shP, impact: "D-06" });
    }
    // ---- D-06 c: partial failure is reported exactly; a second Undo finishes it
    {
      const S = await session("owner", { width: 1440, height: 900 });
      const titles = await importAndUpload(S, "u3", 2);
      const rows = await rowsOf(`${PFX} u3`); const keep = rows.find((x) => x.title === titles[0]); const gone = rows.find((x) => x.title === titles[1]);
      await refuseWrites(S, new RegExp(`vault_items.*id=eq\\.${keep.id}`), ["DELETE"]);
      await click(S, btn(/^Undo last$/)); await sleep(7000);
      const msg = await statusLine(S);
      const kStill = (await admin.from("vault_items").select("id").eq("id", keep.id)).data?.length || 0; const gStill = (await admin.from("vault_items").select("id").eq("id", gone.id)).data?.length || 0;
      const sh = await shot(S, "d06-undo-partial");
      const undoEnabled = await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Undo last'); return !!b && !b.disabled; })()`);
      await endRefuse(S);
      await click(S, btn(/^Undo last$/)); await sleep(6000);
      const msg2 = await statusLine(S);
      const kAfter = (await admin.from("vault_items").select("id").eq("id", keep.id)).data?.length || 0;
      await S.close();
      const ok = /Removed 1 of 2/.test(msg) && /could not be removed from your account/.test(msg) && kStill === 1 && gStill === 0 && undoEnabled && /Undid 1 of 1/.test(msg2) && kAfter === 0;
      out.d06.push({ case: "partial failure", msg, keptRefused: kStill, removed: gStill === 0, undoStillAvailable: undoEnabled, secondUndo: msg2, afterSecond: kAfter });
      r.check(ok, { page: "/vault/import", control: "D-06 Undo last where the account refuses one delete (403: SIMULATED)", expected: "Says 'Removed 1 of 2' and that 1 is still in the account (never 'Undid 2'); the refused one stays, the other is gone; Undo is still available and a second Undo removes it", actual: `message "${msg.slice(0, 190)}"; refused item still in account ${kStill}; other gone ${gStill === 0}; undo available ${undoEnabled}; second undo "${msg2.slice(0, 60)}"; refused item after second undo ${kAfter}`, evidence: sh, impact: "D-06 / ADD-357" });
    }
    // ---- D-06 d: account unreachable at undo time
    {
      const S = await session("owner", { width: 1440, height: 900 });
      const titles = await importAndUpload(S, "u4", 2);
      await blockTables(S, ["vault_items"], true);
      await click(S, btn(/^Undo last$/)); await sleep(8000);
      const msg = await statusLine(S);
      const still = (await rowsOf(`${PFX} u4`)).length;
      const sh = await shot(S, "d06-undo-offline");
      await blockTables(S, ["vault_items"], false);
      const stillAvail = await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Undo last'); return !!b && !b.disabled; })()`);
      await S.close();
      const ok = /Removed 0 of 2/.test(msg) && /still there/.test(msg) && still === 2 && stillAvail;
      out.d06.push({ case: "account unreachable", msg, rowsStill: still, undoStillAvailable: stillAvail });
      r.check(ok, { page: "/vault/import", control: "D-06 Undo last while the account is unreachable (vault_items blocked: SIMULATED)", expected: "Does not claim anything was undone; both items stay (account and device); Undo remains available", actual: `message "${msg.slice(0, 170)}"; rows still in account ${still}; undo available ${stillAvail}`, evidence: sh, impact: "D-06" });
    }
    // ---- D-06 e: another profile on this browser is not offered this import's Undo
    {
      const S = await session("owner", { width: 1440, height: 900 });
      await openImport(S);
      const titles = [`${PFX} u5 1 ${st}`]; await load(S, csv("rb6-u5.csv", titles), 1); await mode(S, "/Import all parsed rows/"); await sleep(300); await confirmImport(S); await sleep(4000);
      const enabledOwn = await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Undo last'); return !!b && !b.disabled; })()`);
      await S.evaluate(`localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(B)}); true`);
      await openImport(S);
      const enabledOther = await S.evaluate(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Undo last'); return !!b && !b.disabled; })()`);
      await S.close();
      out.d06.push({ case: "other profile", enabledForOwnProfile: enabledOwn, enabledForOtherProfile: enabledOther });
      r.check(enabledOwn && !enabledOther, { page: "/vault/import", control: "D-06 import history after switching to another profile on the same browser", expected: "Undo is offered only in the profile that made the import", actual: `enabled in own profile ${enabledOwn}; enabled after switching profile ${enabledOther}`, impact: "D-06 isolation" });
    }
  }
  (await rowsOf(PFX)).forEach((x) => created.push(x.id));
  for (const id of new Set(created)) await admin.from("vault_items").delete().eq("id", id).eq("profile_id", P);
  const left = (await rowsOf(PFX)).length;
  out.cleanup = { leftoverRows: left };
  save(`rb6-import-${LABEL}`, out); console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(2); });

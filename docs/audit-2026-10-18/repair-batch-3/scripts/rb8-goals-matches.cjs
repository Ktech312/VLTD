// Last batch-3 checks (area RB6): goal ownership with cloud goals ALREADY present, and the real "Vault Matches" tile (ADD-272).
// Device state is seeded directly (labelled DEVICE-SEEDED in every row); loading, uploading, reload and the clean second browser are driven through the UI.
//   AUDIT_MANIFEST=<manifest> node rb8-goals-matches.cjs <label> [goals|matches]
const L = require("./rb6-lib.cjs");
const { r, admin, sleep, man, session, body, click, typeInto, poll, btn, blockTables, shot, save, T, fs } = L;
const LABEL = process.argv[2] || "run";
const ONLY = process.argv[3] || "";
const out = { label: LABEL, fixtureOnly: true, goals: [], matches: [] };
const NAMES = `[...document.querySelectorAll('main button')].filter((b) => b.querySelector('h2')).map((b) => b.querySelector('h2').textContent.trim())`;

(async () => {
  const m = man(); const P = m.personalId; const st = m.stamp;
  const K = (base) => `${base}:${P}`;
  const cloud = (await admin.from("collection_goals").select("*").eq("profile_id", P)).data;
  const cloudG = cloud.map((g) => ({ id: g.id, name: g.name, targetCount: g.target_count, universe: g.universe || undefined, createdAt: Date.parse(g.created_at) }));
  const mk = (tag, i) => ({ id: `qa_rb8_${tag}_${st}`, name: `QA RB8 ${tag} ${st}`, targetCount: 10 + i, createdAt: Date.now() - i * 1000 });
  const dev1 = mk("device1", 1), dev2 = mk("device2", 2), gone = mk("deletedelsewhere", 3), pend = mk("pending", 4);
  const rowsOf = async () => (await admin.from("collection_goals").select("id,name").eq("profile_id", P)).data || [];
  const resetCloud = async () => { for (const g of await rowsOf()) if (/^qa_rb8_/.test(g.id)) await admin.from("collection_goals").delete().eq("id", g.id); for (const g of cloud) await admin.from("collection_goals").upsert({ id: g.id, profile_id: P, name: g.name, target_count: g.target_count, universe: g.universe, created_at: g.created_at }); };
  const names = (S) => S.evaluate(NAMES);
  const open = async (S) => { await S.visit("/goals"); await S.waitFor(`document.body.innerText.length > 300`, 60000, "goals").catch(() => {}); await sleep(5000); };
  const seedDevice = (S, o) => S.evaluate(`(() => { const set = (k, v) => localStorage.setItem(k, JSON.stringify(v)); ${o.local ? `set(${JSON.stringify(K("vltd_collection_goals_v1"))}, ${JSON.stringify(o.local)});` : ""} ${o.synced ? `set(${JSON.stringify(K("vltd_collection_goals_synced_v1"))}, ${JSON.stringify(o.synced)});` : ""} ${o.pending ? `set(${JSON.stringify(K("vltd_collection_goals_pending_v1"))}, ${JSON.stringify(o.pending)});` : ""} ${o.deleted ? `set(${JSON.stringify(K("vltd_collection_goals_deleted_v1"))}, ${JSON.stringify(o.deleted)});` : ""} return true; })()`);
  const [c1, c2, c3] = cloudG;
  const has = (list, ...gs) => gs.every((g) => list.includes(g.name));
  const hasNot = (list, ...gs) => gs.every((g) => !list.includes(g.name));

  if (!ONLY || ONLY === "goals") {
    // ---- A: account reachable, cloud goals present. DEVICE-SEEDED: 2 older device-only goals, 1 pending, 1 deleted elsewhere, 1 pending deletion (c2)
    {
      await resetCloud();
      const S = await session("owner", { width: 1440, height: 900 });
      await S.visit("/robots.txt"); await sleep(800);
      await seedDevice(S, { local: [c1, c3, dev1, dev2, gone, pend], synced: [c1.id, c2.id, c3.id, gone.id], pending: [pend.id], deleted: [c2.id] });
      await open(S);
      const listed = await names(S);
      const dbAfter = await poll(async () => { const rows = await rowsOf(); const ids = rows.map((x) => x.id); return [dev1.id, dev2.id, pend.id].every((i) => ids.includes(i)) && !ids.includes(c2.id) ? rows : null; }, 60000, 2500) || await rowsOf();
      await sleep(3000);
      const dbFinal = (await rowsOf()).map((x) => x.id);
      const notice = await S.evaluate(`(document.querySelector('[data-testid=goals-waiting]') || {}).innerText || ''`);
      const sh = await shot(S, "goals-ownership-online");
      await open(S); const reloaded = await names(S);
      await S.close();
      const S2 = await session("owner", { width: 1440, height: 900 }); await open(S2); const second = await names(S2); await S2.close();
      const exp = [c1, c3, dev1, dev2, pend]; const ids = dbFinal;
      const ok = has(listed, ...exp) && hasNot(listed, c2, gone) && listed.length === 5
        && [dev1.id, dev2.id, pend.id, c1.id, c3.id].every((i) => ids.includes(i)) && !ids.includes(c2.id) && !ids.includes(gone.id) && new Set(ids).size === ids.length
        && !notice && reloaded.length === 5 && has(second, ...exp) && hasNot(second, c2, gone) && second.length === 5;
      out.goals.push({ case: "online, cloud goals present", listed, dbFinal, notice, reloaded, second });
      r.check(ok, { page: "/goals", control: "Goals ownership with cloud goals ALREADY present (DEVICE-SEEDED state: 2 older device-only goals, 1 pending goal, 1 goal deleted on another device, 1 pending deletion; load, upload, reload and second browser through the UI)", expected: "List = the account's goals minus the pending deletion, plus both device-only goals and the pending goal; the deleted-elsewhere goal is not brought back; device-only and pending goals reach the account once each; reload and a clean second browser agree; no notice left", actual: `listed ${listed.length}: ${JSON.stringify(listed.map((n) => n.replace(/QA RB8 | \w+$/g, "")))}; account ids after: ${ids.length} (device-only/pending uploaded ${[dev1.id, dev2.id, pend.id].every((i) => ids.includes(i))}, c2 deleted ${!ids.includes(c2.id)}, deleted-elsewhere absent ${!ids.includes(gone.id)}, unique ${new Set(ids).size === ids.length}); notice "${notice}"; reload ${reloaded.length}; clean browser ${second.length}`, evidence: sh, impact: "goal ownership" });
    }
    // ---- B: account unreachable at load, then reconnect and reload
    {
      await resetCloud();
      const S = await session("owner", { width: 1440, height: 900 });
      await S.visit("/robots.txt"); await sleep(800);
      await seedDevice(S, { local: [c1, c3, dev1, dev2, gone, pend], synced: [c1.id, c2.id, c3.id, gone.id], pending: [pend.id], deleted: [c2.id] });
      await blockTables(S, ["collection_goals"], true);
      await open(S);
      const offlineList = await names(S); const offlineDb = (await rowsOf()).map((x) => x.id);
      const notice = await S.evaluate(`(document.querySelector('[data-testid=goals-waiting]') || {}).innerText || ''`);
      const sh = await shot(S, "goals-ownership-offline");
      await blockTables(S, ["collection_goals"], false);
      await click(S, btn(/^Retry now$/)); await sleep(5000);
      await open(S); await sleep(5000); // an online read queues the device-only goals; they upload
      const listed = await names(S);
      const ids = await poll(async () => { const x = (await rowsOf()).map((y) => y.id); return [dev1.id, dev2.id, pend.id].every((i) => x.includes(i)) && !x.includes(c2.id) ? x : null; }, 60000, 2500) || (await rowsOf()).map((y) => y.id);
      const notice2 = await S.evaluate(`(document.querySelector('[data-testid=goals-waiting]') || {}).innerText || ''`);
      await S.close();
      const S2 = await session("owner", { width: 1440, height: 900 }); await open(S2); const second = await names(S2); await S2.close();
      const ok = has(offlineList, c1, c3, dev1, dev2, pend) && hasNot(offlineList, c2) && offlineDb.every((i) => !/^qa_rb8_/.test(i)) && /Sync pending/.test(notice)
        && has(listed, c1, c3, dev1, dev2, pend) && hasNot(listed, c2, gone) && [dev1.id, dev2.id, pend.id].every((i) => ids.includes(i)) && !ids.includes(c2.id) && !ids.includes(gone.id) && new Set(ids).size === ids.length && !notice2
        && has(second, c1, c3, dev1, dev2, pend) && hasNot(second, c2, gone);
      out.goals.push({ case: "unreachable at load, then reconnect", offlineList, offlineDbQA: offlineDb.filter((i) => /^qa_rb8_/.test(i)), notice, listed, ids, notice2, second });
      r.check(ok, { page: "/goals", control: "Goals ownership while the account is unreachable, then reconnect (collection_goals blocked: SIMULATED; DEVICE-SEEDED state as above)", expected: "Offline: every goal this device holds stays listed (the pending deletion stays hidden), notice says sync pending, nothing uploaded. After reconnect and a reload: device-only and pending goals uploaded once, the pending deletion done, the deleted-elsewhere goal gone, notice cleared, clean browser agrees", actual: `offline listed ${offlineList.length}, notice "${notice.slice(0, 50)}", uploaded while blocked ${offlineDb.filter((i) => /^qa_rb8_/.test(i)).length}; after reconnect listed ${listed.length}, uploaded ${[dev1.id, dev2.id, pend.id].every((i) => ids.includes(i))}, c2 deleted ${!ids.includes(c2.id)}, deleted-elsewhere absent ${!ids.includes(gone.id)}, unique ${new Set(ids).size === ids.length}, notice after "${notice2}"; clean browser ${second.length}`, evidence: sh, impact: "goal ownership / sync" });
    }
    // ---- C: ownership uncertain: device-wide list of an older version (stored under no profile), cloud goals present
    const legacy = [mk("legacy1", 5), mk("legacy2", 6)];
    const stashKeys = (S) => S.evaluate(`Object.keys(localStorage).filter((k) => k.startsWith('vltd_stash:') && k.includes('vltd_collection_goals_v1'))`);
    const legacyRun = async (label, setup, expect) => {
      await resetCloud();
      const S = await session("owner", { width: 1440, height: 900 });
      await S.visit("/robots.txt"); await sleep(800);
      await S.evaluate(`(() => { localStorage.removeItem(${JSON.stringify(K("vltd_collection_goals_v1"))}); localStorage.setItem('vltd_collection_goals_v1', ${JSON.stringify(JSON.stringify(legacy))}); return true; })()`);
      await setup(S);
      await open(S); await sleep(4000);
      const listed = await names(S); const db = (await rowsOf()).map((x) => x.id);
      const stash = await stashKeys(S); const live = await S.evaluate(`localStorage.getItem('vltd_collection_goals_v1')`); const note = await S.evaluate(`(document.querySelector('[data-testid=goals-legacy-note]') || {}).innerText || ''`);
      const sh = await shot(S, "goals-legacy-" + label);
      await S.close();
      return { listed, db, stash, live, note, sh };
    };
    {
      // C1: the device says another person owns what it holds: it is moved aside, never adopted, never uploaded
      const res = await legacyRun("foreign-owner", (S) => S.evaluate(`localStorage.setItem('vltd_local_owner_v1', '00000000-0000-4000-8000-0000000000aa'); true`));
      const ok = hasNot(res.listed, ...legacy) && has(res.listed, c1, c2, c3) && res.db.every((i) => !/legacy/.test(i)) && (res.stash.length > 0 || res.live !== null);
      out.goals.push({ case: "uncertain: device owned by someone else", ...res });
      r.check(ok, { page: "/goals", control: "Device-wide goals of an older version while the device records ANOTHER person as owner, cloud goals present (DEVICE-SEEDED)", expected: "Not listed for this account, not uploaded, kept (moved aside or left in place), the account's own goals untouched", actual: `listed ${res.listed.length} (legacy listed ${!hasNot(res.listed, ...legacy)}); legacy rows in account ${res.db.filter((i) => /legacy/.test(i)).length}; kept: stash keys ${res.stash.length}, live copy ${res.live !== null}`, evidence: res.sh, impact: "goal ownership (uncertain)" });
    }
    {
      // C2: no recorded owner, and the device also names a profile this person does not own: parked as unattributed, never adopted
      const res = await legacyRun("unattributed", (S) => S.evaluate(`(() => { localStorage.removeItem('vltd_local_owner_v1'); const g = [{ id: 'qa_rb8_foreign_gallery', title: 'foreign', profile_id: '00000000-0000-4000-8000-0000000000bb', visibility: 'LOCKED', itemIds: [] }]; localStorage.setItem('vltd_galleries', JSON.stringify(g)); return true; })()`));
      const ok = hasNot(res.listed, ...legacy) && has(res.listed, c1, c2, c3) && res.db.every((i) => !/legacy/.test(i)) && (res.stash.length > 0 || res.live !== null);
      out.goals.push({ case: "uncertain: no recorded owner, foreign profile on the device", ...res });
      r.check(ok, { page: "/goals", control: "Device-wide goals of an older version with NO recorded owner and a profile this person does not own on the device, cloud goals present (DEVICE-SEEDED)", expected: "Not adopted, not uploaded, kept separately; the account's goals untouched", actual: `listed ${res.listed.length} (legacy listed ${!hasNot(res.listed, ...legacy)}); legacy rows in account ${res.db.filter((i) => /legacy/.test(i)).length}; kept: stash keys ${res.stash.length}, live copy ${res.live !== null}`, evidence: res.sh, impact: "goal ownership (uncertain)" });
    }
    {
      // C3: the device records THIS person as owner: the old list is confirmed theirs: adopted next to the account's goals and uploaded
      const res = await legacyRun("confirmed-owner", (S) => S.evaluate(`localStorage.setItem('vltd_local_owner_v1', ${JSON.stringify(m.userId)}); true`));
      await sleep(3000);
      const dbNow = (await rowsOf()).map((x) => x.id);
      const ok = has(res.listed, ...legacy, c1, c2, c3) && legacy.every((g) => dbNow.includes(g.id));
      out.goals.push({ case: "confirmed: device owned by this person", listed: res.listed, dbNow });
      r.check(ok, { page: "/goals", control: "Device-wide goals of an older version while the device records THIS person as owner, cloud goals present (DEVICE-SEEDED)", expected: "Confirmed theirs: listed next to the account's goals and uploaded once each", actual: `listed ${res.listed.length} (legacy listed ${has(res.listed, ...legacy)}); uploaded ${legacy.every((g) => dbNow.includes(g.id))}`, evidence: res.sh, impact: "goal ownership (confirmed)" });
    }
    await resetCloud();
    for (const g of await rowsOf()) if (/^qa_rb8_/.test(g.id)) await admin.from("collection_goals").delete().eq("id", g.id);
  }

  if (!ONLY || ONLY === "matches") {
    // clean browser, populated account: the real tile
    const existing = "QA Album 2 - Original Motion Picture Soundtrack";
    const countOf = async (t) => (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", P).eq("title", t)).count || 0;
    const accountTotal = (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", P)).count;
    const fresh = `QA RB8 match fresh ${st}`, sameTitleOtherSerial = "QA Album 3 - Original Motion Picture Soundtrack";
    fs.writeFileSync(T.tmp("rb8-matches.csv"), `Name,Serial Number,Purchase Price\n${existing},,5\n${sameTitleOtherSerial},RB8-SERIAL-1,6\n${fresh},,7\n`);
    const tile = (S, id) => S.evaluate(`(document.querySelector('[data-testid=${id}]') || {}).innerText || ''`);
    const S = await session("owner", { width: 1440, height: 900 });
    await S.visit("/vault/import"); await S.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Upload Spreadsheet')`, 60000).catch(() => {}); await sleep(2500);
    await T.chooseViaButton(S, T.btnExpr("^Upload Spreadsheet$"), T.tmp("rb8-matches.csv")); await S.waitFor(`/Parsed 3 item/.test(document.body.innerText)`, 25000).catch(() => {}); await sleep(800);
    const early = { vault: await tile(S, "tile-vault-matches"), checking: /Checking your account/.test(await body(S)) };
    // the tile settles once the account has been read
    const settled = await poll(async () => { const v = await tile(S, "tile-vault-matches"); return v && v !== "Not checked" ? v : null; }, 60000, 1000);
    const matches = { vault: await tile(S, "tile-vault-matches"), likely: await tile(S, "tile-likely-matches"), batch: await S.evaluate(`(() => { const e = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && d.textContent.trim() === 'Batch Duplicates'); return e && e.nextElementSibling ? e.nextElementSibling.textContent.trim() : ''; })()`) };
    const sh1 = await shot(S, "matches-tile-clean-browser");
    // what the page lists as the match
    const listed = (await body(S)).includes(existing);
    r.check(accountTotal > 20 && matches.vault === "1" && settled === "1", { page: "/vault/import", control: "ADD-272 'Vault Matches' tile in a clean browser with populated account data (account holds an exact title; a same-title row with a different serial is a different piece; one new title)", expected: "Vault Matches = 1 (only the exact title+serial match), once the account has been read; it is not 0 and not claimed before the check", actual: `account holds ${accountTotal} items; before the check "${early.vault}" (checking text ${early.checking}); settled "${settled}"; tile now "${matches.vault}"; Likely Matches "${matches.likely}"; Batch Duplicates "${matches.batch}"`, evidence: sh1, impact: "ADD-272" });
    // duplicate skipping with that data
    await click(S, `[...document.querySelectorAll('label')].find((l) => /Skip exact titles already in vault/.test(l.textContent))`); await sleep(400);
    const beforeExisting = await countOf(existing), beforeOther = await countOf(sameTitleOtherSerial);
    for (let k = 0; k < 2; k++) { await click(S, btn(/Confirm Import/)); await sleep(2500); }
    const msg = await poll(async () => { const t = await S.evaluate(`(() => { const e = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && /^Imported/.test((d.textContent || '').trim())); return e ? e.textContent.trim() : ''; })()`); return t || null; }, 60000, 1000) || "";
    await poll(async () => ((await countOf(fresh)) > 0 ? true : null), 60000, 2500); await sleep(6000);
    const afterExisting = await countOf(existing), afterOther = await countOf(sameTitleOtherSerial), freshN = await countOf(fresh);
    const created = [];
    for (const t of [fresh, sameTitleOtherSerial]) for (const x of (await admin.from("vault_items").select("id,created_at").eq("profile_id", P).eq("title", t).order("created_at", { ascending: false })).data || []) created.push(x);
    const extraOther = (await admin.from("vault_items").select("id,created_at").eq("profile_id", P).eq("title", sameTitleOtherSerial).order("created_at", { ascending: false })).data || [];
    await S.close();
    const ok2 = afterExisting === beforeExisting && freshN === 1 && afterOther === beforeOther + 1 && /Skipped 1 exact duplicate/.test(msg);
    r.check(ok2, { page: "/vault/import", control: "ADD-272 duplicate skipping with the same populated data: exact title skipped, same title with a different serial imported, new title imported", expected: "Exact title not copied again; the different-serial piece is imported (documented rule: same description AND serial number); the new title imported once", actual: `existing copies ${beforeExisting} -> ${afterExisting}; same title other serial ${beforeOther} -> ${afterOther}; new ${freshN}; message "${msg.slice(0, 150)}"`, impact: "ADD-272" });
    out.matches.push({ accountTotal, early, settled, matches, listed, msg, beforeExisting, afterExisting, beforeOther, afterOther, freshN });
    // exact cleanup: the fresh row and the extra different-serial row this test created
    await admin.from("vault_items").delete().eq("profile_id", P).eq("title", fresh);
    if (extraOther.length > beforeOther) await admin.from("vault_items").delete().eq("id", extraOther[0].id);
    // account unreachable: the tile must not say 0
    const S3 = await session("owner", { width: 1440, height: 900 });
    await blockTables(S3, ["vault_items"], true);
    await S3.visit("/vault/import"); await S3.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Upload Spreadsheet')`, 60000).catch(() => {}); await sleep(2000);
    await T.chooseViaButton(S3, T.btnExpr("^Upload Spreadsheet$"), T.tmp("rb8-matches.csv")); await S3.waitFor(`/Parsed 3 item/.test(document.body.innerText)`, 25000).catch(() => {});
    await S3.waitFor(`!!document.querySelector('[data-testid=account-check-failed]')`, 90000).catch(() => {}); await sleep(800);
    const tFail = await tile(S3, "tile-vault-matches"); const banner = await S3.evaluate(`(document.querySelector('[data-testid=account-check-failed]') || {}).innerText || ''`);
    const sh3 = await shot(S3, "matches-tile-unreachable");
    await S3.close();
    r.check(tFail === "Not checked" && /could not be checked/.test(banner), { page: "/vault/import", control: "ADD-272 'Vault Matches' tile while the account cannot be read (vault_items blocked: SIMULATED)", expected: "The tile says Not checked (never 0) and the banner says duplicate detection is incomplete", actual: `tile "${tFail}"; banner "${banner.slice(0, 90)}"`, evidence: sh3, impact: "ADD-272" });
    out.matches.push({ unreachableTile: tFail, banner });
  }
  save(`rb8-${LABEL}`, out); console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(2); });

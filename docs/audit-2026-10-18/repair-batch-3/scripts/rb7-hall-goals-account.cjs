// Follow-up checks after batch 3 (area RB6): Hall limit, device-only goals, a REAL second account on one browser.
//   AUDIT_MANIFEST=<manifest> node rb7-hall-goals-account.cjs <label> [hall|goals|account]
const L = require("./rb6-lib.cjs");
const { r, admin, sleep, man, session, body, click, typeInto, poll, btn, shot, save, T } = L;
const { createClient } = require("C:/Users/EK/VLTD/node_modules/@supabase/supabase-js");
const env = require("../qa/env.cjs");
const LABEL = process.argv[2] || "run";
const ONLY = process.argv[3] || "";
const out = { label: LABEL, fixtureOnly: true, hall: [], goals: [], account: [] };
const enter = async (S) => { await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }); };

(async () => {
  const m = man(); const P = m.personalId; const B = m.businessId; const st = m.stamp;
  const created = { galleries: [] };

  // ------------------------------------------------------------------ Hall: exhibition limit
  if (!ONLY || ONLY === "hall") {
    const hallsNamed = async (name) => (await admin.from("galleries").select("id,title").eq("profile_id", P).eq("title", name)).data || [];
    const countG = async () => (await admin.from("galleries").select("id", { count: "exact", head: true }).eq("profile_id", P)).count;
    const tryHall = async (S, name) => {
      await S.visit("/vault/halls"); await S.waitFor(`document.querySelectorAll('input').length > 0`, 90000, "halls").catch(() => {}); await sleep(4000);
      await typeInto(S, `document.querySelector('input[placeholder^="Search by name"]')`, "Album 1"); await enter(S); await sleep(1800);
      for (let i = 0; i < 30; i++) { if (/\d+ selected/.test(await body(S))) break; await sleep(500); }
      await click(S, btn(/^Save as Hall$/)); await sleep(1200);
      await typeInto(S, `document.querySelector('input[placeholder^="e.g. Spider-Man"]')`, name); await sleep(300);
      await click(S, btn(/^(Save Hall|Saving…)$/)); await sleep(5000);
    };
    // FREE tier: 4 exhibitions allowed, this fixture holds 5
    {
      await admin.from("profiles").update({ tier: "FREE" }).eq("id", P); // the app takes the tier from the account on every load (the fixture account is FULL)
      const S = await session("owner", { width: 1440, height: 900 }); const name = `QA RB7 Hall limit ${st}`;
      await S.visit("/museum"); await sleep(8000); // exhibitions are on this device
      out.tierSeen = await S.evaluate(`localStorage.getItem('vltd_tier')`);
      const before = await countG();
      await tryHall(S, name);
      const path = await S.evaluate("location.pathname"); const err = await S.evaluate(`(document.querySelector('[data-testid=hall-error]') || {}).innerText || ''`);
      const modalName = await S.evaluate(`(document.querySelector('input[placeholder^="e.g. Spider-Man"]') || {}).value || ''`);
      const rows = await hallsNamed(name); const after = await countG();
      const sh = await shot(S, "hall-limit");
      await S.visit("/museum"); await sleep(8000); const afterReload = (await body(S)).includes(name);
      await S.close();
      out.hall.push({ case: "FREE tier, at the limit", before, after, path, err, modalName, rows: rows.length, afterReload });
      r.check(path === "/vault/halls" && /exhibition limit/i.test(err) && modalName === name && rows.length === 0 && after === before && !afterReload, { page: "/vault/halls", control: "Save Hall at the exhibition limit (FREE tier: 4 allowed, 5 exist)", expected: "Refused with a plain message, the name box keeps what was typed, nothing created, not listed after a reload", actual: `path ${path}; message "${err.slice(0, 120)}"; name kept ${modalName === name}; hall rows ${rows.length}; exhibitions ${before} -> ${after}; listed after reload ${afterReload}`, evidence: sh, impact: "D-02 limit path" });
    }
    // MID tier (25 allowed): the same hall is created
    {
      await admin.from("profiles").update({ tier: "MID" }).eq("id", P);
      const S = await session("owner", { width: 1440, height: 900 }); const name = `QA RB7 Hall under limit ${st}`;
      await S.visit("/museum"); await sleep(8000);
      const before = await countG();
      await tryHall(S, name);
      const path = await S.evaluate("location.pathname");
      const rows = await poll(async () => { const h = await hallsNamed(name); return h.length ? h : null; }, 60000, 2500) || [];
      rows.forEach((h) => created.galleries.push(h.id));
      const after = await countG(); await S.close();
      out.hall.push({ case: "MID tier, under the limit", before, after, path, rows: rows.length });
      r.check(/^\/museum\//.test(path) && rows.length === 1 && after === before + 1, { page: "/vault/halls", control: "Save Hall under the exhibition limit (MID tier: 25 allowed)", expected: "Created and opened", actual: `path ${path}; hall rows ${rows.length}; exhibitions ${before} -> ${after}`, impact: "D-02 limit path" });
    }
    await admin.from("profiles").update({ tier: "FULL" }).eq("id", P);
    for (const x of (await admin.from("galleries").select("id").eq("profile_id", P).like("title", "QA RB7 Hall%")).data || []) created.galleries.push(x.id);
    for (const id of created.galleries) { await admin.from("gallery_items").delete().eq("gallery_id", id); await admin.from("galleries").delete().eq("id", id).eq("profile_id", P); }
  }

  // ------------------------------------------------------------------ Goals that exist only on this device
  if (!ONLY || ONLY === "goals") {
    const goalsOf = async (pid) => (await admin.from("collection_goals").select("id,name,profile_id").eq("profile_id", pid).like("name", "QA RB7 local%")).data || [];
    const names = (S) => S.evaluate(`[...document.querySelectorAll('main button')].filter((b) => b.querySelector('h2')).map((b) => b.querySelector('h2').textContent.trim())`);
    const mk = (n, i) => ({ id: `qa_rb7_local_${n}_${i}_${st}`, name: `QA RB7 local ${n} ${i}`, targetCount: 10 + i, createdAt: Date.now() - i * 1000 });
    // (a) the account has NO goals for this profile (Business): device-only goals are uploaded
    {
      const pre = (await admin.from("collection_goals").select("id", { count: "exact", head: true }).eq("profile_id", B)).count;
      const S = await session("business", { width: 1440, height: 900 });
      const seeded = [mk("biz", 1), mk("biz", 2)];
      await S.visit("/robots.txt"); await sleep(800);
      await S.evaluate(`localStorage.setItem('vltd_collection_goals_v1:${B}', ${JSON.stringify(JSON.stringify(seeded))}); true`);
      await S.visit("/goals"); await S.waitFor(`document.body.innerText.length > 300`, 60000, "goals").catch(() => {}); await sleep(3500);
      const rows = await poll(async () => { const x = await goalsOf(B); return x.length >= 2 ? x : null; }, 60000, 2500) || await goalsOf(B);
      await sleep(3000);
      const waitingNotice = await S.evaluate(`(document.querySelector('[data-testid=goals-waiting]') || {}).innerText || ''`);
      const listed = await names(S);
      const keys = await S.evaluate(`({ pending: localStorage.getItem('vltd_collection_goals_pending_v1:${B}'), deleted: localStorage.getItem('vltd_collection_goals_deleted_v1:${B}') })`);
      const sh = await shot(S, "goals-device-only-uploaded");
      await S.visit("/goals"); await sleep(5000); const listed2 = await names(S);
      await S.close();
      const S2 = await session("business", { width: 1440, height: 900 }); await S2.visit("/goals"); await S2.waitFor(`document.body.innerText.length > 300`, 60000, "goals").catch(() => {}); await sleep(4000); const second = await names(S2); await S2.close();
      const ok = pre === 0 && rows.length === 2 && seeded.every((g) => listed.includes(g.name) && listed2.includes(g.name) && second.includes(g.name)) && !waitingNotice && (keys.pending === null || keys.pending === "[]");
      out.goals.push({ case: "device-only goals, account has none", accountGoalsBefore: pre, rowsAfter: rows.length, listed, notice: waitingNotice, keys, second });
      r.check(ok, { page: "/goals", control: "Goals that exist only on this device, account has none (Business profile)", expected: "They upload (two rows, no duplicates), stay listed after a reload and in a clean browser, no notice left", actual: `account goals before ${pre}; rows after ${rows.length}; listed ${JSON.stringify(listed).slice(0, 100)}; notice "${waitingNotice}"; pending ${keys.pending}; clean browser lists ${second.filter((n) => /QA RB7/.test(n)).length}`, evidence: sh, impact: "D-03 legacy path" });
      for (const g of await goalsOf(B)) await admin.from("collection_goals").delete().eq("id", g.id);
    }
    // (b) the account HAS goals for this profile (Personal): what happens to a device-only goal? (documented behaviour, observed)
    {
      const S = await session("owner", { width: 1440, height: 900 });
      const existing = (await admin.from("collection_goals").select("id,name").eq("profile_id", P)).data || [];
      const extra = mk("own", 9);
      await S.visit("/robots.txt"); await sleep(800);
      const local = [...existing.map((g, i) => ({ id: g.id, name: g.name, targetCount: 5, createdAt: Date.now() - (i + 1) * 5000 })), extra];
      await S.evaluate(`localStorage.setItem('vltd_collection_goals_v1:${P}', ${JSON.stringify(JSON.stringify(local))}); true`);
      await S.visit("/goals"); await S.waitFor(`document.body.innerText.length > 300`, 60000, "goals").catch(() => {}); await sleep(5000);
      const listed = await names(S); const rows = await goalsOf(P);
      await S.close();
      out.goals.push({ case: "device-only goal, account already has goals", extraListed: listed.includes(extra.name), extraUploaded: rows.length });
      r.nt({ page: "/goals", control: "A device-only goal on a profile whose account already holds goals (OBSERVED, not a pass/fail)", expected: "Not specified by batch 3: the old code let the account's list replace the device list", actual: `device-only goal listed after load ${listed.includes(extra.name)}; uploaded ${rows.length}`, impact: "observation" });
      for (const g of await goalsOf(P)) await admin.from("collection_goals").delete().eq("id", g.id);
    }
  }

  // ------------------------------------------------------------------ a REAL second account on the same browser
  if (!ONLY || ONLY === "account") {
    const sb = () => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const signIn = async (email, password) => { const { data, error } = await sb().auth.signInWithPassword({ email, password }); if (error) throw error; return data.session; };
    const viewer = m.k; const ownerSession = await signIn(m.email, m.password); const viewerSession = await signIn(viewer.email, viewer.password);
    const S = await session("owner", { width: 1440, height: 900 }); const title = `QA RB7 draft owner only ${st}`;
    const nameSel = `document.getElementById('capture-item-name')`;
    const val = (S) => S.evaluate(`(document.getElementById('capture-item-name') || {}).value || ''`);
    const notice = (S) => S.evaluate(`(document.querySelector('[data-testid=capture-draft-notice]') || {}).innerText || ''`);
    const openCapture = async (S) => { await S.visit("/capture"); await S.waitFor(`!!document.getElementById('capture-item-name')`, 60000, "capture").catch(() => {}); await sleep(3500); };
    const rendered = (S) => S.evaluate(`!!document.getElementById('capture-item-name')`);
    await openCapture(S); await typeInto(S, nameSel, title); await sleep(1800);
    const keysOwner = await S.evaluate(`Object.keys(localStorage).filter((k) => k.startsWith('vltd_capture_draft_v1'))`);
    // sign the OTHER (real, synthetic) account into this same browser
    await S.evaluate(`localStorage.setItem('vltd-auth', ${JSON.stringify(JSON.stringify(viewerSession))}); localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(viewer.profileId)}); true`);
    await openCapture(S);
    const asViewer = { rendered: await rendered(S), name: await val(S), notice: await notice(S) };
    const sh = await shot(S, "account-other-user");
    const keysViewer = await S.evaluate(`Object.keys(localStorage).filter((k) => k.startsWith('vltd_capture_draft_v1'))`);
    // the other account leaves its own draft
    await typeInto(S, nameSel, `QA RB7 draft viewer ${st}`); await sleep(1800);
    // back to the first account
    await S.evaluate(`localStorage.setItem('vltd-auth', ${JSON.stringify(JSON.stringify(ownerSession))}); localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(P)}); true`);
    await openCapture(S);
    const asOwnerAgain = { rendered: await rendered(S), name: await val(S), notice: await notice(S) };
    const keysEnd = await S.evaluate(`Object.keys(localStorage).filter((k) => k.startsWith('vltd_capture_draft_v1'))`);
    // and the viewer again: only its own draft
    await S.evaluate(`localStorage.setItem('vltd-auth', ${JSON.stringify(JSON.stringify(viewerSession))}); localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(viewer.profileId)}); true`);
    await openCapture(S);
    const viewerAgain = { rendered: await rendered(S), name: await val(S) };
    await S.evaluate(`Object.keys(localStorage).filter((k) => k.startsWith('vltd_capture_draft_v1')).forEach((k) => localStorage.removeItem(k)); true`);
    await S.close();
    out.account.push({ keysOwner, keysViewer, keysEnd, asViewer, asOwnerAgain, viewerAgain });
    const ok = keysOwner.some((k) => k.includes(m.userId)) && asViewer.rendered && asViewer.name === "" && !asViewer.notice && asOwnerAgain.rendered && asOwnerAgain.name === title && viewerAgain.name === `QA RB7 draft viewer ${st}` && keysEnd.length >= 2;
    r.check(ok, { page: "/capture", control: "D-09 a REAL second account (viewer) signed into the same browser after the owner left a draft", expected: "The second account sees no draft and gets its own; the first account's draft is still there when it returns; each draft is stored under its own account id", actual: `viewer sees form ${asViewer.rendered}, name "${asViewer.name}", notice "${asViewer.notice}"; owner again "${asOwnerAgain.name}"; viewer again "${viewerAgain.name}"; keys: ${keysEnd.map((k) => k.slice(0, 40)).join(" | ")}`, evidence: sh, impact: "D-09 isolation (RB6-077)" });
  }
  save(`rb7-${LABEL}`, out); console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(2); });

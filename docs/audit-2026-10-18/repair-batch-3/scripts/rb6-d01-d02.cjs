// D-01 (AI draft approval) and D-02 (Save as Hall) on PRODUCTION, synthetic fixture, prepared drafts only (no AI call is made).
//   AUDIT_MANIFEST=<manifest> node rb6-d01-d02.cjs <label> [only=d01|d02]
const L = require("./rb6-lib.cjs");
const { r, admin, sleep, man, session, body, click, typeInto, poll, btn, blockTables, lostAnswer, endLostAnswer, shot, save, T } = L;
const LABEL = process.argv[2] || "run";
const ONLY = process.argv[3] || "";
const KEY = "vltd_ai_drafts_v1";
const out = { label: LABEL, fixtureOnly: true, d01: [], d02: [] };
const enter = async (S) => { await S.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, text: "\r" }); await S.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 }); };

(async () => {
  const m = man(); const P = m.personalId; const st = m.stamp;
  const seedDraft = (S, id, title) => S.evaluate(`localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(JSON.stringify([{ id, workspaceId: "w", createdByLabel: "prepared synthetic draft", status: "READY_FOR_REVIEW", confidenceLabel: "Good", confidenceScore: 70, title, categoryLabel: "Comics", universe: "POP_CULTURE", purchasePrice: 12, currentValue: 30, missingFields: [], createdAt: new Date().toISOString() }]))}); true`);
  const rowsFor = async (id) => (await admin.from("vault_items").select("id,title,profile_id,purchase_price").eq("id", id)).data || [];
  const toastText = async (S) => { let t = ""; for (let i = 0; i < 20; i++) { t = (await body(S)).match(/(Saved to your vault\.|Saved on this device[^.]*\.[^.]*\.|could not be saved[^.]*\.)/)?.[0] || ""; if (t) break; await sleep(500); } return t; };

  if (!ONLY || ONLY === "d01") {
    const ids = [];
    // --- N: normal approval, with repeated clicks, then a clean second browser
    {
      const S = await session("owner", { width: 1440, height: 900 });
      const did = `rb6_${st}_n`, title = `QA RB6 AI draft normal ${st}`; ids.push(`ai_${did}`);
      await S.visit("/ai/drafts"); await sleep(1500); await seedDraft(S, did, title);
      await S.visit(`/ai/review?id=${did}`); await S.waitFor(`/Approve & save/.test(document.body.innerText)`, 60000, "review").catch(() => {}); await sleep(1500);
      for (let i = 0; i < 3; i++) { await click(S, btn(/Approve & save/)); await sleep(120); }
      const t = await toastText(S);
      const rows = await poll(async () => { const x = await rowsFor(`ai_${did}`); return x.length ? x : null; }, 60000, 2500) || [];
      await sleep(4000); const rows2 = await rowsFor(`ai_${did}`);
      const sh = await shot(S, "d01-normal");
      await S.close();
      const S2 = await session("owner", { width: 1440, height: 900 });
      await S2.visit("/vault"); await S2.waitFor(`document.querySelectorAll('a[href^="/vault/item/"]').length > 3`, 90000, "vault").catch(() => {}); await sleep(3500);
      const onSecond = (await body(S2)).includes(title);
      await S2.close();
      const ok = /Saved to your vault\./.test(t) && rows.length === 1 && rows2.length === 1 && rows[0].profile_id === P && onSecond;
      out.d01.push({ case: "normal + 3 rapid clicks + clean second browser", toast: t, rowsInAccount: rows2.length, onSecondBrowser: onSecond });
      r.check(ok, { page: "/ai/review", control: "D-01 Approve & save (prepared draft; 3 rapid clicks)", expected: "Toast says saved only now; exactly 1 item in the account (profile Personal); visible in a clean second browser", actual: `toast "${t}"; rows after 60 s: ${rows2.length}; second browser shows it: ${onSecond}`, evidence: sh, impact: "D-01 / ADD-371" });
    }
    // --- F: account unreachable
    {
      const S = await session("owner", { width: 1440, height: 900 });
      const did = `rb6_${st}_f`, title = `QA RB6 AI draft offline ${st}`; ids.push(`ai_${did}`);
      await S.visit("/ai/drafts"); await sleep(1500); await seedDraft(S, did, title);
      await S.visit(`/ai/review?id=${did}`); await S.waitFor(`/Approve & save/.test(document.body.innerText)`, 60000, "review").catch(() => {}); await sleep(1500);
      await blockTables(S, ["vault_items"], true);
      await click(S, btn(/Approve & save/));
      const t = await toastText(S);
      await sleep(5000); const during = await rowsFor(`ai_${did}`);
      const sh = await shot(S, "d01-offline");
      await blockTables(S, ["vault_items"], false);
      await S.visit("/vault"); await S.waitFor(`document.querySelectorAll('a[href^="/vault/item/"]').length > 3`, 90000, "vault").catch(() => {}); await sleep(3000);
      const localShown = (await body(S)).includes(title);
      const after = await poll(async () => { const x = await rowsFor(`ai_${did}`); return x.length ? x : null; }, 90000, 3000) || [];
      await S.close();
      const ok = /Saved on this device/.test(t) && /Sync pending/.test(t) && during.length === 0 && localShown && after.length === 1;
      out.d01.push({ case: "account unreachable", toast: t, rowsWhileBlocked: during.length, listedOnDevice: localShown, rowsAfterRestore: after.length });
      r.check(ok, { page: "/ai/review", control: "D-01 Approve & save while the account is unreachable (requests blocked: SIMULATED)", expected: "Says saved on this device, sync pending (not account-saved); nothing in the account while blocked; item kept; uploads once the connection is back", actual: `toast "${t}"; rows while blocked: ${during.length}; on device: ${localShown}; rows after restore: ${after.length}`, evidence: sh, impact: "D-01 / ADD-371" });
    }
    // --- I: answer lost (the account applied it)
    {
      const S = await session("owner", { width: 1440, height: 900 });
      const did = `rb6_${st}_i`, title = `QA RB6 AI draft lost answer ${st}`; ids.push(`ai_${did}`);
      await S.visit("/ai/drafts"); await sleep(1500); await seedDraft(S, did, title);
      await S.visit(`/ai/review?id=${did}`); await S.waitFor(`/Approve & save/.test(document.body.innerText)`, 60000, "review").catch(() => {}); await sleep(1500);
      await lostAnswer(S, /vault_items/, ["POST", "PATCH"], 2);
      await click(S, btn(/Approve & save/));
      const t = await toastText(S);
      await sleep(4000); const during = await rowsFor(`ai_${did}`);
      await endLostAnswer(S);
      await S.visit("/vault"); await S.waitFor(`document.querySelectorAll('a[href^="/vault/item/"]').length > 3`, 90000, "vault").catch(() => {}); await sleep(5000);
      const sh = await shot(S, "d01-lost-answer");
      const after = await poll(async () => { const x = await rowsFor(`ai_${did}`); return x.length === 1 ? x : null; }, 60000, 3000) || await rowsFor(`ai_${did}`);
      await S.close();
      const ok = /Sync pending|Saved on this device/.test(t) && after.length === 1;
      out.d01.push({ case: "answer lost (account applied it)", toast: t, rowsAfterRetry: after.length, rowsBeforeRetry: during.length });
      r.check(ok, { page: "/ai/review", control: "D-01 Approve & save, answer lost (SIMULATED connection reset after the account applied the write)", expected: "Does not claim account-saved; after the retry there is exactly 1 item (no duplicate)", actual: `toast "${t}"; rows before retry ${during.length}, after ${after.length}`, evidence: sh, impact: "D-01 / ADD-371" });
    }
    // cleanup
    for (const id of ids) await admin.from("vault_items").delete().eq("id", id).eq("profile_id", P);
  }

  if (!ONLY || ONLY === "d02") {
    const mkHall = async (S, name, setup, afterClick) => {
      await S.visit("/vault/halls"); await S.waitFor(`document.querySelectorAll('input').length > 0`, 90000, "halls").catch(() => {}); await sleep(4000);
      await typeInto(S, `document.querySelector('input[placeholder^="Search by name"]')`, "Album 1"); await enter(S); await sleep(1800);
      let count = 0; for (let i = 0; i < 30 && !count; i++) { count = Number((await body(S)).match(/(\d+) selected/)?.[1] || 0); if (!count) await sleep(500); }
      out.lastSelectedText = (await body(S)).match(/.{0,40}selected.{0,40}/)?.[0];
      if (setup) await setup(S);
      await click(S, btn(/^Save as Hall$/)); await sleep(1200);
      await typeInto(S, `document.querySelector('input[placeholder^="e.g. Spider-Man"]')`, name); await sleep(300);
      const saveBtn = btn(/^(Save Hall|Saving…)$/);
      for (let i = 0; i < 3; i++) { await click(S, saveBtn); await sleep(100); }
      if (afterClick) await afterClick(S);
      return count;
    };
    const hallsNamed = async (name) => (await admin.from("galleries").select("id,title,profile_id,visibility").eq("profile_id", P).eq("title", name)).data || [];
    const linkCount = async (gid) => (await admin.from("gallery_items").select("id", { count: "exact", head: true }).eq("gallery_id", gid)).count || 0;
    const created = [];
    // --- N: normal + repeated clicks
    {
      const S = await session("owner", { width: 1440, height: 900 }); const name = `QA RB6 Hall ${st} normal`;
      const count = await mkHall(S, name);
      await S.waitFor(`/\\/museum\\//.test(location.pathname)`, 30000, "opened").catch(() => {}); await sleep(5000);
      const path = await S.evaluate("location.pathname"); const txt = await body(S);
      const halls = await poll(async () => { const h = await hallsNamed(name); return h.length ? h : null; }, 60000, 2500) || [];
      await sleep(5000); const halls2 = await hallsNamed(name); halls2.forEach((h) => created.push(h.id));
      const links = halls2[0] ? await poll(async () => { const n = await linkCount(halls2[0].id); return n >= count ? n : null; }, 60000, 2500) || await linkCount(halls2[0].id) : 0;
      const sh = await shot(S, "d02-normal"); await S.close();
      const S2 = await session("owner", { width: 1440, height: 900 });
      await S2.visit("/museum"); await sleep(9000); const second = (await body(S2)).includes(name);
      await S2.close();
      const ok = /^\/museum\//.test(path) && !/not found/i.test(txt) && halls2.length === 1 && links === count && count > 1 && second;
      out.d02.push({ case: "normal + 3 rapid clicks", selected: count, path, hallRows: halls2.length, linkRows: links, onSecondBrowser: second });
      r.check(ok, { page: "/vault/halls", control: "D-02 Save Hall (3 rapid clicks)", expected: "Opens the hall (not 'Exhibition not found'); exactly 1 exhibition row with one link row per selected item; visible in a clean second browser", actual: `selected ${count}; opened ${path}; exhibition rows ${halls2.length}; link rows ${links}; second browser lists it: ${second}`, evidence: sh, impact: "D-02 / VLT-256, VLT-288" });
    }
    // --- F: account unreachable
    {
      const S = await session("owner", { width: 1440, height: 900 }); const name = `QA RB6 Hall ${st} offline`;
      let blockedBefore = false;
      const count = await mkHall(S, name, async (SS) => { await blockTables(SS, ["galleries", "gallery_items"], true); blockedBefore = true; });
      await sleep(6000);
      const path = await S.evaluate("location.pathname"); const txt = await body(S);
      const during = await hallsNamed(name);
      const sh = await shot(S, "d02-offline");
      await blockTables(S, ["galleries", "gallery_items"], false);
      await S.visit("/museum"); await sleep(8000);
      await S.visit("/museum"); await sleep(8000);
      const after = await poll(async () => { const h = await hallsNamed(name); return h.length ? h : null; }, 90000, 3000) || [];
      after.forEach((h) => created.push(h.id));
      const links = after[0] ? await linkCount(after[0].id) : 0;
      await S.close();
      const ok = blockedBefore && /^\/museum\//.test(path) && during.length === 0 && after.length === 1 && links >= count;
      out.d02.push({ case: "account unreachable", selected: count, path, rowsWhileBlocked: during.length, rowsAfterRestore: after.length, linkRows: links });
      r.check(ok, { page: "/vault/halls", control: "D-02 Save Hall while the account is unreachable (requests blocked: SIMULATED)", expected: "The hall is stored on this device and opens; nothing in the account while blocked; it uploads (one exhibition, all links) once the connection is back", actual: `selected ${count}; opened ${path}; rows while blocked ${during.length}; after restore ${after.length} (links ${links})`, evidence: sh, impact: "D-02 / VLT-256, VLT-288" });
    }
    for (const id of created) { await admin.from("gallery_items").delete().eq("gallery_id", id); await admin.from("galleries").delete().eq("id", id).eq("profile_id", P); }
  }
  save(`rb6-d01-d02-${LABEL}`, out);
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(2); });

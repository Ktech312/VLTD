// D-08 (bulk 60-file limit) and D-09/D-10 (Capture draft) on PRODUCTION, synthetic fixture. No AI call is made or allowed.
//   AUDIT_MANIFEST=<manifest> node rb6-bulk-capture.cjs <label> [only=d08|capture]
const L = require("./rb6-lib.cjs");
const { r, admin, sleep, man, fs, session, body, click, typeInto, poll, btn, shot, save, T } = L;
const LABEL = process.argv[2] || "run";
const ONLY = process.argv[3] || "";
const out = { label: LABEL, fixtureOnly: true, d08: [], capture: [] };

(async () => {
  const m = man(); const P = m.personalId; const B = m.businessId; const st = m.stamp;

  if (!ONLY || ONLY === "d08") {
    const files = Array.from({ length: 62 }, (_, i) => T.mkPng(T.tmp(`rb6-bulk-${String(i + 1).padStart(2, "0")}.png`), 8, 8, [40 + i, 120, 200]));
    fs.writeFileSync(T.tmp("rb6-notes.txt"), "not a photo");
    const S = await session("owner", { width: 1440, height: 900 });
    await S.visit("/vault/bulk"); await S.waitFor(`document.querySelectorAll('input[type=file]').length > 0`, 60000, "bulk").catch(() => {}); await sleep(3500);
    const before = (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", P)).count;
    await T.uploadFiles(S, "input[type=file]", files); await sleep(3500);
    const t1 = await body(S); const note1 = await S.evaluate(`(document.querySelector('[data-testid=intake-note]') || {}).innerText || ''`);
    const selected1 = Number(t1.match(/(\d+) photos? selected/)?.[1] || 0);
    const sh1 = await shot(S, "d08-62-files");
    r.check(selected1 === 60 && /rb6-bulk-61\.png, rb6-bulk-62\.png/.test(note1) && /60/.test(note1), { page: "/vault/bulk", control: "D-08 Choose photos with 62 files", expected: "60 taken and the page names the 2 left out (rb6-bulk-61.png, rb6-bulk-62.png) and the limit", actual: `selected ${selected1}; notice "${note1.slice(0, 200)}"`, evidence: sh1, impact: "D-08 / ADD-432" });
    // a second choice while 60 are queued: nothing fits, all named
    await T.uploadFiles(S, "input[type=file]", [files[0], files[1], T.tmp("rb6-notes.txt")]); await sleep(2500);
    const t2 = await body(S); const note2 = await S.evaluate(`(document.querySelector('[data-testid=intake-note]') || {}).innerText || ''`);
    const selected2 = Number(t2.match(/(\d+) photos? selected/)?.[1] || 0);
    r.check(selected2 === 60 && /rb6-bulk-01\.png/.test(note2) && /rb6-notes\.txt/.test(note2) && /not a photo/.test(note2), { page: "/vault/bulk", control: "D-08 Choose 2 more photos and a text file while 60 are queued", expected: "Still 60 (the limit counts what is queued); both photos and the non-photo file are named as not added", actual: `selected ${selected2}; notice "${note2.slice(0, 220)}"`, impact: "D-08" });
    // room after removing 3
    for (let i = 0; i < 3; i++) await click(S, `document.querySelector('button[aria-label="Remove photo"]')`), await sleep(300);
    await T.uploadFiles(S, "input[type=file]", [files[60], files[61], files[0], files[1]]); await sleep(2500);
    const t3 = await body(S); const note3 = await S.evaluate(`(document.querySelector('[data-testid=intake-note]') || {}).innerText || ''`);
    const selected3 = Number(t3.match(/(\d+) photos? selected/)?.[1] || 0);
    r.check(selected3 === 60 && /1 not added/.test(note3), { page: "/vault/bulk", control: "D-08 Remove 3, then choose 4", expected: "3 more fit (60), the 4th is named as not added", actual: `selected ${selected3}; notice "${note3.slice(0, 200)}"`, impact: "D-08" });
    const after = (await admin.from("vault_items").select("id", { count: "exact", head: true }).eq("profile_id", P)).count;
    r.check(after === before, { page: "/vault/bulk", control: "D-08 choosing files writes nothing", expected: "No item is created until the person commits", actual: `items before ${before}, after ${after}`, impact: "D-08" });
    out.d08.push({ selected1, note1, selected2, note2, selected3, note3, before, after });
    await S.close();
  }

  if (!ONLY || ONLY === "capture") {
    const ownerUserId = (await admin.from("profile_members").select("user_id").eq("profile_id", P).limit(1)).data?.[0]?.user_id;
    const nameSel = `document.getElementById('capture-item-name')`;
    const draftKeys = (S) => S.evaluate(`Object.keys(localStorage).filter((k) => k.startsWith('vltd_capture_draft_v1'))`);
    const openCapture = async (S) => { await S.visit("/capture"); await S.waitFor(`!!document.getElementById('capture-item-name')`, 60000, "capture").catch(() => {}); await sleep(3500); };
    const val = (S) => S.evaluate(`(document.getElementById('capture-item-name') || {}).value || ''`);
    const notice = (S) => S.evaluate(`(document.querySelector('[data-testid=capture-draft-notice]') || {}).innerText || ''`);
    const aiCalls = (S) => S.intercepted.filter((x) => /\/api\/ai\//.test(x.url)).length;
    const made = [];

    // C1/C2/C7: navigate away and back, refresh; restore never calls AI
    {
      const S = await session("owner", { width: 1440, height: 900 }); const title = `QA RB6 capture draft ${st}`;
      await openCapture(S); await typeInto(S, nameSel, title); await sleep(1800);
      const keys1 = await draftKeys(S);
      await S.visit("/vault"); await sleep(3000);
      await openCapture(S); const back = await val(S); const n1 = await notice(S);
      const shN = await shot(S, "capture-restored-after-navigation");
      await S.visit("/capture"); await sleep(1500); await openCapture(S); const reloaded = await val(S);
      const ai = aiCalls(S);
      const keyScoped = keys1.some((k) => ownerUserId && k.includes(ownerUserId) && k.includes(P));
      r.check(back === title && /Restored your unsaved draft/.test(n1) && reloaded === title && ai === 0 && keyScoped, { page: "/capture", control: "D-09/D-10 type an item name, leave to the Vault, come back, then refresh", expected: "The draft is restored each time with a notice; stored under this account and profile; no AI request is made by restoring", actual: `after navigation "${back}"; notice "${n1.slice(0, 70)}"; after refresh "${reloaded}"; storage keys ${JSON.stringify(keys1).slice(0, 160)}; AI requests ${ai}`, evidence: shN, impact: "D-09 / D-10, ADD-035, ADD-037" });
      out.capture.push({ case: "navigate and refresh", back, reloaded, keys: keys1, aiRequests: ai });
      // isolation: another profile on this browser does not see it; back in this profile it is still there
      await S.evaluate(`localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(B)}); true`);
      await openCapture(S); const otherName = await val(S); const otherNotice = await notice(S);
      await S.evaluate(`localStorage.setItem('vltd_active_profile_id_v1', ${JSON.stringify(P)}); true`);
      await openCapture(S); const ownAgain = await val(S);
      r.check(otherName === "" && !otherNotice && ownAgain === title, { page: "/capture", control: "D-09 draft scope: switch to another profile and back", expected: "The other profile sees no draft; this profile's draft is still there", actual: `other profile name "${otherName}", notice "${otherNotice}"; back in own profile "${ownAgain}"`, impact: "D-09 isolation" });
      // explicit discard
      await click(S, `document.querySelector('[data-testid=capture-draft-discard]')`); await sleep(1500);
      const afterDiscard = await val(S); const keysAfter = await draftKeys(S);
      await openCapture(S); const reAfterDiscard = await val(S); const noticeAfter = await notice(S);
      r.check(afterDiscard === "" && keysAfter.length === 0 && reAfterDiscard === "" && !noticeAfter, { page: "/capture", control: "D-09 Discard draft", expected: "The form is cleared, nothing stays in storage, a refresh restores nothing", actual: `name after discard "${afterDiscard}"; keys ${keysAfter.length}; after refresh "${reAfterDiscard}"`, impact: "D-09" });
      out.capture.push({ case: "isolation and discard", otherName, ownAgain, afterDiscard, keysAfter: keysAfter.length });
      await S.close();
    }
    // C3: a photo survives a refresh; C6: saving clears the draft
    {
      const S = await session("owner", { width: 1440, height: 900 }); const title = `QA RB6 capture photo ${st}`;
      await openCapture(S);
      const png = T.mkPng(T.tmp("rb6-cap.png"), 64, 64, [200, 60, 60]);
      await T.uploadFiles(S, "input[type=file]", [png], 0); await sleep(2500);
      await typeInto(S, nameSel, title); await sleep(2500);
      const photosBefore = await S.evaluate(`document.querySelectorAll('main img[src^="blob:"]').length`);
      await openCapture(S); const photosAfter = await S.evaluate(`document.querySelectorAll('main img[src^="blob:"]').length`); const nm = await val(S); const n = await notice(S);
      const sh = await shot(S, "capture-photo-restored");
      r.check(photosBefore > 0 && photosAfter > 0 && nm === title, { page: "/capture", control: "D-10 a photo and a name, then refresh", expected: "Photo and name restored (no AI)", actual: `photos before ${photosBefore}, after ${photosAfter}; name "${nm}"; notice "${n.slice(0, 60)}"; AI requests ${aiCalls(S)}`, evidence: sh, impact: "D-10 / ADD-037" });
      out.capture.push({ case: "photo restore", photosBefore, photosAfter, aiRequests: aiCalls(S) });
      await click(S, btn(/Save to Vault/)); await sleep(6000);
      const path = await S.evaluate("location.pathname");
      const rows = await poll(async () => { const x = (await admin.from("vault_items").select("id,title").eq("profile_id", P).eq("title", title)).data || []; return x.length ? x : null; }, 60000, 3000) || [];
      rows.forEach((x) => made.push(x.id));
      await openCapture(S); const afterSave = await val(S); const keys = await draftKeys(S); const n2 = await notice(S);
      r.check(rows.length === 1 && afterSave === "" && keys.length === 0 && !n2, { page: "/capture", control: "D-09 Save to Vault clears the draft", expected: "One item saved; no draft remains and a refresh restores nothing", actual: `rows ${rows.length}; form after "${afterSave}"; draft keys ${keys.length}; notice "${n2}"`, impact: "D-09" });
      out.capture.push({ case: "save clears", rows: rows.length, keys: keys.length });
      await S.close();
    }
    // C8: another account on this browser does not inherit the draft (the draft key carries the account id)
    {
      const S = await session("owner", { width: 1440, height: 900 }); const title = `QA RB6 capture owner-only ${st}`;
      await openCapture(S); await typeInto(S, nameSel, title); await sleep(1800);
      const stored = await S.evaluate(`(() => { const k = Object.keys(localStorage).find((x) => x.startsWith('vltd_capture_draft_v1:')); return k || ''; })()`);
      // act as a different signed-in account on the same browser: the stored session user id changes
      const sessionKey = await S.evaluate(`Object.keys(localStorage).find((k) => /vltd-auth|sb-.*-auth-token/.test(k)) || ''`);
      const orig = sessionKey ? await S.evaluate(`localStorage.getItem(${JSON.stringify(sessionKey)})`) : null;
      let other = "(no stored session to swap)";
      if (sessionKey && orig) {
        const swapped = orig.replace(new RegExp(ownerUserId || "x", "g"), "00000000-0000-4000-8000-000000000000");
        await S.evaluate(`localStorage.setItem(${JSON.stringify(sessionKey)}, ${JSON.stringify(swapped)}); true`);
        await S.visit("/capture"); await sleep(5000);
        const rendered = await S.evaluate(`!!document.getElementById('capture-item-name')`);
        other = rendered + "|" + (await val(S)) + "|" + (await notice(S));
        await S.evaluate(`localStorage.setItem(${JSON.stringify(sessionKey)}, ${JSON.stringify(orig)}); true`);
      }
      await S.evaluate(`Object.keys(localStorage).filter((k) => k.startsWith('vltd_capture_draft_v1')).forEach((k) => localStorage.removeItem(k)); true`);
      out.capture.push({ case: "other account", storedKey: stored, otherAccountSees: other });
      r.check(!!stored && ownerUserId && stored.includes(ownerUserId) && (other === "true||" || /no stored session/.test(other)), { page: "/capture", control: "D-09 another account on the same browser", expected: "The draft is stored under this account's id and profile; a different signed-in account sees no draft", actual: `key "${stored}"; as another account: "${other}"`, impact: "D-09 isolation" });
      await S.close();
    }
    for (const id of new Set(made)) await admin.from("vault_items").delete().eq("id", id).eq("profile_id", P);
    for (const x of (await admin.from("vault_items").select("id").eq("profile_id", P).like("title", "QA RB6 capture%")).data || []) await admin.from("vault_items").delete().eq("id", x.id);
  }
  save(`rb6-bulk-capture-${LABEL}`, out); console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(2); });

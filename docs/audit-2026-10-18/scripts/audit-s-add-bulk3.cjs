// ADD audit, suite 5b: Bulk upload scan-quota display and the Scan button when the quota cannot be read (the database function only authorises p_profile = the signed-in user id),
// for the Personal and the Business profile; and the 62-file check redone with an honest assertion.
const T = require("./audit-s-add-lib.cjs");
const { session, sleep, man, admin, rec, click, clickText, pickSelect, text, allCount, chooseViaButton, mkPng, tmp } = T;
const tkRe = /(\d+)\s*\n?\s*of (\d+) AI scans left/;
(async () => {
  const m = man();
  for (const kind of ["owner", "business"]) {
    const label = kind === "owner" ? "Personal" : "Business"; const pid = kind === "owner" ? m.personalId : m.businessId;
    const S = await session(kind, { width: 1440, height: 900 });
    try {
      await S.visit("/vault/bulk"); await S.waitFor("document.querySelectorAll('select').length >= 1", 60000);
      let tk = null; for (let i = 0; i < 6 && !tk; i++) { await sleep(2500); tk = (await S.text()).match(tkRe); }
      const db = (await admin.rpc("bulk_scan_status", { p_profile: pid })).data; const row = Array.isArray(db) ? db[0] : db;
      const bad = S.badResponses.filter((b) => /bulk_scan_status/.test(b.url)).length;
      await rec(S, !!tk && Number(tk[1]) === row.remaining, { page: `/vault/bulk | owner, ${label} profile (profile id differs from the user id)`, control: "AI scans ticker ('N of M AI scans left this cycle')", expected: "Shows the remaining and the limit the database holds for this profile", actual: `ticker ${tk ? tk[0].replace(/\n/g, " ") : "never appears (15 s)"}; the page's call to bulk_scan_status was answered with an error ${bad}x (the database function says 'not authorized to access this quota' unless the profile id equals the user id); the database holds remaining=${row && row.remaining}, limit=${row && row.scan_limit}`, impact: "misleading result", repro: "Open /vault/bulk, wait 15 s" });
      await T.mkPng(tmp("b3-" + kind + ".png"), 500, 400, [90, 90, 200]);
      await chooseViaButton(S, T.btnExpr("Choose photos"), tmp("b3-" + kind + ".png")); await sleep(1500);
      await pickSelect(S, "document.querySelectorAll('select')[0]", "Music"); await sleep(400);
      const cats = await S.evaluate("[...document.querySelectorAll('select')[1].options].map((o) => o.text.trim()).filter((x) => x && !/Select/.test(x))"); await pickSelect(S, "document.querySelectorAll('select')[1]", cats[0]); await sleep(400);
      const iB = S.intercepted.length;
      const btn = await T.rectOf(S, T.btnExpr("Scan with AI to fill details"));
      await clickText(S, "Scan with AI to fill details"); await sleep(3000);
      await S.waitFor("/Add all \\d+ to Vault/.test(document.body.innerText)", 60000).catch(() => {});
      const t = await text(S); const calls = S.intercepted.slice(iB).filter((x) => /api\/ai/.test(x.url)).length;
      const msg = (t.match(/You.ve used all your AI scans[^.]*\./) || [""])[0];
      await rec(S, !(!tk && /used all your AI scans/.test(t)), { page: `/vault/bulk | owner, ${label} profile`, control: "Scan with AI to fill details when the scan allowance could not be read", expected: "The page does not claim the scans are used up when it never learned the allowance (it should say it could not check, or just scan)", actual: `Scan button enabled=${btn && !btn.disabled}; AI requests made=${calls}; message shown: '${msg || "(none)"}'`, impact: "misleading result", repro: "Open /vault/bulk, queue a photo, pick Music + category, press Scan with AI to fill details" });
    } finally { await S.close(); }
  }
  // 62 files
  const many = []; for (let i = 0; i < 62; i++) many.push(mkPng(tmp(`m3-${i}.png`), 40, 40, [i * 4, 100, 100]));
  const S2 = await session("owner", { width: 1440, height: 900 });
  try {
    await S2.visit("/vault/bulk"); await S2.waitFor("document.querySelectorAll('select').length >= 1", 60000); await sleep(1200);
    await chooseViaButton(S2, T.btnExpr("Choose photos"), many); await sleep(6000);
    const n = await S2.evaluate("document.querySelectorAll('[aria-label=\"Remove photo\"]').length");
    const t = await text(S2); const said = (t.match(/(\d+) photos? selected/i) || [""])[0];
    const mentions = /2 (more )?(photos|files)[^.]*(left out|not added|skipped|over|too many|limit)|only the first 60|first 60|limit of 60|too many/i.test(t);
    await rec(S2, n === 62 || mentions, { page: "/vault/bulk | owner, Personal", control: "Choose photos with 62 files (the page says 'Up to 60 at a time') - corrects ADD-411", expected: "Either all 62 are taken, or the page says 2 were left out", actual: `queued=${n}; page says '${said}'; mentions the 2 left out=${mentions}`, impact: "data loss", repro: "Choose 62 images" });
  } finally { await S2.close(); }
})().catch((e) => { console.error(e); process.exit(2); });
